param([string]$ControlPath=(Join-Path $PSScriptRoot '../server-native-control.ps1'),[switch]$Visual)
$ErrorActionPreference='Stop'
$ControlPath=[IO.Path]::GetFullPath($ControlPath)
$source=Split-Path $ControlPath -Parent
foreach($name in @('server-native-control.ps1','build-server-native-panel-host.ps1')){
  $tokens=$null;$errors=$null
  $null=[Management.Automation.Language.Parser]::ParseFile((Join-Path $source $name),[ref]$tokens,[ref]$errors)
  if($errors.Count){throw (($errors|ForEach-Object{$_.Message}) -join '; ')}
}
. $ControlPath -FunctionsOnly -Startup
if(-not $nativeRequestedStartup){throw 'Shared controller parameter clobbered native Startup request'}
. $ControlPath -FunctionsOnly
if($nativeRequestedStartup){throw 'Startup request leaked into a normal launch'}
if((Get-CastlinkNativeControlTimeout Start) -ne 540 -or (Get-CastlinkNativeControlTimeout Stop) -ne 240 -or (Get-CastlinkNativeControlTimeout Status) -ne 120){throw 'Action timeout does not cover the original installer runtime'}
$actionValidation=(Get-Command Invoke-CastlinkNativeControlAction).Parameters['Action'].Attributes|Where-Object{$_ -is [Management.Automation.ValidateSetAttribute]}
if($actionValidation.ValidValues -contains 'OwnerAccess'){throw 'Panel control action exposed separate owner access path'}
$schedule=[pscustomobject]@{closing=$false;control=$null;pendingControl='';monitor=$null;export=$null;pendingExport='';notice='';next=[datetime]::UtcNow.AddSeconds(-1)}
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne 'snapshot'){throw 'Due idle snapshot not scheduled'}
$schedule.pendingExport='C:\selected destination.zip';$schedule.monitor=[pscustomobject]@{running=$true}
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne ''){throw 'Export overlapped an active snapshot lock'}
$schedule.monitor=$null
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne 'export'){throw 'Selected export did not take priority over polling'}
$schedule.export=[pscustomobject]@{running=$true};$schedule.pendingExport=''
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne ''){throw 'Polling overlapped export lock'}
$schedule.export=$null
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne 'snapshot'){throw 'Polling did not resume after export'}
$schedule.pendingExport='C:\selected destination.zip';$schedule.control=[pscustomobject]@{running=$true}
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne ''){throw 'Queued export ignored active service control'}
$schedule.control=$null;$schedule.closing=$true
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne ''){throw 'Pending export started during explicit exit'}
$schedule.closing=$false;$schedule.monitor=[pscustomobject]@{phase='Status/OwnerAccess'}
Request-CastlinkNativePanelControl $schedule Stop
if($schedule.pendingExport -or $schedule.pendingControl -cne 'Stop' -or (Get-CastlinkNativePanelScheduledWork $schedule) -cne ''){throw 'Stop overlapped first-session installer lease or retained export priority'}
$schedule.monitor=$null
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne 'Stop'){throw 'Stop did not run after monitor released its lease'}
$schedule.control=[pscustomobject]@{mode='Stop'};$schedule.pendingControl=''
Request-CastlinkNativePanelControl $schedule Stop
if($schedule.pendingControl -or (Get-CastlinkNativePanelScheduledWork $schedule) -cne ''){throw 'Active Stop was duplicated'}
$schedule.control=$null;$schedule.export=[pscustomobject]@{running=$true};$schedule.pendingExport='C:\queued.zip';$schedule.closing=$true
Request-CastlinkNativePanelControl $schedule Stop
if($schedule.pendingExport -or (Get-CastlinkNativePanelScheduledWork $schedule) -cne ''){throw 'Tray exit interrupted export or failed to discard queued export'}
$schedule.export=$null
if((Get-CastlinkNativePanelScheduledWork $schedule) -cne 'Stop'){throw 'Tray exit did not run Stop after export'}
if((Format-CastlinkNativeNumber $null) -cne '—'){throw 'Unknown metric became zero'}
if((Format-CastlinkNativeNumber 0) -cne '0'){throw 'Measured zero disappeared'}
if((Format-CastlinkNativeNumber ([double]::NaN)) -cne '—'){throw 'Invalid number leaked to view'}
if((Format-CastlinkNativeBytes 1073741824) -cne '1 GiB'){throw 'Byte scale incorrect'}
if((Format-CastlinkNativeUptime $null) -cne '—' -or (Format-CastlinkNativeUptime -1) -cne '—'){throw 'Unknown uptime appeared measured'}
if((Format-CastlinkNativeUptime 60) -cne '0.00:01:00'){throw 'Uptime formatting incorrect'}
$now=[datetime]::UtcNow;$at=([DateTimeOffset]$now).ToUnixTimeMilliseconds()
$snapshot=[pscustomobject]@{latest=[pscustomobject]@{at=$at;cpuPercent=$null};nativeStatus=$null}
if((Get-CastlinkNativePanelFreshness $snapshot $now) -cne 'fresh'){throw 'Current sample marked stale'}
if((Get-CastlinkNativePanelFreshness $snapshot $now.AddSeconds(31)) -cne 'stale'){throw 'Old sample appeared current'}
if((Get-CastlinkNativePanelFreshness $null $now) -cne 'unavailable'){throw 'Missing snapshot appeared current'}
$segments=Get-CastlinkNativeSparkSegments @(
  [pscustomobject]@{cpuPercent=0},[pscustomobject]@{cpuPercent=20},
  [pscustomobject]@{cpuPercent=$null},[pscustomobject]@{cpuPercent=40},
  [pscustomobject]@{cpuPercent=30;gapBefore=$true},[pscustomobject]@{cpuPercent=10}
) cpuPercent
if($segments.Count -ne 3 -or $segments[0].Count -ne 2 -or $segments[1].Count -ne 1 -or $segments[2].Count -ne 2){throw 'Sparkline bridged missing measurements'}
if($segments[0][0].y -ne 24){throw 'Measured zero graph incorrect'}
foreach($locale in @('ru','en','zh-CN')){if((Get-CastlinkNativePanelText export $locale) -ceq 'export'){throw 'Missing translation'}}
$temporary=Join-Path ([IO.Path]::GetTempPath()) ('castlink-native-fixture-'+[guid]::NewGuid().ToString('N'))
$null=[IO.Directory]::CreateDirectory($temporary)
try{
  $fake=Join-Path $temporary 'fake-worker.ps1'
  [IO.File]::WriteAllText($fake,@'
param([switch]$FunctionsOnly)
function Invoke-CastlinkNativeControlAction {
  param($BindingFile,$Action)
  if($BindingFile -ceq 'unused'){Start-Sleep -Milliseconds 600}else{
    $lease=[IO.FileStream]::new($BindingFile,[IO.FileMode]::OpenOrCreate,[IO.FileAccess]::ReadWrite,[IO.FileShare]::None)
    try{if($Action -ceq 'Status'){[IO.File]::WriteAllText($BindingFile+'.held','held');Start-Sleep -Milliseconds 1500}}finally{$lease.Dispose()}
  }
  [pscustomobject]@{action=$Action;completed=$true}
}
'@)
  $watch=[Diagnostics.Stopwatch]::StartNew()
  $job=Start-CastlinkNativePanelWork $fake 'unused' 'Start'
  if($watch.ElapsedMilliseconds -gt 500){throw 'Worker blocked UI during begin'}
  try{
    if(-not $job.handle.AsyncWaitHandle.WaitOne(5000)){throw 'Worker did not complete'}
    $result=@($job.pipeline.EndInvoke($job.handle))
    if($job.pipeline.HadErrors -or $result[-1].action -cne 'Start' -or -not $result[-1].completed){throw 'Async action result lost'}
  }finally{$job.pipeline.Dispose()}
  # First-session monitor holds the original-style operation lease. Stop must wait and run once.
  $leasePath=Join-Path $temporary 'operation.lock'
  $overlap=[pscustomobject]@{closing=$false;control=$null;pendingControl='';monitor=$null;export=$null;pendingExport='';notice='';next=[datetime]::UtcNow}
  $overlap.monitor=Start-CastlinkNativePanelWork $fake $leasePath Status
  try{
    $watch.Restart()
    while(-not(Test-Path -LiteralPath ($leasePath+'.held')) -and $watch.ElapsedMilliseconds -lt 5000){Start-Sleep -Milliseconds 10}
    if(-not(Test-Path -LiteralPath ($leasePath+'.held')) -or $overlap.monitor.handle.IsCompleted){throw 'Fixture did not observe active monitor operation lease'}
    Request-CastlinkNativePanelControl $overlap Stop
    if((Get-CastlinkNativePanelScheduledWork $overlap) -cne ''){throw 'Stop entered an active first-session operation lease'}
    if(-not $overlap.monitor.handle.AsyncWaitHandle.WaitOne(5000)){throw 'Monitor lease did not finish'}
    $null=$overlap.monitor.pipeline.EndInvoke($overlap.monitor.handle)
    if($overlap.monitor.pipeline.HadErrors){throw 'Fixture monitor lease failed'}
  }finally{$overlap.monitor.pipeline.Dispose();$overlap.monitor=$null}
  if((Get-CastlinkNativePanelScheduledWork $overlap) -cne 'Stop'){throw 'Stop was lost after first-session lease release'}
  $overlap.control=Start-CastlinkNativePanelWork $fake $leasePath Stop;$overlap.pendingControl=''
  try{
    if((Get-CastlinkNativePanelScheduledWork $overlap) -cne ''){throw 'Scheduled Stop was duplicated'}
    if(-not $overlap.control.handle.AsyncWaitHandle.WaitOne(5000)){throw 'Queued Stop did not complete'}
    $stopped=@($overlap.control.pipeline.EndInvoke($overlap.control.handle))
    if($overlap.control.pipeline.HadErrors -or $stopped.Count -ne 1 -or $stopped[0].action -cne 'Stop' -or -not $stopped[0].completed){throw 'Queued Stop collided with monitor lease or ran more than once'}
  }finally{$overlap.control.pipeline.Dispose();$overlap.control=$null}
  $exe=Join-Path $temporary 'CastLinkServer.exe'
  & (Join-Path $source 'build-server-native-panel-host.ps1') -Output $exe
  $bytes=[IO.File]::ReadAllBytes($exe);$pe=[BitConverter]::ToInt32($bytes,0x3c)
  if([BitConverter]::ToUInt16($bytes,$pe+0x5c) -ne 2){throw 'Host is a console application'}
  # A harmless child verifies that the GUI host stays alive and propagates its exit code.
  [IO.File]::WriteAllText((Join-Path $temporary 'server-native-control.ps1'),'param($BindingFile,[switch]$Startup,[switch]$StartServer);Start-Sleep -Milliseconds 750;exit 23')
  [IO.File]::WriteAllText((Join-Path $temporary 'server-native-binding.json'),'{}')
  $hostInfo=New-Object Diagnostics.ProcessStartInfo;$hostInfo.FileName=$exe;$hostInfo.UseShellExecute=$false;$hostInfo.CreateNoWindow=$true
  $hostProcess=[Diagnostics.Process]::Start($hostInfo)
  try{
    if($hostProcess.WaitForExit(150)){throw 'GUI host returned before its child ended'}
    if(-not $hostProcess.WaitForExit(10000)){throw 'GUI host did not follow child exit'}
    if($hostProcess.ExitCode -ne 23){throw 'GUI host lost child failure exit code'}
  }finally{if(-not $hostProcess.HasExited){$hostProcess.Kill()};$hostProcess.Dispose()}
  if($Visual){
    $window=New-SimpleControlWindow 'ru';$view=Add-CastlinkNativeStatisticsView $window
    $state=[pscustomobject]@{language='ru';view=$view;snapshot=$null;control=$null;pendingControl='';export=$null;pendingExport='';closing=$false;monitorFailed=$false;notice='';lastStoppedAt=$null}
    Update-CastlinkNativePanelView $window $state
    if($view.metrics.cpu.value.Text -cne '—' -or $view.metrics.rooms.value.Text -cne '— / —'){throw 'Empty view invented data'}
    if($window.FindName('Services').Text -match 'Docker' -or $window.FindName('RecoveryDetails').Visibility -ne 'Collapsed'){throw 'WSL view retained unrelated Docker controls'}
    $sample=[pscustomobject]@{at=$at;configuredRooms=2;activeRooms=1;connections=3;casters=2;cpuPercent=0;memoryUsedBytes=1073741824;memoryTotalBytes=2147483648;diskUsedBytes=0;diskTotalBytes=2147483648;networkInMbps=0;networkOutMbps=$null;processRssBytes=1048576;processUptimeSec=60;services=[pscustomobject]@{web='ok';livekit='ok';roomStore='ok'}}
    $state.snapshot=[pscustomobject]@{latest=$sample;history=@($sample);nativeStatus=$null}
    Update-CastlinkNativePanelView $window $state
    if($view.metrics.cpu.value.Text -cne '0 %' -or $view.metrics.network.value.Text -cne '0 / —'){throw 'View lost unknown versus measured zero'}
    $state.language='en';Update-CastlinkNativePanelView $window $state
    if($view.title.Text -cne 'Server statistics' -or $view.export.Content -cne 'Export 24-hour ZIP'){throw 'Native statistics translation failed'}
    $state.pendingControl='Stop';Update-CastlinkNativePanelView $window $state
    if($window.FindName('Start').IsEnabled -or $window.FindName('Stop').IsEnabled -or $view.export.IsEnabled){throw 'Queued Stop did not gate competing controls'}
    $state.pendingControl='';$state.notice='failure';Update-CastlinkNativePanelView $window $state
    if(-not $window.FindName('Start').IsEnabled -or -not $window.FindName('Stop').IsEnabled -or -not $view.export.IsEnabled){throw 'Failed Stop did not restore actionable controls'}
    $window.Close()
  }
  Write-Output 'PASS native control: parser, startup binding, action timeouts, control/export/snapshot scheduling and operation lease, null/zero/stale, graph gaps, translations, asynchronous work, GUI subsystem and child lifetime/exit'
}finally{Remove-Item -LiteralPath $temporary -Recurse -Force}
