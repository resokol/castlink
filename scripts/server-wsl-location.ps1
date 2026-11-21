# Same-release WSL relocation. Loaded only through the lifecycle helper inventory.
$script:CLMLocationContract='castlink-wsl-location-v1'
function Get-CLMMoveDirectory([string]$Id){if($Id -cnotmatch '^[a-f0-9]{32}$'){throw 'Invalid move transaction identity'};return Join-Path (Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry\operations') $Id}
function Assert-CLMPrivatePath([string]$Path){
 $p=Assert-CLMPath $Path;$acl=Get-Acl -LiteralPath $p;$allowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18')
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -notin $allowed -or @($acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])|Where-Object {$_.AccessControlType -eq 'Allow' -and $_.IdentityReference.Value -notin $allowed}).Count){throw 'Move metadata is not private; recovery requires inspection'}
}
function Write-CLMMovePointers($Ctx){
 foreach($root in @($Ctx.selectedRoot,$Ctx.sourceRoot,$Ctx.destinationRoot)|Select-Object -Unique){Write-CLMJson (Join-Path $root 'maintenance-transaction.json') @{schemaVersion=1;kind='move';selectedRoot=$root;journalSelectedRoot=$Ctx.selectedRoot;id=$Ctx.id;journal=$Ctx.journal}}
}
function Read-CLMMoveJournal([string]$Root,[bool]$Fixture){
 $p=Read-CLMJson (Join-Path $Root 'maintenance-transaction.json');$directory=Get-CLMMoveDirectory $p.id;$expected=Join-Path $directory 'journal.json'
 if($p.schemaVersion -ne 1 -or $p.kind -cne 'move' -or $p.selectedRoot -cne $Root -or $p.journal -cne $expected){throw 'Move journal pointer identity mismatch'}
 if(-not $Fixture){Assert-CLMPrivatePath $directory;Assert-CLMPrivatePath $expected}
 $j=Read-CLMJson $expected
 if($j.kind -cne 'move' -or $j.schemaVersion -ne 1 -or $j.id -cne $p.id -or $j.journal -cne $expected -or $j.selectedRoot -cne $p.journalSelectedRoot -or $Root -cnotin @($j.selectedRoot,$j.sourceRoot,$j.destinationRoot)){throw 'Move journal identity mismatch'}
 return $j
}
function Get-CLMWslRegistration($State){
 $items=@(Get-ChildItem -LiteralPath 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Lxss' -ErrorAction Stop|ForEach-Object {$key=$_; $v=Get-ItemProperty -LiteralPath $_.PSPath;if($v.DistributionName -ceq $State.distroName){[pscustomobject]@{key=$key;value=$v}}})
 if($items.Count -ne 1){throw 'WSL registration is missing or ambiguous; recovery required'}
 $v=$items[0].value;$path=[Environment]::ExpandEnvironmentVariables([string]$v.BasePath);if($path.StartsWith('\\?\')){$path=$path.Substring(4)}
 $file=if($v.PSObject.Properties['VhdFileName'] -and $v.VhdFileName){[string]$v.VhdFileName}else{'ext4.vhdx'};Assert-CLMAssetName $file
 if($v.Version -ne 2){throw 'Move requires the owned WSL2 registration'}
 $path=(Assert-CLMPath $path).TrimEnd('\');$vhd=Assert-CLMPath (Join-Path $path $file);if(-not (Test-Path -LiteralPath $vhd -PathType Leaf)){throw 'WSL registration VHD is unavailable; recovery required'}
 return [pscustomobject]@{basePath=$path;vhdFile=$file;distroName=$v.DistributionName;installationId=$State.installationId;registrationId=$items[0].key.PSChildName}
}
function Assert-CLMMoveRegistration($Ctx,$Registration){
 if(-not $Registration -or $Registration.installationId -cne $Ctx.source.installationId -or $Registration.distroName -cne $Ctx.source.distroName -or $Registration.registrationId -cne $Ctx.registration.registrationId -or $Registration.vhdFile -cne $Ctx.registration.vhdFile){throw 'Move WSL registration identity changed; manual recovery required'}
 $path=Assert-CLMPath $Registration.basePath
 if($path -cne (Join-Path $Ctx.sourceRoot 'distribution') -and $path -cne (Join-Path $Ctx.destinationRoot 'distribution')){throw 'Move WSL registration is at an unexpected location; manual recovery required'}
 return $path
}
function Invoke-CLMMoveAdapter($Ctx,[string]$Name){if($Ctx.adapter){return & $Ctx.adapter $Name $Ctx $null};return Invoke-CLMMoveDefaultAdapter $Name $Ctx}
function Initialize-CLMMoveModule($Ctx){
 if($Ctx.sourceModule){return}
 $p=$Ctx.sourceInstaller
 if(-not (Test-Path -LiteralPath $p)){$p=Join-Path $Ctx.destinationRoot 'install-server-windows.ps1'}
 if((Get-CLMHash $p) -cne $Ctx.installerHash){throw 'Move pinned installer checksum mismatch'}
 $Ctx.sourceModule=Import-CLMInstaller $p
}
function Invoke-CLMMoveDefaultAdapter([string]$Name,$Ctx){
 switch($Name){
 'MovePreflight' {
  # Version/help and registration checks precede any guest execution or stop.
  $exe=Join-Path $env:WINDIR 'System32\wsl.exe';$version=(Invoke-CLMProcess $exe @('--version')) -replace "`0",''
  if($version -notmatch '(\d+\.\d+\.\d+)' -or [version]$Matches[1] -lt [version]'3.0.1'){throw 'Move requires WSL 3.0.1 or newer. Run wsl --update first.'}
  if(((Invoke-CLMProcess $exe @('--help')) -replace "`0",'') -notmatch '--move'){throw 'This WSL has no official move command. Run wsl --update first.'}
  $s=Read-CLMReceipt $Ctx.sourceRoot
  if($s.locationContract -cne $script:CLMLocationContract){throw 'Explicitly upgrade this server to a release supporting location moves first.'}
  Get-CLMSourcePackage $Ctx $s;$m=Read-CLMJson $Ctx.sourceManifest
  if($m.lifecycle.locationContract -cne $script:CLMLocationContract){throw 'Explicitly upgrade this server before moving its pinned installer.'}
  $Ctx.sourceModule=Import-CLMInstaller $Ctx.sourceInstaller;$Ctx.installerHash=Get-CLMHash $Ctx.sourceInstaller
  $Ctx.destinationRoot=Invoke-CLMInstaller $Ctx.sourceModule {param($p);Assert-CastlinkInstallRoot $p} $Ctx.destinationRoot
  $Ctx.source=$s;$reg=Get-CLMWslRegistration $s
  if($reg.basePath -cne (Join-Path $Ctx.sourceRoot 'distribution')){throw 'WSL registration does not match the owned source VHD location'}
  Assert-CLMPrivatePath $Ctx.sourceRoot
  $records=@(Invoke-CLMInstaller $Ctx.sourceModule {Get-CastlinkLocationRecords});$logical=if($s.logicalInstallationId){$s.logicalInstallationId}else{$s.installationId}
  $rows=@($records|Where-Object {$_.logicalId -ceq $logical});if($rows.Count -gt 1 -or ($rows.Count -eq 1 -and ($rows[0].selectedRoot -cne $Ctx.selectedRoot -or $rows[0].activeRoot -cne $Ctx.sourceRoot -or $rows[0].installationId -cne $s.installationId))){throw 'Registry identity conflict; source preserved'}
  $vhd=Assert-CLMPath (Join-Path $reg.basePath $reg.vhdFile);$Ctx.sourceVhdBytes=(Get-Item -LiteralPath $vhd).Length
  Get-CLMOwnedFiles $Ctx;$archives=@($m.rootfs,$m.sources,$m.upstreamSources)|Where-Object {$_}|ForEach-Object {Join-Path $Ctx.sourceRoot ('release\'+$_.file)};$Ctx.archiveFiles=@($Ctx.ownedFiles|Where-Object {$_.path -cin $archives});$Ctx.requiredBytes=[long]$Ctx.sourceVhdBytes+2147483648L;foreach($e in @($Ctx.ownedFiles)){$Ctx.requiredBytes+=(Get-Item -LiteralPath $e.path).Length}
  $Ctx.freeBytes=([IO.DriveInfo]::new([IO.Path]::GetPathRoot($Ctx.destinationRoot))).AvailableFreeSpace
  $Ctx.task=Invoke-CLMDefaultAdapter 'SourceTask' $Ctx $null
  Assert-CLMGuestMarker $s
  if(-not $s.desiredRunning){Assert-CLMStopped $s}
  return
 }
 'MoveRegistration' {return Get-CLMWslRegistration $Ctx.source}
 'MoveQuiesce' {
  Initialize-CLMMoveModule $Ctx;$Ctx.source=Sync-CLMKeepaliveReceipt $Ctx.sourceRoot $Ctx.source $Ctx.sourceModule;Assert-CLMGuestMarker $Ctx.source
  Invoke-CLMDefaultAdapter 'DisableSourceTask' $Ctx $null;Close-CLMSourcePanel $Ctx
  Invoke-CLMDefaultAdapter 'StopSource' $Ctx $null;Assert-CLMStopped $Ctx.source
  $null=Invoke-CLMGuest $Ctx $Ctx.source 'gate-close' '' '' @('--transaction-id',$Ctx.id)
  $exe=Join-Path $env:WINDIR 'System32\wsl.exe';$null=Invoke-CLMProcess $exe @('--terminate',$Ctx.source.distroName)
  $running=(Invoke-CLMProcess $exe @('--list','--running','--quiet')) -replace "`0",''
  if($running.Split("`n").Trim() -ccontains $Ctx.source.distroName){throw 'Owned source termination not confirmed'}
  return
 }
 'MoveDistribution' {Assert-CLMGuestMarker $Ctx.source;Assert-CLMStopped $Ctx.source;$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.source.distroName);$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--manage',$Ctx.source.distroName,'--move',(Join-Path $Ctx.destinationRoot 'distribution')) '' '' 1048576 3600;return}
 'MoveBindings' {return Set-CLMMoveBindings $Ctx}
 'MoveVerify' {
  Initialize-CLMMoveModule $Ctx;$Ctx.destination=Sync-CLMKeepaliveReceipt $Ctx.destinationRoot $Ctx.destination $Ctx.sourceModule;Assert-CLMGuestMarker $Ctx.destination
  if($Ctx.source.desiredRunning){Invoke-CLMInstaller $Ctx.sourceModule {param($d);Start-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.destinationRoot;s=$Ctx.destination};$null=Invoke-CLMWsl $Ctx.destination @('/usr/local/bin/castlink-server','start') '' '' 1048576 1200;$status=Invoke-CLMWsl $Ctx.destination @('/usr/local/bin/castlink-server','status')|ConvertFrom-Json;if(-not $status.ready -or $status.buildId -cne ($Ctx.source.releaseTag -replace '^server-wsl-v','')){throw 'Moved same-release readiness mismatch'}}else{Assert-CLMStopped $Ctx.destination}
  return $true
 }
 'MovePublish' {
  Initialize-CLMMoveModule $Ctx
  if($Ctx.destination.nativePanel){
   $entry=@{candidateRoot=$Ctx.destinationRoot;selectedRoot=$Ctx.destinationRoot;directory=$Ctx.directory;id=$Ctx.id;entryPointBeforeHash=$null;entryPointHash=$Ctx.entryPointHash}
   if(-not $Ctx.entryPointHash){if(Test-Path -LiteralPath (Join-Path $Ctx.destinationRoot 'CastLinkServer.lnk')){throw 'Unknown destination shortcut exists'};Prepare-CLMEntryPoint $entry;$Ctx.entryPointHash=$entry.entryPointHash;Save-CLMJournal $Ctx 'move-publish'}
   Publish-CLMEntryPoint $entry
  }
  Invoke-CLMInstaller $Ctx.sourceModule {param($d);Set-CastlinkLocation $d.destinationRoot $d.destination $d.selectedRoot $d.sourceRoot} $Ctx
  if($Ctx.task.exists){
   $old=$Ctx.task.spec;$new=Invoke-CLMInstaller $Ctx.sourceModule {param($d);Get-CastlinkLogonTaskSpec $d.destinationRoot $d.destination (Join-Path $d.destinationRoot 'install-server-windows.ps1')} $Ctx
   $task=Get-ScheduledTask -TaskName $old.taskName -TaskPath $old.taskPath -ErrorAction Stop
   $copy=Copy-CLMTaskForValidation $task
   try{Invoke-CLMInstaller $Ctx.sourceModule {param($d);Assert-CastlinkLogonTask $d.task $d.spec} @{task=$copy;spec=$new}}catch{
    Invoke-CLMInstaller $Ctx.sourceModule {param($d);Assert-CastlinkLogonTask $d.task $d.spec} @{task=$copy;spec=$old}
    $action=New-ScheduledTaskAction -Execute $new.execute -Argument $new.arguments
    Set-ScheduledTask -TaskName $old.taskName -TaskPath $old.taskPath -Action $action -Description $new.description|Out-Null
   }
   if($Ctx.task.enabled){Enable-ScheduledTask -TaskName $new.taskName -TaskPath $new.taskPath|Out-Null}else{Disable-ScheduledTask -TaskName $new.taskName -TaskPath $new.taskPath|Out-Null}
  }
  return
 }
 'MoveFinish' {$null=Invoke-CLMGuest $Ctx $Ctx.destination 'gate-open' '' '' @('--committed-transaction',$Ctx.id);if(-not $Ctx.source.desiredRunning){Assert-CLMStopped $Ctx.destination;$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.destination.distroName)};return}
 default {throw ('Unknown move adapter operation '+$Name)}
 }
}
function Copy-CLMMoveFiles($Ctx){
 foreach($e in @($Ctx.ownedFiles)){
  $source=Assert-CLMPath $e.path;if(-not $source.StartsWith($Ctx.sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Move inventory escapes source ownership'}
  if((Get-CLMHash $source) -cne $e.sha256){throw 'Move source inventory changed; preserved for recovery'}
  $relative=$source.Substring($Ctx.sourceRoot.Length+1);$dest=Assert-CLMPath (Join-Path $Ctx.destinationRoot $relative)
  if(Test-Path -LiteralPath $dest){if((Get-CLMHash $dest) -cne $e.sha256){throw 'Move destination owned file changed; preserved for recovery'}}else{$parent=Split-Path $dest -Parent;if($Ctx.adapter){[void][IO.Directory]::CreateDirectory($parent)}else{Protect-CLMDirectory $parent};[IO.File]::Copy($source,$dest,$false)}
 }
 # Cached independent provenance may have supplied the installed metadata.
 if(-not $Ctx.adapter){foreach($pair in @(@($Ctx.sourceInstaller,'install-server-windows.ps1'),@($Ctx.sourceManifest,'release\manifest.json'))){$dest=Join-Path $Ctx.destinationRoot $pair[1];if(-not (Test-Path -LiteralPath $dest)){Protect-CLMDirectory (Split-Path $dest -Parent);[IO.File]::Copy($pair[0],$dest,$false)};if((Get-CLMHash $dest) -cne (Get-CLMHash $pair[0])){throw 'Move provenance copy mismatch'}}}
}
function Set-CLMMoveBindings($Ctx){
 $s=Copy-CLMObject $Ctx.source;$s.rootPath=$Ctx.destinationRoot;$s.PSObject.Properties.Remove('keepalive');$s.PSObject.Properties.Remove('maintenanceTransaction');$s.phase='ready'
 if($s.nativePanel){
  $old=$s.nativePanel;$path=Join-Path $Ctx.destinationRoot 'native-panel\server-native-binding.json';$binding=Read-CLMJson $path
  $original=Read-CLMJson $old.bindingPath;if((Get-CLMHash $old.bindingPath) -cne $old.bindingSha256 -or @($binding.PSObject.Properties).Count -ne 6){throw 'Move binding ownership hash mismatch'}
  foreach($field in @('installationId','origin','expectedBuildId','expectedInstallerSha256')){if($binding.$field -cne $original.$field){throw 'Move binding ownership content mismatch'}}
  if($binding.sourceScriptPath -cne (Join-Path $binding.installRoot 'install-server-windows.ps1')){throw 'Move binding installer path mismatch'}
  if($binding.installationId -cne $s.installationId -or $binding.installRoot -cnotin @($Ctx.sourceRoot,$Ctx.destinationRoot)){throw 'Move binding identity mismatch'}
  $binding.installRoot=$Ctx.destinationRoot;$binding.sourceScriptPath=Join-Path $Ctx.destinationRoot 'install-server-windows.ps1'
  if((Get-CLMHash $binding.sourceScriptPath) -cne $binding.expectedInstallerSha256){throw 'Move installer pin differs'}
  Write-CLMJson $path $binding;$s.nativePanel.bindingPath=$path;$s.nativePanel.bindingSha256=Get-CLMHash $path;$s.nativePanel.hostPath=Join-Path $Ctx.destinationRoot 'native-panel\CastLinkServer.exe'
  if((Get-CLMHash $s.nativePanel.hostPath) -cne $old.hostSha256){throw 'Move native host pin differs'}
 }
 Write-CLMJson (Join-Path $Ctx.destinationRoot 'installation.json') $s
 return $s
}
function Remove-CLMMoveArchives($Ctx){
 foreach($e in @($Ctx.archiveFiles)){
  $source=Assert-CLMPath $e.path;if(-not $source.StartsWith($Ctx.sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or @($Ctx.ownedFiles|Where-Object {$_.path -ceq $source -and $_.sha256 -ceq $e.sha256}).Count -ne 1){throw 'Move archive cleanup ownership mismatch'}
  $destination=Join-Path $Ctx.destinationRoot $source.Substring($Ctx.sourceRoot.Length+1)
  if((Get-CLMHash $destination) -cne $e.sha256){throw 'Moved archive changed; source preserved'}
  if(Test-Path -LiteralPath $source){if((Get-CLMHash $source) -cne $e.sha256){throw 'Source archive changed; preserved'};[IO.File]::Delete($source)}
 }
}
function Assert-CLMMoveDestination($Ctx){
 if(-not (Test-Path -LiteralPath $Ctx.destinationRoot -PathType Container)){throw 'Move destination disk or directory unavailable; recovery required'}
 $marker=Read-CLMJson (Join-Path $Ctx.destinationRoot 'move-owner.json')
 if($marker.id -cne $Ctx.id -or $marker.logicalId -cne $Ctx.logicalId -or $marker.destinationRoot -cne $Ctx.destinationRoot){throw 'Move destination ownership identity changed'}
 $allowed=@{};foreach($name in @('move-owner.json','maintenance-transaction.json','installation.json','operation.lock','CastLinkServer.lnk','install-server-windows.ps1','release\manifest.json')){$allowed[(Join-Path $Ctx.destinationRoot $name)]=$true}
 foreach($entry in @($Ctx.ownedFiles)){$relative=$entry.path.Substring($Ctx.sourceRoot.Length+1);$allowed[(Join-Path $Ctx.destinationRoot $relative)]=$true}
 $pending=New-Object Collections.Generic.Queue[string];$pending.Enqueue($Ctx.destinationRoot)
 while($pending.Count){$dir=$pending.Dequeue();foreach($entry in Get-ChildItem -LiteralPath $dir -Force){$p=Assert-CLMPath $entry.FullName;if($entry.PSIsContainer){if($p -cne (Join-Path $Ctx.destinationRoot 'distribution')){$pending.Enqueue($p)}}elseif(-not $allowed.ContainsKey($p)){throw 'Unknown file appeared in move destination; it was preserved'}}}
 $s=$null;$receipt=Join-Path $Ctx.destinationRoot 'installation.json';if(Test-Path -LiteralPath $receipt){$s=Read-CLMReceipt $Ctx.destinationRoot;foreach($k in @('installationId','logicalInstallationId','distroName','releaseTag','rootfsSha256','locationContract','desiredRunning','autoStartAtLogon')){if($s.$k -cne $Ctx.source.$k){throw 'Move destination receipt identity changed'}}}
 foreach($e in @($Ctx.ownedFiles)){
  $p=Join-Path $Ctx.destinationRoot $e.path.Substring($Ctx.sourceRoot.Length+1)
  if(-not (Test-Path -LiteralPath $p)){if($Ctx.phase -notin @('move-prepared','move-quiesce','move-copy')){throw 'Move destination inventory is missing'};continue}
  $expected=$e.sha256
  if($Ctx.destination -and $Ctx.destination.nativePanel -and $p -ceq $Ctx.destination.nativePanel.bindingPath){$expected=$Ctx.destination.nativePanel.bindingSha256}
  elseif($Ctx.source.nativePanel -and $p -ceq (Join-Path $Ctx.destinationRoot 'native-panel\server-native-binding.json') -and $Ctx.phase -ceq 'move-bindings' -and (Get-CLMHash $p) -cne $e.sha256){
   # Binding may have been atomically rewritten just before a process crash.
   $old=Read-CLMJson $Ctx.source.nativePanel.bindingPath;if((Get-CLMHash $Ctx.source.nativePanel.bindingPath) -cne $Ctx.source.nativePanel.bindingSha256){throw 'Move source binding ownership changed'}
   $new=Read-CLMJson $p;if(@($new.PSObject.Properties).Count -ne 6 -or $new.installRoot -cne $Ctx.destinationRoot -or $new.sourceScriptPath -cne (Join-Path $Ctx.destinationRoot 'install-server-windows.ps1')){throw 'Move destination binding changed'}
   foreach($field in @('installationId','origin','expectedBuildId','expectedInstallerSha256')){if($old.$field -cne $new.$field){throw 'Move destination binding identity changed'}};$expected=Get-CLMHash $p
  }
  if((Get-CLMHash $p) -cne $expected){throw 'Move destination inventory changed; preserved for recovery'}
 }
 if($Ctx.entryPointHash -and (Test-Path -LiteralPath (Join-Path $Ctx.destinationRoot 'CastLinkServer.lnk')) -and (Get-CLMHash (Join-Path $Ctx.destinationRoot 'CastLinkServer.lnk')) -cne $Ctx.entryPointHash){throw 'Move destination shortcut changed'}

}
function Complete-CLMMove($Ctx){
 Assert-CLMMoveDestination $Ctx
 $actual=Assert-CLMMoveRegistration $Ctx (Invoke-CLMMoveAdapter $Ctx 'MoveRegistration')
 if($Ctx.phase -ceq 'completed'){if($actual -cne (Join-Path $Ctx.destinationRoot 'distribution')){throw 'Completed move registration differs'};return $Ctx}
 $phases=@('move-prepared','move-quiesce','move-copy','move-wsl','move-bindings','move-verify','move-publish','move-finish','move-cleanup');$index=[Array]::IndexOf($phases,[string]$Ctx.phase);if($index -lt 0){throw 'Unknown durable move phase'}
 if($index -le 1){Save-CLMJournal $Ctx 'move-quiesce';Invoke-CLMMoveAdapter $Ctx 'MoveQuiesce'|Out-Null}
 if($index -le 2){Save-CLMJournal $Ctx 'move-copy';Copy-CLMMoveFiles $Ctx}
 if($index -le 3){Save-CLMJournal $Ctx 'move-wsl';$actual=Assert-CLMMoveRegistration $Ctx (Invoke-CLMMoveAdapter $Ctx 'MoveRegistration');if($actual -ceq (Join-Path $Ctx.sourceRoot 'distribution')){Invoke-CLMMoveAdapter $Ctx 'MoveDistribution'|Out-Null};$actual=Assert-CLMMoveRegistration $Ctx (Invoke-CLMMoveAdapter $Ctx 'MoveRegistration');if($actual -cne (Join-Path $Ctx.destinationRoot 'distribution')){throw 'WSL move registration not confirmed; recovery required'}}elseif($actual -cne (Join-Path $Ctx.destinationRoot 'distribution')){throw 'Move registration no longer matches durable phase'}
 if($index -le 4){Save-CLMJournal $Ctx 'move-bindings';$Ctx.destination=Invoke-CLMMoveAdapter $Ctx 'MoveBindings'}
 if($index -le 5){Save-CLMJournal $Ctx 'move-verify';if(-not (Invoke-CLMMoveAdapter $Ctx 'MoveVerify')){throw 'Moved installation verification failed'}}
 if($index -le 6){Save-CLMJournal $Ctx 'move-publish';Invoke-CLMMoveAdapter $Ctx 'MovePublish'|Out-Null}
 if($index -le 7){Save-CLMJournal $Ctx 'move-finish';Invoke-CLMMoveAdapter $Ctx 'MoveFinish'|Out-Null}
 Save-CLMJournal $Ctx 'move-cleanup';Remove-CLMMoveArchives $Ctx
 foreach($root in @($Ctx.selectedRoot,$Ctx.sourceRoot)|Select-Object -Unique){Write-CLMJson (Join-Path $root 'relocated-to.json') @{schemaVersion=1;logicalId=$Ctx.logicalId;destinationRoot=$Ctx.destinationRoot;transactionId=$Ctx.id}}
 Save-CLMJournal $Ctx 'completed';return $Ctx
}
function Invoke-CastlinkMove {
 [CmdletBinding()]param([Parameter(Mandatory=$true)][string]$InstallRoot,[string]$DestinationRoot,[string]$Confirmation,[switch]$Recover,[scriptblock]$Adapter,[scriptblock]$Progress)
 $selected=Assert-CLMPath $InstallRoot;$leases=New-Object Collections.Generic.List[IDisposable]
 try{
  if($Recover){$j=Read-CLMMoveJournal $selected ([bool]$Adapter);$ctx=@{};foreach($p in $j.PSObject.Properties){$ctx[$p.Name]=$p.Value};$ctx.adapter=$Adapter;$ctx.progress=$Progress;$ctx.sourceModule=$null;$leases.Add([IO.File]::Open((Join-Path $ctx.directory 'operation.lock'),'OpenOrCreate','ReadWrite','None'));foreach($r in @($ctx.sourceRoot,$ctx.destinationRoot)|Select-Object -Unique){$leases.Add([IO.File]::Open((Join-Path $r 'operation.lock'),'OpenOrCreate','ReadWrite','None'))};return Complete-CLMMove $ctx}
  if(-not $DestinationRoot){throw 'Select an explicit move destination folder'};$root=Get-CLMRoot $selected;$dest=Assert-CLMPath $DestinationRoot
  if($dest -ieq $root -or $dest.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or $root.StartsWith($dest+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $dest)){throw 'Move destination must be a new separate directory'}
  $leases.Add([IO.File]::Open((Join-Path $selected 'maintenance.lock'),'OpenOrCreate','ReadWrite','None'));$leases.Add([IO.File]::Open((Join-Path $root 'operation.lock'),'OpenOrCreate','ReadWrite','None'))
  if(Test-Path -LiteralPath (Join-Path $selected 'maintenance-transaction.json')){$p=Read-CLMJson (Join-Path $selected 'maintenance-transaction.json');$prior=if($p.kind -ceq 'move'){Read-CLMMoveJournal $selected ([bool]$Adapter)}else{Get-CLMJournal $selected};if($prior.phase -notin @('completed','removed','restored','rolled-back')){throw 'Pending maintenance transaction; Recover first'}}
  $ctx=@{schemaVersion=1;kind='move';id=[guid]::NewGuid().ToString('N');selectedRoot=$selected;sourceRoot=$root;destinationRoot=$dest;adapter=$Adapter;progress=$Progress;sourceModule=$null}
  Invoke-CLMMoveAdapter $ctx 'MovePreflight'|Out-Null
  if($ctx.source.locationContract -cne $script:CLMLocationContract){throw 'Explicit upgrade required before Move'}
  if($ctx.source.phase -cne 'ready'){throw 'Repair or upgrade incomplete source before Move'}
  if($Confirmation -cne $ctx.source.distroName){throw 'Exact server name confirmation required'}
  if($ctx.freeBytes -lt $ctx.requiredBytes){throw 'Insufficient destination disk space before Move'}
  $ctx.logicalId=if($ctx.source.logicalInstallationId){$ctx.source.logicalInstallationId}else{$ctx.source.installationId};$ctx.registration=Invoke-CLMMoveAdapter $ctx 'MoveRegistration'
  $actual=Assert-CLMMoveRegistration $ctx $ctx.registration;if($actual -cne (Join-Path $root 'distribution')){throw 'Initial registration differs from source'}
  $ctx.directory=Get-CLMMoveDirectory $ctx.id;$ctx.journal=Join-Path $ctx.directory 'journal.json'
  if($Adapter){[void][IO.Directory]::CreateDirectory($ctx.directory);[void][IO.Directory]::CreateDirectory($dest)}else{$registry=Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry';if(Test-Path -LiteralPath $registry){Invoke-CLMInstaller $ctx.sourceModule {param($p);Assert-CastlinkLocationPrivate $p -Directory} $registry}else{Protect-CLMDirectory $registry};Protect-CLMDirectory (Split-Path $ctx.directory -Parent);Protect-CLMDirectory $ctx.directory;$stage=$dest+'.castlink-move-'+$ctx.id+'.new';if(Test-Path -LiteralPath $stage){throw 'Move destination staging collision'};Protect-CLMDirectory $stage;[IO.Directory]::Move($stage,$dest)}
  $leases.Add([IO.File]::Open((Join-Path $ctx.directory 'operation.lock'),'OpenOrCreate','ReadWrite','None'))
  $leases.Add([IO.File]::Open((Join-Path $dest 'operation.lock'),'OpenOrCreate','ReadWrite','None'))
  Write-CLMJson (Join-Path $dest 'move-owner.json') @{id=$ctx.id;logicalId=$ctx.logicalId;destinationRoot=$dest}
  # All pointers must exist before the first externally observable durable phase.
  $ctx.progress=$null;Save-CLMJournal $ctx 'move-prepared';Write-CLMMovePointers $ctx;$ctx.progress=$Progress;if($Progress){& $Progress 'move-prepared'|Out-Null}
  return Complete-CLMMove $ctx
 }finally{foreach($lease in $leases){$lease.Dispose()}}
}

# Registry is discovery metadata only: do not execute a path found in this file.
function Get-CLMLocationRecords {
 $root=Assert-CLMPath (Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry');$path=Join-Path $root 'installations.json'
 if(-not (Test-Path -LiteralPath $path)){return @()};Assert-CLMPrivatePath $root;Assert-CLMPrivatePath $path;$v=Read-CLMJson $path
 if($v.schemaVersion -ne 1 -or $v.owner -cne 'castlink-wsl-location-v1' -or $v.userSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value){throw 'Location registry ownership mismatch'}
 $seen=@{};foreach($row in @($v.installations)){if($row.logicalId -cnotmatch '^[a-f0-9]{32}$' -or $row.installationId -cnotmatch '^[a-f0-9]{32}$' -or $seen.ContainsKey($row.logicalId)){throw 'Location registry identity conflict'};$seen[$row.logicalId]=$true;foreach($p in @($row.selectedRoot,$row.activeRoot)){if($p -cnotmatch '^[A-Za-z]:\\' -or $p -cne [IO.Path]::GetFullPath($p)){throw 'Location registry path is not canonical'}};$row}
}
function Get-CastlinkMaintenanceInstallations([string]$Base=(Join-Path $env:LOCALAPPDATA 'CastLinkServer')){
 $result=New-Object Collections.Generic.List[object];$seen=@{}
 foreach($row in @(Get-CLMLocationRecords)){
  $item=[pscustomobject]@{root=$row.selectedRoot;activeRoot=$row.activeRoot;domain='?';version='?';state='unavailable';distroName='';logicalId=$row.logicalId;message='Installation disk or folder is unavailable'}
  if(Test-Path -LiteralPath $row.activeRoot -PathType Container){try{
   $actual=Get-CLMRoot $row.selectedRoot;$s=Read-CLMReceipt $actual;$id=if($s.logicalInstallationId){$s.logicalInstallationId}else{$s.installationId}
   if($actual -cne $row.activeRoot -or $s.installationId -cne $row.installationId -or $id -cne $row.logicalId){throw 'Registry and receipt identity conflict'}
   $item.version=$s.releaseTag;$item.state=$s.phase;$item.distroName=$s.distroName;$item.message='';if($s.nativePanel -and (Get-CLMHash $s.nativePanel.bindingPath) -ceq $s.nativePanel.bindingSha256){$item.domain=(Read-CLMJson $s.nativePanel.bindingPath).origin}
  }catch{$item.state='conflict';$item.message=$_.Exception.Message}}
  $seen[$row.installationId]=$item;$result.Add($item)
 }
 foreach($legacy in @(Get-CLMLegacyInstallations $Base)){
  $s=Read-CLMReceipt $legacy.activeRoot;$id=if($s.logicalInstallationId){$s.logicalInstallationId}else{$s.installationId}
  if($seen.ContainsKey($s.installationId)){if($seen[$s.installationId].activeRoot -cne $legacy.activeRoot){$seen[$s.installationId].state='conflict';$seen[$s.installationId].message='Duplicate installation identity at a different folder'};continue}
  $legacy|Add-Member NoteProperty logicalId $id -Force;$seen[$s.installationId]=$legacy;$result.Add($legacy)
 }
 return $result.ToArray()
}
