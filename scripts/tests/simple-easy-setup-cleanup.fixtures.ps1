param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$root=Join-Path $env:TEMP ('castlink-cleanup-данные-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $root
try{
  $folder=Join-Path $root 'installation';$null=New-Item -ItemType Directory $folder
  Write-SimpleText (Join-Path $folder 'EasySetup.cmd') 'preexisting launcher'
  $null=Open-SimpleOwnership $folder
  $cache=Join-Path $folder '.downloads';$null=New-Item -ItemType Directory $cache
  Write-SimpleText (Join-Path $cache 'SHA256SUMS') 'ours'
  Write-SimpleText (Join-Path $cache 'foreign-note.txt') 'keep'
  $state=[pscustomobject]@{installationId=[Guid]::NewGuid().ToString()}
  $receipt=Update-SimpleOwnership $folder $state
  if($receipt.files.Count -ne 1 -or $receipt.files[0].path -notlike '*SHA256SUMS'){throw 'Receipt adopted preexisting/foreign file'}
  if(@(Get-SimpleCleanupFiles $folder $receipt).Count -ne 1){throw 'Owned file cleanup missing'}
  Write-SimpleText (Join-Path $cache 'SHA256SUMS') 'changed externally'
  $receipt=Update-SimpleOwnership $folder $state
  if(@(Get-SimpleCleanupFiles $folder $receipt).Count){throw 'Changed file was adopted or removed'}
  $wrong=$receipt|ConvertTo-Json -Depth 8|ConvertFrom-Json;$wrong.files[0].path='../outside.txt'
  $refused=$false;try{Get-SimpleCleanupFiles $folder $wrong}catch{$refused=$true};if(-not $refused){throw 'Path escape accepted'}
  # Explicit producer refresh accepts only the previous unchanged own launcher.
  $producer=Join-Path $root 'producer';$null=New-Item -ItemType Directory $producer
  $null=Open-SimpleOwnership $producer;Write-SimpleOwnedLauncher $producer 'version1';$receipt=Update-SimpleOwnership $producer
  Write-SimpleOwnedLauncher $producer 'version2';$receipt=Open-SimpleOwnership $producer
  if(@(Get-SimpleCleanupFiles $producer $receipt).Count -ne 1){throw 'Wizard update lost own launcher hash'}
  Write-SimpleText (Join-Path $producer 'EasySetup.cmd') 'user edit';Write-SimpleOwnedLauncher $producer 'version3';$receipt=Open-SimpleOwnership $producer
  if(@(Get-SimpleCleanupFiles $producer $receipt).Count){throw 'Producer adopted externally edited launcher'}
  $legacy=Join-Path $root 'legacy';$digest='c'*64;$package=Join-Path $legacy ('.downloads/'+$digest);$null=New-Item -ItemType Directory (Join-Path $package 'payload') -Force
  $commit='d'*40;$images=@{};foreach($service in @('web','postgres','livekit','caddy')){$images[$service]='castlink-easy-'+$service+':'+$commit}
  Write-SimpleText (Join-Path $package 'payload/release.json') (@{schemaVersion=1;commit=$commit;images=$images}|ConvertTo-Json -Depth 5)
  Write-SimpleText (Join-Path $package 'payload/images.tar.gz') 'archive';Write-SimpleText (Join-Path $package 'foreign-note.txt') 'keep'
  Add-Type -AssemblyName System.IO.Compression
  Add-Type -AssemblyName System.IO.Compression.FileSystem
  # The real producer is Unix zip. Framework CreateFromDirectory can retain
  # Windows backslashes, so make the actual portable entry names explicit.
  $zip=Join-Path $root 'legacy.zip';$archive=[IO.Compression.ZipFile]::Open($zip,[IO.Compression.ZipArchiveMode]::Create)
  try{
    foreach($name in @('payload/release.json','payload/images.tar.gz','foreign-note.txt')){
      $entry=$archive.CreateEntry($name);if($entry.FullName -cne $name){throw 'Portable ZIP entry changed'}
      $input=[IO.File]::OpenRead((Join-Path $package $name));$output=$entry.Open()
      try{$input.CopyTo($output)}finally{$input.Dispose();$output.Dispose()}
    }
  }finally{$archive.Dispose()}
  $digest=(Get-FileHash -LiteralPath $zip -Algorithm SHA256).Hash.ToLowerInvariant()
  $newPackage=Join-Path $legacy ('.downloads/'+$digest);Move-Item -LiteralPath $package -Destination $newPackage
  Move-Item -LiteralPath $zip -Destination (Join-Path $legacy ('.downloads/'+$digest+'.zip'))
  $legacyFiles=@(Get-SimpleLegacyPackageFiles $legacy)
  if($legacyFiles.Count -ne 3 -or @($legacyFiles|Where-Object{$_ -like '*foreign*'}).Count){throw 'Legacy package exact inventory failed'}
  $upgraded=Open-SimpleOwnership $legacy
  if(@(Get-SimpleCleanupFiles $legacy $upgraded).Count -ne 3){throw 'Upgrade adopted legacy cache as unowned baseline'}
  # Shared ownership survives removal of the original importing installation.
  $script:runtimePath=Join-Path $root 'runtime.json'
  function Get-SimpleRuntimeReceiptPath{return $script:runtimePath}
  function Get-SimpleRuntimeSnapshot{return [pscustomobject]@{desktop='preexisting Docker'}}
  $script:SshSession=$null
  $tag='castlink-easy-web:'+('a'*40);$imageId='sha256:'+('b'*64)
  $a=[pscustomobject]@{installationId=[Guid]::NewGuid().ToString()};$b=[pscustomobject]@{installationId=[Guid]::NewGuid().ToString()}
  $runtime=[pscustomobject]@{schemaVersion=1;before=[pscustomobject]@{desktop='preexisting Docker'};owned=[pscustomobject]@{};ownedImages=@([pscustomobject]@{tag=$tag;id=$imageId});installations=@([pscustomobject]@{folder='A';installationId=$a.installationId;images=@($tag)},[pscustomobject]@{folder='B';installationId=$b.installationId;images=@($tag)})}
  Save-SimpleRuntimeReceipt $runtime
  $script:removedTags=@();$script:otherContainer=$false
  function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900){
    if($Arguments[0] -eq 'image' -and $Arguments[1] -eq 'inspect' -and $Arguments[-1] -ceq '{{json .}}'){return (@{Id=$imageId;Parent='';RootFS=@{Layers=@($imageId)};RepoTags=@($tag);RepoDigests=@()}|ConvertTo-Json -Depth 6 -Compress)}
    if($Arguments[0] -eq 'image' -and $Arguments[1] -eq 'inspect'){return $imageId}
    if($Arguments[0] -eq 'image' -and $Arguments[1] -eq 'rm'){if($Arguments[2] -cne '--no-prune'){throw 'Implicit leaf parent pruning'};$script:removedTags+=$Arguments[3];return ''}
    if($Arguments[0] -eq 'ps' -and $script:otherContainer){return 'foreign-container'}
    if($Arguments[0] -eq 'inspect' -and $Arguments[1] -eq 'foreign-container'){return $tag}
    return ''
  }
  $assets=[pscustomobject]@{images=@([pscustomobject]@{tag=$tag;preexisting=$false;id=$imageId})}
  $null=Remove-SimpleRuntimeRegistration 'A' $a;Remove-SimpleOwnedImages $assets $null
  if($script:removedTags.Count){throw 'Image used by retained B was removed'}
  $assets.images[0].preexisting=$true
  $null=Remove-SimpleRuntimeRegistration 'B' $b
  $script:otherContainer=$true;Remove-SimpleOwnedImages $assets $null
  if($script:removedTags.Count){throw 'Image used by foreign container was removed'}
  $script:otherContainer=$false;Remove-SimpleOwnedImages $assets $null
  if($script:removedTags.Count -ne 1){throw 'Shared host-owned image ownership was lost'}
  # A different nonempty UUID at the same local mirror path must remain.
  $runtime=Read-SimpleRuntimeReceipt;$runtime.installations=@([pscustomobject]@{folder=[IO.Path]::GetFullPath($folder);installationId=$a.installationId;images=@()});Save-SimpleRuntimeReceipt $runtime
  $remaining=Remove-SimpleRuntimeRegistration $folder $b
  if($remaining.installations.Count -ne 1){throw 'Foreign UUID registration removed by folder match'}
  # System uninstallation uses only the official owned executable and happens
  # only after all Docker inventory is empty. StartProcess is a local double.
  $runtime.installations=@();$runtime.owned=[pscustomobject]@{desktop=(Join-Path $root 'Docker Desktop.exe')};Save-SimpleRuntimeReceipt $runtime
  Write-SimpleText (Join-Path $root 'Docker Desktop Installer.exe') 'fixture'
  function Find-Desktop{return (Join-Path $root 'Docker Desktop.exe')}
  function Get-AuthenticodeSignature{return [pscustomobject]@{Status='Valid';SignerCertificate=[pscustomobject]@{Subject='Docker'}}}
  $script:uninstallCalls=0;$script:uninstallFail=$false
  function Start-Process { $script:uninstallCalls++;return [pscustomobject]@{ExitCode=$(if($script:uninstallFail){1}else{0})} }
  $script:otherContainer=$true;Remove-SimpleOwnedRuntime $runtime
  if($script:uninstallCalls){throw 'Shared Docker was uninstalled'}
  $script:otherContainer=$false;$script:uninstallFail=$true;$failed=$false
  try{Remove-SimpleOwnedRuntime $runtime}catch{$failed=$true}
  if(-not $failed -or -not (Read-SimpleRuntimeReceipt).owned.desktop){throw 'Failed uninstall lost retry receipt'}
  $script:uninstallFail=$false;Remove-SimpleOwnedRuntime $runtime
  if((Read-SimpleRuntimeReceipt).owned.desktop -or $script:uninstallCalls -ne 2){throw 'Owned Docker uninstall failed'}
  # The child is parsed by Windows PowerShell5 after the wizard exits.
  # StartProcess remains doubled; verify actual generated bytes, not text decoding.
  Start-SimpleDeferredCleanup $folder @((Join-Path $folder 'owned-test.txt'))
  $childBytes=[IO.File]::ReadAllBytes((Join-Path $folder '.castlink-cleanup.ps1'))
  if([BitConverter]::ToString($childBytes[0..2]) -cne 'EF-BB-BF'){throw 'Deferred PS5 child is missing UTF8 BOM'}
  Write-Output 'SIMPLE_CLEANUP_FIXTURES_PASS preexisting modified foreign path shared-images retained-installation UUID'
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
