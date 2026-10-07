param(
  [ValidateSet('choose','local','remote')][string]$Target='choose',
  [string]$InstallFolder='',
  [string]$Address='',
  [string]$ServerIp='',
  [string]$Login='',
  [string]$Domain='',
  [int]$SshPort=0,
  [switch]$SkipCertificateTrust,
  [switch]$FunctionsOnly,
  [switch]$UseDownloadedPayload
)
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
function Read-SimpleValue([string]$Prompt,[string]$Default) {
  $value=Read-Host "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }; return $value.Trim()
}
function Get-SimpleIPv4 {
  $preferred=@(Get-NetIPConfiguration -ErrorAction SilentlyContinue | Where-Object { $_.IPv4DefaultGateway } | ForEach-Object { $_.IPv4Address.IPAddress })
  $all=@(Get-NetIPAddress -AddressFamily IPv4 -ErrorAction SilentlyContinue | Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '169.254.*' -and $_.AddressState -eq 'Preferred' } | Select-Object -ExpandProperty IPAddress)
  return @(($preferred+$all) | Select-Object -Unique)
}
function Assert-SimpleIPv4([string]$Value) {
  $parsed=$null
  if ($Value -notmatch '^\d{1,3}(\.\d{1,3}){3}$' -or -not [Net.IPAddress]::TryParse($Value,[ref]$parsed) -or $parsed.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork) { throw 'Нужен IPv4 адрес, например 192.168.1.10.' }
}
function Get-SimpleCurrentRelease([string]$Folder) {
  Write-Host 'Проверяю текущую версию CastLink на GitHub...'
  $headers=@{'User-Agent'='CastLink-EasySetup';Accept='application/vnd.github+json'}
  $release=Invoke-RestMethod -Uri 'https://api.github.com/repos/resokol/studiolink/releases/latest' -Headers $headers
  $asset=@($release.assets | Where-Object { $_.name -eq 'CastLink-Windows.zip' })
  $sums=@($release.assets | Where-Object { $_.name -eq 'SHA256SUMS' })
  if ($asset.Count -ne 1 -or $sums.Count -ne 1) { throw 'У текущего GitHub Release пока нет полного Windows пакета. Установка не изменена.' }
  $cache=Join-Path $Folder '.downloads'; $null=New-Item -ItemType Directory -Path $cache -Force
  $sumFile=Join-Path $cache 'SHA256SUMS'
  Invoke-WebRequest -UseBasicParsing -Uri $sums[0].browser_download_url -OutFile $sumFile -Headers $headers
  $line=@(Get-Content -LiteralPath $sumFile | Where-Object { $_ -match '^[a-f0-9]{64}  CastLink-Windows\.zip$' })
  if ($line.Count -ne 1) { throw 'В Release отсутствует SHA256 Windows пакета.' }
  $expected=$line[0].Substring(0,64); $zip=Join-Path $cache ($expected+'.zip')
  if (-not (Test-Path $zip) -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) {
    Write-Host 'Скачиваю текущий Windows пакет. Это может занять несколько минут...'
    Invoke-WebRequest -UseBasicParsing -Uri $asset[0].browser_download_url -OutFile $zip -Headers $headers
  }
  if ((Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -ne $expected) { throw 'SHA256 загруженного пакета не совпал. Повтори загрузку.' }
  $payload=Join-Path $cache $expected
  if (-not (Test-Path (Join-Path $payload 'payload\release.json'))) { Expand-Archive -LiteralPath $zip -DestinationPath $payload -Force }
  return [pscustomobject]@{folder=$payload;release=$release;sums=$sumFile}
}
function Get-SimpleLinuxPackage([object]$Current,[string]$Folder) {
  $asset=@($Current.release.assets | Where-Object { $_.name -eq 'CastLink-Linux.tar.gz' })
  $line=@(Get-Content -LiteralPath $Current.sums | Where-Object { $_ -match '^[a-f0-9]{64}  CastLink-Linux\.tar\.gz$' })
  if ($asset.Count -ne 1 -or $line.Count -ne 1) { throw 'В текущем Release нет полного Linux пакета.' }
  $file=Join-Path $Folder '.downloads\CastLink-Linux.tar.gz'
  Write-Host 'Скачиваю текущий Linux пакет для VPS...'
  Invoke-WebRequest -UseBasicParsing $asset[0].browser_download_url -OutFile $file -Headers @{'User-Agent'='CastLink-EasySetup'}
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
function Test-SimpleDomain([string]$Name,[string]$Ip) {
  if ($Name -notmatch '^(?=.{1,253}$)([a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,63}$') { throw 'Введи домен без https:// и пути, например meet.example.com.' }
  do {
    $addresses=@(Resolve-DnsName -Name $Name -Type A -ErrorAction SilentlyContinue | Where-Object { $_.Type -eq 'A' } | Select-Object -ExpandProperty IPAddress)
    if ($addresses -contains $Ip) { return }
    Write-Host "В панели DNS добавь A-запись: $Name -> $Ip. HTTPS появится после обновления DNS."
    $null=Read-Host 'Нажми Enter после изменения DNS, чтобы проверить снова (Ctrl+C — выход)'
  } while ($true)
}
function Prepare-SimpleDotNet([string]$Folder) {
  $framework=(Get-ItemProperty 'HKLM:\SOFTWARE\Microsoft\NET Framework Setup\NDP\v4\Full' -Name Release -ErrorAction SilentlyContinue).Release
  if ($framework -ge 528040) { return }
  $yes=Read-Host 'Для SSH нужен .NET Framework 4.8. Скачать и установить официальный компонент Microsoft? [да/нет]'
  if ($yes -notin @('да','д','yes','y')) { throw 'Установка SSH компонента отменена.' }
  $file=Join-Path $Folder 'net-framework-4.8.exe'
  Invoke-WebRequest -UseBasicParsing 'https://go.microsoft.com/fwlink/?linkid=2088631' -OutFile $file
  $signature=Get-AuthenticodeSignature $file
  if ($signature.Status -ne 'Valid' -or $signature.SignerCertificate.Subject -notmatch 'Microsoft') { throw 'Подпись .NET установщика не подтверждена.' }
  $install=Start-Process $file -Verb RunAs -ArgumentList '/passive /norestart' -Wait -PassThru
  if ($install.ExitCode -in @(3010,1641)) { throw '.NET установлен. Перезагрузи Windows и продолжи мастер с той же папкой.' }
  if ($install.ExitCode -ne 0) { throw '.NET установщик не завершился успешно.' }
}
function Wait-SimpleHttps([object]$State,[object]$Release,[string]$CaFile) {
  Write-Host 'Проверяю HTTPS и версию приложения...'
  $verify='const https=require("node:https"),fs=require("node:fs");const options={timeout:10000,lookup:(host,opts,callback)=>require("node:dns").lookup("caddy",opts,callback)};if(process.argv[3])options.ca=fs.readFileSync(process.argv[3]);const q=https.get(process.argv[1]+"/api/version",options,r=>{let b="";r.on("data",x=>b+=x);r.on("end",()=>{try{const j=JSON.parse(b);process.exit(r.statusCode===200&&j.buildId===process.argv[2]?0:1)}catch{process.exit(1)}})});q.on("error",()=>process.exit(1));q.on("timeout",()=>q.destroy());'
  $deadline=[DateTime]::UtcNow.AddSeconds(180)
  do {
    try {
      $null=Invoke-DeploymentCompose @('exec','-T','web','node','-e',$verify,('https://'+$State.address),($Release.version+'-'+$Release.commit.Substring(0,12)),$CaFile) '' 15
      return
    } catch { Start-Sleep -Seconds 3 }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'HTTPS ещё не готов. Проверь DNS и входящие TCP80/443 (VPS), либо выбранный IP и Windows Firewall (LAN). Данные сохранены; повтори тот же мастер.'
}
function Start-SimpleSetup {
  if (-not $InstallFolder) {
    $default=if (Test-Path 'D:\') { 'D:\CastLink' } else { Join-Path ([Environment]::GetFolderPath('UserProfile')) 'CastLink' }
    $InstallFolder=Read-SimpleValue 'Папка установки и данных мастера' $default
  }
  $InstallFolder=[IO.Path]::GetFullPath($InstallFolder)
  $null=New-Item -ItemType Directory -Path $InstallFolder -Force
  $script:InstallFolder=$InstallFolder
  if ($Target -eq 'choose') {
    do { $choice=Read-Host 'Где установить CastLink? 1 — на этом ПК; 2 — на Linux VPS' } while ($choice -notin @('1','2'))
    $Target=if ($choice -eq '1') { 'local' } else { 'remote' }
  }
  $current=Get-SimpleCurrentRelease $InstallFolder
  # Every launch checks GitHub. Continue using the freshly verified current code.
  if (-not $UseDownloadedPayload) {
    $entry=Join-Path $current.folder 'scripts\windows-simple-easy-setup.ps1'
    $forward=@{Target=$Target;InstallFolder=$InstallFolder;UseDownloadedPayload=$true;SkipCertificateTrust=$SkipCertificateTrust}
    foreach ($name in @('Address','ServerIp','Login','Domain')) { $value=Get-Variable -Name $name -ValueOnly; if ($value) { $forward[$name]=$value } }
    if ($SshPort) { $forward.SshPort=$SshPort }
    & $entry @forward
    return
  }
  $payload=Join-Path $current.folder 'payload'
  $release=Get-Content (Join-Path $payload 'release.json') -Raw | ConvertFrom-Json
  Write-Host "Устанавливаю CastLink $($release.version) ($($release.commit.Substring(0,12)))"
  . (Join-Path $current.folder 'scripts\simple-easy-setup-deploy.ps1')
  $script:SshSession=$null
  try {
    if ($Target -eq 'local') {
      $ips=@(Get-SimpleIPv4)
      Write-Host ('Адреса этого ПК: '+($ips -join ', '))
      Write-Host 'Для локальной сети выбери LAN адрес. Для доступа извне укажи публичный IPv4 и настрой проброс портов на роутере. Можно использовать 127.0.0.1 только для этого ПК.'
      if (-not $Address) {
        do { $access=Read-Host 'Доступ: 1 — локальная сеть (LAN); 2 — публичный IPv4; 3 — только этот ПК' } while ($access -notin @('1','2','3'))
        $default=if ($ips.Count) { $ips[0] } else { '127.0.0.1' }
        if ($access -eq '2') {
          try { $default=(Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 8).Trim() } catch { $default='' }
          Write-Host 'Обнаруженный внешний адрес может принадлежать NAT провайдера. Для внешнего доступа нужен собственный публичный адрес и доступные входящие порты.'
        }
        if ($access -eq '3') { $default='127.0.0.1' }
        $Address=Read-SimpleValue 'IPv4 для CastLink (можно изменить)' $default
      }
      Assert-SimpleIPv4 $Address
      . (Join-Path $current.folder 'scripts\simple-easy-setup-runtime.ps1')
      Prepare-LocalRuntime
      $desktop=Find-Desktop; $script:DockerExe=Join-Path (Split-Path $desktop -Parent) 'resources\bin\docker.exe'
      $script:ServerFolder=$InstallFolder.Replace('\','/')
      $state=New-SimpleConfiguration $InstallFolder $Address $false $release
      Write-SimpleConfiguration $InstallFolder $state $release $Address
      Write-Host 'Загружаю текущий образ приложения в Docker...'
      $null=Invoke-DeploymentDocker @('load','--input',(Join-Path $payload 'web-image.tar.gz')) '' 1800
    } else {
      if (-not $ServerIp) { $ServerIp=Read-SimpleValue 'IPv4 Linux VPS' '' }; Assert-SimpleIPv4 $ServerIp
      if (-not $Login) { $Login=Read-SimpleValue 'SSH логин' 'root' }
      if (-not $Domain) { $Domain=Read-SimpleValue 'Домен CastLink' '' }
      if (-not $SshPort) { $SshPort=[int](Read-SimpleValue 'SSH порт' '22') }
      Prepare-SimpleDotNet $InstallFolder
      $password=Read-Host 'SSH пароль (не сохраняется)' -AsSecureString
      . (Join-Path $current.folder 'scripts\simple-easy-setup-ssh.ps1')
      Write-Host 'Скачиваю необходимые SSH модули...'; $null=Install-SimpleSshDependency -ToolsDir (Join-Path $InstallFolder '.tools')
      $script:SshSession=Connect-SimpleSsh -HostName $ServerIp -Login $Login -Password $password -Port $SshPort -ToolsDir (Join-Path $InstallFolder '.tools')
      $password.Dispose(); $password=$null
      $check=Invoke-SimpleSshCommand -Client $script:SshSession -Command 'id -u'
      if ($check.code -ne 0 -or $check.stdout.Trim() -ne '0') { throw 'Для автоматической установки используй root SSH логин VPS из панели провайдера.' }
      Test-SimpleDomain $Domain $ServerIp
      Write-Host 'Проверяю Ubuntu и устанавливаю необходимые Docker компоненты...'
      $bootstrap=[IO.File]::ReadAllText((Join-Path $current.folder 'scripts\ubuntu-easy-setup-bootstrap.sh'))
      $bootstrap=$bootstrap.Substring(0,$bootstrap.LastIndexOf('if [[ ${BASH_SOURCE'))+"`ncheck_platform`nif ! runtime_ready; then install_runtime; fi`nruntime_ready`n"
      $ready=Invoke-SimpleSshCommand -Client $script:SshSession -Command 'bash -s' -Stdin $bootstrap -TimeoutSeconds 1200
      if ($ready.code -ne 0) { throw ('Подготовка VPS: '+$ready.stderr) }
      $state=New-SimpleConfiguration $InstallFolder $Domain $true $release
      $script:ServerFolder='/opt/castlink-easy-'+$state.installationId.Replace('-','')
      $quoted=ConvertTo-SimplePosixLiteral $script:ServerFolder
      $mkdir=Invoke-SimpleSshCommand -Client $script:SshSession -Command ("umask 077; mkdir -p -- "+$quoted)
      if ($mkdir.code -ne 0) { throw 'Не удалось создать папку CastLink на VPS.' }
      $linux=Get-SimpleLinuxPackage $current $InstallFolder
      Write-Host 'Передаю Linux пакет на VPS по защищённому SSH соединению...'
      Upload-SimpleSshFile -Client $script:SshSession -LocalFile $linux -RemoteFile ($script:ServerFolder+'/release.tar.gz') -TimeoutSeconds 1800
      $unpack=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('tar -xzf '+$quoted+'/release.tar.gz -C '+$quoted)
      if ($unpack.code -ne 0) { throw 'Не удалось распаковать Linux пакет.' }
      Write-SimpleConfiguration $InstallFolder $state $release $ServerIp
      foreach ($file in @('compose.json','postgres.env','web.env','livekit.json','Caddyfile')) { Upload-SimpleSshFile -Client $script:SshSession -LocalFile (Join-Path $InstallFolder $file) -RemoteFile ($script:ServerFolder+'/'+$file) }
      $null=Invoke-DeploymentDocker @('load','--input',($script:ServerFolder+'/payload/web-image.tar.gz')) '' 1800
    }
    Write-Host 'Скачиваю общедоступные серверные компоненты и запускаю CastLink...'
    $null=Invoke-DeploymentCompose @('pull','postgres','livekit','caddy') '' 1800
    $null=Invoke-DeploymentCompose @('up','-d','--pull','never','--no-build') '' 300
    Wait-SimpleWeb
    $ownerUrl=Complete-SimpleDeployment $InstallFolder $state
    if ($Target -eq 'local') {
      $cid=(Invoke-DeploymentCompose @('ps','-q','caddy')).Trim()
      $cert=Join-Path $InstallFolder 'castlink-local-root.crt'
      $certDeadline=[DateTime]::UtcNow.AddSeconds(60)
      do {
        try { $null=Invoke-DeploymentDocker @('cp',($cid+':/data/caddy/pki/authorities/local/root.crt'),$cert) '' 10; break } catch { if ([DateTime]::UtcNow -ge $certDeadline) { throw }; Start-Sleep -Seconds 2 }
      } while ($true)
      $webCid=(Invoke-DeploymentCompose @('ps','-q','web')).Trim()
      $null=Invoke-DeploymentDocker @('cp',$cert,($webCid+':/tmp/castlink-public-root.crt'))
      Wait-SimpleHttps $state $release '/tmp/castlink-public-root.crt'
      Write-Host "Локальный HTTPS сертификат: $cert. Другим устройствам LAN нужно доверить этот сертификат."
      if (-not $SkipCertificateTrust) {
        $yes=Read-Host 'Добавить сертификат этого CastLink в доверенные для твоего пользователя Windows? [да/нет]'
        if ($yes -in @('да','д','yes','y')) { $null=Import-Certificate -FilePath $cert -CertStoreLocation 'Cert:\CurrentUser\Root' }
      }
      Write-Host 'Для LAN разреши входящие TCP 443,7881 и UDP 61000-61100 в Windows Firewall. Для публичного IP также пробрось эти порты на роутере.'
    } else {
      Wait-SimpleHttps $state $release ''
      Write-Host 'На VPS/в панели провайдера открой TCP 80,443,7881 и UDP 61000-61100. Caddy автоматически получает HTTPS сертификат для домена.'
    }
    Write-Host "`nCastLink установлен: https://$($state.address)"
    Write-Host "Вход владельца (действует 15 минут): $ownerUrl"
    Write-Host "Ссылка также сохранена в $InstallFolder\owner-access.txt. Открой её сейчас. Для новой ссылки снова запусти этот мастер с той же папкой и адресом."
    Write-Host 'Прямое аудио/видео требует доступных указанных портов. TURN в этой версии мастера не настроен.'
  } finally { if ($script:SshSession) { Disconnect-SimpleSsh -Client $script:SshSession } }
}
if (-not $FunctionsOnly) {
  try { Start-SimpleSetup } catch { Write-Host ('Установка остановлена: '+$_.Exception.Message); exit 1 }
}
