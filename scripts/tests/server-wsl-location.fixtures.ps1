param([string]$ScratchRoot=$env:TEMP)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -FunctionsOnly
function Assert($v,$m){if(-not $v){throw $m}}
function Throws([scriptblock]$b,[string]$p){try{& $b}catch{if($_.Exception.Message -match $p){return};throw};throw "Expected refusal $p"}
if(-not (Get-Command Invoke-CastlinkMove -ErrorAction SilentlyContinue)){throw 'Expected RED: durable Move API is missing'}
$testRoot=Join-Path $ScratchRoot ('castlink-move-fixtures-'+[guid]::NewGuid().ToString('N'));[void][IO.Directory]::CreateDirectory($testRoot)
$priorAppData=$env:LOCALAPPDATA;$env:LOCALAPPDATA=Join-Path $testRoot 'profile';[void][IO.Directory]::CreateDirectory($env:LOCALAPPDATA)
$script:passes=0
function Test($n,[scriptblock]$b){& $b;$script:passes++;Write-Output ('PASS '+$n)}
function Fixture([bool]$Running=$true,[bool]$Generation=$false){
 $base=Join-Path $testRoot ([guid]::NewGuid().ToString('N'));$selected=Join-Path $base 'selected';$root=if($Generation){Join-Path $base 'generation'}else{$selected};$dest=Join-Path $base 'new location';foreach($p in @($selected,$root)){[void][IO.Directory]::CreateDirectory($p)}
 $s=[pscustomobject]@{schemaVersion=1;installationId=('a'*32);logicalInstallationId=('b'*32);distroName=('CastLink-Server-'+('a'*12));rootPath=$root;releaseTag='server-wsl-v1.0.8-cccccccccccc';repository='resokol/castlink';rootfsSha256=('d'*64);phase='ready';desiredRunning=$Running;autoStartAtLogon=$false;locationContract='castlink-wsl-location-v1'}
 Write-CLMJson (Join-Path $root 'installation.json') $s
 if($Generation){Write-CLMJson (Join-Path $selected 'active-generation.json') @{schemaVersion=1;selectedRoot=$selected;activeRoot=$root;installationId=$s.installationId}}
 $w=@{source=$s;events=(New-Object Collections.Generic.List[string]);registration=(Join-Path $root 'distribution');running=$Running;taskEnabled=$false;moves=0;disk=999999999999L;files=@();archives=@();fail='';late=$false;identity=$s.installationId;conflict=$false}
 $a={param($name,$ctx,$data);$w.events.Add($name);if($w.fail -ceq $name){throw ('Injected '+$name)}
 switch($name){
 'MovePreflight' {if($w.conflict){throw 'Registry identity conflict'};$ctx.source=$w.source;$ctx.task=[pscustomobject]@{exists=$true;enabled=$w.taskEnabled};$ctx.ownedFiles=@($w.files);$ctx.archiveFiles=@($w.archives);$ctx.requiredBytes=1024;$ctx.freeBytes=$w.disk;$ctx.sourceVhdBytes=1024}
 'MoveRegistration' {return [pscustomobject]@{basePath=$w.registration;installationId=$w.identity;distroName=$w.source.distroName;registrationId='fixture-registration';vhdFile='ext4.vhdx'}}
 'MoveQuiesce' {$w.running=$false}
 'MoveDistribution' {$w.moves++;$w.registration=Join-Path $ctx.destinationRoot 'distribution';if($w.late){$w.late=$false;throw 'WSL returned error after move'}}
 'MoveBindings' {$s=$ctx.source|ConvertTo-Json -Depth 32|ConvertFrom-Json;$s.rootPath=$ctx.destinationRoot;$s.phase='ready';[IO.File]::WriteAllText((Join-Path $ctx.destinationRoot 'installation.json'),($s|ConvertTo-Json -Depth 32));return $s}
 'MoveVerify' {if($ctx.source.desiredRunning){$w.running=$true};return $true}
 'MovePublish' {$w.taskEnabled=$ctx.task.enabled}
 'MoveFinish' {}
 default {throw ('Unexpected adapter '+$name)}
 }}.GetNewClosure()
 return @{root=$root;selected=$selected;dest=$dest;world=$w;adapter=$a}
}
function RunMove($f){Invoke-CastlinkMove -InstallRoot $f.selected -DestinationRoot $f.dest -Confirmation $f.world.source.distroName -Adapter $f.adapter}
try{
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
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;$script:calls=New-Object Collections.Generic.List[object];function Assert-CLMGuestMarker($State){};function Assert-CLMStopped($State){};function Invoke-CLMProcess($Exe,$Arguments,$InputFile,$OutputFile,$Limit,$Timeout){$script:calls.Add(@($Arguments))};Export-ModuleMember -Function *}
  try{foreach($drive in @('C','D')){$c=@{source=[pscustomobject]@{distroName='CastLink-Server-aaaaaaaaaaaa'};destinationRoot=($drive+':\Fixture location')}; & $module {param($c);Invoke-CLMMoveDefaultAdapter 'MoveDistribution' $c} $c};$calls=& $module {$script:calls.ToArray()};Assert ($calls.Count -eq 4) 'Unexpected native operations';Assert ($calls[0][0] -ceq '--terminate' -and $calls[1][0] -ceq '--manage' -and $calls[1][2] -ceq '--move' -and $calls[3][3] -ceq 'D:\Fixture location\distribution') 'Official move arguments differ'}finally{Remove-Module $module}
 }
 Test 'old WSL version refuses before reading installation or guest' {
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Invoke-CLMProcess($Exe,$Arguments){return 'WSL version: 2.4.13.0'};function Read-CLMReceipt {throw 'Unexpected source access'};Export-ModuleMember -Function *}
  try{Throws {& $module {Invoke-CLMMoveDefaultAdapter 'MovePreflight' @{}}} 'WSL 3.0.1.*wsl --update'}finally{Remove-Module $module}
 }

 Test 'replayed quiesce proves guest ownership before changing task or services' {
  $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'server-wsl-maintenance.ps1') -ScriptBlock {param($manager);. $manager -FunctionsOnly;function Assert-CLMGuestMarker($State){throw 'Foreign guest proof refused'};function Sync-CLMKeepaliveReceipt($Root,$State,$Module){return $State};function Invoke-CLMDefaultAdapter {throw 'Unexpected task mutation'};Export-ModuleMember -Function *}
  try{Throws {& $module {Invoke-CLMMoveDefaultAdapter 'MoveQuiesce' @{sourceModule='synthetic';source=[pscustomobject]@{installationId=('a'*32)}}}} 'Foreign guest proof refused'}finally{Remove-Module $module}
 }
 Write-Output ('Move fixtures passed: '+$script:passes)
}finally{$env:LOCALAPPDATA=$priorAppData}
