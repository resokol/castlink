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
$cleanupHelper=Join-Path $PSScriptRoot 'simple-easy-setup-cleanup.ps1'
if(Test-Path -LiteralPath $cleanupHelper){. $cleanupHelper}
$networkHelper=Join-Path $PSScriptRoot 'simple-easy-setup-network.ps1'
if(Test-Path -LiteralPath $networkHelper){. $networkHelper}
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
    # Framework constructs its stdin writer during Start and may flush a BOM
    # immediately. Give that writer a BOM-free encoding, restoring our console.
    $consoleEncoding=[Console]::InputEncoding
    try {
      [Console]::InputEncoding=New-Object Text.UTF8Encoding($false)
      if (-not $process.Start()) { throw 'Не удалось запустить команду.' }
    } finally { [Console]::InputEncoding=$consoleEncoding }
    $out=$process.StandardOutput.ReadToEndAsync(); $err=$process.StandardError.ReadToEndAsync()
    # .NET Framework's text writer inherits chcp65001's UTF8 BOM. Write bytes
    # directly and close the stream so canonical JSON has no console preamble.
    $stdin=$process.StandardInput.BaseStream
    if ($InputText.Length) { $bytes=(New-Object Text.UTF8Encoding($false)).GetBytes($InputText);$stdin.Write($bytes,0,$bytes.Length) }
    $stdin.Flush();$stdin.Close()
    if (-not $process.WaitForExit($TimeoutSeconds*1000)) { $process.Kill(); $process.WaitForExit(); throw (New-Object TimeoutException 'Команда не завершилась вовремя. Повтори мастер после проверки Docker.') }
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
  if ($result.code -ne 0) {
    $message=$result.stderr.Trim()
    if (-not $message.Length) {
      $message='команда завершилась с кодом '+$result.code
      # Only this fixed bootstrap refusal is safe to surface from stdout.
      # Arbitrary process output may contain credentials and is not displayed.
      if ($result.stdout.Trim() -ceq '{"schemaVersion":1,"contract":"castlink-database-v1","ok":false,"diagnosis":"database-contract-refused"}') { $message+=' (database-contract-refused)' }
    }
    throw ('Docker: '+$message)
  }
  return $result.stdout
}
function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName='') {
  $prefix=@('compose','--project-directory',$script:ServerFolder,'-f',($script:ServerFolder+'/compose.json'));if ($ProjectName) { $prefix+=@('--project-name',$ProjectName) }
  return Invoke-DeploymentDocker -Arguments ($prefix+$Arguments) -InputText $InputText -TimeoutSeconds $TimeoutSeconds
}
function Assert-SimpleTurnDomain([string]$TurnDomain,[string]$Address,[bool]$PublicHttps) {
  if (-not $TurnDomain) { return }
  $ip=$null
  if (-not $PublicHttps -or [Net.IPAddress]::TryParse($Address,[ref]$ip) -or $TurnDomain -ceq $Address -or $TurnDomain.Length -gt 253 -or $TurnDomain -cne $TurnDomain.ToLowerInvariant() -or $TurnDomain -notmatch '^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$') { throw 'TURN/TLS 443 требует отдельного домена, публичного HTTPS и доменного адреса сайта. Проверь DNS обоих имён.' }
}
function New-SimpleConfiguration([string]$Folder,[string]$Address,[bool]$PublicHttps,[object]$Release,[string]$TurnDomain='') {
  Assert-SimpleTurnDomain $TurnDomain $Address $PublicHttps
  $statePath=Join-Path $Folder '.castlink-install.json'
  if (Test-Path -LiteralPath $statePath) {
    $state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
    if ($state.removalOnly) { throw 'Эта папка содержит только данные выбора удаления, не полную установку. Используй прежнюю папку установки или сохранённый Compose на VPS.' }
    if ($state.address -ne $Address -or $state.publicHttps -ne $PublicHttps) { throw 'В этой папке уже настроен другой адрес. Выбери новую папку или прежний адрес.' }
    if ($TurnDomain) {
      if ($state.PSObject.Properties['turnDomain'] -and $state.turnDomain -and $state.turnDomain -cne $TurnDomain) { throw 'Домен TURN не совпал с сохранённой установкой.' }
      $state | Add-Member -NotePropertyName turnDomain -NotePropertyValue $TurnDomain -Force
      Save-SimpleState $Folder $state
    }
    return $state
  }
  $iid=[Guid]::NewGuid().ToString(); $node='srv-'+$iid.Replace('-','')
  $state=[pscustomobject]@{schemaVersion=1;installationId=$iid;nodeId=$node;address=$Address;publicHttps=$PublicHttps;databasePhase='new';completed=$false;password=(New-SimpleSecret);livekitKey=('lk_'+(New-SimpleSecret).Substring(0,32));livekitSecret=(New-SimpleSecret);setupToken=(New-SimpleSecret);session=(New-SimpleSecret);encryption=(New-SimpleSecret);nodeSecret=(New-SimpleSecret)}
  if ($TurnDomain) { $state | Add-Member -NotePropertyName turnDomain -NotePropertyValue $TurnDomain }
  Save-SimpleState $Folder $state
  return $state
}
function Save-SimpleState([string]$Folder,[object]$State) { Write-SimpleText (Join-Path $Folder '.castlink-install.json') ($State | ConvertTo-Json -Depth 10) }
function Get-SimpleRoomCreationPasswordHash([object]$State) {
  if(-not $State.PSObject.Properties['roomCreationPasswordHash']){return ''}
  $hash=[string]$State.roomCreationPasswordHash
  if($hash -cnotmatch '^[a-f0-9]{64}$'){throw 'Сохранённая настройка пароля создания комнат повреждена. Действующий пароль не изменён.'}
  return $hash
}
function Get-SimpleCaddyConfiguration([object]$State) {
  if($State.PSObject.Properties['network'] -and $State.network){
    $null=Get-SimpleNetworkConfiguration $State
    if(-not $State.PSObject.Properties['turnDomain'] -or -not $State.turnDomain){return Get-SimpleAdvancedCaddyConfiguration $State}
  }
  if ($State.PSObject.Properties['turnDomain'] -and $State.turnDomain) {
    Assert-SimpleTurnDomain ([string]$State.turnDomain) ([string]$State.address) ([bool]$State.publicHttps)
    return @"
{
 admin off
 auto_https disable_redirects
 https_port 8443
 servers :8443 {
  protocols h1 h2
  listener_wrappers {
   proxy_protocol {
    timeout 2s
    allow 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16
    fallback_policy require
   }
   tls
  }
 }
}
http://$($State.address) {
 redir https://$($State.address){uri} permanent
}
http://$($State.turnDomain) {
 redir https://$($State.turnDomain){uri} permanent
}
https://$($State.address) {
 tls {
  issuer acme {
   disable_tlsalpn_challenge
  }
 }
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
https://$($State.turnDomain) {
 tls {
  issuer acme {
   disable_tlsalpn_challenge
  }
 }
 respond "TURN endpoint" 204
}

"@
  }
  $ip=$null;$isIp=[Net.IPAddress]::TryParse([string]$State.address,[ref]$ip)
  $tls=if (-not $State.publicHttps) { 'tls internal' } elseif ($isIp) {
    "tls {`n  issuer acme {`n   dir https://acme-v02.api.letsencrypt.org/directory`n   profile shortlived`n  }`n }"
  } else { '' }
  $caddyGlobal=if ($State.publicHttps) {
    if ($isIp) { "{`n admin off`n default_sni $($State.address)`n}" } else { "{`n admin off`n}" }
  } else { "{`n admin off`n auto_https disable_redirects`n skip_install_trust`n default_sni $($State.address)`n}" }
  return @"
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
}
function Write-SimpleConfiguration([string]$Folder,[object]$State,[object]$Release,[string]$MediaIp) {
  $iid=$State.installationId; $node=$State.nodeId
  $creationPasswordHash=Get-SimpleRoomCreationPasswordHash $State
  $network=$null
  if($State.PSObject.Properties['network'] -and $State.network){$network=Get-SimpleNetworkConfiguration $State $MediaIp;$MediaIp=$network.mediaIp}
  $publicOrigin=if($network){$network.publicOrigin}else{'https://'+$State.address}
  $turnTls=($State.PSObject.Properties['turnDomain'] -and [bool]$State.turnDomain)
  if ($turnTls) {
    Assert-SimpleTurnDomain ([string]$State.turnDomain) ([string]$State.address) ([bool]$State.publicHttps)
    if (-not $Release.images.PSObject.Properties['turntls'] -or -not $Release.images.turntls) { throw 'Этот выпуск не содержит образ TURN/TLS. Обнови пакет установки перед включением доменного запасного маршрута.' }
  }
  $turnTransport=if ($turnTls) { 'tls443' } else { 'udp' }
  Write-SimpleText (Join-Path $Folder 'postgres.env') "POSTGRES_USER=castlink`nPOSTGRES_DB=castlink`nPOSTGRES_PASSWORD=$($State.password)`n"
  $envText=@"
NODE_ENV=production
CASTLINK_DEPLOYMENT_MODEL=self-hosted
ROOM_CREATION_PASSWORD_SHA256=$creationPasswordHash
CASTLINK_STORAGE_BACKEND=json
DATABASE_URL=postgresql://castlink:$($State.password)@postgres:5432/castlink
LIVEKIT_SERVER_URL=http://livekit:7880
LIVEKIT_API_KEY=$($State.livekitKey)
LIVEKIT_API_SECRET=$($State.livekitSecret)
CASTLINK_GUEST_RELAY_ENABLED=1
CASTLINK_TURN_TRANSPORT=$turnTransport
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
STUDIOLINK_TRANSFER_ORIGIN=$publicOrigin
STUDIOLINK_TRANSFER_SERVER_ID=$node
"@
  Write-SimpleText (Join-Path $Folder 'web.env') ($envText+"`n")
  $keys=@{}; $keys[$State.livekitKey]=$State.livekitSecret
  # Credentials are issued per participant by LiveKit after authenticated signalling.
  # Permit only this installation's SFU address for LAN/loopback relay peers.
  $turn=@{enabled=$true;udp_port=3478;relay_range_start=30000;relay_range_end=30031;allow_restricted_peer_cidrs=@($MediaIp+'/32')}
  if ($turnTls) {
    $turn.domain=[string]$State.turnDomain;$turn.tls_port=5349;$turn.external_tls=$true;$turn.proxy_protocol=$true
    # Only the unpublished listener on this installation's isolated Compose network
    # accepts PROXY headers. Support Docker's configurable private address pools;
    # relay peer permissions above stay restricted to the exact SFU address.
    $turn.proxy_protocol_trusted_cidrs=@('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')
  }
  $lk=@{port=7880;log_level='info';rtc=@{tcp_port=7881;udp_port=7882;use_external_ip=$false;node_ip=$MediaIp;enable_loopback_candidate=($MediaIp -eq '127.0.0.1')};keys=$keys;turn=$turn}
  if($network){
    $lk.rtc.tcp_port=$network.iceTcpPort;$lk.rtc.udp_port=$network.iceUdpPort
    $lk.turn.udp_port=$network.turnUdpPort;$lk.turn.relay_range_start=$network.relayPortStart;$lk.turn.relay_range_end=$network.relayPortEnd
  }
  Write-SimpleText (Join-Path $Folder 'livekit.json') ($lk | ConvertTo-Json -Depth 10)
  Write-SimpleText (Join-Path $Folder 'Caddyfile') (Get-SimpleCaddyConfiguration $State)
  $binding=if ($State.address -eq '127.0.0.1') { '127.0.0.1:' } else { '' }
  $ports=@($binding+'443:443'); if ($State.publicHttps) { $ports+= '80:80' }
  $restartPolicy=if($State.PSObject.Properties['target'] -and $State.target -ceq 'local'){'no'}else{'unless-stopped'}
  $services=@{
    postgres=@{image=$Release.images.postgres;platform='linux/amd64';restart=$restartPolicy;env_file=@('postgres.env');volumes=@('postgres-data:/var/lib/postgresql/data');healthcheck=@{test=@('CMD-SHELL','pg_isready -U castlink -d castlink');interval='5s';timeout='5s';retries=24}}
    web=@{image=$Release.images.web;platform='linux/amd64';restart=$restartPolicy;env_file=@('web.env');volumes=@('web-data:/data','converter-socket:/run/castlink-converter:ro');depends_on=@{postgres=@{condition='service_healthy'}}}
    livekit=@{image=$Release.images.livekit;platform='linux/amd64';restart=$restartPolicy;command=@('--config','/etc/livekit.yaml');volumes=@('./livekit.json:/etc/livekit.yaml:ro');ports=@(($binding+'7881:7881/tcp'),($binding+'7882:7882/udp'),($binding+'3478:3478/udp'),($binding+'30000-30031:30000-30031/udp'))}
    caddy=@{image=$Release.images.caddy;platform='linux/amd64';restart=$restartPolicy;volumes=@('./Caddyfile:/etc/caddy/Caddyfile:ro','caddy-data:/data','caddy-config:/config');ports=$ports;depends_on=@('web','livekit')}
  }
  if($network){
    $webBinding=if($network.bindAddress -eq '0.0.0.0'){''}else{$network.bindAddress+':'}
    $mediaBinding=if($network.mediaIp -eq '127.0.0.1'){'127.0.0.1:'}else{''}
    if($network.mode -eq 'https'){
      $services.caddy.ports=@($webBinding+$network.httpsPort+':443')
      if($State.publicHttps){$services.caddy.ports+=($webBinding+$network.httpPort+':80')}
    }else{$services.caddy.ports=@($webBinding+$network.httpPort+':80')}
    $services.livekit.ports=@(($mediaBinding+$network.iceTcpPort+':'+$network.iceTcpPort+'/tcp'),($mediaBinding+$network.iceUdpPort+':'+$network.iceUdpPort+'/udp'),($mediaBinding+$network.turnUdpPort+':'+$network.turnUdpPort+'/udp'),($mediaBinding+$network.relayPortStart+'-'+$network.relayPortEnd+':'+$network.relayPortStart+'-'+$network.relayPortEnd+'/udp'))
  }
  $services['presentation-converter']=@{image=$Release.images.web;platform='linux/amd64';restart=$restartPolicy;command=@('python3','/app/scripts/presentation-converter/server.py');init=$true;user='10001:10001';read_only=$true;network_mode='none';cap_drop=@('ALL');security_opt=@('no-new-privileges:true');volumes=@('converter-socket:/run/castlink-converter','converter-work:/tmp');mem_limit='2g';pids_limit=128;cpus=1}
  if ($turnTls) {
    $services.caddy.ports=@('80:80')
    $services['turn-tls']=@{image=$Release.images.turntls;platform='linux/amd64';restart=$restartPolicy;environment=@{CASTLINK_TURN_HOST=[string]$State.turnDomain};volumes=@('caddy-data:/data:ro');ports=@('443:443');depends_on=@('caddy','livekit');healthcheck=@{test=@('CMD','/usr/local/bin/castlink-turn-tls','health');interval='10s';timeout='5s';retries=24;start_period='30s'}}
  }
  $compose=@{name=('castlink-easy-'+$iid.Replace('-',''));services=$services;volumes=@{'postgres-data'=@{};'web-data'=@{};'caddy-data'=@{};'caddy-config'=@{};'converter-socket'=@{};'converter-work'=@{}}}
  Write-SimpleText (Join-Path $Folder 'compose.json') ($compose | ConvertTo-Json -Depth 15)
}

function Stop-SimpleLegacyMediaForUpdate([string]$Folder,[object]$State) {
  $compose=Get-Content -LiteralPath (Join-Path $Folder 'compose.json') -Raw|ConvertFrom-Json
  $project=Get-SimpleRemovalProject $State $compose
  $binding=if($State.address -eq '127.0.0.1'){'127.0.0.1:'}else{''}
  $compact=@(($binding+'7881:7881/tcp'),($binding+'7882:7882/udp'),($binding+'3478:3478/udp'),($binding+'30000-30031:30000-30031/udp'))
  $livekit=Get-Content -LiteralPath (Join-Path $Folder 'livekit.json') -Raw|ConvertFrom-Json
  if(($compose.services.livekit.ports -join ',') -cne ($compact -join ',') -or $livekit.rtc.udp_port -ne 7882 -or $livekit.rtc.PSObject.Properties['port_range_start'] -or $livekit.rtc.PSObject.Properties['port_range_end'] -or $livekit.turn.relay_range_start -ne 30000 -or $livekit.turn.relay_range_end -ne 30031){return $false}
  $query=@('ps','-q','--filter',('label=com.docker.compose.project='+$project),'--filter','label=com.docker.compose.service=livekit')
  $ids=@((Invoke-DeploymentDocker $query '' 30) -split '\r?\n'|Where-Object{$_.Length})
  if(-not $ids.Count){return $false}
  if($ids.Count -ne 1){throw 'Найдено несколько медиаконтейнеров выбранной установки. Службы не остановлены; проверь Docker.'}
  # Read the running container, since configuration files already describe the new ports.
  # Do not inspect its environment or credentials.
  $format='{"project":{{json (index .Config.Labels "com.docker.compose.project")}},"service":{{json (index .Config.Labels "com.docker.compose.service")}},"running":{{json .State.Running}},"ports":{{json .NetworkSettings.Ports}}}'
  $container=ConvertFrom-Json -InputObject (Invoke-DeploymentDocker @('inspect','--format',$format,$ids[0]) '' 30)
  if($container.project -cne $project -or $container.service -cne 'livekit'){throw 'Медиаконтейнер не совпал с выбранной установкой. Службы не остановлены.'}
  if($container.running -ne $true){return $false}
  $legacy=New-Object 'Collections.Generic.HashSet[string]';$null=$legacy.Add('7881/tcp');$null=$legacy.Add('3478/udp')
  foreach($port in @(61000..61100)+@(30000..30999)){$null=$legacy.Add(([string]$port+'/udp'))}
  $published=New-Object 'Collections.Generic.HashSet[string]'
  foreach($mapping in $container.ports.PSObject.Properties){
    foreach($hostBinding in $mapping.Value){
      if(-not $hostBinding.HostPort){continue}
      if(-not $legacy.Contains($mapping.Name) -or [string]$hostBinding.HostPort -cne ($mapping.Name -split '/')[0]){return $false}
      $null=$published.Add($mapping.Name)
    }
  }
  if(-not $legacy.SetEquals($published)){return $false}
  Write-Host 'Приостанавливаю медиасервис этой установки, чтобы освободить память перед загрузкой обновления. Комнаты и настройки сохраняются. Медиа возобновится после запуска обновлённых служб; при ошибке повтори «Обновить» для той же установки.'
  $null=Invoke-DeploymentCompose @('stop','livekit') '' 90 -ProjectName $project
  if((Invoke-DeploymentDocker $query '' 30).Trim()){throw 'Медиасервис ещё работает. Загрузка образов не начата; проверь Docker и повтори «Обновить».'}
  return $true
}
function Complete-SimpleDeployment([string]$Folder,[object]$State) {
  Write-Host 'Подготавливаю базу данных...'
  foreach ($phase in @('migrations','seed')) {
    if (($phase -eq 'migrations' -and $State.databasePhase -eq 'new') -or ($phase -eq 'seed' -and $State.databasePhase -eq 'migrations')) {
      $inputJson=[ordered]@{schemaVersion=1;installationId=$State.installationId;nodeId=$State.nodeId;phase=$phase} | ConvertTo-Json -Compress
      try { $null=Invoke-DeploymentCompose @('exec','-T','web','node','/app/scripts/setup-database-v1.mjs') $inputJson }
      catch { throw ('База данных ('+$phase+'): '+$_.Exception.Message) }
      $State.databasePhase=$phase; Save-SimpleState $Folder $State
    }
  }
  # Existing completed installs also need additive room-schema upgrades.
  $null=Invoke-DeploymentCompose @('exec','-T','web','node','/app/scripts/postgres-migrate.mjs')
  # Complete the ordinary supported setup API from inside the selected web container.
  $finish='const http=require("node:http");function request(method,body){return new Promise((resolve,reject)=>{const q=http.request({hostname:"127.0.0.1",port:3000,path:"/api/setup",method,headers:{origin:"http://127.0.0.1:3000",host:"127.0.0.1:3000","content-type":"application/json","x-castlink-setup-token":process.env.CASTLINK_SETUP_TOKEN}},r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>resolve({status:r.statusCode,body:b}))});q.on("error",reject);q.setTimeout(15000,()=>q.destroy());q.end(body||"")})};(async()=>{const r=await request("POST",JSON.stringify({mode:"public",serverName:"CastLink"}));if(r.status!==200&&r.status!==409)throw Error("Setup API refused");const check=await request("GET");if(check.status!==200||JSON.parse(check.body).needsSetup!==false)throw Error("Setup not completed")})().catch(()=>{console.error("Setup API not completed");process.exitCode=1});'
  $null=Invoke-DeploymentCompose @('exec','-T','web','node','-e',$finish)
  Wait-SimpleTurnTlsReadiness $State
  if ($State.PSObject.Properties['stopped']) { $State.stopped=$false }
  $State.completed=$true; Save-SimpleState $Folder $State
  return Get-SimpleHomeUrl $State
}

function Wait-SimpleTurnTlsReadiness([object]$State) {
  if (-not $State.PSObject.Properties['turnDomain'] -or -not $State.turnDomain) { return }
  Write-Host ('Ожидаю сертификат и маршрут TURN/TLS 443 для '+$State.turnDomain+'...')
  for ($attempt=0;$attempt -lt 60;$attempt++) {
    try { $null=Invoke-DeploymentCompose @('exec','-T','turn-tls','/usr/local/bin/castlink-turn-tls','health') '' 10;return } catch {}
    if ($attempt -eq 0 -or $attempt % 6 -eq 0) { Write-Host 'Сертификат TURN ещё готовится. Проверь DNS и доступность HTTP/80; комнаты и настройки сохраняются.' }
    Start-Sleep -Seconds 4
  }
  throw 'TURN/TLS 443 пока не готов. Проверь DNS отдельного имени, HTTP/80 и журнал turn-tls; повтори установку в той же папке. Готовность relayed media ещё требует отдельной проверки.'
}

function Set-SimpleTarget([string]$Folder,[object]$State,[string]$Target,[string]$ServerIp='',[string]$Login='',[int]$Port=22) {
  $values=@{target=$Target;serverIp=$ServerIp;sshLogin=$Login;sshPort=$Port}
  foreach ($key in $values.Keys) { $State | Add-Member -NotePropertyName $key -NotePropertyValue $values[$key] -Force }
  Save-SimpleState $Folder $State
}
function Assert-SimpleTarget([object]$State,[string]$Target,[string]$ServerIp='',[int]$Port=22) {
  if ($State.PSObject.Properties['target'] -and $State.target -ne $Target) { throw 'Выбран другой тип сервера, чем в сохранённой установке.' }
  if (-not $State.PSObject.Properties['target'] -and $State.PSObject.Properties['publicHttps'] -and $State.publicHttps -is [bool]) {
    $legacyTarget=if ($State.publicHttps) { 'remote' } else { 'local' }
    if ($legacyTarget -ne $Target) { throw 'Выбран другой тип сервера, чем в прежней установке.' }
  }
  if ($Target -eq 'remote' -and $State.PSObject.Properties['serverIp'] -and ($State.serverIp -ne $ServerIp -or $State.sshPort -ne $Port)) { throw 'SSH адрес или порт не совпал с сохранённой установкой. Удаление не выполнено.' }
}
function Get-SimpleRemovalProject([object]$State,[object]$Compose) {
  $id=[Guid]::Empty
  if ($State.schemaVersion -ne 1 -or -not [Guid]::TryParse([string]$State.installationId,[ref]$id)) { throw 'Не найден корректный UUID установки CastLink.' }
  $project='castlink-easy-'+$id.ToString('N')
  if ($Compose.name -cne $project) { throw 'Compose проект не совпал с UUID установки. Удаление не выполнено.' }
  if (@($Compose.PSObject.Properties.Name | Where-Object { $_ -notin @('name','services','volumes') }).Count) { throw 'Дополнительные Compose include/настройки не поддерживаются удалением мастера.' }
  $services=@($Compose.services.PSObject.Properties.Name | Sort-Object)
  $volumes=@($Compose.volumes.PSObject.Properties.Name | Sort-Object)
  $hasConverter=$services -ccontains 'presentation-converter'
  if($hasConverter -and $Compose.services.'presentation-converter'.init -ne $true){throw 'Presentation converter requires init'}
  $expectedServices=if($hasConverter){@('caddy,livekit,postgres,presentation-converter,web','caddy,livekit,postgres,presentation-converter,turn-tls,web')}else{@('caddy,livekit,postgres,web','caddy,livekit,postgres,turn-tls,web')}
  $expectedVolumes=if($hasConverter){$(if($Compose.volumes.PSObject.Properties['converter-work']){'caddy-config,caddy-data,converter-socket,converter-work,postgres-data,web-data'}else{'caddy-config,caddy-data,converter-socket,postgres-data,web-data'})}else{'caddy-config,caddy-data,postgres-data,web-data'}
  if (($services -join ',') -cnotin $expectedServices -or ($volumes -join ',') -cne $expectedVolumes) { throw 'Compose содержит неизвестные ресурсы. Удаление не выполнено.' }
  foreach ($property in $Compose.volumes.PSObject.Properties) {
    if (@($property.Value.PSObject.Properties).Count) { throw 'Внешние или переименованные тома не поддерживаются удалением мастера.' }
  }
  if ($Compose.PSObject.Properties['networks']) { throw 'Изменённые сети не поддерживаются удалением мастера.' }
  foreach ($service in $Compose.services.PSObject.Properties) {
    if ($service.Value.PSObject.Properties['container_name'] -or $service.Value.PSObject.Properties['networks'] -or $service.Value.PSObject.Properties['extends']) { throw 'Изменённые ресурсы сервиса не поддерживаются удалением мастера.' }
  }
  return $project
}
function Assert-SimpleRemovalResources([string]$Project) {
  foreach ($kind in @('container','volume','network')) {
    $list=if ($kind -eq 'container') { @('ps','-aq') } else { @($kind,'ls','-q') }
    $raw=Invoke-DeploymentDocker ($list+@('--filter',('label=com.docker.compose.project='+$Project)))
    $ids=@($raw -split '\r?\n' | Where-Object { $_.Length })
    if ($kind -ne 'container') {
      # Compose down resolves generated names, including resources missing labels.
      $byName=Invoke-DeploymentDocker @($kind,'ls','--format','{{.Name}}','--filter',('name='+$Project+'_'))
      $names=@($byName -split '\r?\n' | Where-Object { $_.Length })
      $expected=if ($kind -eq 'volume') { @('postgres-data','web-data','caddy-data','caddy-config','converter-socket','converter-work' | ForEach-Object { $Project+'_'+$_ }) } else { @($Project+'_default') }
      $ids=@(($ids+@($names | Where-Object { $_ -cin $expected })) | Select-Object -Unique)
    }
    if (-not $ids.Count) { continue }
    $inspect=@(if ($kind -eq 'container') { 'inspect' } else { $kind;'inspect' })
    # PowerShell5 emits a JSON array as one pipeline object. Assign it before
    # wrapping so count and ownership checks inspect every Docker resource.
    $parsed=ConvertFrom-Json -InputObject (Invoke-DeploymentDocker ($inspect+$ids))
    $resources=@($parsed)
    if ($resources.Count -ne $ids.Count) { throw 'Не удалось проверить ресурсы выбранной установки.' }
    foreach ($resource in $resources) {
      $labels=if ($kind -eq 'container') { $resource.Config.Labels } else { $resource.Labels }
      if ($labels.'com.docker.compose.project' -cne $Project) { throw 'Обнаружен ресурс другого проекта. Удаление не выполнено.' }
      if ($kind -eq 'container' -and $labels.'com.docker.compose.service' -notin @('web','postgres','livekit','caddy','turn-tls','presentation-converter')) { throw 'Обнаружен неизвестный сервис проекта. Удаление не выполнено.' }
      if ($kind -eq 'volume' -and ($labels.'com.docker.compose.volume' -notin @('postgres-data','web-data','caddy-data','caddy-config','converter-socket','converter-work') -or $resource.Name -cne ($Project+'_'+$labels.'com.docker.compose.volume'))) { throw 'Обнаружен неизвестный том проекта. Удаление не выполнено.' }
      if ($kind -eq 'network' -and ($labels.'com.docker.compose.network' -cne 'default' -or $resource.Name -cne ($Project+'_default'))) { throw 'Обнаружена неизвестная сеть проекта. Удаление не выполнено.' }
    }
  }
}
function Remove-SimpleDeployment([string]$Folder,[object]$State,[switch]$Confirmed,[switch]$DeleteData,[switch]$DeferFileCleanup) {
  if (-not $Confirmed) { return $false }
  $composePath=Join-Path $Folder 'compose.json'
  $compose=Get-Content -LiteralPath $composePath -Raw | ConvertFrom-Json
  $project=Get-SimpleRemovalProject $State $compose
  $controlGuard=$null
  $operationGuard=Enter-SimpleRetentionGuard $Folder
  $remoteOperationGuard=$null
  $panelGuard=$null
  try {
  if(-not $script:SshSession -and (Get-Command Enter-SimplePanelUpdateGuard -ErrorAction SilentlyContinue)){$panelGuard=Enter-SimplePanelUpdateGuard $State.installationId}
  if(-not $script:SshSession -and (Get-Command Enter-SimpleControlGuard -ErrorAction SilentlyContinue)){$controlGuard=Enter-SimpleControlGuard $State.installationId}
  $ownedPath=Join-Path $Folder '.castlink-owned.json';$owned=$null
  if(Test-Path -LiteralPath $ownedPath){$owned=Get-Content -LiteralPath $ownedPath -Encoding UTF8 -Raw|ConvertFrom-Json;if($owned.installationId -cne $State.installationId){throw 'Учёт очистки относится к другой установке.'}}
  if ($script:SshSession) {
    $remote=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/compose.json')))
    if ($remote.code -ne 0) { throw 'На выбранном VPS не найден Compose этой установки.' }
    $null=Get-SimpleRemovalProject $State ($remote.stdout | ConvertFrom-Json)
    if(-not $owned){
      $remoteOwned=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/.castlink-owned.json')))
      if($remoteOwned.code -eq 0 -and $remoteOwned.stdout.Trim()){$owned=$remoteOwned.stdout|ConvertFrom-Json;if($owned.installationId -cne $State.installationId){throw 'Учёт очистки VPS относится к другой установке.'}}
    }
  }
  if($script:SshSession){$remoteOperationGuard=Enter-SimpleRemoteRetentionGuard}
  Assert-SimpleRemovalResources $project
  if($script:SshSession){Remove-SimpleRemoteRetention $State}else{Remove-SimpleRetentionTask $Folder $State $owned}
  if(-not $script:SshSession -and (Get-Command Remove-SimpleControlLinks -ErrorAction SilentlyContinue)){Remove-SimpleControlLinks $Folder $State $owned}
  if(Get-Command Write-SimpleStage -ErrorAction SilentlyContinue){Write-SimpleStage 'Остановка выбранного сервера' 2 4}
  $downArguments=@('down','--remove-orphans');if ($DeleteData) { $downArguments+='--volumes' }
  $null=Invoke-DeploymentCompose -Arguments $downArguments -TimeoutSeconds 180 -ProjectName $project
  $remaining=Invoke-DeploymentDocker @('ps','-aq','--filter',('label=com.docker.compose.project='+$project))
  if ($remaining.Trim()) { throw 'Контейнеры этой установки ещё существуют. Состояние и файлы сохранены.' }
  if ($DeleteData) {
    $remainingVolumes=Invoke-DeploymentDocker @('volume','ls','--format','{{.Name}}','--filter',('name='+$project+'_'))
    $expected=@('postgres-data','web-data','caddy-data','caddy-config','converter-socket','converter-work' | ForEach-Object { $project+'_'+$_ })
    if (@($remainingVolumes -split '\r?\n' | Where-Object { $_ -cin $expected }).Count) { throw 'Не все тома удалены (возможно, используются другим контейнером). Состояние и файлы сохранены.' }
  }
  if ($DeleteData) {
    if(Get-Command Write-SimpleStage -ErrorAction SilentlyContinue){Write-SimpleStage 'Очистка собственных ресурсов' 3 4}
    $files=@('postgres.env','web.env','livekit.json','Caddyfile','compose.json','castlink-local-root.crt','owner-access.txt')
    $runtime=$null;if(Get-Command Remove-SimpleRuntimeRegistration -ErrorAction SilentlyContinue){$runtime=Remove-SimpleRuntimeRegistration $Folder $State}
    if(Get-Command Remove-SimpleOwnedImages -ErrorAction SilentlyContinue){Remove-SimpleOwnedImages $owned $compose}
    $cleanupFiles=@();if((Get-Command Get-SimpleCleanupFiles -ErrorAction SilentlyContinue) -and (-not $owned -or $owned.folder -ceq [IO.Path]::GetFullPath($Folder))){$cleanupFiles=@(Get-SimpleCleanupFiles $Folder $owned)}
    if(-not $script:SshSession -and (Get-Command Remove-SimpleHostCertificateTrust -ErrorAction SilentlyContinue)){Remove-SimpleHostCertificateTrust $Folder $owned}
    # Last Docker use: all resource postconditions and image checks are complete.
    # Failure here retains configuration/state and ownership receipts for retry.
    if(Get-Command Remove-SimpleOwnedRuntime -ErrorAction SilentlyContinue){if($runtime){$runtime=Read-SimpleRuntimeReceipt};Remove-SimpleOwnedRuntime $runtime}
    if ($script:SshSession) {
      $remoteFiles=@($files+'.castlink-install.json'+'.castlink-server.json'+'.castlink-owned.json'+'LICENSE'+'release.tar.gz'+'payload/images.tar.gz'+'payload/release.json'+'scripts/ubuntu-easy-setup-bootstrap.sh'+'.castlink-retention.json'+'scripts/simple-easy-setup-retention.py' | ForEach-Object { ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/'+$_) })
      $result=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('rm -f -- '+($remoteFiles -join ' '))
      if ($result.code -ne 0) { throw 'Сервисы удалены, но файлы VPS удалить не удалось. Локальное состояние сохранено.' }
    }
    foreach ($file in $files) { $path=Join-Path $Folder $file; if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force } }
    Remove-Item -LiteralPath (Join-Path $Folder '.castlink-install.json') -Force
    if($owned){$cleanupFiles+= $ownedPath}
    if($cleanupFiles.Count -and -not $DeferFileCleanup){Start-SimpleDeferredCleanup $Folder $cleanupFiles}
  } else {
    if ($script:SshSession) { Save-SimpleRemoteMetadata $State }
    $State | Add-Member -NotePropertyName stopped -NotePropertyValue $true -Force
    Save-SimpleState $Folder $State
  }
  if(Get-Command Complete-SimpleSetupCheckpoint -ErrorAction SilentlyContinue){Complete-SimpleSetupCheckpoint $Folder}
  if(Get-Command Write-SimpleStage -ErrorAction SilentlyContinue){if($global:SimpleCleanupScheduled){Write-SimpleStage 'Службы удалены; очистка файлов после закрытия мастера' 4 4}else{Write-SimpleStage 'Удаление выбранного сервера завершено' 4 4 -Completed}}
  return $true
  } finally {try{if($remoteOperationGuard){Exit-SimpleRemoteRetentionGuard $remoteOperationGuard}}finally{if($controlGuard){Exit-SimpleControlGuard $controlGuard};if($panelGuard){Exit-SimpleControlGuard $panelGuard};Exit-SimpleRetentionGuard $operationGuard}}
}

function Get-SimpleRequiredPorts([bool]$PublicHttps,[object]$State=$null) {
  if($State -and $State.PSObject.Properties['network'] -and $State.network){
    $network=Get-SimpleNetworkConfiguration $State
    $mediaBind=if($network.mediaIp -eq '127.0.0.1'){'127.0.0.1'}else{'0.0.0.0'}
    $ports=@([pscustomobject]@{port=$network.iceTcpPort;protocol='tcp';address=$mediaBind},[pscustomobject]@{port=$network.iceUdpPort;protocol='udp';address=$mediaBind},[pscustomobject]@{port=$network.turnUdpPort;protocol='udp';address=$mediaBind})
    if($network.mode -eq 'https'){
      $ports+=[pscustomobject]@{port=$network.httpsPort;protocol='tcp';address=$network.bindAddress}
      if($State.publicHttps){$ports+=[pscustomobject]@{port=$network.httpPort;protocol='tcp';address=$network.bindAddress}}
    }else{$ports+=[pscustomobject]@{port=$network.httpPort;protocol='tcp';address=$network.bindAddress}}
    foreach($port in $network.relayPortStart..$network.relayPortEnd){$ports+=[pscustomobject]@{port=$port;protocol='udp';address=$mediaBind}}
    return $ports
  }
  $ports=@([pscustomobject]@{port=443;protocol='tcp'},[pscustomobject]@{port=7881;protocol='tcp'},[pscustomobject]@{port=3478;protocol='udp'},[pscustomobject]@{port=7882;protocol='udp'})
  if ($PublicHttps) { $ports+= [pscustomobject]@{port=80;protocol='tcp'} }
  foreach ($port in 30000..30031) { $ports+= [pscustomobject]@{port=$port;protocol='udp'} }
  return $ports
}
function Assert-SimpleSocketPorts([string]$Address,[object[]]$Ports) {
  $bind=if ($Address -eq '127.0.0.1') { [Net.IPAddress]::Loopback } else { [Net.IPAddress]::Any }
  foreach ($port in $Ports) {
    if($port.PSObject.Properties['address']){$bind=[Net.IPAddress]::Parse([string]$port.address)}
    $type=if ($port.protocol -eq 'tcp') { [Net.Sockets.SocketType]::Stream } else { [Net.Sockets.SocketType]::Dgram }
    $protocol=if ($port.protocol -eq 'tcp') { [Net.Sockets.ProtocolType]::Tcp } else { [Net.Sockets.ProtocolType]::Udp }
    $socket=New-Object Net.Sockets.Socket ([Net.Sockets.AddressFamily]::InterNetwork),$type,$protocol
    try {
      $socket.ExclusiveAddressUse=$true
      $socket.Bind((New-Object Net.IPEndPoint $bind,([int]$port.port)))
    } catch { throw ("Порт $($port.protocol.ToUpperInvariant()) $($port.port) занят другим приложением. Освободи его вручную и повтори мастер; серверы не остановлены.") } finally { $socket.Dispose() }
  }
}
function Get-SimpleDockerContainers([switch]$IncludeStopped) {
  $list=if ($IncludeStopped) { @('ps','-aq') } else { @('ps','-q') }
  $ids=@((Invoke-DeploymentDocker $list '' 30) -split '\r?\n' | Where-Object { $_.Length })
  if (-not $ids.Count) { return @() }
  $format='{"ports":{{json .NetworkSettings.Ports}},"project":{{json (index .Config.Labels "com.docker.compose.project")}},"folder":{{json (index .Config.Labels "com.docker.compose.project.working_dir")}},"name":{{json .Name}}}'
  $lines=(Invoke-DeploymentDocker (@('inspect','--format',$format)+$ids) '' 30) -split '\r?\n'
  return @($lines | Where-Object { $_.Length } | ForEach-Object { $_ | ConvertFrom-Json })
}
function Get-SimpleKnownInstallations {
  $seen=New-Object 'Collections.Generic.HashSet[string]'
  foreach ($container in @(Get-SimpleDockerContainers -IncludeStopped)) {
    if ($container.project -notmatch '^castlink-easy-[a-f0-9]{32}$' -or -not $container.folder -or -not $seen.Add([string]$container.project)) { continue }
    try {
      $folder=[string]$container.folder
      $state=Get-Content -LiteralPath (Join-Path $folder '.castlink-install.json') -Raw | ConvertFrom-Json
      $compose=Get-Content -LiteralPath (Join-Path $folder 'compose.json') -Raw | ConvertFrom-Json
      if ((Get-SimpleRemovalProject $state $compose) -cne $container.project) { continue }
      [pscustomobject]@{project=$container.project;folder=$folder;address=$state.address;installationId=$state.installationId}
    } catch { continue }
  }
}
function Get-SimpleRemoteKnownInstallation([object]$Container) {
  if ($Container.project -notmatch '^castlink-easy-[a-f0-9]{32}$' -or $Container.folder -cne ('/opt/'+$Container.project)) { return @() }
  $state=[pscustomobject]@{schemaVersion=1;installationId=([Guid]::ParseExact($Container.project.Substring(14),'N')).ToString()}
  $remote=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($Container.folder+'/compose.json')))
  if ($remote.code -ne 0) { return @() }
  $compose=$remote.stdout | ConvertFrom-Json
  if ((Get-SimpleRemovalProject $state $compose) -cne $Container.project) { return @() }
  return @([pscustomobject]@{project=$Container.project;folder=$Container.folder;address=$Container.project;installationId=$state.installationId})
}
function Get-SimpleRemoteInstallations {
  $paths=New-Object 'Collections.Generic.HashSet[string]'
  foreach ($container in @(Get-SimpleDockerContainers -IncludeStopped)) {
    if ($container.project -match '^castlink-easy-[a-f0-9]{32}$' -and $container.folder -ceq ('/opt/'+$container.project)) { $null=$paths.Add([string]$container.folder) }
  }
  # A keep-data removal has no containers. Inspect only the generated /opt
  # directories, never the whole server filesystem or environment files.
  $folders=Invoke-SimpleSshCommand -Client $script:SshSession -Command 'for dir in /opt/castlink-easy-*; do [ -d "$dir" ] && [ -f "$dir/compose.json" ] && printf "%s\n" "$dir"; done; true'
  if ($folders.code -ne 0) { throw 'Не удалось найти сохранённые установки CastLink на VPS.' }
  foreach ($folder in @($folders.stdout -split '\r?\n')) { if ($folder -cmatch '^/opt/castlink-easy-[a-f0-9]{32}$') { $null=$paths.Add($folder) } }
  foreach ($folder in @($paths | Sort-Object)) {
    try {
      $project=$folder.Substring(5);$iid=([Guid]::ParseExact($project.Substring(14),'N')).ToString()
      $state=[pscustomobject]@{schemaVersion=1;installationId=$iid}
      $remote=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($folder+'/compose.json')))
      if ($remote.code -ne 0) { continue }
      $compose=$remote.stdout | ConvertFrom-Json
      if ((Get-SimpleRemovalProject $state $compose) -cne $project) { continue }
      $caddy=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($folder+'/Caddyfile')))
      $hostMatch=[regex]::Match($caddy.stdout,'(?m)^https://([a-zA-Z0-9.-]+)\s*\{')
      $address=if ($caddy.code -eq 0 -and $hostMatch.Success) { $hostMatch.Groups[1].Value } else { '' }
      $metadata=$null
      $record=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($folder+'/.castlink-server.json')))
      if ($record.code -eq 0) {
        try {
          $candidate=$record.stdout | ConvertFrom-Json
          if ($candidate.schemaVersion -eq 1 -and $candidate.installationId -ceq $iid) { $metadata=$candidate }
        } catch { $metadata=$null }
      }
      [pscustomobject]@{project=$project;folder=$folder;address=$address;installationId=$iid;compose=$compose;metadata=$metadata}
    } catch { continue }
  }
}
function New-SimpleRemoteRemovalMirror([string]$Folder,[object]$Installation,[string]$Ip,[int]$Port) {
  $null=New-Item -ItemType Directory -Path $Folder -Force
  $state=[pscustomobject]@{schemaVersion=1;installationId=$Installation.installationId;nodeId=('srv-'+$Installation.installationId.Replace('-',''));target='remote';serverIp=$Ip;sshPort=$Port;address=$Installation.address;publicHttps=$true;removalOnly=$true}
  foreach ($key in @('databasePhase','completed','network','setupMode')) { if ($Installation.metadata -and $Installation.metadata.PSObject.Properties[$key]) { $state | Add-Member -NotePropertyName $key -NotePropertyValue $Installation.metadata.$key } }
  Write-SimpleText (Join-Path $Folder 'compose.json') ($Installation.compose | ConvertTo-Json -Depth 15)
  Save-SimpleState $Folder $state
  return $state
}
function Save-SimpleRemoteMetadata([object]$State) {
  $metadata=[ordered]@{schemaVersion=1;installationId=$State.installationId;nodeId=$State.nodeId;address=$State.address;publicHttps=$State.publicHttps;stopped=$true}
  foreach ($key in @('databasePhase','completed','network','setupMode')) { if ($State.PSObject.Properties[$key]) { $metadata[$key]=$State.$key } }
  $result=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('umask 077; cat > '+(ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/.castlink-server.json'))) -Stdin ($metadata | ConvertTo-Json -Compress)
  if ($result.code -ne 0) { throw 'Службы удалены; конфигурация и данные VPS сохранены, но запись состояния сервера не удалась.' }
}
function Stop-SimpleKnownInstallation([object]$Installation) {
  if ($script:SshSession) {
    $state=[pscustomobject]@{schemaVersion=1;installationId=$Installation.installationId}
    $remote=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($Installation.folder+'/compose.json')))
    if ($remote.code -ne 0) { throw 'Не удалось проверить Compose выбранного сервера VPS.' }
    $compose=$remote.stdout | ConvertFrom-Json
  } else {
    $state=Get-Content -LiteralPath (Join-Path $Installation.folder '.castlink-install.json') -Raw | ConvertFrom-Json
    $compose=Get-Content -LiteralPath (Join-Path $Installation.folder 'compose.json') -Raw | ConvertFrom-Json
  }
  if ((Get-SimpleRemovalProject $state $compose) -cne $Installation.project) { throw 'Установка не совпала с выбранным сервером. Службы не остановлены.' }
  Assert-SimpleRemovalResources $Installation.project
  $previous=$script:ServerFolder
  try {
    $script:ServerFolder=$Installation.folder.Replace('\','/')
    $null=Invoke-DeploymentCompose @('stop') '' 90 $Installation.project
  } finally { $script:ServerFolder=$previous }
}
function Assert-SimplePortAvailability([object]$State,[string]$Address,[bool]$PublicHttps) {
  $required=@(Get-SimpleRequiredPorts $PublicHttps $State)
  $own=if ($State -and $State.PSObject.Properties['installationId'] -and $State.installationId) { 'castlink-easy-'+([Guid]$State.installationId).ToString('N') } else { '' }
  $attempted=New-Object 'Collections.Generic.HashSet[string]'
  do {
    $owned=New-Object 'Collections.Generic.HashSet[string]';$stopped=$false
    foreach ($container in @(Get-SimpleDockerContainers)) {
      foreach ($mapping in $container.ports.PSObject.Properties) {
        $protocol=($mapping.Name -split '/')[1]
        foreach ($binding in $mapping.Value) {
          if (-not $binding.HostPort) { continue }
          $matches=@($required | Where-Object {
            $desiredAddress=if($_.PSObject.Properties['address']){[string]$_.address}elseif($Address -eq '127.0.0.1'){'127.0.0.1'}else{'0.0.0.0'}
            $_.protocol -eq $protocol -and $_.port -eq [int]$binding.HostPort -and ($desiredAddress -eq '0.0.0.0' -or $binding.HostIp -in @('','0.0.0.0','::',$desiredAddress))
          })
          if(-not $matches.Count){continue}
          $key=$protocol+':'+$binding.HostPort
          if ($own -and $container.project -ceq $own) { $null=$owned.Add($key);continue }
          if ($container.project -like 'castlink-easy-*') {
            $known=@(if ($script:SshSession) { @(Get-SimpleRemoteKnownInstallation $container) } else { @(Get-SimpleKnownInstallations | Where-Object { $_.project -ceq $container.project }) })
            if ($known.Count -eq 1) {
              $identity=if ($known[0].address -like 'castlink-easy-*') { 'проект '+$known[0].address } else { 'https://'+$known[0].address }
              Write-Host "Порт $($protocol.ToUpperInvariant()) $($binding.HostPort) занят CastLink ($identity). Папка: $($known[0].folder)"
              if ($attempted.Contains([string]$container.project)) { throw 'После остановки службы этой установки всё ещё занимают порт. Другие серверы не изменены; проверь Docker и повтори мастер.' }
              $yes=Read-Host 'Остановить службы этой установки, сохранив комнаты и настройки? [да/нет]'
              if ($yes -in @('да','д','yes','y')) { $null=$attempted.Add([string]$container.project);Stop-SimpleKnownInstallation $known[0];$stopped=$true;break }
            }
            throw ("Порт $($protocol.ToUpperInvariant()) $($binding.HostPort) уже занят другим сервером CastLink. Его папка: $($container.folder). Для обновления выбери ту же папку; для удаления выбери «Удалить» в Easy Setup. Другой сервер не остановлен.")
          }
          throw ("Порт $($protocol.ToUpperInvariant()) $($binding.HostPort) занят другим Docker контейнером $($container.name). Освободи порт вручную и повтори мастер. Контейнеры автоматически не остановлены.")
        }
        if ($stopped) { break }
      }
      if ($stopped) { break }
    }
  } while ($stopped)
  $unbound=@($required | Where-Object { -not $owned.Contains($_.protocol+':'+$_.port) })
  if ($script:SshSession) {
    $probe='import json,socket,sys; j=json.load(sys.stdin); occupied=[]
for p in j["ports"]:
 s=socket.socket(socket.AF_INET,socket.SOCK_STREAM if p["protocol"]=="tcp" else socket.SOCK_DGRAM)
 try: s.bind((p.get("address","0.0.0.0"),p["port"]))
 except OSError: occupied.append(p)
 finally: s.close()
if occupied:
 print("PORT_CONFLICT "+occupied[0]["protocol"]+" "+str(occupied[0]["port"]));sys.exit(1)
'
    $inputJson=@{ports=$unbound} | ConvertTo-Json -Depth 4 -Compress
    $result=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('python3 -c '+(ConvertTo-SimplePosixLiteral $probe)) -Stdin $inputJson -TimeoutSeconds 30
    if ($result.code -ne 0) { throw ('Порты VPS недоступны: '+$result.stdout.Trim()+'. Освободи указанный порт вручную; другие серверы не остановлены.') }
  } else { Assert-SimpleSocketPorts $Address $unbound }
}
