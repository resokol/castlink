param([string]$HelperPath,[string]$EntryPath)
$ErrorActionPreference='Stop'
. $HelperPath
$state=[pscustomobject]@{installationId='11111111-1111-1111-1111-111111111111'}
$own='castlink-easy-'+$state.installationId.Replace('-','')
$script:project='castlink-easy-22222222222222222222222222222222';$script:hostChecks=0
function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
  if ($Arguments[0] -eq 'ps') { return 'container' }
  if ($Arguments[0] -ne 'inspect') { throw 'Preflight mutated Docker' }
  return ([ordered]@{ports=@{'7881/tcp'=@(@{HostIp='0.0.0.0';HostPort='7881'})};project=$script:project;folder='D:\PreviousCastLink';name='/livekit'} | ConvertTo-Json -Depth 8 -Compress)
}
function Assert-SimpleSocketPorts([string]$Address,[object[]]$Ports) { $script:hostChecks++ }
$refused=$false;try { Assert-SimplePortAvailability $state '192.168.1.10' $false } catch { $refused=$true;if ($_.Exception.Message -notmatch '7881' -or $_.Exception.Message -notmatch 'PreviousCastLink' -or $_.Exception.Message -notmatch 'ту же папку') { throw 'Conflict lacks actionable existing-server guidance' } }
if (-not $refused -or $script:hostChecks) { throw 'Other project was allowed' }
$script:project=$own
Assert-SimplePortAvailability $state '192.168.1.10' $false
if ($script:hostChecks -ne 1) { throw 'Own project resume failed' }
$script:project='another-app'
$refused=$false;try { Assert-SimplePortAvailability $state '127.0.0.1' $false } catch { $refused=$true }
if (-not $refused) { throw 'Wildcard host binding allowed loopback conflict' }
# Real saved-folder discovery and real stop helper; only Docker transport is doubled.
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-discovery-fixture-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $folder
try {
  . $HelperPath
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:test';postgres='postgres:test';livekit='livekit:test';caddy='caddy:test'}}
  $old=New-SimpleConfiguration $folder '192.168.1.21' $false $release
  Write-SimpleConfiguration $folder $old $release $old.address
  $oldProject='castlink-easy-'+$old.installationId.Replace('-','')
  $script:SshSession=$null;$script:ServerFolder='original-selected-folder';$script:running=$true;$script:stopCount=0;$script:readCount=0;$script:answer='нет';$script:hostChecks=0
  function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
    if ($Arguments[0] -eq 'ps') { $script:readCount++;if ($Arguments -contains '-aq' -or $script:running) { return 'container' };return '' }
    if ($Arguments[0] -eq 'inspect' -and $Arguments -contains '--format') { return ([ordered]@{ports=@{'7881/tcp'=@(@{HostIp='0.0.0.0';HostPort='7881'})};project=$oldProject;folder=$folder;name='/livekit'} | ConvertTo-Json -Depth 8 -Compress) }
    if ($Arguments[0] -eq 'inspect') { return (@([ordered]@{Config=@{Labels=@{'com.docker.compose.project'=$oldProject;'com.docker.compose.service'='livekit'}}}) | ConvertTo-Json -Depth 8 -Compress) }
    return ''
  }
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName='') {
    if (($Arguments -join ' ') -ne 'stop' -or $ProjectName -cne $oldProject) { throw 'Stop touched wrong project or data' }
    $script:stopCount++;$script:running=$false;return ''
  }
  function Assert-SimpleSocketPorts([string]$Address,[object[]]$Ports) { $script:hostChecks++;if ($script:remainingForeignPort) { throw 'Unrelated host port remains occupied' } }
  function Read-Host([string]$Prompt) { return $script:answer }
  $known=@(Get-SimpleKnownInstallations)
  if ($known.Count -ne 1 -or $known[0].folder -ne $folder -or $known[0].address -ne $old.address) { throw 'Discovery did not recover saved install folder' }
  $refused=$false;try { Assert-SimplePortAvailability $state '192.168.1.10' $false } catch {$refused=$true}
  if (-not $refused -or $script:stopCount) { throw 'Declined stop changed services' }
  $script:answer='да';$before=$script:readCount
  Assert-SimplePortAvailability $state '192.168.1.10' $false
  if ($script:stopCount -ne 1 -or $script:running -or $script:readCount -le ($before+1) -or $script:ServerFolder -ne 'original-selected-folder') { throw 'Stop failed to recheck or restore selected target' }
  $after=Get-Content (Join-Path $folder '.castlink-install.json') -Raw | ConvertFrom-Json
  if ($after.password -ne $old.password -or $after.installationId -ne $old.installationId -or -not (Test-Path (Join-Path $folder 'postgres.env'))) { throw 'Stop changed secrets/state/data configuration' }
  $script:running=$true;$script:remainingForeignPort=$true
  $refused=$false;try { Assert-SimplePortAvailability $state '192.168.1.10' $false } catch {$refused=$true}
  if (-not $refused -or $script:stopCount -ne 2) { throw 'Remaining collision after stop was accepted' }
  $script:remainingForeignPort=$false
  # VPS stop uses the same verified project with the deterministic old folder.
  $container=[pscustomobject]@{project=$oldProject;folder=('/opt/'+$oldProject)}
  $script:SshSession=[pscustomobject]@{fixture=$true}
  function ConvertTo-SimplePosixLiteral([string]$Value) { return "'"+$Value.Replace("'","'\''")+"'" }
  function Invoke-SimpleSshCommand($Client,[string]$Command,$Stdin,[int]$TimeoutSeconds) { return [pscustomobject]@{code=0;stdout=(Get-Content (Join-Path $folder 'compose.json') -Raw)} }
  $remote=@(Get-SimpleRemoteKnownInstallation $container)
  if ($remote.Count -ne 1 -or $remote[0].folder -cne ('/opt/'+$oldProject)) { throw 'Remote project discovery failed' }
  Stop-SimpleKnownInstallation $remote[0]
  if ($script:stopCount -ne 3) { throw 'Remote selected project stop missing' }
  $script:SshSession=$null
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
# A real .NET listener catches a non-Docker port conflict, with no persistent effect.
. $HelperPath
$listener=New-Object Net.Sockets.TcpListener ([Net.IPAddress]::Loopback),0
try {
  $listener.Start();$port=$listener.LocalEndpoint.Port
  $refused=$false;try { Assert-SimpleSocketPorts '127.0.0.1' @([pscustomobject]@{port=$port;protocol='tcp'}) } catch {$refused=$true}
  if (-not $refused) { throw 'Occupied native host port was accepted' }
} finally { $listener.Stop() }
Assert-SimpleSocketPorts '127.0.0.1' @([pscustomobject]@{port=$port;protocol='tcp'})
# Execute actual frontdoor ordering; stop at early local preflight, before feed/download.
. $EntryPath -FunctionsOnly -Action install -Target choose -Address 127.0.0.1
$script:questions=New-Object Collections.Generic.List[string]
function Read-Host([string]$Prompt) { $script:questions.Add($Prompt);if ($Prompt -like 'Где установить*') {return '1'};return (Join-Path ([IO.Path]::GetTempPath()) 'castlink-order-fixture') }
function Select-SimpleLocalInstallation { return '' }
function Prepare-SimpleLocalInstall { throw 'EARLY_PREFLIGHT_SENTINEL' }
function Get-SimpleCurrentRelease { throw 'Release download preceded preflight' }
$refused=$false;try { Start-SimpleSetup } catch { $refused=$true;if ($_.Exception.Message -ne 'EARLY_PREFLIGHT_SENTINEL') { throw } }
if (-not $refused -or $script:questions.Count -lt 2 -or $script:questions[0] -notlike 'Где установить*' -or $script:questions[1] -notlike 'Папка*') { throw 'Target was not asked before install folder' }
Write-Output 'SIMPLE_PORT_PREFLIGHT_PASS other-own-project host-socket target-folder-download-order'
