param([string]$InstallFolder='', [switch]$FunctionsOnly, [string]$SmokeResult='', [ValidateSet('ru','en','zh-CN')][string]$Language='ru')
$ErrorActionPreference='Stop'
. (Join-Path $PSScriptRoot 'simple-easy-setup-language.ps1')
function New-SimpleGuiChannel {
  return [pscustomobject]@{messages=(New-Object 'Collections.Concurrent.BlockingCollection[object]');responses=(New-Object 'Collections.Concurrent.BlockingCollection[object]')}
}
function Get-SimpleGuiTrustWarning([string[]]$Lines) {
  $warning=@($Lines|Where-Object{$_ -like 'Сервер готов, но доверие HTTPS не установлено.*'}|Select-Object -Last 1)
  if($warning.Count){return [string]$warning[0]};return ''
}
function Hide-SimpleGuiInput([hashtable]$Controls) {
  foreach($name in @('AnswerBox','PasswordBox','ChoicePanel','FolderButton','BackButton')){$Controls[$name].Visibility='Collapsed';$Controls[$name].IsEnabled=$false}
}
function Start-SimpleGuiWorker([string]$Entry,[hashtable]$Options,[object]$Channel) {
  $runspace=[RunspaceFactory]::CreateRunspace();$runspace.ApartmentState='STA';$runspace.ThreadOptions='ReuseThread';$runspace.Open()
  $ps=[PowerShell]::Create();$ps.Runspace=$runspace
  $source=@'
param($Entry,$Options,$Messages,$Responses)
$global:SimpleGuiMessages=$Messages;$global:SimpleGuiResponses=$Responses
$global:SimpleGuiCancelled=$false;$global:SimpleCleanupScheduled=$false
$global:SimpleGuiControlFolder=''
$global:SimpleGuiHistory=New-Object 'Collections.Generic.List[object]'
$global:SimpleGuiReplay=@();$global:SimpleGuiReplayIndex=0
function global:Read-Host {
  param([string]$Prompt,[switch]$AsSecureString)
  if($global:SimpleGuiCanGoBack -and $global:SimpleGuiReplayIndex -lt $global:SimpleGuiReplay.Count){
    $old=$global:SimpleGuiReplay[$global:SimpleGuiReplayIndex]
    if($old.text -ceq $Prompt -and -not $AsSecureString){$global:SimpleGuiReplayIndex++;$global:SimpleGuiHistory.Add($old);return $old.value}
    $global:SimpleGuiReplay=@()
  }
  $canBack=$global:SimpleGuiCanGoBack -and $global:SimpleGuiHistory.Count -gt 0 -and -not $AsSecureString
  $global:SimpleGuiMessages.Add([pscustomobject]@{kind='prompt';text=$Prompt;secure=[bool]$AsSecureString;canBack=$canBack})
  $answer=$global:SimpleGuiResponses.Take()
  if($answer.back){
    if(-not $canBack){throw 'Возврат недоступен после начала выполнения.'}
    $global:SimpleGuiReplay=@($global:SimpleGuiHistory.ToArray()|Select-Object -First ($global:SimpleGuiHistory.Count-1))
    $global:SimpleGuiBackRequested=$true
    throw [OperationCanceledException]::new('Возврат к предыдущему вопросу.')
  }
  if($answer.cancelled){$global:SimpleGuiCancelled=$true;throw [OperationCanceledException]::new('Действие отменено. Сохранённые данные оставлены для продолжения.')}
  if($global:SimpleGuiCanGoBack -and -not $AsSecureString){$global:SimpleGuiHistory.Add([pscustomobject]@{text=$Prompt;value=$answer.value})}
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
do {
  $global:SimpleGuiControlFolder=''
  $global:SimpleGuiBackRequested=$false;$global:SimpleGuiCanGoBack=$true
  $global:SimpleGuiHistory.Clear();$global:SimpleGuiReplayIndex=0
  try { $global:LASTEXITCODE=0;& $Entry @Options;$code=$global:LASTEXITCODE }
  catch { if(-not $global:SimpleGuiBackRequested){$code=1;$Messages.Add([pscustomobject]@{kind='log';text=$_.Exception.Message})} }
} while($global:SimpleGuiBackRequested)
$Messages.Add([pscustomobject]@{kind='done';exitCode=$code;restartRequired=($code -eq 3010);cancelled=$global:SimpleGuiCancelled;cleanupPending=$global:SimpleCleanupScheduled;controlFolder=[string]$global:SimpleGuiControlFolder})
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
  if($title -match 'да/нет' -or $default -eq 'да/нет'){if($default -ne 'да'){$default='нет'};$choices=@([pscustomobject]@{value='да';label='Да'},[pscustomobject]@{value='нет';label='Нет'})}
  return [pscustomobject]@{title=$title;default=$default;secure=$Secure;choices=$choices;folder=($title -like 'Папка*');file=($title -eq 'Файл приватного SSH ключа');saveFile=($title -eq 'Сохранить новый приватный SSH ключ')}
}
function Get-SimpleGuiFinishAction([object]$Message,[string[]]$Lines=@()) {
  $action=[pscustomobject]@{kind='none';folder='';url='';error=''}
  if($Message.exitCode -ne 0 -or $Message.cleanupPending -or $Message.cancelled){return $action}
  $line=@($Lines|Where-Object{$_ -match '^\s*CastLink установлен: https://[^\s]+$'}|Select-Object -Last 1)
  if($line.Count){$action.url=$line[0].Trim().Substring('CastLink установлен: '.Length)}
  if($Message.controlFolder){
    try{
      $folder=[IO.Path]::GetFullPath([string]$Message.controlFolder)
      $state=Get-Content -LiteralPath (Join-Path $folder '.castlink-install.json') -Encoding UTF8 -Raw|ConvertFrom-Json
      $receipt=Get-Content -LiteralPath (Join-Path $folder '.castlink-owned.json') -Encoding UTF8 -Raw|ConvertFrom-Json
      $relative='.castlink-control/simple-easy-setup-control.ps1';$helper=Join-Path $folder $relative
      $entry=@($receipt.files|Where-Object{$_.path.Replace('\','/') -ceq $relative})
      if($state.target -cne 'local' -or -not $state.completed -or $receipt.schemaVersion -ne 1 -or $receipt.folder -cne $folder -or -not $state.installationId -or $receipt.installationId -cne $state.installationId -or $entry.Count -ne 1 -or (Get-FileHash -LiteralPath $helper -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry[0].sha256){throw 'Invalid local panel result'}
      $action.kind='panel';$action.folder=$folder
    }catch{$action.error='Не удалось проверить панель этой установки. Открой её через ярлык CastLink или проверь сохранённую папку.'}
    return $action
  }
  if($action.url){$action.kind='url'}
  return $action
}
function Start-SimpleGuiPanel([string]$Folder) {
  $action=Get-SimpleGuiFinishAction ([pscustomobject]@{exitCode=0;cancelled=$false;cleanupPending=$false;controlFolder=$Folder})
  if($action.kind -cne 'panel'){throw $action.error}
  $info=New-Object Diagnostics.ProcessStartInfo
  $info.FileName=Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe'
  $arguments=@('-NoProfile','-NonInteractive','-STA','-WindowStyle','Hidden','-ExecutionPolicy','Bypass','-File',(Join-Path $action.folder '.castlink-control/simple-easy-setup-control.ps1'),'-ControlFolder',$action.folder)
  $info.Arguments=($arguments|ForEach-Object{'"'+[regex]::Replace([regex]::Replace($_,'(\\*)"','$1$1\"'),'(\\+)$','$1$1')+'"'}) -join ' '
  $info.UseShellExecute=$false;$info.CreateNoWindow=$true
  $process=[Diagnostics.Process]::Start($info);$process.Dispose()
}
if($FunctionsOnly){return}
try {
  Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase,System.Windows.Forms
  $reader=New-Object Xml.XmlNodeReader ([xml][IO.File]::ReadAllText((Join-Path $PSScriptRoot 'simple-easy-setup-window.xaml')))
  $window=[Windows.Markup.XamlReader]::Load($reader)
  $controls=@{};foreach($name in @('HeaderText','StatusText','PromptTitle','PromptBody','ChoicePanel','AnswerBox','PasswordBox','FolderButton','ContinueButton','CancelButton','ProgressBar','DownloadText','LogBox','RetryButton','CloseButton','BackButton','LanguageText','LanguageRuButton','LanguageEnButton','LanguageZhButton','DetailsExpander')){$controls[$name]=$window.FindName($name)}
  $area=[Windows.SystemParameters]::WorkArea;$window.MinWidth=[Math]::Min($window.MinWidth,$area.Width);$window.MinHeight=[Math]::Min($window.MinHeight,$area.Height);$window.Width=[Math]::Min($window.Width,$area.Width);$window.Height=[Math]::Min($window.Height,$area.Height)
  $script:gui=[pscustomobject]@{language=$(if($PSBoundParameters.ContainsKey('Language')){$Language}else{Get-SimpleGuiLanguage});textSources=@{};started=$false;worker=$null;prompt=$null;channel=$null;done=$false;finishAction=$null;lines=(New-Object 'Collections.Generic.List[string]');url='';busyInputsHidden=$false;smokeBackUsed=$false}
  function Set-SimpleGuiLabel([string]$Name,[string]$Property,[string]$Source) {
    $script:gui.textSources[$Name+'|'+$Property]=$Source
    if($Name -eq 'PromptBody'){$text=Get-SimpleGuiContext ($Source -split '\r?\n') $script:gui.language}
    else{$text=ConvertTo-SimpleGuiText $Source $script:gui.language}
    $controls[$Name].$Property=$text
  }
  function Update-SimpleGuiLanguage([string]$Locale,[bool]$Persist=$true) {
    $script:gui.language=$Locale
    if($Persist){$null=Set-SimpleGuiLanguage $Locale}
    foreach($key in @($script:gui.textSources.Keys)){
      $parts=$key.Split('|');Set-SimpleGuiLabel $parts[0] $parts[1] $script:gui.textSources[$key]
    }
    if($script:gui.prompt){
      foreach($radio in $controls.ChoicePanel.Children){
        $choice=@($script:gui.prompt.choices|Where-Object{$_.value -ceq $radio.Tag})
        if($choice.Count){$radio.Content=ConvertTo-SimpleGuiText $choice[0].label $Locale}
      }
    }
    foreach($pair in @(@('LanguageRuButton','ru'),@('LanguageEnButton','en'),@('LanguageZhButton','zh-CN'))){
      $controls[$pair[0]].Style=$window.FindResource($(if($Locale -ceq $pair[1]){'PrimaryButtonStyle'}else{'SecondaryButtonStyle'}))
      [Windows.Automation.AutomationProperties]::SetHelpText($controls[$pair[0]],$(if($Locale -ceq $pair[1]){Get-SimpleGuiText 'Выбранный язык' $Locale}else{''}))
    }
    foreach($pair in @(@('AnswerBox','Ответ на вопрос мастера'),@('PasswordBox','Пароль'),@('LogBox','Журнал выполнения'),@('ProgressBar','Ход выполнения'))){
      [Windows.Automation.AutomationProperties]::SetName($controls[$pair[0]],(Get-SimpleGuiText $pair[1] $Locale))
    }
  }
  foreach($pair in @(@('HeaderText','Text','Мастер установки'),@('LanguageText','Text','Язык'),@('DetailsExpander','Header','Подробности выполнения'),@('FolderButton','Content','Выбрать папку…'),@('BackButton','Content','Назад'),@('CancelButton','Content','Отмена'),@('RetryButton','Content','Повторить'),@('CloseButton','Content','Закрыть'),@('ContinueButton','Content','Начать'),@('StatusText','Text','Выбери язык и начни установку'),@('PromptTitle','Text','Добро пожаловать в CastLink'),@('PromptBody','Text','Выбери язык интерфейса и нажми «Начать». Мастер поможет установить, обновить или удалить CastLink.'))){Set-SimpleGuiLabel $pair[0] $pair[1] $pair[2]}
  $controls.ContinueButton.IsEnabled=$true;$controls.ProgressBar.IsIndeterminate=$false
  Update-SimpleGuiLanguage $script:gui.language $false
  $controls.LanguageRuButton.Add_Click({Update-SimpleGuiLanguage 'ru'})
  $controls.LanguageEnButton.Add_Click({Update-SimpleGuiLanguage 'en'})
  $controls.LanguageZhButton.Add_Click({Update-SimpleGuiLanguage 'zh-CN'})
  function Show-SimpleGuiInput($Message) {
    $script:gui.prompt=Get-SimpleGuiPrompt $Message.text $Message.secure $script:gui.lines.ToArray()
    $p=$script:gui.prompt;Set-SimpleGuiLabel 'PromptTitle' 'Text' $p.title
    $context=(@($script:gui.lines|Select-Object -Last 5) -join "`n")
    Set-SimpleGuiLabel 'PromptBody' 'Text' ($context+$(if($p.secure){"`nПароль используется только в памяти и не сохраняется."}else{''}))
    Hide-SimpleGuiInput $controls
    foreach($name in @('AnswerBox','PasswordBox','ChoicePanel','FolderButton')){$controls[$name].IsEnabled=$true}
    $controls.ChoicePanel.Children.Clear();$controls.AnswerBox.Text=$p.default;$controls.PasswordBox.Clear()
    if($p.secure){$controls.PasswordBox.Visibility='Visible';$null=$controls.PasswordBox.Focus()}
    elseif($p.choices.Count){$controls.ChoicePanel.Visibility='Visible';foreach($choice in $p.choices){$radio=New-Object Windows.Controls.RadioButton;$radio.Content=ConvertTo-SimpleGuiText $choice.label $script:gui.language;$radio.Tag=$choice.value;$radio.Style=$window.FindResource('ChoiceRadioStyle');$radio.IsChecked=($choice.value -ceq $p.default);$null=$controls.ChoicePanel.Children.Add($radio)}}
    else{$controls.AnswerBox.Visibility='Visible';$null=$controls.AnswerBox.Focus();if($p.folder -or $p.file -or $p.saveFile){Set-SimpleGuiLabel 'FolderButton' 'Content' $(if($p.saveFile){'Сохранить ключ…'}elseif($p.file){'Выбрать файл…'}else{'Выбрать папку…'});$controls.FolderButton.Visibility='Visible'}}
    $controls.BackButton.Visibility=$(if($Message.canBack){'Visible'}else{'Collapsed'});$controls.BackButton.IsEnabled=[bool]$Message.canBack
    $controls.ContinueButton.IsEnabled=$true;$controls.CancelButton.IsEnabled=$true;$controls.ProgressBar.IsIndeterminate=$false;Set-SimpleGuiLabel 'StatusText' 'Text' 'Ожидаю твой выбор'
    if($SmokeResult -and $p.choices.Count){$window.UpdateLayout();$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap ([int]$window.ActualWidth),([int]$window.ActualHeight),96,96,([Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($window);$png=New-Object Windows.Media.Imaging.PngBitmapEncoder;$png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$stream=[IO.File]::Create($SmokeResult+'.choices.png');try{$png.Save($stream)}finally{$stream.Dispose()}}
  }
  function Start-SimpleGuiOperation {
    $script:gui.started=$true
    Hide-SimpleGuiInput $controls
    $script:gui.done=$false;$script:gui.prompt=$null;$script:gui.url='';$script:gui.finishAction=$null;$script:gui.lines.Clear();$controls.LogBox.Clear();$controls.RetryButton.Visibility='Collapsed';$controls.CloseButton.Visibility='Collapsed';Set-SimpleGuiLabel 'ContinueButton' 'Content' 'Продолжить';$controls.AnswerBox.IsReadOnly=$false
    $controls.ContinueButton.IsEnabled=$false;$controls.CancelButton.IsEnabled=$false;$controls.ProgressBar.IsIndeterminate=$true;$controls.ProgressBar.Value=0;Set-SimpleGuiLabel 'StatusText' 'Text' 'Подготавливаю мастер…'
    $script:gui.channel=New-SimpleGuiChannel
    $entry=Join-Path $PSScriptRoot 'windows-simple-easy-setup.ps1';$options=@{}
    if($InstallFolder){$options.InstallFolder=$InstallFolder}
    if($SmokeResult){$entry=Join-Path $PSScriptRoot 'simple-easy-setup-gui-smoke.ps1';$options.Result=$SmokeResult}
    $script:gui.worker=Start-SimpleGuiWorker $entry $options $script:gui.channel
  }
  $controls.ContinueButton.Add_Click({
    if(-not $script:gui.started){Start-SimpleGuiOperation;return}
    if($script:gui.done -and $script:gui.finishAction -and $script:gui.finishAction.kind -ceq 'panel'){
      try{Start-SimpleGuiPanel $script:gui.finishAction.folder}catch{[void][Windows.MessageBox]::Show((Get-SimpleGuiText 'Не удалось открыть панель CastLink. Проверь сохранённую папку установки и повтори попытку.' $script:gui.language),'CastLink')};return
    }
    if($script:gui.done -and $script:gui.url){Start-Process $script:gui.url;return}
    if(-not $script:gui.prompt){return}
    $p=$script:gui.prompt
    if($p.secure){$value=$controls.PasswordBox.SecurePassword.Copy();$controls.PasswordBox.Clear()}
    elseif($p.choices.Count){$selected=@($controls.ChoicePanel.Children|Where-Object{$_.IsChecked});if(-not $selected.Count){return};$value=[string]$selected[0].Tag}
    else{$value=$controls.AnswerBox.Text}
    $script:gui.channel.responses.Add([pscustomobject]@{cancelled=$false;value=$value});$script:gui.prompt=$null;Hide-SimpleGuiInput $controls;$controls.AnswerBox.Clear();$controls.ContinueButton.IsEnabled=$false;$controls.CancelButton.IsEnabled=$false;$controls.ProgressBar.IsIndeterminate=$true;Set-SimpleGuiLabel 'StatusText' 'Text' 'Выполняю выбранный шаг…'
  })
  $controls.BackButton.Add_Click({if($script:gui.prompt -and $controls.BackButton.IsEnabled){$script:gui.channel.responses.Add([pscustomobject]@{back=$true});$script:gui.prompt=$null;Hide-SimpleGuiInput $controls;$controls.ContinueButton.IsEnabled=$false;$controls.CancelButton.IsEnabled=$false}})
  $controls.FolderButton.Add_Click({
    $p=$script:gui.prompt
    if($p.file -or $p.saveFile){
      $picker=if($p.saveFile){New-Object Windows.Forms.SaveFileDialog}else{New-Object Windows.Forms.OpenFileDialog}
      $picker.Title=Get-SimpleGuiText $p.title $script:gui.language;$picker.Filter=Get-SimpleGuiText 'Все файлы|*.*' $script:gui.language;$picker.FileName=$controls.AnswerBox.Text
      if($p.saveFile){$picker.OverwritePrompt=$true}else{$picker.CheckFileExists=$true;$picker.Multiselect=$false}
      try{if($picker.ShowDialog() -eq [Windows.Forms.DialogResult]::OK){$controls.AnswerBox.Text=$picker.FileName}}finally{$picker.Dispose()}
    }else{
      $picker=New-Object Windows.Forms.FolderBrowserDialog;$picker.Description=Get-SimpleGuiText 'Папка CastLink' $script:gui.language;$picker.SelectedPath=$controls.AnswerBox.Text
      try{if($picker.ShowDialog() -eq [Windows.Forms.DialogResult]::OK){$controls.AnswerBox.Text=$picker.SelectedPath}}finally{$picker.Dispose()}
    }
  })
  $controls.CancelButton.Add_Click({if(-not $script:gui.started){$window.Close();return};if($script:gui.prompt){$controls.PasswordBox.Clear();$script:gui.channel.responses.Add([pscustomobject]@{cancelled=$true;value=$null});$script:gui.prompt=$null;Hide-SimpleGuiInput $controls;$controls.CancelButton.IsEnabled=$false;$controls.ContinueButton.IsEnabled=$false}})
  $controls.RetryButton.Add_Click({Start-SimpleGuiOperation})
  $controls.CloseButton.Add_Click({$window.Close()})
  $window.Add_Closing({param($sender,$event) if($script:gui.worker -and -not $script:gui.done){$event.Cancel=$true;[void][Windows.MessageBox]::Show((Get-SimpleGuiText 'Мастер выполняет шаг. Дождись его завершения или отмени действие в вопросе мастера. Данные не будут удалены принудительным обрывом.' $script:gui.language),'CastLink')}})
  $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(100)
  $timer.Add_Tick({
    if(-not $script:gui.channel){return}
    $message=$null
    while($script:gui.channel.messages.TryTake([ref]$message)){
      switch($message.kind){
        'log' {$script:gui.lines.Add([string]$message.text);if($script:gui.lines.Count -gt 250){$script:gui.lines.RemoveAt(0)};$controls.LogBox.Text=$script:gui.lines -join "`r`n";$controls.LogBox.ScrollToEnd()}
        'prompt' {Show-SimpleGuiInput $message}
        'foreground' {try{$null=$window.Activate();$window.Focus()|Out-Null}finally{$null=$message.ack.Set()}}
        'progress' {if(-not $script:gui.prompt){Hide-SimpleGuiInput $controls;$script:gui.busyInputsHidden=$true};if($message.completed -and $message.id -eq 74){$controls.DownloadText.Visibility='Collapsed';Set-SimpleGuiLabel 'StatusText' 'Text' 'Возвращаюсь к этапам мастера…';$controls.ProgressBar.IsIndeterminate=$true;break};Set-SimpleGuiLabel 'StatusText' 'Text' $message.text;if($message.id -eq 74){Set-SimpleGuiLabel 'StatusText' 'Text' $message.activity;Set-SimpleGuiLabel 'DownloadText' 'Text' $message.text;$controls.DownloadText.Visibility='Visible'}else{$controls.DownloadText.Visibility='Collapsed'};$controls.ProgressBar.IsIndeterminate=($message.percent -lt 0);if($message.percent -ge 0){$controls.ProgressBar.Maximum=100;$controls.ProgressBar.Value=$message.percent}
          if($SmokeResult -and $message.text -like '*Fixture download:*'){$window.UpdateLayout();$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap ([int]$window.ActualWidth),([int]$window.ActualHeight),96,96,([Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($window);$png=New-Object Windows.Media.Imaging.PngBitmapEncoder;$png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$stream=[IO.File]::Create($SmokeResult+'.busy.png');try{$png.Save($stream)}finally{$stream.Dispose()}}
        }
        'done' {
          $script:gui.done=$true;Close-SimpleGuiWorker $script:gui.worker;$script:gui.worker=$null;$controls.PasswordBox.Clear();$controls.ProgressBar.IsIndeterminate=$false;$controls.ContinueButton.IsEnabled=$false;$controls.CancelButton.IsEnabled=$false;$controls.CloseButton.Visibility='Visible';$controls.DownloadText.Visibility='Collapsed'
          Hide-SimpleGuiInput $controls
          Set-SimpleGuiLabel 'PromptTitle' 'Text' $(if($message.cleanupPending){'Закрой мастер для завершения очистки файлов'}elseif($message.cancelled){'Действие отменено'}elseif($message.restartRequired){'Нужна перезагрузка Windows'}elseif($message.exitCode -ne 0){'Действие остановлено'}else{'Действие мастера завершено'})
          Set-SimpleGuiLabel 'PromptBody' 'Text' $(if($message.cleanupPending){'Отдельный процесс продолжит очистку после закрытия окна. При отказе сохраняется отчёт; пока результат очистки не подтверждён.'}elseif($message.cancelled){'Действие отменено на вопросе мастера. Сохранённые данные оставлены для продолжения.'}elseif($message.exitCode -ne 0){(@($script:gui.lines|Select-Object -Last 3) -join "`n")}else{'Адрес сервера, дальнейшие действия и причины сохранения компонентов показаны в журнале.'})
          Set-SimpleGuiLabel 'StatusText' 'Text' $script:gui.textSources['PromptTitle|Text']
          if($message.exitCode -eq 0 -and -not $message.cleanupPending){
            $script:gui.finishAction=Get-SimpleGuiFinishAction $message $script:gui.lines.ToArray()
            $action=$script:gui.finishAction
            if($action.error){Set-SimpleGuiLabel 'PromptBody' 'Text' $action.error}
            elseif($action.kind -in @('panel','url')){
              if($action.url){$controls.AnswerBox.Text=$action.url;$controls.AnswerBox.IsReadOnly=$true;$controls.AnswerBox.IsEnabled=$true;$controls.AnswerBox.Visibility='Visible'}
              if($action.kind -ceq 'panel'){
                Set-SimpleGuiLabel 'PromptTitle' 'Text' 'Установка завершена; службы остановлены'
                Set-SimpleGuiLabel 'PromptBody' 'Text' 'Открой панель CastLink, чтобы запустить службы. Скрытие панели в трей сохраняет их работу; закрытие панели останавливает службы и сохраняет данные. Адрес сервера можно скопировать ниже.'
                Set-SimpleGuiLabel 'ContinueButton' 'Content' 'Открыть панель CastLink'
              }else{
                $script:gui.url=$action.url
                Set-SimpleGuiLabel 'PromptBody' 'Text' 'Открой адрес или скопируй его. Создай комнату и задай пароль студии; гостевой пароль задаётся отдельно. Для LAN другим устройствам требуется доверие сертификату из переносимого комплекта.'
                Set-SimpleGuiLabel 'ContinueButton' 'Content' 'Открыть CastLink'
              }
              $controls.ContinueButton.IsEnabled=$true
              $warning=Get-SimpleGuiTrustWarning $script:gui.lines.ToArray()
              if($warning){
                Set-SimpleGuiLabel 'PromptBody' 'Text' ($warning+"`n`n"+$script:gui.textSources['PromptBody|Text'])
                Set-SimpleGuiLabel 'PromptTitle' 'Text' $(if($action.kind -ceq 'panel'){'Установка завершена; сертификат HTTPS не доверен'}else{'Сервер готов; доверие HTTPS не установлено'})
              }
              Set-SimpleGuiLabel 'StatusText' 'Text' $script:gui.textSources['PromptTitle|Text']
            }
          }
          if(-not $message.cleanupPending -and ($message.exitCode -ne 0 -or $message.cancelled)){$controls.RetryButton.Visibility='Visible'}
          if($SmokeResult){$window.UpdateLayout();$bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap ([int]$window.ActualWidth),([int]$window.ActualHeight),96,96,([Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($window);$png=New-Object Windows.Media.Imaging.PngBitmapEncoder;$png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap));$stream=[IO.File]::Create($SmokeResult+'.png');try{$png.Save($stream)}finally{$stream.Dispose()};[IO.File]::WriteAllText($SmokeResult+'.ui.json',([pscustomobject]@{width=$window.ActualWidth;height=$window.ActualHeight;exitCode=$message.exitCode;cleanupPending=$message.cleanupPending;retryVisible=($controls.RetryButton.Visibility -eq 'Visible');passwordEmpty=($controls.PasswordBox.SecurePassword.Length -eq 0);busyInputsHidden=$script:gui.busyInputsHidden;backUsed=$script:gui.smokeBackUsed;finishKind=$(if($script:gui.finishAction){$script:gui.finishAction.kind}else{'none'});language=$script:gui.language;trustWarningVisible=([bool](Get-SimpleGuiTrustWarning $script:gui.lines.ToArray()))}|ConvertTo-Json));$window.Close()}
        }
      }
      $message=$null
    }
    if($SmokeResult -and $script:gui.prompt){
      if($script:gui.prompt.folder -and -not $script:gui.smokeBackUsed -and $controls.BackButton.IsEnabled){$script:gui.smokeBackUsed=$true;$controls.BackButton.RaiseEvent((New-Object Windows.RoutedEventArgs ([Windows.Controls.Button]::ClickEvent)));return}
      if($script:gui.prompt.secure){$controls.PasswordBox.Password='fixture-memory-only'}elseif($script:gui.prompt.choices.Count){$controls.ChoicePanel.Children[0].IsChecked=$true}else{$controls.AnswerBox.Text='fixture'}
      $controls.ContinueButton.RaiseEvent((New-Object Windows.RoutedEventArgs ([Windows.Controls.Button]::ClickEvent)))
    }
  })
  $window.Add_ContentRendered({if($SmokeResult){Start-SimpleGuiOperation};$timer.Start()})
  $null=$window.ShowDialog();$timer.Stop()
} catch {
  Add-Type -AssemblyName System.Windows.Forms
  [void][Windows.Forms.MessageBox]::Show($_.Exception.Message,'CastLink Easy Setup')
  exit 1
}
