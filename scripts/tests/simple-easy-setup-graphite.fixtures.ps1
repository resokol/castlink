param([string]$XamlPath,[string]$ProofFolder)
$ErrorActionPreference='Stop'
if([Threading.Thread]::CurrentThread.ApartmentState -ne 'STA'){throw 'Run with Windows PowerShell -STA'}
Add-Type -AssemblyName PresentationFramework,PresentationCore,WindowsBase
$null=New-Item -ItemType Directory $ProofFolder -Force
$reader=New-Object Xml.XmlNodeReader ([xml][IO.File]::ReadAllText($XamlPath))
$window=[Windows.Markup.XamlReader]::Load($reader)
function Assert-Color($Brush,[string]$Expected,[string]$Label){
  if($Brush.Color.ToString() -cne $Expected){throw ($Label+' color: '+$Brush.Color.ToString()+' expected '+$Expected)}
}
function Get-Luminance($Color){
  $channels=@($Color.R,$Color.G,$Color.B)|ForEach-Object{$v=$_/255.0;if($v -le 0.04045){$v/12.92}else{[Math]::Pow(($v+0.055)/1.055,2.4)}}
  return 0.2126*$channels[0]+0.7152*$channels[1]+0.0722*$channels[2]
}
function Assert-Contrast($Foreground,$Background,[double]$Minimum,[string]$Label){
  $a=Get-Luminance $Foreground.Color;$b=Get-Luminance $Background.Color
  $ratio=([Math]::Max($a,$b)+0.05)/([Math]::Min($a,$b)+0.05)
  if($ratio -lt $Minimum){throw ($Label+' contrast: '+$ratio)}
}
function Render-State([string]$Name){
  $window.UpdateLayout()
  $null=$window.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::Render)
  $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap ([int]$window.ActualWidth),([int]$window.ActualHeight),96,96,([Windows.Media.PixelFormats]::Pbgra32)
  $bitmap.Render($window)
  $png=New-Object Windows.Media.Imaging.PngBitmapEncoder
  $png.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
  $stream=[IO.File]::Create((Join-Path $ProofFolder ($Name+'.png')))
  try{$png.Save($stream)}finally{$stream.Dispose()}
}
try{
  Assert-Color $window.Background '#FF111315' 'window'
  foreach($name in @('HeaderText','StatusText','PromptTitle','PromptBody','ChoicePanel','AnswerBox','PasswordBox','FolderButton','ContinueButton','CancelButton','ProgressBar','DownloadText','LogBox','RetryButton','CloseButton','BackButton')){
    if(-not $window.FindName($name)){throw ('Missing installer control '+$name)}
  }
  Assert-Contrast $window.Foreground ($window.FindResource('PanelBrush')) 4.5 'panel text'
  Assert-Contrast ($window.FindResource('MutedBrush')) ($window.FindResource('PanelBrush')) 4.5 'secondary text'
  $primary=$window.FindName('ContinueButton');$primary.IsEnabled=$true
  Assert-Contrast $primary.Foreground $primary.Background 4.5 'primary button'
  $window.Show();$window.UpdateLayout()
  $choices=$window.FindName('ChoicePanel');$choices.Visibility='Visible'
  $radio=New-Object Windows.Controls.RadioButton
  $radio.Content='Remote server - long installation name with a retained path D:\CastLink\Servers\Previous installation and explicit certificate consent'
  $radio.Style=$window.FindResource('ChoiceRadioStyle');$null=$choices.Children.Add($radio)
  $window.UpdateLayout();$radio.ApplyTemplate()|Out-Null
  $card=$radio.Template.FindName('ChoiceBorder',$radio)
  $radio.IsChecked=$true;$window.UpdateLayout()
  Assert-Color $card.BorderBrush '#FFACD9BB' 'selected choice'
  $radio.IsEnabled=$false;$window.UpdateLayout()
  Assert-Color $card.Background '#FF25292E' 'disabled choice'
  $radio.IsEnabled=$true
  $null=$window.Activate();$null=$radio.Focus();$window.UpdateLayout()
  Assert-Color $card.BorderBrush '#FFACD9BB' 'choice keyboard focus'
  Render-State 'installer-graphite-choice-focus'
  $answer=$window.FindName('AnswerBox');$answer.Visibility='Visible'
  $answer.Text='D:\CastLink\A deliberately long folder name\Existing installation'
  $window.FindName('FolderButton').Visibility='Visible'
  $window.FindName('BackButton').Visibility='Visible'
  $window.FindName('DownloadText').Visibility='Visible'
  $window.FindName('DownloadText').Text='148 MB / 306 MB - 12.4 MB/s - 48%'
  $window.FindName('ProgressBar').IsIndeterminate=$false
  $window.FindName('ProgressBar').Maximum=100;$window.FindName('ProgressBar').Value=48
  $window.UpdateLayout();$answer.ApplyTemplate()|Out-Null
  Assert-Contrast $answer.Foreground $answer.Background 4.5 'input text'
  $null=$window.Activate();$null=$answer.Focus()
  $window.UpdateLayout()
  if(-not $answer.IsKeyboardFocusWithin){throw 'Input keyboard focus not established'}
  $inputBorder=$answer.Template.FindName('InputBorder',$answer)
  Assert-Color $inputBorder.BorderBrush '#FFACD9BB' 'keyboard focus'
  Render-State 'installer-graphite-input-focus'
  $answer.IsEnabled=$false;$window.UpdateLayout()
  Assert-Color $inputBorder.Background '#FF25292E' 'disabled input'
  $primary.IsEnabled=$false;$window.UpdateLayout();$primary.ApplyTemplate()|Out-Null
  Assert-Color ($primary.Template.FindName('ButtonBorder',$primary)).Background '#FF25292E' 'disabled primary'
  Render-State 'installer-graphite-disabled'
  $answer.Visibility='Collapsed';$choices.Visibility='Collapsed'
  $password=$window.FindName('PasswordBox');$password.Visibility='Visible';$password.Password='fixture-only'
  $password.ApplyTemplate()|Out-Null
  Assert-Contrast $password.Foreground $password.Background 4.5 'password text'
  $null=$password.Focus();$window.UpdateLayout()
  Assert-Color ($password.Template.FindName('InputBorder',$password)).BorderBrush '#FFACD9BB' 'password focus'
  Render-State 'installer-graphite-password'
  $password.Clear();$password.Visibility='Collapsed'
  $choices.Visibility='Visible';$answer.Visibility='Visible';$answer.IsEnabled=$true;$primary.IsEnabled=$true
  $null=$primary.Focus();$window.UpdateLayout()
  Assert-Color ($primary.Template.FindName('ButtonBorder',$primary)).BorderBrush '#FFACD9BB' 'primary keyboard focus'
  $log=$window.FindName('LogBox');$log.Text=(1..30|ForEach-Object{'Fixture log line '+$_}) -join "`r`n"
  # The details pane remains usable, including its dark scrollbar and expansion.
  $parent=[Windows.LogicalTreeHelper]::GetParent($log)
  while($parent -and $parent -isnot [Windows.Controls.Expander]){$parent=[Windows.LogicalTreeHelper]::GetParent($parent)}
  if(-not $parent){throw 'Execution details expander missing'}
  $parent.IsExpanded=$true;$window.UpdateLayout()
  Render-State 'installer-graphite-log'
  $parent.IsExpanded=$false
  $window.Width=$window.MinWidth;$window.Height=$window.MinHeight
  $window.FindName('PromptBody').Text=('Long prompt and certificate instructions. '*12)
  $window.UpdateLayout()
  if($radio.ActualWidth -gt $window.ActualWidth - 56){throw 'Choice overflows minimum window width'}
  if($radio.ActualHeight -le 44){throw 'Long choice did not wrap'}
  Render-State 'installer-graphite-minimum'
  Write-Output 'SIMPLE_GRAPHITE_GUI_PASS WPF palette contrast selection focus disabled password minimum-size rendering'
}finally{$window.Close()}
