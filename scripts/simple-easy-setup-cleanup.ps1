$ErrorActionPreference='Stop'
function Get-SimpleOwnedCandidates([string]$Folder) {
  $files=@('EasySetup.cmd','Docker-Desktop-Installer.exe','net-framework-4.8.exe')
  foreach($file in $files){$p=Join-Path $Folder $file;if(Test-Path -LiteralPath $p -PathType Leaf){Get-Item -LiteralPath $p}}
  $kits=@(Get-ChildItem -LiteralPath $Folder -Directory -ErrorAction SilentlyContinue|Where-Object{$_.Name -cmatch '^CastLink-Certificate(-[a-f0-9]{12}-[a-f0-9]{12}(-[a-f0-9]{8})?)?$'}|ForEach-Object{$_.Name})
  foreach($directory in (@('.downloads','.tools')+$kits)) {
    $p=Join-Path $Folder $directory
    if(Test-Path -LiteralPath $p -PathType Container){Get-ChildItem -LiteralPath $p -File -Recurse | Where-Object {
      $relative=$_.FullName.Substring([IO.Path]::GetFullPath($Folder).TrimEnd([IO.Path]::DirectorySeparatorChar).Length+1).Replace('\','/')
      -not ($_.Attributes -band [IO.FileAttributes]::ReparsePoint) -and (
        $relative -cmatch '^\.downloads/([a-f0-9]{64}\.zip|SHA256SUMS|CastLink-Linux\.tar\.gz)$' -or
        $relative -cmatch '^\.downloads/[a-f0-9]{64}/(EasySetup\.cmd|README\.txt|payload/(images\.tar\.gz|release\.json)|scripts/(windows-simple-easy-setup\.ps1|simple-easy-setup-(deploy|runtime|ssh|cleanup|trust)\.ps1|ubuntu-easy-setup-bootstrap\.sh))$' -or
        $relative -cmatch '^\.tools/sshnet-2024\.2\.0/(System\.(Runtime\.CompilerServices\.Unsafe|Buffers|Numerics\.Vectors|Memory|Threading\.Tasks\.Extensions|Formats\.Asn1)|Microsoft\.Bcl\.AsyncInterfaces|BouncyCastle\.Cryptography|Renci\.SshNet)\.dll$' -or
        $relative -cmatch '^\.tools/sshnet-2024\.2\.0/(System\.(Runtime\.CompilerServices\.Unsafe\.4\.5\.3|Buffers\.4\.5\.1|Numerics\.Vectors\.4\.5\.0|Memory\.4\.5\.5|Threading\.Tasks\.Extensions\.4\.5\.2|Formats\.Asn1\.8\.0\.1)|Microsoft\.Bcl\.AsyncInterfaces\.1\.0\.0|BouncyCastle\.Cryptography\.2\.4\.0|SSH\.NET\.2024\.2\.0)\.nupkg$' -or
        $relative -cmatch '^CastLink-Certificate(-[a-f0-9]{12}-[a-f0-9]{12}(-[a-f0-9]{8})?)?/(castlink-local-root\.crt|Install-Certificate\.cmd|Remove-Certificate\.cmd|Trust-Certificate\.ps1|README\.txt|\.trust-import\.json)$'
      )
    }}
  }
}
function Open-SimpleOwnership([string]$Folder,[switch]$FolderWasNew) {
  $path=Join-Path $Folder '.castlink-owned.json'
  if(Test-Path -LiteralPath $path){$receipt=Get-Content -LiteralPath $path -Encoding UTF8 -Raw|ConvertFrom-Json;if($receipt.schemaVersion -ne 1 -or $receipt.folder -cne [IO.Path]::GetFullPath($Folder)){throw 'Учёт файлов относится к другой папке.'};return $receipt}
  $baseline=@(Get-SimpleOwnedCandidates $Folder | ForEach-Object {$_.FullName})
  $root=[IO.Path]::GetFullPath($Folder).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
  $legacy=@(Get-SimpleLegacyPackageFiles $Folder|ForEach-Object{[pscustomobject]@{path=$_.Substring($root.Length);sha256=(Get-FileHash -LiteralPath $_ -Algorithm SHA256).Hash.ToLowerInvariant()}})
  $receipt=[pscustomobject]@{schemaVersion=1;folder=[IO.Path]::GetFullPath($Folder);installationId='';baseline=$baseline;files=$legacy;images=@();rootCreated=[bool]$FolderWasNew}
  Write-SimpleText $path ($receipt|ConvertTo-Json -Depth 8)
  return $receipt
}
function Update-SimpleOwnership([string]$Folder,[object]$State=$null) {
  $receipt=Open-SimpleOwnership $Folder
  if($State){if($receipt.installationId -and $receipt.installationId -cne $State.installationId){throw 'Учёт файлов относится к другой установке.'};$receipt.installationId=$State.installationId}
  $root=[IO.Path]::GetFullPath($Folder).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
  $recorded=@($receipt.files|ForEach-Object{$_.path})
  foreach($file in Get-SimpleOwnedCandidates $Folder){
    if($file.FullName -cin $receipt.baseline){continue}
    $relative=$file.FullName.Substring($root.Length)
    if($relative -cin $recorded){continue}
    $entry=[pscustomobject]@{path=$relative;sha256=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant()}
    # Only own files are refreshed; preexisting files remain excluded.
    $receipt.files=@($receipt.files|Where-Object{$_.path -cne $relative})+@($entry)
  }
  Write-SimpleText (Join-Path $Folder '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  return $receipt
}
function Register-SimpleImageLoad([string]$Folder,[object]$State,[object]$Release,[switch]$AfterLoad) {
  $receipt=Open-SimpleOwnership $Folder;$receipt.installationId=$State.installationId
  foreach($tag in $Release.images.PSObject.Properties.Value){
    if($tag -cnotmatch '^castlink-easy-(web|postgres|livekit|caddy):[a-f0-9]{40}$'){throw 'Неизвестное имя образа CastLink.'}
    $entry=@($receipt.images|Where-Object{$_.tag -ceq $tag})
    if(-not $entry.Count){
      $present=$true;try{$null=Invoke-DeploymentDocker @('image','inspect',$tag,'--format','{{.Id}}')}catch{if($_.Exception.Message -notmatch 'No such image|No such object'){throw};$present=$false}
      $entry=@([pscustomobject]@{tag=$tag;preexisting=$present;id=''});$receipt.images+= $entry
    }
    if($AfterLoad){$entry[0].id=(Invoke-DeploymentDocker @('image','inspect',$tag,'--format','{{.Id}}')).Trim()}
  }
  Write-SimpleText (Join-Path $Folder '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  if($script:SshSession){Upload-SimpleSshFile -Client $script:SshSession -LocalFile (Join-Path $Folder '.castlink-owned.json') -RemoteFile ($script:ServerFolder+'/.castlink-owned.json')}
}
function Remove-SimpleOwnedImages([object]$Receipt,[object]$Compose) {
  $runtime=Read-SimpleRuntimeReceipt
  $entries=if($Receipt){@($Receipt.images)}else{@($Compose.services.PSObject.Properties|ForEach-Object{[pscustomobject]@{tag=$_.Value.image;preexisting=($_.Value.image -cnotmatch '^castlink-easy-(web|postgres|livekit|caddy):[a-f0-9]{40}$');id=''}})}
  foreach($entry in $entries){
    $hostOwned=@($runtime.ownedImages|Where-Object{$_.tag -ceq $entry.tag})
    if($entry.preexisting -and -not $hostOwned.Count){Write-Host ('Сохранён существовавший ранее образ: '+$entry.tag);continue}
    if($hostOwned.Count){$entry.id=$hostOwned[0].id}
    if($runtime -and @($runtime.installations|Where-Object{$entry.tag -cin $_.images}).Count){Write-Host ('Сохранён образ для другой установки с сохранёнными данными: '+$entry.tag);continue}
    if($entry.tag -cnotmatch '^castlink-easy-(web|postgres|livekit|caddy):[a-f0-9]{40}$'){throw 'Неверный учёт образов.'}
    $id='';try{$id=(Invoke-DeploymentDocker @('image','inspect',$entry.tag,'--format','{{.Id}}')).Trim()}catch{if($_.Exception.Message -notmatch 'No such image|No such object'){throw};continue}
    if($entry.id -and $id -cne $entry.id){Write-Host ('Сохранён изменённый образ: '+$entry.tag);continue}
    $used=Invoke-DeploymentDocker @('ps','-aq','--filter',('ancestor='+$entry.tag))
    if($used.Trim()){Write-Host ('Сохранён образ, используемый другими контейнерами: '+$entry.tag);continue}
    $volumes=Invoke-DeploymentDocker @('volume','ls','--format','{{.Name}}')
    $registered=@($runtime.installations|Where-Object{$_.installationId}|ForEach-Object{'castlink-easy-'+$_.installationId.Replace('-','')})
    $unknownRetained=@($volumes -split '\r?\n'|Where-Object{$_ -cmatch '^castlink-easy-[a-f0-9]{32}_(postgres-data|web-data|caddy-data|caddy-config)$' -and $_.Substring(0,46) -cnotin $registered})
    if($unknownRetained.Count){Write-Host ('Сохранён образ: есть прежние установки с данными без учёта их версии: '+$entry.tag);continue}
    if($script:SshSession){
      $others=@(Get-SimpleRemoteInstallations|Where-Object{$_.project -cne $Compose.name})
      if(@($others|Where-Object{$entry.tag -cin $_.compose.services.PSObject.Properties.Value.image}).Count){Write-Host ('Сохранён образ, указанный в другой конфигурации VPS: '+$entry.tag);continue}
    }
    # No force: Docker also refuses an in-use image. Other tags remain intact.
    $null=Invoke-DeploymentDocker @('image','rm',$entry.tag) '' 60
    if($runtime){$runtime.ownedImages=@($runtime.ownedImages|Where-Object{$_.tag -cne $entry.tag});Save-SimpleRuntimeReceipt $runtime}
  }
}
function Get-SimpleCleanupFiles([string]$Folder,[object]$Receipt) {
  $root=[IO.Path]::GetFullPath($Folder).TrimEnd([IO.Path]::DirectorySeparatorChar)+[IO.Path]::DirectorySeparatorChar
  if(-not $Receipt){Write-Host 'Старая установка: очищаются только распознанные пакеты CastLink; неизвестные файлы и системные зависимости сохранены.';Get-SimpleLegacyPackageFiles $Folder;return}
  foreach($entry in $Receipt.files){
    $path=[IO.Path]::GetFullPath((Join-Path $Folder $entry.path))
    if(-not $path.StartsWith($root,[StringComparison]::OrdinalIgnoreCase)){throw 'Учёт очистки выходит за папку установки.'}
    if(Test-Path -LiteralPath $path -PathType Leaf){
      if(-not $entry.mutable -and (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){Write-Host ('Сохранён изменённый файл: '+$entry.path);continue}
      $path
    }
  }
}
function Register-SimpleCertificateFiles([string]$Folder,[object]$Kit) {
  $receipt=Open-SimpleOwnership $Folder
  foreach($relative in $Kit.files){$path=Join-Path $Folder $relative;$receipt.files+= [pscustomobject]@{path=$relative;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();mutable=($relative -like '*/.trust-import.json')}}
  Write-SimpleText (Join-Path $Folder '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
}
function Remove-SimpleHostCertificateTrust([string]$Folder,[object]$Receipt) {
  if(-not $Receipt){Write-Host 'Прежнее доверие сертификату сохранено: нет подтверждения его импорта мастером.';return}
  foreach($entry in $Receipt.files|Where-Object{$_.path -like '*/Trust-Certificate.ps1'}){
    $path=Join-Path $Folder $entry.path
    if((Test-Path -LiteralPath $path) -and (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $entry.sha256){& $path -Action Remove;if($LASTEXITCODE -gt 0){throw 'Не удалось убрать собственное доверие сертификату; состояние сохранено.'}}
  }
}
function Get-SimpleLegacyPackageFiles([string]$Folder) {
  $cache=Join-Path $Folder '.downloads'
  if(-not(Test-Path -LiteralPath $cache)){return}
  foreach($directory in Get-ChildItem -LiteralPath $cache -Directory){
    if($directory.Name -cnotmatch '^[a-f0-9]{64}$'){continue}
    $path=Join-Path $directory.FullName 'payload/release.json'
    if(-not(Test-Path -LiteralPath $path)){continue}
    try{$release=Get-Content -LiteralPath $path -Encoding UTF8 -Raw|ConvertFrom-Json}catch{continue}
    if($release.schemaVersion -ne 1 -or $release.commit -cnotmatch '^[a-f0-9]{40}$'){continue}
    $valid=$true;foreach($service in @('web','postgres','livekit','caddy')){if($release.images.$service -cne ('castlink-easy-'+$service+':'+$release.commit)){$valid=$false}}
    if(-not $valid){continue}
    $zip=Join-Path $cache ($directory.Name+'.zip')
    if(-not(Test-Path -LiteralPath $zip) -or (Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant() -cne $directory.Name){continue}
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    $archive=[IO.Compression.ZipFile]::OpenRead($zip)
    try{
      foreach($file in Get-SimpleOwnedCandidates $Folder){
        if(-not $file.FullName.StartsWith($directory.FullName+[IO.Path]::DirectorySeparatorChar,[StringComparison]::OrdinalIgnoreCase)){continue}
        $relative=$file.FullName.Substring($directory.FullName.Length+1).Replace('\','/');$entry=$archive.GetEntry($relative)
        if(-not $entry){continue};$stream=$entry.Open();$hash=[Security.Cryptography.SHA256]::Create()
        try{$original=([BitConverter]::ToString($hash.ComputeHash($stream))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose();$stream.Dispose()}
        if((Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $original){$file.FullName}
      }
      $zip
    }finally{$archive.Dispose()}
  }
  $sums=Join-Path $cache 'SHA256SUMS';$linux=Join-Path $cache 'CastLink-Linux.tar.gz'
  if(Test-Path -LiteralPath $sums){
    $lines=@(Get-Content -LiteralPath $sums)
    if($lines.Count -eq 2 -and @($lines|Where-Object{$_ -cnotmatch '^[a-f0-9]{64}  CastLink-(Windows\.zip|Linux\.tar\.gz)$'}).Count -eq 0){
      $sums
      $linuxLine=@($lines|Where-Object{$_ -like '*  CastLink-Linux.tar.gz'})
      if($linuxLine.Count -eq 1 -and (Test-Path -LiteralPath $linux) -and (Get-FileHash -LiteralPath $linux -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $linuxLine[0].Substring(0,64)){$linux}
    }
  }
  $launcher=Join-Path $Folder 'EasySetup.cmd'
  if(Test-Path -LiteralPath $launcher){$text=Get-Content -LiteralPath $launcher -Encoding UTF8 -Raw;if($text -match '\.downloads\\[a-f0-9]{64}\\scripts\\windows-simple-easy-setup\.ps1' -and $text -notmatch '(?im)^\s*(del|rmdir|curl|wget|start)\b'){$launcher}}
}
function Write-SimpleOwnedLauncher([string]$Folder,[string]$Text) {
  $receipt=Open-SimpleOwnership $Folder;$path=Join-Path $Folder 'EasySetup.cmd'
  $entry=@($receipt.files|Where-Object{$_.path -ceq 'EasySetup.cmd'})
  $refresh=$entry.Count -and (Test-Path -LiteralPath $path) -and ((Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $entry[0].sha256)
  Write-SimpleText $path $Text
  if($refresh){$entry[0].sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant();Write-SimpleText (Join-Path $Folder '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)}
}
function Start-SimpleDeferredCleanup([string]$Folder,[string[]]$Files,[string[]]$Directories=@()) {
  if(-not $Files.Count){return}
  $request=Join-Path $Folder '.castlink-cleanup-pending.json'
  $report=Join-Path $Folder '.castlink-cleanup-result.json'
  $runner=Join-Path $Folder '.castlink-cleanup.ps1'
  $ownership=Open-SimpleOwnership $Folder
  Write-SimpleText $request (([pscustomobject]@{parentPid=$PID;files=$Files;directories=$Directories;report=$report;removeFolder=$ownership.rootCreated})|ConvertTo-Json -Depth 5)
  $source=@'
param([string]$Request)
$ErrorActionPreference='Stop'
$r=Get-Content -LiteralPath $Request -Encoding UTF8 -Raw|ConvertFrom-Json
try{Wait-Process -Id $r.parentPid -ErrorAction SilentlyContinue}catch{}
$removed=@();$failed=@()
foreach($file in $r.files){try{if(Test-Path -LiteralPath $file -PathType Leaf){Remove-Item -LiteralPath $file -Force};$removed+=$file}catch{$failed+=$file}}
# Remove only empty parents, never recursively remove a selected installation.
foreach($file in $removed){$directory=Split-Path $file -Parent;while($directory -and $directory -ne (Split-Path $Request -Parent)){if(-not (Test-Path -LiteralPath $directory)){break};if(@(Get-ChildItem -LiteralPath $directory -Force).Count){break};try{Remove-Item -LiteralPath $directory -Force}catch{break};$directory=Split-Path $directory -Parent}}
foreach($directory in $r.directories){try{if((Test-Path -LiteralPath $directory -PathType Container) -and -not @(Get-ChildItem -LiteralPath $directory -Force).Count){Remove-Item -LiteralPath $directory -Force}}catch{$failed+=$directory}}
[IO.File]::WriteAllText($r.report,([pscustomobject]@{completed=($failed.Count -eq 0);failed=$failed;removedCount=$removed.Count}|ConvertTo-Json -Depth 5),(New-Object Text.UTF8Encoding($false)))
if(-not $failed.Count){Write-Host 'Очистка файлов CastLink завершена.';Remove-Item -LiteralPath $r.report -Force;Remove-Item -LiteralPath $Request -Force;Remove-Item -LiteralPath $PSCommandPath -Force;$parent=Split-Path $Request -Parent;if($r.removeFolder -and -not @(Get-ChildItem -LiteralPath $parent -Force).Count){Remove-Item -LiteralPath $parent -Force}}else{Write-Host ('Не все файлы удалены. Отчёт: '+$r.report)}
'@
  [IO.File]::WriteAllText($runner,$source,(New-Object Text.UTF8Encoding($true)))
  $exe=Join-Path $PSHOME 'powershell.exe';if(-not(Test-Path $exe)){$exe=Join-Path $PSHOME 'pwsh'}
  $start=@{FilePath=$exe;ArgumentList=('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File '+(Quote-SimpleArgument $runner)+' -Request '+(Quote-SimpleArgument $request))}
  if([Environment]::OSVersion.Platform -eq [PlatformID]::Win32NT){$start.WindowStyle='Hidden'}
  $null=Start-Process @start
  $global:SimpleCleanupScheduled=$true
  if(Get-Command Write-SimpleStage -ErrorAction SilentlyContinue){Write-SimpleStage 'Очистка файлов после закрытия мастера' 4 4}
  Write-Host ('Очистка загрузок запланирована после закрытия мастера; результат: '+$report)
}
function Get-SimpleRuntimeReceiptPath {
  if($script:SshSession){return '/opt/.castlink-runtime.json'}
  $base=if(Test-Path 'D:\'){ 'D:\CastLink' }else{Join-Path ([Environment]::GetFolderPath('UserProfile')) 'CastLink'}
  return (Join-Path $base '.castlink-runtime.json')
}
function Read-SimpleRuntimeReceipt {
  $path=Get-SimpleRuntimeReceiptPath
  if($script:SshSession){$r=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('cat -- '+(ConvertTo-SimplePosixLiteral $path));if($r.code -ne 0 -or -not $r.stdout.Trim()){return $null};$text=$r.stdout}
  else{if(-not(Test-Path -LiteralPath $path)){return $null};$text=Get-Content -LiteralPath $path -Encoding UTF8 -Raw}
  $r=$text|ConvertFrom-Json;if($r.schemaVersion -ne 1){throw 'Неизвестный формат учёта среды CastLink.'};return $r
}
function Save-SimpleRuntimeReceipt($Receipt) {
  $path=Get-SimpleRuntimeReceiptPath;$json=$Receipt|ConvertTo-Json -Depth 8
  if($script:SshSession){$r=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('umask 077; cat > '+(ConvertTo-SimplePosixLiteral $path)) -Stdin $json;if($r.code -ne 0){throw 'Не удалось сохранить учёт зависимостей VPS.'}}
  else{$null=New-Item -ItemType Directory -Path (Split-Path $path -Parent) -Force;Write-SimpleText $path $json}
}
function Register-SimpleSharedComponent([string]$Name,[string]$Status) {
  $receipt=Read-SimpleRuntimeReceipt
  if(-not $receipt){$receipt=[pscustomobject]@{schemaVersion=1;before=[pscustomobject]@{desktop='unknown'};owned=[pscustomobject]@{};installations=@();pending=$false}}
  if(-not $receipt.PSObject.Properties['sharedComponents']){$receipt|Add-Member -NotePropertyName sharedComponents -NotePropertyValue ([pscustomobject]@{})}
  $receipt.sharedComponents|Add-Member -NotePropertyName $Name -NotePropertyValue $Status -Force
  Save-SimpleRuntimeReceipt $receipt
}
function Get-SimpleRuntimeSnapshot {
  if(-not $script:SshSession){return [pscustomobject]@{desktop=(Find-Desktop)}}
  # dpkg is present before python/Docker bootstrap. No credentials are read.
  $command='for p in docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin python3 curl ca-certificates; do v=$(dpkg-query -W -f=''${db:Status-Status}|${Version}'' "$p" 2>/dev/null || true); printf ''%s=%s\n'' "$p" "$v"; done; for p in /etc/apt/keyrings/castlink-docker.asc /etc/apt/sources.list.d/castlink-docker.list; do if test -f "$p"; then sha256sum "$p"; fi; done'
  $r=Invoke-SimpleSshCommand -Client $script:SshSession -Command $command
  if($r.code -ne 0){throw 'Не удалось проверить прежние зависимости VPS.'}
  $packages=@{};foreach($line in $r.stdout -split '\r?\n'){if($line -match '^([a-z0-9.-]+)=installed\|(.+)$'){$packages[$matches[1]]=$matches[2]}}
  $files=@{};foreach($line in $r.stdout -split '\r?\n'){if($line -match '^([a-f0-9]{64})  (/etc/apt/(keyrings/castlink-docker.asc|sources.list.d/castlink-docker.list))$'){$files[$matches[2]]=$matches[1]}}
  return [pscustomobject]@{packages=[pscustomobject]$packages;files=[pscustomobject]$files}
}
function Start-SimpleRuntimeOwnership([string]$Folder) {
  $receipt=Read-SimpleRuntimeReceipt
  if($receipt -and $receipt.pending){Complete-SimpleRuntimeOwnership $Folder;$receipt=Read-SimpleRuntimeReceipt}
  if(-not $receipt){$receipt=[pscustomobject]@{schemaVersion=1;before=(Get-SimpleRuntimeSnapshot);owned=[pscustomobject]@{};installations=@();pending=$true}}
  else{$receipt.before=Get-SimpleRuntimeSnapshot;$receipt|Add-Member -NotePropertyName pending -NotePropertyValue $true -Force}
  $full=[IO.Path]::GetFullPath($Folder)
  if(-not @($receipt.installations|Where-Object{$_.folder -ceq $full}).Count){$receipt.installations+= [pscustomobject]@{folder=$full;installationId='';images=@()}}
  Save-SimpleRuntimeReceipt $receipt
}
function Complete-SimpleRuntimeOwnership([string]$Folder,[object]$State=$null,[object]$Release=$null) {
  $receipt=Read-SimpleRuntimeReceipt;if(-not $receipt){return}
  $now=Get-SimpleRuntimeSnapshot
  if($script:SshSession){
    foreach($p in $now.packages.PSObject.Properties){if(-not $receipt.before.packages.PSObject.Properties[$p.Name]){$receipt.owned|Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value -Force}}
    if(-not $receipt.PSObject.Properties['aptFiles']){$receipt|Add-Member -NotePropertyName aptFiles -NotePropertyValue ([pscustomobject]@{})}
    foreach($p in $now.files.PSObject.Properties){if(-not $receipt.before.files.PSObject.Properties[$p.Name]){$receipt.aptFiles|Add-Member -NotePropertyName $p.Name -NotePropertyValue $p.Value -Force}}
  }
  elseif(-not $receipt.before.desktop -and $now.desktop){$receipt.owned|Add-Member -NotePropertyName desktop -NotePropertyValue $now.desktop -Force}
  $entry=@($receipt.installations|Where-Object{$_.folder -ceq [IO.Path]::GetFullPath($Folder)})
  if($entry.Count -and $State){$entry[0].installationId=$State.installationId;if($Release){$entry[0].images=@($Release.images.PSObject.Properties.Value)}}
  if(-not $receipt.PSObject.Properties['ownedImages']){$receipt|Add-Member -NotePropertyName ownedImages -NotePropertyValue @()}
  $ownedPath=Join-Path $Folder '.castlink-owned.json'
  if(Test-Path -LiteralPath $ownedPath){$assets=Get-Content -LiteralPath $ownedPath -Encoding UTF8 -Raw|ConvertFrom-Json;foreach($image in $assets.images){if(-not $image.preexisting -and -not @($receipt.ownedImages|Where-Object{$_.tag -ceq $image.tag}).Count){$receipt.ownedImages+= [pscustomobject]@{tag=$image.tag;id=$image.id}}}}
  $receipt|Add-Member -NotePropertyName pending -NotePropertyValue $false -Force
  Save-SimpleRuntimeReceipt $receipt
}
function Remove-SimpleRuntimeRegistration([string]$Folder,[object]$State) {
  $receipt=Read-SimpleRuntimeReceipt
  if(-not $receipt){Write-Host 'Системные зависимости сохранены: прежняя установка не содержит подтверждения их происхождения.';return $null}
  $receipt.installations=@($receipt.installations|Where-Object{if($_.installationId){$_.installationId -cne $State.installationId}else{$_.folder -cne [IO.Path]::GetFullPath($Folder)}})
  Save-SimpleRuntimeReceipt $receipt
  return $receipt
}
function Remove-SimpleOwnedRuntime([object]$Receipt) {
  if(-not $Receipt){return}
  Write-Host 'WSL, .NET и общие Linux-компоненты Python/curl/CA автоматически не удаляются: они могут использоваться другими приложениями.'
  if($Receipt.installations.Count){Write-Host 'Docker сохранён: есть другие или незавершённые установки CastLink с сохранённой конфигурацией.';return}
  foreach($query in @(@('ps','-aq'),@('volume','ls','-q'),@('image','ls','-q'),@('plugin','ls','-q'))){if((Invoke-DeploymentDocker $query).Trim()){Write-Host 'Docker сохранён: в нём остались ресурсы других приложений или установок.';return}}
  $networks=Invoke-DeploymentDocker @('network','ls','--format','{{.Name}}')
  if(@($networks -split '\r?\n'|Where-Object{$_ -and $_ -notin @('bridge','host','none')}).Count){Write-Host 'Docker сохранён: есть сети других приложений.';return}
  $usage=Invoke-DeploymentDocker @('system','df','--format','{{json .}}')
  foreach($line in $usage -split '\r?\n'){if($line.Trim()){$item=$line|ConvertFrom-Json;if($item.Type -eq 'Build Cache' -and [int]$item.TotalCount -gt 0){Write-Host 'Docker сохранён: есть кэш сборок других приложений.';return}}}
  if($script:SshSession){
    $owned=@($Receipt.owned.PSObject.Properties|Where-Object{$_.Name -in @('docker-ce','docker-ce-cli','containerd.io','docker-buildx-plugin','docker-compose-plugin')})
    if(-not $owned.Count){Write-Host 'Docker сохранён: он существовал до CastLink.';return}
    $packages=@($owned.Name)
    # Preserve upgraded packages and any external installed reverse dependency.
    $verify='set -eu; for p in '+(($packages|ForEach-Object{ConvertTo-SimplePosixLiteral $_}) -join ' ')+'; do apt-cache rdepends --installed "$p"; done'
    $r=Invoke-SimpleSshCommand -Client $script:SshSession -Command $verify
    if($r.code -ne 0){throw 'Не удалось проверить использование пакетов Docker; пакеты сохранены.'}
    $dependents=@($r.stdout -split '\r?\n'|Where-Object{$_ -match '^\s+\|?([a-z0-9][a-z0-9+.-]+)$'}|ForEach-Object{$_.Trim().TrimStart('|')})
    if(@($dependents|Where-Object{$_ -cnotin $packages}).Count){Write-Host 'Docker пакеты сохранены: нужны другим установленным пакетам.';return}
    foreach($p in $owned){$r=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('dpkg-query -W -f=''${Version}'' '+(ConvertTo-SimplePosixLiteral $p.Name));if($r.code -eq 0 -and $r.stdout.Trim() -cne $p.Value){Write-Host 'Docker пакеты сохранены: версия изменена после установки.';return}}
    $command='DEBIAN_FRONTEND=noninteractive apt-get remove -y -- '+(($packages|ForEach-Object{ConvertTo-SimplePosixLiteral $_}) -join ' ')
    $r=Invoke-SimpleSshCommand -Client $script:SshSession -Command $command -TimeoutSeconds 600
    if($r.code -ne 0){throw 'Файлы приложения удалены, но Docker пакеты удалить не удалось; учёт сохранён.'}
    foreach($p in $packages){$Receipt.owned.PSObject.Properties.Remove($p)}
    $remaining=Invoke-SimpleSshCommand -Client $script:SshSession -Command 'for p in docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin; do dpkg-query -W -f=''${db:Status-Status}\n'' "$p" 2>/dev/null || true; done'
    if($remaining.code -eq 0 -and $remaining.stdout -notmatch '(?m)^installed$'){
      foreach($file in $Receipt.aptFiles.PSObject.Properties){
        if($file.Name -notin @('/etc/apt/keyrings/castlink-docker.asc','/etc/apt/sources.list.d/castlink-docker.list')){throw 'Неизвестный файл источника Docker.'}
        $check=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('sha256sum -- '+(ConvertTo-SimplePosixLiteral $file.Name))
        if($check.code -eq 0 -and $check.stdout.StartsWith($file.Value+' ')){$r=Invoke-SimpleSshCommand -Client $script:SshSession -Command ('rm -f -- '+(ConvertTo-SimplePosixLiteral $file.Name));if($r.code -ne 0){throw 'Источник Docker удалить не удалось; учёт сохранён.'}}
      }
    }else{Write-Host 'Источник Docker сохранён: есть другие установленные Docker пакеты.'}
    Write-Host 'Docker пакеты, установленные мастером и не используемые другими приложениями, удалены. Python, curl и CA сохранены как общие системные компоненты.'
  }else{
    if(-not $Receipt.owned.desktop){Write-Host 'Docker Desktop сохранён: он существовал до CastLink.';return}
    $desktop=Find-Desktop;if($desktop -cne $Receipt.owned.desktop){Write-Host 'Docker Desktop сохранён: его расположение изменилось.';return}
    $contexts=Invoke-DeploymentDocker @('context','ls','--format','{{.Name}}')
    if(@($contexts -split '\r?\n'|Where-Object{$_ -and $_ -notin @('default','desktop-linux')}).Count){Write-Host 'Docker Desktop сохранён: есть Windows engine или другие контексты приложений.';return}
    $installer=Join-Path (Split-Path $desktop -Parent) 'Docker Desktop Installer.exe'
    if(-not(Test-Path -LiteralPath $installer)){Write-Host 'Docker Desktop сохранён: официальный деинсталлятор не найден.';return}
    $sig=Get-AuthenticodeSignature -LiteralPath $installer
    if($sig.Status -ne 'Valid' -or $sig.SignerCertificate.Subject -notmatch 'Docker'){throw 'Подпись деинсталлятора Docker не подтверждена; Docker сохранён.'}
    $r=Start-Process -FilePath $installer -ArgumentList 'uninstall -quiet' -Verb RunAs -Wait -PassThru
    if($r.ExitCode -ne 0){throw 'Docker Desktop удалить не удалось; учёт сохранён.'}
    $Receipt.owned.PSObject.Properties.Remove('desktop')
    Write-Host 'Docker Desktop, установленный мастером, удалён. WSL и .NET сохранены как общие компоненты Windows.'
  }
  Save-SimpleRuntimeReceipt $Receipt
}
