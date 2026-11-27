param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$root=Join-Path $env:TEMP ('castlink-history-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $root
try {
  function Write-SimpleText([string]$Path,[string]$Text){[IO.File]::WriteAllText($Path,$Text,(New-Object Text.UTF8Encoding($true)))}
  $script:SshSession=$null
  $state=[pscustomobject]@{installationId=[Guid]::NewGuid().ToString();completed=$true;target='local'}
  $receipt=Open-SimpleOwnership $root;$receipt.installationId=$state.installationId
  Write-SimpleText (Join-Path $root '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  foreach($item in @(@('a','1.0.8'),@('b','1.0.10'),@('c','1.0.9'),@('d','1.0.10'),@('e','1.0.11'))){
    $key=$item[0]
    $release=[pscustomobject]@{version=$item[1];commit=($key*40);images=[pscustomobject]@{web=('castlink-easy-web:'+($key*40))}}
    $receipt=Open-SimpleOwnership $root;$receipt.images+= [pscustomobject]@{tag=$release.images.web;id=('sha256:'+($key*64));preexisting=$false}
    Write-SimpleText (Join-Path $root '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
    Register-SimpleSuccessfulImages $root $state $release
  }
  $history=@((Open-SimpleOwnership $root).successfulImageSets)
  if($history.Count -ne 3 -or $history[0].version -cne '1.0.11' -or $history[1].commit -cne ('d'*40) -or $history[2].version -cne '1.0.9'){throw 'Semantic history must retain current plus two earlier product versions, latest build per version'}
  if(@((Open-SimpleOwnership $root).images|Where-Object{-not $_.version}).Count){throw 'Healthy releases did not stamp owned image version provenance'}
  Register-SimpleSuccessfulImages $root $state $release
  if(@((Open-SimpleOwnership $root).successfulImageSets)[1].commit -cne ('d'*40)){throw 'Repeated success displaced rollback set'}
  foreach($pair in @(@('1.0.11-rc.9','1.0.11-rc.10'),@('1.0.11-rc.10','1.0.11'))){if((Compare-SimpleRetentionVersion $pair[0] $pair[1]) -ge 0){throw 'Invalid semantic prerelease order'}}
  if((Compare-SimpleRetentionVersion '1.0.11+one' '1.0.11+two') -ne 0){throw 'Build metadata displaced a product version'}
  $receipt=Open-SimpleOwnership $root
  $unknown='castlink-easy-postgres:'+('f'*40);$future='castlink-easy-caddy:'+('f'*40)
  $receipt.images+= [pscustomobject]@{tag=$unknown;id=('sha256:'+('f'*64));preexisting=$false}
  $receipt.images+= [pscustomobject]@{tag=$future;id=('sha256:'+('f'*64));preexisting=$false;version='1.0.12'}
  Write-SimpleText (Join-Path $root '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  $script:obsolete=@()
  function Remove-SimpleOwnedImages($Receipt,$Compose,$Current){$script:obsolete=@($Receipt.images.tag)}
  function Read-SimpleRuntimeReceipt{return [pscustomobject]@{installations=@()}}
  function Remove-SimpleParentImages($Folder,$State,$Current){if($unknown -cnotin $Current -or $future -cnotin $Current){throw 'Staged image parent protection lost'}}
  Remove-SimpleObsoleteImages $root $state $release ([pscustomobject]@{services=[pscustomobject]@{}})
  if($script:obsolete.Count -ne 2 -or ('castlink-easy-web:'+('a'*40)) -cnotin $script:obsolete -or ('castlink-easy-web:'+('b'*40)) -cnotin $script:obsolete){throw 'Wrong semantic retirement candidates or unknown/future staging lost'}
  $futureRelease=[pscustomobject]@{version='1.0.12';commit=('f'*40);images=[pscustomobject]@{web=('castlink-easy-web:'+('f'*40))}}
  $receipt=Open-SimpleOwnership $root
  $receipt.successfulImageSets+= [pscustomobject]@{version=$futureRelease.version;commit=$futureRelease.commit;images=@($futureRelease.images.web)}
  Write-SimpleText (Join-Path $root '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  Register-SimpleSuccessfulImages $root $state $release
  $history=@((Open-SimpleOwnership $root).successfulImageSets)
  if($history.Count -ne 4 -or @($history|Where-Object{$_.version -ceq '1.0.12'}).Count -ne 1){throw 'Future history consumed a prior product slot'}
  function Invoke-DeploymentDocker([string[]]$Arguments){if($Arguments[0] -ceq 'image' -and $Arguments[1] -ceq 'inspect'){return ('sha256:'+('a'*64))};throw 'Unexpected reload fixture Docker command'}
  function Register-SimpleParentImages($Folder,$State,$Release){}
  $reload=[pscustomobject]@{version='1.0.8';commit=('a'*40);images=[pscustomobject]@{web=('castlink-easy-web:'+('a'*40))}}
  Register-SimpleImageLoad $root $state $reload -AfterLoad
  $receipt=Open-SimpleOwnership $root
  $entry=@($receipt.images|Where-Object{$_.tag -ceq $reload.images.web})[0]
  if($entry.version -or $reload.images.web -cnotin @(Get-SimpleRetentionImageTags $receipt)){throw 'Same-identity failed reload retained stale successful version provenance'}
  $state.completed=$false;$refused=$false
  try{Register-SimpleSuccessfulImages $root $state ([pscustomobject]@{commit=('d'*40);images=[pscustomobject]@{web=('castlink-easy-web:'+('d'*40))}})}catch{$refused=$true}
  if(-not $refused -or @((Open-SimpleOwnership $root).successfulImageSets)[0].commit -cne ('e'*40)){throw 'Failed deployment displaced successful history'}
  $sibling=Join-Path $root 'sibling';$null=New-Item -ItemType Directory $sibling
  $other=[Guid]::NewGuid().ToString();$previous='castlink-easy-web:'+('e'*40);$active='castlink-easy-web:'+('f'*40)
  Write-SimpleText (Join-Path $sibling '.castlink-owned.json') (@{schemaVersion=1;folder=[IO.Path]::GetFullPath($sibling);installationId=$other;successfulImageSets=@(@{commit=('f'*40);images=@($active)},@{commit=('e'*40);images=@($previous)})}|ConvertTo-Json -Depth 8)
  $runtime=[pscustomobject]@{installations=@([pscustomobject]@{folder=$sibling;installationId=$other;images=@($active)})}
  if($previous -cnotin @(Get-SimpleRuntimeImageReferences $runtime)){throw 'Sibling previous release was lost from legacy runtime registration'}
  $guard=Enter-SimpleRetentionGuard $root
  try{
    $blocked=$false
    # FileShare.None must also exclude an independent process/session.
    try{$other=[IO.File]::Open((Join-Path $root '.castlink-operation.lock'),[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None);$other.Dispose()}catch [IO.IOException]{$blocked=$true}
    if(-not $blocked){throw 'Operation lock did not exclude other handles'}
  }finally{Exit-SimpleRetentionGuard $guard}
  $state.completed=$true
  $state|Add-Member -NotePropertyName stopped -NotePropertyValue $false
  Save-SimpleState $root $state
  # No Docker lookup/start is permitted for an unavailable scheduled engine.
  function Read-SimpleControlInstallation([string]$Folder){return [pscustomobject]@{state=$state;compose=[pscustomobject]@{name='unused'}}}
  function Find-Desktop{return $null}
  function Start-Process{throw 'Scheduled housekeeping launched a GUI or Docker'}
  Invoke-SimpleScheduledRetention $root
  Write-Output 'SIMPLE_HISTORY_FIXTURES_PASS three-product-versions failed-repeat scoped-lock daemon-off'
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
