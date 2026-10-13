param([string]$ControlFolder='',[switch]$Startup,[Alias('FunctionsOnly')][switch]$ControlFunctionsOnly)
$ErrorActionPreference='Stop'
$languageHelper=Join-Path $PSScriptRoot 'simple-easy-setup-language.ps1'
if(Test-Path -LiteralPath $languageHelper){. $languageHelper}
function ConvertTo-SimpleControlText([string]$Text,[string]$Language='ru') {
  if(Get-Command ConvertTo-SimpleGuiText -ErrorAction SilentlyContinue){return (ConvertTo-SimpleGuiText -Text $Text -Language $Language)}
  return $Text
}

function Get-SimpleControlLinkFolder([string]$Kind) {
  if($Kind -ceq 'desktop'){return [Environment]::GetFolderPath('DesktopDirectory')}
  if($Kind -ceq 'startup'){return [Environment]::GetFolderPath('Startup')}
  throw 'Неизвестный вид ярлыка CastLink.'
}
function Get-SimpleControlLinkNames([string]$Kind,[string]$InstallationId) {
  $suffix=([Guid]$InstallationId).ToString('N').Substring(0,12)
  if($Kind -ceq 'desktop'){return @('CastLink.lnk',('CastLink '+$suffix+'.lnk'))}
  return @('CastLink-'+$suffix+'.lnk')
}
function Get-SimpleControlPowerShell {
  return (Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe')
}
function New-SimpleControlShortcut([string]$Path,[string]$Folder,[string]$Kind) {
  $shell=New-Object -ComObject WScript.Shell
  try {
    $link=$shell.CreateShortcut($Path)
    $link.TargetPath=Get-SimpleControlPowerShell
    $link.Arguments='-NoProfile -NonInteractive -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File '+(Quote-SimpleArgument (Join-Path $Folder '.castlink-control/simple-easy-setup-control.ps1'))+' -ControlFolder '+(Quote-SimpleArgument ([IO.Path]::GetFullPath($Folder)))
    if($Kind -ceq 'startup'){$link.Arguments+=' -Startup'}
    $link.WorkingDirectory=$Folder;$link.Description='CastLink — локальный сервер'
    $link.IconLocation=(Join-Path $Folder '.castlink-control/simple-easy-setup-control.ico')+',0'
    $link.Save()
  } finally {if($link){$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)};$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
}
function Save-SimpleControlOwnership([string]$Folder,[object]$Receipt) {
  Write-SimpleText (Join-Path $Folder '.castlink-owned.json') ($Receipt|ConvertTo-Json -Depth 8)
}
function Install-SimpleLocalControl([string]$Folder,[object]$State,[string]$SourceFolder=$PSScriptRoot) {
  if($State.target -cne 'local' -or -not $State.completed -or $State.stopped){return}
  $compose=Get-Content -LiteralPath (Join-Path $Folder 'compose.json') -Encoding UTF8 -Raw|ConvertFrom-Json
  $null=Get-SimpleRemovalProject $State $compose
  $receipt=Open-SimpleOwnership $Folder
  if($receipt.installationId -and $receipt.installationId -cne $State.installationId){throw 'Учёт файлов относится к другой установке.'}
  $destination=Join-Path $Folder '.castlink-control'
  $names=@('simple-easy-setup-control.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-cleanup.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-language.ps1','simple-easy-setup-control.ico')
  # Validate every replacement before copying: keep pre-existing/edited helpers.
  foreach($name in $names){
    $path=Join-Path $destination $name;$relative='.castlink-control/'+$name
    if(-not(Test-Path -LiteralPath (Join-Path $SourceFolder $name) -PathType Leaf)){throw 'В пакете отсутствует файл управления CastLink.'}
    if(Test-Path -LiteralPath $path){
      $entry=@($receipt.files|Where-Object{$_.path.Replace('\','/') -ceq $relative})
      if($entry.Count -ne 1 -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry[0].sha256){throw 'Сохранены прежние файлы управления CastLink: их происхождение или изменения не совпали с учётом.'}
    }
  }
  $receipt.installationId=$State.installationId
  $null=New-Item -ItemType Directory -Path $destination -Force
  foreach($name in $names){
    $path=Join-Path $destination $name;Copy-Item -LiteralPath (Join-Path $SourceFolder $name) -Destination $path -Force
    $relative='.castlink-control/'+$name
    $receipt.files=@($receipt.files|Where-Object{$_.path.Replace('\','/') -cne $relative})+@([pscustomobject]@{path=$relative;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()})
    Save-SimpleControlOwnership $Folder $receipt
  }
  if(-not $receipt.PSObject.Properties['windowsLinks']){$receipt|Add-Member -NotePropertyName windowsLinks -NotePropertyValue @()}
  $outcome=[pscustomobject]@{desktop=$false;startup=$false}
  foreach($kind in @('desktop','startup')){
    $base=Get-SimpleControlLinkFolder $kind
    if(-not $base){throw 'Windows не вернула папку ярлыков текущего пользователя.'}
    $null=New-Item -ItemType Directory -Path $base -Force
    $path=''
    foreach($name in Get-SimpleControlLinkNames $kind $State.installationId){
      $candidate=Join-Path $base $name
      $owned=@($receipt.windowsLinks|Where-Object{$_.kind -ceq $kind -and $_.path -ceq $candidate})
      if(-not(Test-Path -LiteralPath $candidate) -or ($owned.Count -eq 1 -and (Get-FileHash -LiteralPath $candidate -Algorithm SHA256).Hash.ToLowerInvariant() -ceq $owned[0].sha256)){$path=$candidate;break}
    }
    if(-not $path){Write-Host ('Прежний ярлык сохранён; новый ярлык CastLink не создан: '+$kind);continue}
    New-SimpleControlShortcut $path $Folder $kind
    $receipt.windowsLinks=@($receipt.windowsLinks|Where-Object{$_.path -cne $path})+@([pscustomobject]@{kind=$kind;path=$path;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()})
    Save-SimpleControlOwnership $Folder $receipt
    $outcome.$kind=$true
  }
  return $outcome
}
function Remove-SimpleControlLinks([string]$Folder,[object]$State,[object]$Receipt) {
  if(-not $Receipt -or $Receipt.installationId -cne $State.installationId -or $Receipt.folder -cne [IO.Path]::GetFullPath($Folder)){return}
  if(-not $Receipt.PSObject.Properties['windowsLinks']){return}
  $retained=@()
  foreach($entry in $Receipt.windowsLinks){
    if($entry.kind -cnotin @('desktop','startup')){$retained+=$entry;continue}
    $allowed=@(Get-SimpleControlLinkNames $entry.kind $State.installationId|ForEach-Object{Join-Path (Get-SimpleControlLinkFolder $entry.kind) $_})
    if($entry.path -cnotin $allowed){$retained+=$entry;continue}
    if(Test-Path -LiteralPath $entry.path){
      if((Get-FileHash -LiteralPath $entry.path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry.sha256){Write-Host 'Изменённый пользователем ярлык CastLink сохранён.';$retained+=$entry;continue}
      Remove-Item -LiteralPath $entry.path -Force
    }
  }
  $Receipt.windowsLinks=$retained;Save-SimpleControlOwnership $Folder $Receipt
}
function Enter-SimpleControlGuard([string]$InstallationId,[int]$TimeoutSeconds=180) {
  $mutex=New-Object Threading.Mutex($false,('Local\CastLink-control-'+([Guid]$InstallationId).ToString('N')))
  try {
    $entered=$false
    try{$entered=$mutex.WaitOne($TimeoutSeconds*1000)}catch [Threading.AbandonedMutexException]{$entered=$true}
    if(-not $entered){throw 'Другой запуск или удаление CastLink ещё выполняется. Повтори позже.'}
    return $mutex
  } catch {$mutex.Dispose();throw}
}
function Exit-SimpleControlGuard($Guard) {if($Guard){try{$Guard.ReleaseMutex()}finally{$Guard.Dispose()}}}
function Read-SimpleControlInstallation([string]$Folder) {
  $state=Get-Content -LiteralPath (Join-Path $Folder '.castlink-install.json') -Encoding UTF8 -Raw|ConvertFrom-Json
  $compose=Get-Content -LiteralPath (Join-Path $Folder 'compose.json') -Encoding UTF8 -Raw|ConvertFrom-Json
  if($state.target -cne 'local' -or -not $state.completed){throw 'Не найдена завершённая локальная установка CastLink.'}
  $project=Get-SimpleRemovalProject $state $compose
  $receipt=Get-Content -LiteralPath (Join-Path $Folder '.castlink-owned.json') -Encoding UTF8 -Raw|ConvertFrom-Json
  if($receipt.schemaVersion -ne 1 -or $receipt.installationId -cne $state.installationId -or $receipt.folder -cne [IO.Path]::GetFullPath($Folder)){throw 'Учёт управления относится к другой установке.'}
  $ip=$null
  if(-not [Net.IPAddress]::TryParse([string]$state.address,[ref]$ip) -or $ip.AddressFamily -ne [Net.Sockets.AddressFamily]::InterNetwork){throw 'Сохранённый адрес локального CastLink некорректен.'}
  return [pscustomobject]@{state=$state;compose=$compose;project=$project;url=('https://'+$ip.ToString()+'/');services=@($compose.services.PSObject.Properties.Name|Sort-Object)}
}
function Set-SimpleControlDocker([string]$Folder,[string]$Desktop) {
  $script:SshSession=$null;$script:ServerFolder=[IO.Path]::GetFullPath($Folder).Replace('\','/')
  $script:DockerExe=Join-Path (Split-Path -Parent $Desktop) 'resources/bin/docker.exe'
  if(-not(Test-Path -LiteralPath $script:DockerExe -PathType Leaf)){throw 'Docker CLI не найден в проверенном Docker Desktop.'}
}
function Get-SimpleControlServices([object]$Installation) {
  $raw=Invoke-DeploymentDocker @('ps','-a','--filter',('label=com.docker.compose.project='+$Installation.project),'--format','{{.Label "com.docker.compose.service"}}|{{.State}}') '' 8
  $rows=@()
  foreach($line in ($raw -split '\r?\n'|Where-Object{$_})){
    $parts=$line.Split('|')
    if($parts.Count -ne 2 -or $parts[0] -cnotin $Installation.services -or $parts[1] -cnotin @('created','restarting','running','removing','paused','exited','dead') -or @($rows|Where-Object{$_.name -ceq $parts[0]}).Count){throw 'Не удалось подтвердить службы выбранной установки.'}
    $rows+=[pscustomobject]@{name=$parts[0];state=$parts[1]}
  }
  return $rows
}
function Start-SimpleControlServices([string]$Folder,[int]$WaitSeconds=120) {
  $installation=Read-SimpleControlInstallation $Folder
  $guard=Enter-SimpleControlGuard $installation.state.installationId 1
  try {
    $installation=Read-SimpleControlInstallation $Folder
    if($installation.state.stopped){throw 'Службы удалены с сохранением данных. Для восстановления запусти Easy Setup и выбери ту же папку.'}
    $desktop=Find-Desktop
    if(-not $desktop){throw 'Docker Desktop не найден. Открой его или повтори Easy Setup.'}
    Set-SimpleControlDocker $Folder $desktop
    if(-not(Test-LinuxEngine $script:DockerExe)){
      if(-not(Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)){$null=Start-Process -FilePath $desktop -PassThru}
      $deadline=[DateTime]::UtcNow.AddSeconds($WaitSeconds)
      while(-not(Test-LinuxEngine $script:DockerExe)){
        if([DateTime]::UtcNow -ge $deadline){throw 'Docker Desktop не подготовил Linux containers за 2 минуты. Проверь его окно и запусти службы снова.'}
        Start-Sleep -Seconds 2
      }
    }
    $rows=@(Get-SimpleControlServices $installation)
    if($rows.Count -ne $installation.services.Count){throw 'Не найдены все прежние контейнеры CastLink. Повтори Easy Setup с той же папкой; данные сохраняются.'}
    if(@($rows|Where-Object{$_.state -cne 'running'}).Count){
      # Existing installation only: no creation, rebuild, download or migrations.
      Assert-SimpleRemovalResources $installation.project
      $null=Invoke-DeploymentCompose -Arguments (@('start')+$installation.services) -TimeoutSeconds 60 -ProjectName $installation.project
    }
    return 'Запуск служб выполнен. Готовность HTTPS проверь на главной странице.'
  } finally {Exit-SimpleControlGuard $guard}
}
function Get-SimpleControlHttps([string]$Url) {
  $response=$null
  try {
    # Ordinary certificate validation remains enabled, including the user's CA.
    [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
    $request=[Net.HttpWebRequest]::Create($Url+'api/version')
    $request.Method='GET';$request.Timeout=3000;$request.ReadWriteTimeout=3000;$request.AllowAutoRedirect=$false
    $response=$request.GetResponse()
    if([int]$response.StatusCode -eq 200){return 'Доступен по HTTPS'}
    return 'HTTPS пока не готов'
  }catch [Net.WebException]{
    if($_.Exception.Status -eq [Net.WebExceptionStatus]::TrustFailure){return 'Сертификат HTTPS не доверен'}
    return 'HTTPS недоступен'
  }catch{return 'HTTPS недоступен'}finally{if($response){$response.Close()}}
}
function Get-SimpleControlStatus([string]$Folder) {
  $installation=Read-SimpleControlInstallation $Folder
  $result=[pscustomobject]@{url=$installation.url;docker='Не запущен';https='Ожидание служб';summary='Ожидание Docker Desktop';services=@();stopped=[bool]$installation.state.stopped}
  $desktop=Find-Desktop
  if(-not $desktop){$result.docker='Не найден';return $result}
  Set-SimpleControlDocker $Folder $desktop
  if(-not(Test-LinuxEngine $script:DockerExe)){return $result}
  $result.docker='Linux containers готовы';$rows=@(Get-SimpleControlServices $installation)
  foreach($name in $installation.services){
    $row=@($rows|Where-Object{$_.name -ceq $name})
    $status=if($row.Count){$row[0].state}else{'missing'}
    $result.services+= [pscustomobject]@{name=$name;state=$status}
  }
  $result.https=Get-SimpleControlHttps $installation.url
  $result.summary=if($result.stopped){'Службы удалены, данные сохранены'}elseif(-not @($result.services|Where-Object{$_.state -cne 'running'}).Count -and $result.https -ceq 'Доступен по HTTPS'){'CastLink доступен'}elseif(-not @($result.services|Where-Object{$_.state -cne 'running'}).Count){'Контейнеры запущены; HTTPS не готов'}else{'Часть служб не работает'}
  return $result
}
function New-SimpleControlWindow([string]$Language='ru') {
  Add-Type -AssemblyName PresentationFramework
  [xml]$xaml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="CastLink" Width="480" Height="660" MinWidth="440" MinHeight="630" WindowStartupLocation="CenterScreen" Background="#101214" Foreground="#E9EBEE" FontFamily="Segoe UI">
 <Window.Resources>
  <Style TargetType="Button"><Setter Property="Background" Value="#282B30"/><Setter Property="Foreground" Value="#E9EBEE"/><Setter Property="BorderThickness" Value="0"/><Setter Property="Padding" Value="15,10"/><Setter Property="Cursor" Value="Hand"/><Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Button"><Border x:Name="Surface" Background="{TemplateBinding Background}" CornerRadius="5" Padding="{TemplateBinding Padding}"><ContentPresenter HorizontalAlignment="Center"/></Border><ControlTemplate.Triggers><Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Surface" Property="Opacity" Value="0.85"/></Trigger><Trigger Property="IsEnabled" Value="False"><Setter TargetName="Surface" Property="Opacity" Value="0.45"/></Trigger></ControlTemplate.Triggers></ControlTemplate></Setter.Value></Setter></Style>
 </Window.Resources>
 <Grid Margin="28"><Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
  <Grid><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="150"/></Grid.ColumnDefinitions><StackPanel><TextBlock Text="CastLink" FontSize="29" FontWeight="SemiBold"/><TextBlock x:Name="LocalTitle" Text="Локальный сервер" Foreground="#9DA3AD" Margin="0,5,0,20"/></StackPanel><StackPanel Grid.Column="1" Margin="0,2,0,0"><TextBlock x:Name="LanguageTitle" Text="Язык" Foreground="#9DA3AD" FontSize="12" Margin="0,0,0,6"/><StackPanel Orientation="Horizontal"><Button x:Name="LanguageRu" Content="RU" Width="44" Padding="4,5"/><Button x:Name="LanguageEn" Content="EN" Width="44" Padding="4,5" Margin="6,0,0,0"/><Button x:Name="LanguageZh" Content="中文" Width="44" Padding="4,5" Margin="6,0,0,0"/></StackPanel></StackPanel></Grid>
  <Border Grid.Row="1" Background="#202328" CornerRadius="5" Padding="18"><StackPanel><TextBlock x:Name="Summary" Text="Проверяю службы…" FontSize="17" FontWeight="SemiBold" TextWrapping="Wrap"/><TextBlock x:Name="Address" Foreground="#9DA3AD" Margin="0,9,0,0"/></StackPanel></Border>
  <ScrollViewer Grid.Row="2" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled"><StackPanel Margin="0,20,0,16"><TextBlock x:Name="ServicesTitle" Text="Службы" FontSize="16" FontWeight="SemiBold" Margin="0,0,0,10"/><TextBlock x:Name="Services" Text="Docker Desktop: проверка…" FontSize="14" LineHeight="28" TextWrapping="Wrap"/><TextBlock x:Name="Notice" Foreground="#9DA3AD" Margin="0,12,0,0" TextWrapping="Wrap" FontSize="12"/></StackPanel></ScrollViewer>
  <StackPanel Grid.Row="3"><Button x:Name="Open" Content="Открыть CastLink" Background="#DCE1E7" Foreground="#101214" FontWeight="SemiBold"/><Grid Margin="0,10,0,0"><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="10"/><ColumnDefinition/></Grid.ColumnDefinitions><Button x:Name="Start" Content="Запустить службы"/><Button Grid.Column="2" x:Name="Refresh" Content="Обновить статус"/></Grid></StackPanel>
  <TextBlock x:Name="Footer" Grid.Row="4" Text="Автозапуск — после входа в Windows. Docker Desktop должен подготовить Linux containers. Статус контейнеров не заменяет проверку сайта." TextWrapping="Wrap" Foreground="#9DA3AD" FontSize="12" Margin="0,18,0,0"/>
 </Grid>
</Window>
'@
  $reader=New-Object Xml.XmlNodeReader $xaml
  $window=[Windows.Markup.XamlReader]::Load($reader)
  Update-SimpleControlLanguage $window $Language
  return $window
}
function Update-SimpleControlLanguage([object]$Window,[string]$Language) {
  $Window.FindName('Summary').Text=ConvertTo-SimpleControlText 'Проверяю службы…' $Language
  $Window.FindName('Services').Text=ConvertTo-SimpleControlText 'Docker Desktop: проверка…' $Language
  $texts=@{LocalTitle='Локальный сервер';LanguageTitle='Язык';ServicesTitle='Службы';Footer='Автозапуск — после входа в Windows. Docker Desktop должен подготовить Linux containers. Статус контейнеров не заменяет проверку сайта.'}
  foreach($name in $texts.Keys){$Window.FindName($name).Text=ConvertTo-SimpleControlText $texts[$name] $Language}
  foreach($button in @(@('Open','Открыть CastLink'),@('Start','Запустить службы'),@('Refresh','Обновить статус'))){$Window.FindName($button[0]).Content=ConvertTo-SimpleControlText $button[1] $Language}
  foreach($item in @(@('LanguageRu','ru'),@('LanguageEn','en'),@('LanguageZh','zh-CN'))){
    $selected=($item[1] -ceq $Language);$button=$Window.FindName($item[0])
    $button.Background=if($selected){'#DCE1E7'}else{'#282B30'};$button.Foreground=if($selected){'#101214'}else{'#E9EBEE'}
  }
}
function Update-SimpleControlWindow([object]$Window,[object]$Status,[string]$Language='ru') {
  $Window.FindName('Summary').Text=ConvertTo-SimpleControlText $Status.summary $Language
  $Window.FindName('Address').Text=$Status.url
  $labels=@{postgres='База данных';web='Приложение';livekit='Медиа';caddy='HTTPS-прокси';'turn-tls'='TURN/TLS'}
  $states=@{running='работает';restarting='перезапускается';paused='приостановлен';exited='остановлен';created='создан';removing='удаляется';dead='ошибка';missing='не найден'}
  $lines=@(('Docker Desktop: '+(ConvertTo-SimpleControlText $Status.docker $Language)),('CastLink: '+(ConvertTo-SimpleControlText $Status.https $Language)))
  foreach($row in $Status.services){$lines+=((ConvertTo-SimpleControlText $labels[$row.name] $Language)+': '+(ConvertTo-SimpleControlText $states[$row.state] $Language))}
  $Window.FindName('Services').Text=$lines -join "`n"
  $Window.FindName('Start').IsEnabled=-not $Status.stopped
}
function Show-SimpleControlWindow([string]$Folder) {
  $language=if(Get-Command Get-SimpleGuiLanguage -ErrorAction SilentlyContinue){Get-SimpleGuiLanguage}else{'ru'}
  $window=New-SimpleControlWindow $language
  $summary=$window.FindName('Summary');$address=$window.FindName('Address');$services=$window.FindName('Services');$notice=$window.FindName('Notice')
  $open=$window.FindName('Open');$start=$window.FindName('Start');$refresh=$window.FindName('Refresh')
  $installation=Read-SimpleControlInstallation $Folder;$address.Text=$installation.url
  $open.Add_Click({Start-Process -FilePath $installation.url}.GetNewClosure())
  $job=[pscustomobject]@{pipeline=$null;handle=$null;mode='status';next=[DateTime]::UtcNow;language=$language;status=$null;notice='';stopped=[bool]$installation.state.stopped}
  $source=$PSCommandPath
  # GetNewClosure uses a dynamic module; script-local commands are not visible
  # there. Keep the catalog and UI functions together in an unimported module.
  $uiHelpers=New-Module -AsCustomObject -ArgumentList $source -ScriptBlock {
    param([string]$Controller)
    . $Controller -FunctionsOnly
    function Translate([string]$Text,[string]$Locale){return (ConvertTo-SimpleControlText $Text $Locale)}
    function ApplyLanguage([object]$View,[object]$State){
      if(Get-Command Set-SimpleGuiLanguage -ErrorAction SilentlyContinue){$null=Set-SimpleGuiLanguage -Language $State.language}
      Update-SimpleControlLanguage $View $State.language
      if($State.status){Update-SimpleControlWindow $View $State.status $State.language}
    }
    function UpdateStatus([object]$View,[object]$State,[string]$Locale){Update-SimpleControlWindow $View $State $Locale}
    Export-ModuleMember -Function Translate,ApplyLanguage,UpdateStatus
  }
  $begin={param([string]$Mode)
    if($job.pipeline){return}
    $job.notice=if($Mode -ceq 'start'){'Запускаю Docker Desktop и службы. Это может занять до 2 минут.'}else{''}
    $notice.Text=$uiHelpers.Translate($job.notice,$job.language)
    $start.IsEnabled=$false;$refresh.IsEnabled=$false;$job.mode=$Mode
    $job.pipeline=[PowerShell]::Create()
    $null=$job.pipeline.AddScript('param($source,$folder,$mode);. $source -FunctionsOnly;. (Join-Path (Split-Path $source -Parent) "simple-easy-setup-deploy.ps1");. (Join-Path (Split-Path $source -Parent) "simple-easy-setup-runtime.ps1");try{if($mode -ceq "start"){Start-SimpleControlServices $folder}else{Get-SimpleControlStatus $folder}}catch{throw "Не удалось выполнить проверку или запуск. Проверь Docker Desktop и сохранённую установку; данные не изменялись."}').AddArgument($source).AddArgument($Folder).AddArgument($Mode)
    $job.handle=$job.pipeline.BeginInvoke()
  }.GetNewClosure()
  foreach($item in @(@('LanguageRu','ru'),@('LanguageEn','en'),@('LanguageZh','zh-CN'))){
    $selectedLanguage=$item[1]
    $window.FindName($item[0]).Add_Click({
      $job.language=$selectedLanguage
      $uiHelpers.ApplyLanguage($window,$job)
      $notice.Text=$uiHelpers.Translate($job.notice,$job.language)
    }.GetNewClosure())
  }
  $start.Add_Click({& $begin 'start'}.GetNewClosure());$refresh.Add_Click({& $begin 'status'}.GetNewClosure())
  $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(250)
  $timer.Add_Tick({
    if($job.pipeline -and $job.handle.IsCompleted){
      try{
        $output=@($job.pipeline.EndInvoke($job.handle))
        if($job.pipeline.HadErrors){throw 'Проверка или запуск не завершились. Проверь Docker Desktop и сохранённую установку.'}
        if($job.mode -ceq 'start'){$job.notice=[string]$output[-1];$notice.Text=$uiHelpers.Translate($job.notice,$job.language)}else{
          $job.status=$output[-1];$job.stopped=[bool]$job.status.stopped;$uiHelpers.UpdateStatus($window,$job.status,$job.language)
        }
      }catch{$summary.Text=$uiHelpers.Translate('Требуется проверка',$job.language);$job.notice='Проверь Docker Desktop и сохранённую установку. Если службы удалены, восстанови их через Easy Setup с той же папкой.';$notice.Text=$uiHelpers.Translate($job.notice,$job.language)}
      finally{$job.pipeline.Dispose();$job.pipeline=$null;$job.handle=$null;$refresh.IsEnabled=$true;$start.IsEnabled=-not $job.stopped;$job.next=[DateTime]::UtcNow.AddSeconds(10);if($job.mode -ceq 'start'){$job.next=[DateTime]::UtcNow}}
    }
    if(-not $job.pipeline -and [DateTime]::UtcNow -ge $job.next){& $begin 'status'}
  }.GetNewClosure())
  $window.Add_Closed({$timer.Stop();if($job.pipeline){$job.pipeline.Stop();$job.pipeline.Dispose()}}.GetNewClosure())
  $timer.Start();$null=$window.ShowDialog()
}
if(-not $ControlFunctionsOnly){
  $launchAtLogon=[bool]$Startup;$launchFolder=$ControlFolder
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  . (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
  try{
    if($launchAtLogon){$null=Start-SimpleControlServices $launchFolder;exit 0}
    Show-SimpleControlWindow $launchFolder
  }catch{
    if(-not $launchAtLogon){
      Add-Type -AssemblyName PresentationFramework
      $language=if(Get-Command Get-SimpleGuiLanguage -ErrorAction SilentlyContinue){Get-SimpleGuiLanguage}else{'ru'}
      $message=ConvertTo-SimpleControlText 'Не удалось открыть управление CastLink. Проверь сохранённую папку установки и Docker Desktop. Данные не изменены.' $language
      $null=[Windows.MessageBox]::Show($message,'CastLink')
    }
    exit 1
  }
}
