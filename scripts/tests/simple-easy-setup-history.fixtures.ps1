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
  foreach($key in @('a','b','c')){
    $release=[pscustomobject]@{commit=($key*40);images=[pscustomobject]@{web=('castlink-easy-web:'+($key*40))}}
    Register-SimpleSuccessfulImages $root $state $release
  }
  $history=@((Open-SimpleOwnership $root).successfulImageSets)
  if($history.Count -ne 2 -or $history[0].commit -cne ('c'*40) -or $history[1].commit -cne ('b'*40)){throw 'Third success did not retain exactly current and previous sets'}
  Register-SimpleSuccessfulImages $root $state $release
  if(@((Open-SimpleOwnership $root).successfulImageSets)[1].commit -cne ('b'*40)){throw 'Repeated success displaced rollback set'}
  $state.completed=$false;$refused=$false
  try{Register-SimpleSuccessfulImages $root $state ([pscustomobject]@{commit=('d'*40);images=[pscustomobject]@{web=('castlink-easy-web:'+('d'*40))}})}catch{$refused=$true}
  if(-not $refused -or @((Open-SimpleOwnership $root).successfulImageSets)[0].commit -cne ('c'*40)){throw 'Failed deployment displaced successful history'}
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
  Write-Output 'SIMPLE_HISTORY_FIXTURES_PASS two-success failed-repeat scoped-lock daemon-off'
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
