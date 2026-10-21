param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$root=Join-Path $env:TEMP ('castlink-retention-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory $root
try {
  $script:SshSession=$null
  function Write-SimpleText([string]$Path,[string]$Text){[IO.File]::WriteAllText($Path,$Text,(New-Object Text.UTF8Encoding($true)))}
  $script:runtimePath=Join-Path $root 'runtime.json'
  function Get-SimpleRuntimeReceiptPath{return $script:runtimePath}
  $folder=Join-Path $root 'install';$null=New-Item -ItemType Directory $folder
  $state=[pscustomobject]@{installationId=[Guid]::NewGuid().ToString()}
  $old='castlink-easy-web:'+('a'*40);$current='castlink-easy-web:'+('b'*40);$stopped='castlink-easy-web:'+('c'*40);$changed='castlink-easy-web:'+('d'*40);$foreign='castlink-easy-web:'+('e'*40);$shared='castlink-easy-web:'+('f'*40)
  $script:fixtureImageId='sha256:'+('1'*64)
  $receipt=Open-SimpleOwnership $folder
  $receipt.installationId=$state.installationId
  $receipt.images=@($old,$current,$stopped,$changed,$foreign,$shared|ForEach-Object{[pscustomobject]@{tag=$_;id=$script:fixtureImageId;preexisting=($_ -ceq $foreign)}})
  Write-SimpleText (Join-Path $folder '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  Save-SimpleRuntimeReceipt ([pscustomobject]@{schemaVersion=1;ownedImages=@();installations=@([pscustomobject]@{folder=$folder;installationId=$state.installationId;images=@($current)},[pscustomobject]@{folder='other';installationId=[Guid]::NewGuid().ToString();images=@($shared)})})
  $script:removed=@()
  function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900){
    if($Arguments[0] -ceq 'image' -and $Arguments[1] -ceq 'inspect' -and $Arguments[-1] -ceq '{{json .}}'){return (@{Id=$script:fixtureImageId;Parent='';RootFS=@{Layers=@($script:fixtureImageId)};RepoTags=@($old,$current,$stopped,$changed,$foreign,$shared);RepoDigests=@()}|ConvertTo-Json -Depth 6 -Compress)}
    if($Arguments[0] -ceq 'image' -and $Arguments[1] -ceq 'inspect'){if($Arguments[2] -ceq $changed){return ('sha256:'+('2'*64))};return $script:fixtureImageId}
    if($Arguments[0] -ceq 'image' -and $Arguments[1] -ceq 'rm'){if($Arguments[2] -cne '--no-prune'){throw 'Implicit leaf parent pruning'};$script:removed+=$Arguments[3];return ''}
    if($Arguments[0] -ceq 'ps' -and $Arguments[-1] -ceq ('ancestor='+$stopped)){return 'stopped-container'}
    if($Arguments[0] -ceq 'ps' -and $Arguments[-1] -ceq ('ancestor='+$old)){return 'current-container'}
    if($Arguments[0] -ceq 'inspect' -and $Arguments[1] -ceq 'stopped-container'){return $stopped}
    if($Arguments[0] -ceq 'inspect' -and $Arguments[1] -ceq 'current-container'){return $current}
    return ''
  }
  $release=[pscustomobject]@{images=[pscustomobject]@{web=$current}}
  $compose=[pscustomobject]@{name=('castlink-easy-'+$state.installationId.Replace('-',''));services=[pscustomobject]@{web=[pscustomobject]@{image=$current}}}
  Remove-SimpleObsoleteImages $folder $state $release $compose
  if($script:removed.Count -ne 1 -or $script:removed[0] -cne $old){throw 'Retention removed a current, stopped, changed, foreign or shared image'}
  $cache=Join-Path $folder '.downloads';$digest='a'*64;$package=Join-Path $cache $digest
  $null=New-Item -ItemType Directory (Join-Path $package 'payload') -Force
  $null=New-Item -ItemType Directory (Join-Path $package 'scripts') -Force
  Write-SimpleText (Join-Path $package 'payload/images.tar.gz') 'owned archive'
  Write-SimpleText (Join-Path $package 'scripts/windows-simple-easy-setup.ps1') 'keep launcher'
  Write-SimpleText (Join-Path $cache ($digest+'.zip')) 'owned zip'
  Write-SimpleText (Join-Path $cache 'foreign.zip') 'keep foreign'
  Write-SimpleText (Join-Path $folder 'manual-backup.zip') 'keep manual backup'
  $null=Update-SimpleOwnership $folder $state
  Write-SimpleText (Join-Path $cache ($digest+'.zip')) 'externally changed zip'
  Remove-SimpleDownloadArchives $folder
  if(Test-Path (Join-Path $package 'payload/images.tar.gz')){throw 'Owned current image archive retained after success'}
  foreach($file in @((Join-Path $package 'scripts/windows-simple-easy-setup.ps1'),(Join-Path $cache ($digest+'.zip')),(Join-Path $cache 'foreign.zip'),(Join-Path $folder 'manual-backup.zip'))){if(-not(Test-Path $file)){throw 'Retention deleted scripts or changed/foreign files'}}
  $script:serviceRunning=$true;$script:serviceHealth='healthy';$script:serviceTag=$current
  function Invoke-DeploymentCompose([string[]]$Arguments){return 'container-id'}
  function Invoke-DeploymentDocker([string[]]$Arguments){
    if($Arguments[-1] -ceq '{{.Config.Image}}'){return $script:serviceTag}
    return (@{Running=$script:serviceRunning;Health=@{Status=$script:serviceHealth}}|ConvertTo-Json -Compress)
  }
  Wait-SimpleServiceHealth $compose 0
  foreach($failure in @('stopped','unhealthy','wrong-image')){
    $script:serviceRunning=($failure -cne 'stopped');$script:serviceHealth=if($failure -ceq 'unhealthy'){'unhealthy'}else{'healthy'};$script:serviceTag=if($failure -ceq 'wrong-image'){$old}else{$current}
    $failed=$false;try{Wait-SimpleServiceHealth $compose 0}catch{$failed=$true};if(-not $failed){throw ('Unready service accepted: '+$failure)}
  }
  $script:managedIndex=Join-Path $root 'managed-servers.json'
  function Get-SimpleManagedServerIndexPath{return $script:managedIndex}
  $state|Add-Member -NotePropertyName completed -NotePropertyValue $true
  Register-SimpleManagedServer $folder $state
  Register-SimpleManagedServer $folder $state
  $index=Get-Content -LiteralPath $script:managedIndex -Raw|ConvertFrom-Json
  if($index.schemaVersion -ne 1 -or $index.installations.Count -ne 1 -or $index.installations[0].installationId -cne $state.installationId -or $index.installations[0].PSObject.Properties.Name.Count -ne 2){throw 'Managed server index leaked data or duplicated installation'}
  # Execute the generated SSH shell only against this temporary fixture tree.
  $remote=Join-Path $root 'remote';$null=New-Item -ItemType Directory (Join-Path $remote 'payload') -Force
  $linux=Join-Path $root 'linux.tar.gz';Write-SimpleText $linux 'linux archive'
  Copy-Item $linux (Join-Path $remote 'release.tar.gz')
  Write-SimpleText (Join-Path $remote 'payload/images.tar.gz') 'image archive'
  $archiveRelease=[pscustomobject]@{imageArchiveSha256=(Get-FileHash (Join-Path $remote 'payload/images.tar.gz') -Algorithm SHA256).Hash.ToLowerInvariant()}
  $script:ServerFolder=$remote.Replace('\','/') -replace '^([A-Za-z]):','/$1';$script:ServerFolder=$script:ServerFolder.Substring(0,2).ToLowerInvariant()+$script:ServerFolder.Substring(2)
  $script:SshSession=$true
  function ConvertTo-SimplePosixLiteral([string]$Value){return ("'"+$Value+"'")}
  function Invoke-SimpleSshCommand($Client,[string]$Command){
    $shellFile=Join-Path $root 'remote-cleanup.sh';[IO.File]::WriteAllText($shellFile,$Command,(New-Object Text.UTF8Encoding($false)))
    $shellPath=$shellFile.Replace('\','/') -replace '^([A-Za-z]):','/$1'
    & 'C:\Program Files\Git\bin\bash.exe' $shellPath
    return [pscustomobject]@{code=$LASTEXITCODE}
  }
  Remove-SimpleRemoteArchives $archiveRelease $linux
  if((Test-Path (Join-Path $remote 'release.tar.gz')) -or (Test-Path (Join-Path $remote 'payload/images.tar.gz'))){throw 'Verified remote archives were not deleted'}
  Write-SimpleText (Join-Path $remote 'release.tar.gz') 'foreign changed release'
  Write-SimpleText (Join-Path $remote 'payload/images.tar.gz') 'foreign changed images'
  Remove-SimpleRemoteArchives $archiveRelease $linux
  if(-not(Test-Path (Join-Path $remote 'release.tar.gz')) -or -not(Test-Path (Join-Path $remote 'payload/images.tar.gz'))){throw 'Changed remote archive was deleted'}
  $script:SshSession=$null
  Write-Output 'SIMPLE_RETENTION_FIXTURES_PASS current-set stopped shared changed preexisting foreign archives launcher manual-backup'
} finally {Remove-Item -LiteralPath $root -Recurse -Force}
