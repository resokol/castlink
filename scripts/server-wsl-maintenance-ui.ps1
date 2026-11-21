[CmdletBinding()]
param([string]$InstallRoot,[ValidateSet('ru','en','zh-CN')][string]$Lang='ru',[string]$TargetDirectory,[string]$ExpectedManifestSha256,[ValidateSet('','Move','Recover')][string]$InitialAction='',[switch]$FunctionsOnly)
$maintenanceUiRequest=[pscustomobject]@{functionsOnly=[bool]$FunctionsOnly;root=$InstallRoot;lang=$Lang;target=$TargetDirectory;pin=$ExpectedManifestSha256;initialAction=$InitialAction}
. (Join-Path $PSScriptRoot 'server-wsl-maintenance.ps1') -FunctionsOnly
function Get-CLMText([string]$Key,[string]$Language='ru'){
 $c=@{
 title=@('Обслуживание CastLink','CastLink maintenance','CastLink 维护');select=@('Выберите сервер','Select server','选择服务器');
 cancelmove=@('Отменить перенос','Cancel move','取消移动');cancelMoveAdvice=@('Отменить перенос и восстановить исходное состояние сервера? Отмена возможна только после проверки, что диск WSL ещё находится в исходной папке.','Cancel this move and restore the original server state? Cancellation proceeds only after verifying that the WSL disk is still in its original folder.','是否取消移动并恢复服务器原始状态？只有确认 WSL 磁盘仍在原始目录后，才会执行取消。');
 move=@('Перенести сервер…','Move server…','移动服务器…');moveInterruption=@('Перенос временно прервёт работу сервера; версия и данные сохранятся. Освобождение диска WSL может потребовать закрытия других WSL-приложений, включая Docker Desktop.','Moving interrupts server availability and preserves the version and data. Releasing the WSL disk may require closing other WSL applications, including Docker Desktop.','移动期间服务器暂时不可用，版本和数据将保留。释放 WSL 磁盘可能需要关闭其他 WSL 应用（包括 Docker Desktop）。');sourceFolder=@('Текущая папка сервера','Current server folder','当前服务器目录');unavailable=@('Диск или папка сервера недоступны. Подключите диск и откройте обслуживание снова.','The server disk or folder is unavailable. Reconnect it and reopen maintenance.','服务器磁盘或目录不可用。请重新连接磁盘并再次打开维护。');conflict=@('Обнаружен конфликт установки. Управление заблокировано; проверьте папку и журнал.','Installation conflict. Management is blocked; inspect the folder and journal.','安装存在冲突。管理已禁用；请检查目录和日志。');pending=@('Перенос не завершён. Используйте «Завершить / восстановить операцию».','The move is unfinished. Use Recover transaction.','移动尚未完成。请使用恢复事务。');
 check=@('Проверить','Check','检查');update=@('Обновить','Update','更新');remove=@('Удалить','Remove','删除');restore=@('Восстановить','Restore','恢复');recover=@('Завершить / восстановить операцию','Recover transaction','恢复事务');
 keep=@('Сохранить архив перед удалением','Keep a restorable archive before removing','删除前保留可恢复归档');erase=@('Безвозвратно удалить сервер и данные','Permanently erase server and data','永久删除服务器和数据');browse=@('Выбрать…','Choose…','选择…');open=@('Открыть панель сервера','Open server panel','打开服务器面板');chooseRelease=@('Выберите опубликованную версию; RC выбирается явно','Choose a published release; prereleases require explicit selection','选择已发布版本；预发布版本须明确选择');committed=@('Новая версия выбрана. Не запускайте старый сервер. Завершите восстановление операции.','The new generation is selected. Keep the old server stopped and recover this transaction.','已选择新版本。请保持旧服务器停止并恢复此事务。');
 current=@('Установлено','Current','当前');target=@('Целевая версия','Target version','目标版本');
 pin=@('SHA256 manifest.json (проверенный источник)','Manifest SHA256 (trusted source)','清单 SHA256（可信来源）');
 confirm=@('Подтверждение: введите точное имя WSL сервера','Confirmation: type exact WSL server name','确认：输入确切的 WSL 服务器名称');
 bundle=@('Архив сервера (папка)','Server archive (folder)','服务器归档（文件夹）');
 destination=@('Новая папка для переноса / восстановления (локальный NTFS-диск)','New Move / Restore folder (local NTFS disk)','移动 / 恢复的新目录（本地 NTFS 磁盘）');
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
  <WrapPanel Margin="0,12"><Button x:Name="Check" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Update" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Move" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Remove" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Restore" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="Recover" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/><Button x:Name="CancelMove" MinHeight="36" Margin="0,0,8,8" Padding="12,5"/></WrapPanel>
  <Button x:Name="OpenPanel" MinHeight="36" HorizontalAlignment="Left" Padding="12,5" Margin="0,0,0,12"/><ProgressBar x:Name="Progress" Height="5" IsIndeterminate="False"/><TextBlock x:Name="Result" TextWrapping="Wrap" Margin="0,12" AutomationProperties.LiveSetting="Polite"/>
 </StackPanel></ScrollViewer>
</Window>
'@
 return [Windows.Markup.XamlReader]::Load((New-Object Xml.XmlNodeReader $x))
}
function Get-CLMUiRows([string]$SelectedRoot){
 $rows=@(Get-CastlinkMaintenanceInstallations)
 if($SelectedRoot -and -not @($rows|Where-Object {$_.root -ieq $SelectedRoot}).Count){
  $rows+=@([pscustomobject]@{root=$SelectedRoot;activeRoot=$SelectedRoot;domain='?';version='?';state='unavailable';distroName='';logicalId='';message='Selected installation is unavailable'})
 }
 foreach($row in $rows){
  $pointer=Join-Path $row.root 'maintenance-transaction.json'
  if(-not (Test-Path -LiteralPath $pointer)){continue}
  try{
   $p=Read-CLMJson $pointer
   if($p.kind -ceq 'move'){
    # Resolve the owned recovery pointer directly: Get-CLMRoot intentionally refuses
    # an unfinished move, including the period after the VHD has changed locations.
    $j=Read-CLMMoveJournal $row.root $false
    if($j.phase -ceq 'cancelled' -and $row.root -ceq $j.destinationRoot){$row|Add-Member NoteProperty state 'unavailable' -Force;continue}
    if($j.phase -notin @('completed','cancelled')){
     foreach($entry in @{state='recovery';canCancelMove=($j.phase -in @('move-prepared','move-quiesce','move-copy','move-wsl'));logicalId=$j.logicalId;distroName=$j.source.distroName;version=$j.source.releaseTag;message='Recover the pending move before managing this server'}.GetEnumerator()){$row|Add-Member NoteProperty $entry.Key $entry.Value -Force}
    }
   }
  }catch{$row|Add-Member NoteProperty state 'conflict' -Force;$row|Add-Member NoteProperty message $_.Exception.Message -Force}
 }
 return $rows
}
function Test-CLMUiRowAction($Row,[string]$Action){
 if($Action -ceq 'Restore'){return $true};if(-not $Row){return $false}
 $status=if($Row.PSObject.Properties['state']){[string]$Row.state}else{'ready'}
 if($status -in @('unavailable','conflict')){return $false}
 if($status -in @('recovery','maintenance')){return ($Action -ceq 'Recover' -or ($Action -ceq 'CancelMove' -and $Row.PSObject.Properties['canCancelMove'] -and $Row.canCancelMove))}
 return $Action -cne 'CancelMove'
}
function Update-CLMUiAvailability($Window,$State){
 $idle=-not [bool]$State.job;$index=$Window.FindName('Server').SelectedIndex
 $row=if($index -ge 0 -and $index -lt $State.rows.Count){$State.rows[$index]}else{$null}
 foreach($name in @('Check','Update','Remove','Restore','Recover','CancelMove','Move','OpenPanel')){$Window.FindName($name).IsEnabled=$idle -and (Test-CLMUiRowAction $row $name)}
 foreach($name in @('Server','Target','Pin','Bundle','Destination','Confirm','Browse','KeepArchive','EraseData','BundleBrowse','DestinationBrowse')){$Window.FindName($name).IsEnabled=$idle}
 $Window.FindName('Browse').IsEnabled=$idle -and (Test-CLMUiRowAction $row 'Check')
}
function Get-CLMUiDestinationFromParent([string]$Parent,[string]$Action){
 $parentPath=Assert-CLMPath $Parent
 if(-not (Test-Path -LiteralPath $parentPath -PathType Container)){throw 'Choose an available parent folder'}
 $prefix=if($Action -ceq 'Move'){'CastLink-'}else{'Restored-'}
 $candidate=Join-Path $parentPath ($prefix+[datetime]::Now.ToString('yyyyMMdd-HHmmssfff'))
 if(Test-Path -LiteralPath $candidate){$candidate+='-'+[guid]::NewGuid().ToString('N').Substring(0,8)}
 return $candidate
}
function Get-CLMUiResultSelection([object[]]$Rows,$State,$Result){
 $destination='';$logical=$State.operationLogicalId
 $kind=if($Result -is [Collections.IDictionary]){$Result['kind']}elseif($Result -and $Result.PSObject.Properties['kind']){$Result.kind}else{''}
 if($kind -ceq 'move' -and $Result.phase -ceq 'completed'){$destination=[string]$Result.destinationRoot;$logical=[string]$Result.logicalId}
 if($kind -ceq 'move' -and $Result.phase -ceq 'cancelled'){$destination=[string]$Result.selectedRoot;$logical=[string]$Result.logicalId}
 for($i=0;$i -lt $Rows.Count;$i++){if($destination -and $Rows[$i].root -ieq $destination){return $i}}
 for($i=0;$i -lt $Rows.Count;$i++){if($logical -and $Rows[$i].PSObject.Properties['logicalId'] -and $Rows[$i].logicalId -ceq $logical){return $i}}
 for($i=0;$i -lt $Rows.Count;$i++){if($Rows[$i].root -ieq $State.operationRoot){return $i}}
 return -1
}

function Get-CLMUiActionArguments($Window,$State,[string]$Action,[bool]$Confirmed){
 if($Action -in @('Update','Remove','Move','CancelMove') -and -not $Confirmed){return $null}
 $row=$null;$root=if($Action -ceq 'Restore'){$Window.FindName('Destination').Text}else{$row=Get-CLMSelection $State.rows $Window.FindName('Server').SelectedIndex;$row.root}
 if(-not (Test-CLMUiRowAction $row $Action)){$key=if($row.state -ceq 'unavailable'){'unavailable'}elseif($row.state -ceq 'conflict'){'conflict'}else{'pending'};throw (Get-CLMText $key $State.lang)}
 if($Action -ceq 'CancelMove'){
  $argsMap=@{Action='CancelMove';InstallRoot=$root;Confirmation=$row.distroName;BundleDirectory='';EraseData=$false}
  if($State.adapter){$argsMap.Adapter=$State.adapter};return $argsMap
 }
 if($Action -ceq 'Move'){
  $destination=$Window.FindName('Destination').Text.Trim()
  if(-not $destination){throw (Get-CLMText destination $State.lang)}
  if($destination -notmatch '^[A-Za-z]:\\' -or (Test-Path -LiteralPath $destination)){throw 'Choose a new destination folder on a local disk; it must not already exist.'}
  $argsMap=@{Action='Move';InstallRoot=$root;DestinationRoot=$destination;Confirmation=$row.distroName;BundleDirectory='';EraseData=$false}
  if($State.adapter){$argsMap.Adapter=$State.adapter};return $argsMap
 }
 if($Action -ceq 'Update' -and ($State.checkedRoot -cne $root -or $State.checkedTarget -cne $State.targetPin)){throw (Get-CLMText check $State.lang)}
 $bundlePath=$Window.FindName('Bundle').Text;$erase=($Action -ceq 'Remove' -and $Window.FindName('EraseData').IsChecked)
 if($Action -ceq 'Remove' -and -not $erase){if(-not $Window.FindName('KeepArchive').IsChecked -or -not $bundlePath){throw (Get-CLMText bundle $State.lang)};$bundlePath=Join-Path $bundlePath ('CastLink-Archive-'+[datetime]::Now.ToString('yyyyMMdd-HHmmssfff'))}
 if($erase){$bundlePath=''}
 $argsMap=@{Action=$Action;InstallRoot=$root;TargetDirectory=$State.targetDirectory;ExpectedManifestSha256=$State.targetPin;Confirmation=$(if($row){$row.distroName}else{''});BundleDirectory=$bundlePath;EraseData=[bool]$erase}
 if($State.adapter){$argsMap.Adapter=$State.adapter};return $argsMap
}
function Get-CLMUiConfirmationText($Window,$Row,$Arguments,[string]$Language,$Estimate=$null){
 $actionText=Get-CLMText $Arguments.Action.ToLowerInvariant() $Language
 if($Arguments.Action -ceq 'Remove'){$actionText+=': '+(Get-CLMText $(if($Arguments.EraseData){'erase'}else{'keep'}) $Language)}
 $text=$actionText+"`n`n"+$Row.domain+"`n"+$Row.version+"`n"+$Row.root+"`n"+$Row.distroName
 if($Arguments.Action -ceq 'CancelMove'){$text+="`n`n"+(Get-CLMText cancelMoveAdvice $Language)}
 if($Arguments.Action -ceq 'Update'){$text+="`n"+(Get-CLMText target $Language)+': '+$Window.FindName('Target').Text}
 if($Arguments.Action -ceq 'Move'){
  $source=if($Row.PSObject.Properties['activeRoot']){$Row.activeRoot}else{$Row.root}
  $text+="`n`n"+(Get-CLMText sourceFolder $Language)+': '+$source+"`n"+(Get-CLMText destination $Language)+': '+$Arguments.DestinationRoot+"`n`n"+(Get-CLMText moveInterruption $Language)
 }
 if($Arguments.Action -ceq 'Move' -and $Estimate){$text+="`n"+(Get-CLMText space $Language)+': '+$Estimate.requiredBytes+' / '+$Estimate.freeBytes}
 if($Arguments.BundleDirectory){$text+="`n`n"+$Arguments.BundleDirectory}
 return $text
}
function Confirm-CLMUiAction($Window,$Row,$Arguments,[string]$Language,$Estimate=$null){
 $text=Get-CLMUiConfirmationText $Window $Row $Arguments $Language $Estimate
 return [Windows.MessageBox]::Show($Window,$text,(Get-CLMText title $Language),'YesNo','Warning','No') -eq 'Yes'
}
function Receive-CLMUiRelease($Choice,$Window,$State){
 $row=Get-CLMSelection $State.rows $Window.FindName('Server').SelectedIndex
 if(-not (Test-CLMUiRowAction $row 'Check')){throw (Get-CLMText unavailable $State.lang)}
 return Receive-CastlinkWslReleaseManifest $Choice $row.root
}
function Show-CLMReleasePicker([object[]]$Choices,[string]$Language){
 if(-not $Choices.Count){throw 'No server-wsl release with a verified manifest digest is available. Open the maintenance launcher supplied with the chosen release.'}
 $dialog=New-Object Windows.Window;$dialog.Title=Get-CLMText chooseRelease $Language;$dialog.Width=650;$dialog.Height=420;$dialog.WindowStartupLocation='CenterScreen';$stack=New-Object Windows.Controls.StackPanel;$stack.Margin=20;$list=New-Object Windows.Controls.ListBox;$list.Height=280
 foreach($c in $Choices){$null=$list.Items.Add($c.label)};$null=$stack.Children.Add($list);$ok=New-Object Windows.Controls.Button;$ok.Content=Get-CLMText select $Language;$ok.MinHeight=36;$ok.Margin='0,12,0,0';$null=$stack.Children.Add($ok);$dialog.Content=$stack;$result=@{choice=$null}
 $ok.Add_Click({if($list.SelectedIndex -ge 0){$result.choice=$Choices[$list.SelectedIndex];$dialog.DialogResult=$true}});$null=$dialog.ShowDialog();return $result.choice
}
# Callbacks run within this modal ShowDialog scope; keep its functions visible.
# Action identity comes from the actual button rather than a loop-variable closure.
function Show-CastlinkMaintenance([string]$SelectedRoot,[string]$Language,[string]$TargetDirectory,[string]$ExpectedManifestSha256,[scriptblock]$Adapter,[string]$InitialAction=''){
 $window=New-CLMWindow $Language;Add-Type -AssemblyName System.Windows.Forms;$rows=@(Get-CLMUiRows $SelectedRoot);$state=@{lang=$Language;job=$null;rows=$rows;window=$window;source=(Join-Path $PSScriptRoot 'server-wsl-maintenance.ps1');targetDirectory=$TargetDirectory;targetPin=$ExpectedManifestSha256;adapter=$Adapter;checkedRoot='';checkedTarget='';operationRoot='';operationLogicalId='';actionMode=$(if($InitialAction -ceq 'Move'){'Move'}else{'Restore'});progress=[hashtable]::Synchronized(@{phase='verify-package'})}
 if($TargetDirectory -and $ExpectedManifestSha256){if((Get-CLMHash (Join-Path $TargetDirectory 'manifest.json')) -cne $ExpectedManifestSha256){throw 'Pinned launcher target manifest mismatch'};$window.FindName('Target').Text=(Read-CLMJson (Join-Path $TargetDirectory 'manifest.json')).releaseTag;$window.FindName('Pin').Text=$ExpectedManifestSha256}
 foreach($r in $rows){$null=$window.FindName('Server').Items.Add(($r.domain+' | '+$r.version+' | '+$r.state+' | '+$r.root));if($SelectedRoot -and $r.root -ieq $SelectedRoot){$window.FindName('Server').SelectedIndex=$window.FindName('Server').Items.Count-1}}
 $translate={
  foreach($pair in @(@('Heading','title'),@('Advice','interruption'),@('SelectLabel','select'),@('TargetLabel','target'),@('PinLabel','pin'),@('ConfirmLabel','confirm'),@('BundleLabel','bundle'),@('DestinationLabel','destination'))){$window.FindName($pair[0]).Text=Get-CLMText $pair[1] $state.lang}
  $window.FindName('KeepArchive').Content=Get-CLMText keep $state.lang;$window.FindName('EraseData').Content=Get-CLMText erase $state.lang;$window.FindName('OpenPanel').Content=Get-CLMText open $state.lang;$window.FindName('Browse').Content='…'
  $window.Title=Get-CLMText title $state.lang;foreach($a in @('Check','Update','Move','Remove','Restore','Recover','CancelMove')){$window.FindName($a).Content=Get-CLMText $a.ToLowerInvariant() $state.lang}
 };& $translate
 $window.FindName('Language').SelectedIndex=if($Language -ceq 'en'){1}elseif($Language -ceq 'zh-CN'){2}else{0}
 $window.FindName('Language').Add_SelectionChanged({$state.lang=@('ru','en','zh-CN')[$window.FindName('Language').SelectedIndex];& $translate})
 $showSelection={
  if($window.FindName('Server').SelectedIndex -ge 0){
   $r=$state.rows[$window.FindName('Server').SelectedIndex];$text=(Get-CLMText current $state.lang)+': '+$r.version+"`n"+$r.distroName+"`n"+$r.root
   if($r.state -in @('unavailable','conflict','recovery','maintenance')){$key=if($r.state -in @('recovery','maintenance')){'pending'}else{$r.state};$text+="`n"+(Get-CLMText $key $state.lang);if($r.PSObject.Properties['message'] -and $r.message){$text+="`n"+$r.message}}
   $window.FindName('Current').Text=$text
  }else{$window.FindName('Current').Text=''}
  Update-CLMUiAvailability $window $state
 }
 $window.FindName('Server').Add_SelectionChanged($showSelection);& $showSelection
 $window.FindName('Browse').Add_Click({
  if($state.job){return};try{$pipeline=[PowerShell]::Create();$null=$pipeline.AddScript('param($source);$ErrorActionPreference="Stop";. $source -FunctionsOnly;Get-CastlinkWslReleaseChoices').AddArgument($state.source);$state.job=@{pipeline=$pipeline;handle=$pipeline.BeginInvoke();action='ChooseRelease'};$window.FindName('Progress').IsIndeterminate=$true;$window.FindName('Result').Text=Get-CLMText chooseRelease $state.lang;Update-CLMUiAvailability $window $state}catch{$window.FindName('Result').Text=$_.Exception.Message}
 })
 $window.FindName('BundleBrowse').Add_Click({$d=New-Object Windows.Forms.FolderBrowserDialog;if($d.ShowDialog() -eq 'OK'){$window.FindName('Bundle').Text=$d.SelectedPath}})
 $window.FindName('DestinationBrowse').Add_Click({
  $d=New-Object Windows.Forms.FolderBrowserDialog;$d.ShowNewFolderButton=$false
  try{if($d.ShowDialog() -eq 'OK'){$window.FindName('Destination').Text=Get-CLMUiDestinationFromParent $d.SelectedPath $state.actionMode}}catch{$window.FindName('Result').Text=$_.Exception.Message}finally{$d.Dispose()}
 })
 $window.FindName('OpenPanel').Add_Click({try{$r=Get-CLMSelection $state.rows $window.FindName('Server').SelectedIndex;if(-not (Test-CLMUiRowAction $r 'OpenPanel')){throw (Get-CLMText unavailable $state.lang)};Open-CastlinkActivePanel $r.root}catch{$window.FindName('Result').Text=$_.Exception.Message}})
 foreach($actionName in @('Check','Update','Move','Remove','Restore','Recover','CancelMove')){
  $chosenAction=$actionName
  $window.FindName($actionName).Add_Click({param($sender,$event)
   $chosenAction=[string]$sender.Name
   if($state.job){return}
   try{
    if($chosenAction -in @('Move','Restore')){$state.actionMode=$chosenAction}
    $argsMap=Get-CLMUiActionArguments $window $state $chosenAction $true
    $root=$argsMap.InstallRoot
    $estimate=$null;if($chosenAction -ceq 'Move'){$estimate=Get-CastlinkMoveEstimate -InstallRoot $argsMap.InstallRoot -DestinationRoot $argsMap.DestinationRoot}
    if($chosenAction -in @('Update','Remove','Move','CancelMove')){$row=Get-CLMSelection $state.rows $window.FindName('Server').SelectedIndex;if(-not (Confirm-CLMUiAction $window $row $argsMap $state.lang $estimate)){return}}
    $state.operationRoot=$root;$state.operationLogicalId='';if($chosenAction -cne 'Restore'){$selectedRow=Get-CLMSelection $state.rows $window.FindName('Server').SelectedIndex;if($selectedRow.PSObject.Properties['logicalId']){$state.operationLogicalId=$selectedRow.logicalId}}
    $pipeline=[PowerShell]::Create();$null=$pipeline.AddScript('param($source,$argsMap,$progressState);$ErrorActionPreference="Stop";. $source -FunctionsOnly;$progress={param($phase);$progressState.phase=$phase}.GetNewClosure();Invoke-CastlinkMaintenance @argsMap -Progress $progress').AddArgument($state.source).AddArgument($argsMap).AddArgument($state.progress)
    $state.job=@{pipeline=$pipeline;handle=$pipeline.BeginInvoke();action=$chosenAction};$window.FindName('Progress').IsIndeterminate=$true;$window.FindName('Result').Text=Get-CLMText busy $state.lang
    Update-CLMUiAvailability $window $state
   }catch{$window.FindName('Result').Text=$_.Exception.Message}
  })
 }
 $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(300)
 $timer.Add_Tick({if(-not $state.job){return};if(-not $state.job.handle.IsCompleted){if($state.job.action -cne 'ChooseRelease'){$window.FindName('Result').Text=Get-CLMPhaseText $state.progress.phase $state.lang};return};$job=$state.job
  try{$result=@($job.pipeline.EndInvoke($job.handle));if($job.pipeline.HadErrors){throw [string]$job.pipeline.Streams.Error[0]};$r=$result[-1];$text=Get-CLMText done $state.lang
   if($job.action -ceq 'ChooseRelease'){
    $choice=Show-CLMReleasePicker $result $state.lang
    if($choice){$selected=Receive-CLMUiRelease $choice $window $state;$state.targetDirectory=$selected.directory;$state.targetPin=$selected.manifestSha256;$state.checkedRoot='';$window.FindName('Target').Text=$selected.releaseTag;$window.FindName('Pin').Text=$selected.manifestSha256;$text=$selected.releaseTag}else{$text=''}
   }elseif($job.action -ceq 'Check'){$state.checkedRoot=$state.operationRoot;$state.checkedTarget=$state.targetPin;$text=(Get-CLMText current $state.lang)+': '+$r.source.releaseTag+"`n"+(Get-CLMText target $state.lang)+': '+$r.target.releaseTag+"`n"+(Get-CLMText space $state.lang)+': '+$r.requiredBytes+' / '+$r.freeBytes}else{$text+=': '+$r.phase};$window.FindName('Result').Text=$text
   if($job.action -in @('Update','Move','Remove','Restore','Recover','CancelMove')){
    $state.rows=@(Get-CLMUiRows);$index=Get-CLMUiResultSelection $state.rows $state $r
    $window.FindName('Server').Items.Clear();foreach($row in $state.rows){$null=$window.FindName('Server').Items.Add(($row.domain+' | '+$row.version+' | '+$row.state+' | '+$row.root))};$window.FindName('Server').SelectedIndex=$index
   }
  }catch{
   $message=$_.Exception.Message;$key='failed'
   try{$j=Get-CLMJournal $state.operationRoot;if($j.phase -in @('commit-decided','gate-open-attempted','committed')){$key='committed'}}catch{}
   if($job.action -in @('Update','Move','Remove','Restore','Recover','CancelMove')){
    try{
     $state.rows=@(Get-CLMUiRows $state.operationRoot);$index=Get-CLMUiResultSelection $state.rows $state $null
     $window.FindName('Server').Items.Clear();foreach($row in $state.rows){$null=$window.FindName('Server').Items.Add(($row.domain+' | '+$row.version+' | '+$row.state+' | '+$row.root))};$window.FindName('Server').SelectedIndex=$index
    }catch{$message+="`n"+$_.Exception.Message}
   }
   $window.FindName('Result').Text=(Get-CLMText $key $state.lang)+"`n"+$message
  }finally{$job.pipeline.Dispose();$state.job=$null;$window.FindName('Progress').IsIndeterminate=$false;Update-CLMUiAvailability $window $state}
 })
 if($InitialAction -ceq 'Move'){$window.Add_Loaded({$window.FindName('Destination').Focus()|Out-Null;$window.FindName('Result').Text=Get-CLMText moveInterruption $state.lang})}
 if($InitialAction -ceq 'Recover'){$window.Add_Loaded({$window.FindName('Recover').Focus()|Out-Null;$window.FindName('Result').Text=Get-CLMText pending $state.lang})}
 $window.Add_Closing({param($sender,$event);if($state.job){$event.Cancel=$true}});$window.Add_Closed({$timer.Stop()});$timer.Start();$null=$window.ShowDialog()
}
if(-not $maintenanceUiRequest.functionsOnly){$ErrorActionPreference='Stop';Show-CastlinkMaintenance $maintenanceUiRequest.root $maintenanceUiRequest.lang $maintenanceUiRequest.target $maintenanceUiRequest.pin -InitialAction $maintenanceUiRequest.initialAction}
