# Same-release WSL relocation. Loaded only through the lifecycle helper inventory.
$script:CLMLocationContract='castlink-wsl-location-v1'
function Get-CLMMoveDirectory([string]$Id){if($Id -cnotmatch '^[a-f0-9]{32}$'){throw 'Invalid move transaction identity'};return Join-Path (Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry\operations') $Id}
function Assert-CLMPrivatePath([string]$Path,[switch]$LegacyAdministrators){
 $p=Assert-CLMPath $Path;$acl=Get-Acl -LiteralPath $p;$allowed=@([Security.Principal.WindowsIdentity]::GetCurrent().User.Value,'S-1-5-18');if($LegacyAdministrators){$allowed+=@('S-1-5-32-544')}
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
 if($j.kind -cne 'move' -or $j.schemaVersion -ne 1 -or $j.id -cne $p.id -or $j.journal -cne $expected -or $j.directory -cne $directory -or $j.selectedRoot -cne $p.journalSelectedRoot -or $Root -cnotin @($j.selectedRoot,$j.sourceRoot,$j.destinationRoot)){throw 'Move journal identity mismatch'}
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
 Assert-CLMMoveDisks $Ctx $path
 return $path
}
function Wait-CLMMoveVhdRelease($Ctx,[ValidateRange(1,900000)][int]$TimeoutMilliseconds=90000,[ValidateRange(1,1000)][int]$PollMilliseconds=250){
 # Termination can leave the VHD attached to the shared WSL VM. Inspect only
 # host state here: entering the guest again would reacquire the disk.
 $sourcePath=Join-Path $Ctx.sourceRoot 'distribution';$clock=[Diagnostics.Stopwatch]::StartNew()
 while($true){
  $actual=Assert-CLMMoveRegistration $Ctx (Get-CLMWslRegistration $Ctx.source)
  if($actual -cne $sourcePath){throw 'Move registration changed while waiting for the VHD; Recover before retrying'}
  $probe=$null;$busy=$false
  try{$probe=[IO.File]::Open((Join-Path $actual $Ctx.registration.vhdFile),[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::None)}
  catch{$failure=$_.Exception;while($failure.InnerException){$failure=$failure.InnerException};if($failure -isnot [IO.IOException] -or ($failure.HResult -band 65535) -notin @(32,33)){throw};$busy=$true}
  finally{if($probe){$probe.Dispose()}}
  if(-not $busy){
   # Close the probe before the official move and recheck its pinned identity.
   $actual=Assert-CLMMoveRegistration $Ctx (Get-CLMWslRegistration $Ctx.source)
   if($actual -cne $sourcePath){throw 'Move registration changed while waiting for the VHD; Recover before retrying'}
   return
  }
  if($clock.ElapsedMilliseconds -ge $TimeoutMilliseconds){throw 'The VHD is still busy in WSL. Close other WSL apps or Docker Desktop, wait, then Recover. If needed, shut down your WSL work yourself before Recover; CastLink does not shut down other distributions.'}
  Start-Sleep -Milliseconds ([Math]::Min($PollMilliseconds,[Math]::Max(1,$TimeoutMilliseconds-$clock.ElapsedMilliseconds)))
 }
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
  # WSL 3.0.1 is the tested move floor; --help itself exits -1 on that version.
  $exe=Join-Path $env:WINDIR 'System32\wsl.exe';$version=(Invoke-CLMProcess $exe @('--version')) -replace "`0",''
  if($version -notmatch '(\d+\.\d+\.\d+)' -or [version]$Matches[1] -lt [version]'3.0.1'){throw 'Move requires WSL 3.0.1 or newer. Run wsl --update first.'}
  # Authenticate host ownership and actual registration before reading or importing
  # a receipt-selected installer. A self-pinned public manifest is not authority.
  Assert-CLMPrivatePath $Ctx.sourceRoot;Assert-CLMPrivatePath (Join-Path $Ctx.sourceRoot 'installation.json')
  $s=Read-CLMReceipt $Ctx.sourceRoot
  if($s.locationContract -cne $script:CLMLocationContract){throw 'Explicitly upgrade this server to a release supporting location moves first.'}
  $Ctx.source=$s;$reg=Get-CLMWslRegistration $s
  if($reg.basePath -cne (Join-Path $Ctx.sourceRoot 'distribution')){throw 'WSL registration does not match the owned source VHD location'}
  $records=@(Get-CLMLocationRecords);$logical=if($s.logicalInstallationId){$s.logicalInstallationId}else{$s.installationId}
  $rows=@($records|Where-Object {$_.logicalId -ceq $logical});if($rows.Count -gt 1 -or ($rows.Count -eq 1 -and ($rows[0].selectedRoot -cne $Ctx.selectedRoot -or $rows[0].activeRoot -cne $Ctx.sourceRoot -or $rows[0].installationId -cne $s.installationId))){throw 'Registry identity conflict; source preserved'}
  Assert-CLMGuestMarker $s
  Get-CLMSourcePackage $Ctx $s;$m=Read-CLMJson $Ctx.sourceManifest
  if($m.lifecycle.locationContract -cne $script:CLMLocationContract){throw 'Explicitly upgrade this server before moving its pinned installer.'}
  Assert-CLMPrivatePath $Ctx.sourceManifest;Assert-CLMPrivatePath $Ctx.sourceInstaller
  $Ctx.sourceModule=Import-CLMInstaller $Ctx.sourceInstaller;$Ctx.installerHash=Get-CLMHash $Ctx.sourceInstaller
  $Ctx.destinationRoot=Invoke-CLMInstaller $Ctx.sourceModule {param($p);$root=Assert-CastlinkInstallRoot $p;Assert-CastlinkUnusedLocation $root;return $root} $Ctx.destinationRoot
  $vhd=Assert-CLMPath (Join-Path $reg.basePath $reg.vhdFile);$Ctx.sourceVhdBytes=(Get-Item -LiteralPath $vhd).Length
  Get-CLMOwnedFiles $Ctx;$archives=@($m.rootfs,$m.sources,$m.upstreamSources)|Where-Object {$_}|ForEach-Object {Join-Path $Ctx.sourceRoot ('release\'+$_.file)};$Ctx.archiveFiles=@($Ctx.ownedFiles|Where-Object {$_.path -cin $archives});$Ctx.requiredBytes=[long]$Ctx.sourceVhdBytes+2147483648L;foreach($e in @($Ctx.ownedFiles)){$Ctx.requiredBytes+=(Get-Item -LiteralPath $e.path).Length}
  $Ctx.freeBytes=([IO.DriveInfo]::new([IO.Path]::GetPathRoot($Ctx.destinationRoot))).AvailableFreeSpace
  $Ctx.task=Invoke-CLMDefaultAdapter 'SourceTask' $Ctx $null
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
 'MoveDistribution' {Assert-CLMGuestMarker $Ctx.source;Assert-CLMStopped $Ctx.source;$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.source.distroName);Wait-CLMMoveVhdRelease $Ctx;$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--manage',$Ctx.source.distroName,'--move',(Join-Path $Ctx.destinationRoot 'distribution')) '' '' 1048576 3600;return}
 'MoveBindings' {return Set-CLMMoveBindings $Ctx}
 'MoveVerify' {
  Initialize-CLMMoveModule $Ctx;$Ctx.destination=Sync-CLMKeepaliveReceipt $Ctx.destinationRoot $Ctx.destination $Ctx.sourceModule;Assert-CLMGuestMarker $Ctx.destination
  $inspect=Invoke-CLMGuest $Ctx $Ctx.destination 'inspect'|ConvertFrom-Json
  if(-not $inspect.initialized -or -not $inspect.complete -or $inspect.postgresMajor -ne 16 -or $inspect.release.buildId -cne ($Ctx.source.releaseTag -replace '^server-wsl-v','') -or $inspect.gateTransactionId -cne $Ctx.id -or $inspect.gate -cnotin @('closed','committed')){throw 'Moved guest build or maintenance gate identity mismatch'}
  if(-not $Ctx.source.desiredRunning -and -not $inspect.stopped){throw 'Moved stopped source unexpectedly running'}
  if($Ctx.source.desiredRunning){Invoke-CLMInstaller $Ctx.sourceModule {param($d);Start-CastlinkKeepalive $d.root $d.s} @{root=$Ctx.destinationRoot;s=$Ctx.destination};$null=Invoke-CLMWsl $Ctx.destination @('/usr/local/bin/castlink-server','start') '' '' 1048576 1200;$status=Invoke-CLMWsl $Ctx.destination @('/usr/local/bin/castlink-server','status')|ConvertFrom-Json;if(-not $status.ready -or $status.buildId -cne ($Ctx.source.releaseTag -replace '^server-wsl-v','')){throw 'Moved same-release readiness mismatch'}}else{Assert-CLMStopped $Ctx.destination}
  return $true
 }
 'MovePublish' {
  Initialize-CLMMoveModule $Ctx
  if($Ctx.destination.nativePanel){
   $entry=@{candidateRoot=$Ctx.destinationRoot;selectedRoot=$Ctx.destinationRoot;directory=$Ctx.directory;id=$Ctx.id;entryPointBeforeHash=$null;entryPointHash=$Ctx.entryPointHash}
   if(-not $Ctx.entryPointHash){if(Test-Path -LiteralPath (Join-Path $Ctx.destinationRoot 'CastLinkServer.lnk')){throw 'Unknown destination shortcut exists'};Prepare-CLMEntryPoint $entry;$Ctx.entryPointHash=$entry.entryPointHash;Save-CLMJournal $Ctx 'move-publish'}
   Copy-CLMMovePayload (Join-Path $Ctx.directory 'active-panel.lnk') (Join-Path $Ctx.destinationRoot 'CastLinkServer.lnk') (Join-Path $Ctx.destinationRoot ($Ctx.id+'.new.lnk')) $Ctx.entryPointHash ((Get-Item -LiteralPath (Join-Path $Ctx.directory 'active-panel.lnk')).Length)
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
 'MoveCancelRestore' {
  Initialize-CLMMoveModule $Ctx;$Ctx.source=Sync-CLMKeepaliveReceipt $Ctx.sourceRoot $Ctx.source $Ctx.sourceModule;Assert-CLMGuestMarker $Ctx.source
  $inspect=Invoke-CLMGuest $Ctx $Ctx.source 'inspect'|ConvertFrom-Json
  if($inspect.release.buildId -cne ($Ctx.source.releaseTag -replace '^server-wsl-v','')){throw 'Cancel source guest build mismatch'}
  if($inspect.gate -ceq 'closed' -and $inspect.gateTransactionId -cne $Ctx.id){throw 'Another guest transaction owns cancellation gate'}
  if($inspect.gateTransactionId -ceq $Ctx.id){$null=Invoke-CLMGuest $Ctx $Ctx.source 'gate-open' '' '' @('--committed-transaction',$Ctx.id)}
  $Ctx.source.phase='ready';$Ctx.source.PSObject.Properties.Remove('maintenanceTransaction');Write-CLMJson (Join-Path $Ctx.sourceRoot 'installation.json') $Ctx.source
  if($Ctx.task.exists){$null=Invoke-CLMDefaultAdapter 'SourceTask' $Ctx $null;if($Ctx.task.enabled){Enable-ScheduledTask -TaskName $Ctx.task.spec.taskName -TaskPath $Ctx.task.spec.taskPath|Out-Null}else{Disable-ScheduledTask -TaskName $Ctx.task.spec.taskName -TaskPath $Ctx.task.spec.taskPath|Out-Null}}
  if($Ctx.source.desiredRunning){Invoke-CLMDefaultAdapter 'ResumeSource' $Ctx $null;$status=Invoke-CLMWsl $Ctx.source @('/usr/local/bin/castlink-server','status')|ConvertFrom-Json;if(-not $status.ready -or $status.buildId -cne ($Ctx.source.releaseTag -replace '^server-wsl-v','')){throw 'Cancelled source readiness failed'}}else{Assert-CLMStopped $Ctx.source;$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.source.distroName)}
  return
 }
 'MoveFinish' {$null=Invoke-CLMGuest $Ctx $Ctx.destination 'gate-open' '' '' @('--committed-transaction',$Ctx.id);if(-not $Ctx.source.desiredRunning){Assert-CLMStopped $Ctx.destination;$null=Invoke-CLMProcess (Join-Path $env:WINDIR 'System32\wsl.exe') @('--terminate',$Ctx.destination.distroName)};return}
 default {throw ('Unknown move adapter operation '+$Name)}
 }
}
function New-CLMMoveCopyPlan($Ctx){
 $plan=New-Object Collections.Generic.List[object];$seen=@{}
 foreach($e in @($Ctx.ownedFiles)){
  $source=Assert-CLMPath $e.path;if(-not $source.StartsWith($Ctx.sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Move inventory escapes source ownership'}
  $path=Join-Path $Ctx.destinationRoot $source.Substring($Ctx.sourceRoot.Length+1);$seen[$path]=$true;$plan.Add([pscustomobject]@{source=$source;path=$path;stage=($path+'.castlink-move-'+$Ctx.id+'.part');sha256=$e.sha256;size=(Get-Item -LiteralPath $source).Length})
 }
 if(-not $Ctx.adapter){foreach($pair in @(@($Ctx.sourceInstaller,'install-server-windows.ps1'),@($Ctx.sourceManifest,'release\manifest.json'))){$path=Join-Path $Ctx.destinationRoot $pair[1];if(-not $seen.ContainsKey($path)){$plan.Add([pscustomobject]@{source=$pair[0];path=$path;stage=($path+'.castlink-move-'+$Ctx.id+'.part');sha256=(Get-CLMHash $pair[0]);size=(Get-Item -LiteralPath $pair[0]).Length})}}}
 return $plan.ToArray()
}
function Copy-CLMMovePayload([string]$Source,[string]$Path,[string]$Stage,[string]$Hash,[long]$Size){
 foreach($p in @($Source,$Path,$Stage)){$null=Assert-CLMPath $p}
 if((Get-Item -LiteralPath $Source).Length -ne $Size -or (Get-CLMHash $Source) -cne $Hash){throw 'Move source inventory changed; preserved for recovery'}
 if(Test-Path -LiteralPath $Path){if((Get-Item -LiteralPath $Path).Length -ne $Size -or (Get-CLMHash $Path) -cne $Hash){throw 'Move destination owned file changed; preserved for recovery'};return}
 Protect-CLMDirectory (Split-Path $Path -Parent)
 # Stage names and expected content are durably recorded before creation. A partial
 # stage belongs to this operation and can be replaced; published files cannot.
 $complete=(Test-Path -LiteralPath $Stage) -and (Get-Item -LiteralPath $Stage).Length -eq $Size -and (Get-CLMHash $Stage) -ceq $Hash
 if(-not $complete){if(Test-Path -LiteralPath $Stage){[IO.File]::Delete($Stage)};$sourceStream=[IO.File]::OpenRead($Source);$output=$null;try{$output=New-CLMPrivateFileStream $Stage;$sourceStream.CopyTo($output);$output.Flush($true)}finally{if($output){$output.Dispose()};$sourceStream.Dispose()}}
 if((Get-Item -LiteralPath $Stage).Length -ne $Size -or (Get-CLMHash $Stage) -cne $Hash){throw 'Move staged copy checksum mismatch'}
 [IO.File]::Move($Stage,$Path)
}
function Copy-CLMMoveFiles($Ctx){Assert-CLMMoveCopyPlan $Ctx;foreach($e in @($Ctx.copyPlan)){Copy-CLMMovePayload $e.source $e.path $e.stage $e.sha256 ([long]$e.size)}}
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
 Assert-CLMMoveCopyPlan $Ctx
 if(-not (Test-Path -LiteralPath $Ctx.destinationRoot -PathType Container)){throw 'Move destination disk or directory unavailable; recovery required'}
 $marker=Read-CLMJson (Join-Path $Ctx.destinationRoot 'move-owner.json')
 if($marker.id -cne $Ctx.id -or $marker.logicalId -cne $Ctx.logicalId -or $marker.destinationRoot -cne $Ctx.destinationRoot){throw 'Move destination ownership identity changed'}
 $allowed=@{};foreach($name in @('move-owner.json','maintenance-transaction.json','installation.json','operation.lock','maintenance.lock','CastLinkServer.lnk','install-server-windows.ps1','release\manifest.json')){$allowed[(Join-Path $Ctx.destinationRoot $name)]=$true}
 foreach($entry in @($Ctx.ownedFiles)){$relative=$entry.path.Substring($Ctx.sourceRoot.Length+1);$allowed[(Join-Path $Ctx.destinationRoot $relative)]=$true}
 foreach($entry in @($Ctx.copyPlan)){$allowed[$entry.path]=$true;$allowed[$entry.stage]=$true};if($Ctx.entryPointHash){$allowed[(Join-Path $Ctx.destinationRoot ($Ctx.id+'.new.lnk'))]=$true}
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
 if(($index -lt 3 -and $actual -cne (Join-Path $Ctx.sourceRoot 'distribution')) -or ($index -gt 3 -and $actual -cne (Join-Path $Ctx.destinationRoot 'distribution'))){throw 'Move registration no longer matches durable phase'}
 if($index -le 1){Save-CLMJournal $Ctx 'move-quiesce';Invoke-CLMMoveAdapter $Ctx 'MoveQuiesce'|Out-Null}
 if($index -le 2){Save-CLMJournal $Ctx 'move-copy';Copy-CLMMoveFiles $Ctx}
 if($index -le 3){Save-CLMJournal $Ctx 'move-wsl';$actual=Assert-CLMMoveRegistration $Ctx (Invoke-CLMMoveAdapter $Ctx 'MoveRegistration');if($actual -ceq (Join-Path $Ctx.sourceRoot 'distribution')){Invoke-CLMMoveAdapter $Ctx 'MoveDistribution'|Out-Null};$actual=Assert-CLMMoveRegistration $Ctx (Invoke-CLMMoveAdapter $Ctx 'MoveRegistration');if($actual -cne (Join-Path $Ctx.destinationRoot 'distribution')){throw 'WSL move registration not confirmed; recovery required'}}elseif($actual -cne (Join-Path $Ctx.destinationRoot 'distribution')){throw 'Move registration no longer matches durable phase'}
 if($index -le 4){Save-CLMJournal $Ctx 'move-bindings';$Ctx.destination=Invoke-CLMMoveAdapter $Ctx 'MoveBindings'}
 if($index -le 5){Save-CLMJournal $Ctx 'move-verify';if(-not (Invoke-CLMMoveAdapter $Ctx 'MoveVerify')){throw 'Moved installation verification failed'}}
 if($index -ge 6){if(-not (Invoke-CLMMoveAdapter $Ctx 'MoveVerify')){throw 'Moved installation readiness reconciliation failed'}}
 if($index -le 6){Save-CLMJournal $Ctx 'move-publish';Invoke-CLMMoveAdapter $Ctx 'MovePublish'|Out-Null}
 if($index -le 7){Save-CLMJournal $Ctx 'move-finish';Invoke-CLMMoveAdapter $Ctx 'MoveFinish'|Out-Null}
 Save-CLMJournal $Ctx 'move-cleanup';Remove-CLMMoveArchives $Ctx
 foreach($root in @($Ctx.selectedRoot,$Ctx.sourceRoot)|Select-Object -Unique){Write-CLMJson (Join-Path $root 'relocated-to.json') @{schemaVersion=1;logicalId=$Ctx.logicalId;destinationRoot=$Ctx.destinationRoot;transactionId=$Ctx.id}}
 Save-CLMJournal $Ctx 'completed';return $Ctx
}
function Invoke-CastlinkMove {
 [CmdletBinding()]param([Parameter(Mandatory=$true)][string]$InstallRoot,[string]$DestinationRoot,[string]$Confirmation,[switch]$Recover,[switch]$Cancel,[scriptblock]$Adapter,[scriptblock]$Progress)
 $selected=Assert-CLMPath $InstallRoot;$leases=New-Object Collections.Generic.List[IDisposable]
 try{
  if($Cancel -and -not $Recover){throw 'Cancel requires the durable recovery journal'}
  if($Recover){
   $initial=Read-CLMMoveJournal $selected ([bool]$Adapter)
   $leases.Add((New-CLMPrivateFileStream (Join-Path $initial.directory 'operation.lock') ([IO.FileMode]::OpenOrCreate)))
   foreach($r in @($initial.sourceRoot,$initial.destinationRoot)|Select-Object -Unique){$leases.Add((New-CLMPrivateFileStream (Join-Path $r 'operation.lock') ([IO.FileMode]::OpenOrCreate)))}
   foreach($r in @($initial.selectedRoot,$initial.destinationRoot)|Select-Object -Unique){$leases.Add((New-CLMPrivateFileStream (Join-Path $r 'maintenance.lock') ([IO.FileMode]::OpenOrCreate)))}
   $j=Read-CLMMoveJournal $selected ([bool]$Adapter)
   foreach($field in @('id','directory','journal','selectedRoot','sourceRoot','destinationRoot','logicalId')){if($j.$field -cne $initial.$field){throw 'Move journal identity changed while acquiring leases'}}
   $ctx=@{};foreach($p in $j.PSObject.Properties){$ctx[$p.Name]=$p.Value};$ctx.adapter=$Adapter;$ctx.progress=$Progress;$ctx.sourceModule=$null
   if($Cancel){if($Confirmation -cne $ctx.source.distroName){throw 'Exact server name confirmation required'};return Undo-CLMMove $ctx}
   if($ctx.phase -in @('move-cancel-restore','move-cancel-cleanup','cancelled')){return Undo-CLMMove $ctx}
   return Complete-CLMMove $ctx
  }
  if(-not $DestinationRoot){throw 'Select an explicit move destination folder'};$root=Get-CLMRoot $selected;$dest=Assert-CLMPath $DestinationRoot
  if($dest -ieq $root -or $dest.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or $root.StartsWith($dest+'\',[StringComparison]::OrdinalIgnoreCase) -or (Test-Path -LiteralPath $dest)){throw 'Move destination must be a new separate directory'}
  $leases.Add([IO.File]::Open((Join-Path $selected 'maintenance.lock'),'OpenOrCreate','ReadWrite','None'));$leases.Add([IO.File]::Open((Join-Path $root 'operation.lock'),'OpenOrCreate','ReadWrite','None'))
  if(Test-Path -LiteralPath (Join-Path $selected 'maintenance-transaction.json')){$p=Read-CLMJson (Join-Path $selected 'maintenance-transaction.json');$prior=if($p.kind -ceq 'move'){Read-CLMMoveJournal $selected ([bool]$Adapter)}else{Get-CLMJournal $selected};if($prior.phase -notin @('completed','removed','restored','rolled-back')){throw 'Pending maintenance transaction; Recover first'}}
  $ctx=@{schemaVersion=1;kind='move';id=[guid]::NewGuid().ToString('N');selectedRoot=$selected;sourceRoot=$root;destinationRoot=$dest;adapter=$Adapter;progress=$Progress;sourceModule=$null}
  Assert-CLMUnusedMoveDestination $dest
  Invoke-CLMMoveAdapter $ctx 'MovePreflight'|Out-Null
  if($ctx.source.locationContract -cne $script:CLMLocationContract){throw 'Explicit upgrade required before Move'}
  if($ctx.source.phase -cne 'ready'){throw 'Repair or upgrade incomplete source before Move'}
  if($Confirmation -cne $ctx.source.distroName){throw 'Exact server name confirmation required'}
  if($ctx.freeBytes -lt $ctx.requiredBytes){throw 'Insufficient destination disk space before Move'}
  $ctx.logicalId=if($ctx.source.logicalInstallationId){$ctx.source.logicalInstallationId}else{$ctx.source.installationId};$ctx.registration=Invoke-CLMMoveAdapter $ctx 'MoveRegistration'
  $actual=Assert-CLMMoveRegistration $ctx $ctx.registration;if($actual -cne (Join-Path $root 'distribution')){throw 'Initial registration differs from source'}
  $ctx.copyPlan=@(New-CLMMoveCopyPlan $ctx);$ctx.priorPointers=@(foreach($r in @($selected,$root)|Select-Object -Unique){$p=Join-Path $r 'maintenance-transaction.json';[pscustomobject]@{root=$r;pointer=$(if(Test-Path -LiteralPath $p){Read-CLMJson $p}else{$null})}})
  $ctx.directory=Get-CLMMoveDirectory $ctx.id;$ctx.journal=Join-Path $ctx.directory 'journal.json'
  if($Adapter){[void][IO.Directory]::CreateDirectory($ctx.directory);[void][IO.Directory]::CreateDirectory($dest)}else{$registry=Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry';if(Test-Path -LiteralPath $registry){Invoke-CLMInstaller $ctx.sourceModule {param($p);Assert-CastlinkLocationPrivate $p -Directory} $registry}else{Protect-CLMDirectory $registry};Protect-CLMDirectory (Split-Path $ctx.directory -Parent);Protect-CLMDirectory $ctx.directory;$destinationLease=Invoke-CLMInstaller $ctx.sourceModule {param($p);New-CastlinkMoveDestination $p} $dest;if(-not $destinationLease){throw 'Destination operation lease was not acquired'};$leases.Add($destinationLease)}
  $leases.Add([IO.File]::Open((Join-Path $ctx.directory 'operation.lock'),'OpenOrCreate','ReadWrite','None'))
  if($Adapter){$leases.Add((New-CLMPrivateFileStream (Join-Path $dest 'operation.lock') ([IO.FileMode]::OpenOrCreate)))}
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

function Assert-CLMMoveDisks($Ctx,[string]$RegisteredPath){
 foreach($root in @($Ctx.sourceRoot,$Ctx.destinationRoot)){
  $directory=Assert-CLMPath (Join-Path $root 'distribution');$vhd=Join-Path $directory $Ctx.registration.vhdFile
  if(Test-Path -LiteralPath $directory){foreach($entry in Get-ChildItem -LiteralPath $directory -Force){$p=Assert-CLMPath $entry.FullName;if($entry.PSIsContainer -or $p -cne $vhd){throw 'Conflicting distribution contents; preserve both locations for manual recovery'}}}
  $exists=Test-Path -LiteralPath $vhd -PathType Leaf
  if($directory -ceq $RegisteredPath){if(-not $exists){throw 'Registered VHD disk is unavailable; recovery required'}}elseif($exists){throw 'Conflicting residual VHD disk exists at the other location; both copies were preserved'}
 }
}
function Undo-CLMMove($Ctx){
 Assert-CLMMoveCopyPlan $Ctx
 $actual=Assert-CLMMoveRegistration $Ctx (Invoke-CLMMoveAdapter $Ctx 'MoveRegistration')
 if($actual -cne (Join-Path $Ctx.sourceRoot 'distribution')){throw 'Cannot cancel after WSL relocated the VHD; Recover the move instead'}
 if($Ctx.phase -ceq 'cancelled'){return $Ctx}
 if($Ctx.phase -cnotin @('move-prepared','move-quiesce','move-copy','move-wsl','move-cancel-restore','move-cancel-cleanup')){throw 'Cannot cancel this published move phase; Recover instead'}
 $marker=Read-CLMJson (Join-Path $Ctx.destinationRoot 'move-owner.json');if($marker.id -cne $Ctx.id -or $marker.logicalId -cne $Ctx.logicalId -or $marker.destinationRoot -cne $Ctx.destinationRoot){throw 'Cancel destination ownership mismatch'}
 $published=$true
 if(-not $Ctx.priorPointers){throw 'Cancellation source pointer inventory is missing'}
 foreach($prior in @($Ctx.priorPointers)){
  if($prior.root -cnotin @($Ctx.selectedRoot,$Ctx.sourceRoot)){throw 'Cancellation source pointer escapes operation identity'}
  $path=Join-Path $prior.root 'maintenance-transaction.json';$current=if(Test-Path -LiteralPath $path){Read-CLMJson $path}else{$null}
  if($current -and $current.id -ceq $Ctx.id -and $current.journal -ceq $Ctx.journal){$published=$false;continue}
  if(($current|ConvertTo-Json -Depth 32 -Compress) -cne ($prior.pointer|ConvertTo-Json -Depth 32 -Compress)){throw 'Source operation pointer changed during cancellation'}
 }
 if($Ctx.phase -ceq 'move-cancel-cleanup' -and $published){Save-CLMJournal $Ctx 'cancelled';return $Ctx}
 if($Ctx.phase -cne 'move-cancel-cleanup'){Save-CLMJournal $Ctx 'move-cancel-restore'};Invoke-CLMMoveAdapter $Ctx 'MoveCancelRestore'|Out-Null
  $restored=Copy-CLMObject $Ctx.source;$restored.phase='ready';$restored.PSObject.Properties.Remove('maintenanceTransaction');Write-CLMJson (Join-Path $Ctx.sourceRoot 'installation.json') $restored
 Save-CLMJournal $Ctx 'move-cancel-cleanup'
 foreach($entry in @($Ctx.copyPlan)){
  if(Test-Path -LiteralPath $entry.path){if((Get-CLMHash $entry.path) -cne $entry.sha256){throw 'Changed destination copy preserved during cancellation'};[IO.File]::Delete((Assert-CLMPath $entry.path))}
  if(Test-Path -LiteralPath $entry.stage){[IO.File]::Delete((Assert-CLMPath $entry.stage))}
 }
 # Unknown files and all VHDs are excluded from cleanup. Keep the destination's
 # marker/pointer as a non-runnable audit record; restore the old source entry points.
 foreach($prior in @($Ctx.priorPointers)){
  $path=Join-Path $prior.root 'maintenance-transaction.json'
  if(Test-Path -LiteralPath $path){$current=Read-CLMJson $path;if($current.id -cne $Ctx.id){if($prior.pointer -and (($current|ConvertTo-Json -Depth 32 -Compress) -ceq ($prior.pointer|ConvertTo-Json -Depth 32 -Compress))){continue};throw 'Source operation pointer changed during cancellation'}}elseif(-not $prior.pointer){continue}
  if($prior.pointer){Write-CLMJson $path $prior.pointer}else{[IO.File]::Delete($path)}
 }
 Save-CLMJournal $Ctx 'cancelled';return $Ctx
}
function Get-CastlinkMoveEstimate {
 [CmdletBinding()]param([Parameter(Mandatory=$true)][string]$InstallRoot,[Parameter(Mandatory=$true)][string]$DestinationRoot)
 $selected=Assert-CLMPath $InstallRoot;$root=Get-CLMRoot $selected;Assert-CLMPrivatePath $root;Assert-CLMPrivatePath (Join-Path $root 'installation.json');$s=Read-CLMReceipt $root
 if($s.locationContract -cne $script:CLMLocationContract){throw 'Explicitly upgrade this server before Move'}
 $destination=Assert-CLMPath $DestinationRoot;if($destination -cnotmatch '^[A-Za-z]:\\' -or $destination -ieq [IO.Path]::GetPathRoot($destination) -or (Test-Path -LiteralPath $destination) -or $destination.StartsWith($root+'\',[StringComparison]::OrdinalIgnoreCase) -or $root.StartsWith($destination+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Choose a new separate local destination folder'}
 Assert-CLMUnusedMoveDestination $destination
 $drive=[IO.DriveInfo]::new([IO.Path]::GetPathRoot($destination));if(-not $drive.IsReady -or $drive.DriveFormat -cne 'NTFS' -or $drive.DriveType -notin @([IO.DriveType]::Fixed,[IO.DriveType]::Removable)){throw 'Move destination requires an available local NTFS volume'}
 $reg=Get-CLMWslRegistration $s;if($reg.basePath -cne (Join-Path $root 'distribution')){throw 'Source WSL registration does not match the owned VHD location'}
 $manifest=Join-Path $root 'release\manifest.json';$pin=if($s.releaseManifestSha256){$s.releaseManifestSha256}else{$s.nativePanel.manifestSha256};if($pin -cnotmatch '^[a-f0-9]{64}$' -or (Get-CLMHash $manifest) -cne $pin){throw 'Move estimate requires verified installed release metadata'}
 $m=Read-CLMJson $manifest;Assert-CLMSourceManifest $m $s
 $ctx=@{source=$s;sourceRoot=$root;sourceManifest=$manifest;sourceInstaller=(Join-Path $root 'install-server-windows.ps1')};Get-CLMOwnedFiles $ctx
 $required=[long](Get-Item -LiteralPath (Join-Path $reg.basePath $reg.vhdFile)).Length+2147483648L;foreach($entry in @($ctx.ownedFiles)){$required+=(Get-Item -LiteralPath $entry.path).Length}
 return [pscustomobject]@{source=$s;sourceRoot=$root;selectedRoot=$selected;destinationRoot=$destination;requiredBytes=$required;freeBytes=$drive.AvailableFreeSpace}
}
function Assert-CLMUnusedMoveDestination([string]$Root){
 $root=Assert-CLMPath $Root
 foreach($row in @(Get-CLMLocationRecords)){if($row.selectedRoot -ieq $root -or $row.activeRoot -ieq $root){throw 'Move destination is already a registered installation location, even if its disk is unavailable'}}
 $hash=[Security.Cryptography.SHA256]::Create();try{$key=[BitConverter]::ToString($hash.ComputeHash([Text.Encoding]::UTF8.GetBytes($root.ToLowerInvariant()))).Replace('-','').ToLowerInvariant()}finally{$hash.Dispose()}
 $reservation=Assert-CLMPath (Join-Path $env:LOCALAPPDATA ('CastLinkServerRegistry\reservations\'+$key+'.json'))
 if(Test-Path -LiteralPath $reservation){throw 'Move destination is reserved by an incomplete installation; repair or recover it first'}
}
function Assert-CLMMoveCopyPlan($Ctx){
 $seen=@{}
 foreach($entry in @($Ctx.copyPlan)){
  $path=Assert-CLMPath $entry.path;$stage=Assert-CLMPath $entry.stage;$source=Assert-CLMPath $entry.source
  if(-not $path.StartsWith($Ctx.destinationRoot+'\',[StringComparison]::OrdinalIgnoreCase) -or $path -cne $entry.path -or $stage -cne ($path+'.castlink-move-'+$Ctx.id+'.part') -or $seen.ContainsKey($path) -or $entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or [long]$entry.size -lt 0){throw 'Move copy inventory identity mismatch'}
  if(-not $source.StartsWith($Ctx.sourceRoot+'\',[StringComparison]::OrdinalIgnoreCase) -and $source -cnotin @($Ctx.sourceInstaller,$Ctx.sourceManifest)){throw 'Move copy source escapes operation ownership'}
  $seen[$path]=$true
 }
}
