param([string]$HelperPath,[string]$EntryPath)
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly -Action remove -Target remote -ServerIp '203.0.113.20' -Login root -SshPort 22
. $HelperPath
$root=Join-Path $env:TEMP ('castlink-remote-remove-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $root
try {
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:old';postgres='postgres:old';livekit='livekit:old';caddy='caddy:old'}}
  $state=New-SimpleConfiguration $root 'meet.example.com' $true $release
  $state.completed=$true;$state.databasePhase='seed';Set-SimpleTarget $root $state 'remote' '203.0.113.20' root 22
  Write-SimpleConfiguration $root $state $release '203.0.113.20'
  $project='castlink-easy-'+$state.installationId.Replace('-','');$remoteFolder='/opt/'+$project
  $script:SshSession='fixture';$script:ServerFolder=$remoteFolder;$script:commands=New-Object Collections.Generic.List[object]
  function Get-SimpleDockerContainers { return @() } # retained keep-data installation has no containers
  function ConvertTo-SimplePosixLiteral([string]$Value) { return ("'"+$Value+"'") }
  $script:serverMetadata='';$script:failDown=$false
  function Invoke-SimpleSshCommand([object]$Client,[string]$Command,[string]$Stdin='') {
    $script:commands.Add([pscustomobject]@{command=$Command;stdin=$Stdin})
    if ($Command -like 'for dir *') { return [pscustomobject]@{code=0;stdout=($remoteFolder+"`n/opt/castlink-easy-invalid`n/home/foreign`n");stderr=''} }
    if ($Command -like 'cat --*compose.json*') { return [pscustomobject]@{code=0;stdout=(Get-Content (Join-Path $root 'compose.json') -Raw);stderr=''} }
    if ($Command -like 'cat --*Caddyfile*') { return [pscustomobject]@{code=0;stdout=(Get-Content (Join-Path $root 'Caddyfile') -Raw);stderr=''} }
    if ($Command -like 'cat --*.castlink-server.json*') { return [pscustomobject]@{code=$(if($script:serverMetadata){0}else{1});stdout=$script:serverMetadata;stderr=''} }
    if ($Command -like 'umask 077; cat >*') { $script:serverMetadata=$Stdin }
    return [pscustomobject]@{code=0;stdout='';stderr=''}
  }
  $known=@(Get-SimpleRemoteInstallations)
  if ($known.Count -ne 1 -or $known[0].folder -cne $remoteFolder -or $known[0].address -cne 'meet.example.com' -or $known[0].installationId -cne $state.installationId) { throw 'Remote discovery lost retained installation or admitted foreign path' }
  function Invoke-DeploymentDocker { return '' }
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName='') {
    if ($ProjectName -cne $project) { throw 'Remote removal lost explicit project binding' }
    if ($script:failDown) { throw 'DOWN_FAILURE' }
    $script:commands.Add([pscustomobject]@{command=($Arguments -join ' ');stdin=''})
    return ''
  }
  $mirror=Join-Path $root 'removal-only';$null=New-Item -ItemType Directory $mirror
  $selected=New-SimpleRemoteRemovalMirror $mirror $known[0] '203.0.113.20' 22
  if ($selected.password -or (Test-Path (Join-Path $mirror 'web.env'))) { throw 'Discovery exported credentials' }
  $script:commands.Clear();$null=Remove-SimpleDeployment $mirror $selected -Confirmed:$false
  if ($script:commands.Count) { throw 'Cancelled removal dispatched effects' }
  $script:failDown=$true;$failed=$false;try{$null=Remove-SimpleDeployment $mirror $selected -Confirmed}catch{$failed=$true}
  if (-not $failed -or $script:serverMetadata -or -not (Test-Path (Join-Path $mirror '.castlink-install.json'))) { throw 'Failed down erased retry state or wrote success metadata' }
  $script:failDown=$false;$script:commands.Clear();$null=Remove-SimpleDeployment $mirror $selected -Confirmed
  if (@($script:commands | Where-Object{$_.command -like 'rm *'}).Count -or @($script:commands | Where-Object{$_.command -like 'down*'})[0].command -match 'volumes') { throw 'Keep-data deleted server data/configuration' }
  $metadata=@($script:commands|Where-Object{$_.command -like 'umask 077; cat >*'})
  if ($metadata.Count -ne 1 -or $metadata[0].stdin -match 'password|livekitSecret|setupToken|encryption') { throw 'Keep-data failed nonsensitive server metadata preservation' }
  if ($metadata[0].stdin -match 'completed|databasePhase') { throw 'Legacy discovery invented bootstrap completion' }
  $again=@(Get-SimpleRemoteInstallations)
  if ($again.Count -ne 1 -or $again[0].installationId -cne $selected.installationId) { throw 'Keep-data installation not rediscovered' }
  $selected=New-SimpleRemoteRemovalMirror $mirror $again[0] '203.0.113.20' 22
  $script:commands.Clear();$null=Remove-SimpleDeployment $mirror $selected -Confirmed -DeleteData
  $deletes=@($script:commands|Where-Object{$_.command -like 'rm *'})
  if ($deletes.Count -ne 1 -or $deletes[0].command -match ' -r|prune|/home/|foreign' -or $deletes[0].command -notmatch 'castlink-server.json') { throw 'Remote purge violated bounded file removal' }
  # Run the actual remote selection frontdoor with only SSH/deployment effects
  # doubled. A fresh launcher must discover/reuse matching endpoint cache.
  $front=Join-Path $root 'frontdoor';$null=New-Item -ItemType Directory $front
  Copy-Item -LiteralPath $EntryPath -Destination (Join-Path $front 'windows-simple-easy-setup.ps1')
  Write-SimpleText (Join-Path $front 'simple-easy-setup-deploy.ps1') @'
function Get-SimpleRemoteInstallations { return $script:frontKnown }
function Assert-SimpleTarget($State,$Target,$Ip,$Port) { if($State.target -ne 'remote' -or $State.serverIp -ne $Ip -or $State.sshPort -ne $Port){throw 'endpoint mismatch'} }
function Get-SimpleRemovalProject($State,$Compose) { if($Compose.name -cne ('castlink-easy-'+$State.installationId.Replace('-',''))){throw 'UUID mismatch'};return $Compose.name }
function New-SimpleRemoteRemovalMirror($Folder,$Selected,$Ip,$Port) { $script:mirrorCreated=$true;return [pscustomobject]@{installationId=$Selected.installationId;removalOnly=$true} }
function Remove-SimpleDeployment($Folder,$State,[switch]$Confirmed,[switch]$DeleteData) { $script:removedFolder=$Folder;$script:removedState=$State;$script:removedPurge=[bool]$DeleteData;return $true }
'@
  Write-SimpleText (Join-Path $front 'simple-easy-setup-ssh.ps1') @'
function Install-SimpleSshDependency { $script:dependencyCalls++ }
function Connect-SimpleSsh { return 'fixture' }
function Disconnect-SimpleSsh { $script:disconnected=$true }
'@
  . (Join-Path $front 'windows-simple-easy-setup.ps1') -FunctionsOnly -Action remove -Target remote -ServerIp '203.0.113.20' -Login root -SshPort 22
  function Prepare-SimpleDotNet { }
  function Get-SimplePreviousWorkspace { return '' }
  function Get-SimpleRemoteWorkspace { return $root }
  function Read-Host([string]$Prompt,[switch]$AsSecureString) {
    if($AsSecureString){return (ConvertTo-SecureString 'fixture-password' -AsPlainText -Force)}
    if($Prompt -like 'Выбери номер*'){return '1'}
    if($Prompt -like '1 — удалить сервер*'){return '2'}
    if($Prompt -like 'Для подтверждения*'){if($script:cancelRemoval){return 'cancel'};return ($remoteFolder+' @ 203.0.113.20:22')}
    throw ('Unexpected remote removal question: '+$Prompt)
  }
  $script:frontKnown=$known;$script:cancelRemoval=$true;$script:removedFolder='';$script:mirrorCreated=$false;$script:dependencyCalls=0
  Start-SimpleSetup
  if($script:removedFolder -or $script:mirrorCreated){throw 'Cancelled frontdoor created mirror or dispatched removal'}
  $script:cancelRemoval=$false;Start-SimpleSetup
  if($script:removedFolder -cne $root -or $script:removedState.password -cne $state.password -or -not $script:removedPurge -or -not $script:disconnected){throw 'Fresh launcher failed to reuse matching full cached state'}
  $different=$state|ConvertTo-Json -Depth 10|ConvertFrom-Json;$different.installationId=[Guid]::NewGuid().ToString()
  [IO.File]::WriteAllText((Join-Path $root '.castlink-install.json'),($different|ConvertTo-Json -Depth 10))
  $script:removedFolder='';Start-SimpleSetup
  if($script:removedFolder -ceq $root -or -not $script:removedState.removalOnly){throw 'Another cached UUID was deleted'}
  # Route remote remove before folder/release/runtime work; selected folder is automatic.
  . $EntryPath -FunctionsOnly -Action remove -Target remote
  function Start-SimpleRemoteRemoval { $script:remoteMenuCalled=$true }
  function Read-Host { throw 'Remote remove requested local folder' }
  function Get-SimpleCurrentRelease { throw 'Remove requested release' }
  $script:remoteMenuCalled=$false;Start-SimpleSetup
  if (-not $script:remoteMenuCalled) { throw 'Remote remove did not route to SSH discovery' }
  Write-Output 'SIMPLE_REMOTE_REMOVE_FIXTURES_PASS fresh-master retained-folder UUID keep purge no-secrets no-folder'
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
