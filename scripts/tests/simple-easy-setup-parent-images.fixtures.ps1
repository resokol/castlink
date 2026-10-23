param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
$root=Join-Path $env:TEMP ('castlink-parent-images-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory $root
try {
  function Write-SimpleText([string]$Path,[string]$Text){[IO.File]::WriteAllText($Path,$Text,(New-Object Text.UTF8Encoding($true)))}
  $script:SshSession=$null;$script:images=@{};$script:containers=@{};$script:removed=@()
  $source='a'*40;$otherSource='b'*40
  function New-Image([char]$Key,[string]$Source=$source,[string[]]$Layers=@(),[string]$Parent=''){
    $image=[pscustomobject]@{Id=('sha256:'+([string]$Key)*64);Parent=$Parent;Config=[pscustomobject]@{Labels=[pscustomobject]@{'ru.castlink.image.owner'='castlink';'ru.castlink.image.ownership'='castlink-build-v1';'ru.castlink.image.source'=$Source;'ru.castlink.image.stage'='web-builder'}};RepoTags=@();RepoDigests=@();RootFS=[pscustomobject]@{Layers=$Layers}}
    $script:images[$image.Id]=$image;return $image
  }
  $layerA='sha256:'+('1'*64);$layerB='sha256:'+('2'*64);$layerC='sha256:'+('3'*64);$layerD='sha256:'+('4'*64);$layerE='sha256:'+('5'*64)
  $foreign=New-Image 'f' $source @($layerA);$foreign.Config.Labels=[pscustomobject]@{}
  $currentParent=New-Image 'a' $source @($layerA,$layerB) $foreign.Id
  $current=New-Image 'b' $source @($layerA,$layerB,$layerC) $currentParent.Id
  $unused=New-Image 'c' $source @($layerD);$unused.RepoTags=$null;$unused.RepoDigests=$null
  $stoppedParent=New-Image 'd' $source @($layerE)
  $stopped=New-Image 'e' $otherSource @($layerE,$layerD) $stoppedParent.Id
  $runningParent=New-Image '1' $source @($layerB)
  $running=New-Image '2' $otherSource @($layerB,$layerD) $runningParent.Id
  $changed=New-Image '3' $source @($layerD,$layerB)
  $missing=New-Image '4' $source @($layerD,$layerC)
  $tagged=New-Image '5' $source @($layerD,$layerE);$tagged.RepoTags=@('foreign:keep')
  $digested=New-Image '6' $source @($layerD,$layerE);$digested.RepoDigests=@('foreign@sha256:'+('6'*64))
  $unknown=New-Image '7' $source @($layerD,$layerE)
  $modernCurrent=New-Image '8' $source @($layerA);$modernStopped=New-Image '9' $source @($layerE)
  $tag='castlink-easy-web:'+$source;$script:images[$tag]=$current
  $script:containers['stopped']=$stopped.Id;$script:containers['running']=$running.Id
  function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900){
    if($Arguments[0] -ceq 'image' -and $Arguments[1] -ceq 'ls'){return (($script:images.Values|ForEach-Object{$_.Id}|Select-Object -Unique) -join "`n")}
    if($Arguments[0] -ceq 'image' -and $Arguments[1] -ceq 'inspect'){
      if(-not $script:images.ContainsKey($Arguments[2])){throw 'No such image'}
      if($Arguments[-1] -ceq '{{.Id}}'){return $script:images[$Arguments[2]].Id}
      return ($script:images[$Arguments[2]]|ConvertTo-Json -Depth 8 -Compress)
    }
    if($Arguments[0] -ceq 'ps'){return ($script:containers.Keys -join "`n")}
    if($Arguments[0] -ceq 'inspect'){return $script:containers[$Arguments[1]]}
    if($Arguments[0] -ceq 'image' -and $Arguments[1] -ceq 'rm'){
      if('--no-prune' -cnotin $Arguments -or '--force' -cin $Arguments){throw 'Unsafe implicit parent pruning'}
      $script:removed+=@($Arguments|Where-Object{$_ -cmatch '^sha256:[a-f0-9]{64}$'})
      return ''
    }
    throw ('Unexpected Docker call: '+($Arguments -join ' '))
  }
  $state=[pscustomobject]@{installationId=[Guid]::NewGuid().ToString()}
  $release=[pscustomobject]@{commit=$source;images=[pscustomobject]@{web=$tag}}
  $receipt=Open-SimpleOwnership $root;$receipt.installationId=$state.installationId;Write-SimpleText (Join-Path $root '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  # Supplemental parent tracking must not fail a verified leaf image load.
  $loadFolder=Join-Path $root 'missing-parent-load';$null=New-Item -ItemType Directory $loadFolder
  $savedParent=$current.Parent;$current.PSObject.Properties.Remove('Parent')
  Register-SimpleImageLoad $loadFolder $state $release -AfterLoad
  $loaded=Open-SimpleOwnership $loadFolder
  if($loaded.images[0].id -cne $current.Id -or @($loaded.parents|Where-Object{$_}).Count){throw 'Missing Parent aborted leaf accounting or granted unknown parent ownership'}
  $current|Add-Member -NotePropertyName Parent -NotePropertyValue $savedParent
  $foreignChild=New-Image '0' $source @($layerA,$layerB,$layerC,$layerD) $current.Id
  Register-SimpleParentImages $root $state $release
  if($foreignChild.Id -cin @((Open-SimpleOwnership $root).parents.id)){throw 'A foreign descendant inherited ownership from producer labels'}
  # These exact images were loaded service roots in earlier successful releases.
  foreach($prior in @($unused,$stoppedParent,$runningParent,$changed,$missing,$tagged,$digested,$unknown,$modernCurrent,$modernStopped)){
    Register-SimpleParentImages $root $state ([pscustomobject]@{commit=$source;images=[pscustomobject]@{web=$prior.Id}})
  }
  $receipt=Open-SimpleOwnership $root
  if($foreign.Id -cin @($receipt.parents.id) -or $stopped.Id -cin @($receipt.parents.id) -or $running.Id -cin @($receipt.parents.id)){throw 'Ancestry or a different source granted image ownership'}
  if($unused.Id -cnotin @($receipt.parents.id)){throw 'Explicit own parent not registered'}
  $changed.Config.Labels.'ru.castlink.image.stage'='foreign-stage';$missing.Config.Labels=[pscustomobject]@{};$unknown.RootFS=$null
  Remove-SimpleParentImages $root $state @($tag)
  if($script:removed.Count -ne 1 -or $script:removed[0] -cne $unused.Id){throw ('Parent cleanup touched protected/foreign/changed/referenced images: '+($script:removed -join ','))}
  $leafProtection=Get-SimpleParentProtection @($tag)
  if(-not(Test-SimpleLeafParentProtected $currentParent $leafProtection 'old:leaf')){throw 'Leaf with current Parent edge was retired'}
  # Modern Docker can omit Parent edges: layers add protection, never ownership.
  $current.Parent='';$stopped.Parent='';$running.Parent='';$script:removed=@()
  Remove-SimpleParentImages $root $state @($tag)
  if($script:removed.Count){throw 'Modern current/container layer prefixes were deleted'}
  $leafProtection=Get-SimpleParentProtection @($tag)
  if(-not(Test-SimpleLeafParentProtected $currentParent $leafProtection 'old:leaf')){throw 'Leaf with modern current layer-prefix was retired'}
  $current.RepoTags=@('old:alias','new:current')
  if(Test-SimpleLeafParentProtected $current $leafProtection 'old:alias'){throw 'Safe same-ID alias was retained'}
  $current.RepoTags=@('old:alias')
  if(-not(Test-SimpleLeafParentProtected $current $leafProtection 'old:alias')){throw 'Only tagged current ID could be removed'}
  # Missing protection observations must retain every candidate.
  $current.RootFS=$null;$script:removed=@()
  Remove-SimpleParentImages $root $state @($tag)
  if($script:removed.Count){throw 'Incomplete current-root observation allowed parent cleanup'}
  Write-Output 'SIMPLE_PARENT_IMAGES_FIXTURES_PASS marker-source receipt foreign current running stopped modern-layers labels references no-prune incomplete'
} finally {Remove-Item -LiteralPath $root -Recurse -Force}
