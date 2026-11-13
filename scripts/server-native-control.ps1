[CmdletBinding()]
param([string]$BindingFile='', [switch]$Startup, [switch]$StartServer, [switch]$FunctionsOnly)
$ErrorActionPreference='Stop'
$script:NativePanelSource=$PSCommandPath
$nativeRequestedStartup=[bool]$Startup
. (Join-Path $PSScriptRoot 'simple-easy-setup-control.ps1') -ControlFunctionsOnly

function Get-CastlinkNativePanelText([string]$Key,[string]$Language='ru') {
  $catalog=@{
    statistics=@('Статистика сервера','Server statistics','服务器统计'); export=@('Экспорт ZIP за 24 часа','Export 24-hour ZIP','导出24小时 ZIP');
    rooms=@('Комнаты: настроено / активно','Rooms: configured / active','房间：已配置 / 活跃'); participants=@('Подключения / кастеры','Connections / casters','连接 / 推流者');
    cpu=@('CPU','CPU','CPU'); memory=@('Память','Memory','内存'); disk=@('Диск данных','Data disk','数据磁盘'); network=@('Сеть: вход / выход, Мбит/с','Network: in / out, Mbps','网络：入站 / 出站，Mbps');
    uptime=@('Время работы web','Web process uptime','Web 进程运行时间'); rss=@('Память процесса web','Web process memory','Web 进程内存');
    loading=@('Проверяю службы…','Checking services…','正在检查服务…'); running=@('CastLink работает','CastLink is running','CastLink 正在运行');
    stopped=@('Службы остановлены','Services are stopped','服务已停止'); unavailable=@('Статистика недоступна','Statistics unavailable','统计不可用');
    stale=@('Данные устарели','Data is stale','数据已过期'); updated=@('Обновлено','Updated','已更新'); clock=@('Москва','Moscow','莫斯科');
    start=@('Запускаю CastLink…','Starting CastLink…','正在启动 CastLink…'); stop=@('Останавливаю CastLink…','Stopping CastLink…','正在停止 CastLink…');
    failure=@('Результат операции не подтверждён. Проверьте состояние служб. Данные сохранены.','The operation result could not be confirmed. Check service status. Data is preserved.','无法确认操作结果。请检查服务状态。数据已保留。');
    exportReady=@('Архив за 24 часа сохранён.','24-hour archive saved.','已保存24小时归档。'); exporting=@('Сохраняю архив за 24 часа…','Saving 24-hour archive…','正在保存24小时归档…');
    scope=@('Ресурсы WSL · история за 24 часа','WSL resources · 24-hour history','WSL 资源 · 24小时历史');
    ok=@('работает','healthy','正常'); unconfigured=@('не настроено','unconfigured','未配置');
    unavailableService=@('недоступно','unavailable','不可用'); services=@('Службы','Services','服务')
  }
  if(-not $catalog.ContainsKey($Key)){return $Key}
  $index=if($Language -ceq 'en'){1}elseif($Language -ceq 'zh-CN'){2}else{0}
  return $catalog[$Key][$index]
}

function Format-CastlinkNativeNumber($Value,[string]$Suffix='') {
  if($null -eq $Value -or $Value -is [bool]){return '—'}
  $number=0.0
  if(-not [double]::TryParse([string]$Value,[Globalization.NumberStyles]::Float,[Globalization.CultureInfo]::InvariantCulture,[ref]$number) -or [double]::IsNaN($number) -or [double]::IsInfinity($number) -or $number -lt 0){return '—'}
  return $number.ToString('0.#',[Globalization.CultureInfo]::InvariantCulture)+$Suffix
}
function Format-CastlinkNativeBytes($Value) {
  if($null -eq $Value){return '—'}
  $valueText=Format-CastlinkNativeNumber $Value
  if($valueText -ceq '—'){return $valueText}
  if([double]$Value -ge 1073741824){return (Format-CastlinkNativeNumber ([double]$Value/1073741824) ' GiB')}
  return (Format-CastlinkNativeNumber ([double]$Value/1048576) ' MiB')
}
function Get-CastlinkNativePanelFreshness($Snapshot,[datetime]$Now=[datetime]::UtcNow) {
  if(-not $Snapshot -or -not $Snapshot.latest -or $null -eq $Snapshot.latest.at){return 'unavailable'}
  if((Format-CastlinkNativeNumber $Snapshot.latest.at) -ceq '—'){return 'unavailable'}
  $age=([DateTimeOffset]$Now).ToUnixTimeMilliseconds()-[double]$Snapshot.latest.at
  if($age -gt 30000 -or $age -lt -30000 -or ($Snapshot.nativeStatus -and $Snapshot.nativeStatus.stale)){return 'stale'}
  return 'fresh'
}
function Format-CastlinkNativeUptime($Seconds) {
  if((Format-CastlinkNativeNumber $Seconds) -ceq '—' -or [double]$Seconds -ge [TimeSpan]::MaxValue.TotalSeconds){return '—'}
  return [TimeSpan]::FromSeconds([double]$Seconds).ToString('d\.hh\:mm\:ss')
}
function Get-CastlinkNativeSparkSegments([object[]]$History,[string]$Field,[double]$Width=156,[double]$Height=26) {
  # Unknown samples and reported gaps split the line; neither becomes an invented zero.
  $rows=@($History | Select-Object -Last 720)
  $max=0.0
  foreach($row in $rows){if($null -ne $row.$Field){$n=Format-CastlinkNativeNumber $row.$Field;if($n -cne '—'){$max=[Math]::Max($max,[double]$row.$Field)}}}
  if($max -le 0){$max=1}
  $segments=New-Object Collections.Generic.List[object];$points=New-Object Collections.Generic.List[object]
  for($i=0;$i -lt $rows.Count;$i++){
    $row=$rows[$i];$n=Format-CastlinkNativeNumber $row.$Field
    if($row.gapBefore -or $n -ceq '—'){if($points.Count){$segments.Add($points.ToArray());$points=New-Object Collections.Generic.List[object]}}
    if($n -ceq '—'){continue}
    $x=if($rows.Count -le 1){0}else{$Width*$i/($rows.Count-1)}
    $points.Add([pscustomobject]@{x=$x;y=($Height-2)-([double]$row.$Field/$max)*($Height-4)})
  }
  if($points.Count){$segments.Add($points.ToArray())}
  return ,$segments.ToArray()
}

function Get-CastlinkNativeControlTimeout([ValidateSet('Start','Stop','Status')][string]$Action) {
  if($Action -ceq 'Start'){return 540}
  if($Action -ceq 'Stop'){return 240}
  return 120
}
function Invoke-CastlinkNativeControlAction([string]$BindingFile,[ValidateSet('Start','Stop','Status')][string]$Action) {
  . (Join-Path $PSScriptRoot 'server-native-monitor.ps1')
  $binding=Read-CastlinkNativeMonitorBinding -BindingFile $BindingFile
  # Call the pinned, unmodified original. Its lease, identity and authorization checks remain authoritative.
  $quote={param([string]$Value) "'"+$Value.Replace("'","''")+"'"}
  $command='& '+(& $quote $binding.sourceScriptPath)+' -Action '+$Action+' -InstallRoot '+(& $quote $binding.installRoot)
  $encoded=[Convert]::ToBase64String([Text.Encoding]::Unicode.GetBytes($command))
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
  $info.Arguments='-NoLogo -NoProfile -NonInteractive -ExecutionPolicy Bypass -EncodedCommand '+$encoded
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true;$info.WindowStyle=[Diagnostics.ProcessWindowStyle]::Hidden
  $info.RedirectStandardOutput=$true;$info.RedirectStandardError=$true
  $process=New-Object Diagnostics.Process;$process.StartInfo=$info
  try{
    if(-not $process.Start()){throw 'Original installer did not start'}
    $stdout=$process.StandardOutput.ReadToEndAsync();$stderr=$process.StandardError.ReadToEndAsync()
    $timeoutSeconds=Get-CastlinkNativeControlTimeout $Action
    if(-not $process.WaitForExit($timeoutSeconds*1000)){
      # Kill only this controller child, never a service, WSL distribution or keepalive.
      $process.Kill();throw 'Original installer control timed out; the result is uncertain. Check service status before retrying'
    }
    $process.WaitForExit()
    if($process.ExitCode -ne 0){throw 'Original installer refused the operation; no other installation was used'}
    return [pscustomobject]@{action=$Action;completed=$true}
  }finally{$process.Dispose()}
}

function Start-CastlinkNativePanelWork([string]$Source,[string]$BindingFile,[string]$Mode,[string]$Destination='') {
  $pipeline=[PowerShell]::Create()
  $null=$pipeline.AddScript('param($source,$binding,$mode,$destination);$ErrorActionPreference="Stop";. $source -FunctionsOnly;if($mode -ceq "snapshot"){. (Join-Path (Split-Path $source -Parent) "server-native-monitor.ps1");Get-CastlinkNativeMonitorSnapshot -BindingFile $binding}elseif($mode -ceq "export"){. (Join-Path (Split-Path $source -Parent) "server-native-monitor.ps1");Export-CastlinkNativeMonitorBundle -BindingFile $binding -Destination $destination}else{Invoke-CastlinkNativeControlAction -BindingFile $binding -Action $mode}').AddArgument($Source).AddArgument($BindingFile).AddArgument($Mode).AddArgument($Destination)
  try{return [pscustomobject]@{pipeline=$pipeline;handle=$pipeline.BeginInvoke();mode=$Mode}}catch{$pipeline.Dispose();throw}
}
function Get-CastlinkNativePanelScheduledWork($State,[datetime]$Now=[datetime]::UtcNow) {
  if($State.control -or $State.monitor -or $State.export){return ''}
  if($State.pendingControl -and (-not $State.closing -or $State.pendingControl -ceq 'Stop')){return $State.pendingControl}
  if($State.closing){return ''}
  if($State.pendingExport){return 'export'}
  if($Now -ge $State.next){return 'snapshot'}
  return ''
}
function Request-CastlinkNativePanelControl($State,[ValidateSet('Start','Stop')][string]$Mode) {
  if($Mode -ceq 'Stop'){
    $State.pendingExport=''
    $State.pendingControl=if($State.control -and $State.control.mode -ceq 'Stop'){''}else{'Stop'}
  }elseif(-not $State.control -and -not $State.pendingControl){$State.pendingControl='Start'}
  $State.notice=''
}

function Add-CastlinkNativeStatisticsView($Window) {
  $parent=$Window.FindName('ServicesDetails').Parent
  [xml]$xaml=@'
<StackPanel xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Margin="0,16,0,0">
  <Grid><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="Auto"/></Grid.ColumnDefinitions><TextBlock x:Name="StatisticsTitle" FontSize="16" FontWeight="SemiBold" VerticalAlignment="Center"/><Button x:Name="Export24h" Grid.Column="1" MinHeight="36" Padding="12,7"/></Grid>
  <TextBlock x:Name="StatisticsFreshness" Foreground="{DynamicResource MutedBrush}" Margin="0,7,0,10" TextWrapping="Wrap" AutomationProperties.LiveSetting="Polite"/>
  <Grid x:Name="MetricGrid"><Grid.ColumnDefinitions><ColumnDefinition Width="*"/><ColumnDefinition Width="*"/></Grid.ColumnDefinitions></Grid>
  <TextBlock x:Name="StatisticsScope" Foreground="{DynamicResource MutedBrush}" FontSize="11" Margin="0,8,0,0"/>
  <TextBlock x:Name="MoscowClock" Foreground="{DynamicResource MutedBrush}" FontSize="11" Margin="0,5,0,0"/>
</StackPanel>
'@
  $view=[Windows.Markup.XamlReader]::Load((New-Object Xml.XmlNodeReader $xaml))
  $controls=@{root=$view;title=$view.FindName('StatisticsTitle');freshness=$view.FindName('StatisticsFreshness');export=$view.FindName('Export24h');scope=$view.FindName('StatisticsScope');clock=$view.FindName('MoscowClock');metrics=@{}}
  $grid=$view.FindName('MetricGrid');$index=0
  foreach($key in @('rooms','participants','cpu','memory','disk','network','uptime','rss')){
    if($index%2 -eq 0){$null=$grid.RowDefinitions.Add((New-Object Windows.Controls.RowDefinition))}
    $cell=New-Object Windows.Controls.StackPanel;$cell.Margin='0,0,14,10'
    $label=New-Object Windows.Controls.TextBlock;$label.FontSize=11;$label.SetResourceReference([Windows.Controls.TextBlock]::ForegroundProperty,'MutedBrush')
    $value=New-Object Windows.Controls.TextBlock;$value.FontSize=18;$value.FontWeight='SemiBold';$value.Text='—';$value.TextWrapping='Wrap'
    $chart=New-Object Windows.Controls.Canvas;$chart.Width=156;$chart.Height=26;$chart.HorizontalAlignment='Left';$chart.ClipToBounds=$true
    $null=$cell.Children.Add($label);$null=$cell.Children.Add($value);$null=$cell.Children.Add($chart)
    [Windows.Controls.Grid]::SetRow($cell,[int][Math]::Floor($index/2));[Windows.Controls.Grid]::SetColumn($cell,$index%2)
    $null=$grid.Children.Add($cell);$controls.metrics[$key]=@{label=$label;value=$value;chart=$chart};$index++
  }
  $parent.Children.Insert($parent.Children.IndexOf($Window.FindName('ServicesDetails')),$view)
  $Window.FindName('RecoveryDetails').Visibility='Collapsed';$Window.FindName('ServicesDetails').IsExpanded=$true
  $Window.FindName('Summary').FontSize=24;$Window.FindName('ContentScroll').Padding='32,12'
  return $controls
}

function Update-CastlinkNativePanelView($Window,$State) {
  $language=$State.language;$view=$State.view;$snapshot=$State.snapshot
  $Window.FindName('Start').IsEnabled=-not ($State.closing -or $State.control -or $State.pendingControl)
  $Window.FindName('Stop').IsEnabled=-not ($State.closing -or $State.pendingControl -ceq 'Stop' -or $State.control.mode -ceq 'Stop')
  $view.export.IsEnabled=-not ($State.closing -or $State.control -or $State.pendingControl -or $State.export -or $State.pendingExport)
  $view.clock.Text=(Get-CastlinkNativePanelText clock $language)+': '+[datetime]::UtcNow.AddHours(3).ToString('dd.MM.yyyy HH:mm:ss')+' UTC+3'
  $freshness=Get-CastlinkNativePanelFreshness $snapshot
  if($State.monitorFailed){$freshness=if($snapshot -and $snapshot.latest){'stale'}else{'unavailable'}}
  $confirmedStopped=($State.lastStoppedAt -and (-not $snapshot.latest -or $snapshot.latest.at -le $State.lastStoppedAt))
  if($confirmedStopped -and $snapshot.latest){$freshness='stale'}
  $mode=if($State.pendingControl){$State.pendingControl}elseif($State.control){$State.control.mode}else{''}
  # The clock ticks locally. Rebuild measured chart geometry only when its data or labels change.
  if([object]::ReferenceEquals($view.lastSnapshot,$snapshot) -and $view.lastLanguage -ceq $language -and $view.lastFreshness -ceq $freshness -and $view.lastMode -ceq $mode -and $view.lastNotice -ceq $State.notice){return}
  $view.lastSnapshot=$snapshot;$view.lastLanguage=$language;$view.lastFreshness=$freshness;$view.lastMode=$mode;$view.lastNotice=$State.notice
  $view.title.Text=Get-CastlinkNativePanelText statistics $language
  $view.export.Content=Get-CastlinkNativePanelText export $language
  $view.scope.Text=Get-CastlinkNativePanelText scope $language
  foreach($key in $view.metrics.Keys){$view.metrics[$key].label.Text=Get-CastlinkNativePanelText $key $language}
  $view.freshness.Text=if($freshness -ceq 'fresh'){
    (Get-CastlinkNativePanelText updated $language)+' '+[DateTimeOffset]::FromUnixTimeMilliseconds([long]$snapshot.latest.at).ToOffset([TimeSpan]::FromHours(3)).ToString('HH:mm:ss')+' UTC+3'
  }else{Get-CastlinkNativePanelText $freshness $language}
  $sample=if($snapshot){$snapshot.latest}else{$null}
  $view.metrics.rooms.value.Text=(Format-CastlinkNativeNumber $sample.configuredRooms)+' / '+(Format-CastlinkNativeNumber $sample.activeRooms)
  $view.metrics.participants.value.Text=(Format-CastlinkNativeNumber $sample.connections)+' / '+(Format-CastlinkNativeNumber $sample.casters)
  $view.metrics.cpu.value.Text=Format-CastlinkNativeNumber $sample.cpuPercent ' %'
  $view.metrics.memory.value.Text=(Format-CastlinkNativeBytes $sample.memoryUsedBytes)+' / '+(Format-CastlinkNativeBytes $sample.memoryTotalBytes)
  $view.metrics.disk.value.Text=(Format-CastlinkNativeBytes $sample.diskUsedBytes)+' / '+(Format-CastlinkNativeBytes $sample.diskTotalBytes)
  $view.metrics.network.value.Text=(Format-CastlinkNativeNumber $sample.networkInMbps)+' / '+(Format-CastlinkNativeNumber $sample.networkOutMbps)
  $view.metrics.rss.value.Text=Format-CastlinkNativeBytes $sample.processRssBytes
  $view.metrics.uptime.value.Text=Format-CastlinkNativeUptime $sample.processUptimeSec
  $fields=@{rooms='activeRooms';participants='connections';cpu='cpuPercent';memory='memoryUsedBytes';disk='diskUsedBytes';network='networkInMbps';uptime='processUptimeSec';rss='processRssBytes'}
  foreach($key in $fields.Keys){
    $canvas=$view.metrics[$key].chart;$canvas.Children.Clear()
    foreach($segment in (Get-CastlinkNativeSparkSegments @($snapshot.history) $fields[$key])){
      $line=New-Object Windows.Shapes.Polyline;$line.StrokeThickness=1.5;$line.SetResourceReference([Windows.Shapes.Shape]::StrokeProperty,'AccentBrush')
      foreach($point in $segment){$line.Points.Add((New-Object Windows.Point($point.x,$point.y)))}
      $null=$canvas.Children.Add($line)
    }
  }
  $Window.FindName('ServicesTitle').Text=Get-CastlinkNativePanelText services $language
  $lines=@()
  foreach($service in @('web','livekit','roomStore')){
    $stateText=if($sample -and $sample.services){[string]$sample.services.$service}else{'unavailable'}
    if($stateText -cnotin @('ok','unconfigured')){$stateText='unavailableService'}
    $lines+=($service+': '+(Get-CastlinkNativePanelText $stateText $language))
  }
  $Window.FindName('Services').Text=$lines -join '   ·   '
  $summary=if($mode){$mode.ToLowerInvariant()}elseif($confirmedStopped -or $snapshot.nativeStatus.state -ceq 'stopped'){'stopped'}elseif($freshness -ceq 'fresh' -and $sample.services.web -ceq 'ok'){'running'}else{'unavailable'}
  $Window.FindName('Summary').Text=Get-CastlinkNativePanelText $summary $language
  $Window.FindName('Notice').Text=if($State.notice){Get-CastlinkNativePanelText $State.notice $language}else{''}
}

function Show-CastlinkNativePanel([string]$BindingFile,[bool]$StartServer=$false,[bool]$Startup=$false) {
  . (Join-Path $PSScriptRoot 'server-native-monitor.ps1')
  $binding=Read-CastlinkNativeMonitorBinding -BindingFile $BindingFile
  $BindingFile=[IO.Path]::GetFullPath($BindingFile)
  Initialize-SimpleControlNative
  $message=[CastLinkControl.Native]::RegisterWindowMessage('CastLinkNativePanel-'+$binding.installationId)
  $mutex=New-Object Threading.Mutex($false,('Local\CastLink-native-panel-'+$binding.installationId))
  $entered=$false
  try{$entered=$mutex.WaitOne(0)}catch [Threading.AbandonedMutexException]{$entered=$true}
  if(-not $entered){$null=[CastLinkControl.Native]::PostMessage([IntPtr]0xffff,$message,[IntPtr]::Zero,[IntPtr]::Zero);$mutex.Dispose();return}
  $window=$null;$tray=$null;$icon=$null;$menu=$null;$timer=$null;$state=$null
  try{
    Add-Type -AssemblyName PresentationFramework,System.Windows.Forms,System.Drawing
    $language=Get-SimpleGuiLanguage
    $window=New-SimpleControlWindow $language
    $view=Add-CastlinkNativeStatisticsView $window
    $window.FindName('Address').Text=$binding.origin
    $window.FindName('BuildText').Text='WSL2 · '+$binding.expectedBuildId
    $source=$script:NativePanelSource
    $helpers=New-Module -AsCustomObject -ArgumentList $source -ScriptBlock {
      param($Source);. $Source -FunctionsOnly
      Export-ModuleMember -Function Start-CastlinkNativePanelWork,Get-CastlinkNativePanelScheduledWork,Request-CastlinkNativePanelControl,Update-CastlinkNativePanelView,Update-SimpleControlLanguage,ConvertTo-SimpleControlText,Set-SimpleGuiLanguage
    }
    $tray=New-Object Windows.Forms.NotifyIcon;$icon=New-Object Drawing.Icon((Join-Path $PSScriptRoot 'simple-easy-setup-control.ico'));$tray.Icon=$icon;$tray.Text='CastLink Server'
    $menu=New-Object Windows.Forms.ContextMenuStrip;$trayOpen=$menu.Items.Add('Открыть панель');$trayExit=$menu.Items.Add('Остановить и выйти');$tray.ContextMenuStrip=$menu;$tray.Visible=$true
    $state=[pscustomobject]@{language=$language;view=$view;snapshot=$null;control=$null;pendingControl='';monitor=$null;export=$null;pendingExport='';monitorFailed=$false;notice='';next=[datetime]::UtcNow;closing=$false;canClose=$false;lastStoppedAt=$null}
    $window.Tag=$state
    $restore={$window.Show();$window.WindowState='Normal';$null=$window.Activate();$handle=(New-Object Windows.Interop.WindowInteropHelper($window)).Handle;$null=[CastLinkControl.Native]::SetForegroundWindow($handle)}.GetNewClosure()
    $window.Add_SourceInitialized({
      $hwnd=(New-Object Windows.Interop.WindowInteropHelper($window)).Handle
      $restoreHandler=$restore;$restoreMessage=$message
      $hookScript={param($hwnd,$msg,$wparam,$lparam,[ref]$handled);if($msg -eq $restoreMessage){& $restoreHandler;$handled.Value=$true};return [IntPtr]::Zero}.GetNewClosure()
      $hook=[Windows.Interop.HwndSourceHook]$hookScript
      [Windows.Interop.HwndSource]::FromHwnd($hwnd).AddHook($hook)
    }.GetNewClosure())
    $beginControl={param($Mode)
      $helpers.'Request-CastlinkNativePanelControl'($state,$Mode)
      $helpers.'Update-CastlinkNativePanelView'($window,$state)
    }.GetNewClosure()
    $window.FindName('Start').Add_Click({if(-not $state.closing){& $beginControl 'Start'}}.GetNewClosure())
    $window.FindName('Stop').Add_Click({if(-not $state.closing){& $beginControl 'Stop'}}.GetNewClosure())
    $window.FindName('Refresh').Add_Click({$state.next=[datetime]::UtcNow}.GetNewClosure())
    $window.FindName('Open').Add_Click({$null=[Diagnostics.Process]::Start($binding.origin)}.GetNewClosure())
    $window.FindName('Hide').Add_Click({$window.Hide()}.GetNewClosure())
    $trayOpen.Add_Click($restore);$tray.Add_DoubleClick($restore)
    $trayExit.Add_Click({$state.closing=$true;& $restore;& $beginControl 'Stop'}.GetNewClosure())
    $window.Add_Closing({param($sender,$event);if(-not $state.canClose){$event.Cancel=$true;$window.Hide()}}.GetNewClosure())
    $view.export.Add_Click({
      if($state.export -or $state.pendingExport -or $state.control -or $state.pendingControl -or $state.closing){return}
      $dialog=New-Object Microsoft.Win32.SaveFileDialog;$dialog.Filter='ZIP (*.zip)|*.zip';$dialog.DefaultExt='.zip';$dialog.AddExtension=$true
      $dialog.FileName='CastLink-24h-'+[datetime]::UtcNow.AddHours(3).ToString('yyyyMMdd-HHmmss')+'.zip'
      if($dialog.ShowDialog($window)){$state.pendingExport=$dialog.FileName;$state.notice='exporting';$view.export.IsEnabled=$false}
    }.GetNewClosure())
    foreach($item in @(@('LanguageRu','ru'),@('LanguageEn','en'),@('LanguageZh','zh-CN'))){
      $locale=$item[1]
      $window.FindName($item[0]).Add_Click({
        $state.language=$locale;$null=$helpers.'Set-SimpleGuiLanguage'($locale)
        $helpers.'Update-SimpleControlLanguage'($window,$locale)
        $window.FindName('BuildText').Text='WSL2 · '+$binding.expectedBuildId
        $trayOpen.Text=$helpers.'ConvertTo-SimpleControlText'('Открыть панель',$locale);$trayExit.Text=$helpers.'ConvertTo-SimpleControlText'('Остановить и выйти',$locale)
        $helpers.'Update-CastlinkNativePanelView'($window,$state)
      }.GetNewClosure())
    }
    $trayOpen.Text=ConvertTo-SimpleControlText 'Открыть панель' $language;$trayExit.Text=ConvertTo-SimpleControlText 'Остановить и выйти' $language
    $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(250)
    $timer.Add_Tick({
      foreach($slot in @('monitor','control','export')){
        $job=$state.$slot
        if(-not $job -or -not $job.handle.IsCompleted){continue}
        $failed=$false
        try{
          $output=@($job.pipeline.EndInvoke($job.handle))
          if($job.pipeline.HadErrors -or $output.Count -eq 0){throw 'Operation did not return a result'}
          if($slot -ceq 'monitor'){$state.snapshot=$output[-1];$state.monitorFailed=$false}
          elseif($slot -ceq 'export'){$state.notice='exportReady'}
          elseif($job.mode -ceq 'Stop'){$state.lastStoppedAt=[DateTimeOffset]::UtcNow.ToUnixTimeMilliseconds();if($state.closing){$state.canClose=$true;$window.Close()}}
          elseif($job.mode -ceq 'Start'){$state.lastStoppedAt=$null}
        }catch{
          $failed=$true
          if($slot -ceq 'monitor'){$state.monitorFailed=$true}else{
            $state.notice='failure'
            if($slot -ceq 'control' -and $job.mode -ceq 'Stop'){$state.closing=$false;$state.pendingControl=''}
            & $restore
          }
        }finally{$job.pipeline.Dispose();$state.$slot=$null}
        if($slot -ceq 'control'){
          $state.next=[datetime]::UtcNow
        }
        if($slot -ceq 'export'){$view.export.IsEnabled=-not $state.closing}
      }
      $scheduled=$helpers.'Get-CastlinkNativePanelScheduledWork'($state)
      if($scheduled -cin @('Start','Stop')){
        $state.control=$helpers.'Start-CastlinkNativePanelWork'($source,$BindingFile,$scheduled);$state.pendingControl='';$state.notice=''
      }elseif($scheduled -ceq 'export'){
        $state.export=$helpers.'Start-CastlinkNativePanelWork'($source,$BindingFile,'export',$state.pendingExport);$state.pendingExport=''
      }elseif($scheduled -ceq 'snapshot'){
        $state.monitor=$helpers.'Start-CastlinkNativePanelWork'($source,$BindingFile,'snapshot');$state.next=[datetime]::UtcNow.AddSeconds(10)
      }
      $helpers.'Update-CastlinkNativePanelView'($window,$state)
    }.GetNewClosure())
    $frame=New-Object Windows.Threading.DispatcherFrame
    $window.Add_Closed({$timer.Stop();$tray.Visible=$false;$frame.Continue=$false}.GetNewClosure())
    Update-CastlinkNativePanelView $window $state
    $window.Show();if($Startup){$window.Hide()}
    if($StartServer){& $beginControl 'Start'}
    $timer.Start();[Windows.Threading.Dispatcher]::PushFrame($frame)
  }finally{
    if($timer){$timer.Stop()};if($tray){$tray.Visible=$false;$tray.Dispose()};if($menu){$menu.Dispose()};if($icon){$icon.Dispose()}
    # UI teardown does not issue Stop. Only the explicit Stop / tray Stop and exit paths do.
    if($state){foreach($slot in @('monitor','control','export')){if($state.$slot){$state.$slot.pipeline.Dispose()}}}
    if($entered){$mutex.ReleaseMutex()};$mutex.Dispose()
  }
}

if(-not $FunctionsOnly){
  try{Show-CastlinkNativePanel -BindingFile $BindingFile -StartServer ([bool]$StartServer) -Startup $nativeRequestedStartup}
  catch{Add-Type -AssemblyName PresentationFramework;$null=[Windows.MessageBox]::Show('Не удалось открыть панель CastLink. Проверьте привязку установленного сервера. Данные не изменены.','CastLink Server');exit 1}
}
