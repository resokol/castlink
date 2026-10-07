param(
  [ValidateSet('choose','local','remote')][string]$Target='choose',
  [ValidateSet('choose','install','remove')][string]$Action='choose',
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
$script:SimpleDomainSpecified=$PSBoundParameters.ContainsKey('Domain')
$ErrorActionPreference='Stop'
$ProgressPreference='SilentlyContinue'
[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
function Write-SimpleStage([string]$Name,[int]$Position,[int]$Total,[switch]$Completed) {
  $status="Этап $Position/$Total — $Name";Write-Host $status
  $ProgressPreference='Continue'
  $percent=if($Completed){100}else{[int](100*($Position-1)/$Total)}
  Write-Progress -Id 73 -Activity 'CastLink' -Status $status -PercentComplete $percent -Completed:$Completed
}
function Read-SimpleValue([string]$Prompt,[string]$Default) {
  $value=Read-Host "$Prompt [$Default]"
  if ([string]::IsNullOrWhiteSpace($value)) { return $Default }; return $value.Trim()
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
function Get-SimpleCurrentRelease([string]$Folder) {
  Write-Host 'Проверяю текущую версию CastLink на GitHub...'
  $headers=@{'User-Agent'='CastLink-EasySetup'}
  # Browser release redirects work without API DNS/auth/rate-limit dependencies.
  $latest=Invoke-WebRequest -UseBasicParsing -Method Head -Uri 'https://github.com/resokol/studiolink/releases/latest' -Headers $headers -TimeoutSec 30
  $resolved=$latest.BaseResponse.ResponseUri
  $tagMatch=[regex]::Match($resolved.AbsolutePath,'^/resokol/studiolink/releases/tag/([a-zA-Z0-9._-]+)$')
  if ($resolved.Scheme -ne 'https' -or $resolved.Host -ne 'github.com' -or -not $tagMatch.Success) { throw 'GitHub не вернул текущий Release CastLink. Установка не изменена.' }
  $tag=$tagMatch.Groups[1].Value
  $base='https://github.com/resokol/studiolink/releases/download/'+[Uri]::EscapeDataString($tag)+'/'
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
  $launcher=@'
@echo off
chcp 65001 >nul
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "%~dp0.downloads\{0}\scripts\windows-simple-easy-setup.ps1"
pause
'@ -f $expected
  if(Get-Command Write-SimpleOwnedLauncher -ErrorAction SilentlyContinue){Write-SimpleOwnedLauncher $Folder ($launcher.Replace("`r`n","`n").Replace("`n","`r`n"))}else{[IO.File]::WriteAllText((Join-Path $Folder 'EasySetup.cmd'),$launcher.Replace("`r`n","`n").Replace("`n","`r`n"),(New-Object Text.UTF8Encoding($false)))}
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
function Test-SimpleDomain([string]$Name,[string]$Ip) {
  Assert-SimpleDomainName $Name
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
  if(Get-Command Register-SimpleSharedComponent -ErrorAction SilentlyContinue){Register-SimpleSharedComponent 'NET-Framework-4.8' 'installation-requested'}
  $file=Join-Path $Folder 'net-framework-4.8.exe'
  Invoke-WebRequest -UseBasicParsing 'https://go.microsoft.com/fwlink/?linkid=2088631' -OutFile $file
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
      $null=Invoke-DeploymentCompose @('exec','-T','web','node','-e',$verify,('https://'+$State.address),$ExpectedBuildId,$CaFile) '' 15
      return
    } catch { Start-Sleep -Seconds 3 }
  } while ([DateTime]::UtcNow -lt $deadline)
  throw 'HTTPS ещё не готов. Проверь DNS и входящие TCP80/443 (VPS), либо выбранный IP и Windows Firewall (LAN). Данные сохранены; повтори тот же мастер.'
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
  $workspaceWasNew=-not(Test-Path -LiteralPath $workspace)
  $null=New-Item -ItemType Directory -Path $workspace -Force
  $null=Open-SimpleOwnership $workspace -FolderWasNew:$workspaceWasNew
  try {
  Prepare-SimpleDotNet $workspace
  . (Join-Path $PSScriptRoot 'simple-easy-setup-ssh.ps1')
  $null=Install-SimpleSshDependency -ToolsDir (Join-Path $workspace '.tools')
  $password=Read-Host 'SSH пароль (не сохраняется)' -AsSecureString
  try { $script:SshSession=Connect-SimpleSsh -HostName $ServerIp -Login $Login -Password $password -Port $SshPort -ToolsDir (Join-Path $workspace '.tools') } finally { $password.Dispose() }
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
  try {
    if ($Target -eq 'local') {
      . (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
      $desktop=Find-Desktop
      if (-not $desktop) { throw 'Docker Desktop не установлен. Удаление не выполнено; данные сохранены.' }
      # Only start an existing installation; never enter the dependency installer.
      $gui=@(Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)
      if (-not $gui.Count) { Start-Process -FilePath $desktop | Out-Null }
      $script:DockerExe=Join-Path (Split-Path $desktop -Parent) 'resources\bin\docker.exe'
      $script:ServerFolder=$InstallFolder.Replace('\','/')
      $deadline=[DateTime]::UtcNow.AddSeconds(120)
      do { $info=Invoke-SimpleProcess $script:DockerExe @('--context','desktop-linux','info','--format','{{.OSType}}') '' 10;if ($info.code -eq 0 -and $info.stdout.Trim() -eq 'linux') { break };Start-Sleep -Seconds 2 } while ([DateTime]::UtcNow -lt $deadline)
      if ($info.code -ne 0 -or $info.stdout.Trim() -ne 'linux') { throw 'Docker Linux engine недоступен. Удаление не выполнено.' }
    } else {
      . (Join-Path $PSScriptRoot 'simple-easy-setup-ssh.ps1')
      # Reuse already downloaded modules; removal never downloads installers.
      Import-SimpleSshDependency -ToolsDir (Join-Path $InstallFolder '.tools')
      $password=Read-Host 'SSH пароль (не сохраняется)' -AsSecureString
      try { $script:SshSession=Connect-SimpleSsh -HostName $ServerIp -Login $Login -Password $password -Port $SshPort -ToolsDir (Join-Path $InstallFolder '.tools') } finally { $password.Dispose() }
      $script:ServerFolder='/opt/'+$project
    }
    $null=Remove-SimpleDeployment $InstallFolder $state -Confirmed -DeleteData:($mode -eq '2')
    if ($mode -eq '1') { Write-Host 'Сервер CastLink удалён; комнаты, данные и пароли сохранены. Для восстановления выбери установку в ту же папку.' } else { Write-Host 'Службы, комнаты и настройки удалены. Причины сохранения общих компонентов и статус отложенной очистки файлов показаны выше.' }
  } finally { if ($script:SshSession) { Disconnect-SimpleSsh $script:SshSession } }
}
function Prepare-SimpleLocalInstall {
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  $script:SshSession=$null
      $saved=$null;$savedPath=Join-Path $InstallFolder '.castlink-install.json'
      if (Test-Path -LiteralPath $savedPath) { $saved=Get-Content -LiteralPath $savedPath -Raw | ConvertFrom-Json;Assert-SimpleTarget $saved 'local';if (-not $Address) { $Address=$saved.address;Write-Host ('Прежняя установка: https://'+$Address) } }
      $ips=@(Get-SimpleIPv4)
      Write-Host ('Адреса этого ПК: '+($ips -join ', '))
      Write-Host 'Для локальной сети выбери LAN адрес. Для доступа извне укажи публичный IPv4 и настрой проброс портов на роутере. Можно использовать 127.0.0.1 только для этого ПК.'
      if (-not $Address) {
        do { $access=Read-Host 'Доступ: 1 — LAN, другие устройства этой сети; 2 — публичный IPv4 через роутер; 3 — localhost, только этот ПК' } while ($access -notin @('1','2','3'))
        $default=if ($ips.Count) { $ips[0] } else { '127.0.0.1' }
        if ($access -eq '2') {
          try { $default=(Invoke-RestMethod -Uri 'https://api.ipify.org' -TimeoutSec 8).Trim() } catch { $default='' }
          Write-Host 'Обнаруженный внешний адрес может принадлежать NAT провайдера. Для внешнего доступа нужен собственный публичный адрес и доступные входящие порты.'
        }
        if ($access -eq '3') { $default='127.0.0.1' }
        $Address=Read-SimpleValue 'IPv4 для CastLink (можно изменить)' $default
      }
      Assert-SimpleIPv4 $Address
      if ($saved -and $saved.address -ne $Address) { throw 'В этой папке уже настроен другой адрес. Выбери прежний адрес или новую папку.' }
      $savedPath=Join-Path $InstallFolder '.castlink-install.json'
      if (Test-Path -LiteralPath $savedPath) { Assert-SimpleTarget (Get-Content -LiteralPath $savedPath -Raw | ConvertFrom-Json) 'local' }
      . (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
      Start-SimpleRuntimeOwnership $InstallFolder
      try{$null=Prepare-LocalRuntime}finally{Complete-SimpleRuntimeOwnership $InstallFolder}
      $desktop=Find-Desktop; $script:DockerExe=Join-Path (Split-Path $desktop -Parent) 'resources\bin\docker.exe'
      $script:ServerFolder=$InstallFolder.Replace('\','/')
      Assert-SimplePortAvailability $saved $Address $false
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
  if (-not $SshPort) { $SshPort=[int](Read-SimpleValue 'SSH порт' $(if ($saved.sshPort) { [string]$saved.sshPort } else { '22' })) }
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
  $script:InstallFolder=$InstallFolder;$script:ServerIp=$ServerIp;$script:SshPort=$SshPort;$script:Login=$Login;$script:Domain=$Domain
  Write-Host ('Данные мастера на этом ПК сохраняются автоматически: '+$InstallFolder)
  Write-Host 'Каталог CastLink на внешнем сервере мастер создаст автоматически.'
}
function Start-SimpleSetup {
  if ($Action -eq 'choose') {
    do { $choice=Read-Host 'CastLink: 1 — установить / обновить; 2 — удалить' } while ($choice -notin @('1','2'))
    $Action=if ($choice -eq '1') { 'install' } else { 'remove' }
  }
  if ($Target -eq 'choose') {
    do { $prompt=if ($Action -eq 'remove') { 'Где удалить CastLink? 1 — Локально; 2 — Внешний сервер' } else { 'Где установить CastLink? 1 — Локально; 2 — Внешний сервер' };$choice=Read-Host $prompt } while ($choice -notin @('1','2'))
    $Target=if ($choice -eq '1') { 'local' } else { 'remote' }
  }
  if ($Target -eq 'remote' -and $Action -eq 'remove') { Start-SimpleRemoteRemoval;return }
  if ($Target -eq 'remote' -and $Action -eq 'install') {
    Prepare-SimpleRemoteWorkspace
    $InstallFolder=$script:InstallFolder;$ServerIp=$script:ServerIp;$SshPort=$script:SshPort;$Login=$script:Login;$Domain=$script:Domain
  }
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
  Write-SimpleStage 'Подготовка среды' 1 5
  $folderWasNew=-not(Test-Path -LiteralPath $InstallFolder)
  $null=New-Item -ItemType Directory -Path $InstallFolder -Force
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  if(Get-Command Open-SimpleOwnership -ErrorAction SilentlyContinue){$null=Open-SimpleOwnership $InstallFolder -FolderWasNew:$folderWasNew}
  try {
  if ($Target -eq 'local') { Prepare-SimpleLocalInstall;$Address=$script:Address }
  Write-SimpleStage 'Загрузка текущего выпуска' 2 5
  $current=Get-SimpleCurrentRelease $InstallFolder
  # Every launch checks GitHub. Continue using the freshly verified current code.
  if (-not $UseDownloadedPayload) {
    $entry=Join-Path $current.folder 'scripts\windows-simple-easy-setup.ps1'
    $forward=@{Action='install';Target=$Target;InstallFolder=$InstallFolder;UseDownloadedPayload=$true;SkipCertificateTrust=$SkipCertificateTrust}
    if ($Target -eq 'remote') { $forward.Domain=$Domain }
    foreach ($name in @('Address','ServerIp','Login')) { $value=Get-Variable -Name $name -ValueOnly; if ($value) { $forward[$name]=$value } }
    if ($SshPort) { $forward.SshPort=$SshPort }
    $global:LASTEXITCODE=0
    & $entry @forward
    if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
    return
  }
  $payload=Join-Path $current.folder 'payload'
  $release=Get-Content (Join-Path $payload 'release.json') -Raw | ConvertFrom-Json
  Write-Host "Устанавливаю CastLink $($release.version) ($($release.commit.Substring(0,12)))"
  Write-SimpleStage 'Развёртывание приложения и базы' 3 5
  . (Join-Path $current.folder 'scripts\simple-easy-setup-deploy.ps1')
  $script:SshSession=$null
  try {
    if ($Target -eq 'local') {
      $script:ServerFolder=$InstallFolder.Replace('\','/')
      $state=New-SimpleConfiguration $InstallFolder $Address $false $release
      Assert-SimpleTarget $state 'local'
      Set-SimpleTarget $InstallFolder $state 'local'
      Write-SimpleConfiguration $InstallFolder $state $release $Address
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
      $password=Read-Host 'SSH пароль (не сохраняется)' -AsSecureString
      . (Join-Path $current.folder 'scripts\simple-easy-setup-ssh.ps1')
      Write-Host 'Скачиваю необходимые SSH модули...'; $null=Install-SimpleSshDependency -ToolsDir (Join-Path $InstallFolder '.tools')
      $script:SshSession=Connect-SimpleSsh -HostName $ServerIp -Login $Login -Password $password -Port $SshPort -ToolsDir (Join-Path $InstallFolder '.tools')
      $password.Dispose(); $password=$null
      $check=Invoke-SimpleSshCommand -Client $script:SshSession -Command 'id -u'
      if ($check.code -ne 0 -or $check.stdout.Trim() -ne '0') { throw 'Для автоматической установки используй root SSH логин VPS из панели провайдера.' }
      if ($Domain -ne $ServerIp) { Test-SimpleDomain $Domain $ServerIp }
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
      $state=New-SimpleConfiguration $InstallFolder $Domain $true $release
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
      Write-SimpleConfiguration $InstallFolder $state $release $ServerIp
      foreach ($file in @('compose.json','postgres.env','web.env','livekit.json','Caddyfile')) { Upload-SimpleSshFile -Client $script:SshSession -LocalFile (Join-Path $InstallFolder $file) -RemoteFile ($script:ServerFolder+'/'+$file) }
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
    Write-SimpleStage 'Проверка HTTPS и готовности' 4 5
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
      . (Join-Path $current.folder 'scripts/simple-easy-setup-trust.ps1')
      $kit=New-SimpleCertificateKit -Folder $InstallFolder -RootCertificate $cert -Address $state.address
      Register-SimpleCertificateFiles $InstallFolder $kit
      Write-Host ('Комплект доверия HTTPS для переноса на USB/другой ПК: '+$kit.folder+'. Открой Install-Certificate.cmd на другом Windows-ПК; инструкции для остальных устройств — README.txt.')
      if (-not $SkipCertificateTrust) {
        $yes=Read-Host 'Добавить сертификат этого CastLink в доверенные для твоего пользователя Windows? [да/нет]'
        if ($yes -in @('да','д','yes','y')) { & (Join-Path $kit.folder 'Trust-Certificate.ps1') -Action Install }
      }
      Write-Host 'Для LAN разреши входящие TCP 443,7881 и UDP 61000-61100 в Windows Firewall. Для публичного IP также пробрось эти порты на роутере.'
    } else {
      Wait-SimpleHttps $state $release ''
      Write-Host 'На VPS/в панели провайдера открой TCP 80,443,7881 и UDP 61000-61100. Caddy автоматически получает и обновляет публичный HTTPS сертификат для выбранного IP или домена.'
    }
    Write-Host "`nCastLink установлен: https://$($state.address)"
    Write-Host 'На главной странице создай комнату или войди по её названию.'
    Write-Host 'Пароль студии сохраняет доступ создателя к своей комнате; гостевой пароль нужен только для входа гостей.'
    Write-Host 'Прямое аудио/видео требует доступных указанных портов. TURN в этой версии мастера не настроен.'
    Write-SimpleStage 'Установка завершена' 5 5 -Completed
  } finally { if ($script:SshSession) { Disconnect-SimpleSsh -Client $script:SshSession } }
  } finally { if(Get-Command Update-SimpleOwnership -ErrorAction SilentlyContinue){$null=Update-SimpleOwnership $InstallFolder $state} }
}
if (-not $FunctionsOnly) {
  try { Start-SimpleSetup } catch { Write-Host ('Установка остановлена: '+$_.Exception.Message); exit 1 }
}
