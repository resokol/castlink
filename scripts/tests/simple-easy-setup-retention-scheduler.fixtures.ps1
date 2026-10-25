param([string]$HelperPath)
$ErrorActionPreference='Stop'
. $HelperPath
. (Join-Path (Split-Path $HelperPath -Parent) 'simple-easy-setup-control.ps1') -FunctionsOnly
$root=Join-Path $env:TEMP ('castlink-scheduler-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $root
try {
  $script:SshSession=$null
  $state=[pscustomobject]@{installationId=[Guid]::NewGuid().ToString();completed=$true;target='local'}
  $release=[pscustomobject]@{commit=('a'*40);images=[pscustomobject]@{web=('castlink-easy-web:'+('a'*40))};imageArchiveSha256=('b'*64)}
  $receipt=Open-SimpleOwnership $root;$receipt.installationId=$state.installationId
  Write-SimpleText (Join-Path $root '.castlink-owned.json') ($receipt|ConvertTo-Json -Depth 8)
  Register-SimpleSuccessfulImages $root $state $release
  $script:daemonId='fixture-engine'
  function Invoke-DeploymentDocker([string[]]$Arguments){if($Arguments[0] -ceq 'info'){return $script:daemonId};throw 'Scheduled cleanup reached destructive Docker commands'}
  $script:task=$null;$script:registrations=0;$script:unregistrations=0
  function Get-ScheduledTask([string]$TaskName,[string]$TaskPath){return $script:task}
  function New-ScheduledTaskAction([string]$Execute,[string]$Argument,[string]$WorkingDirectory){return [pscustomobject]@{Execute=$Execute;Arguments=$Argument;WorkingDirectory=$WorkingDirectory}}
  function New-ScheduledTaskTrigger([switch]$Once,[DateTime]$At,[TimeSpan]$RepetitionInterval){if($RepetitionInterval.TotalHours -ne 1){throw 'Housekeeping is not hourly'};return [pscustomobject]@{At=$At}}
  function New-ScheduledTaskPrincipal([string]$UserId,[string]$LogonType,[string]$RunLevel){if($LogonType -cne 'Interactive' -or $RunLevel -cne 'Limited'){throw 'Housekeeping changed user/privilege scope'};return [pscustomobject]@{UserId=$UserId;LogonType=$LogonType}}
  function New-ScheduledTaskSettingsSet([string]$MultipleInstances,[TimeSpan]$ExecutionTimeLimit,[switch]$StartWhenAvailable){if($MultipleInstances -cne 'IgnoreNew'){throw 'Concurrent scheduled runs allowed'};return [pscustomobject]@{}}
  function Register-ScheduledTask([string]$TaskName,[string]$TaskPath,$Action,$Trigger,$Principal,$Settings,[string]$Description,[switch]$Force){$script:registrations++;$script:task=[pscustomobject]@{Description=$Description;Actions=@($Action);Principal=$Principal}}
  function Unregister-ScheduledTask([string]$TaskName,[string]$TaskPath,[switch]$Confirm){$script:unregistrations++;$script:task=$null}
  Install-SimpleRetentionTask $root $state
  Install-SimpleRetentionTask $root $state
  if($script:registrations -ne 2 -or $script:task.Actions[0].Arguments -notmatch '-NonInteractive.*-RetentionFolder' -or $script:task.Actions[0].Arguments -match 'gui|Start-Simple'){throw 'Wrong headless housekeeping action'}
  $script:task.Description='user edited';$failed=$false
  try{Install-SimpleRetentionTask $root $state}catch{$failed=$true}
  if(-not $failed -or $script:registrations -ne 2){throw 'Edited task overwritten'}
  Remove-SimpleRetentionTask $root $state (Open-SimpleOwnership $root)
  if($script:unregistrations){throw 'Edited task removed'}
  $receipt=Open-SimpleOwnership $root;$script:task.Description=$receipt.retentionTask.description
  Remove-SimpleRetentionTask $root $state $receipt
  if($script:unregistrations -ne 1 -or (Open-SimpleOwnership $root).PSObject.Properties['retentionTask']){throw 'Owned task removal did not clear receipt'}
  function Read-SimpleControlInstallation([string]$Folder){return [pscustomobject]@{state=$state;compose=[pscustomobject]@{name=('castlink-easy-'+$state.installationId.Replace('-',''))}}}
  function Find-Desktop{return 'fixture-desktop'}
  function Set-SimpleControlDocker([string]$Folder,[string]$Desktop){$script:SshSession=$null;$script:DockerExe='fixture-docker'}
  function Test-LinuxEngine([string]$Docker){return $true}
  $script:daemonId='replacement-engine';$failed=$false
  try{Invoke-SimpleScheduledRetention $root}catch{if($_.Exception.Message -match 'daemon identity'){$failed=$true}else{throw}}
  if(-not $failed){throw 'Replaced daemon accepted for local scheduled cleanup'}
  $script:daemonId='fixture-engine'
  # Remote systemd writes are captured, never sent to a device.
  $state.target='remote';$script:SshSession='fixture';$script:ServerFolder='/opt/castlink-easy-'+$state.installationId.Replace('-','')
  $script:siblingJson='[]'
  $script:remoteRecord='';$script:units=@{};$script:commands=@();$script:activationFailure=$false
  function ConvertTo-SimplePosixLiteral([string]$Value){return ("'"+$Value+"'")}
  function Invoke-SimpleSshCommand($Client,[string]$Command,[string]$Stdin=''){
    $script:commands+= $Command;$out=''
    if($Command -like 'test -f *--sibling-references'){$out=$script:siblingJson}
    elseif($Command -like 'if test -e *castlink-retention.json*'){$out=$script:remoteRecord}
    elseif($Command -like 'if test -e */etc/systemd/system/*'){
      foreach($key in @($script:units.Keys)){if($Command.Contains($key)){$out=(Get-SimpleRetentionTextHash $script:units[$key])+'  '+$key}}
    }elseif($Command -like 'umask 077; cat >*castlink-retention.json*'){$script:remoteRecord=$Stdin}
    elseif($Command -like 'umask 022; cat >*'){$match=[regex]::Match($Command,'castlink-windows-retention-[a-f0-9]{32}\.(service|timer)');$script:units[$match.Value]=$Stdin}
    elseif($Command -like 'systemctl disable --now *'){$script:units=@{}}
    if($script:activationFailure -and $Command -like 'systemctl daemon-reload*'){return [pscustomobject]@{code=1;stdout='';stderr='fixture scheduler failure'}}
    return [pscustomobject]@{code=0;stdout=$out;stderr=''}
  }
  $compose=[pscustomobject]@{name=('castlink-easy-'+$state.installationId.Replace('-',''))}
  if(@(Get-SimpleRemoteRetainedImageReferences $compose).Count){throw 'Empty JSON sibling references did not parse as zero tags'}
  $script:siblingJson=ConvertTo-Json -InputObject @($release.images.web) -Compress
  if(@(Get-SimpleRemoteRetainedImageReferences $compose)[0] -cne $release.images.web){throw 'JSON sibling references lost their tag identity'}
  $linux=Join-Path $root 'fixture-linux.tar.gz';Write-SimpleText $linux 'archive'
  Install-SimpleRemoteRetention $root $state $release $linux
  Install-SimpleRemoteRetention $root $state $release $linux
  if($script:units.Count -ne 2 -or -not @($script:commands|Where-Object{$_ -match 'enable --now.*timer.*is-active'}).Count){throw 'Remote timer not activated/verified'}
  $service=@($script:units.Keys|Where-Object{$_ -like '*.service'})[0]
  if($script:units[$service] -match 'Requires=|Wants=|docker.*start|ssh ' -or $script:units[$service] -notmatch '/usr/bin/python3.*--installation-id'){throw 'Remote timer launches Docker/SSH or loses identity'}
  $script:units[$service]+='# user edit';$failed=$false
  try{Install-SimpleRemoteRetention $root $state $release $linux}catch{$failed=$true}
  if(-not $failed){throw 'Edited remote unit overwritten'}
  $failed=$false;try{Remove-SimpleRemoteRetention $state}catch{$failed=$true}
  if(-not $failed -or $script:units.Count -ne 2){throw 'Edited remote schedule deleted'}
  $script:units[$service]=(Get-SimpleRemoteRetentionUnits $state|Where-Object{$_.name -ceq $service}).text
  Remove-SimpleRemoteRetention $state
  if($script:units.Count){throw 'Owned remote units not removed'}
  Write-Output 'SIMPLE_RETENTION_SCHEDULER_FIXTURES_PASS hourly user headless ownership edited-task timer local-worker uninstall'
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
