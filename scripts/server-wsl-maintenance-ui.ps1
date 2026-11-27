[CmdletBinding()]
param([string]$InstallRoot,[ValidateSet('ru','en','zh-CN')][string]$Lang='ru',[string]$TargetDirectory,[string]$ExpectedManifestSha256,[switch]$FunctionsOnly)
$maintenanceUiRequest=[pscustomobject]@{functionsOnly=[bool]$FunctionsOnly;root=$InstallRoot;lang=$Lang;target=$TargetDirectory;pin=$ExpectedManifestSha256}
. (Join-Path $PSScriptRoot 'server-wsl-maintenance.ps1') -FunctionsOnly
function Get-CLMText([string]$Key,[string]$Language='ru'){
 $c=@{
 title=@('Обслуживание CastLink','CastLink maintenance','CastLink 维护');select=@('Выберите сервер','Select server','选择服务器');
 check=@('Проверить','Check','检查');update=@('Обновить','Update','更新');remove=@('Удалить','Remove','删除');restore=@('Восстановить','Restore','恢复');recover=@('Завершить / восстановить операцию','Recover transaction','恢复事务');
 keep=@('Сохранить архив перед удалением','Keep a restorable archive before removing','删除前保留可恢复归档');erase=@('Безвозвратно удалить сервер и данные','Permanently erase server and data','永久删除服务器和数据');browse=@('Выбрать…','Choose…','选择…');open=@('Открыть панель сервера','Open server panel','打开服务器面板');chooseRelease=@('Выберите опубликованную версию; RC выбирается явно','Choose a published release; prereleases require explicit selection','选择已发布版本；预发布版本须明确选择');committed=@('Новая версия выбрана. Не запускайте старый сервер. Завершите восстановление операции.','The new generation is selected. Keep the old server stopped and recover this transaction.','已选择新版本。请保持旧服务器停止并恢复此事务。');
 current=@('Установлено','Current','当前');target=@('Целевая версия','Target version','目标版本');
 pin=@('SHA256 manifest.json (проверенный источник)','Manifest SHA256 (trusted source)','清单 SHA256（可信来源）');
 confirm=@('Подтверждение: введите точное имя WSL сервера','Confirmation: type exact WSL server name','确认：输入确切的 WSL 服务器名称');
 bundle=@('Архив сервера (папка)','Server archive (folder)','服务器归档（文件夹）');
 destination=@('Папка восстановления (новая, под LocalAppData\CastLinkServer)','Restore destination (new, under LocalAppData\CastLinkServer)','恢复目标（LocalAppData\CastLinkServer 下的新目录）');
 interruption=@('Обновление прерывает работу. Выберите пакет и проверьте место до обновления. Автообновления нет.','Updates interrupt service. Select a package and check space before updating. Updates are explicit.','更新会中断服务。请先选择安装包并检查空间。更新须手动确认。');
 busy=@('Операция выполняется. Не закрывайте окно.','Operation in progress. Keep this window open.','操作正在进行。请保持窗口打开。');done=@('Операция завершена','Operation completed','操作已完成');failed=@('Ошибка. Данные и журнал сохранены; используйте восстановление операции.','Failure. Data and journal preserved; use Recover transaction.','失败。数据和日志已保留；请使用恢复事务。');space=@('Требуется / свободно, байт','Required / free bytes','所需 / 可用字节')}
 if(-not $c.ContainsKey($Key)){return $Key};$i=if($Language -ceq 'en'){1}elseif($Language -ceq 'zh-CN'){2}else{0};return $c[$Key][$i]
}
function Get-CLMPhaseText([string]$Phase,[string]$Language){
 $kind=if($Phase -match 'verify|prepared'){'verify'}elseif($Phase -match 'export'){'export'}elseif($Phase -match 'import|mark|gate-close'){'import'}elseif($Phase -match 'readiness|start-candidate'){'ready'}elseif($Phase -match 'commit|gate-open'){'commit'}elseif($Phase -match 'completed|removed|restored'){'done'}elseif($Phase -match 'rollback'){'recover'}else{'maintenance'}
 $c=@{verify=@('Проверка пакета и места','Verifying package and disk space','正在验证安装包和磁盘空间');export=@('Сохранение остановленного сервера','Exporting stopped server','正在导出已停止的服务器');import=@('Перенос данных в защищённую новую версию','Transferring data into gated candidate','正在将数据迁移到受保护的新版本');ready=@('Проверка HTTPS, базы данных и медиа','Checking HTTPS, database and media readiness','正在检查 HTTPS、数据库和媒体就绪状态');commit=@('Переключение на новую версию','Switching to the new generation','正在切换到新版本');done=@('Очистка завершена','Cleanup completed','清理已完成');recover=@('Восстановление безопасного состояния','Recovering a safe state','正在恢复安全状态');maintenance=@('Обслуживание выбранного сервера','Maintaining selected server','正在维护所选服务器')};$i=if($Language -ceq 'en'){1}elseif($Language -ceq 'zh-CN'){2}else{0};return $c[$kind][$i]
}
function Get-CLMSelection([object[]]$Rows,[int]$Index){if($Index -lt 0 -or $Index -ge $Rows.Count){throw 'Select an explicit server'};return $Rows[$Index]}
function New-CLMWindow([string]$Language){
 Add-Type -AssemblyName PresentationFramework
 [xml]$x=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Width="820" Height="780" MinWidth="660" MinHeight="650" WindowStartupLocation="CenterScreen" Background="#FAFAF9">
 <ScrollViewer VerticalScrollBarVisibility="Auto"><StackPanel Margin="26">
  <ComboBox x:Name="Language" Height="30" HorizontalAlignment="Right" Width="140"><ComboBoxItem Content="Русский"/><ComboBoxItem Content="English"/><ComboBoxItem Content="简体中文"/></ComboBox>
  <TextBlock x:Name="Heading" FontSize="26" FontWeight="SemiBold" Margin="0,10"/><TextBlock x:Name="Advice" TextWrapping="Wrap" Margin="0,0,0,12"/>
  <TextBlock x:Name="SelectLabel"/><ComboBox x:Name="Server" Height="36" Margin="0,4,0,8"/>
  <TextBlock x:Name="Current" TextWrapping="Wrap" Margin="0,0,0,12"/>
  <TextBlock x:Name="TargetLabel"/><DockPanel Margin="0,4,0,8"><Button x:Name="Browse" DockPanel.Dock="Right" Width="46" Content="…"/><TextBox x:Name="Target" MinHeight="30" IsReadOnly="True"/></DockPanel>
  <TextBlock x:Name="PinLabel" Visibility="Collapsed"/><TextBox x:Name="Pin" Visibility="Collapsed" IsReadOnly="True"/>
  <TextBlock x:Name="ConfirmLabel" Visibility="Collapsed"/><TextBox x:Name="Confirm" Visibility="Collapsed" IsReadOnly="True"/>
  <TextBlock x:Name="BundleLabel"/><DockPanel Margin="0,4,0,8"><Button x:Name="BundleBrowse" DockPanel.Dock="Right" Width="46" Content="…"/><TextBox x:Name="Bundle" MinHeight="30"/></DockPanel><RadioButton x:Name="KeepArchive" GroupName="RemovalData" IsChecked="True" Margin="0,4"/><RadioButton x:Name="EraseData" GroupName="RemovalData" Margin="0,4,0,12"/>
  <TextBlock x:Name="DestinationLabel"/><DockPanel Margin="0,4,0,8"><Button x:Name="DestinationBrowse" DockPanel.Dock="Right" Width="46" Content="…"/><TextBox x:Name="Destination" MinHeight="30"/></DockPanel>
  <WrapPanel Margin="0,12"><Button x:Name="Check" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Update" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Remove" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Restore" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Recover" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/></WrapPanel>
  <Button x:Name="OpenPanel" MinHeight="36" HorizontalAlignment="Left" Padding="12,5" Margin="0,0,0,12"/><ProgressBar x:Name="Progress" Height="5" IsIndeterminate="False"/><TextBlock x:Name="Result" TextWrapping="Wrap" Margin="0,12" AutomationProperties.LiveSetting="Polite"/>
 </StackPanel></ScrollViewer>
</Window>
'@
 return [Windows.Markup.XamlReader]::Load((New-Object Xml.XmlNodeReader $x))
}
function Get-CLMUiActionArguments($Window,$State,[string]$Action,[bool]$Confirmed){
 if($Action -in @('Update','Remove') -and -not $Confirmed){return $null}
 $row=$null;$root=if($Action -ceq 'Restore'){$Window.FindName('Destination').Text}else{$row=Get-CLMSelection $State.rows $Window.FindName('Server').SelectedIndex;$row.root}
 if($Action -ceq 'Update' -and ($State.checkedRoot -cne $root -or $State.checkedTarget -cne $State.targetPin)){throw (Get-CLMText check $State.lang)}
 $bundlePath=$Window.FindName('Bundle').Text;$erase=($Action -ceq 'Remove' -and $Window.FindName('EraseData').IsChecked)
 if($Action -ceq 'Remove' -and -not $erase){if(-not $Window.FindName('KeepArchive').IsChecked -or -not $bundlePath){throw (Get-CLMText bundle $State.lang)};$bundlePath=Join-Path $bundlePath ('CastLink-Archive-'+[datetime]::Now.ToString('yyyyMMdd-HHmmssfff'))}
 if($erase){$bundlePath=''}
 $argsMap=@{Action=$Action;InstallRoot=$root;TargetDirectory=$State.targetDirectory;ExpectedManifestSha256=$State.targetPin;Confirmation=$(if($row){$row.distroName}else{''});BundleDirectory=$bundlePath;EraseData=[bool]$erase}
 if($State.adapter){$argsMap.Adapter=$State.adapter};return $argsMap
}
function Confirm-CLMUiAction($Window,$Row,$Arguments,[string]$Language){
 $actionText=Get-CLMText $Arguments.Action.ToLowerInvariant() $Language
 if($Arguments.Action -ceq 'Remove'){$actionText+=': '+(Get-CLMText $(if($Arguments.EraseData){'erase'}else{'keep'}) $Language)}
 $text=$actionText+"`n`n"+$Row.domain+"`n"+$Row.version+"`n"+$Row.root+"`n"+$Row.distroName
 if($Arguments.Action -ceq 'Update'){$text+="`n"+(Get-CLMText target $Language)+': '+$Window.FindName('Target').Text}
 if($Arguments.BundleDirectory){$text+="`n`n"+$Arguments.BundleDirectory}
 return [Windows.MessageBox]::Show($Window,$text,(Get-CLMText title $Language),'YesNo','Warning','No') -eq 'Yes'
}
function Show-CLMReleasePicker([object[]]$Choices,[string]$Language){
 if(-not $Choices.Count){throw 'No server-wsl release with a verified manifest digest is available. Open the maintenance launcher supplied with the chosen release.'}
 $dialog=New-Object Windows.Window;$dialog.Title=Get-CLMText chooseRelease $Language;$dialog.Width=650;$dialog.Height=420;$dialog.WindowStartupLocation='CenterScreen';$stack=New-Object Windows.Controls.StackPanel;$stack.Margin=20;$list=New-Object Windows.Controls.ListBox;$list.Height=280
 foreach($c in $Choices){$null=$list.Items.Add($c.label)};$null=$stack.Children.Add($list);$ok=New-Object Windows.Controls.Button;$ok.Content=Get-CLMText select $Language;$ok.MinHeight=36;$ok.Margin='0,12,0,0';$null=$stack.Children.Add($ok);$dialog.Content=$stack;$result=@{choice=$null}
 $ok.Add_Click({if($list.SelectedIndex -ge 0){$result.choice=$Choices[$list.SelectedIndex];$dialog.DialogResult=$true}}.GetNewClosure());$null=$dialog.ShowDialog();return $result.choice
}
function Show-CastlinkMaintenance([string]$SelectedRoot,[string]$Language,[string]$TargetDirectory,[string]$ExpectedManifestSha256,[scriptblock]$Adapter){
 $window=New-CLMWindow $Language;Add-Type -AssemblyName System.Windows.Forms;$rows=@(Get-CastlinkMaintenanceInstallations);$state=@{lang=$Language;job=$null;rows=$rows;window=$window;source=(Join-Path $PSScriptRoot 'server-wsl-maintenance.ps1');targetDirectory=$TargetDirectory;targetPin=$ExpectedManifestSha256;adapter=$Adapter;checkedRoot='';checkedTarget='';progress=[hashtable]::Synchronized(@{phase='verify-package'})}
 if($TargetDirectory -and $ExpectedManifestSha256){if((Get-CLMHash (Join-Path $TargetDirectory 'manifest.json')) -cne $ExpectedManifestSha256){throw 'Pinned launcher target manifest mismatch'};$window.FindName('Target').Text=(Read-CLMJson (Join-Path $TargetDirectory 'manifest.json')).releaseTag;$window.FindName('Pin').Text=$ExpectedManifestSha256}
 foreach($r in $rows){$null=$window.FindName('Server').Items.Add(($r.domain+' | '+$r.version+' | '+$r.state+' | '+$r.root));if($SelectedRoot -and $r.root -ieq $SelectedRoot){$window.FindName('Server').SelectedIndex=$window.FindName('Server').Items.Count-1}}
 $translate={
  foreach($pair in @(@('Heading','title'),@('Advice','interruption'),@('SelectLabel','select'),@('TargetLabel','target'),@('PinLabel','pin'),@('ConfirmLabel','confirm'),@('BundleLabel','bundle'),@('DestinationLabel','destination'))){$window.FindName($pair[0]).Text=Get-CLMText $pair[1] $state.lang}
  $window.FindName('KeepArchive').Content=Get-CLMText keep $state.lang;$window.FindName('EraseData').Content=Get-CLMText erase $state.lang;$window.FindName('OpenPanel').Content=Get-CLMText open $state.lang;$window.FindName('Browse').Content='…'
  $window.Title=Get-CLMText title $state.lang;foreach($a in @('Check','Update','Remove','Restore','Recover')){$window.FindName($a).Content=Get-CLMText $a.ToLowerInvariant() $state.lang}
 }.GetNewClosure();& $translate
 $window.FindName('Language').SelectedIndex=if($Language -ceq 'en'){1}elseif($Language -ceq 'zh-CN'){2}else{0}
 $window.FindName('Language').Add_SelectionChanged({$state.lang=@('ru','en','zh-CN')[$window.FindName('Language').SelectedIndex];& $translate}.GetNewClosure())
 $window.FindName('Server').Add_SelectionChanged({if($window.FindName('Server').SelectedIndex -ge 0){$r=$state.rows[$window.FindName('Server').SelectedIndex];$window.FindName('Current').Text=(Get-CLMText current $state.lang)+': '+$r.version+"`n"+$r.distroName+"`n"+$r.root}}.GetNewClosure())
 $window.FindName('Browse').Add_Click({
  if($state.job){return};try{$pipeline=[PowerShell]::Create();$null=$pipeline.AddScript('param($source);$ErrorActionPreference="Stop";. $source -FunctionsOnly;Get-CastlinkWslReleaseChoices').AddArgument($state.source);$state.job=@{pipeline=$pipeline;handle=$pipeline.BeginInvoke();action='ChooseRelease'};$window.FindName('Progress').IsIndeterminate=$true;$window.FindName('Result').Text=Get-CLMText chooseRelease $state.lang}catch{$window.FindName('Result').Text=$_.Exception.Message}
 }.GetNewClosure())
 $window.FindName('BundleBrowse').Add_Click({$d=New-Object Windows.Forms.FolderBrowserDialog;if($d.ShowDialog() -eq 'OK'){$window.FindName('Bundle').Text=$d.SelectedPath}}.GetNewClosure())
 $window.FindName('DestinationBrowse').Add_Click({$d=New-Object Windows.Forms.FolderBrowserDialog;$d.SelectedPath=Join-Path $env:LOCALAPPDATA 'CastLinkServer';if($d.ShowDialog() -eq 'OK'){$window.FindName('Destination').Text=Join-Path $d.SelectedPath ('Restored-'+[datetime]::Now.ToString('yyyyMMdd-HHmmss'))}}.GetNewClosure())
 $window.FindName('OpenPanel').Add_Click({try{$r=Get-CLMSelection $state.rows $window.FindName('Server').SelectedIndex;Open-CastlinkActivePanel $r.root}catch{$window.FindName('Result').Text=$_.Exception.Message}}.GetNewClosure())
 foreach($actionName in @('Check','Update','Remove','Restore','Recover')){
  $chosenAction=$actionName
  $window.FindName($actionName).Add_Click({
   if($state.job){return}
   try{
    $argsMap=Get-CLMUiActionArguments $window $state $chosenAction $true
    $root=$argsMap.InstallRoot
    if($chosenAction -in @('Update','Remove')){$row=Get-CLMSelection $state.rows $window.FindName('Server').SelectedIndex;if(-not (Confirm-CLMUiAction $window $row $argsMap $state.lang)){return}}
    $state.operationRoot=$root
    $pipeline=[PowerShell]::Create();$null=$pipeline.AddScript('param($source,$argsMap,$progressState);$ErrorActionPreference="Stop";. $source -FunctionsOnly;$progress={param($phase);$progressState.phase=$phase}.GetNewClosure();Invoke-CastlinkMaintenance @argsMap -Progress $progress').AddArgument($state.source).AddArgument($argsMap).AddArgument($state.progress)
    $state.job=@{pipeline=$pipeline;handle=$pipeline.BeginInvoke();action=$chosenAction};$window.FindName('Progress').IsIndeterminate=$true;$window.FindName('Result').Text=Get-CLMText busy $state.lang
    foreach($name in @('Check','Update','Remove','Restore','Recover','Server','Target','Pin','Bundle','Destination','Confirm','Browse','KeepArchive','EraseData','BundleBrowse','DestinationBrowse','OpenPanel')){$window.FindName($name).IsEnabled=$false}
   }catch{$window.FindName('Result').Text=$_.Exception.Message}
  }.GetNewClosure())
 }
 $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(300)
 $timer.Add_Tick({if(-not $state.job){return};if(-not $state.job.handle.IsCompleted){if($state.job.action -cne 'ChooseRelease'){$window.FindName('Result').Text=Get-CLMPhaseText $state.progress.phase $state.lang};return};$job=$state.job
  try{$result=@($job.pipeline.EndInvoke($job.handle));if($job.pipeline.HadErrors){throw [string]$job.pipeline.Streams.Error[0]};$r=$result[-1];$text=Get-CLMText done $state.lang
   if($job.action -ceq 'ChooseRelease'){
    $choice=Show-CLMReleasePicker $result $state.lang
    if($choice){$selected=Receive-CastlinkWslReleaseManifest $choice (Get-CLMSelection $state.rows $window.FindName('Server').SelectedIndex).root;$state.targetDirectory=$selected.directory;$state.targetPin=$selected.manifestSha256;$state.checkedRoot='';$window.FindName('Target').Text=$selected.releaseTag;$window.FindName('Pin').Text=$selected.manifestSha256;$text=$selected.releaseTag}else{$text=''}
   }elseif($job.action -ceq 'Check'){$state.checkedRoot=$state.operationRoot;$state.checkedTarget=$state.targetPin;$text=(Get-CLMText current $state.lang)+': '+$r.source.releaseTag+"`n"+(Get-CLMText target $state.lang)+': '+$r.target.releaseTag+"`n"+(Get-CLMText space $state.lang)+': '+$r.requiredBytes+' / '+$r.freeBytes}else{$text+=': '+$r.phase};$window.FindName('Result').Text=$text
   if($job.action -in @('Update','Remove','Restore','Recover')){$state.rows=@(Get-CastlinkMaintenanceInstallations);$window.FindName('Server').Items.Clear();foreach($row in $state.rows){$null=$window.FindName('Server').Items.Add(($row.domain+' | '+$row.version+' | '+$row.state+' | '+$row.root));if($row.root -ieq $state.operationRoot){$window.FindName('Server').SelectedIndex=$window.FindName('Server').Items.Count-1}}}
  }catch{$message=$_.Exception.Message;$key='failed';try{$j=Get-CLMJournal $state.operationRoot;if($j.phase -in @('commit-decided','gate-open-attempted','committed')){$key='committed'}}catch{};$window.FindName('Result').Text=(Get-CLMText $key $state.lang)+"`n"+$message}finally{$job.pipeline.Dispose();$state.job=$null;$window.FindName('Progress').IsIndeterminate=$false;foreach($name in @('Check','Update','Remove','Restore','Recover','Server','Target','Pin','Bundle','Destination','Confirm','Browse','KeepArchive','EraseData','BundleBrowse','DestinationBrowse','OpenPanel')){$window.FindName($name).IsEnabled=$true}}
 }.GetNewClosure())
 $window.Add_Closing({param($sender,$event);if($state.job){$event.Cancel=$true}}.GetNewClosure());$window.Add_Closed({$timer.Stop()}.GetNewClosure());$timer.Start();$null=$window.ShowDialog()
}
if(-not $maintenanceUiRequest.functionsOnly){$ErrorActionPreference='Stop';Show-CastlinkMaintenance $maintenanceUiRequest.root $maintenanceUiRequest.lang $maintenanceUiRequest.target $maintenanceUiRequest.pin}
