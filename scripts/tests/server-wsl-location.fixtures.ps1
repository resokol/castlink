param([string]$ScratchRoot=$env:TEMP,[string]$Only='',[string]$SecondVolumeRoot='')
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -FunctionsOnly
function Assert($v,$m){if(-not $v){throw $m}}
function Throws([scriptblock]$b,[string]$p){try{& $b}catch{if($_.Exception.Message -match $p){return};throw};throw "Expected refusal $p"}
if(-not (Get-Command Invoke-CastlinkMove -ErrorAction SilentlyContinue)){throw 'Expected RED: durable Move API is missing'}
# Receipts bind canonical paths; CI TEMP may use an existing 8.3 user-profile alias.
$testRoot=Assert-CLMPath (Join-Path $ScratchRoot ('castlink-move-fixtures-'+[guid]::NewGuid().ToString('N')));[void][IO.Directory]::CreateDirectory($testRoot)
$priorAppData=$env:LOCALAPPDATA;$env:LOCALAPPDATA=Join-Path $testRoot 'profile';[void][IO.Directory]::CreateDirectory($env:LOCALAPPDATA)
$script:passes=0
function Test($n,[scriptblock]$b){if($Only -and $n -notlike $Only){return};& $b;$script:passes++;Write-Output ('PASS '+$n)}
function Fixture([bool]$Running=$true,[bool]$Generation=$false,[bool]$Private=$true){
 $base=Join-Path $testRoot ([guid]::NewGuid().ToString('N'));$selected=Join-Path $base 'selected';$root=if($Generation){Join-Path $base 'generation'}else{$selected};$dest=Join-Path $base 'new location';foreach($p in @($selected,$root)){if($Private){Protect-CLMDirectory $p}else{[void][IO.Directory]::CreateDirectory($p)}}
 $s=[pscustomobject]@{schemaVersion=1;installationId=('a'*32);logicalInstallationId=('b'*32);distroName=('CastLink-Server-'+('a'*12));rootPath=$root;releaseTag='server-wsl-v1.0.8-cccccccccccc';repository='resokol/castlink';rootfsSha256=('d'*64);phase='ready';desiredRunning=$Running;autoStartAtLogon=$false;locationContract='castlink-wsl-location-v1'}
 Write-CLMJson (Join-Path $root 'installation.json') $s
 [void][IO.Directory]::CreateDirectory((Join-Path $root 'distribution'));[IO.File]::WriteAllText((Join-Path $root 'distribution\ext4.vhdx'),'synthetic disk')
 if($Generation){Write-CLMJson (Join-Path $selected 'active-generation.json') @{schemaVersion=1;selectedRoot=$selected;activeRoot=$root;installationId=$s.installationId}}
 $w=@{source=$s;events=(New-Object Collections.Generic.List[string]);registration=(Join-Path $root 'distribution');running=$Running;taskEnabled=$false;moves=0;disk=999999999999L;files=@();archives=@();fail='';late=$false;identity=$s.installationId;conflict=$false}
 $writePrivateJson=(Get-Command Write-CLMJson).ScriptBlock;$protectPrivateDirectory=(Get-Command Protect-CLMDirectory).ScriptBlock
 $a={param($name,$ctx,$data);$w.events.Add($name);if($w.fail -ceq $name){throw ('Injected '+$name)}
 switch($name){
 'MovePreflight' {if($w.conflict){throw 'Registry identity conflict'};$ctx.source=$w.source;$ctx.task=[pscustomobject]@{exists=$true;enabled=$w.taskEnabled};$ctx.ownedFiles=@($w.files);$ctx.archiveFiles=@($w.archives);$ctx.requiredBytes=1024;$ctx.freeBytes=$w.disk;$ctx.sourceVhdBytes=1024}
 'MoveRegistration' {return [pscustomobject]@{basePath=$w.registration;installationId=$w.identity;distroName=$w.source.distroName;registrationId='fixture-registration';vhdFile='ext4.vhdx'}}
 'MoveQuiesce' {$w.running=$false;$w.taskEnabled=$false}
 'MoveDistribution' {$w.moves++;[void][IO.Directory]::CreateDirectory((Join-Path $ctx.destinationRoot 'distribution'));[IO.File]::Move((Join-Path $ctx.sourceRoot 'distribution\ext4.vhdx'),(Join-Path $ctx.destinationRoot 'distribution\ext4.vhdx'));$w.registration=Join-Path $ctx.destinationRoot 'distribution';if($w.late){$w.late=$false;throw 'WSL returned error after move'}}
 'MoveBindings' {& $protectPrivateDirectory $ctx.destinationRoot;$s=$ctx.source|ConvertTo-Json -Depth 32|ConvertFrom-Json;$s.rootPath=$ctx.destinationRoot;$s.phase='ready';& $writePrivateJson (Join-Path $ctx.destinationRoot 'installation.json') $s;return $s}
 'MoveVerify' {if($ctx.source.desiredRunning){$w.running=$true};return $true}
 'MovePublish' {$w.taskEnabled=$ctx.task.enabled}
 'MoveFinish' {}
 'MoveCancelRestore' {$w.running=[bool]$ctx.source.desiredRunning;$w.taskEnabled=[bool]$ctx.task.enabled}
 default {throw ('Unexpected adapter '+$name)}
 }}.GetNewClosure()
 return @{root=$root;selected=$selected;dest=$dest;world=$w;adapter=$a}
}
function RunMove($f){Invoke-CastlinkMove -InstallRoot $f.selected -DestinationRoot $f.dest -Confirmation $f.world.source.distroName -Adapter $f.adapter}
try{
 Test 'synthetic owned roots and receipts satisfy production private ownership' {$f=Fixture;Assert-CLMPrivatePath $f.root;Assert-CLMPrivatePath (Join-Path $f.root 'installation.json');$null=RunMove $f;Assert-CLMPrivatePath $f.dest;Assert-CLMPrivatePath (Join-Path $f.dest 'installation.json')}
 Test 'running same-release move retains one registration and task preference' {$f=Fixture;$r=RunMove $f;Assert ($r.phase -ceq 'completed') 'Move incomplete';Assert ($f.world.moves -eq 1 -and $f.world.running -and -not $f.world.taskEnabled) 'State lost';Assert ($r.source.releaseTag -ceq $r.destination.releaseTag) 'Release changed'}
 Test 'logical source moves actual active generation' {$f=Fixture $true $true;$r=RunMove $f;Assert ($r.sourceRoot -ceq $f.root) 'Moved selected stub';Assert ((Read-CLMReceipt $f.dest).logicalInstallationId -ceq ('b'*32)) 'Logical identity lost';Throws {Get-CLMRoot $f.selected} 'relocated'}
 Test 'stopped source never starts publicly' {$f=Fixture $false;$null=RunMove $f;Assert (-not $f.world.running) 'Stopped source started'}
 Test 'old release requires explicit upgrade before side effects' {$f=Fixture;$f.world.source.PSObject.Properties.Remove('locationContract');Throws {RunMove $f} 'upgrade';Assert ($f.world.moves -eq 0 -and $f.world.running) 'Old release mutated'}
 Test 'free-space failure precedes quiescing' {$f=Fixture;$f.world.disk=1;Throws {RunMove $f} 'space';Assert ($f.world.running -and -not (Test-Path $f.dest)) 'Preflight changed source'}
 Test 'duplicate identity rejected before stop' {$f=Fixture;$f.world.conflict=$true;Throws {RunMove $f} 'conflict';Assert $f.world.running 'Conflict stopped source'}
 Test 'late native move failure reconciles actual registration on recovery' {$f=Fixture;$f.world.late=$true;Throws {RunMove $f} 'after move';$r=Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Adapter $f.adapter;Assert ($r.phase -ceq 'completed' -and $f.world.moves -eq 1) 'Blindly repeated move'}
 Test 'completed replay verifies without mutation' {$f=Fixture;$null=RunMove $f;$f.world.events.Clear();$r=Invoke-CastlinkMove -InstallRoot $f.dest -Recover -Adapter $f.adapter;Assert ($f.world.events.Count -eq 1 -and $f.world.events[0] -ceq 'MoveRegistration') 'Completed replay mutated'}
 Test 'altered destination receipt fails recovery' {$f=Fixture;$f.world.fail='MoveVerify';Throws {RunMove $f} 'Injected';$s=Read-CLMReceipt $f.dest;$s.installationId=('e'*32);Write-CLMJson (Join-Path $f.dest 'installation.json') $s;$f.world.fail='';Throws {Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Adapter $f.adapter} 'identity|ownership'}
 Test 'lost registration does not retry move' {$f=Fixture;$f.world.fail='MoveBindings';Throws {RunMove $f} 'Injected';$f.world.registration=Join-Path $testRoot 'unknown';$f.world.fail='';Throws {Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Adapter $f.adapter} 'registration';Assert ($f.world.moves -eq 1) 'Repeated uncertain move'}
 foreach($phase in @('move-prepared','move-quiesce','move-copy','move-wsl','move-bindings','move-verify','move-publish','move-finish','move-cleanup')){Test ('resume durable '+$phase) {$f=Fixture;$stop=$phase;$progress={param($p);if($p -ceq $stop){throw ('Crash '+$p)}}.GetNewClosure();Throws {Invoke-CastlinkMove -InstallRoot $f.selected -DestinationRoot $f.dest -Confirmation $f.world.source.distroName -Adapter $f.adapter -Progress $progress} 'Crash';$r=Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Adapter $f.adapter;Assert ($r.phase -ceq 'completed' -and $f.world.moves -eq 1) 'Phase recovery failed'}}

 Test 'pending move blocks direct source controls' {$f=Fixture;$f.world.fail='MoveDistribution';Throws {RunMove $f} 'Injected';Throws {Get-CLMRoot $f.selected} 'Pending.*move|pending.*move'}
 Test 'location-aware lifecycle storage stays inside selected root' {$f=Fixture;$storage=Get-CLMStorageRoot $f.root;Assert ($storage -ceq $f.root) 'Lifecycle storage escaped selected directory'}
 Test 'move rejects stale binding bytes before rewriting' {$f=Fixture;$null=RunMove $f;$f.world.events.Clear();$s=Read-CLMReceipt $f.dest;$s.releaseTag='server-wsl-v1.0.9-cccccccccccc';Write-CLMJson (Join-Path $f.dest 'installation.json') $s;Throws {Invoke-CastlinkMove -InstallRoot $f.dest -Recover -Adapter $f.adapter} 'identity'}

 Test 'registry discovers external roots and preserves missing disk entries' {
  $f=Fixture;$registry=Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry';Protect-CLMDirectory $registry
  Write-CLMJson (Join-Path $registry 'installations.json') @{schemaVersion=1;owner='castlink-wsl-location-v1';userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;installations=@(@{logicalId=('b'*32);installationId=('a'*32);selectedRoot=$f.selected;activeRoot=$f.root},@{logicalId=('e'*32);installationId=('f'*32);selectedRoot='Z:\AbsentCastLink';activeRoot='Z:\AbsentCastLink'})}
  $rows=@(Get-CastlinkMaintenanceInstallations);Assert (@($rows|Where-Object {$_.root -ceq $f.selected}).Count -eq 1) 'External server omitted';Assert (@($rows|Where-Object {$_.root -ceq 'Z:\AbsentCastLink' -and $_.state -ceq 'unavailable'}).Count -eq 1) 'Missing disk silently dropped'
 }

 Test 'new lifecycle directories satisfy strict installer registry ACL' {
  $p=Join-Path $testRoot 'strict lifecycle';Protect-CLMDirectory $p
  $acl=Get-Acl -LiteralPath $p;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  Assert ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq $sid) 'Lifecycle directory owner differs'
  Assert (@($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|Where-Object {$_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -notin @($sid,'S-1-5-18')}).Count -eq 0) 'Lifecycle directory ACL exceeds registry policy'
 }
 Test 'unknown destination file blocks recovery without deleting it' {$f=Fixture;$f.world.fail='MoveBindings';Throws {RunMove $f} 'Injected';$alien=Join-Path $f.dest 'foreign.txt';[IO.File]::WriteAllText($alien,'unrelated');$f.world.fail='';Throws {Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Adapter $f.adapter} 'unknown|Unknown';Assert (Test-Path $alien) 'Foreign file deleted'}

 Test 'move cleans only verified archived payload copies after publication' {
  $f=Fixture;$payload=Join-Path $f.root 'archive.tar.gz';[IO.File]::WriteAllText($payload,'owned source archive');$entry=[pscustomobject]@{path=$payload;sha256=(Get-CLMHash $payload)};$f.world.files=@($entry);$f.world.archives=@($entry);$foreign=Join-Path $f.root 'foreign.txt';[IO.File]::WriteAllText($foreign,'unrelated');$null=RunMove $f
  Assert (-not (Test-Path $payload)) 'Owned source archive remained';Assert (Test-Path (Join-Path $f.dest 'archive.tar.gz')) 'Destination archive missing';Assert (Test-Path $foreign) 'Unknown source file deleted'
 }

 Test 'default WSL adapter uses exact targeted official move on either volume' {
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;$script:calls=New-Object Collections.Generic.List[object];function Assert-CLMGuestMarker($State){};function Assert-CLMStopped($State){};function Wait-CLMMoveVhdRelease($Ctx){$script:calls.Add(@('wait-vhd'))};function Invoke-CLMProcess($Exe,$Arguments,$InputFile,$OutputFile,$Limit,$Timeout){$script:calls.Add(@($Arguments))};Export-ModuleMember -Function *}
  try{foreach($drive in @('C','D')){$c=@{source=[pscustomobject]@{distroName='CastLink-Server-aaaaaaaaaaaa'};destinationRoot=($drive+':\Fixture location')}; & $module {param($c);Invoke-CLMMoveDefaultAdapter 'MoveDistribution' $c} $c};$calls=& $module {$script:calls.ToArray()};Assert ($calls.Count -eq 6) 'Unexpected native operations';Assert ($calls[0][0] -ceq '--terminate' -and $calls[1][0] -ceq 'wait-vhd' -and $calls[2][0] -ceq '--manage' -and $calls[2][2] -ceq '--move' -and $calls[4][0] -ceq 'wait-vhd' -and $calls[5][3] -ceq 'D:\Fixture location\distribution') 'Official move arguments differ'}finally{Remove-Module $module}
 }
 Test 'old WSL version refuses before reading installation or guest' {
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Invoke-CLMProcess($Exe,$Arguments){return 'WSL version: 2.4.13.0'};function Read-CLMReceipt {throw 'Unexpected source access'};Export-ModuleMember -Function *}
  try{Throws {& $module {Invoke-CLMMoveDefaultAdapter 'MovePreflight' @{}}} 'WSL 3.0.1.*wsl --update'}finally{Remove-Module $module}
 }

 Test 'replayed quiesce proves guest ownership before changing task or services' {
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Assert-CLMGuestMarker($State){throw 'Foreign guest proof refused'};function Sync-CLMKeepaliveReceipt($Root,$State,$Module){return $State};function Invoke-CLMDefaultAdapter {throw 'Unexpected task mutation'};Export-ModuleMember -Function *}
  try{Throws {& $module {Invoke-CLMMoveDefaultAdapter 'MoveQuiesce' @{sourceModule='synthetic';source=[pscustomobject]@{installationId=('a'*32)}}}} 'Foreign guest proof refused'}finally{Remove-Module $module}
 }

 Test 'completed move permits Check Update Remove and a second Move' {
  foreach($action in @('Update','Remove','Move')){
   $f=Fixture;$moved=RunMove $f;Protect-CLMDirectory $moved.directory;$f.world.source=Read-CLMReceipt $f.dest
   $a={param($name,$ctx,$data)
    switch($name){
     'VerifySource' {return [IO.File]::ReadAllText((Join-Path $ctx.sourceRoot 'installation.json'))|ConvertFrom-Json}
     'VerifyTarget' {return [pscustomobject]@{releaseTag='server-wsl-v1.0.9-eeeeeeeeeeee';rootfs=[pscustomobject]@{expandedBytes=1024;sha256=('e'*64)};lifecycle=[pscustomobject]@{locationContract='castlink-wsl-location-v1'}}}
     'InspectSource' {return [pscustomobject]@{initialized=$true;complete=$true;postgresMajor=16;dataBytes=1}}
     'FreeBytes' {return 999999999999L}
     'SourceTask' {return [pscustomobject]@{exists=$false;enabled=$false}}
     'ExportTransfer' {[IO.File]::WriteAllText($ctx.transfer,'synthetic transfer')}
     'ImportCandidate' {Protect-CLMDirectory $ctx.candidateRoot;Write-CLMJson (Join-Path $ctx.candidateRoot 'installation.json') $ctx.candidate}
     'CandidateReady' {return [pscustomobject]@{ready=$true}}
     'PrepareBindings' {$ctx.candidate.phase='ready';Write-CLMJson (Join-Path $ctx.candidateRoot 'installation.json') $ctx.candidate;return $ctx.candidate}
    }
   }
   $check=Invoke-CastlinkMaintenance Check $f.dest -TargetDirectory 'synthetic package' -ExpectedManifestSha256 ('a'*64) -Adapter $a
   Assert ($check.source.rootPath -ceq $f.dest) 'Check selected stale source'
   if($action -ceq 'Move'){$next=Join-Path (Split-Path $f.dest -Parent) 'second destination';$r=Invoke-CastlinkMove -InstallRoot $f.dest -DestinationRoot $next -Confirmation $f.world.source.distroName -Adapter $f.adapter;Assert ($r.phase -ceq 'completed' -and $f.world.moves -eq 2) 'Second Move failed'}
   else{$r=Invoke-CastlinkMaintenance -Action $action -InstallRoot $f.dest -TargetDirectory 'synthetic package' -ExpectedManifestSha256 ('a'*64) -Confirmation $f.world.source.distroName -EraseData:($action -ceq 'Remove') -Adapter $a;Assert ($r.phase -cin @('completed','removed')) 'Post-Move lifecycle failed'}
  }
 }
 Test 'relocated shortcut is proved by its completed private move journal' {
  $f=Fixture;$moved=RunMove $f;$shortcut=Join-Path $f.dest 'CastLinkServer.lnk';[IO.File]::WriteAllText($shortcut,'synthetic owned shortcut');$moved.entryPointHash=Get-CLMHash $shortcut;Save-CLMJournal $moved 'completed';Protect-CLMDirectory $moved.directory
  $c=@{selectedRoot=$f.dest};Assert-CLMEntryPoint $c;Assert ($c.entryPointBeforeHash -ceq $moved.entryPointHash) 'Move shortcut not recognized'
  [IO.File]::WriteAllText($shortcut,'foreign shortcut');Throws {Assert-CLMEntryPoint $c} 'Unknown|changed'
 }
 Test 'nonprivate self-pinned move source cannot execute installer code' {
  $f=Fixture $true $false $false;$release=Join-Path $f.root 'release';[void][IO.Directory]::CreateDirectory($release);$helpers=@()
  foreach($name in @('server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-maintenance.py','server-wsl-runtime.py','server-wsl-location.ps1','install-server-windows.template.ps1')){$p=Join-Path $release $name;[IO.File]::WriteAllText($p,$(if($name -ceq 'install-server-windows.template.ps1'){'throw "UNTRUSTED INSTALLER EXECUTED"'}else{'synthetic helper'}));$helpers+=[pscustomobject]@{file=$name;sha256=(Get-CLMHash $p);size=(Get-Item $p).Length}}
  $manifest=Join-Path $release 'manifest.json';Write-CLMJson $manifest @{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';architecture='amd64';version='1.0.8';sourceCommit=('c'*40);releaseTag=$f.world.source.releaseTag;rootfs=@{sha256=$f.world.source.rootfsSha256};lifecycle=@{schemaVersion=1;runtimeContract='castlink-wsl-pg16-v1';postgresMajor=16;locationContract='castlink-wsl-location-v1';helpers=$helpers}}
  $s=$f.world.source;$s|Add-Member NoteProperty releaseManifestSha256 (Get-CLMHash $manifest);Write-CLMJson (Join-Path $f.root 'installation.json') $s
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Invoke-CLMProcess($Exe,$Arguments){if($Arguments[0] -ceq '--version'){return '3.0.1'};return '--move'};Export-ModuleMember -Function *}
  try{Throws {& $module {param($r);Invoke-CLMMoveDefaultAdapter MovePreflight @{sourceRoot=$r;selectedRoot=$r;destinationRoot=($r+'-dest')}} $f.root} 'not private'}finally{Remove-Module $module}
 }

 Test 'partial owned copy staging resumes and publishes only verified bytes' {
  $f=Fixture;$payload=Join-Path $f.root 'large.bin';[IO.File]::WriteAllText($payload,('payload'*1000));$f.world.files=@([pscustomobject]@{path=$payload;sha256=(Get-CLMHash $payload)})
  Throws {Invoke-CastlinkMove -InstallRoot $f.selected -DestinationRoot $f.dest -Confirmation $f.world.source.distroName -Adapter $f.adapter -Progress {param($p);if($p -ceq 'move-copy'){throw 'Copy crash'}}} 'Copy crash'
  $j=Read-CLMMoveJournal $f.selected $true;Assert ($j.copyPlan -and @($j.copyPlan).Count -eq 1) 'Copy staging inventory missing';$entry=$j.copyPlan[0];[IO.File]::WriteAllText($entry.stage,'partial');$null=Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Adapter $f.adapter
  Assert ((Get-CLMHash $entry.path) -ceq (Get-CLMHash $payload) -and -not (Test-Path $entry.stage)) 'Partial copy was not atomically repaired'
 }
 Test 'pre-VHD cancellation restores source running task and only removes owned copies' {
  $f=Fixture;$f.world.taskEnabled=$true;$payload=Join-Path $f.root 'owned.bin';[IO.File]::WriteAllText($payload,'owned');$f.world.files=@([pscustomobject]@{path=$payload;sha256=(Get-CLMHash $payload)});$f.world.fail='MoveDistribution';Throws {RunMove $f} 'Injected';$foreign=Join-Path $f.dest 'foreign.txt';[IO.File]::WriteAllText($foreign,'unrelated');$f.world.fail=''
  $r=Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Cancel -Confirmation $f.world.source.distroName -Adapter $f.adapter
  Assert ($r.phase -ceq 'cancelled' -and $f.world.running -and $f.world.taskEnabled -and $f.world.moves -eq 0) 'Cancellation did not restore state';Assert (-not (Test-Path (Join-Path $f.dest 'owned.bin')) -and (Test-Path $foreign)) 'Cancellation cleanup ownership violated';Assert ((Get-CLMRoot $f.selected) -ceq $f.root) 'Source stayed gated'
 }
 Test 'late move phases recheck running readiness after reboot' {
  foreach($phase in @('move-publish','move-finish','move-cleanup')){$f=Fixture;$stop=$phase;$progress={param($p);if($p -ceq $stop){throw 'Reboot'}}.GetNewClosure();Throws {Invoke-CastlinkMove -InstallRoot $f.selected -DestinationRoot $f.dest -Confirmation $f.world.source.distroName -Adapter $f.adapter -Progress $progress} 'Reboot';$f.world.running=$false;$f.world.events.Clear();$null=Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Adapter $f.adapter;Assert ($f.world.running -and $f.world.events.Contains('MoveVerify')) ('Reboot left moved server stopped: '+$phase)}
 }
 Test 'source and destination VHD conflict prevents success and preserves both' {
  $f=Fixture;$null=RunMove $f;[IO.File]::WriteAllText((Join-Path $f.root 'distribution\ext4.vhdx'),'residual disk');Throws {Invoke-CastlinkMove -InstallRoot $f.dest -Recover -Adapter $f.adapter} 'VHD|disk';Assert ((Test-Path (Join-Path $f.root 'distribution\ext4.vhdx')) -and (Test-Path (Join-Path $f.dest 'distribution\ext4.vhdx'))) 'Conflicting VHD deleted'
 }
 Test 'recovery rereads journal under leases before any effects' {
  $f=Fixture;Throws {Invoke-CastlinkMove -InstallRoot $f.selected -DestinationRoot $f.dest -Confirmation $f.world.source.distroName -Adapter $f.adapter -Progress {param($p);if($p -ceq 'move-prepared'){throw 'Pause'}}} 'Pause';$f.world.events.Clear()
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;$script:readMove=(Get-Command Read-CLMMoveJournal).ScriptBlock;$script:reads=0;function Read-CLMMoveJournal($Root,$Fixture){$j=& $script:readMove $Root $Fixture;$script:reads++;if($script:reads -eq 1){$changed=Copy-CLMObject $j;$changed.phase='move-bindings';Write-CLMJson $j.journal $changed};return $j};Export-ModuleMember -Function *}
  try{Throws {& $module {param($r,$a);Invoke-CastlinkMove -InstallRoot $r -Recover -Adapter $a} $f.selected $f.adapter} 'registration';Assert (-not $f.world.events.Contains('MoveQuiesce') -and $f.world.moves -eq 0) 'Stale journal caused effects'}finally{Remove-Module $module}
 }
 Test 'download budget measures target package volume before receiving bytes' {
  $f=Fixture;$package=Join-Path $f.root 'target-package';[void][IO.Directory]::CreateDirectory($package);$manifest=@{repository='resokol/castlink';channel='server-wsl';releaseTag='server-wsl-v1.0.9-eeeeeeeeeeee';lifecycle=@{runtimeContract='castlink-wsl-pg16-v1';supportedSources=@($f.world.source.releaseTag);helpers=@()};rootfs=@{file='rootfs.tar.gz';size=1024;sha256=('e'*64)}};Write-CLMJson (Join-Path $package 'manifest.json') $manifest
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Get-CLMDownloadFreeBytes($Path){$script:measured=$Path;return 0};function Receive-CLMAsset {throw 'Unexpected download before disk proof'};Export-ModuleMember -Function *}
  try{$ctx=@{targetDirectory=$package;manifestSha256=(Get-CLMHash (Join-Path $package 'manifest.json'));source=$f.world.source};Throws {& $module {param($c);Receive-CLMTarget $c} $ctx} 'download disk space';Assert ((& $module {$script:measured}) -ceq $package) 'Measured wrong download volume'}finally{Remove-Module $module}
 }

 Test 'registered unavailable destination is rejected before quiesce' {
  $f=Fixture;$registry=Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry';Protect-CLMDirectory $registry;Write-CLMJson (Join-Path $registry 'installations.json') @{schemaVersion=1;owner='castlink-wsl-location-v1';userSid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;installations=@(@{logicalId=('e'*32);installationId=('f'*32);selectedRoot=$f.dest;activeRoot=$f.dest})}
  Throws {RunMove $f} 'registered|reserved';Assert ($f.world.running -and $f.world.moves -eq 0 -and -not (Test-Path $f.dest)) 'Reserved target mutated source'
 }
 Test 'private lifecycle files and directories retain current owner on each supplied volume' {
  foreach($base in @($ScratchRoot,$SecondVolumeRoot)|Where-Object {$_}){
   $dir=Join-Path $base ('CastLinkLifecycleAclFixture-'+[guid]::NewGuid().ToString('N'));Assert (-not (Test-Path $dir)) 'Fixture root collision';Protect-CLMDirectory $dir;$file=Join-Path $dir 'private.json';Write-CLMJson $file @{value=1};Write-CLMJson $file @{value=2};$copy=Join-Path $dir 'copy.json';Copy-CLMMovePayload $file $copy ($copy+'.part') (Get-CLMHash $file) ((Get-Item $file).Length)
   foreach($p in @($dir,$file,$copy)){Assert-CLMPrivatePath $p;$acl=Get-Acl -LiteralPath $p;Assert ($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -ceq [Security.Principal.WindowsIdentity]::GetCurrent().User.Value) ('Wrong owner on '+$p)}
  }
 }

 Test 'supported WSL does not rely on help returning exit zero' {
  $f=Fixture $true $false $false;$module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Invoke-CLMProcess($Exe,$Arguments){if($Arguments[0] -ceq '--version'){return 'WSL version: 3.0.1.0'};throw 'WSL help exits -1'};Export-ModuleMember -Function *}
  try{Throws {& $module {param($r);Invoke-CLMMoveDefaultAdapter MovePreflight @{sourceRoot=$r;selectedRoot=$r}} $f.root} 'not private'}finally{Remove-Module $module}
 }

 Test 'stopped move verification rejects wrong guest build without starting services' {
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Sync-CLMKeepaliveReceipt($Root,$State,$Module){return $State};function Assert-CLMGuestMarker($State){};function Assert-CLMStopped($State){};function Invoke-CLMGuest {return '{"initialized":true,"complete":true,"postgresMajor":16,"stopped":true,"release":{"buildId":"wrong"},"gate":"closed","gateTransactionId":"owned"}'};function Invoke-CLMWsl {throw 'Unexpected service start'};Export-ModuleMember -Function *}
  try{Throws {& $module {Invoke-CLMMoveDefaultAdapter MoveVerify @{sourceModule='synthetic';id='owned';source=[pscustomobject]@{desiredRunning=$false;releaseTag='server-wsl-v1.0.8-cccccccccccc'};destination=[pscustomobject]@{}}}} 'guest build'}finally{Remove-Module $module}
 }
 Test 'partial move shortcut staging is recognized and atomically republished' {
  $f=Fixture;$ctx=RunMove $f;$source=Join-Path $ctx.directory 'active-panel.lnk';[IO.File]::WriteAllText($source,'verified shortcut');$ctx.entryPointHash=Get-CLMHash $source;$target=Join-Path $f.dest 'CastLinkServer.lnk';$partial=Join-Path $f.dest ($ctx.id+'.new.lnk');[IO.File]::WriteAllText($partial,'partial');Save-CLMJournal $ctx 'move-publish';Assert-CLMMoveDestination $ctx;Copy-CLMMovePayload $source $target $partial $ctx.entryPointHash ((Get-Item $source).Length);Assert ((Get-CLMHash $target) -ceq $ctx.entryPointHash -and -not (Test-Path $partial)) 'Shortcut stage did not resume'
 }

 Test 'cancellation cleanup resumes source readiness after reboot' {
  $f=Fixture;$f.world.fail='MoveDistribution';Throws {RunMove $f} 'Injected';$f.world.fail=''
  Throws {Invoke-CastlinkMove -InstallRoot $f.selected -Recover -Cancel -Confirmation $f.world.source.distroName -Adapter $f.adapter -Progress {param($p);if($p -ceq 'move-cancel-cleanup'){throw 'Cancel reboot'}}} 'Cancel reboot'
  $f.world.running=$false;$r=Invoke-CastlinkMove -InstallRoot $f.dest -Recover -Adapter $f.adapter;Assert ($r.phase -ceq 'cancelled' -and $f.world.running) 'Cancelled server stayed stopped after reboot'
 }
 Test 'release chooser stores authenticated cache on selected installation volume' {
  $f=Fixture;$root=$f.root;if($SecondVolumeRoot){$root=Join-Path $SecondVolumeRoot ('CastLinkChooserFixture-'+[guid]::NewGuid().ToString('N'))};Protect-CLMDirectory $root;$s=Copy-CLMObject $f.world.source;$s.rootPath=$root;Write-CLMJson (Join-Path $root 'installation.json') $s
  $bytes='{"schemaVersion":1,"synthetic":true}';$file=Join-Path $testRoot 'chooser-manifest.json';[IO.File]::WriteAllText($file,$bytes);$choice=[pscustomobject]@{releaseTag='server-wsl-v1.0.9-eeeeeeeeeeee';manifestSha256=(Get-CLMHash $file);manifestSize=(Get-Item $file).Length}
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1'),$bytes -ScriptBlock {param($manager,$bytes);. $manager -FunctionsOnly;$script:manifestBytes=$bytes;function Receive-CLMAsset($Url,$Path,$Limit){$stream=New-CLMPrivateFileStream $Path;try{$b=[Text.Encoding]::UTF8.GetBytes($script:manifestBytes);$stream.Write($b,0,$b.Length);$stream.Flush($true)}finally{$stream.Dispose()}};Export-ModuleMember -Function *}
  try{$r=& $module {param($c,$root);Receive-CastlinkWslReleaseManifest $c $root} $choice $root;Assert ($r.directory.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase)) 'Chooser cache escaped installation volume';Assert-CLMPrivatePath (Join-Path $r.directory 'manifest.json')}finally{Remove-Module $module}
 }

 Test 'VHD release wait observes a real sharing lock without launching WSL' {
  $f=Fixture;$vhd=Join-Path $f.root 'distribution\ext4.vhdx';$reg=[pscustomobject]@{basePath=(Join-Path $f.root 'distribution');vhdFile='ext4.vhdx';distroName=$f.world.source.distroName;installationId=$f.world.source.installationId;registrationId='fixture-registration'};$ctx=@{source=$f.world.source;sourceRoot=$f.root;destinationRoot=$f.dest;registration=$reg}
  $lock=[IO.File]::Open($vhd,'Open','Read','None')
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1'),$reg,$lock -ScriptBlock {param($manager,$reg,$heldLock);. $manager -FunctionsOnly;$script:registration=$reg;$script:heldLock=$heldLock;$script:reads=0;function Get-CLMWslRegistration($State){$script:reads++;if($script:reads -eq 2){$script:heldLock.Dispose()};return $script:registration};function Invoke-CLMProcess {throw 'Unexpected process during VHD wait'};function Invoke-CLMWsl {throw 'Unexpected guest during VHD wait'};Export-ModuleMember -Function *}
  try{& $module {param($ctx);Wait-CLMMoveVhdRelease $ctx -TimeoutMilliseconds 3000 -PollMilliseconds 25} $ctx;Assert ((& $module {$script:reads}) -eq 3) 'Did not retry locked probe and revalidate';$probe=[IO.File]::Open($vhd,'Open','Read','None');$probe.Dispose()}finally{$lock.Dispose();Remove-Module $module}
 }
 Test 'VHD release wait times out and preserves busy disk' {
  $f=Fixture;$vhd=Join-Path $f.root 'distribution\ext4.vhdx';$reg=[pscustomobject]@{basePath=(Join-Path $f.root 'distribution');vhdFile='ext4.vhdx';distroName=$f.world.source.distroName;installationId=$f.world.source.installationId;registrationId='fixture-registration'};$ctx=@{source=$f.world.source;sourceRoot=$f.root;destinationRoot=$f.dest;registration=$reg}
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1'),$reg -ScriptBlock {param($manager,$reg);. $manager -FunctionsOnly;$script:registration=$reg;function Get-CLMWslRegistration($State){return $script:registration};Export-ModuleMember -Function *}
  $lock=[IO.File]::Open($vhd,'Open','Read','None');try{Throws {& $module {param($ctx);Wait-CLMMoveVhdRelease $ctx -TimeoutMilliseconds 150 -PollMilliseconds 25} $ctx} 'VHD.*busy.*Docker.*Recover';Assert (Test-Path $vhd) 'Busy disk removed'}finally{$lock.Dispose();Remove-Module $module}
 }
 Test 'VHD release wait refuses changed registration and residual destination disk' {
  foreach($change in @('identity','destination','identity-after-release')){
   $f=Fixture;$vhd=Join-Path $f.root 'distribution\ext4.vhdx';$reg=[pscustomobject]@{basePath=(Join-Path $f.root 'distribution');vhdFile='ext4.vhdx';distroName=$f.world.source.distroName;installationId=$f.world.source.installationId;registrationId='fixture-registration'};$ctx=@{source=$f.world.source;sourceRoot=$f.root;destinationRoot=$f.dest;registration=$reg}
   $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1'),$reg,$change,$f.dest -ScriptBlock {param($manager,$reg,$change,$dest);. $manager -FunctionsOnly;$script:registration=Copy-CLMObject $reg;$script:reads=0;$script:change=$change;$script:dest=$dest;function Get-CLMWslRegistration($State){$script:reads++;if($script:reads -eq 2){if($script:change.StartsWith('identity')){$script:registration.registrationId='changed'}else{[void][IO.Directory]::CreateDirectory((Join-Path $script:dest 'distribution'));[IO.File]::WriteAllText((Join-Path $script:dest 'distribution\ext4.vhdx'),'conflict')}};return $script:registration};Export-ModuleMember -Function *}
   $lock=$null;if($change -cne 'identity-after-release'){$lock=[IO.File]::Open($vhd,'Open','Read','None')};try{Throws {& $module {param($ctx);Wait-CLMMoveVhdRelease $ctx -TimeoutMilliseconds 1000 -PollMilliseconds 25} $ctx} 'identity changed|residual VHD';Assert (Test-Path $vhd) 'Source disk removed'}finally{if($lock){$lock.Dispose()};Remove-Module $module}
  }
 }

 Test 'VHD release wait does not retry access denial' {
  $f=Fixture;$vhd=Join-Path $f.root 'distribution\ext4.vhdx';$reg=[pscustomobject]@{basePath=(Join-Path $f.root 'distribution');vhdFile='ext4.vhdx';distroName=$f.world.source.distroName;installationId=$f.world.source.installationId;registrationId='fixture-registration'};$ctx=@{source=$f.world.source;sourceRoot=$f.root;destinationRoot=$f.dest;registration=$reg}
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1'),$reg -ScriptBlock {param($manager,$reg);. $manager -FunctionsOnly;$script:registration=$reg;$script:reads=0;function Get-CLMWslRegistration($State){$script:reads++;return $script:registration};Export-ModuleMember -Function *}
  $file=[IO.FileInfo]::new($vhd);$original=$file.GetAccessControl([Security.AccessControl.AccessControlSections]::Access);$denied=$file.GetAccessControl([Security.AccessControl.AccessControlSections]::Access);$denied.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new([Security.Principal.WindowsIdentity]::GetCurrent().User,'ReadData','Deny'));$file.SetAccessControl($denied)
  try{$refused=$false;try{& $module {param($ctx);Wait-CLMMoveVhdRelease $ctx -TimeoutMilliseconds 3000 -PollMilliseconds 25} $ctx}catch{$e=$_.Exception;while($e.InnerException){$e=$e.InnerException};$refused=($e.HResult -band 65535) -eq 5};Assert $refused 'Access denial was hidden or retried';Assert ((& $module {$script:reads}) -eq 1) 'Non-sharing failure retried'}finally{$file.SetAccessControl($original);Remove-Module $module}
 }
 Write-Output ('Move fixtures passed: '+$script:passes)
}finally{$env:LOCALAPPDATA=$priorAppData}
