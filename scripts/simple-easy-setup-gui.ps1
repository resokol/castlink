param([string]$InstallFolder='', [switch]$FunctionsOnly, [string]$SmokeResult='')
$ErrorActionPreference='Stop'
function New-SimpleGuiChannel {
  return [pscustomobject]@{messages=(New-Object 'Collections.Concurrent.BlockingCollection[object]');responses=(New-Object 'Collections.Concurrent.BlockingCollection[object]')}
}
function Start-SimpleGuiWorker([string]$Entry,[hashtable]$Options,[object]$Channel) {
  $runspace=[RunspaceFactory]::CreateRunspace();$runspace.ApartmentState='STA';$runspace.ThreadOptions='ReuseThread';$runspace.Open()
  $ps=[PowerShell]::Create();$ps.Runspace=$runspace
  $source=@'
param($Entry,$Options,$Messages,$Responses)
$global:SimpleGuiMessages=$Messages;$global:SimpleGuiResponses=$Responses
$global:SimpleGuiCancelled=$false;$global:SimpleCleanupScheduled=$false
function global:Read-Host {
  param([string]$Prompt,[switch]$AsSecureString)
  $global:SimpleGuiMessages.Add([pscustomobject]@{kind='prompt';text=$Prompt;secure=[bool]$AsSecureString})
  $answer=$global:SimpleGuiResponses.Take()
  if($answer.cancelled){$global:SimpleGuiCancelled=$true;throw [OperationCanceledException]::new('Действие отменено. Сохранённые данные оставлены для продолжения.')}
  return $answer.value
}
function global:Write-Host {
  param([Parameter(Position=0,ValueFromRemainingArguments=$true)][object[]]$Object,[string]$Separator=' ',[switch]$NoNewline,$ForegroundColor,$BackgroundColor)
  $global:SimpleGuiMessages.Add([pscustomobject]@{kind='log';text=($Object -join $Separator)})
}
function global:Write-Progress {
  param($Id,$Activity,$Status,[int]$PercentComplete=-1,[switch]$Completed,$CurrentOperation,$ParentId,$SecondsRemaining)
  $global:SimpleGuiMessages.Add([pscustomobject]@{kind='progress';text=$Status;activity=$Activity;id=$Id;percent=$PercentComplete;completed=[bool]$Completed})
}
$code=0
try { $global:LASTEXITCODE=0;& $Entry @Options;$code=$global:LASTEXITCODE }
catch { $code=1;$Messages.Add([pscustomobject]@{kind='log';text=$_.Exception.Message}) }
finally { $Messages.Add([pscustomobject]@{kind='done';exitCode=$code;cancelled=$global:SimpleGuiCancelled;cleanupPending=$global:SimpleCleanupScheduled}) }
'@
  $null=$ps.AddScript($source).AddArgument($Entry).AddArgument($Options).AddArgument($Channel.messages).AddArgument($Channel.responses)
  return [pscustomobject]@{powershell=$ps;runspace=$runspace;async=$ps.BeginInvoke();channel=$Channel}
}
function Close-SimpleGuiWorker([object]$Worker) {
  try{$null=$Worker.powershell.EndInvoke($Worker.async)}finally{$Worker.powershell.Dispose();$Worker.runspace.Dispose()}
}
function Get-SimpleGuiPrompt([string]$Text,[bool]$Secure,[string[]]$LogLines=@()) {
  $default='';$title=$Text
  if($Text -match '^(.*) \[([^\[\]]*)\]$'){$title=$matches[1];$default=$matches[2]}
  $choices=@([regex]::Matches($title,'(?:^|\s)(\d+)\s*[—-]\s*([^;]+)')|ForEach-Object{[pscustomobject]@{value=$_.Groups[1].Value;label=$_.Groups[2].Value.Trim()}})
  if($title -like '*Выбери номер*'){
    $listed=New-Object 'Collections.Generic.List[object]'
    for($i=$LogLines.Count-1;$i -ge 0;$i--){
      if($LogLines[$i] -match '^(\d+) — (.*)$'){$listed.Insert(0,[pscustomobject]@{value=$matches[1];label=$matches[2]})}
      elseif($listed.Count){break}
    }
    $zero=@($choices|Where-Object{$_.value -eq '0'})
    $choices=@($listed.ToArray())+$(if($zero.Count){$zero}else{@([pscustomobject]@{value='0';label='Отмена'})})
  }
  if($default -eq 'да/нет'){$default='нет';$choices=@([pscustomobject]@{value='да';label='Да'},[pscustomobject]@{value='нет';label='Нет'})}
  return [pscustomobject]@{title=$title;default=$default;secure=$Secure;choices=$choices;folder=($title -like 'Папка*')}
}
if($FunctionsOnly){return}
try {
  Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Windows.Forms
  $reader=New-Object Xml.XmlNodeReader ([xml][IO.File]::ReadAllText((Join-Path $PSScriptRoot 'simple-easy-setup-window.xaml')))
  $window=[Windows.Markup.XamlReader]::Load($reader)
  $controls=@{};foreach($name in @('HeaderText','StatusText','PromptTitle','PromptBody','ChoicePanel','AnswerBox','PasswordBox','FolderButton','ContinueButton','CancelButton','ProgressBar','DownloadText','LogBox','RetryButton','CloseButton')){$controls[$name]=$window.FindName($name)}
  $area=[Windows.SystemParameters]::WorkArea;$window.MinWidth=[Math]::Min($window.MinWidth,$area.Width);$window.MinHeight=[Math]::Min($window.MinHeight,$area.Height);$window.Width=[Math]::Min($window.Width,$area.Width);$window.Height=[Math]::Min($window.Height,$area.Height)
  $script:gui=[pscustomobject]@{worker=$null;prompt=$null;channel=$null;done=$false;lines=(New-Object 'Collections.Generic.List[string]');url=''}
  function Show-SimpleGuiInput($Message) {
    $script:gui.prompt=Get-SimpleGuiPrompt $Message.text $Message.secure $script:gui.lines.ToArray()
    $p=$script:gui.prompt;$controls.PromptTitle.Text=$p.title
    $context=(@($script:gui.lines|Select-Object -Last 5) -join "`n")
    $controls.PromptBody.Text=$context+$(if($p.secure){"`nПароль используется только в памяти и не сохраняется."}else{''})
    foreach($name in @('AnswerBox','PasswordBox','ChoicePanel','FolderButton')){$controls[$name].Visibility='Collapsed'}
    $controls.ChoicePanel.Children.Clear();$controls.AnswerBox.Text=$p.default;$controls.PasswordBox.Clear()
    if($SmokeResult -and $p.choices.Count){$window.UpdateLayout();$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap ([int]$window.ActualWidth),([int]$window.ActualHeight),96,96,([Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($window);$png=New-Object Windows.Media.Imaging.PngBitmapEncoder;$png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$stream=[IO.File]::Create($SmokeResult+'.choices.png');try{$png.Save($stream)}finally{$stream.Dispose()}}
    if($p.secure){$controls.PasswordBox.Visibility='Visible';$null=$controls.PasswordBox.Focus()}
    elseif($p.choices.Count){$controls.ChoicePanel.Visibility='Visible';foreach($choice in $p.choices){$radio=New-Object Windows.Controls.RadioButton;$radio.Content=$choice.label;$radio.Tag=$choice.value;$radio.Style=$window.FindResource('ChoiceRadioStyle');$radio.IsChecked=($choice.value -ceq $p.default);$null=$controls.ChoicePanel.Children.Add($radio)}}
    else{$controls.AnswerBox.Visibility='Visible';$null=$controls.AnswerBox.Focus();if($p.folder){$controls.FolderButton.Visibility='Visible'}}
    $controls.ContinueButton.IsEnabled=$true;$controls.CancelButton.IsEnabled=$true;$controls.ProgressBar.IsIndeterminate=$false;$controls.StatusText.Text='Ожидаю твой выбор'
  }
  function Start-SimpleGuiOperation {
    $script:gui.done=$false;$script:gui.prompt=$null;$script:gui.url='';$script:gui.lines.Clear();$controls.LogBox.Clear();$controls.RetryButton.Visibility='Collapsed';$controls.CloseButton.Visibility='Collapsed';$controls.ContinueButton.Content='Продолжить';$controls.AnswerBox.IsReadOnly=$false
    $controls.ContinueButton.IsEnabled=$false;$controls.CancelButton.IsEnabled=$false;$controls.ProgressBar.IsIndeterminate=$true;$controls.ProgressBar.Value=0;$controls.StatusText.Text='Подготавливаю мастер…'
    $script:gui.channel=New-SimpleGuiChannel
    $entry=Join-Path $PSScriptRoot 'windows-simple-easy-setup.ps1';$options=@{}
    if($InstallFolder){$options.InstallFolder=$InstallFolder}
    if($SmokeResult){$entry=Join-Path $PSScriptRoot 'simple-easy-setup-gui-smoke.ps1';$options.Result=$SmokeResult}
    $script:gui.worker=Start-SimpleGuiWorker $entry $options $script:gui.channel
  }
  $controls.ContinueButton.Add_Click({
    if($script:gui.done -and $script:gui.url){Start-Process $script:gui.url;return}
    if(-not $script:gui.prompt){return}
    $p=$script:gui.prompt
    if($p.secure){$value=$controls.PasswordBox.SecurePassword.Copy();$controls.PasswordBox.Clear()}
    elseif($p.choices.Count){$selected=@($controls.ChoicePanel.Children|Where-Object{$_.IsChecked});if(-not $selected.Count){return};$value=[string]$selected[0].Tag}
    else{$value=$controls.AnswerBox.Text}
    $script:gui.channel.responses.Add([pscustomobject]@{cancelled=$false;value=$value});$script:gui.prompt=$null;$controls.AnswerBox.Clear();$controls.ContinueButton.IsEnabled=$false;$controls.CancelButton.IsEnabled=$false;$controls.ProgressBar.IsIndeterminate=$true;$controls.StatusText.Text='Выполняю выбранный шаг…'
  })
  $controls.FolderButton.Add_Click({$picker=New-Object Windows.Forms.FolderBrowserDialog;$picker.Description='Папка CastLink';$picker.SelectedPath=$controls.AnswerBox.Text;try{if($picker.ShowDialog() -eq [Windows.Forms.DialogResult]::OK){$controls.AnswerBox.Text=$picker.SelectedPath}}finally{$picker.Dispose()}})
  $controls.CancelButton.Add_Click({if($script:gui.prompt){$controls.PasswordBox.Clear();$script:gui.channel.responses.Add([pscustomobject]@{cancelled=$true;value=$null});$script:gui.prompt=$null;$controls.CancelButton.IsEnabled=$false;$controls.ContinueButton.IsEnabled=$false}})
  $controls.RetryButton.Add_Click({Start-SimpleGuiOperation})
  $controls.CloseButton.Add_Click({$window.Close()})
  $window.Add_Closing({param($sender,$event) if($script:gui.worker -and -not $script:gui.done){$event.Cancel=$true;[void][Windows.MessageBox]::Show('Мастер выполняет шаг. Дождись его завершения или отмени действие в вопросе мастера. Данные не будут удалены принудительным обрывом.','CastLink')}})
  $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(100)
  $timer.Add_Tick({
    if(-not $script:gui.channel){return}
    $message=$null
    while($script:gui.channel.messages.TryTake([ref]$message)){
      switch($message.kind){
        'log' {$script:gui.lines.Add([string]$message.text);if($script:gui.lines.Count -gt 250){$script:gui.lines.RemoveAt(0)};$controls.LogBox.Text=$script:gui.lines -join "`r`n";$controls.LogBox.ScrollToEnd()}
        'prompt' {Show-SimpleGuiInput $message}
        'progress' {if($message.completed -and $message.id -eq 74){$controls.DownloadText.Visibility='Collapsed';$controls.StatusText.Text='Загрузка завершена; продолжаю подготовку…';$controls.ProgressBar.IsIndeterminate=$true;break};$controls.StatusText.Text=$message.text;if($message.id -eq 74){$controls.StatusText.Text=$message.activity;$controls.DownloadText.Text=$message.text;$controls.DownloadText.Visibility='Visible'}else{$controls.DownloadText.Visibility='Collapsed'};$controls.ProgressBar.IsIndeterminate=($message.percent -lt 0);if($message.percent -ge 0){$controls.ProgressBar.Maximum=100;$controls.ProgressBar.Value=$message.percent}}
        'done' {
          $script:gui.done=$true;Close-SimpleGuiWorker $script:gui.worker;$script:gui.worker=$null;$controls.PasswordBox.Clear();$controls.ProgressBar.IsIndeterminate=$false;$controls.ContinueButton.IsEnabled=$false;$controls.CancelButton.IsEnabled=$false;$controls.CloseButton.Visibility='Visible';$controls.DownloadText.Visibility='Collapsed'
          foreach($name in @('AnswerBox','PasswordBox','ChoicePanel','FolderButton')){$controls[$name].Visibility='Collapsed'}
          $controls.PromptTitle.Text=$(if($message.cleanupPending){'Закрой мастер для завершения очистки файлов'}elseif($message.cancelled){'Действие отменено'}elseif($message.exitCode -ne 0){'Действие остановлено'}else{'Действие мастера завершено'})
          $controls.PromptBody.Text=$(if($message.cleanupPending){'Отдельный процесс продолжит очистку после закрытия окна. При отказе сохраняется отчёт; пока результат очистки не подтверждён.'}elseif($message.exitCode -ne 0){'Подробности показаны ниже. Сохранённые данные оставлены для продолжения.'}else{'Адрес сервера, дальнейшие действия и причины сохранения компонентов показаны в журнале.'})
          $controls.StatusText.Text=$controls.PromptTitle.Text
          if($message.exitCode -eq 0 -and -not $message.cleanupPending){
            $line=@($script:gui.lines|Where-Object{$_ -match '^\s*CastLink установлен: https://[^\s]+$'}|Select-Object -Last 1)
            if($line.Count){$script:gui.url=$line[0].Trim().Substring('CastLink установлен: '.Length);$controls.AnswerBox.Text=$script:gui.url;$controls.AnswerBox.IsReadOnly=$true;$controls.AnswerBox.Visibility='Visible';$controls.PromptBody.Text='Открой адрес или скопируй его. Создай комнату и задай пароль студии; гостевой пароль задаётся отдельно. Для LAN другим устройствам требуется доверие сертификату из переносимого комплекта.';$controls.ContinueButton.Content='Открыть CastLink';$controls.ContinueButton.IsEnabled=$true}
          }
          if(-not $message.cleanupPending -and ($message.exitCode -ne 0 -or $message.cancelled)){$controls.RetryButton.Visibility='Visible'}
          if($SmokeResult){$window.UpdateLayout();$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap ([int]$window.ActualWidth),([int]$window.ActualHeight),96,96,([Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($window);$png=New-Object Windows.Media.Imaging.PngBitmapEncoder;$png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$stream=[IO.File]::Create($SmokeResult+'.png');try{$png.Save($stream)}finally{$stream.Dispose()};[IO.File]::WriteAllText($SmokeResult+'.ui.json',([pscustomobject]@{width=$window.ActualWidth;height=$window.ActualHeight;exitCode=$message.exitCode;cleanupPending=$message.cleanupPending;retryVisible=($controls.RetryButton.Visibility -eq 'Visible');passwordEmpty=($controls.PasswordBox.SecurePassword.Length -eq 0)}|ConvertTo-Json));$window.Close()}
        }
      }
      $message=$null
    }
    if($SmokeResult -and $script:gui.prompt){
      if($script:gui.prompt.secure){$controls.PasswordBox.Password='fixture-memory-only'}elseif($script:gui.prompt.choices.Count){$controls.ChoicePanel.Children[0].IsChecked=$true}else{$controls.AnswerBox.Text='fixture'}
      $controls.ContinueButton.RaiseEvent((New-Object Windows.RoutedEventArgs ([Windows.Controls.Button]::ClickEvent)))
    }
  })
  $window.Add_ContentRendered({Start-SimpleGuiOperation;$timer.Start()})
  $null=$window.ShowDialog();$timer.Stop()
} catch {
  Add-Type -AssemblyName System.Windows.Forms
  [void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'CastLink Easy Setup')
  exit 1
}
