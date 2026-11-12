param([switch]$NetworkingOnly)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
$installer = Join-Path $PSScriptRoot '../install-server-windows.ps1'
if (-not (Test-Path $installer)) { throw 'Installer missing: expected Windows WSL installer implementation' }
. $installer
function Assert($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Assert-Throws([scriptblock]$Block, [string]$Pattern) {
  try { & $Block } catch { Assert ($_.Exception.Message -match $Pattern) "Unexpected error: $($_.Exception.Message)"; return }
  throw "Expected rejection matching $Pattern"
}
function Test-CastlinkWslNetworkSettings([string]$Directory) {
  $path = Join-Path $Directory 'host-loopback.wslconfig'
  $utf8 = [Text.UTF8Encoding]::new($false)
  $comment = '# ' + [char]0x0416 + ' ' + [char]0x7528 + [char]0x6237
  $same = { param($Bytes) Assert ([Convert]::ToBase64String([IO.File]::ReadAllBytes($path)) -ceq [Convert]::ToBase64String($Bytes)) 'Network configuration bytes changed unexpectedly' }
  Set-CastlinkHostAddressLoopback $path @() $true
  Assert ([IO.File]::ReadAllText($path) -ceq "[experimental]`r`nhostAddressLoopback=true`r`n") 'Missing experimental section was not created'
  $saved = [IO.File]::ReadAllBytes($path)
  Set-CastlinkHostAddressLoopback $path @('Ubuntu') $false
  & $same $saved
  $saved = $utf8.GetBytes("[experimental] ; comment`r`nhostAddressLoopback = TrUe # keep`r`notherKey=value`r`n")
  [IO.File]::WriteAllBytes($path, $saved)
  Set-CastlinkHostAddressLoopback $path @('Ubuntu') $false
  & $same $saved
  $original = [byte[]](239,187,191) + $utf8.GetBytes("$comment`n[wsl2]`nnetworkingMode=mirrored`n[experimental] # retain`nautoMemoryReclaim=gradual`n[custom]`nvalue=unchanged")
  [IO.File]::WriteAllBytes($path, $original)
  Set-CastlinkHostAddressLoopback $path @() $true
  $expected = [byte[]](239,187,191) + $utf8.GetBytes("$comment`n[wsl2]`nnetworkingMode=mirrored`n[experimental] # retain`nautoMemoryReclaim=gradual`nhostAddressLoopback=true`n[custom]`nvalue=unchanged")
  & $same $expected
  $original = [byte[]](239,187,191) + $utf8.GetBytes("$comment`n[wsl2]`nnetworkingMode=mirrored")
  [IO.File]::WriteAllBytes($path, $original)
  Assert-Throws { Set-CastlinkHostAddressLoopback $path @() $false } 'shared|hostAddressLoopback'
  & $same $original
  Assert-Throws { Set-CastlinkHostAddressLoopback $path @('Ubuntu') $true } 'running|restart'
  & $same $original
  Set-CastlinkHostAddressLoopback $path @() $true
  $expected = [byte[]]($original + $utf8.GetBytes("`n[experimental]`nhostAddressLoopback=true`n"))
  & $same $expected
  foreach ($invalid in @(
    "[experimental]`nhostAddressLoopback=false`n",
    "[experimental]`nhostAddressLoopback=true`nhostAddressLoopback=true`n",
    "[experimental]`nhostAddressLoopback=true`n[experimental]`nother=1`n",
    "[experimental]`nhostAddressLoopback=`n",
    "[experimental]`nhostAddressLoopback=1`n",
    "[experimental]`nhostAddressLoopback=true extra`n",
    "[experimental]`nhostAddressLoopback:true`n",
    "[experimental]`nhostAddressLoopback true`n",
    "[experimental`nhostAddressLoopback=true`n",
    "[experimental] invalid`nhostAddressLoopback=true`n",
    "[ experimental ]`nhostAddressLoopback=true`n"
  )) {
    $bytes = $utf8.GetBytes($invalid)
    [IO.File]::WriteAllBytes($path, $bytes)
    Assert-Throws { Set-CastlinkHostAddressLoopback $path @() $true } 'conflicting|ambiguous|malformed'
    & $same $bytes
  }
  $invalidUtf8 = [byte[]](255,91,101,120,112,101,114,105,109,101,110,116,97,108,93)
  [IO.File]::WriteAllBytes($path, $invalidUtf8)
  Assert-Throws { Set-CastlinkHostAddressLoopback $path @() $true } 'UTF-8'
  & $same $invalidUtf8
  Remove-Item -LiteralPath $path
  Assert-Throws { Set-CastlinkHostAddressLoopback $path @() $false } 'shared|hostAddressLoopback'
  Assert (-not (Test-Path -LiteralPath $path)) 'Declined setting created a file'

  $script:NetworkPromptCalls = 0; $script:NetworkAnswer = 'n'
  $script:NetworkRunningDistros = @(); $script:NetworkStartDuringConsent = $false
  function Read-Host { $script:NetworkPromptCalls++; if ($script:NetworkStartDuringConsent) { $script:NetworkRunningDistros = @('Ubuntu') }; return $script:NetworkAnswer }
  function Get-CastlinkDistros { param([switch]$Running) return $script:NetworkRunningDistros }
  try {
    Assert-Throws { Initialize-CastlinkWslNetworking $path @() $false } 'required|shared|hostAddressLoopback'
    Assert (-not (Test-Path -LiteralPath $path) -and $script:NetworkPromptCalls -eq 0) 'Noninteractive networking prompted or created a file'
    Assert-Throws { Initialize-CastlinkWslNetworking $path @() $true } 'consent|not changed|declined'
    Assert (-not (Test-Path -LiteralPath $path) -and $script:NetworkPromptCalls -eq 1) 'Declined networking changed the file or skipped consent'
    $script:NetworkAnswer = 'y'
    Assert-Throws { Initialize-CastlinkWslNetworking $path @() $true } 'settings saved.*Restart Windows'
    $created = [IO.File]::ReadAllText($path)
    Assert ($created -match '(?s)\[wsl2\].*networkingMode=mirrored.*\[experimental\].*hostAddressLoopback=true') 'A new config did not receive both settings'
    Assert ($script:NetworkPromptCalls -eq 2) 'New shared settings were not covered by one explicit consent'
    foreach ($malformed in @("[wsl2]`nnetworkingMode=`n", "[wsl2]`nnetworkingMode=mirrored extra`n")) {
      $invalid = $utf8.GetBytes($malformed)
      [IO.File]::WriteAllBytes($path, $invalid)
      Assert-Throws { Initialize-CastlinkWslNetworking $path @() $true } 'malformed'
      & $same $invalid
    }
    $bytes = $utf8.GetBytes("[experimental]`nhostAddressLoopback=false`n")
    [IO.File]::WriteAllBytes($path, $bytes)
    Assert-Throws { Initialize-CastlinkWslNetworking $path @() $true } 'conflicting'
    & $same $bytes
    Assert ($script:NetworkPromptCalls -eq 2) 'Conflicting setting prompted before validation'
    $bytes = $utf8.GetBytes("[wsl2]`nnetworkingMode=mirrored`n")
    [IO.File]::WriteAllBytes($path, $bytes)
    Assert-Throws { Initialize-CastlinkWslNetworking $path @('Ubuntu') $true } 'running|restart'
    & $same $bytes
    Assert ($script:NetworkPromptCalls -eq 2) 'Running distribution prompted for a global change'
    Assert-Throws { Initialize-CastlinkWslNetworking $path @() $true } 'settings saved.*Restart Windows'
    Assert ($script:NetworkPromptCalls -eq 3) 'Host IPv4 access did not request consent'
    $saved = [IO.File]::ReadAllBytes($path)
    Initialize-CastlinkWslNetworking $path @('Ubuntu') $false
    & $same $saved
    Assert ($script:NetworkPromptCalls -eq 3) 'Correct shared settings prompted while a distribution was running'
    [IO.File]::WriteAllBytes($path, $bytes)
    $script:NetworkStartDuringConsent = $true
    Assert-Throws { Initialize-CastlinkWslNetworking $path @() $true } 'running|restart'
    & $same $bytes
  } finally { Remove-Item Function:Read-Host,Function:Get-CastlinkDistros }
}
$testDir = Join-Path ([IO.Path]::GetTempPath()) ('castlink-windows-test-' + [guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($testDir)
try {
  Test-CastlinkWslNetworkSettings $testDir
  if ($NetworkingOnly) { Write-Host 'PASS: shared WSL networking behavioral fixtures (real config files; no WSL operations)'; return }
  $aclRoot = Join-Path $testDir 'private-installation'
  [void][IO.Directory]::CreateDirectory($aclRoot)
  Protect-CastlinkInstallationDirectory $aclRoot
  Protect-CastlinkInstallationDirectory $aclRoot
  $privateAcl = ([IO.DirectoryInfo]::new($aclRoot)).GetAccessControl([Security.AccessControl.AccessControlSections]'Access, Owner')
  $currentSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  Assert ($privateAcl.AreAccessRulesProtected -and $privateAcl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq $currentSid) 'Installation directory owner/protection was not retained'
  $privateRules = @($privateAcl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]))
  Assert ($privateRules.Count -eq 2 -and @($privateRules | Where-Object { $_.IdentityReference.Value -notin @($currentSid,'S-1-5-18') -or $_.IsInherited -or $_.AccessControlType -ne 'Allow' -or $_.FileSystemRights -ne 'FullControl' }).Count -eq 0) 'Installation directory permissions are not private'
  Assert-Throws { Assert-CastlinkAddress 'https://example.com' } 'hostname|IPv4'
  Assert-Throws { Assert-CastlinkAddress 'host;touch /tmp/x' } 'hostname|IPv4'
  Assert-Throws { Assert-CastlinkAddress '-option' } 'hostname|IPv4'
  Assert-Throws { Assert-CastlinkAddress '192.168.2.999' } 'hostname|IPv4'
  Assert-CastlinkAddress 'meet.example.com'
  Assert-CastlinkAddress '192.168.1.25'
  $originalWsl = (Get-Command Invoke-CastlinkWsl).ScriptBlock
  function Invoke-CastlinkWsl([string[]]$Arguments) { $script:CapturedWslArguments = $Arguments; return $script:GuestResponse }
  $script:GuestResponse = 'nat'
  Assert-Throws { Assert-CastlinkMirroredRuntime ([pscustomobject]@{distroName='CastLink-Server-fixture'}) } 'mirrored'
  $script:GuestResponse = 'mirrored'
  Assert-CastlinkMirroredRuntime ([pscustomobject]@{distroName='CastLink-Server-fixture'})
  Assert (($script:CapturedWslArguments -join '|') -eq '--distribution|CastLink-Server-fixture|--user|root|--exec|/usr/bin/wslinfo|--networking-mode') 'Runtime networking queried wrong distro or WSL-provided tool'
  $script:GuestResponse = 'foreign'
  Assert-Throws { Assert-CastlinkGuestIdentity ([pscustomobject]@{distroName='CastLink-Server-fixture';installationId=('a'*32)}) } 'ownership'
  $script:GuestResponse = ('a'*32)
  Assert-CastlinkGuestIdentity ([pscustomobject]@{distroName='CastLink-Server-fixture';installationId=('a'*32)})
  Set-Item Function:Invoke-CastlinkWsl $originalWsl
  $configPath = Join-Path $testDir '.wslconfig'
  $original = [Text.Encoding]::UTF8.GetBytes("# user's settings`r`n[wsl2]`r`nmemory=4GB`r`n")
  [IO.File]::WriteAllBytes($configPath, $original)
  Assert-Throws { Set-CastlinkMirroredNetworking $configPath @('Ubuntu') $true } 'running|restart'
  Assert ([Convert]::ToBase64String([IO.File]::ReadAllBytes($configPath)) -eq [Convert]::ToBase64String($original)) 'Running distro rejection changed config'
  Set-CastlinkMirroredNetworking $configPath @() $true
  $updated = [IO.File]::ReadAllBytes($configPath)
  Assert ([Convert]::ToBase64String($updated[0..($original.Length-1)]) -eq [Convert]::ToBase64String($original)) 'Existing bytes changed'
  Assert (([Text.Encoding]::UTF8.GetString($updated)) -match 'networkingMode=mirrored') 'Mirrored setting missing'
  Set-CastlinkMirroredNetworking $configPath @('Ubuntu') $false
  Assert ([Convert]::ToBase64String([IO.File]::ReadAllBytes($configPath)) -eq [Convert]::ToBase64String($updated)) 'Idempotent config changed'
  [IO.File]::WriteAllText($configPath, "[wsl2]`nnetworkingMode=NAT`n")
  Assert-Throws { Set-CastlinkMirroredNetworking $configPath @() $true } 'conflicting'
  [IO.File]::WriteAllText($configPath, "[wsl2]`nmemory=4GB`n[experimental]`nautoMemoryReclaim=gradual`n")
  Set-CastlinkMirroredNetworking $configPath @() $true
  $sections = [IO.File]::ReadAllText($configPath)
  Assert ($sections -match '(?s)\[wsl2\].*networkingMode=mirrored.*\[experimental\]') 'Setting was appended to wrong section'
  $bom = [byte[]](239,187,191) + [Text.Encoding]::UTF8.GetBytes("[wsl2]`nmemory=4GB")
  [IO.File]::WriteAllBytes($configPath, $bom)
  Set-CastlinkMirroredNetworking $configPath @() $true
  $bomUpdated = [IO.File]::ReadAllBytes($configPath)
  Assert ([Convert]::ToBase64String($bomUpdated[0..($bom.Length-1)]) -eq [Convert]::ToBase64String($bom)) 'UTF-8 BOM or existing bytes were changed'
  $script:FirewallRulesQueried = @()
  function Get-NetFirewallHyperVRule([string]$Name) {
    $script:FirewallRulesQueried += $Name
    $protocol = $Name.Split('-')[-1]
    return [pscustomobject]@{VMCreatorId=[guid]'40E0AC32-46A5-438A-A0B2-2B479E8F2E90';Enabled=$true;Direction='Inbound';Action='Allow';Protocol=$protocol;LocalPorts=$(if($protocol -eq 'TCP'){@('80','443','7881')}else{@('3478','7882','30000-30031')})}
  }
  Initialize-CastlinkFirewall $testDir
  Assert (($script:FirewallRulesQueried -join ',') -eq 'CastLink-Server-TCP,CastLink-Server-UDP') 'Firewall checks did not stay within the named CastLink rules'
  Remove-Item Function:Get-NetFirewallHyperVRule
  $root = Join-Path $testDir 'root'
  [void][IO.Directory]::CreateDirectory($root)
  [IO.File]::WriteAllText((Join-Path $root 'foreign.txt'), 'keep')
  Assert-Throws { Get-CastlinkInstallation $root 'server-wsl-v1.0.0' 'resokol/castlink-releases' ('a'*64) } 'foreign|empty'
  Assert (([IO.File]::ReadAllText((Join-Path $root 'foreign.txt'))) -eq 'keep') 'Foreign file changed'
  Remove-Item (Join-Path $root 'foreign.txt')
  $state = Get-CastlinkInstallation $root 'server-wsl-v1.0.0' 'resokol/castlink-releases' ('a'*64)
  Assert ($state.distroName -match '^CastLink-Server-[a-f0-9]{12}$') 'Unsafe distro name'
  Save-CastlinkInstallation $root $state
  $again = Get-CastlinkInstallation $root 'server-wsl-v1.0.0' 'resokol/castlink-releases' ('a'*64)
  Assert ($again.installationId -eq $state.installationId) 'Rerun replaced identity'
  Assert-Throws { Get-CastlinkInstallation $root 'server-wsl-v1.1.0' 'resokol/castlink-releases' ('a'*64) } 'different|release'
  $script:WslExe = 'C:\Windows\System32\wsl.exe'
  $actualWslExecutable = $script:WslExe
  function Test-CastlinkWslNative {
    $global:LASTEXITCODE = 0
    if ($args[0] -eq '--version') { return $script:TestWslVersion }
  }
  try {
    $script:WslExe = 'Test-CastlinkWslNative'
    $script:TestWslVersion = 'WSL version: 3.0.1.0'
    Initialize-CastlinkWsl
    # Actual Windows PowerShell 5.1 decodes WSL's UTF-16 output with embedded NULs.
    $script:TestWslVersion = [Text.Encoding]::UTF8.GetString([Text.Encoding]::Unicode.GetBytes('WSL version: 3.0.1.0'))
    Initialize-CastlinkWsl
    $script:TestWslVersion = [Text.Encoding]::UTF8.GetString([Text.Encoding]::Unicode.GetBytes('WSL version: 2.4.13'))
    Initialize-CastlinkWsl
    foreach ($unsupported in @('WSL version: 2.4.12', 'no version available')) {
      $script:TestWslVersion = [Text.Encoding]::UTF8.GetString([Text.Encoding]::Unicode.GetBytes($unsupported))
      Assert-Throws { Initialize-CastlinkWsl } 'Update WSL'
    }
  } finally {
    $script:WslExe = $actualWslExecutable
    Remove-Item Function:Test-CastlinkWslNative
  }
  $originalKeepaliveHandle = (Get-Command Get-CastlinkKeepaliveHandle).ScriptBlock
  $originalKeepaliveEvidence = (Get-Command Get-CastlinkProcessEvidence).ScriptBlock
  $script:FakeProcess = [pscustomobject]@{Id=321;StartTime=[DateTime]'2026-11-11T12:00:00Z';HasExited=$false;Handle=42;Killed=$false}
  $script:FakeProcess | Add-Member ScriptMethod Dispose {}
  $script:FakeProcess | Add-Member ScriptMethod WaitForExit { param($timeout) return $this.HasExited }
  $script:FakeProcess | Add-Member ScriptMethod Kill { $this.Killed=$true; $this.HasExited=$true }
  $script:FakeEvidence = [pscustomobject]@{ProcessId=321;ExecutablePath=$script:WslExe;CommandLine='"C:\Windows\System32\wsl.exe" --distribution '+$state.distroName+' --user root --exec /bin/sleep infinity';CreationDate=[DateTime]'2026-11-11T12:00:00Z'}
  function Get-CastlinkKeepaliveHandle([int]$ProcessId) { return $script:FakeProcess }
  function Get-CastlinkProcessEvidence([int]$ProcessId) { return $script:FakeEvidence }
  $receipt = [pscustomobject]@{processId=321;startTimeUtcTicks=$script:FakeProcess.StartTime.ToUniversalTime().Ticks.ToString()}
  $state | Add-Member NoteProperty keepalive $receipt -Force
  Assert ([bool](Get-CastlinkKeepaliveProcess $state)) 'Owned keepalive identity was rejected'
  $nativeCommand = $script:FakeEvidence.CommandLine
  $script:FakeEvidence.CommandLine = $nativeCommand+' '
  Assert ([bool](Get-CastlinkKeepaliveProcess $state)) 'Windows PowerShell trailing command-line space rejected the owned keepalive'
  $script:FakeEvidence.CommandLine = $nativeCommand+' --distribution Ubuntu '
  Assert (-not (Get-CastlinkKeepaliveProcess $state)) 'Extra native command-line arguments were accepted'
  $script:FakeEvidence.CommandLine = $nativeCommand
  $script:FakeEvidence.CommandLine = '"C:\Windows\System32\wsl.exe" --distribution Ubuntu --user root --exec /bin/sleep infinity'
  Assert (-not (Get-CastlinkKeepaliveProcess $state)) 'Foreign WSL process was adopted'
  Assert-Throws { Stop-CastlinkKeepalive $root $state } 'identity|owned'
  Assert (-not $script:FakeProcess.Killed) 'Foreign process was killed'
  $script:FakeEvidence.CommandLine = '"C:\Windows\System32\wsl.exe" --distribution '+$state.distroName+' --user root --exec /bin/sleep infinity'
  $script:FakeEvidence.CreationDate = $script:FakeEvidence.CreationDate.AddSeconds(1)
  Assert (-not (Get-CastlinkKeepaliveProcess $state)) 'Recycled PID was adopted'
  $script:FakeEvidence.CreationDate = $script:FakeProcess.StartTime
  Stop-CastlinkKeepalive $root $state
  Assert ($script:FakeProcess.Killed) 'Owned keepalive was not stopped'
  $originalKeepaliveWsl = (Get-Command Invoke-CastlinkWsl).ScriptBlock
  function Invoke-CastlinkWsl([string[]]$Arguments) { return $state.installationId }
  function Start-Process([string]$FilePath,[string]$ArgumentList,[string]$WindowStyle,[switch]$PassThru) {
    $script:KeepaliveLaunch = [pscustomobject]@{FilePath=$FilePath;Arguments=$ArgumentList;WindowStyle=$WindowStyle}
    return $script:FakeProcess
  }
  $script:FakeProcess.HasExited = $false
  Start-CastlinkKeepalive $root $state
  Assert ($script:KeepaliveLaunch.FilePath -eq $script:WslExe -and $script:KeepaliveLaunch.WindowStyle -eq 'Hidden') 'Keepalive launch was not the hidden system WSL process'
  Assert ($script:KeepaliveLaunch.Arguments -ceq ('--distribution '+$state.distroName+' --user root --exec /bin/sleep infinity')) 'Keepalive launch targeted the wrong distribution or used a shell'
  Assert ((Get-Content -LiteralPath (Join-Path $root 'installation.json') -Raw | ConvertFrom-Json).keepalive.processId -eq 321) 'Keepalive receipt was not persisted'
  Remove-Item Function:Start-Process
  Set-Item Function:Invoke-CastlinkWsl $originalKeepaliveWsl
  Set-Item Function:Get-CastlinkKeepaliveHandle $originalKeepaliveHandle
  Set-Item Function:Get-CastlinkProcessEvidence $originalKeepaliveEvidence
  $script:FakeTask = $null; $script:TaskRegistrations = 0
  $originalSidFunction = (Get-Command Get-CastlinkCurrentUserSid).ScriptBlock
  function Get-CastlinkCurrentUserSid { return 'S-1-5-21-1234' }
  $previousWindir = $env:WINDIR
  $env:WINDIR = Join-Path $testDir 'windows'
  $taskSpec = Get-CastlinkLogonTaskSpec $root $state $installer
  $script:FakeTask = [pscustomobject]@{TaskName=$taskSpec.taskName;TaskPath='\';Description=$taskSpec.description;Principal=[pscustomobject]@{UserId=$taskSpec.userSid;LogonType='Interactive';RunLevel='Limited'};Actions=@([pscustomobject]@{Execute=$taskSpec.execute;Arguments='-Command foreign'});Triggers=@([pscustomobject]@{UserId=$taskSpec.userSid;CimClass=[pscustomobject]@{CimClassName='MSFT_TaskLogonTrigger'};Enabled=$true});Settings=[pscustomobject]@{ExecutionTimeLimit='PT0S';MultipleInstances='IgnoreNew';Enabled=$true}}
  function Get-ScheduledTask { return $script:FakeTask }
  function New-ScheduledTaskAction([string]$Execute,[string]$Argument) { return [pscustomobject]@{Execute=$Execute;Arguments=$Argument} }
  function New-ScheduledTaskTrigger([switch]$AtLogOn,[string]$User) { return [pscustomobject]@{UserId=$User;CimClass=[pscustomobject]@{CimClassName='MSFT_TaskLogonTrigger'};Enabled=$true} }
  function New-ScheduledTaskPrincipal([string]$UserId,[string]$LogonType,[string]$RunLevel) { return [pscustomobject]@{UserId=$UserId;LogonType=$LogonType;RunLevel=$RunLevel} }
  function New-ScheduledTaskSettingsSet([TimeSpan]$ExecutionTimeLimit,[switch]$StartWhenAvailable,[string]$MultipleInstances,[int]$RestartCount,[TimeSpan]$RestartInterval) { return [pscustomobject]@{ExecutionTimeLimit='PT0S';MultipleInstances=$MultipleInstances;Enabled=$true} }
  function Register-ScheduledTask([string]$TaskName,[string]$TaskPath,[string]$Description,$Action,$Trigger,$Principal,$Settings) {
    $script:TaskRegistrations++
    $script:FakeTask = [pscustomobject]@{TaskName=$TaskName;TaskPath=$TaskPath;Description=$Description;Actions=@($Action);Triggers=@($Trigger);Principal=$Principal;Settings=$Settings}
  }
  Assert-Throws { Register-CastlinkLogonTask $root $state $installer } 'conflicting'
  Assert ($script:TaskRegistrations -eq 0) 'Foreign task was overwritten'
  Assert (-not (Test-Path -LiteralPath $taskSpec.stagedPath)) 'Foreign task conflict still wrote a script'
  $script:FakeTask = $null
  Register-CastlinkLogonTask $root $state $installer 6>$null
  Assert ($script:TaskRegistrations -eq 1) 'Logon task was not registered'
  Assert ((Get-FileHash -LiteralPath $taskSpec.stagedPath).Hash -eq (Get-FileHash -LiteralPath $installer).Hash) 'Staged installer differs from pinned source'
  Assert ($script:FakeTask.Actions[0].Arguments -match '-Action Start.*-NonInteractive -KeepaliveTask') 'Scheduled action could prompt or lose keepalive'
  Assert ($script:FakeTask.Principal.UserId -eq 'S-1-5-21-1234') 'Task principal differs from current user'
  Register-CastlinkLogonTask $root $state $installer 6>$null
  Assert ($script:TaskRegistrations -eq 1) 'Rerun replaced the matching owned task'
  $nameSpec = $taskSpec.PSObject.Copy()
  $nameSpec.userSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  $accountName = ([Security.Principal.SecurityIdentifier]::new($nameSpec.userSid)).Translate([Security.Principal.NTAccount]).Value
  $script:FakeTask.Principal.UserId = $accountName
  $script:FakeTask.Triggers[0].UserId = $accountName
  Assert-CastlinkLogonTask $script:FakeTask $nameSpec
  $script:FakeTask.Principal.UserId = 'S-1-5-18'
  Assert-Throws { Assert-CastlinkLogonTask $script:FakeTask $nameSpec } 'conflicting'
  $script:FakeTask.Principal.UserId = $accountName
  $script:FakeTask.Triggers[0].UserId = 'S-1-5-18'
  Assert-Throws { Assert-CastlinkLogonTask $script:FakeTask $nameSpec } 'conflicting'
  $script:FakeTask.Principal.UserId = $taskSpec.userSid
  $script:FakeTask.Triggers[0].UserId = $taskSpec.userSid
  $script:FakeTask.Triggers[0].CimClass.CimClassName = 'MSFT_TaskTimeTrigger'
  Assert-Throws { Register-CastlinkLogonTask $root $state $installer } 'conflicting'
  Remove-Item Function:Get-ScheduledTask,Function:New-ScheduledTaskAction,Function:New-ScheduledTaskTrigger,Function:New-ScheduledTaskPrincipal,Function:New-ScheduledTaskSettingsSet,Function:Register-ScheduledTask
  Set-Item Function:Get-CastlinkCurrentUserSid $originalSidFunction
  $env:WINDIR = $previousWindir
  $originalGetInstallation = (Get-Command Get-CastlinkInstallation).ScriptBlock
  $originalKeepaliveLookup = (Get-Command Get-CastlinkKeepaliveProcess).ScriptBlock
  $script:WaitLookupCount = 0
  function Get-CastlinkInstallation { $script:WaitLookupCount++; return [pscustomobject]@{desiredRunning=($script:WaitLookupCount -eq 1)} }
  function Get-CastlinkKeepaliveProcess { return $null }
  Wait-CastlinkScheduledKeepalive
  Assert ($script:WaitLookupCount -eq 2) 'Scheduled waiter did not recheck concurrent Stop state'
  Set-Item Function:Get-CastlinkInstallation $originalGetInstallation
  Set-Item Function:Get-CastlinkKeepaliveProcess $originalKeepaliveLookup
  $originalWslForOwner = (Get-Command Invoke-CastlinkWsl).ScriptBlock
  $script:OwnerCallLog = @()
  $script:OwnerSecretUrl = 'https://meet.example.com/super-admin#access=csa2.fixture-private-token'
  function Invoke-CastlinkWsl([string[]]$Arguments) {
    $script:OwnerCallLog += ($Arguments -join '|')
    if ($Arguments[-1] -eq '/var/lib/castlink-server-wsl-installation-id') { return $state.installationId }
    if ($Arguments[-1] -eq 'owner-access') { return '{"ownerAccessFile":"/var/lib/castlink-server/owner-access-1234-abcd.txt","expiresInSeconds":900}' }
    if ($Arguments[-1] -eq '/var/lib/castlink-server/owner-access-1234-abcd.txt') { return $script:OwnerSecretUrl }
    throw 'Unexpected guest operation'
  }
  $ownerOutput = @(Export-CastlinkOwnerAccess $root $state 6>&1) -join "`n"
  Assert ($ownerOutput -notmatch 'csa2\.fixture') 'Owner secret leaked to output'
  $localOwnerFiles = @(Get-ChildItem -LiteralPath $root -Filter 'owner-access-*.txt')
  Assert ($localOwnerFiles.Count -eq 1) 'Expected exactly one private owner access file'
  Assert ([IO.File]::ReadAllText($localOwnerFiles[0].FullName).Trim() -eq $script:OwnerSecretUrl) 'Owner access file content differs'
  Assert (($script:OwnerCallLog -join ',') -notmatch 'bash|sh\|') 'Owner secret transport used a shell'
  Set-Item Function:Invoke-CastlinkWsl $originalWslForOwner
  Assert-Throws { Get-CastlinkPublicCertificate '-----BEGIN PRIVATE KEY-----fake-----END PRIVATE KEY-----' } 'public PEM'
  $rsa = [Security.Cryptography.RSA]::Create(2048)
  $request = [Security.Cryptography.X509Certificates.CertificateRequest]::new('CN=CastLink fixture CA', $rsa, [Security.Cryptography.HashAlgorithmName]::SHA256, [Security.Cryptography.RSASignaturePadding]::Pkcs1)
  $request.CertificateExtensions.Add([Security.Cryptography.X509Certificates.X509BasicConstraintsExtension]::new($true,$false,0,$true))
  $publicCa = $request.CreateSelfSigned([DateTimeOffset]::UtcNow.AddMinutes(-1),[DateTimeOffset]::UtcNow.AddMinutes(10))
  $script:CertificatePem = "-----BEGIN CERTIFICATE-----`n"+[Convert]::ToBase64String($publicCa.RawData,[Base64FormattingOptions]::InsertLineBreaks)+"`n-----END CERTIFICATE-----`n"
  $parsedCa = Get-CastlinkPublicCertificate $script:CertificatePem
  Assert (-not $parsedCa.HasPrivateKey) 'Certificate export retained a private key'
  Assert ($parsedCa.Thumbprint -eq $publicCa.Thumbprint) 'Wrong certificate was parsed'
  $parsedCa.Dispose()
  function Invoke-CastlinkWsl([string[]]$Arguments) { return $script:CertificatePem }
  function Read-Host { return $script:TrustAnswer }
  function Import-Certificate([string]$FilePath,[string]$CertStoreLocation) { $script:ImportedStore = $CertStoreLocation; $script:ImportedFile = $FilePath }
  $script:TrustAnswer = 'n'; $script:ImportedStore = ''
  $certOutput = @(Export-CastlinkCertificate $root $state ([pscustomobject]@{caPath='/var/lib/castlink-server/data/server-origin-ca.pem';origin='https://meet.example.com'}) 6>&1) -join "`n"
  Assert ($script:ImportedStore -eq '') 'CA was trusted without consent'
  Assert ($certOutput -match 'trust was not changed') 'Declined trust guidance missing'
  $script:TrustAnswer = 'y'
  Export-CastlinkCertificate $root $state ([pscustomobject]@{caPath='/var/lib/castlink-server/data/server-origin-ca.pem';origin='https://meet.example.com'}) 6>$null
  Assert ($script:ImportedStore -eq 'Cert:\CurrentUser\Root') 'CA imported into wrong certificate store'
  Assert-Throws { Export-CastlinkCertificate $root $state ([pscustomobject]@{caPath='/etc/shadow'}) } 'location'
  [IO.File]::WriteAllText($script:ImportedFile, 'wrong certificate')
  Assert-Throws { Export-CastlinkCertificate $root $state ([pscustomobject]@{caPath='/var/lib/castlink-server/data/server-origin-ca.pem';origin='https://meet.example.com'}) } 'certificate|PEM'
  Remove-Item Function:Read-Host,Function:Import-Certificate
  Set-Item Function:Invoke-CastlinkWsl $originalWslForOwner
  $publicCa.Dispose(); $rsa.Dispose()
  $packageDir = Join-Path $testDir 'package'
  [void][IO.Directory]::CreateDirectory($packageDir)
  $rootfsPath = Join-Path $packageDir 'CastLink-Server-WSL-amd64.tar.gz'
  [IO.File]::WriteAllText($rootfsPath, 'fixture rootfs')
  $rootfsHash = (Get-FileHash $rootfsPath -Algorithm SHA256).Hash.ToLowerInvariant()
  $manifest = @{schemaVersion=1;channel='server-wsl';releaseTag=('server-wsl-v1.0.0-'+('c'*12));repository='resokol/castlink-releases';architecture='amd64';version='1.0.0';sourceCommit=('c'*40);rootfs=@{file='CastLink-Server-WSL-amd64.tar.gz';sha256=$rootfsHash;size=(Get-Item $rootfsPath).Length}}
  $manifestPath = Join-Path $packageDir 'manifest.json'
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4))
  $manifestHash = (Get-FileHash $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-CastlinkPackage $packageDir $manifest.releaseTag $manifest.repository $rootfsHash $manifestHash
  $manifest.rootfs.size = 1
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4))
  $badMetadataHash = (Get-FileHash $manifestPath -Algorithm SHA256).Hash.ToLowerInvariant()
  Assert-Throws { Assert-CastlinkPackage $packageDir $manifest.releaseTag $manifest.repository $rootfsHash $badMetadataHash } 'manifest'
  $manifest.rootfs.size = (Get-Item $rootfsPath).Length
  [IO.File]::WriteAllText($manifestPath, ($manifest | ConvertTo-Json -Depth 4))
  [IO.File]::AppendAllText($rootfsPath, 'tampered')
  Assert-Throws { Assert-CastlinkPackage $packageDir $manifest.releaseTag $manifest.repository $rootfsHash $manifestHash } 'checksum'
  Write-Host 'PASS: server Windows installer behavioral fixtures (PowerShell runtime; WSL is not exercised)'
} finally { Remove-Item -LiteralPath $testDir -Recurse -Force }
