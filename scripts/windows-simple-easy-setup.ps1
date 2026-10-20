param(
  [ValidateSet('choose','local','remote')][string]$Target='choose',
  [ValidateSet('choose','install','update','remove')][string]$Action='choose',
  [string]$InstallFolder='',
  [string]$Address='',
  [string]$ServerIp='',
  [string]$Login='',
  [string]$Domain='',
  [string]$TurnDomain='',
  [ValidateSet('choose','quick','advanced')][string]$SetupMode='quick',
  [string]$NetworkConfigPath='',
  [object]$NetworkConfiguration=$null,
  [ValidateSet('ru','en','zh-CN')][string]$Language='ru',
  [int]$SshPort=0,
  [ValidateSet('choose','password','private-key')][string]$SshAuthType='choose',
  [string]$PrivateKeyPath='',
  [switch]$SkipCertificateTrust,
  [switch]$FunctionsOnly,
  [switch]$SkipReserveServers,
  [switch]$UseDownloadedPayload
)
$script:SimpleDomainSpecified=$PSBoundParameters.ContainsKey('Domain')
$script:SimpleTurnDomainSpecified=$PSBoundParameters.ContainsKey('TurnDomain')
$script:SimpleSetupSpecified=@{};foreach($name in $PSBoundParameters.Keys){$script:SimpleSetupSpecified[$name]=$true}
if($script:SimpleSetupSpecified['Action'] -and $Action -ne 'choose' -and -not $script:SimpleSetupSpecified['SetupMode'] -and -not $NetworkConfigPath -and -not $NetworkConfiguration){$SetupMode='quick'}
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
. (Join-Path $PSScriptRoot 'simple-easy-setup-download.ps1')
# Ownership checks continue after local preparation returns and in forwarded payloads.
. (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
$networkHelper=Join-Path $PSScriptRoot 'simple-easy-setup-network.ps1'
if(Test-Path -LiteralPath $networkHelper){. $networkHelper}
$controlHelper=Join-Path $PSScriptRoot 'simple-easy-setup-control.ps1'
if(Test-Path -LiteralPath $controlHelper){. $controlHelper -FunctionsOnly}
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
function Write-SimpleStage([string]$Name,[int]$Position,[int]$Total,[switch]$Completed) {
  $status="Этап $Position/$Total — $Name";Write-Host $status
  $ProgressPreference='Continue'
  $percent=if($Completed){100}else{[int](100*($Position-1)/$Total)}
  Write-Progress -Id 73 -Activity 'CastLink' -Status $status -PercentComplete $percent -Completed:$Completed
}
function Complete-SimpleInputPhase {
  if($global:SimpleGuiMessages){$global:SimpleGuiCanGoBack=$false}
}
function Request-SimpleForeground {
  if($global:SimpleGuiMessages){$ack=New-Object Threading.ManualResetEvent($false);try{$global:SimpleGuiMessages.Add([pscustomobject]@{kind='foreground';ack=$ack});if(-not $ack.WaitOne(10000)){throw 'Окно мастера не ответило. Доверие сертификату не изменено.'}}finally{$ack.Dispose()}}
}
function Install-SimpleLocalTrust([string]$KitFolder) {
  Request-SimpleForeground
  $global:LASTEXITCODE=0
  & (Join-Path $KitFolder 'Trust-Certificate.ps1') -Action Install
  $trusted=($LASTEXITCODE -eq 0)
  $global:LASTEXITCODE=0
  return $trusted
}
function Read-SimpleValue([string]$Prompt,[string]$Default) {
  if(-not $global:SimpleGuiMessages -and (Get-Command ConvertTo-SimpleGuiText -ErrorAction SilentlyContinue)){$Prompt=ConvertTo-SimpleGuiText $Prompt $Language}
  $value=Read-Host "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }; return $value.Trim()
}
function Initialize-SimpleRoomCreationPassword([string]$Folder,[object]$State) {
  $existing=Get-SimpleRoomCreationPasswordHash $State
  $envPath=Join-Path $Folder 'web.env';$envHash=''
  if(Test-Path -LiteralPath $envPath){
    $lines=@(Get-Content -LiteralPath $envPath -Encoding UTF8)
    $hashLines=@($lines|Where-Object{$_ -cmatch '^ROOM_CREATION_PASSWORD_SHA256='})
    if($hashLines.Count -gt 1){throw 'Настройки пароля создания комнат неоднозначны. Действующий пароль не изменён.'}
    if($hashLines.Count -eq 1){$envHash=$hashLines[0].Substring('ROOM_CREATION_PASSWORD_SHA256='.Length);if($envHash -and $envHash -cnotmatch '^[a-f0-9]{64}$'){throw 'Сохранённая настройка пароля создания комнат повреждена. Действующий пароль не изменён.'}}
    if($existing -and $envHash -and $existing -cne $envHash){throw 'Сохранённые настройки пароля создания комнат не совпадают. Действующий пароль не изменён.'}
    if(-not $existing -and $envHash){$existing=$envHash}
    if(-not $existing -and @($lines|Where-Object{$_ -cmatch '^ROOM_CREATION_PASSWORD=.+$'}).Count){throw 'Настроен пароль создания комнат вручную. Сохраните его SHA-256 в настройке ROOM_CREATION_PASSWORD_SHA256 перед обновлением.'}
  }
  if($existing){
    if(-not $State.PSObject.Properties['roomCreationPasswordHash']){$State|Add-Member -NotePropertyName roomCreationPasswordHash -NotePropertyValue $existing;Save-SimpleState $Folder $State}
    return
  }
  $secure=$null;$confirmation=$null;$password=$null;$repeated=$null;$bytes=$null;$sha=$null
  try {
    $secure=Read-Host 'Задайте пароль создания комнат (8–256 символов; только для студии)' -AsSecureString
    $password=(New-Object Net.NetworkCredential('', $secure)).Password
    if($password.Length -lt 8 -or $password.Length -gt 256 -or [string]::IsNullOrWhiteSpace($password) -or $password.Contains("`r") -or $password.Contains("`n") -or $password.IndexOf([char]0) -ge 0){throw 'Пароль создания комнат: от 8 до 256 символов, без переводов строк и пустого значения.'}
    $confirmation=Read-Host 'Повторите пароль создания комнат' -AsSecureString
    $repeated=(New-Object Net.NetworkCredential('', $confirmation)).Password
    if($password -cne $repeated){throw 'Пароли создания комнат не совпадают. Повторите настройку.'}
    $bytes=[Text.Encoding]::UTF8.GetBytes($password);$sha=[Security.Cryptography.SHA256]::Create()
    $hash=([BitConverter]::ToString($sha.ComputeHash($bytes))).Replace('-','').ToLowerInvariant()
    $State|Add-Member -NotePropertyName roomCreationPasswordHash -NotePropertyValue $hash
    Save-SimpleState $Folder $State
  } finally {
    if($secure){$secure.Dispose()};if($confirmation){$confirmation.Dispose()};if($sha){$sha.Dispose()};if($bytes){[Array]::Clear($bytes,0,$bytes.Length)}
    $password=$null;$repeated=$null
  }
}
function Read-SimpleSetupMode([string]$Mode='choose') {
  if($Mode -ne 'choose'){return $Mode}
  do{$choice=Read-SimpleValue 'Установка: 1 — Быстрая (рекомендуется); 2 — Расширенная' '1'}while($choice -notin @('1','2'))
  if($choice -eq '2'){return 'advanced'};return 'quick'
}
function Read-SimpleNetworkPort([string]$Prompt,[int]$Default) {
  do{
    $value=Read-SimpleValue $Prompt ([string]$Default);$port=0
    if([int]::TryParse($value,[ref]$port) -and $port -ge 1 -and $port -le 65535){return $port}
    Write-Host 'Порт должен быть целым числом от 1 до 65535.'
  }while($true)
}
function Read-SimpleSetupOptions([string]$Folder,[string]$SiteAddress,[bool]$PublicHttps,[string]$MediaIp,[string]$Mode='choose',[object]$Configuration=$null) {
  $savedPath=Join-Path $Folder '.castlink-install.json'
  if(Test-Path -LiteralPath $savedPath){
    $saved=Get-Content -LiteralPath $savedPath -Encoding UTF8 -Raw|ConvertFrom-Json
    if($Configuration){
      $probe=[pscustomobject]@{address=$saved.address;publicHttps=$saved.publicHttps;network=$Configuration}
      $requested=Get-SimpleNetworkConfiguration $probe $MediaIp
      $previous=Get-SimpleNetworkConfiguration $saved $MediaIp
      if(($requested|ConvertTo-Json -Depth 8 -Compress) -cne ($previous|ConvertTo-Json -Depth 8 -Compress)){throw 'Выбраны другие сетевые параметры сохранённой установки. Обновление сохраняет прежнюю конфигурацию; выбери новую папку для новой установки.'}
    }
    return [pscustomobject]@{setupMode=$(if($saved.PSObject.Properties['setupMode']){$saved.setupMode}else{'quick'});network=$(if($saved.PSObject.Properties['network']){$saved.network}else{$null})}
  }
  $Mode=Read-SimpleSetupMode $Mode
  if($Mode -eq 'quick' -and -not $Configuration){return [pscustomobject]@{setupMode='quick';network=$null}}
  if(-not(Get-Command Get-SimpleNetworkConfiguration -ErrorAction SilentlyContinue)){throw 'Этот пакет не поддерживает расширенную установку. Нужен новый полный пакет CastLink.'}
  if(-not $Configuration){
    do{$choice=Read-SimpleValue 'Сеть: 1 — HTTPS напрямую; 2 — HTTP; 3 — За внешним прокси' '1'}while($choice -notin @('1','2','3'))
    $modeName=if($choice -eq '3'){'proxy'}elseif($choice -eq '2'){'http'}else{'https'}
    $defaultOrigin=$(if($modeName -eq 'http'){'http://'}else{'https://'})+$SiteAddress
    $origin=Read-SimpleValue 'Внешний адрес сайта' $defaultOrigin
    $bind=Read-SimpleValue 'IPv4 для прослушивания сайта' $(if($modeName -eq 'proxy'){'127.0.0.1'}else{'0.0.0.0'})
    $httpPort=80;$httpsPort=443;$trusted=@()
    if($modeName -eq 'https'){
      $httpsPort=Read-SimpleNetworkPort 'HTTPS порт сайта' 443
      if($PublicHttps){$httpPort=Read-SimpleNetworkPort 'HTTP порт для сертификата и перенаправления' 80}
    }else{$httpPort=Read-SimpleNetworkPort 'HTTP порт сайта' 8080}
    if($modeName -eq 'proxy'){
      Write-Host 'Прокси должен передавать Host, X-Forwarded-Proto и X-Forwarded-For; WebSocket /rtc тоже проходит через прокси. Медиапорты настраиваются отдельно.'
      $raw=Read-SimpleValue 'Доверенные прокси (IP/CIDR через запятую)' ''
      $trusted=@($raw.Split(',')|ForEach-Object{$_.Trim()}|Where-Object{$_})
    }
    if($modeName -eq 'http'){Write-Host 'Обычный HTTP вне localhost ограничивает камеру, микрофон и показ экрана в браузере. Для работы с других устройств используй HTTPS или внешний HTTPS-прокси.'}
    if($origin -ceq $defaultOrigin -and $modeName -ne 'proxy'){$uri=New-Object UriBuilder($origin);$uri.Port=$(if($modeName -eq 'http'){$httpPort}else{$httpsPort});$origin=$uri.Uri.GetLeftPart([UriPartial]::Authority)}
    $Configuration=[pscustomobject][ordered]@{mode=$modeName;publicOrigin=$origin;bindAddress=$bind;httpPort=$httpPort;httpsPort=$httpsPort;trustedProxies=$trusted;mediaIp=(Read-SimpleValue 'IPv4 для медиаподключений' $MediaIp);iceTcpPort=(Read-SimpleNetworkPort 'TCP порт медиаподключений' 7881);iceUdpPort=(Read-SimpleNetworkPort 'UDP порт медиаподключений' 7882);turnUdpPort=(Read-SimpleNetworkPort 'UDP порт TURN' 3478);relayPortStart=(Read-SimpleNetworkPort 'Начало диапазона TURN' 30000);relayPortEnd=(Read-SimpleNetworkPort 'Конец диапазона TURN' 30031)}
  }
  $probe=[pscustomobject]@{address=$SiteAddress;publicHttps=$PublicHttps;network=$Configuration}
  $normalized=Get-SimpleNetworkConfiguration $probe $MediaIp
  return [pscustomobject]@{setupMode='advanced';network=$normalized}
}
function Read-SimpleSshAuthentication([string]$AuthType='choose',[string]$KeyPath='') {
  if($AuthType -eq 'choose'){
    do{$choice=Read-SimpleValue 'SSH вход: 1 — Пароль; 2 — Приватный ключ' '1'}while($choice -notin @('1','2'))
    $AuthType=if($choice -eq '1'){'password'}else{'private-key'}
  }
  if($AuthType -eq 'password'){return @{Password=(Read-Host 'SSH пароль (не сохраняется)' -AsSecureString)}}
  if(-not $KeyPath){$KeyPath=Read-SimpleValue 'Файл приватного SSH ключа' ''}
  if(-not(Test-Path -LiteralPath $KeyPath -PathType Leaf)){throw 'Выбери существующий файл приватного SSH ключа.'}
  $info=Get-Item -LiteralPath $KeyPath
  if($info.Length -eq 0 -or $info.Length -gt 65536){throw 'Файл приватного SSH ключа пуст или превышает 64 КБ.'}
  $passphrase=Read-Host 'Парольная фраза SSH ключа (необязательно; Enter — без неё)' -AsSecureString
  if($passphrase.Length -gt 1024){$passphrase.Dispose();throw 'Парольная фраза SSH ключа превышает 1024 символа.'}
  return @{PrivateKeyPath=$info.FullName;Passphrase=$passphrase}
}
function Close-SimpleSshAuthentication([hashtable]$Authentication) {
  foreach($name in @('Password','Passphrase')){if($Authentication[$name]){$Authentication[$name].Dispose();$Authentication[$name]=$null}}
  $Authentication.Clear()
}
function Connect-SimpleInstallerSsh([string]$HostName,[string]$UserName,[int]$Port,[string]$ToolsDir) {
  $authentication=Read-SimpleSshAuthentication $SshAuthType $PrivateKeyPath
  try{return Connect-SimpleSsh -HostName $HostName -Login $UserName -Port $Port -ToolsDir $ToolsDir @authentication}
  finally{Close-SimpleSshAuthentication $authentication}
}
function Add-SimpleGeneratedSshKey([object]$Session,[string]$HostName,[string]$UserName,[int]$Port,[string]$ToolsDir,[string]$HelperPath) {
  Write-Host 'Можно создать SSH ключ для следующих подключений. Приватный ключ останется на этом ПК; на сервер добавится только публичный ключ. Ключ без парольной фразы; доступ к файлу только у твоего пользователя Windows. Первичный SSH доступ и проверка ключа сервера уже выполнены.'
  $answer=Read-SimpleValue 'Создать новый SSH ключ для этого сервера? да/нет' 'нет'
  if($answer -notin @('да','д','yes','y')){return $Session}
  $path=Read-SimpleValue 'Сохранить новый приватный SSH ключ' ''
  $remote='/tmp/castlink-ssh-authorize-'+[Guid]::NewGuid().ToString('N')+'.py'
  $uploaded=$false;$replacement=$null
  try{
    $key=New-SimpleSshKey $path
    $uploaded=$true
    Upload-SimpleSshFile -Client $Session -LocalFile $HelperPath -RemoteFile $remote
    $inputJson=@{publicKey=$key.publicKey}|ConvertTo-Json -Compress
    $result=Invoke-SimpleSshCommand -Client $Session -Command ('python3 '+(ConvertTo-SimplePosixLiteral $remote)) -Stdin $inputJson -TimeoutSeconds 30
    if($result.code -ne 0){throw 'Key authorization failed'}
    $response=$result.stdout|ConvertFrom-Json
    if(-not $response.ok){throw 'Key authorization was not confirmed'}
    $replacement=Connect-SimpleSsh -HostName $HostName -Login $UserName -Port $Port -ToolsDir $ToolsDir -PrivateKeyPath $key.path
    Write-Host 'Новый SSH ключ сохранён, добавлен на сервер и проверен отдельным подключением. Сохрани файл ключа для следующих установок и обновлений.'
    $original=$Session;$Session=$replacement
    Disconnect-SimpleSsh $original
    return $Session
  }catch{
    if($replacement){Disconnect-SimpleSsh $replacement}
    Write-Host 'Новый SSH ключ не подтверждён. Сохранённый файл оставлен на ПК; установка продолжится с прежним SSH доступом. Можно повторить добавление позже из студии.'
    return $Session
  }finally{if($uploaded){try{$null=Invoke-SimpleSshCommand -Client $Session -Command ('rm -f -- '+(ConvertTo-SimplePosixLiteral $remote)) -TimeoutSeconds 10}catch{}}}
}
function Confirm-SimpleDeletion { return ((Read-Host 'Для подтверждения введи: DELETE') -ceq 'DELETE') }
function Get-SimpleIPv4 {
  $preferred=@(Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway } | ForEach-Object { $_.IPv4Address.IPAddress })
  $all=@(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } | Select-Object -ExpandProperty IPAddress)
  return @(($preferred+$all) | Select-Object -Unique)
}
function Assert-SimpleIPv4([string]$Value) {
  $parsed=$null
  if ($Value -notmatch '^\d{1,3}(\.\d{1,3}){3}$' -or -not [Net.IPAddress]::TryParse($Value,[ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'Нужен IPv4 адрес, например 192.168.1.10.' }
}
function Test-SimpleReleaseTag([object]$Release,[string]$Tag) {
  if($Release.commit -cnotmatch '^[a-f0-9]{40}$'){return $false}
  if($Tag -ceq ('easy-setup-'+$Release.commit.Substring(0,12))){return $true}
  if(-not $Release.PSObject.Properties['track'] -or $Release.track -cne 'server-setup' -or -not $Release.PSObject.Properties['sourceCommit'] -or $Release.sourceCommit -cne $Release.commit){return $false}
  return ($Tag -ceq ('server-setup-v'+$Release.version+'-'+$Release.commit.Substring(0,12)))
}
function Find-SimpleServerSetupRelease([string]$Repository,[hashtable]$Headers) {
  # Product tags never use the repository-wide latest redirect. Linux/client
  # releases may be newer without changing the server setup channel.
  $candidates=@()
  for($page=1;$page -le 10;$page++){
    $response=Invoke-WebRequest -UseBasicParsing -Uri ('https://api.github.com/repos/'+$Repository+'/releases?per_page=100&page='+$page) -Headers $Headers -TimeoutSec 15
    $releases=@($response.Content|ConvertFrom-Json)
    foreach($release in $releases){
      if($release.draft -or $release.tag_name -cnotmatch '^server-setup-v[0-9]+\.[0-9]+\.[0-9]+(?:-[0-9A-Za-z.-]+)?-[a-f0-9]{12}$'){continue}
      $complete=$true
      foreach($name in @('CastLink-Windows.zip','CastLink-Linux.tar.gz','CastLink-Provisioning.json','manifest.json','SHA256SUMS','CastLink-ThirdParty-Sources.tar.gz','CastLink-ThirdParty-Office-Sources.tar.gz')){
        $expected='https://github.com/'+$Repository+'/releases/download/'+[Uri]::EscapeDataString($release.tag_name)+'/'+$name
        if(@($release.assets|Where-Object{$_.name -ceq $name -and $_.state -ceq 'uploaded' -and $_.size -gt 0 -and $_.browser_download_url -ceq $expected}).Count -ne 1){$complete=$false;break}
      }
      if($complete -and $release.published_at){$candidates+=,$release}
    }
    if($releases.Count -lt 100){break}
  }
  return @($candidates|Sort-Object {[DateTimeOffset]$_.published_at} -Descending|Select-Object -First 1)
}
function Test-SimpleBundledRelease([string]$Root,[string]$Tag,[string]$Repository) {
  try {
    $path=Join-Path $Root 'payload/release.json'
    $r=Get-Content -LiteralPath $path -Encoding UTF8 -Raw|ConvertFrom-Json
    if($r.schemaVersion -ne 1 -or -not(Test-SimpleReleaseTag $r $Tag) -or $r.distributionRepository -cne $Repository -or $r.imageArchive -cne 'images.tar.gz' -or $r.imageArchiveSha256 -cnotmatch '^[a-f0-9]{64}$'){return $false}
    if((Get-FileHash -LiteralPath (Join-Path $Root 'payload/images.tar.gz') -Algorithm SHA256).Hash.ToLowerInvariant() -cne $r.imageArchiveSha256){return $false}
    $names=@($r.bundleFiles.PSObject.Properties)
    if(-not $names.Count -or -not $r.bundleFiles.PSObject.Properties['scripts/windows-simple-easy-setup.ps1']){return $false}
    foreach($item in $names){
      if($item.Name -cnotmatch '^(scripts/[a-zA-Z0-9._-]+|LICENSE)$' -or $item.Value -cnotmatch '^[a-f0-9]{64}$' -or (Get-FileHash -LiteralPath (Join-Path $Root $item.Name) -Algorithm SHA256).Hash.ToLowerInvariant() -cne $item.Value){return $false}
    }
    return $true
  } catch { return $false }
}
function Get-SimpleCurrentRelease([string]$Folder) {
  Write-Host 'Проверяю текущую версию CastLink на GitHub...'
  $config=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'simple-easy-setup-release.json') -Encoding UTF8 -Raw | ConvertFrom-Json
  $repository=[string]$config.repository
  if ($repository -cnotmatch '^[a-zA-Z0-9][a-zA-Z0-9-]{0,38}/[a-zA-Z0-9][a-zA-Z0-9._-]{0,99}$') { throw 'Некорректный адрес опубликованных выпусков CastLink.' }
  $repositoryUrl='https://github.com/'+$repository
  $headers=@{'User-Agent'='CastLink-EasySetup'}
  $selected=@()
  try{$selected=@(Find-SimpleServerSetupRelease $repository $headers)}catch{throw 'Не удалось проверить канал установщика сервера. Повтори позже; прежняя установка не изменена.'}
  if($selected.Count -eq 1){$tag=[string]$selected[0].tag_name}else{
  # Retain the historical combined channel when no separate setup is available.
  $latest=Invoke-WebRequest -UseBasicParsing -Method Head -Uri ($repositoryUrl+'/releases/latest') -Headers $headers -TimeoutSec 30
  $resolved=$latest.BaseResponse.ResponseUri
  $tagMatch=[regex]::Match($resolved.AbsolutePath,('^/'+[regex]::Escape($repository)+'/releases/tag/([a-zA-Z0-9._-]+)$'))
  if ($resolved.Scheme -ne 'https' -or $resolved.Host -ne 'github.com' -or -not $tagMatch.Success) { throw 'GitHub не вернул текущий Release CastLink. Установка не изменена.' }
  $tag=$tagMatch.Groups[1].Value
  if($tag -cnotmatch '^easy-setup-[a-f0-9]{12}$'){throw 'Не найден полный выпуск установщика сервера. Установка не изменена.'}
  }
  $base=$repositoryUrl+'/releases/download/'+[Uri]::EscapeDataString($tag)+'/'
  $release=[pscustomobject]@{tag_name=$tag;assets=@(
    [pscustomobject]@{name='CastLink-Windows.zip';browser_download_url=($base+'CastLink-Windows.zip')},
    [pscustomobject]@{name='CastLink-Linux.tar.gz';browser_download_url=($base+'CastLink-Linux.tar.gz')},
    [pscustomobject]@{name='SHA256SUMS';browser_download_url=($base+'SHA256SUMS')}
  )}
  $asset=@($release.assets | Where-Object { $_.name -eq 'CastLink-Windows.zip' })
  $sums=@($release.assets | Where-Object { $_.name -eq 'SHA256SUMS' })
  if ($asset.Count -ne 1 -or $sums.Count -ne 1) { throw 'У текущего GitHub Release пока нет полного Windows пакета. Установка не изменена.' }
  $cache=Join-Path $Folder '.downloads'; $null=New-Item -ItemType Directory -Path $cache -Force
  $sumFile=Join-Path $cache 'SHA256SUMS'
  Invoke-SimpleDownload -Uri $sums[0].browser_download_url -OutFile $sumFile -Headers $headers -Label 'Контрольные суммы GitHub'
  $line=@(Get-Content -LiteralPath $sumFile | Where-Object { $_ -match '^[a-f0-9]{64}  CastLink-Windows\.zip$' })
  if ($line.Count -ne 1) { throw 'В Release отсутствует SHA256 Windows пакета.' }
  $expected=$line[0].Substring(0,64); $zip=Join-Path $cache ($expected+'.zip')
  $payload=Join-Path $cache $expected
  $bundled=Split-Path $PSScriptRoot -Parent
  if(Test-SimpleBundledRelease $bundled $tag $repository){
    if(-not [string]::Equals([IO.Path]::GetFullPath($bundled),[IO.Path]::GetFullPath($payload),[StringComparison]::OrdinalIgnoreCase)){
      $null=New-Item -ItemType Directory (Join-Path $payload 'scripts') -Force
      $null=New-Item -ItemType Directory (Join-Path $payload 'payload') -Force
      $manifest=Get-Content -LiteralPath (Join-Path $bundled 'payload/release.json') -Encoding UTF8 -Raw|ConvertFrom-Json
      foreach($item in $manifest.bundleFiles.PSObject.Properties){Copy-Item -LiteralPath (Join-Path $bundled $item.Name) -Destination (Join-Path $payload $item.Name) -Force}
      Copy-Item -LiteralPath (Join-Path $bundled 'payload/release.json') -Destination (Join-Path $payload 'payload/release.json') -Force
      $archive=Join-Path $payload 'payload/images.tar.gz'
      if(-not(Test-Path -LiteralPath $archive) -or (Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -cne $manifest.imageArchiveSha256){Copy-Item -LiteralPath (Join-Path $bundled 'payload/images.tar.gz') -Destination $archive -Force}
    }
    Write-Host 'Использую проверенный текущий пакет: повторная загрузка Windows ZIP не требуется.'
  } else {
    if (-not (Test-Path $zip) -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
      Write-Host 'Скачиваю текущий Windows пакет. Это может занять несколько минут...'
      Invoke-SimpleDownload -Uri $asset[0].browser_download_url -OutFile $zip -Headers $headers -Label 'Windows пакет CastLink'
    }
    if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'SHA256 загруженного пакета не совпал. Повтори загрузку.' }
    Expand-Archive -LiteralPath $zip -DestinationPath $payload -Force
  }
  $metadata=Get-Content -LiteralPath (Join-Path $payload 'payload/release.json') -Encoding UTF8 -Raw|ConvertFrom-Json
  if(-not(Test-SimpleReleaseTag $metadata $tag) -or $metadata.distributionRepository -cne $repository){throw 'Источник загруженного пакета не совпал с выбранным выпуском.'}
  $console=@'
@echo off
chcp 65001 >nul
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0.downloads\{0}\scripts\windows-simple-easy-setup.ps1"
pause
'@ -f $expected
  $launcher=$console
  if(Test-Path -LiteralPath (Join-Path $payload 'scripts/simple-easy-setup-gui.ps1')) {
    $launcher=@'
@echo off
start "" "%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "%~dp0.downloads\{0}\scripts\simple-easy-setup-gui.ps1"
'@ -f $expected
  }
  $launcher=$launcher.Replace("`r`n","`n").Replace("`n","`r`n")
  if(Get-Command Write-SimpleOwnedLauncher -ErrorAction SilentlyContinue){Write-SimpleOwnedLauncher $Folder $launcher}else{[IO.File]::WriteAllText((Join-Path $Folder 'EasySetup.cmd'),$launcher,(New-Object Text.UTF8Encoding($false)))}
  if(Get-Command Write-SimpleOwnedLauncher -ErrorAction SilentlyContinue){Write-SimpleOwnedLauncher $Folder ($console.Replace("`r`n","`n").Replace("`n","`r`n")) 'EasySetup-Console.cmd'}else{[IO.File]::WriteAllText((Join-Path $Folder 'EasySetup-Console.cmd'),$console.Replace("`r`n","`n").Replace("`n","`r`n"),(New-Object Text.UTF8Encoding($false)))}
  return [pscustomobject]@{folder=$payload;release=$release;sums=$sumFile}
}
function Get-SimpleLinuxPackage([object]$Current,[string]$Folder) {
  $asset=@($Current.release.assets | Where-Object { $_.name -eq 'CastLink-Linux.tar.gz' })
  $line=@(Get-Content -LiteralPath $Current.sums | Where-Object { $_ -match '^[a-f0-9]{64}  CastLink-Linux\.tar\.gz$' })
  if ($asset.Count -ne 1 -or $line.Count -ne 1) { throw 'В текущем Release нет полного Linux пакета.' }
  $file=Join-Path $Folder '.downloads\CastLink-Linux.tar.gz'
  if(-not(Test-Path -LiteralPath $file) -or (Get-FileHash -LiteralPath $file -Algorithm SHA256).Hash.ToLowerInvariant() -cne $line[0].Substring(0,64)){Write-Host 'Скачиваю текущий Linux пакет для VPS...';Invoke-SimpleDownload -Uri $asset[0].browser_download_url -OutFile $file -Headers @{'User-Agent'='CastLink-EasySetup'} -Label 'Linux пакет CastLink'}else{Write-Host 'Использую ранее загруженный и проверенный Linux пакет для VPS.'}
  if ((Get-FileHash $file -Algorithm SHA256).Hash.ToLowerInvariant() -ne $line[0].Substring(0,64)) { throw 'SHA256 Linux пакета не совпал.' }
  return $file
}
function Wait-SimpleWeb {
  $script='require("node:http").get("http://127.0.0.1:3000/api/version",r=>{r.resume();r.on("end",()=>process.exit(r.statusCode===200?0:1))}).on("error",()=>process.exit(1));setTimeout(()=>process.exit(1),5000);'
  $deadline=[DateTime]::UtcNow.AddSeconds(120)
  do {
    try { $null=Invoke-DeploymentCompose @('exec','-T','web','node','-e',$script) '' 10; return } catch { Start-Sleep -Seconds 2 }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'Web сервер пока не готов. Проверь Docker Desktop и повтори мастер с той же папкой.'
}
function Assert-SimpleDomainName([string]$Name) {
  if ($Name -notmatch '^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$') { throw 'Введи домен без https:// и пути, например meet.example.com.' }
}
function Assert-SimplePublicIPv4([string]$Ip) {
  Assert-SimpleIPv4 $Ip
  $b=[Net.IPAddress]::Parse($Ip).GetAddressBytes()
  if ($b[0] -in @(0,10,127) -or $b[0] -ge 224 -or ($b[0] -eq 169 -and $b[1] -eq 254) -or ($b[0] -eq 172 -and $b[1] -ge 16 -and $b[1] -le 31) -or ($b[0] -eq 192 -and $b[1] -eq 168) -or ($b[0] -eq 100 -and $b[1] -ge 64 -and $b[1] -le 127)) { throw 'Для доступа к VPS без домена нужен публичный IPv4. Для локальной сети выбери «Локально».' }
}
function Assert-SimpleDomainChange([object]$State,[string]$Domain) {
  $oldIp=$null
  if($State.PSObject.Properties['network'] -and $State.network){throw 'Расширенная установка сохраняет внешний адрес сайта. Используй сохранённые настройки или новую папку для другой сетевой схемы.'}
  Assert-SimpleDomainName $Domain
  if (-not $State.completed -or $State.target -ne 'remote' -or -not $State.publicHttps -or -not [Net.IPAddress]::TryParse([string]$State.address,[ref]$oldIp) -or $State.address -ne $State.serverIp -or $State.stopped) { throw 'Добавить домен можно к завершённой установке внешнего сервера по IP. Для остальных изменений используй прежний адрес.' }
}
function Set-SimpleRemoteDomain([string]$Folder,[object]$State,[string]$Domain) {
  Assert-SimpleDomainChange $State $Domain
  $compose=Get-Content -LiteralPath (Join-Path $Folder 'compose.json') -Raw | ConvertFrom-Json
  $project=Get-SimpleRemovalProject $State $compose
  $remoteCompose=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/compose.json')))
  if ($remoteCompose.code -ne 0 -or (Get-SimpleRemovalProject $State ($remoteCompose.stdout | ConvertFrom-Json)) -cne $project) { throw 'Конфигурация выбранного CastLink на VPS не совпала; адрес не изменён.' }
  $remoteCaddy=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral ($script:ServerFolder+'/Caddyfile')))
  $caddyPath=Join-Path $Folder 'Caddyfile';$statePath=Join-Path $Folder '.castlink-install.json'
  $oldCaddy=[IO.File]::ReadAllText($caddyPath);$oldState=[IO.File]::ReadAllText($statePath)
  if ($remoteCaddy.code -ne 0 -or $remoteCaddy.stdout -cne $oldCaddy) { throw 'Caddyfile на VPS изменён отдельно от мастера; адрес не изменён. Сначала согласуй сохранённую конфигурацию.' }
  $buildProbe='const http=require("node:http");http.get("http://127.0.0.1:3000/api/version",r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>{try{const j=JSON.parse(b);if(r.statusCode!==200||typeof j.buildId!=="string"||!j.buildId.length)throw Error();process.stdout.write(j.buildId)}catch{process.exit(1)}})}).on("error",()=>process.exit(1));setTimeout(()=>process.exit(1),5000).unref();'
  $build=(Invoke-DeploymentCompose @('exec','-T','web','node','-e',$buildProbe) '' 10 $project).Trim()
  if (-not $build -or $build.Length -gt 200 -or $build -match '[\r\n]') { throw 'Не удалось проверить версию прежнего приложения; адрес не изменён.' }
  $candidate=$State | ConvertTo-Json -Depth 10 | ConvertFrom-Json;$candidate.address=$Domain
  $newCaddy=Get-SimpleCaddyConfiguration $candidate
  $null=Invoke-DeploymentCompose @('exec','-T','caddy','caddy','adapt','--config','/dev/stdin','--adapter','caddyfile') $newCaddy 15 $project
  try {
    Write-SimpleText $caddyPath $newCaddy
    Upload-SimpleSshFile -Client $script:SshSession -LocalFile $caddyPath -RemoteFile ($script:ServerFolder+'/Caddyfile')
    $null=Invoke-DeploymentCompose @('restart','caddy') '' 60 $project
    Wait-SimpleHttps $candidate $null '' $build
    Save-SimpleState $Folder $candidate
    return $candidate
  } catch {
    $failure=$_.Exception.Message
    Write-SimpleText $caddyPath $oldCaddy;Write-SimpleText $statePath $oldState
    try {
      Upload-SimpleSshFile -Client $script:SshSession -LocalFile $caddyPath -RemoteFile ($script:ServerFolder+'/Caddyfile')
      $null=Invoke-DeploymentCompose @('restart','caddy') '' 60 $project
      Wait-SimpleHttps $State $null '' $build
    } catch {
      throw ('Новый домен не включён; локальная прежняя конфигурация сохранена. Не удалось восстановить Caddy на VPS; повтори мастер с прежним IP. '+$failure)
    }
    throw ('Новый домен не включён; прежняя конфигурация восстановлена, комнаты и настройки сохранены. '+$failure)
  }
}
function Test-SimpleDomain([string]$Name,[string]$Ip,[switch]$FailIfUnresolved) {
  Assert-SimpleDomainName $Name
  do {
    $addresses=@(Resolve-DnsName -Name $Name -Type A -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq 'A' } | Select-Object -ExpandProperty IPAddress)
    if ($addresses -contains $Ip) { return }
    if($FailIfUnresolved){throw ('DNS домена TURN '+$Name+' не указывает на '+$Ip+'. Добавь A-запись и повтори мастер; текущая конфигурация не изменена.')}
    Write-Host "В панели DNS добавь A-запись: $Name -> $Ip. HTTPS появится после обновления DNS."
    $null=Read-Host 'Нажми Enter после изменения DNS, чтобы проверить снова (Ctrl+C — выход)'
  } while ($true)
}
function Assert-SimpleTurnPayload([object]$Release,[string]$TurnDomain) {
  if(-not $TurnDomain){return}
  if(-not $Release.images -or -not $Release.images.PSObject.Properties['turntls'] -or $Release.images.turntls -cnotmatch '^castlink-easy-turntls:[a-f0-9]{40}$' -or -not $Release.imageIdentities -or -not $Release.imageIdentities.PSObject.Properties['turntls'] -or $Release.imageIdentities.turntls -cnotmatch '^sha256:[a-f0-9]{64}$'){throw 'В выбранном выпуске нет закреплённого образа TURN/TLS. Текущая конфигурация не изменена; используй новый полный пакет.'}
}
function Resolve-SimpleTurnDomain([string]$SiteDomain,[string]$Ip,[object]$Selected,[string]$Requested,[bool]$Specified) {
  $savedDomain=if($Selected -and $Selected.PSObject.Properties['turnDomain']){[string]$Selected.turnDomain}else{''}
  $value=$Requested
  if(-not $Specified -and $Selected){$value=$savedDomain}
  elseif(-not $Specified -and $SiteDomain -ne $Ip) {
    Write-Host 'Дополнительно можно включить TURN/TLS на TCP 443 для корпоративных сетей и VPN. Нужен отдельный домен с A-записью на этот VPS. Enter сохраняет обычный режим с TURN/UDP.'
    $value=Read-SimpleValue 'Отдельный домен TURN/TLS (необязательно; Enter — пропустить)' ''
  }
  if(-not $value -and $savedDomain){$value=$savedDomain}
  $value=$value.Trim().ToLowerInvariant()
  if($value) {
    Assert-SimpleTurnDomain $value $SiteDomain $true
    if($Selected -and $Selected.address -ne $SiteDomain){throw 'Сначала заверши изменение адреса сайта, затем отдельно включи TURN/TLS. Текущая конфигурация не изменена.'}
    Test-SimpleDomain $value $Ip -FailIfUnresolved
  }
  return $value
}
function Prepare-SimpleDotNet([string]$Folder) {
  $framework=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction SilentlyContinue).Release
  if ($framework -ge 528040) { return }
  $yes=Read-Host 'Для SSH нужен .NET Framework 4.8. Скачать и установить официальный компонент Microsoft? [да/нет]'
  if ($yes -notin @('да','д','yes','y')) { throw 'Установка SSH компонента отменена.' }
  if(Get-Command Register-SimpleSharedComponent -ErrorAction SilentlyContinue){Register-SimpleSharedComponent 'NET-Framework-4.8' 'installation-requested'}
  $file=Join-Path $Folder 'net-framework-4.8.exe'
  Invoke-SimpleDownload -Uri 'https://go.microsoft.com/fwlink/?linkid=2088631' -OutFile $file -Label '.NET Framework 4.8'
  $signature=Get-AuthenticodeSignature $file
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') { throw 'Подпись .NET установщика не подтверждена.' }
  $install=Start-Process $file -Verb RunAs -ArgumentList '/passive /norestart' -Wait -PassThru
  if ($install.ExitCode -in @(3010,1641)) { throw '.NET установлен. Перезагрузи Windows и продолжи мастер с той же папкой.' }
  if ($install.ExitCode -ne 0) { throw '.NET установщик не завершился успешно.' }
}
function Wait-SimpleHttps([object]$State,[object]$Release,[string]$CaFile,[string]$ExpectedBuildId='') {
  if (-not $ExpectedBuildId) { $ExpectedBuildId=$Release.version+'-'+$Release.commit.Substring(0,12) }
  Write-Host 'Проверяю HTTPS и версию приложения...'
  $verify='const https=require("node:https"),tls=require("node:tls"),net=require("node:net"),fs=require("node:fs");const host=new URL(process.argv[1]).hostname;const options={hostname:"caddy",port:443,path:"/api/version",headers:{host},servername:net.isIP(host)?"":host,checkServerIdentity:(_name,cert)=>tls.checkServerIdentity(host,cert),timeout:10000};if(process.argv[3])options.ca=fs.readFileSync(process.argv[3]);const q=https.get(options,r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>{try{const j=JSON.parse(b);process.exit(r.statusCode===200&&j.buildId===process.argv[2]?0:1)}catch{process.exit(1)}})});q.on("error",()=>process.exit(1));q.on("timeout",()=>q.destroy());'
  $deadline=[DateTime]::UtcNow.AddSeconds(180)
  do {
    try {
      $siteUrl=if(Get-Command Get-SimpleHomeUrl -ErrorAction SilentlyContinue){Get-SimpleHomeUrl $State}else{'https://'+$State.address}
      $null=Invoke-DeploymentCompose @('exec','-T','web','node','-e',$verify,$siteUrl,$ExpectedBuildId,$CaFile) '' 15
      return
    } catch { Start-Sleep -Seconds 3 }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'HTTPS ещё не готов. Проверь DNS и входящие TCP80/443 (VPS), либо выбранный IP и Windows Firewall (LAN). Данные сохранены; повтори тот же мастер.'
}
function Wait-SimpleNetworkHttp([object]$State,[object]$Release) {
  $expected=$Release.version+'-'+$Release.commit.Substring(0,12)
  $verify='const http=require("node:http");const origin=new URL(process.argv[1]);const q=http.get({hostname:"caddy",port:80,path:"/api/version",headers:{host:origin.host},timeout:10000},r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>{try{const j=JSON.parse(b);process.exit(r.statusCode===200&&j.buildId===process.argv[2]?0:1)}catch{process.exit(1)}})});q.on("error",()=>process.exit(1));q.on("timeout",()=>q.destroy());'
  $deadline=[DateTime]::UtcNow.AddSeconds(120)
  do{try{$null=Invoke-DeploymentCompose @('exec','-T','web','node','-e',$verify,(Get-SimpleHomeUrl $State),$expected) '' 15;return}catch{Start-Sleep -Seconds 3}}while([DateTime]::UtcNow -lt $deadline)
  throw 'Сайт ещё не готов. Проверь порт, адрес и конфигурацию прокси; данные установки сохранены.'
}
function Write-SimpleNetworkSummary([object]$State) {
  $n=Get-SimpleNetworkConfiguration $State
  $sitePorts=if($n.mode -eq 'https'){$n.httpsPort;if($State.publicHttps){$n.httpPort}}else{$n.httpPort}
  Write-Host ('Порты сайта: TCP {0}; медиапорты: TCP {1}, UDP {2},{3},{4}-{5}.' -f ($sitePorts -join ','),$n.iceTcpPort,$n.iceUdpPort,$n.turnUdpPort,$n.relayPortStart,$n.relayPortEnd)
}
function Start-SimpleRemoteRemoval {
  Write-SimpleStage 'Выбор сервера и подтверждение удаления' 1 4
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  $previous=if ($InstallFolder) { $InstallFolder } else { Get-SimplePreviousWorkspace }
  $saved=$null
  if ($previous -and (Test-Path -LiteralPath (Join-Path $previous '.castlink-install.json'))) {
    $candidate=Get-Content -LiteralPath (Join-Path $previous '.castlink-install.json') -Raw | ConvertFrom-Json
    if ($candidate.target -eq 'remote') { $saved=$candidate }
  }
  if (-not $ServerIp) { $ServerIp=Read-SimpleValue 'IPv4 внешнего сервера' ([string]$saved.serverIp) };Assert-SimpleIPv4 $ServerIp
  if (-not $SshPort) { $SshPort=[int](Read-SimpleValue 'SSH порт' $(if ($saved.sshPort) { [string]$saved.sshPort } else { '22' })) }
  if ($SshPort -lt 1 -or $SshPort -gt 65535) { throw 'SSH порт должен быть от 1 до 65535.' }
  if (-not $Login) { $Login=Read-SimpleValue 'SSH логин' $(if ($saved.sshLogin) { [string]$saved.sshLogin } else { 'root' }) }
  $workspace=Get-SimpleRemoteWorkspace $ServerIp $SshPort
  if ($saved -and $saved.serverIp -eq $ServerIp -and $saved.sshPort -eq $SshPort) { $workspace=$previous }
  $workspaceState=Join-Path $workspace '.castlink-install.json'
  if (Test-Path -LiteralPath $workspaceState) {
    try {
      $candidate=Get-Content -LiteralPath $workspaceState -Raw | ConvertFrom-Json
      Assert-SimpleTarget $candidate 'remote' $ServerIp $SshPort
      $cachedCompose=Get-Content -LiteralPath (Join-Path $workspace 'compose.json') -Raw | ConvertFrom-Json
      $null=Get-SimpleRemovalProject $candidate $cachedCompose
      $saved=$candidate;$previous=$workspace
    } catch { $saved=$null }
  }
  Complete-SimpleInputPhase
  $workspaceWasNew=-not(Test-Path -LiteralPath $workspace)
  $null=New-Item -ItemType Directory -Path $workspace -Force
  $null=Open-SimpleOwnership $workspace -FolderWasNew:$workspaceWasNew
  try {
  Prepare-SimpleDotNet $workspace
  . (Join-Path $PSScriptRoot 'simple-easy-setup-ssh.ps1')
  $null=Install-SimpleSshDependency -ToolsDir (Join-Path $workspace '.tools')
  $script:SshSession=Connect-SimpleInstallerSsh $ServerIp $Login $SshPort (Join-Path $workspace '.tools')
  try {
    $known=@(Get-SimpleRemoteInstallations)
    if (-not $known.Count) { Write-Host 'На внешнем сервере не найдены установки CastLink этого мастера.';return }
    Write-Host 'Найдены установки CastLink на внешнем сервере:'
    for ($i=0;$i -lt $known.Count;$i++) { $address=if ($known[$i].address) { 'https://'+$known[$i].address } else { 'проект '+$known[$i].project };Write-Host ("{0} — {1}, {2}" -f ($i+1),$address,$known[$i].folder) }
    $choice=Read-SimpleValue 'Выбери номер установки; 0 — отмена' '0';$index=0
    if (-not [int]::TryParse($choice,[ref]$index) -or $index -lt 0 -or $index -gt $known.Count) { throw 'Нужен номер из показанного списка.' }
    if ($index -eq 0) { Write-Host 'Удаление отменено.';return }
    $selected=$known[$index-1];$script:ServerFolder=$selected.folder
    Write-Host ('Выбран сервер '+$ServerIp+':'+$SshPort+', папка '+$selected.folder)
    Write-Host 'Службы только выбранного сервера будут остановлены. Данные сохраняются по умолчанию.'
    $mode=Read-SimpleValue '1 — удалить сервер, сохранив комнаты и настройки; 2 — удалить сервер вместе с комнатами и настройками' '1'
    if ($mode -notin @('1','2')) { Write-Host 'Удаление отменено.';return }
    if ($mode -eq '2') { Write-Host 'Комнаты и настройки выбранной установки будут удалены без восстановления.' }
    if (-not (Confirm-SimpleDeletion)) { Write-Host 'Удаление отменено.';return }
    if ($saved -and $saved.installationId -ceq $selected.installationId -and $saved.serverIp -eq $ServerIp -and $saved.sshPort -eq $SshPort) { $folder=$previous;$state=$saved }
    else { $folder=Join-Path (Join-Path $workspace '.removal') $selected.installationId;$state=New-SimpleRemoteRemovalMirror $folder $selected $ServerIp $SshPort }
    $null=Remove-SimpleDeployment $folder $state -Confirmed -DeleteData:($mode -eq '2') -DeferFileCleanup:($folder -ceq $workspace)
    if ($mode -eq '1') {
      Write-Host ('Сервер удалён; комнаты, настройки и конфигурация сохранены на VPS в '+$selected.folder+'.')
      if ($state.removalOnly) { Write-Host 'Для восстановления используй сохранённый Compose на VPS или прежнюю полную папку мастера.' }
      else { Write-Host 'Для восстановления выбери установку в прежнюю папку мастера.' }
    }
    else { Write-Host 'Службы, комнаты и настройки выбранной установки удалены. Причины сохранения общих компонентов и статус очистки файлов показаны выше.' }
  } finally { if ($script:SshSession) { Disconnect-SimpleSsh $script:SshSession;$script:SshSession=$null } }
  } finally {
    $workspaceOwned=Update-SimpleOwnership $workspace
    $retained=@(Get-ChildItem -LiteralPath (Join-Path $workspace '.removal') -Filter '.castlink-install.json' -File -Recurse -ErrorAction SilentlyContinue)
    if(-not(Test-Path -LiteralPath (Join-Path $workspace '.castlink-install.json')) -and -not $retained.Count){
      $files=@(Get-SimpleCleanupFiles $workspace $workspaceOwned)+(Join-Path $workspace '.castlink-owned.json')
      $directories=@();if($selected){$directories+= (Join-Path (Join-Path $workspace '.removal') $selected.installationId);$directories+= (Join-Path $workspace '.removal')}
      Start-SimpleDeferredCleanup $workspace $files $directories
    }else{Write-Host 'SSH-кэш сохранён: рабочая папка содержит другую или сохранённую установку.'}
  }
}
function Start-SimpleRemoval {
  Write-SimpleStage 'Выбор сервера и подтверждение удаления' 1 4
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  $statePath=Join-Path $InstallFolder '.castlink-install.json'
  if (-not (Test-Path -LiteralPath $statePath -PathType Leaf)) { throw 'В выбранной папке нет сохранённой установки CastLink.' }
  $state=Get-Content -LiteralPath $statePath -Raw | ConvertFrom-Json
  $script:SshSession=$null
  if ($Target -eq 'choose' -and $state.PSObject.Properties['target']) { $Target=$state.target }
  if ($Target -eq 'choose' -and $state.publicHttps -is [bool]) { $Target=if ($state.publicHttps) { 'remote' } else { 'local' } }
  if ($Target -eq 'choose') {
    do { $choice=Read-Host 'Удалить: 1 — Локально; 2 — Внешний сервер' } while ($choice -notin @('1','2'))
    $Target=if ($choice -eq '1') { 'local' } else { 'remote' }
  }
  if ($Target -eq 'remote') {
    if (-not $ServerIp) { $ServerIp=Read-SimpleValue 'IPv4 VPS' ([string]$state.serverIp) };Assert-SimpleIPv4 $ServerIp
    if (-not $Login) { $Login=Read-SimpleValue 'SSH логин' $(if ($state.sshLogin) { $state.sshLogin } else { 'root' }) }
    if (-not $SshPort) { $SshPort=[int](Read-SimpleValue 'SSH порт' $(if ($state.sshPort) { [string]$state.sshPort } else { '22' })) }
  }
  Assert-SimpleTarget $state $Target $ServerIp $SshPort
  $compose=Get-Content -LiteralPath (Join-Path $InstallFolder 'compose.json') -Raw | ConvertFrom-Json
  $project=Get-SimpleRemovalProject $state $compose
  $targetText=if ($Target -eq 'local') { 'этот ПК' } else { $ServerIp+':'+$SshPort }
  Write-Host "Удаление CastLink: https://$($state.address), сервер: $targetText, папка: $InstallFolder"
  Write-Host 'Службы только выбранного сервера будут остановлены. Данные сохраняются по умолчанию.'
  $mode=Read-SimpleValue '1 — удалить сервер, сохранив комнаты и настройки; 2 — удалить сервер вместе с комнатами и настройками' '1'
  if ($mode -notin @('1','2')) { Write-Host 'Удаление отменено.';return }
  if ($mode -eq '2') { Write-Host 'Комнаты, записи и настройки этой установки будут удалены без восстановления. Собственные загрузки и неиспользуемые компоненты будут очищены; чужие и общие сохранятся.' }
  if (-not (Confirm-SimpleDeletion)) { Write-Host 'Удаление отменено.';return }
  Complete-SimpleInputPhase
  try {
    if ($Target -eq 'local') {
      . (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
      $desktop=Find-Desktop
      if (-not $desktop) { throw 'Docker Desktop не установлен. Удаление не выполнено; данные сохранены.' }
      # Only start an existing installation; never enter the dependency installer.
      $gui=@(Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)
      if (-not $gui.Count) { $null=Start-SimpleDockerDesktop $desktop }
      $script:DockerExe=Join-Path (Split-Path $desktop -Parent) 'resources\bin\docker.exe'
      $script:ServerFolder=$InstallFolder.Replace('\','/')
      $deadline=[DateTime]::UtcNow.AddSeconds(120)
      do { $info=Invoke-SimpleProcess $script:DockerExe @('--context','desktop-linux','info','--format','{{.OSType}}') '' 10;if ($info.code -eq 0 -and $info.stdout.Trim() -eq 'linux') { break };Start-Sleep -Seconds 2 } while ([DateTime]::UtcNow -lt $deadline)
      if ($info.code -ne 0 -or $info.stdout.Trim() -ne 'linux') { throw 'Docker Linux engine недоступен. Удаление не выполнено.' }
    } else {
      . (Join-Path $PSScriptRoot 'simple-easy-setup-ssh.ps1')
      # Reuse already downloaded modules; removal never downloads installers.
      Import-SimpleSshDependency -ToolsDir (Join-Path $InstallFolder '.tools')
      $script:SshSession=Connect-SimpleInstallerSsh $ServerIp $Login $SshPort (Join-Path $InstallFolder '.tools')
      $script:ServerFolder='/opt/'+$project
    }
    $null=Remove-SimpleDeployment $InstallFolder $state -Confirmed -DeleteData:($mode -eq '2')
    if ($mode -eq '1') { Write-Host 'Сервер CastLink удалён; комнаты, данные и пароли сохранены. Для восстановления выбери установку в ту же папку.' } else { Write-Host 'Службы, комнаты и настройки удалены. Причины сохранения общих компонентов и статус отложенной очистки файлов показаны выше.' }
  } finally { if ($script:SshSession) { Disconnect-SimpleSsh $script:SshSession } }
}
function Read-SimpleLocalAddress {
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  $script:SshSession=$null
      $saved=$null;$savedPath=Join-Path $InstallFolder '.castlink-install.json'
      if (Test-Path -LiteralPath $savedPath) { $saved=Get-Content -LiteralPath $savedPath -Raw | ConvertFrom-Json;Assert-SimpleTarget $saved 'local';if (-not $Address) { $Address=$saved.address;Write-Host ('Прежняя установка: https://'+$Address) } }
      $ips=@(Get-SimpleIPv4)
      Write-Host ('Адреса этого ПК: '+($ips -join ', '))
      Write-Host 'Для локальной сети выбери LAN адрес. Для доступа извне укажи публичный IPv4 и настрой проброс портов на роутере.'
      if (-not $Address) {
        $access='1'
        if($SetupMode -eq 'advanced'){do { $access=Read-Host 'Доступ: 1 — LAN, другие устройства этой сети; 2 — публичный IPv4 через роутер' } while ($access -notin @('1','2'))}
        $default=if ($ips.Count) { $ips[0] } else { '' }
        if ($access -eq '2') {
          try { $default=(Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 8).Trim() } catch { $default='' }
          Write-Host 'Обнаруженный внешний адрес может принадлежать NAT провайдера. Для внешнего доступа нужен собственный публичный адрес и доступные входящие порты.'
        }
        $Address=Read-SimpleValue 'IPv4 для CastLink (можно изменить)' $default
      }
      Assert-SimpleIPv4 $Address
      if (-not $saved -and $Address -match '^127\.') { throw 'Для новой установки укажи LAN или публичный IPv4. Режим только для этого ПК больше не предлагается.' }
      if ($saved -and $saved.address -ne $Address) { throw 'В этой папке уже настроен другой адрес. Выбери прежний адрес или новую папку.' }
      $savedPath=Join-Path $InstallFolder '.castlink-install.json'
      if (Test-Path -LiteralPath $savedPath) { Assert-SimpleTarget (Get-Content -LiteralPath $savedPath -Raw | ConvertFrom-Json) 'local' }
      $script:Address=$Address
}
function Prepare-SimpleLocalInstall {
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  $script:SshSession=$null
  $saved=$null;$savedPath=Join-Path $InstallFolder '.castlink-install.json'
  if(Test-Path -LiteralPath $savedPath){$saved=Get-Content -LiteralPath $savedPath -Encoding UTF8 -Raw|ConvertFrom-Json;Assert-SimpleTarget $saved 'local'}
  if(-not $Address){Read-SimpleLocalAddress;$Address=$script:Address}
  if (-not $saved -and $Address -match '^127\.') { throw 'Для новой установки укажи LAN или публичный IPv4. Режим только для этого ПК больше не предлагается.' }
  Complete-SimpleInputPhase
      . (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
      Start-SimpleRuntimeOwnership $InstallFolder
      try{$null=Prepare-LocalRuntime}finally{Complete-SimpleRuntimeOwnership $InstallFolder}
      $desktop=Find-Desktop; $script:DockerExe=Join-Path (Split-Path $desktop -Parent) 'resources\bin\docker.exe'
      $script:ServerFolder=$InstallFolder.Replace('\','/')
      $portState=$saved
      if(-not $portState -and $script:SimpleNetworkOptions){$portState=[pscustomobject]@{address=$Address;publicHttps=$false;network=$script:SimpleNetworkOptions}}
      Assert-SimplePortAvailability $portState $Address $false
      $script:Address=$Address
}
function Select-SimpleLocalInstallation([bool]$Removing) {
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  . (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
  $desktop=Find-Desktop
  if (-not $desktop) { return '' }
  $docker=Join-Path (Split-Path $desktop -Parent) 'resources\bin\docker.exe'
  if (-not (Test-LinuxEngine $docker)) { return '' }
  $script:DockerExe=$docker;$script:SshSession=$null
  $known=@(Get-SimpleKnownInstallations)
  if (-not $known.Count) { return '' }
  Write-Host 'Найдены установки CastLink:'
  for ($i=0;$i -lt $known.Count;$i++) { Write-Host ("{0} — https://{1}, {2}" -f ($i+1),$known[$i].address,$known[$i].folder) }
  $purpose=if ($Removing) { 'удаления' } else { 'обновления' }
  $choice=Read-SimpleValue ("Выбери номер сервера для $purpose; 0 — другая папка / новая установка") '0'
  $index=0
  if (-not [int]::TryParse($choice,[ref]$index) -or $index -lt 0 -or $index -gt $known.Count) { throw 'Нужен номер из показанного списка.' }
  if ($index -eq 0) { return '' }
  return [string]$known[$index-1].folder
}
function Get-SimplePreviousWorkspace {
  $folder=Split-Path (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) -Parent
  if ($folder -and (Test-Path -LiteralPath (Join-Path $folder '.castlink-install.json'))) { return $folder }
  return ''
}
function Get-SimpleRemoteWorkspace([string]$Ip,[int]$Port) {
  $base=if (Test-Path 'D:\') { 'D:\CastLink' } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) 'CastLink' }
  return (Join-Path (Join-Path $base 'Remote') ($Ip+'-'+$Port))
}
function Prepare-SimpleRemoteWorkspace {
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  $candidate=if ($InstallFolder) { $InstallFolder } else { Get-SimplePreviousWorkspace }
  $saved=$null
  if ($candidate -and (Test-Path -LiteralPath (Join-Path $candidate '.castlink-install.json'))) {
    $previous=Get-Content -LiteralPath (Join-Path $candidate '.castlink-install.json') -Raw | ConvertFrom-Json
    if ($previous.target -eq 'remote' -or (-not $previous.PSObject.Properties['target'] -and $previous.publicHttps -eq $true)) { $saved=$previous }
  }
  if (-not $ServerIp) { $ServerIp=Read-SimpleValue 'IPv4 внешнего сервера' $(if ($saved.serverIp) { [string]$saved.serverIp } else { '' }) }
  Assert-SimpleIPv4 $ServerIp
  $ServerIp=[Net.IPAddress]::Parse($ServerIp).ToString()
  if (-not $SshPort) {
    $defaultPort=if ($saved.sshPort) { [int]$saved.sshPort } else { 22 }
    $SshPort=if($SetupMode -eq 'advanced'){Read-SimpleNetworkPort 'SSH порт' $defaultPort}else{$defaultPort}
  }
  if ($SshPort -lt 1 -or $SshPort -gt 65535) { throw 'SSH порт должен быть от 1 до 65535.' }
  if (-not $InstallFolder) {
    if ($saved -and $saved.serverIp -eq $ServerIp -and $saved.sshPort -eq $SshPort) { $InstallFolder=$candidate }
    else { $InstallFolder=Get-SimpleRemoteWorkspace $ServerIp $SshPort }
  }
  $selected=$null
  $path=Join-Path $InstallFolder '.castlink-install.json'
  if (Test-Path -LiteralPath $path) {
    $selected=Get-Content -LiteralPath $path -Raw | ConvertFrom-Json
    Assert-SimpleTarget $selected 'remote' $ServerIp $SshPort
    if (-not $Login -and $selected.sshLogin) { $Login=[string]$selected.sshLogin }
  }
  if (-not $script:SimpleDomainSpecified) {
    $defaultDomain=if ($selected -and $selected.address -ne $ServerIp) { [string]$selected.address } else { '' }
    $domainPrompt=if ($defaultDomain) { 'Домен (Enter — сохранить прежний домен)' } else { 'Домен (необязательно; Enter — доступ по IP)' }
    $Domain=Read-SimpleValue $domainPrompt $defaultDomain
  }
  $Domain=if ([string]::IsNullOrWhiteSpace($Domain)) { $ServerIp } else { $Domain.Trim().ToLowerInvariant() }
  if ($Domain -eq $ServerIp) { Assert-SimplePublicIPv4 $ServerIp } else { Assert-SimpleDomainName $Domain }
  if ($selected -and $selected.address -ne $Domain) { Assert-SimpleDomainChange $selected $Domain }
  if(-not $selected -and -not $script:SimpleTurnDomainSpecified){$TurnDomain=''}else{$TurnDomain=Resolve-SimpleTurnDomain $Domain $ServerIp $selected $TurnDomain $script:SimpleTurnDomainSpecified}
  $script:InstallFolder=$InstallFolder;$script:ServerIp=$ServerIp;$script:SshPort=$SshPort;$script:Login=$Login;$script:Domain=$Domain;$script:TurnDomain=$TurnDomain
  Write-Host ('Данные мастера на этом ПК сохраняются автоматически: '+$InstallFolder)
  Write-Host 'Каталог CastLink на внешнем сервере мастер создаст автоматически.'
}
function Start-SimpleSetup {
  if($Action -in @('choose','install') -and $Target -in @('choose','local')) {
    $pending=Get-SimplePendingSetup $InstallFolder
    if($pending -and -not $InstallFolder) {
      $continue=Read-SimpleValue 'Продолжить незавершённую установку? да/нет' 'да'
      if($continue -notin @('да','д','yes','y')){$pointer=Get-SimpleResumePointerPath;if(Test-Path -LiteralPath $pointer){Remove-Item -LiteralPath $pointer -Force};$pending=$null}
    }
    if($pending) {
      $Action='install';$Target='local';$InstallFolder=[string]$pending.folder
      if(-not $Address){$Address=[string]$pending.address}
      if(-not $script:SimpleSetupSpecified['SkipCertificateTrust']){$SkipCertificateTrust=[bool]$pending.skipCertificateTrust}
      if(-not $script:SimpleSetupSpecified['SkipReserveServers']){$SkipReserveServers=[bool]$pending.skipReserveServers}
      if($pending.PSObject.Properties['setupMode'] -and -not $script:SimpleSetupSpecified['SetupMode']){$SetupMode=[string]$pending.setupMode}
      if($pending.PSObject.Properties['network'] -and -not $NetworkConfiguration){$NetworkConfiguration=$pending.network}
      Write-Host ('Продолжаю сохранённую установку: https://'+$Address+', '+$InstallFolder)
    }
  }
  if ($Action -eq 'choose') {
    do { $choice=Read-Host 'CastLink: 1 — Установить; 2 — Обновить; 3 — Удалить' } while ($choice -notin @('1','2','3'))
    $Action=if ($choice -eq '1') { 'install' } elseif($choice -eq '2') { 'update' } else { 'remove' }
  }
  if ($Target -eq 'choose') {
    do { $prompt=if ($Action -eq 'remove') { 'Где удалить CastLink? 1 — Локально; 2 — Внешний сервер' } elseif($Action -eq 'update') { 'Где обновить CastLink? 1 — Локально; 2 — Внешний сервер' } else { 'Где установить CastLink? 1 — Локально; 2 — Внешний сервер' };$choice=Read-Host $prompt } while ($choice -notin @('1','2'))
    $Target=if ($choice -eq '1') { 'local' } else { 'remote' }
  }
  if ($Target -eq 'remote' -and $Action -eq 'remove') { Start-SimpleRemoteRemoval;return }
  if($Action -eq 'install' -and -not $pending -and -not($InstallFolder -and (Test-Path -LiteralPath (Join-Path $InstallFolder '.castlink-install.json')))){$SetupMode=Read-SimpleSetupMode $SetupMode}
  if($SetupMode -eq 'quick' -and -not $script:SimpleSetupSpecified['SkipReserveServers']){$SkipReserveServers=$true}
  if ($Target -eq 'remote' -and $Action -in @('install','update')) {
    if($Action -eq 'update' -and -not $InstallFolder){$InstallFolder=Read-SimpleValue 'Папка сохранённых данных мастера на этом ПК' (Get-SimplePreviousWorkspace)}
    Prepare-SimpleRemoteWorkspace
    $InstallFolder=$script:InstallFolder;$ServerIp=$script:ServerIp;$SshPort=$script:SshPort;$Login=$script:Login;$Domain=$script:Domain;$TurnDomain=$script:TurnDomain
  }
  if($Target -eq 'local' -and $TurnDomain){throw 'TURN/TLS поддерживается для внешнего сервера с отдельным доменом сайта. Локальная установка не изменена.'}
  if (-not $InstallFolder -and $Target -eq 'local') { $InstallFolder=Select-SimpleLocalInstallation ($Action -eq 'remove') }
  if (-not $InstallFolder) {
    $default=if (Test-Path 'D:\') { 'D:\CastLink' } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) 'CastLink' }
    $previousFolder=Get-SimplePreviousWorkspace
    if ($previousFolder) { $default=$previousFolder }
    $folderPrompt=if ($Target -eq 'remote') { 'Папка сохранённых данных мастера на этом ПК' } else { 'Папка установки и данных мастера' }
    $InstallFolder=Read-SimpleValue $folderPrompt $default
  }
  $InstallFolder=[IO.Path]::GetFullPath($InstallFolder)
  $script:InstallFolder=$InstallFolder
  if ($Action -eq 'remove') { Start-SimpleRemoval;return }
  if($Action -eq 'update' -and -not(Test-Path -LiteralPath (Join-Path $InstallFolder '.castlink-install.json') -PathType Leaf)){
    if($Target -eq 'remote'){throw 'Для обновления VPS выбери прежнюю папку сохранённых данных мастера на этом ПК. Без неё нельзя подтвердить существующую установку; новая установка не начата.'}
    throw 'Для обновления выбери папку существующей установки CastLink. Для новой установки выбери «Установить».'
  }
  if($Target -eq 'local' -and -not $Address){Read-SimpleLocalAddress;$Address=$script:Address}
  if($NetworkConfigPath){
    if($NetworkConfiguration){throw 'Укажи только один источник сетевой конфигурации.'}
    $configurationFile=Get-Item -LiteralPath $NetworkConfigPath -ErrorAction Stop
    if($configurationFile.Length -gt 65536){throw 'Файл сетевой конфигурации превышает 64 КБ.'}
    $NetworkConfiguration=Get-Content -LiteralPath $NetworkConfigPath -Encoding UTF8 -Raw|ConvertFrom-Json
    if($NetworkConfiguration.PSObject.Properties['network']){$NetworkConfiguration=$NetworkConfiguration.network}
    $SetupMode='advanced'
  }
  $options=Read-SimpleSetupOptions $InstallFolder $(if($Target -eq 'remote'){$Domain}else{$Address}) ($Target -eq 'remote') $(if($Target -eq 'remote'){$ServerIp}else{$Address}) $SetupMode $NetworkConfiguration
  $SetupMode=$options.setupMode;$NetworkConfiguration=$options.network
  if($SetupMode -eq 'quick' -and -not $script:SimpleSetupSpecified['SkipReserveServers']){$SkipReserveServers=$true}
  if($Target -eq 'remote' -and $SetupMode -eq 'advanced' -and $NetworkConfiguration.mode -eq 'https' -and -not $script:SimpleTurnDomainSpecified){
    . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
    $selected=$null;$selectedPath=Join-Path $InstallFolder '.castlink-install.json'
    if(Test-Path -LiteralPath $selectedPath){$selected=Get-Content -LiteralPath $selectedPath -Encoding UTF8 -Raw|ConvertFrom-Json}
    $TurnDomain=Resolve-SimpleTurnDomain $Domain $ServerIp $selected $TurnDomain $false
  }
  if($TurnDomain -and $NetworkConfiguration -and ($NetworkConfiguration.mode -ne 'https' -or $NetworkConfiguration.httpPort -ne 80 -or $NetworkConfiguration.httpsPort -ne 443 -or $NetworkConfiguration.bindAddress -ne '0.0.0.0')){throw 'TURN/TLS 443 совместим только с прямым публичным HTTPS, портами 80/443 и привязкой 0.0.0.0.'}
  $script:SimpleNetworkOptions=$NetworkConfiguration;$script:SimpleSetupMode=$SetupMode
  Complete-SimpleInputPhase
  Write-SimpleStage 'Подготовка среды' 1 5
  $folderWasNew=-not(Test-Path -LiteralPath $InstallFolder)
  $null=New-Item -ItemType Directory -Path $InstallFolder -Force
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  if(Get-Command Open-SimpleOwnership -ErrorAction SilentlyContinue){$null=Open-SimpleOwnership $InstallFolder -FolderWasNew:$folderWasNew}
  $installPanelGuard=$null
  try {
  if($Target -eq 'local' -and (Test-Path -LiteralPath (Join-Path $InstallFolder '.castlink-install.json')) -and (Get-Command Enter-SimplePanelUpdateGuard -ErrorAction SilentlyContinue)){
    $existing=Get-Content -LiteralPath (Join-Path $InstallFolder '.castlink-install.json') -Encoding UTF8 -Raw|ConvertFrom-Json
    Assert-SimpleTarget $existing 'local'
    $installPanelGuard=Enter-SimplePanelUpdateGuard $existing.installationId
  }
  if ($Target -eq 'local') { $checkpoint=Read-SimpleSetupCheckpoint $InstallFolder;if($checkpoint){$checkpoint.address=$Address;$checkpoint.skipCertificateTrust=[bool]$SkipCertificateTrust;$checkpoint.skipReserveServers=[bool]$SkipReserveServers;Write-SimpleSetupCheckpoint $checkpoint}else{Save-SimpleSetupCheckpoint $InstallFolder $Address};Prepare-SimpleLocalInstall;$Address=$script:Address;Save-SimpleSetupCheckpoint $InstallFolder $Address 'runtime-ready' }
  Write-SimpleStage 'Загрузка текущего выпуска' 2 5
  $current=Get-SimpleCurrentRelease $InstallFolder
  # Every launch checks GitHub. Continue using the freshly verified current code.
  if (-not $UseDownloadedPayload) {
    $entry=Join-Path $current.folder 'scripts\windows-simple-easy-setup.ps1'
    $forward=@{Action=$Action;Target=$Target;InstallFolder=$InstallFolder;UseDownloadedPayload=$true;SkipCertificateTrust=$SkipCertificateTrust;SkipReserveServers=$SkipReserveServers}
    $downloadedRelease=Get-Content -LiteralPath (Join-Path $current.folder 'payload/release.json') -Encoding UTF8 -Raw|ConvertFrom-Json
    if(@($downloadedRelease.capabilities) -contains 'network-modes-v1'){$forward.SetupMode=$SetupMode;$forward.Language=$Language;if($NetworkConfiguration){$forward.NetworkConfiguration=$NetworkConfiguration}}
    elseif($SetupMode -eq 'advanced' -or $NetworkConfiguration){throw 'Опубликованный пакет пока не поддерживает расширенную установку. Нужен полный выпуск с сетевыми режимами.'}
    if ($Target -eq 'remote') { $forward.Domain=$Domain;$forward.TurnDomain=$TurnDomain;$forward.SshAuthType=$SshAuthType;if($PrivateKeyPath){$forward.PrivateKeyPath=$PrivateKeyPath} }
    foreach ($name in @('Address','ServerIp','Login')) { $value=Get-Variable -Name $name -ValueOnly; if ($value) { $forward[$name]=$value } }
    if ($SshPort) { $forward.SshPort=$SshPort }
    $global:LASTEXITCODE=0
    & $entry @forward
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    return
  }
  $payload=Join-Path $current.folder 'payload'
  $release=Get-Content (Join-Path $payload 'release.json') -Raw | ConvertFrom-Json
  Assert-SimpleTurnPayload $release $TurnDomain
  Write-Host "Устанавливаю CastLink $($release.version) ($($release.commit.Substring(0,6)))"
  Write-SimpleStage 'Развёртывание приложения и базы' 3 5
  . (Join-Path $current.folder 'scripts\simple-easy-setup-deploy.ps1')
  $script:SshSession=$null
  try {
    if ($Target -eq 'local') {
      $script:ServerFolder=$InstallFolder.Replace('\','/')
      $state=New-SimpleConfiguration $InstallFolder $Address $false $release
      if($NetworkConfiguration){Set-SimpleNetworkConfiguration $InstallFolder $state $NetworkConfiguration $SetupMode}else{$state|Add-Member -NotePropertyName setupMode -NotePropertyValue $SetupMode -Force;Save-SimpleState $InstallFolder $state}
      Assert-SimpleTarget $state 'local'
      Set-SimpleTarget $InstallFolder $state 'local'
      Initialize-SimpleRoomCreationPassword $InstallFolder $state
      Write-SimpleConfiguration $InstallFolder $state $release $Address
      $null=Stop-SimpleLegacyMediaForUpdate $InstallFolder $state
      Write-Host 'Загружаю приложение и серверные компоненты из текущего GitHub пакета...'
      Complete-SimpleRuntimeOwnership $InstallFolder $state $release
      Register-SimpleImageLoad $InstallFolder $state $release
      $null=Invoke-DeploymentDocker @('load','--input',(Join-Path $payload 'images.tar.gz')) '' 1800
      Register-SimpleImageLoad $InstallFolder $state $release -AfterLoad
      Complete-SimpleRuntimeOwnership $InstallFolder $state $release
    } else {
      if (-not $ServerIp) { $ServerIp=Read-SimpleValue 'IPv4 Linux VPS' '' }; Assert-SimpleIPv4 $ServerIp
      if (-not $Login) { $Login=Read-SimpleValue 'SSH логин' 'root' }
      if (-not $Domain) { $Domain=$ServerIp }
      if (-not $SshPort) { $SshPort=[int](Read-SimpleValue 'SSH порт' '22') }
      $savedPath=Join-Path $InstallFolder '.castlink-install.json'
      if (Test-Path -LiteralPath $savedPath) { Assert-SimpleTarget (Get-Content -LiteralPath $savedPath -Raw | ConvertFrom-Json) 'remote' $ServerIp $SshPort }
      Prepare-SimpleDotNet $InstallFolder
      . (Join-Path $current.folder 'scripts\simple-easy-setup-ssh.ps1')
      Write-Host 'Скачиваю необходимые SSH модули...'; $null=Install-SimpleSshDependency -ToolsDir (Join-Path $InstallFolder '.tools')
      $script:SshSession=Connect-SimpleInstallerSsh $ServerIp $Login $SshPort (Join-Path $InstallFolder '.tools')
      $check=Invoke-SimpleSshCommand -Client $script:SshSession -Command 'id -u'
      if ($check.code -ne 0 -or $check.stdout.Trim() -ne '0') { throw 'Для автоматической установки используй root SSH логин VPS из панели провайдера.' }
      if ($Domain -ne $ServerIp -and (-not $NetworkConfiguration -or $NetworkConfiguration.mode -eq 'https')) { Test-SimpleDomain $Domain $ServerIp }
      if (Test-Path -LiteralPath $savedPath) {
        $saved=Get-Content -LiteralPath $savedPath -Raw | ConvertFrom-Json
        if ($saved.address -ne $Domain) {
          $script:ServerFolder='/opt/castlink-easy-'+$saved.installationId.Replace('-','')
          $changed=Set-SimpleRemoteDomain $InstallFolder $saved $Domain
          Write-Host ("Домен добавлен к прежнему CastLink: https://"+$changed.address)
          Write-Host 'Комнаты и настройки сохранены. На главной странице создай комнату или войди по её названию.'
          return
        }
      }
      Write-Host 'Проверяю Ubuntu и устанавливаю необходимые Docker компоненты...'
      Start-SimpleRuntimeOwnership $InstallFolder
      $bootstrap=[IO.File]::ReadAllText((Join-Path $current.folder 'scripts\ubuntu-easy-setup-bootstrap.sh'))
      $bootstrap=$bootstrap.Substring(0,$bootstrap.LastIndexOf('if [[ ${BASH_SOURCE'))+"`ncheck_platform`nif ! runtime_ready; then install_runtime; fi`nruntime_ready`n"
      try{$ready=Invoke-SimpleSshCommand -Client $script:SshSession -Command 'bash -s' -Stdin $bootstrap -TimeoutSeconds 1200}finally{Complete-SimpleRuntimeOwnership $InstallFolder}
      if ($ready.code -ne 0) { throw ('Подготовка VPS: '+$ready.stderr) }
      if($SetupMode -eq 'advanced'){$script:SshSession=Add-SimpleGeneratedSshKey $script:SshSession $ServerIp $Login $SshPort (Join-Path $InstallFolder '.tools') (Join-Path $current.folder 'scripts/server-ssh-authorize-key.py')}
      $state=New-SimpleConfiguration $InstallFolder $Domain $true $release $TurnDomain
      if($NetworkConfiguration){Set-SimpleNetworkConfiguration $InstallFolder $state $NetworkConfiguration $SetupMode}else{$state|Add-Member -NotePropertyName setupMode -NotePropertyValue $SetupMode -Force;Save-SimpleState $InstallFolder $state}
      Assert-SimpleTarget $state 'remote' $ServerIp $SshPort
      Set-SimpleTarget $InstallFolder $state 'remote' $ServerIp $Login $SshPort
      $script:ServerFolder='/opt/castlink-easy-'+$state.installationId.Replace('-','')
      Write-Host ('Папка CastLink на внешнем сервере: '+$script:ServerFolder)
      Assert-SimplePortAvailability $state '0.0.0.0' $true
      $quoted=ConvertTo-SimplePosixLiteral $script:ServerFolder
      $mkdir=Invoke-SimpleSshCommand -Client $script:SshSession -Command ("umask 077; mkdir -p -- "+$quoted)
      if ($mkdir.code -ne 0) { throw 'Не удалось создать папку CastLink на VPS.' }
      $linux=Get-SimpleLinuxPackage $current $InstallFolder
      Write-Host 'Передаю Linux пакет на VPS по защищённому SSH соединению...'
      Upload-SimpleSshFile -Client $script:SshSession -LocalFile $linux -RemoteFile ($script:ServerFolder+'/release.tar.gz') -TimeoutSeconds 1800
      $unpack=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('tar -xzf '+$quoted+'/release.tar.gz -C '+$quoted)
      if ($unpack.code -ne 0) { throw 'Не удалось распаковать Linux пакет.' }
      Initialize-SimpleRoomCreationPassword $InstallFolder $state
      Write-SimpleConfiguration $InstallFolder $state $release $ServerIp
      foreach ($file in @('compose.json','postgres.env','web.env','livekit.json','Caddyfile')) { Upload-SimpleSshFile -Client $script:SshSession -LocalFile (Join-Path $InstallFolder $file) -RemoteFile ($script:ServerFolder+'/'+$file) }
      $null=Stop-SimpleLegacyMediaForUpdate $InstallFolder $state
      Complete-SimpleRuntimeOwnership $InstallFolder $state $release
      Register-SimpleImageLoad $InstallFolder $state $release
      $null=Invoke-DeploymentDocker @('load','--input',($script:ServerFolder+'/payload/images.tar.gz')) '' 1800
      Register-SimpleImageLoad $InstallFolder $state $release -AfterLoad
      Complete-SimpleRuntimeOwnership $InstallFolder $state $release
    }
    Write-Host 'Запускаю CastLink из загруженного пакета (Docker Hub не требуется)...'
    $null=Invoke-DeploymentCompose @('up','-d','--pull','never','--no-build') '' 300
    Wait-SimpleWeb
    $homeUrl=Complete-SimpleDeployment $InstallFolder $state
    Write-SimpleStage 'Проверка сайта и готовности' 4 5
    $httpIngress=$state.PSObject.Properties['network'] -and $state.network.mode -in @('http','proxy')
    if ($Target -eq 'local' -and -not $httpIngress) {
      $cid=(Invoke-DeploymentCompose @('ps','-q','caddy')).Trim()
      $cert=Join-Path $InstallFolder 'castlink-local-root.crt'
      $certDeadline=[DateTime]::UtcNow.AddSeconds(60)
      do {
        try { $null=Invoke-DeploymentDocker @('cp',($cid+':/data/caddy/pki/authorities/local/root.crt'),$cert) '' 10; break } catch { if ([DateTime]::UtcNow -ge $certDeadline) { throw }; Start-Sleep -Seconds 2 }
      } while ($true)
      $webCid=(Invoke-DeploymentCompose @('ps','-q','web')).Trim()
      $null=Invoke-DeploymentDocker @('cp',$cert,($webCid+':/tmp/castlink-public-root.crt'))
      $null=Invoke-DeploymentDocker @('cp',$cert,($webCid+':/data/server-origin-ca.pem'))
      Wait-SimpleHttps $state $release '/tmp/castlink-public-root.crt'
      . (Join-Path $current.folder 'scripts/simple-easy-setup-trust.ps1')
      $certificateHost=if($state.PSObject.Properties['network']){([Uri]$state.network.publicOrigin).Authority}else{$state.address}
      $kit=New-SimpleCertificateKit -Folder $InstallFolder -RootCertificate $cert -Address $certificateHost
      Register-SimpleCertificateFiles $InstallFolder $kit
      Write-Host ('Комплект доверия HTTPS для переноса на USB/другой ПК: '+$kit.folder+'. Открой Install-Certificate.cmd на другом Windows-ПК; инструкции для остальных устройств — README.txt.')
      if (-not $SkipCertificateTrust) {
        $yes=Read-SimpleValue 'Добавить сертификат этого CastLink в доверенные для твоего пользователя Windows? да/нет' 'да'
        if ($yes -in @('да','д','yes','y')) {
          $trusted=Install-SimpleLocalTrust $kit.folder
          if(-not $trusted){Write-Host 'Сервер готов, но доверие HTTPS не установлено. Подтверди Windows Security Warning через Install-Certificate.cmd в комплекте и перезапусти браузер.'}
          else{Write-Host 'Сертификат этой установки доверен текущим пользователем Windows. Полностью закрой и снова открой браузер; на другом устройстве установи его собственный комплект.'}
        } else { Write-Host 'Доверие HTTPS пропущено по твоему выбору. Браузер может показывать предупреждение до установки сертификата.' }
      }
      if(-not $state.PSObject.Properties['network']){Write-Host 'Для LAN разреши входящие TCP 443,7881 и UDP 3478,7882,30000-30031 в Windows Firewall. Для публичного IP также пробрось эти порты на роутере.'}
    } elseif($httpIngress) {
      Wait-SimpleNetworkHttp $state $release
      if($state.network.mode -eq 'proxy'){Write-Host 'Внутренний HTTP проверен. Внешний HTTPS-прокси должен быть настроен отдельно; его доступность пока не подтверждена.'}
    } else {
      Wait-SimpleHttps $state $release ''
      if(-not $state.PSObject.Properties['network']){Write-Host 'На VPS/в панели провайдера открой TCP 80,443,7881 и UDP 3478,7882,30000-30031. Caddy автоматически получает и обновляет публичный HTTPS сертификат для выбранного IP или домена.'}
    }
    $homeUrl=Get-SimpleHomeUrl $state
    if($state.PSObject.Properties['network']){Write-SimpleNetworkSummary $state}
    Write-Host ("`nCastLink установлен: "+$homeUrl)
    Write-Host 'На главной странице создай комнату или войди по её названию.'
    Write-Host 'Пароль студии сохраняет доступ создателя к своей комнате; гостевой пароль нужен только для входа гостей.'
    if($state.PSObject.Properties['turnDomain'] -and $state.turnDomain){Write-Host ('Настроены TURN/UDP и TURN/TLS на TCP 443: '+$state.turnDomain+'. Работу через конкретную корпоративную сеть или VPN проверь отдельным медиаподключением.')}elseif(-not $state.PSObject.Properties['network']){Write-Host 'Настроен TURN/UDP на UDP 3478 с диапазоном ретрансляции 30000-30031. Для сетей, блокирующих UDP, можно дополнительно включить TURN/TLS на TCP 443 с отдельным доменом.'}
    if(-not $SkipReserveServers){
      . (Join-Path $current.folder 'scripts/simple-easy-setup-reserves.ps1')
      Add-SimpleReserveServers $InstallFolder $state
    }
    if($Target -eq 'local'){
      $state|Add-Member -NotePropertyName version -NotePropertyValue ([string]$release.version) -Force
      $state|Add-Member -NotePropertyName commit -NotePropertyValue ([string]$release.commit) -Force
      Save-SimpleState $InstallFolder $state
      $control=Install-SimpleLocalControl $InstallFolder $state (Join-Path $current.folder 'scripts')
      Complete-SimpleSetupCheckpoint $InstallFolder
      Write-SimpleStage 'Завершение установки: передача управления панели' 5 5
      Write-Host 'Проверки завершены. Службы продолжают работать; управление передаётся панели CastLink.'
      $global:SimpleGuiControlFolder=[IO.Path]::GetFullPath($InstallFolder)
      Write-Host ('CastLink установлен: '+$homeUrl)
      if($control.desktop){Write-Host 'Ярлык CastLink на рабочем столе открывает панель и сайт. Закрытие окна скрывает панель в трей; службы продолжают работать. Кнопка «Остановить службы» останавливает только этот CastLink, данные сохраняются.'}

    }
    Write-SimpleStage 'Установка завершена' 5 5 -Completed
  } finally { if ($script:SshSession) { Disconnect-SimpleSsh -Client $script:SshSession } }
  } finally {try{if(Get-Command Update-SimpleOwnership -ErrorAction SilentlyContinue){$null=Update-SimpleOwnership $InstallFolder $state}}finally{if($installPanelGuard){Exit-SimpleControlGuard $installPanelGuard}}}
}
if (-not $FunctionsOnly) {
  try { Start-SimpleSetup } catch { if($global:SimpleGuiBackRequested){return};Write-Host ('Установка остановлена: '+$_.Exception.Message);if($_.Exception.Data['SimpleSetupRestartRequired']){exit 3010};exit 1 }
}
