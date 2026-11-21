param([string]$InstallerPath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if(-not $InstallerPath){$InstallerPath=Join-Path $PSScriptRoot '../install-server-windows.ps1'}
. $InstallerPath
function Assert($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Reject([scriptblock]$Block,[string]$Pattern){try{& $Block}catch{Assert ($_.Exception.Message -match $Pattern) ('Unexpected rejection: '+$_.Exception.Message);return};throw ('Expected rejection: '+$Pattern)}
# Removing path validation must fail before any fixture directory is created.
Assert ([bool](Get-Command Assert-CastlinkInstallRoot -ErrorAction SilentlyContinue)) 'Missing external installation path validation API'
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('castlink-location-fixture-'+[guid]::NewGuid().ToString('N'))
$oldAppData=$env:LOCALAPPDATA
[void][IO.Directory]::CreateDirectory($fixture)
$env:LOCALAPPDATA=Join-Path $fixture 'profile'
[void][IO.Directory]::CreateDirectory($env:LOCALAPPDATA)
function New-Receipt([string]$Root){
 [void][IO.Directory]::CreateDirectory($Root)
 Protect-CastlinkInstallationDirectory $Root
 $state=Get-CastlinkInstallation $Root ('server-wsl-v1.0.8-'+('a'*12)) 'resokol/castlink-releases' ('b'*64)
 $state.phase='ready';Save-CastlinkInstallation $Root $state
 Assert ((Get-Acl -LiteralPath (Join-Path $Root 'installation.json')).GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) 'Created receipt owner differs from current user (including elevated tokens)'
 return $state
}
try{
 Assert ([bool](Get-Command Resolve-CastlinkInstallRoot -ErrorAction SilentlyContinue)) 'Missing first-install folder selection API'
 $script:FolderPrompts=0;$script:ChosenFolder=''
 function Read-Host([string]$Prompt){$script:FolderPrompts++;return $script:ChosenFolder}
 $default=Join-Path $env:LOCALAPPDATA 'CastLinkServer'
 Assert ((Resolve-CastlinkInstallRoot '' 'Install' $false) -ceq $default) 'Empty folder answer did not retain default'
 Assert ($script:FolderPrompts -eq 1) 'First install did not prompt once'
 $script:ChosenFolder=Join-Path $fixture 'chosen folder'
 Assert ((Resolve-CastlinkInstallRoot '' 'Install' $false) -ceq $script:ChosenFolder) 'Chosen folder was ignored'
 Assert ((Resolve-CastlinkInstallRoot '' 'Start' $true) -ceq $default) 'Noninteractive management changed default'
 Assert ((Resolve-CastlinkInstallRoot $script:ChosenFolder 'Install' $false) -ceq $script:ChosenFolder) 'Explicit folder was ignored'
 Assert ($script:FolderPrompts -eq 2) 'Explicit/noninteractive path prompted'
 $defaultState=New-Receipt $default
 Assert ((Resolve-CastlinkInstallRoot '' 'Install' $false) -ceq $default) 'Existing default installation was not retained'
 Assert ($script:FolderPrompts -eq 2) 'Existing installation prompted for a different folder'
 Remove-Item Function:Read-Host
 $root=Join-Path $fixture 'outside profile сервер one'
 $parentAcl=(Get-Acl -LiteralPath $fixture).Sddl
 Assert ((Assert-CastlinkInstallRoot $root) -ceq $root) 'External Unicode/spaced folder was changed'
 Assert (-not (Test-Path -LiteralPath $root)) 'Path validation created a directory'
 foreach($bad in @('relative\folder','C:\','\\server\share\folder','\\?\C:\server',(Join-Path $env:WINDIR 'CastLink-test'))){Reject {Assert-CastlinkInstallRoot $bad} 'absolute|local|root|reserved|system'}
 $originalVolume=(Get-Command Get-CastlinkInstallVolume).ScriptBlock
 function Get-CastlinkInstallVolume([string]$Root){[pscustomobject]@{IsReady=$true;DriveType='Fixed';DriveFormat='exFAT';AvailableFreeSpace=100GB}}
 Reject {Assert-CastlinkInstallRoot $root} 'NTFS'
 Set-Item Function:Get-CastlinkInstallVolume $originalVolume
 $link=Join-Path $fixture 'junction'
 $null=New-Item -ItemType Junction -Path $link -Target $env:LOCALAPPDATA
 Reject {Assert-CastlinkInstallRoot (Join-Path $link 'nested')} 'reparse|link'
 [IO.Directory]::Delete($link)
 $foreign=Join-Path $fixture 'foreign';[void][IO.Directory]::CreateDirectory($foreign)
 [IO.File]::WriteAllText((Join-Path $foreign 'foreign.txt'),'preserve')
 Reject {Get-CastlinkInstallation $foreign 'tag' 'repo' 'hash'} 'foreign'
 Assert ([IO.File]::ReadAllText((Join-Path $foreign 'foreign.txt')) -ceq 'preserve') 'Foreign file was changed'
 Assert (@(Get-CastlinkLocationRecords).Count -eq 0) 'Absent registry did not return empty'
 Assert (-not (Test-Path (Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry'))) 'Read created registry'
 $one=New-Receipt $root
 Assert ($one.locationContract -ceq 'castlink-wsl-location-v1') 'New receipt lacks location capability'
 Register-CastlinkLocation $root $one
 $twoRoot=Join-Path $fixture 'outside two';$two=New-Receipt $twoRoot
 Register-CastlinkLocation $twoRoot $two
 $records=@(Get-CastlinkLocationRecords)
 Assert ($records.Count -eq 2) 'Second registration lost first identity'
 $registryRoot=Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry'
 $registry=Join-Path $registryRoot 'installations.json'
 foreach($owned in @($registry,(Join-Path $registryRoot 'locations.lock'))){Assert ((Get-Acl -LiteralPath $owned).GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) 'Created registry file owner differs from current user'}
 $before=[IO.File]::ReadAllText($registry);$timestamp=[IO.File]::GetLastWriteTimeUtc($registry)
 Register-CastlinkLocation $root $one
 Assert ([IO.File]::ReadAllText($registry) -ceq $before) 'Idempotent registration rewrote registry'
 Assert ([IO.File]::GetLastWriteTimeUtc($registry) -eq $timestamp) 'Idempotent registration mutated timestamp'
 Reject {Set-CastlinkLocation $twoRoot $one $twoRoot $root} 'conflict|changed|match'
 Reject {Remove-CastlinkLocation $one.installationId $twoRoot} 'conflict|changed|match'
 Assert ([IO.File]::ReadAllText($registry) -ceq $before) 'Rejected CAS changed registry'
 $moved=Join-Path $fixture 'moved';$movedState=New-Receipt $moved
 $movedState.installationId=$one.installationId;$movedState.distroName=$one.distroName;Save-CastlinkInstallation $moved $movedState
 Reject {Register-CastlinkLocation $moved $movedState} 'conflict|changed|match'
 Set-CastlinkLocation $moved $movedState $root $root
 Assert ((@(Get-CastlinkLocationRecords)|Where-Object logicalId -eq $one.installationId).activeRoot -ceq $moved) 'CAS did not publish active path'
 $publishedTime=[IO.File]::GetLastWriteTimeUtc($registry)
 Set-CastlinkLocation $moved $movedState $root $root
 Assert ([IO.File]::GetLastWriteTimeUtc($registry) -eq $publishedTime) 'Completed publication replay rewrote discovery'
 # Disk loss is discovery metadata, never permission to silently adopt a copy.
 [IO.Directory]::Move($twoRoot,($twoRoot+'-absent'))
 Assert (@(Get-CastlinkLocationRecords).Count -eq 2) 'Missing disk row was silently dropped'
 Reject {Register-CastlinkLocation $twoRoot $two} 'missing|receipt|exist'
 # A registered location must never be silently recreated on a reassigned/missing disk.
 $probe=New-Module -ArgumentList $InstallerPath,$two -ScriptBlock {
  param($source,$receipt);. $source
  $script:PackagedReleaseTag=$receipt.releaseTag;$script:PackagedRepository=$receipt.repository;$script:PackagedRootfsSha256=$receipt.rootfsSha256;$script:PackagedManifestSha256='c'*64
  $script:Action='Install';$script:InstallRoot=$receipt.rootPath;$script:Help=$false;$script:NonInteractive=$false;$script:KeepaliveTask=$false
  $script:ReleaseTag='';$script:Repository='';$script:HostActions=0
  function Assert-CastlinkWindows {}
  function Initialize-CastlinkWsl {$script:HostActions++;throw 'Unexpected WSL initialization before registry conflict'}
  function Invoke-CastlinkWsl {$script:HostActions++;throw 'Unexpected WSL mutation'}
  Export-ModuleMember -Function *
 }
 try{
  foreach($mode in @('absent','empty')){
   if($mode -ceq 'empty'){[void][IO.Directory]::CreateDirectory($twoRoot)}
   $failure='';try{& $probe {Invoke-CastlinkWindowsInstaller}}catch{$failure=$_.Exception.Message}
   Assert (-not (Test-Path -LiteralPath (Join-Path $twoRoot 'installation.json'))) 'Registered path was given a replacement receipt before registry conflict'
   Assert ((& $probe {$script:HostActions}) -eq 0) 'Registered unavailable path reached WSL initialization/import'
   if($mode -ceq 'absent'){Assert (-not (Test-Path -LiteralPath $twoRoot)) 'Missing registered path was silently recreated'}else{Assert (@(Get-ChildItem -LiteralPath $twoRoot -Force).Count -eq 0) 'Empty registered path was modified';[IO.Directory]::Delete($twoRoot)}
   Assert ($failure -match 'registered|registry|repair|unavailable') ('Missing registered-path repair explanation: '+$failure)
  }
 }finally{Remove-Module $probe}
 [IO.Directory]::Move(($twoRoot+'-absent'),$twoRoot)
 $privateAcl=(Get-Acl -LiteralPath $registryRoot).Sddl
 $registryInfo=[IO.FileInfo]::new($registry);$acl=$registryInfo.GetAccessControl([Security.AccessControl.AccessControlSections]'Access, Owner')
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow'));$registryInfo.SetAccessControl($acl)
 Reject {Get-CastlinkLocationRecords} 'private|ACL|permission'
 $acl.RemoveAccessRuleAll([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow'));$registryInfo.SetAccessControl($acl)
 $valid=[IO.File]::ReadAllText($registry);[IO.File]::WriteAllText($registry,'{"schemaVersion":1}')
 Reject {Get-CastlinkLocationRecords} 'registry|schema|invalid'
 [IO.File]::WriteAllText($registry,$valid)
 $copied=Join-Path $fixture 'copied';[void][IO.Directory]::CreateDirectory($copied);Protect-CastlinkInstallationDirectory $copied
 [IO.File]::Copy((Join-Path $moved 'installation.json'),(Join-Path $copied 'installation.json'))
 Reject {Register-CastlinkLocation $copied $movedState} 'identity|root|match|conflict'
 # Independent native processes must preserve all registrations under the lease.
 $jobs=@();foreach($n in 1..3){
  $r=Join-Path $fixture ('concurrent-'+$n);$s=New-Receipt $r
  $jobs+=Start-Job -ScriptBlock {param($i,$a,$r) $ErrorActionPreference='Stop';$env:LOCALAPPDATA=$a;. $i;$s=Get-Content -LiteralPath (Join-Path $r 'installation.json') -Raw|ConvertFrom-Json;Register-CastlinkLocation $r $s} -ArgumentList $InstallerPath,$env:LOCALAPPDATA,$r
 }
 $jobs|Wait-Job|Receive-Job -ErrorAction Stop;$jobs|Remove-Job
 Assert (@(Get-CastlinkLocationRecords).Count -eq 5) 'Concurrent writers lost registrations'
 Remove-CastlinkLocation $one.installationId $moved
 Assert (@(Get-CastlinkLocationRecords).Count -eq 4) 'Exact removal lost unrelated rows'
 Assert ((Get-Acl -LiteralPath $fixture).Sddl -ceq $parentAcl) 'Parent ACL was modified'
 Assert ((Get-Acl -LiteralPath $registryRoot).Sddl -ceq $privateAcl) 'Private registry ACL was modified on repeat'
 # Failed discovery registration must remain explicitly retryable; a completed rerun is read-only.
 $onboardRoot=Join-Path $fixture 'onboarding';$onboard=New-Receipt $onboardRoot
 Assert ([bool](Get-Command Complete-CastlinkLocationRegistration -ErrorAction SilentlyContinue)) 'Missing recoverable location onboarding API'
 $bytes=[IO.File]::ReadAllText($registry)
 [IO.File]::WriteAllText($registry,'invalid')
 Reject {Complete-CastlinkLocationRegistration $onboardRoot $onboard} 'registry'
 Assert ((Get-CastlinkInstallation $onboardRoot $onboard.releaseTag $onboard.repository $onboard.rootfsSha256).locationRegistryPending) 'Failed onboarding lost its recovery marker'
 [IO.File]::WriteAllText($registry,$bytes)
 Complete-CastlinkLocationRegistration $onboardRoot $onboard
 Assert (-not (Get-CastlinkInstallation $onboardRoot $onboard.releaseTag $onboard.repository $onboard.rootfsSha256).locationRegistryPending) 'Successful onboarding did not finish'
 $receiptBytes=[IO.File]::ReadAllText((Join-Path $onboardRoot 'installation.json'));$registryBytes=[IO.File]::ReadAllText($registry)
 Complete-CastlinkLocationRegistration $onboardRoot $onboard
 Assert ([IO.File]::ReadAllText((Join-Path $onboardRoot 'installation.json')) -ceq $receiptBytes) 'Completed onboarding rewrote receipt'
 Assert ([IO.File]::ReadAllText($registry) -ceq $registryBytes) 'Completed onboarding rewrote discovery'
 $onboard.PSObject.Properties.Remove('locationRegistryPending')
 Complete-CastlinkLocationRegistration $onboardRoot $onboard
 Assert ([IO.File]::ReadAllText($registry) -ceq $registryBytes) 'Legacy completed receipt was silently onboarded'
 # Legacy lifecycle source proof may retain its historical Administrators ACL;
 # the newly published active receipt and registry must still be strictly private.
 $legacyRoot=Join-Path $fixture 'legacy-generated';$legacy=New-Receipt $legacyRoot
 $legacyDirectory=[IO.DirectoryInfo]::new($legacyRoot);$acl=$legacyDirectory.GetAccessControl([Security.AccessControl.AccessControlSections]'Access, Owner')
 $acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'),'FullControl','ContainerInherit,ObjectInherit','None','Allow'));$legacyDirectory.SetAccessControl($acl)
 $legacy.phase='maintenance';$legacy|Add-Member NoteProperty maintenanceTransaction ('d'*32);Save-CastlinkInstallation $legacyRoot $legacy
 $nextRoot=Join-Path $fixture 'new-generation';$next=New-Receipt $nextRoot
 $next|Add-Member NoteProperty logicalInstallationId $legacy.installationId;Save-CastlinkInstallation $nextRoot $next
 Set-CastlinkLocation $legacyRoot $next $legacyRoot $legacyRoot
 Assert ((@(Get-CastlinkLocationRecords)|Where-Object logicalId -eq $legacy.installationId).installationId -ceq $next.installationId) 'Verified legacy source did not publish private generation'
 Assert ([bool](Get-Command Assert-CastlinkLocationManagement -ErrorAction SilentlyContinue)) 'Missing interrupted-move management guard'
 Assert-CastlinkLocationManagement $onboardRoot
 $pointer=Join-Path $onboardRoot 'maintenance-transaction.json'
 $tx='f'*32;$op=Join-Path $registryRoot ('operations\'+$tx);[void][IO.Directory]::CreateDirectory($op);Protect-CastlinkInstallationDirectory $op
 $journal=Join-Path $op 'journal.json'
 [IO.File]::WriteAllText($pointer,(@{schemaVersion=1;kind='move';id=$tx;selectedRoot=$onboardRoot;journalSelectedRoot=$root;journal=$journal}|ConvertTo-Json))
 $j=@{schemaVersion=1;kind='move';id=$tx;phase='move-verify';selectedRoot=$root;sourceRoot=$root;destinationRoot=$onboardRoot;journal=$journal;logicalId=$onboard.installationId;source=@{installationId=$onboard.installationId}}
 [IO.File]::WriteAllText($journal,($j|ConvertTo-Json -Depth 5))
 Reject {Assert-CastlinkLocationManagement $onboardRoot} 'move|Recover|recovery'
 $j.phase='completed';[IO.File]::WriteAllText($journal,($j|ConvertTo-Json -Depth 5))
 Assert-CastlinkLocationManagement $onboardRoot
 $j.logicalId='e'*32;[IO.File]::WriteAllText($journal,($j|ConvertTo-Json -Depth 5))
 Reject {Assert-CastlinkLocationManagement $onboardRoot} 'identity|move|recovery'
 [IO.File]::Delete($pointer)
 [IO.File]::WriteAllText((Join-Path $onboardRoot 'relocated-to.json'),'{}')
 Reject {Assert-CastlinkLocationManagement $onboardRoot} 'moved|relocated'
 # A durable reservation owns an absent path until an authenticated imported
 # receipt is published, including across independent installer processes.
 Assert ([bool](Get-Command Reserve-CastlinkInstallLocation -ErrorAction SilentlyContinue)) 'Missing atomic installation-location reservation'
 $reservedRoot=Join-Path $fixture 'reserved new disk folder'
 $reserved=Get-CastlinkInstallation $reservedRoot $one.releaseTag $one.repository $one.rootfsSha256
 Reserve-CastlinkInstallLocation $reservedRoot $reserved
 Assert (-not (Test-Path -LiteralPath $reservedRoot)) 'Reservation created the installation directory'
 $contender=Start-Job -ScriptBlock {
  param($installer,$appData,$root,$tag,$repository,$hash)
  $ErrorActionPreference='Stop';$env:LOCALAPPDATA=$appData;. $installer
  $other=Get-CastlinkInstallation $root $tag $repository $hash
  try{Reserve-CastlinkInstallLocation $root $other;return 'unexpected-reservation'}catch{return $_.Exception.Message}
 } -ArgumentList $InstallerPath,$env:LOCALAPPDATA,$reservedRoot,$one.releaseTag,$one.repository,$one.rootfsSha256
 try{$conflict=$contender|Wait-Job|Receive-Job -ErrorAction Stop;Assert ($conflict -match 'reserv|repair') 'Independent installer stole an absent reserved path'}finally{$contender|Remove-Job}
 [void][IO.Directory]::CreateDirectory($reservedRoot);Protect-CastlinkInstallationDirectory $reservedRoot
 $intruder=Get-CastlinkInstallation $reservedRoot $one.releaseTag $one.repository $one.rootfsSha256;$intruder.phase='imported';Save-CastlinkInstallation $reservedRoot $intruder
 Reject {Register-CastlinkLocation $reservedRoot $intruder} 'reserv'
 Save-CastlinkInstallation $reservedRoot $reserved
 Reserve-CastlinkInstallLocation $reservedRoot $reserved
 $reserved.phase='imported';Save-CastlinkInstallation $reservedRoot $reserved
 Register-CastlinkLocation $reservedRoot $reserved
 Assert (-not (Test-Path -LiteralPath (Get-CastlinkInstallReservationPath $reservedRoot))) 'Published imported receipt retained its reservation'
 # Model only the directory owner lookup; real ACLs and the empty directory must
 # remain unchanged when a pre-existing empty directory belongs to another SID.
 $emptyRoot=Join-Path $fixture 'foreign empty';[void][IO.Directory]::CreateDirectory($emptyRoot)
 $emptyBefore=(Get-Acl -LiteralPath $emptyRoot).Sddl
 $emptyState=Get-CastlinkInstallation $emptyRoot $one.releaseTag $one.repository $one.rootfsSha256
 $actualOwner=(Get-Command Get-CastlinkDirectoryOwner).ScriptBlock
 function Get-CastlinkDirectoryOwner([string]$Root){return 'S-1-5-18'}
 try{Reject {Reserve-CastlinkInstallLocation $emptyRoot $emptyState} 'owner|owned|empty'}finally{Set-Item Function:Get-CastlinkDirectoryOwner $actualOwner}
 Assert ((Get-Acl -LiteralPath $emptyRoot).Sddl -ceq $emptyBefore -and @(Get-ChildItem -LiteralPath $emptyRoot -Force).Count -eq 0) 'Foreign empty directory was adopted or its ACL changed'
 # A logical root and an active-generation path are both reserved identities.
 $crossRoot=Join-Path $fixture 'cross candidate';$cross=New-Receipt $crossRoot
 Reject {Set-CastlinkLocation $nextRoot $cross $crossRoot $crossRoot} 'conflict|registered'
 $logicalPlaceholder=Join-Path $fixture 'unavailable logical root';$otherActive=Join-Path $fixture 'different active generation';$other=New-Receipt $otherActive
 Set-CastlinkLocation $logicalPlaceholder $other $otherActive $otherActive
 $aliasReceipt=New-Receipt $logicalPlaceholder
 Reject {Set-CastlinkLocation (Join-Path $fixture 'unrelated logical root') $aliasReceipt $logicalPlaceholder $logicalPlaceholder} 'conflict|registered'
 $validRegistry=[IO.File]::ReadAllText($registry);$crossed=$validRegistry|ConvertFrom-Json
 $crossed.installations+=@([pscustomobject]@{logicalId=$cross.installationId;installationId=$cross.installationId;selectedRoot=$nextRoot;activeRoot=$crossRoot})
 [IO.File]::WriteAllText($registry,($crossed|ConvertTo-Json -Depth 5))
 Reject {Get-CastlinkLocationRecords} 'conflict|registry'
 [IO.File]::WriteAllText($registry,$validRegistry)
 Assert ([bool](Get-Command Assert-CastlinkUnusedLocation -ErrorAction SilentlyContinue)) 'Missing read-only Move destination claim validation'
 [IO.Directory]::Move($twoRoot,($twoRoot+'-offline'))
 Reject {Assert-CastlinkUnusedLocation $twoRoot} 'registered|location'
 Reject {New-CastlinkMoveDestination $twoRoot} 'registered|location'
 Reject {Assert-CastlinkUnusedLocation $legacyRoot} 'registered|location'
 Reject {Assert-CastlinkUnusedLocation $nextRoot} 'registered|location'
 Assert (-not (Test-Path -LiteralPath $twoRoot)) 'Read-only missing-disk destination validation created a folder'
 [IO.Directory]::Move(($twoRoot+'-offline'),$twoRoot)
 $claimedMove=Join-Path $fixture 'claimed move destination';$claimedState=Get-CastlinkInstallation $claimedMove $one.releaseTag $one.repository $one.rootfsSha256
 Reserve-CastlinkInstallLocation $claimedMove $claimedState
 Reject {Assert-CastlinkUnusedLocation $claimedMove} 'reserv'
 Reject {New-CastlinkMoveDestination $claimedMove} 'reserv'
 Assert (-not (Test-Path -LiteralPath $claimedMove)) 'Move created a folder over an installation reservation'
 $newMove=Join-Path $fixture 'atomic move destination';$staleInstaller=Get-CastlinkInstallation $newMove $one.releaseTag $one.repository $one.rootfsSha256
 $moveLease=New-CastlinkMoveDestination $newMove
 try{
  Assert (Test-Path -LiteralPath (Join-Path $newMove 'operation.lock')) 'Atomic Move destination returned without an operation lease'
  Reject {Reserve-CastlinkInstallLocation $newMove $staleInstaller} 'foreign|reserved|conflict'
  Assert (-not (Test-Path -LiteralPath (Get-CastlinkInstallReservationPath $newMove))) 'Stale installer stole the Move directory after its atomic creation'
 }finally{$moveLease.Dispose()}
 Write-Host 'PASS: external Unicode paths, genuine NTFS/ACL/junction checks, synthetic non-NTFS rejection, registry CAS/corruption/missing disk/concurrent native writers; no WSL/product actions'
}finally{$env:LOCALAPPDATA=$oldAppData;Remove-Item -LiteralPath $fixture -Recurse -Force}
