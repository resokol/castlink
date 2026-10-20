param([string]$SourceRoot,[string]$ProofFolder)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
. (Join-Path $SourceRoot 'simple-easy-setup-gui.ps1') -FunctionsOnly
$null=New-Item -ItemType Directory $ProofFolder -Force
$records=New-Object 'Collections.Generic.List[object]'
function Save-NativeCapture($Window,[string]$Name){
  $Window.Content.Background=$Window.Background
  $Window.UpdateLayout();$null=$Window.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::ApplicationIdle)
  $content=$Window.Content
  $width=[int][Math]::Ceiling($content.ActualWidth);$height=[int][Math]::Ceiling($content.ActualHeight)
  $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap $width,$height,96,96,([Windows.Media.PixelFormats]::Pbgra32)
  $bitmap.Render($content);$encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder;$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
  $stream=[IO.File]::Create((Join-Path $ProofFolder ($Name+'.png')));try{$encoder.Save($stream)}finally{$stream.Dispose()}
  $records.Add([pscustomobject]@{name=$Name;clientWidth=$width;clientHeight=$height;windowWidth=$Window.Width;windowHeight=$Window.Height;theme=$Window.Resources['CastLinkTheme']})
}
$reader=New-Object Xml.XmlNodeReader ([xml][IO.File]::ReadAllText((Join-Path $SourceRoot 'simple-easy-setup-window.xaml')))
$window=[Windows.Markup.XamlReader]::Load($reader)
$iconStream=[IO.File]::OpenRead((Join-Path $SourceRoot 'simple-easy-setup-control.ico'))
try{$decoder=[Windows.Media.Imaging.BitmapDecoder]::Create($iconStream,[Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,[Windows.Media.Imaging.BitmapCacheOption]::OnLoad);$icon=@($decoder.Frames|Sort-Object PixelWidth -Descending)[0];$icon.Freeze()}finally{$iconStream.Dispose()}
$window.Icon=$icon;$window.FindName('BrandIcon').Source=$icon
$window.FindName('VersionText').Text='Версия 1.0.0-rc.3 · Сборка 1472cd'
try{
  $window.FindName('EntryPanel').Visibility='Visible';$window.FindName('TaskPanel').Visibility='Collapsed'
  Update-SimpleGuiEntryLanguage $window 'ru'
  $window.FindName('LanguageRuButton').Style=$window.FindResource('PrimaryButtonStyle')
  $window.Show()
  foreach($theme in @('dark','light')){Set-SimpleGuiTheme $window $theme 'ru';Save-NativeCapture $window ('native-entry-'+$theme)}
  Set-SimpleGuiTheme $window 'dark' 'ru';$window.Width=760;$window.Height=560
  Save-NativeCapture $window 'native-entry-compact'
  $window.Width=960;$window.Height=740
  $window.FindName('EntryPanel').Visibility='Collapsed';$window.FindName('TaskPanel').Visibility='Visible'
  $window.FindName('StatusText').Visibility='Collapsed';$window.FindName('ProgressBar').Visibility='Collapsed'
  $window.FindName('PromptTitle').Text='Папка установки'
  $window.FindName('PromptBody').Text='Укажите папку для выбранной установки CastLink.'
  $window.FindName('AnswerBox').Visibility='Visible';$window.FindName('AnswerBox').Text='D:\CastLink'
  $window.FindName('FolderButton').Visibility='Visible'
  $window.FindName('ContinueButton').IsEnabled=$true;$window.FindName('BackButton').Visibility='Visible'
  Save-NativeCapture $window 'native-folder-prompt'
  $window.FindName('AnswerBox').Visibility='Collapsed';$window.FindName('FolderButton').Visibility='Collapsed'
  $window.FindName('PromptTitle').Text='SSH пароль'
  $window.FindName('PromptBody').Text='Пароль используется только в памяти и не сохраняется.'
  $window.FindName('PasswordBox').Visibility='Visible';$window.FindName('PasswordBox').Password='fixture-memory-only'
  Save-NativeCapture $window 'native-secure-prompt'
  $window.FindName('PasswordBox').Clear();$window.FindName('PasswordBox').Visibility='Collapsed'
  $window.FindName('PromptTitle').Text='Загрузка текущего выпуска'
  $window.FindName('PromptBody').Text=''
  $window.FindName('StatusText').Visibility='Visible';$window.FindName('StatusText').Text='Этап 2 из 5 · Загрузка текущего выпуска'
  $window.FindName('ProgressBar').Visibility='Visible';$window.FindName('ProgressBar').IsIndeterminate=$true
  $window.FindName('ContinueButton').IsEnabled=$false;$window.FindName('CancelButton').IsEnabled=$false;$window.FindName('BackButton').Visibility='Collapsed'
  $window.FindName('LogBox').Text="Подготовка среды`r`nЗагрузка текущего выпуска"
  Save-NativeCapture $window 'native-progress'
  $window.FindName('StatusText').Visibility='Collapsed';$window.FindName('ProgressBar').Visibility='Collapsed'
  $window.FindName('PromptTitle').Text='Сервер готов'
  $window.FindName('PromptBody').Text='Откройте адрес сервера или скопируйте его.'
  $window.FindName('AnswerBox').Visibility='Visible';$window.FindName('AnswerBox').Text='https://192.0.2.40';$window.FindName('AnswerBox').IsReadOnly=$true
  $window.FindName('CopyButton').Visibility='Visible';$window.FindName('ContinueButton').Content='Открыть CastLink';$window.FindName('ContinueButton').IsEnabled=$true;$window.FindName('CancelButton').Visibility='Collapsed';$window.FindName('CloseButton').Visibility='Visible'
  Save-NativeCapture $window 'native-success'
  $window.FindName('PromptTitle').Text='Действие остановлено'
  $window.FindName('PromptBody').Text='Соединение с сервером загрузки прервалось. Проверьте подключение и повторите попытку.'
  $window.FindName('AnswerBox').Visibility='Collapsed';$window.FindName('CopyButton').Visibility='Collapsed';$window.FindName('ContinueButton').Visibility='Collapsed';$window.FindName('RetryButton').Visibility='Visible'
  $window.FindName('LogBox').Text='Ошибка подключения к серверу загрузки';$window.FindName('DetailsExpander').IsExpanded=$true
  Save-NativeCapture $window 'native-recoverable-error'
}finally{$window.Close()}
. (Join-Path $SourceRoot 'simple-easy-setup-control.ps1') -FunctionsOnly
$panel=New-SimpleControlWindow 'ru'
try{
  $panel.Show()
  $status=[pscustomobject]@{summary='CastLink доступен';url='https://192.0.2.40';docker='Linux containers готовы';https='Доступен по HTTPS';services=@('postgres','web','livekit','caddy','presentation-converter'|ForEach-Object{[pscustomobject]@{name=$_;state='running'}});stopped=$false}
  Update-SimpleControlWindow $panel $status 'ru'
  foreach($theme in @('dark','light')){Set-SimpleControlTheme $panel $theme 'ru';Save-NativeCapture $panel ('native-control-'+$theme)}
  Set-SimpleControlTheme $panel 'dark' 'ru';$panel.Width=760;$panel.Height=560
  Save-NativeCapture $panel 'native-control-compact'
  $panel.Height=740;$panel.FindName('ServicesDetails').IsExpanded=$true
  Save-NativeCapture $panel 'native-control-services'
}finally{$panel.Close()}
[IO.File]::WriteAllText((Join-Path $ProofFolder 'native-captures.json'),([pscustomobject]@{kind='actual-production-WPF-content';data='fixture-only, no installation or container operations';captures=$records.ToArray()}|ConvertTo-Json -Depth 5))
Write-Output 'SIMPLE_NATIVE_UI_CAPTURES_PASS actual WPF client-content renders'