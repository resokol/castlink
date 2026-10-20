param([string]$SourceRoot,[string]$ProofFolder)
$ErrorActionPreference='Stop'
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
. (Join-Path $SourceRoot 'simple-easy-setup-gui.ps1') -FunctionsOnly
function Assert-True([bool]$Value,[string]$Reason){if(-not $Value){throw $Reason}}
$p=Get-SimpleGuiPrompt 'Где установить CastLink? 1 — Локально; 2 — Внешний сервер [1]' $false
Assert-True ($p.title -ceq 'Где установить CastLink?') 'Choice alternatives must stay in controls, not repeat in task heading'
Assert-True ($p.choices.Count -eq 2 -and $p.default -ceq '1') 'Heading cleanup must preserve answer values/default'
foreach($action in @('install','update','remove')){
  foreach($target in @('local','remote')){
    $launch=Get-SimpleGuiLaunchOptions $action $target 'D:\Fixture'
    Assert-True ($launch.Action -ceq $action -and $launch.Target -ceq $target -and $launch.InstallFolder -ceq 'D:\Fixture') 'Entry selection must preserve exact existing worker arguments'
  }
}
foreach($locale in @('en','zh-CN')){
  $heading=Get-SimpleGuiPromptTitle $p $locale
  Assert-True ($heading -notmatch '[\u0400-\u04ff]' -and $heading -notmatch '1\s*[—-]') 'Translated task heading must retain dictionary lookup and omit answer alternatives'
}
$reader=New-Object Xml.XmlNodeReader ([xml][IO.File]::ReadAllText((Join-Path $SourceRoot 'simple-easy-setup-window.xaml')))
$wizard=[Windows.Markup.XamlReader]::Load($reader)
try{
  $wizard.Show();$wizard.UpdateLayout()
  $password=$wizard.FindName('PasswordBox');$password.Password='fixture-memory-only'
  foreach($theme in @('light','dark')){
    Set-SimpleGuiTheme $wizard $theme 'ru'
    $wizard.UpdateLayout()
    $expected=if($theme -ceq 'light'){'#FFF2F3F5'}else{'#FF111315'}
    Assert-True ($wizard.Background.Color.ToString() -ceq $expected) 'Wizard must apply actual theme resources'
    Assert-True ($password.SecurePassword.Length -eq 19) 'Theme change must not replace or clear the secure input'
    Assert-True ($wizard.FindName('ThemeButton').Content.Length -gt 0) 'Theme selector requires a visible action label'
    Assert-True ($wizard.FindName('ContinueButton').Background.Color.ToString() -ceq $(if($theme -ceq 'light'){'#FF245D43'}else{'#FFACD9BB'})) 'Primary action must follow theme'
  }
  $wizard.Width=760;$wizard.Height=560
  $wizard.FindName('PromptTitle').Text='SSH пароль'
  $wizard.FindName('PromptBody').Text='Пароль используется только в памяти и не сохраняется.'
  $password.Visibility='Visible';$wizard.FindName('ContinueButton').IsEnabled=$true
  $wizard.UpdateLayout()
  $scroll=$wizard.FindName('ContentScroll');$scroll.ScrollToEnd();$wizard.UpdateLayout()
  $button=$wizard.FindName('ContinueButton');$origin=$button.TranslatePoint((New-Object Windows.Point(0,0)),$scroll)
  Assert-True ($origin.Y -ge 0 -and $origin.Y+$button.ActualHeight -le $scroll.ActualHeight+1) 'Compact wizard must scroll to full action buttons'
  $password.Clear()
}finally{$wizard.Close()}
. (Join-Path $SourceRoot 'simple-easy-setup-control.ps1') -FunctionsOnly
foreach($locale in @('ru','en','zh-CN')){
  $panel=New-SimpleControlWindow $locale
  try{
    $panel.Show();$panel.UpdateLayout()
    $status=[pscustomobject]@{summary='CastLink доступен';url='https://192.0.2.40';docker='Linux containers готовы';https='Доступен по HTTPS';services=@([pscustomobject]@{name='web';state='running'});stopped=$false}
    Update-SimpleControlWindow $panel $status $locale
    foreach($theme in @('light','dark')){
      Set-SimpleControlTheme $panel $theme $locale;$panel.UpdateLayout()
      Assert-True ($panel.Background.Color.ToString() -ceq $(if($theme -ceq 'light'){'#FFF2F3F5'}else{'#FF111315'})) 'Panel must apply matching theme'
      Assert-True ($panel.FindName('Summary').Text -ceq (ConvertTo-SimpleControlText 'CastLink доступен' $locale)) 'Theme must retain real status'
      Assert-True ($panel.FindName('Open').IsEnabled -and $panel.FindName('Start').IsEnabled) 'Theme must retain service actions'
      if($locale -cne 'ru'){Assert-True ($panel.FindName('ThemeButton').Content -notmatch '[\u0400-\u04ff]') 'Theme action must translate'}
    }
  }finally{$panel.Close()}
}
Write-Output 'SIMPLE_APPROVED_NATIVE_UI_PASS heading answers theme SecureString compact actions locales'