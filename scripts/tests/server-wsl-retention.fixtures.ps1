param([string]$ScratchRoot=$env:TEMP)
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $PSScriptRoot -Parent) 'install-server-windows.ps1')
function Assert($Condition,$Message){if(-not $Condition){throw $Message}}
function Refuses([scriptblock]$Code){try{& $Code}catch{return};throw 'Expected ownership refusal'}
$root=Join-Path $ScratchRoot ('castlink-retention-fixture-'+[guid]::NewGuid().ToString('N'))
$originalLocal=$env:LOCALAPPDATA;$originalWindows=$env:WINDIR
$env:LOCALAPPDATA=$root;if(-not $env:WINDIR){$env:WINDIR=$root}
[void][IO.Directory]::CreateDirectory((Join-Path $root 'CastLinkServer'))
$base=Join-Path $root 'CastLinkServer';$installation=Join-Path $base 'fixture';[void][IO.Directory]::CreateDirectory($installation)
$state=[pscustomobject]@{schemaVersion=1;installationId=('a'*32);rootPath=$installation;repository='resokol/castlink';releaseTag='server-wsl-v1.0.11-aaaaaaaaaaaa';rootfsSha256=('b'*64);phase='ready'}
function Entry([string]$Version,[string]$Commit){
 $folder=Join-Path (Get-CastlinkRetentionPackageRoot $state) ('server-wsl-v'+$Version+'-'+$Commit);[void][IO.Directory]::CreateDirectory($folder)
 $file=Join-Path $folder 'rootfs.tar.gz';[IO.File]::WriteAllText($file,$Version)
 return [pscustomobject]@{version=$Version;releaseTag=('server-wsl-v'+$Version+'-'+$Commit);files=@([pscustomobject]@{path=$file;sha256=(Get-FileHash $file).Hash.ToLowerInvariant();size=(Get-Item $file).Length})}
}
try{
 $entries=@((Entry '1.0.8' 'dddddddddddd'),(Entry '1.0.9' 'cccccccccccc'),(Entry '1.0.10' 'bbbbbbbbbbbb'),(Entry '1.0.11' 'aaaaaaaaaaaa'))
 $record=[pscustomobject]@{schemaVersion=1;owner='castlink-wsl-retention-v1';installationId=$state.installationId;rootPath=$installation;releases=$entries}
 $plan=@(Get-CastlinkRetentionPlan $installation $state $record)
 Assert ($plan.Count -eq 1 -and $plan[0].path -ceq $entries[0].files[0].path) 'current plus two previous product versions must survive numeric 9/10 ordering'
 Assert ((Compare-CastlinkRetentionVersion '1.0.11-rc.10' '1.0.11-rc.2') -gt 0) 'numeric prerelease ordering'
 Assert ((Compare-CastlinkRetentionVersion '1.0.11' '1.0.11-rc.10') -gt 0) 'stable must follow prerelease'
 $oldRebuild=Entry '1.0.10' 'eeeeeeeeeeee';$laterCurrentRebuild=Entry '1.0.11' 'ffffffffffff'
 $record.releases=@($oldRebuild)+$entries+@($laterCurrentRebuild)
 $rebuildPlan=@(Get-CastlinkRetentionPlan $installation $state $record)
 Assert ($rebuildPlan.Count -eq 3) 'obsolete builds of current/prior product versions must not accumulate'
 Assert (-not ($rebuildPlan|Where-Object {$_.path -ceq $entries[-1].files[0].path})) 'exact active build must survive a later same-version record'
 $record.releases=$entries
 $entries[0].files[0].sha256='f'*64
 Assert (@(Get-CastlinkRetentionPlan $installation $state $record).Count -eq 0) 'changed files must survive'
 $entries[0].files[0].sha256=(Get-FileHash $entries[0].files[0].path).Hash.ToLowerInvariant()
 $pending=Join-Path $base 'lifecycle-transactions/pending';[void][IO.Directory]::CreateDirectory($pending)
 [IO.File]::WriteAllText((Join-Path $pending 'journal.json'),'{"phase":"import-candidate"}')
 Refuses {Get-CastlinkRetentionPlan $installation $state $record}
 [IO.File]::WriteAllText((Join-Path $pending 'journal.json'),'{"phase":"completed"}')
 $neighbor=Join-Path $base 'neighbor';[void][IO.Directory]::CreateDirectory($neighbor)
 [IO.File]::WriteAllText((Join-Path $neighbor 'installation.json'),'{"phase":"ready","releaseTag":"server-wsl-v1.0.8-dddddddddddd"}')
 Assert (@(Get-CastlinkRetentionPlan $installation $state $record).Count -eq 0) 'other installation release references protect shared packages'
 [IO.File]::Delete((Join-Path $neighbor 'installation.json'))
 [IO.File]::WriteAllText((Join-Path $neighbor 'installation.json'),'{"installationId":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee","phase":"maintenance","releaseTag":"server-wsl-v1.0.8-dddddddddddd"}')
 [IO.File]::WriteAllText((Join-Path $pending 'journal.json'),('{"phase":"completed","kind":"update","sourceRoot":'+(ConvertTo-Json $neighbor -Compress)+',"source":{"installationId":"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee"}}'))
 Assert (@(Get-CastlinkRetentionPlan $installation $state $record).Count -eq 1) 'completed update proves retired source no longer protects every old cache'
 [IO.File]::Delete((Join-Path $neighbor 'installation.json'))
 $entries[0].files[0].path=Join-Path $root 'manual-backup.tar';[IO.File]::WriteAllText($entries[0].files[0].path,'manual')
 Refuses {Get-CastlinkRetentionPlan $installation $state $record}
 $cases=[pscustomobject]@{releaseTag='server-wsl-v1.3.0-aaaaaaaaaaaa'};$caseRecord=[pscustomobject]@{releases=@([pscustomobject]@{version='1.2.0-Alpha';releaseTag='server-wsl-v1.2.0-Alpha-bbbbbbbbbbbb'},[pscustomobject]@{version='1.2.0-alpha';releaseTag='server-wsl-v1.2.0-alpha-cccccccccccc'})};$caseTags=@(Get-CastlinkRetentionKeepTags $cases $caseRecord)
 Assert ($caseTags.Count -eq 3 -and $caseTags -ccontains 'server-wsl-v1.2.0-Alpha-bbbbbbbbbbbb' -and $caseTags -ccontains 'server-wsl-v1.2.0-alpha-cccccccccccc') 'SemVer case-sensitive prior versions collided'
 Assert ((Get-CastlinkRetentionVersion 'server-wsl-v1.2.0-rc--1-bbbbbbbbbbbb') -ceq '1.2.0-rc--1') 'valid producer prerelease with repeated hyphens rejected'
 Write-Output 'PASS WSL retention version policy, hashes, pending journal, neighbors and path scope'
 # Scheduler adapters are replaced only in this isolated module, never registered on the host.
 $module=New-Module -ArgumentList (Join-Path (Split-Path $PSScriptRoot -Parent) 'install-server-windows.ps1') -ScriptBlock {
  param($source);. $source
  $script:tasks=@{};$script:registered=0;$script:removed=0
  function Test-CastlinkAccountSid($Identity,$ExpectedSid){return $Identity -ceq $ExpectedSid}
  function Get-CastlinkCurrentUserSid{return 'S-1-5-21-1-2-3-1001'}
  function Get-ScheduledTask($TaskName,$TaskPath){return $script:tasks[$TaskName]}
  function New-ScheduledTaskAction($Execute,$Argument){return [pscustomobject]@{Execute=$Execute;Arguments=$Argument}}
  function New-ScheduledTaskTrigger{ return [pscustomobject]@{CimClass=[pscustomobject]@{CimClassName='MSFT_TaskTimeTrigger'};Enabled=$true;Repetition=[pscustomobject]@{Interval='PT1H'}} }
  function New-ScheduledTaskPrincipal($UserId,$LogonType,$RunLevel){return [pscustomobject]@{UserId=$UserId;LogonType=$LogonType;RunLevel=$RunLevel}}
  function New-ScheduledTaskSettingsSet{return [pscustomobject]@{Enabled=$true;MultipleInstances='IgnoreNew';ExecutionTimeLimit='PT5M'}}
  function Register-ScheduledTask($TaskName,$TaskPath,$Description,$Action,$Trigger,$Principal,$Settings){$script:registered++;$script:tasks[$TaskName]=[pscustomobject]@{TaskName=$TaskName;TaskPath=$TaskPath;Description=$Description;Actions=@($Action);Principal=$Principal;Triggers=@($Trigger);Settings=$Settings}}
  function Unregister-ScheduledTask($TaskName,$TaskPath,$Confirm){$script:removed++;$script:tasks.Remove($TaskName)}
  Export-ModuleMember -Function *
 }
 & $module {param($r,$s,$source)
  Save-CastlinkInstallation $r $s
  $staged=Join-Path $r 'install-server-windows.ps1';[IO.File]::Copy($source,$staged,$true)
  Register-CastlinkRetention $r $s (Join-Path $r 'release')
  Register-CastlinkRetention $r $s (Join-Path $r 'release')
  if($script:tasks.Count -ne 1){throw 'registration is not idempotent'}
  $oldRecord=Read-CastlinkRetention $r $s
  $spec=(Read-CastlinkRetention $r $s).task
  if($spec.arguments -notlike '*-Action Cleanup*' -or $spec.arguments -like '*Start*'){throw 'task must clean host files without starting WSL'}
  $script:tasks[$spec.taskName].Description='foreign task'
  $refused=$false;try{Unregister-CastlinkRetention $r $s}catch{$refused=$true};if(-not $refused -or $script:tasks.Count -ne 1){throw 'foreign task removed'}
  $script:tasks[$spec.taskName].Description=$spec.description
  Unregister-CastlinkRetention $r $s
  if($script:tasks.Count -ne 0 -or $script:removed -ne 1){throw 'owned task not unregistered'}
  if(-not (Test-Path (Join-Path $r 'installation.json'))){throw 'server data removed'}
 } $installation $state (Join-Path (Split-Path $PSScriptRoot -Parent) 'install-server-windows.ps1')
 Write-Output 'PASS WSL retention scheduler registration, idempotence, foreign-task preservation and uninstall'
 & $module {param($r,$s,$releases)
  $s.phase='ready';Save-CastlinkInstallation $r $s
  $record=Read-CastlinkRetention $r $s;$record.releases=$releases;Write-CastlinkRetention $r $record
  $script:InstallerSourcePath=Join-Path $r 'install-server-windows.ps1'
  function Invoke-CastlinkWsl{throw 'cleanup must never start WSL'}
  function Receive-CastlinkAsset{throw 'cleanup must never use the network'}
  $number=Invoke-CastlinkRetention $r
  if($number -ne 1 -or (Test-Path $releases[0].files[0].path)){throw 'actual owned cleanup failed'}
  foreach($item in @($releases|Select-Object -Skip 1)){if(-not (Test-Path $item.files[0].path)){throw 'retained version removed'}}
  $lease=[IO.File]::Open((Join-Path $r 'operation.lock'),'OpenOrCreate','ReadWrite','None')
  $refused=$false;try{Invoke-CastlinkRetention $r}catch{$refused=$true}finally{$lease.Dispose()};if(-not $refused){throw 'concurrent operation not protected'}
 } $installation $state @((Entry '1.0.8' 'dddddddddddd'),(Entry '1.0.9' 'cccccccccccc'),(Entry '1.0.10' 'bbbbbbbbbbbb'),(Entry '1.0.11' 'aaaaaaaaaaaa'))
 & $module {param($r,$s,$base)
  $offline=Join-Path $base 'offline';[void][IO.Directory]::CreateDirectory($offline);[IO.File]::WriteAllText((Join-Path $offline 'manifest.json'),'manual offline media')
  $external=Get-CastlinkRetentionPackage $r $s $offline;if(@($external.files).Count){throw 'offline package poisoned ownership inventory'}
  $shared=Join-Path $base 'lifecycle-packages/old-tools';[void][IO.Directory]::CreateDirectory($shared);$sharedFile=Join-Path $shared 'rootfs.tar.gz';[IO.File]::WriteAllText($sharedFile,'shared with old released tools')
  $sharedRecord=Get-CastlinkRetentionPackage $r $s $shared;if(@($sharedRecord.files).Count){throw 'historical shared cache claimed'}
  $record=Read-CastlinkRetention $r $s
  $a=[pscustomobject]@{version='1.0.10';releaseTag='server-wsl-v1.0.10-aaaaaaaaaaaa';ownedRoot=$r;files=@($record.releases[-1].files)}
  $b=[pscustomobject]@{version='1.0.10';releaseTag='server-wsl-v1.0.10-bbbbbbbbbbbb';ownedRoot=$r;files=@($record.releases[-1].files)}
  $record.releases=@($a,$b,$a);Write-CastlinkRetention $r $record
  Register-CastlinkRetention $r $s (Join-Path $r 'release')
  $ordered=Read-CastlinkRetention $r $s;$tags=@(Get-CastlinkRetentionKeepTags $s $ordered)
  if($tags -cnotcontains $a.releaseTag -or $tags -ccontains $b.releaseTag){throw 'A-B-A registration/compaction lost last successful build order'}
  $upper=[pscustomobject]@{version='1.0.10-Alpha';releaseTag='server-wsl-v1.0.10-Alpha-aaaaaaaaaaaa';ownedRoot=$r;files=@($a.files)}
  $lower=[pscustomobject]@{version='1.0.10-alpha';releaseTag='server-wsl-v1.0.10-alpha-bbbbbbbbbbbb';ownedRoot=$r;files=@($a.files)}
  $record.releases=@($upper,$lower);Write-CastlinkRetention $r $record;Register-CastlinkRetention $r $s (Join-Path $r 'release')
  $caseTags=@(Get-CastlinkRetentionKeepTags $s (Read-CastlinkRetention $r $s))
  if($caseTags -cnotcontains $upper.releaseTag -or $caseTags -cnotcontains $lower.releaseTag){throw 'staging/compaction collapsed case-sensitive product versions'}
  $record=Read-CastlinkRetention $r $s;$many=@()
  for($i=0;$i -lt 1500;$i++){$many+=@([pscustomobject]@{version=('0.0.'+$i);releaseTag=('server-wsl-v0.0.'+$i+'-dddddddddddd');ownedRoot=$r;files=@()})}
  $record.releases=$many+@($record.releases);$record=Compress-CastlinkRetention $s $record
  if(@($record.releases).Count -gt 3){throw 'missing obsolete ledger inventories grew without bound'}
  Write-CastlinkRetention $r $record;$before=[IO.File]::ReadAllText((Join-Path $r 'disk-retention.json'))
  $record.releases=@($many|Select-Object -First 1025);$refused=$false;try{Write-CastlinkRetention $r $record}catch{$refused=$true}
  if(-not $refused -or [IO.File]::ReadAllText((Join-Path $r 'disk-retention.json')) -cne $before){throw 'oversized ledger replaced last readable receipt'}
  $held=Enter-CastlinkPackageLease
  try{$refused=$false;try{Invoke-CastlinkRetention $r}catch{$refused=$true};if(-not $refused){throw 'cleaner raced a package reader holding the lease'}}finally{$held.Dispose()}
  if(-not (Test-Path $sharedFile)){throw 'legacy shared cache removed'}
  Unregister-CastlinkRetention $r $s
 } $installation $state $base
 Write-Output 'PASS offline/shared media stays unowned, bounded ledger and deterministic package lease exclusion'
 Write-Output 'PASS actual owned cache cleanup, retained files, no WSL/network and operation lock'
 # Exercise the actual already-published manager, not the changed coordinator.
 $oldManager=Join-Path $root 'published-manager.ps1'
 $oldBytes=& git -C (Split-Path (Split-Path $PSScriptRoot -Parent) -Parent) show '420b1cf14d6da241384727fb0969442f22fa5935:scripts/server-wsl-maintenance.ps1'
 if($LASTEXITCODE -ne 0){throw 'Published manager fixture requires canonical base commit 420b1cf (CI fetch-depth 0)'}
 [IO.File]::WriteAllText($oldManager,(($oldBytes -join "`n").TrimStart([char]0xfeff)),[Text.UTF8Encoding]::new($true))
 $sourceRoot=Join-Path $base 'legacy-source';$candidateRoot=Join-Path $base 'lifecycle-generations/44444444444444444444444444444444';$targetDir=Join-Path $base 'manual-target'
 foreach($dir in @($sourceRoot,$candidateRoot,$targetDir,(Join-Path $sourceRoot 'release'))){[void][IO.Directory]::CreateDirectory($dir)}
 function FileEntry([string]$Path){return [pscustomobject]@{file=[IO.Path]::GetFileName($Path);sha256=(Get-FileHash $Path -Algorithm SHA256).Hash.ToLowerInvariant();size=(Get-Item $Path).Length}}
 $sourceAsset=Join-Path $sourceRoot 'release/rootfs.tar.gz';[IO.File]::WriteAllText($sourceAsset,'verified predecessor package')
 $sourceManifest=[pscustomobject]@{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';version='1.0.11';releaseTag='server-wsl-v1.0.11-508042e07f6d';rootfs=(FileEntry $sourceAsset)}
 $sourceManifestPath=Join-Path $sourceRoot 'release/manifest.json';[IO.File]::WriteAllText($sourceManifestPath,($sourceManifest|ConvertTo-Json -Depth 8))
 $source=[pscustomobject]@{schemaVersion=1;installationId=('3'*32);distroName=('CastLink-Server-'+('3'*12));rootPath=$sourceRoot;phase='maintenance';repository='resokol/castlink';releaseTag=$sourceManifest.releaseTag;rootfsSha256=$sourceManifest.rootfs.sha256}
 [IO.File]::WriteAllText((Join-Path $sourceRoot 'installation.json'),($source|ConvertTo-Json -Depth 8))
 $template=Join-Path $targetDir 'install-server-windows.template.ps1';[IO.File]::Copy((Join-Path (Split-Path $PSScriptRoot -Parent) 'install-server-windows.ps1'),$template,$true)
 $inventory=Join-Path $targetDir 'packages.tsv';[IO.File]::WriteAllText($inventory,'synthetic exact package inventory')
 $target=[pscustomobject]@{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';version='1.0.12';sourceCommit=('a'*40);releaseTag='server-wsl-v1.0.12-aaaaaaaaaaaa';rootfs=[pscustomobject]@{file='rootfs.tar.gz';sha256=('b'*64);size=1024};inventory=(FileEntry $inventory);nativePanel=[pscustomobject]@{schemaVersion=1;host='CastLinkServer.exe';binding='server-native-binding.json';files=@()};lifecycle=[pscustomobject]@{helpers=@((FileEntry $template))}}
 $manifestPath=Join-Path $targetDir 'manifest.json';[IO.File]::WriteAllText($manifestPath,($target|ConvertTo-Json -Depth 12));$pin=(Get-FileHash $manifestPath).Hash.ToLowerInvariant()
 $candidate=[pscustomobject]@{schemaVersion=1;installationId=('4'*32);logicalInstallationId=$source.installationId;distroName=('CastLink-Server-'+('4'*12));rootPath=$candidateRoot;phase='imported';repository='resokol/castlink';releaseTag=$target.releaseTag;rootfsSha256=$target.rootfs.sha256;releaseManifestSha256=$pin}
 [IO.File]::WriteAllText((Join-Path $candidateRoot 'installation.json'),($candidate|ConvertTo-Json -Depth 8))
 $transaction=Join-Path $base 'lifecycle-transactions/55555555555555555555555555555555';[void][IO.Directory]::CreateDirectory($transaction)
 $ctx=@{schemaVersion=1;kind='update';phase='prepare-bindings';id=('5'*32);directory=$transaction;journal=(Join-Path $transaction 'journal.json');candidate=$candidate;candidateRoot=$candidateRoot;source=$source;sourceRoot=$sourceRoot;sourceManifest=$sourceManifestPath;target=$target;targetDirectory=$targetDir;manifestSha256=$pin;ready=[pscustomobject]@{ready=$true;buildId='1.0.12-aaaaaaaaaaaa';origin='https://fixture.invalid'};task=[pscustomobject]@{exists=$false};ownedFiles=@([pscustomobject]@{path=$sourceAsset;sha256=$sourceManifest.rootfs.sha256})}
 [IO.File]::WriteAllText($ctx.journal,($ctx|ConvertTo-Json -Depth 20))
 & $module {param($p);$script:PackagedManifestSha256=$p;function script:Build-CastlinkNativePanelHost($Directory,$Output){[IO.File]::WriteAllText($Output,'synthetic native panel; never executed')}} $pin
 $legacy=New-Module -ArgumentList $oldManager,$module -ScriptBlock {
  param($old,$targetModule);. $old -FunctionsOnly;$script:target=$targetModule
  function Protect-CLMDirectory($Path){[void][IO.Directory]::CreateDirectory($Path)}
  function Import-CLMInstaller($Path){return $script:target}
  function Invoke-CLMProcess{return ''}
  Export-ModuleMember -Function *
 }
 $ctx.candidate=& $legacy {param($c);Invoke-CLMDefaultAdapter PrepareBindings $c $null} $ctx
 $migration=Read-CastlinkRetention $candidateRoot $ctx.candidate
 Assert ($migration.task.taskName -ceq ('CastLink-Server-'+$candidate.installationId+'-Retention')) 'old published manager did not install new target housekeeping'
 $copy=@($migration.releases|Where-Object {$_.releaseTag -ceq $source.releaseTag}|ForEach-Object {$_.files}|Where-Object {[IO.Path]::GetFileName($_.path) -ceq 'rootfs.tar.gz'})
 Assert ($copy.Count -eq 1 -and $copy[0].path -cne $sourceAsset -and (Test-Path $copy[0].path)) 'predecessor package not retained in private namespace'
 & $legacy {param($c);Invoke-CLMDefaultAdapter CleanupSource $c $null} $ctx
 Assert (-not (Test-Path $sourceAsset) -and (Test-Path $copy[0].path)) 'old cleanup must remove original while retaining verified package copy'
 $ctx.phase='rolled-back';[IO.File]::WriteAllText($ctx.journal,($ctx|ConvertTo-Json -Depth 20));$ctx.candidate.phase='removed'
 [IO.File]::WriteAllText((Join-Path $candidateRoot 'installation.json'),($ctx.candidate|ConvertTo-Json -Depth 8))
 & $module {param($r);$script:InstallerSourcePath=Join-Path $r 'install-server-windows.ps1';$null=Invoke-CastlinkRetention $r;if($script:tasks.Count){throw 'legacy rollback left a permanent retention task'}} $candidateRoot
 Write-Output 'PASS actual published old-manager update hook, retained predecessor copy and rollback task retirement'
}finally{$env:LOCALAPPDATA=$originalLocal;$env:WINDIR=$originalWindows;Remove-Item -LiteralPath $root -Recurse -Force}
