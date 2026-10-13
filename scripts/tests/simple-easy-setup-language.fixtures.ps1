param([string]$GuiPath,[string]$ProofFolder)
$ErrorActionPreference='Stop'
. $GuiPath -FunctionsOnly
$registry='HKCU:\Software\CastLink\EasySetup-Language-Test-'+[Guid]::NewGuid().ToString('N')
try{
  if((Get-SimpleGuiLanguage -PreferencePath $registry) -cne 'ru'){throw 'Fresh GUI language must default to Russian'}
  foreach($locale in @('ru','en','zh-CN')){
    if(-not(Set-SimpleGuiLanguage $locale -PreferencePath $registry) -or (Get-SimpleGuiLanguage -PreferencePath $registry) -cne $locale){throw 'Language preference did not persist'}
  }
  Set-ItemProperty -LiteralPath $registry -Name Language -Value 'invalid'
  if((Get-SimpleGuiLanguage -PreferencePath $registry) -cne 'ru'){throw 'Invalid preference did not fall back to Russian'}
  foreach($locale in @('en','zh-CN')){
    foreach($key in $script:SimpleGuiTranslations.Keys){
      if($key -match '[\u0400-\u04ff]' -and (ConvertTo-SimpleGuiText $key $locale) -match '[\u0400-\u04ff]'){throw ('Untranslated GUI catalog entry: '+$key)}
    }
    $path='D:\Мои серверы\原有安装\CastLink';$url='https://192.0.2.8/room?name=Комната'
    foreach($text in @($path,$url,'Мой собственный сервер — 原有安装')){if((ConvertTo-SimpleGuiText $text $locale) -cne $text){throw 'User data was translated'}}
    $folder=Get-SimpleGuiPrompt ('Папка установки ['+$path+']') $false
    if($folder.default -cne $path -or -not $folder.folder){throw 'Folder/default parsing changed'}
    $yes=Get-SimpleGuiPrompt 'Добавить сертификат? да/нет [да]' $false
    if($yes.default -cne 'да' -or $yes.choices[0].value -cne 'да' -or $yes.choices[1].value -cne 'нет'){throw 'Translated consent changed original responses'}
    $title=ConvertTo-SimpleGuiText $yes.title $locale
    if($title -match '[\u0400-\u04ff]'){throw 'Consent title was not translated'}
    $stage=ConvertTo-SimpleGuiText 'Этап 2/5 — Загрузка текущего выпуска' $locale
    if($stage -match '[\u0400-\u04ff]' -or $stage -notlike '*2/5*'){throw 'Stage translation lost counters'}
    $download=ConvertTo-SimpleGuiText '148.0 МБ / 306.0 МБ · 12.4 МБ/с' $locale
    if($download -match '[\u0400-\u04ff]' -or $download -notlike '*12.4*'){throw 'Download translation lost speed'}
    $remotePath='/opt/CastLink/Моя папка'
    $warning='Комнаты и настройки выбранной установки будут удалены без восстановления.'
    $context=Get-SimpleGuiContext @(('Выбран сервер 192.0.2.8:2222, папка '+$remotePath),$warning) $locale
    if($context -notlike ('*'+$remotePath+'*') -or $context -notlike '*192.0.2.8:2222*' -or -not $context.Contains((ConvertTo-SimpleGuiText $warning $locale))){throw 'Remote destructive confirmation lost selected target or irreversible warning'}
    $localContext=Get-SimpleGuiContext @(('Удаление CastLink: https://192.0.2.8, сервер: этот ПК, папка: '+$path),'Комнаты, записи и настройки этой установки будут удалены без восстановления. Собственные загрузки и неиспользуемые компоненты будут очищены; чужие и общие сохранятся.') $locale
    if($localContext -notlike ('*'+$path+'*') -or $localContext -like '*этот ПК*'){throw 'Local destructive confirmation lost target or translation'}
    $raw='Unrecognized diagnostic: '+$path
    if((Get-SimpleGuiContext @($raw) $locale) -notlike ('*'+$raw+'*')){throw 'Unknown context was hidden'}
    $ssh=ConvertTo-SimpleGuiText 'SSH 192.0.2.8:22 fingerprint SHA256:abc123. Trust this server? Type yes' $locale
    if($ssh -notlike '*192.0.2.8:22*SHA256:abc123*yes*'){throw 'SSH fingerprint or required yes token changed'}
  }
  if([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA'){throw 'Run language renderer with Windows PowerShell -STA'}
  Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
  $null=New-Item -ItemType Directory $ProofFolder -Force
  $reader=New-Object Xml.XmlNodeReader ([xml][IO.File]::ReadAllText((Join-Path (Split-Path $GuiPath -Parent) 'simple-easy-setup-window.xaml')))
  $window=[Windows.Markup.XamlReader]::Load($reader)
  $controls=@{}
  foreach($name in @('HeaderText','LanguageText','LanguageRuButton','LanguageEnButton','LanguageZhButton','DetailsExpander','StatusText','PromptTitle','PromptBody','ChoicePanel','AnswerBox','PasswordBox','ContinueButton','BackButton','CancelButton','RetryButton','CloseButton','FolderButton','LogBox','ProgressBar','DownloadText')){$controls[$name]=$window.FindName($name)}
  # Exercise the production renderer functions, without starting deployment workers.
  $tokens=$null;$errors=$null;$ast=[Management.Automation.Language.Parser]::ParseFile($GuiPath,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw ($errors|Out-String)}
  foreach($name in @('Set-SimpleGuiLabel','Update-SimpleGuiLanguage')){
    $definition=$ast.Find({param($node)$node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -ceq $name},$true)
    . ([scriptblock]::Create($definition.Extent.Text))
  }
  $prompt=Get-SimpleGuiPrompt 'Где установить CastLink? 1 — Локально; 2 — Внешний сервер' $false
  $script:gui=[pscustomobject]@{language='ru';textSources=@{};prompt=$prompt}
  $radio=New-Object Windows.Controls.RadioButton;$radio.Tag=$prompt.choices[0].value;$radio.Content=$prompt.choices[0].label;$radio.IsChecked=$true;$radio.Style=$window.FindResource('ChoiceRadioStyle')
  $null=$controls.ChoicePanel.Children.Add($radio);$controls.ChoicePanel.Visibility='Visible'
  $controls.AnswerBox.Visibility='Visible';$controls.AnswerBox.Text=$path
  $controls.PasswordBox.Visibility='Visible';$controls.PasswordBox.Password='fixture-memory-only'
  $controls.ContinueButton.IsEnabled=$true
  foreach($pair in @(@('HeaderText','Text','Мастер установки'),@('LanguageText','Text','Язык'),@('PromptTitle','Text',$prompt.title),@('PromptBody','Text','Пароль используется только в памяти и не сохраняется.'),@('StatusText','Text','Ожидаю твой выбор'),@('ContinueButton','Content','Продолжить'),@('CancelButton','Content','Отмена'),@('FolderButton','Content','Выбрать папку…'),@('DetailsExpander','Header','Подробности выполнения'))){Set-SimpleGuiLabel $pair[0] $pair[1] $pair[2]}
  $window.Show()
  foreach($locale in @('ru','en','zh-CN','ru')){
    Update-SimpleGuiLanguage $locale $false;$window.UpdateLayout()
    if($controls.AnswerBox.Text -cne $path -or $controls.PasswordBox.SecurePassword.Length -ne 19 -or -not $radio.IsChecked -or $radio.Tag -cne '1' -or $script:gui.prompt.title -cne $prompt.title){throw 'Changing GUI language reset an input, secure value, choice or original prompt'}
    if($locale -ne 'ru'){
      foreach($text in @($controls.HeaderText.Text,$controls.PromptTitle.Text,$controls.PromptBody.Text,$controls.StatusText.Text,$controls.ContinueButton.Content,$radio.Content)){if($text -match '[\u0400-\u04ff]'){throw 'Primary GUI field remained Russian'}}
    }
    $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap ([int]$window.ActualWidth),([int]$window.ActualHeight),96,96,([Windows.Media.PixelFormats]::Pbgra32);$bitmap.Render($window)
    $png=New-Object Windows.Media.Imaging.PngBitmapEncoder;$png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
    $stream=[IO.File]::Create((Join-Path $ProofFolder ('installer-language-'+$locale+'.png')));try{$png.Save($stream)}finally{$stream.Dispose()}
  }
  $controls.PasswordBox.Clear()
  Write-Output 'SIMPLE_GUI_LANGUAGE_PASS RU-default EN zh-CN registry preference consent values progress userdata secure input renderer'
}finally{if($window){$window.Close()};if(Test-Path -LiteralPath $registry){Remove-Item -LiteralPath $registry -Force}}
