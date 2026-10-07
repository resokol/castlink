$ErrorActionPreference = 'Stop'
function New-SimpleSecret {
  $bytes = New-Object byte[] 32
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  return -join ($bytes | ForEach-Object { $_.ToString('x2') })
}
function Write-SimpleText([string]$Path,[string]$Text) {
  [IO.File]::WriteAllText($Path,$Text,(New-Object Text.UTF8Encoding($false)))
}
function Quote-SimpleArgument([string]$Value) {
  # CommandLineToArgvW: quote backslashes preceding quotes and the closing quote.
  return '"' + [regex]::Replace([regex]::Replace($Value,'(\\*)"','$1$1\"'),'(\\+)$','$1$1') + '"'
}
function Invoke-SimpleProcess([string]$File,[string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
  $info = New-Object Diagnostics.ProcessStartInfo
  $info.FileName=$File; $info.Arguments=($Arguments | ForEach-Object { Quote-SimpleArgument $_ }) -join ' '
  $info.UseShellExecute=$false; $info.CreateNoWindow=$true
  $info.RedirectStandardOutput=$true; $info.RedirectStandardError=$true; $info.RedirectStandardInput=$true
  $process=New-Object Diagnostics.Process; $process.StartInfo=$info
  try {
    if (-not $process.Start()) { throw 'Не удалось запустить команду.' }
    $out=$process.StandardOutput.ReadToEndAsync(); $err=$process.StandardError.ReadToEndAsync()
    if ($InputText.Length) { $process.StandardInput.Write($InputText) }; $process.StandardInput.Close()
    if (-not $process.WaitForExit($TimeoutSeconds*1000)) { $process.Kill(); $process.WaitForExit(); throw 'Команда не завершилась вовремя. Повтори мастер после проверки Docker.' }
    return [pscustomobject]@{code=$process.ExitCode;stdout=$out.GetAwaiter().GetResult();stderr=$err.GetAwaiter().GetResult()}
  } finally { $process.Dispose() }
}
function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
  if ($script:SshSession) {
    $command='docker --host unix:///var/run/docker.sock '+ (($Arguments | ForEach-Object { ConvertTo-SimplePosixLiteral $_ }) -join ' ')
    $result=Invoke-SimpleSshCommand -Client $script:SshSession -Command $command -Stdin $InputText -TimeoutSeconds $TimeoutSeconds
  } else {
    $result=Invoke-SimpleProcess -File $script:DockerExe -Arguments (@('--context','desktop-linux')+$Arguments) -InputText $InputText -TimeoutSeconds $TimeoutSeconds
  }
  if ($result.code -ne 0) { throw ('Docker: '+$result.stderr.Trim()) }
  return $result.stdout
}
function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
  return Invoke-DeploymentDocker -Arguments (@('compose','--project-directory',$script:ServerFolder,'-f',($script:ServerFolder+'/compose.json'))+$Arguments) -InputText $InputText -TimeoutSeconds $TimeoutSeconds
}
function New-SimpleConfiguration([string]$Folder,[string]$Address,[bool]$PublicHttps,[object]$Release) {
  $statePath=Join-Path $Folder '.castlink-install.json'
  if (Test-Path -LiteralPath $statePath) {
    $state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.address -ne $Address -or $state.publicHttps -ne $PublicHttps) { throw 'В этой папке уже настроен другой адрес. Выбери новую папку или прежний адрес.' }
    return $state
  }
  $iid=[Guid]::NewGuid().ToString(); $node='srv-'+$iid.Replace('-','')
  $state=[pscustomobject]@{schemaVersion=1;installationId=$iid;nodeId=$node;address=$Address;publicHttps=$PublicHttps;databasePhase='new';completed=$false;password=(New-SimpleSecret);livekitKey=('lk_'+(New-SimpleSecret).Substring(0,32));livekitSecret=(New-SimpleSecret);setupToken=(New-SimpleSecret);session=(New-SimpleSecret);encryption=(New-SimpleSecret);nodeSecret=(New-SimpleSecret)}
  Save-SimpleState $Folder $state
  return $state
}
function Save-SimpleState([string]$Folder,[object]$State) { Write-SimpleText (Join-Path $Folder '.castlink-install.json') ($State | ConvertTo-Json -Depth 10) }
function Write-SimpleConfiguration([string]$Folder,[object]$State,[object]$Release,[string]$MediaIp) {
  $iid=$State.installationId; $node=$State.nodeId
  Write-SimpleText (Join-Path $Folder 'postgres.env') "POSTGRES_USER=castlink`nPOSTGRES_DB=castlink`nPOSTGRES_PASSWORD=$($State.password)`n"
  $envText=@"
NODE_ENV=production
CASTLINK_DEPLOYMENT_MODEL=self-hosted
CASTLINK_STORAGE_BACKEND=json
DATABASE_URL=postgresql://castlink:$($State.password)@postgres:5432/castlink
LIVEKIT_SERVER_URL=http://livekit:7880
LIVEKIT_API_KEY=$($State.livekitKey)
LIVEKIT_API_SECRET=$($State.livekitSecret)
CASTLINK_SESSION_SECRET=$($State.session)
CASTLINK_DATA_ENCRYPTION_KEY=$($State.encryption)
CASTLINK_SETUP_TOKEN=$($State.setupToken)
STUDIOLINK_DATA_DIR=/data
STUDIOLINK_INSTALLATION_ID=$iid
STUDIOLINK_DEFAULT_STUDIO_ID=studio-default
CASTLINK_NODE_ID=$node
CASTLINK_SERVER_ID=$node
CASTLINK_NODE_SECRET=$($State.nodeSecret)
CASTLINK_NODE_TYPE=self-hosted
CASTLINK_ENFORCE_NODE_ADMISSION=1
CASTLINK_LICENSE_ENFORCE=0
CASTLINK_CONTROL_PLANE_URL=
CASTLINK_LICENSE_SERVICE_URL=
"@
  Write-SimpleText (Join-Path $Folder 'web.env') ($envText+"`n")
  $keys=@{}; $keys[$State.livekitKey]=$State.livekitSecret
  $lk=@{port=7880;log_level='info';rtc=@{tcp_port=7881;port_range_start=61000;port_range_end=61100;use_external_ip=$false;node_ip=$MediaIp;enable_loopback_candidate=($MediaIp -eq '127.0.0.1')};keys=$keys}
  Write-SimpleText (Join-Path $Folder 'livekit.json') ($lk | ConvertTo-Json -Depth 10)
  $tls=if ($State.publicHttps) { '' } else { 'tls internal' }
  $caddyGlobal=if ($State.publicHttps) { "{`n admin off`n}" } else { "{`n admin off`n auto_https disable_redirects`n skip_install_trust`n default_sni $($State.address)`n}" }
  $caddy=@"
$caddyGlobal
https://$($State.address) {
 $tls
 @rtc path /rtc /rtc/*
 route @rtc {
  forward_auth web:3000 {
   uri /api/media-admission
   header_up -Upgrade
   header_up -Connection
  }
  reverse_proxy livekit:7880
 }
 reverse_proxy web:3000
}
"@
  Write-SimpleText (Join-Path $Folder 'Caddyfile') ($caddy+"`n")
  $ports=@('443:443'); if ($State.publicHttps) { $ports+= '80:80' }
  $services=@{
    postgres=@{image=$Release.images.postgres;platform='linux/amd64';restart='unless-stopped';env_file=@('postgres.env');volumes=@('postgres-data:/var/lib/postgresql/data');healthcheck=@{test=@('CMD-SHELL','pg_isready -U "$POSTGRES_USER" -d "$POSTGRES_DB"');interval='5s';timeout='5s';retries=24}}
    web=@{image=$Release.images.web;platform='linux/amd64';restart='unless-stopped';env_file=@('web.env');volumes=@('web-data:/data');depends_on=@{postgres=@{condition='service_healthy'}}}
    livekit=@{image=$Release.images.livekit;platform='linux/amd64';restart='unless-stopped';command=@('--config','/etc/livekit.yaml');volumes=@('./livekit.json:/etc/livekit.yaml:ro');ports=@('7881:7881/tcp','61000-61100:61000-61100/udp')}
    caddy=@{image=$Release.images.caddy;platform='linux/amd64';restart='unless-stopped';volumes=@('./Caddyfile:/etc/caddy/Caddyfile:ro','caddy-data:/data','caddy-config:/config');ports=$ports;depends_on=@('web','livekit')}
  }
  $compose=@{name=('castlink-easy-'+$iid.Replace('-',''));services=$services;volumes=@{'postgres-data'=@{};'web-data'=@{};'caddy-data'=@{};'caddy-config'=@{}}}
  Write-SimpleText (Join-Path $Folder 'compose.json') ($compose | ConvertTo-Json -Depth 15)
}
function Complete-SimpleDeployment([string]$Folder,[object]$State) {
  Write-Host 'Подготавливаю базу данных...'
  foreach ($phase in @('migrations','seed')) {
    if (($phase -eq 'migrations' -and $State.databasePhase -eq 'new') -or ($phase -eq 'seed' -and $State.databasePhase -eq 'migrations')) {
      $inputJson=[ordered]@{schemaVersion=1;installationId=$State.installationId;nodeId=$State.nodeId;phase=$phase} | ConvertTo-Json -Compress
      $null=Invoke-DeploymentCompose @('exec','-T','web','node','/app/scripts/setup-database-v1.mjs') $inputJson
      $State.databasePhase=$phase; Save-SimpleState $Folder $State
    }
  }
  # Complete the ordinary supported setup API from inside the selected web container.
  $finish='const http=require("node:http");function request(method,body){return new Promise((resolve,reject)=>{const q=http.request({hostname:"127.0.0.1",port:3000,path:"/api/setup",method,headers:{origin:"http://127.0.0.1:3000",host:"127.0.0.1:3000","content-type":"application/json","x-castlink-setup-token":process.env.CASTLINK_SETUP_TOKEN}},r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>resolve({status:r.statusCode,body:b}))});q.on("error",reject);q.setTimeout(15000,()=>q.destroy());q.end(body||"")})};(async()=>{const r=await request("POST",JSON.stringify({mode:"public",serverName:"CastLink"}));if(r.status!==200&&r.status!==409)throw Error("Setup API refused");const check=await request("GET");if(check.status!==200||JSON.parse(check.body).needsSetup!==false)throw Error("Setup not completed")})().catch(()=>{console.error("Setup API not completed");process.exitCode=1});'
  $null=Invoke-DeploymentCompose @('exec','-T','web','node','-e',$finish)
  $State.completed=$true; Save-SimpleState $Folder $State
  Write-Host 'Создаю ссылку входа владельца...'
  $invite='/data/owner-invite-'+[Guid]::NewGuid().ToString()+'.txt'
  $origin='https://'+$State.address
  $null=Invoke-DeploymentCompose @('exec','-T','web','node','/app/scripts/super-admin-owner.mjs','--origin',$origin,'--output',$invite)
  $url=(Invoke-DeploymentCompose @('exec','-T','web','cat',$invite)).Trim()
  if (-not $url.StartsWith($origin+'/super-admin')) { throw 'Сервер вернул неожиданную ссылку владельца.' }
  Write-SimpleText (Join-Path $Folder 'owner-access.txt') $url
  return $url
}
