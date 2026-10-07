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
  $binding=if ($State.address -eq '127.0.0.1') { '127.0.0.1:' } else { '' }
  $ports=@($binding+'443:443'); if ($State.publicHttps) { $ports+= '80:80' }
  $services=@{
    postgres=@{image=$Release.images.postgres;platform='linux/amd64';restart='unless-stopped';env_file=@('postgres.env');volumes=@('postgres-data:/var/lib/postgresql/data');healthcheck=@{test=@('CMD-SHELL','pg_isready -U castlink -d castlink');interval='5s';timeout='5s';retries=24}}
    web=@{image=$Release.images.web;platform='linux/amd64';restart='unless-stopped';env_file=@('web.env');volumes=@('web-data:/data');depends_on=@{postgres=@{condition='service_healthy'}}}
    livekit=@{image=$Release.images.livekit;platform='linux/amd64';restart='unless-stopped';command=@('--config','/etc/livekit.yaml');volumes=@('./livekit.json:/etc/livekit.yaml:ro');ports=@(($binding+'7881:7881/tcp'),($binding+'61000-61100:61000-61100/udp'))}
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
  if ($State.PSObject.Properties['stopped']) { $State.stopped=$false }
  $State.completed=$true; Save-SimpleState $Folder $State
  return ('https://'+$State.address+'/')
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
  if (($services -join ',') -cne 'caddy,livekit,postgres,web' -or ($volumes -join ',') -cne 'caddy-config,caddy-data,postgres-data,web-data') { throw 'Compose содержит неизвестные ресурсы. Удаление не выполнено.' }
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
      $expected=if ($kind -eq 'volume') { @('postgres-data','web-data','caddy-data','caddy-config' | ForEach-Object { $Project+'_'+$_ }) } else { @($Project+'_default') }
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
      if ($kind -eq 'container' -and $labels.'com.docker.compose.service' -notin @('web','postgres','livekit','caddy')) { throw 'Обнаружен неизвестный сервис проекта. Удаление не выполнено.' }
      if ($kind -eq 'volume' -and ($labels.'com.docker.compose.volume' -notin @('postgres-data','web-data','caddy-data','caddy-config') -or $resource.Name -cne ($Project+'_'+$labels.'com.docker.compose.volume'))) { throw 'Обнаружен неизвестный том проекта. Удаление не выполнено.' }
      if ($kind -eq 'network' -and ($labels.'com.docker.compose.network' -cne 'default' -or $resource.Name -cne ($Project+'_default'))) { throw 'Обнаружена неизвестная сеть проекта. Удаление не выполнено.' }
    }
  }
}
function Remove-SimpleDeployment([string]$Folder,[object]$State,[switch]$Confirmed,[switch]$DeleteData) {
  if (-not $Confirmed) { return $false }
  $composePath=Join-Path $Folder 'compose.json'
  $compose=Get-Content -LiteralPath $composePath -Raw | ConvertFrom-Json
  $project=Get-SimpleRemovalProject $State $compose
  if ($script:SshSession) {
    $remote=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/compose.json')))
    if ($remote.code -ne 0) { throw 'На выбранном VPS не найден Compose этой установки.' }
    $null=Get-SimpleRemovalProject $State ($remote.stdout | ConvertFrom-Json)
  }
  Assert-SimpleRemovalResources $project
  $downArguments=@('down','--remove-orphans');if ($DeleteData) { $downArguments+='--volumes' }
  $null=Invoke-DeploymentCompose -Arguments $downArguments -TimeoutSeconds 180 -ProjectName $project
  $remaining=Invoke-DeploymentDocker @('ps','-aq','--filter',('label=com.docker.compose.project='+$project))
  if ($remaining.Trim()) { throw 'Контейнеры этой установки ещё существуют. Состояние и файлы сохранены.' }
  if ($DeleteData) {
    $remainingVolumes=Invoke-DeploymentDocker @('volume','ls','--format','{{.Name}}','--filter',('name='+$project+'_'))
    $expected=@('postgres-data','web-data','caddy-data','caddy-config' | ForEach-Object { $project+'_'+$_ })
    if (@($remainingVolumes -split '\r?\n' | Where-Object { $_ -cin $expected }).Count) { throw 'Не все тома удалены (возможно, используются другим контейнером). Состояние и файлы сохранены.' }
  }
  if ($DeleteData) {
    $files=@('postgres.env','web.env','livekit.json','Caddyfile','compose.json','castlink-local-root.crt','owner-access.txt')
    if ($script:SshSession) {
      $remoteFiles=@($files+'.castlink-install.json' | ForEach-Object { ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/'+$_) })
      $result=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('rm -f -- '+($remoteFiles -join ' '))
      if ($result.code -ne 0) { throw 'Сервисы удалены, но файлы VPS удалить не удалось. Локальное состояние сохранено.' }
    }
    foreach ($file in $files) { $path=Join-Path $Folder $file; if (Test-Path -LiteralPath $path -PathType Leaf) { Remove-Item -LiteralPath $path -Force } }
    Remove-Item -LiteralPath (Join-Path $Folder '.castlink-install.json') -Force
  } else {
    $State | Add-Member -NotePropertyName stopped -NotePropertyValue $true -Force
    Save-SimpleState $Folder $State
  }
  return $true
}

function Get-SimpleRequiredPorts([bool]$PublicHttps) {
  $ports=@([pscustomobject]@{port=443;protocol='tcp'},[pscustomobject]@{port=7881;protocol='tcp'})
  if ($PublicHttps) { $ports+= [pscustomobject]@{port=80;protocol='tcp'} }
  foreach ($port in 61000..61100) { $ports+= [pscustomobject]@{port=$port;protocol='udp'} }
  return $ports
}
function Assert-SimpleSocketPorts([string]$Address,[object[]]$Ports) {
  $bind=if ($Address -eq '127.0.0.1') { [Net.IPAddress]::Loopback } else { [Net.IPAddress]::Any }
  foreach ($port in $Ports) {
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
  $required=@(Get-SimpleRequiredPorts $PublicHttps)
  $own=if ($State) { 'castlink-easy-'+([Guid]$State.installationId).ToString('N') } else { '' }
  $attempted=New-Object 'Collections.Generic.HashSet[string]'
  do {
    $owned=New-Object 'Collections.Generic.HashSet[string]';$stopped=$false
    foreach ($container in @(Get-SimpleDockerContainers)) {
      foreach ($mapping in $container.ports.PSObject.Properties) {
        $protocol=($mapping.Name -split '/')[1]
        foreach ($binding in $mapping.Value) {
          if (-not $binding.HostPort) { continue }
          if ($Address -eq '127.0.0.1' -and $binding.HostIp -notin @('','0.0.0.0','::','127.0.0.1')) { continue }
          if (-not @($required | Where-Object { $_.protocol -eq $protocol -and $_.port -eq [int]$binding.HostPort }).Count) { continue }
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
 try: s.bind(("0.0.0.0",p["port"]))
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
