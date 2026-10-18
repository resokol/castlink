param([string]$ControlFolder='',[switch]$Startup,[Alias('FunctionsOnly')][switch]$ControlFunctionsOnly,[string]$ReadyEvent='')
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
function Confirm-SimpleControlReady([string]$Name) {
  if(-not $Name){return}
  if($Name -cnotmatch '^Local\\CastLink-panel-ready-[a-f0-9]{32}$'){throw 'Invalid panel readiness event'}
  try{$event=[Threading.EventWaitHandle]::OpenExisting($Name)}catch [Threading.WaitHandleCannotBeOpenedException]{return} # The wizard may already have timed out or closed.
  try{$null=$event.Set()}finally{$event.Dispose()}
}
function Get-SimpleControlShortcutIcon([string]$Folder) {
  $icon=Join-Path $Folder '.castlink-control/simple-easy-setup-control.ico'
  $hash=(Get-FileHash -LiteralPath $icon -Algorithm SHA256).Hash.ToLowerInvariant()
  return (Join-Path $Folder ('.castlink-control/simple-easy-setup-control-'+$hash+'.ico'))
}
function New-SimpleControlShortcut([string]$Path,[string]$Folder,[string]$Kind) {
  $shell=New-Object -ComObject WScript.Shell
  try {
    $link=$shell.CreateShortcut($Path)
    $link.TargetPath=Get-SimpleControlPowerShell
    $link.Arguments='-NoProfile -NonInteractive -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File '+(Quote-SimpleArgument (Join-Path $Folder '.castlink-control/simple-easy-setup-control.ps1'))+' -ControlFolder '+(Quote-SimpleArgument ([IO.Path]::GetFullPath($Folder)))
    $link.WorkingDirectory=$Folder;$link.Description='CastLink — локальный сервер'
    $link.IconLocation=(Get-SimpleControlShortcutIcon $Folder)+',0'
    $link.Save()
    # Notify Explorer of this one shortcut; do not flush the global icon cache.
    Initialize-SimpleControlNative
    [CastLinkControl.Native]::SHChangeNotify(0x00002000,0x0005,$Path,[IntPtr]::Zero)
  } finally {if($link){$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)};$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
}
function Save-SimpleControlOwnership([string]$Folder,[object]$Receipt) {
  Write-SimpleText (Join-Path $Folder '.castlink-owned.json') ($Receipt|ConvertTo-Json -Depth 8)
}
function Install-SimpleLocalControl([string]$Folder,[object]$State,[string]$SourceFolder=$PSScriptRoot) {
  if($State.target -cne 'local' -or -not $State.completed -or $State.stopped){return}
  $compose=Get-Content -LiteralPath (Join-Path $Folder 'compose.json') -Encoding UTF8 -Raw|ConvertFrom-Json
  $null=Get-SimpleRemovalProject $State $compose
  $panelGuard=Enter-SimplePanelUpdateGuard $State.installationId
  try{
  $receipt=Open-SimpleOwnership $Folder
  if($receipt.installationId -and $receipt.installationId -cne $State.installationId){throw 'Учёт файлов относится к другой установке.'}
  $destination=Join-Path $Folder '.castlink-control'
  $names=@('simple-easy-setup-control.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-cleanup.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-language.ps1','simple-easy-setup-control.ico')
  # A new icon path makes Explorer invalidate an older icon with the same name.
  $iconHash=(Get-FileHash -LiteralPath (Join-Path $SourceFolder 'simple-easy-setup-control.ico') -Algorithm SHA256).Hash.ToLowerInvariant()
  $iconName='simple-easy-setup-control-'+$iconHash+'.ico';$names+= $iconName
  # Validate every replacement before copying: keep pre-existing/edited helpers.
  foreach($name in $names){
    $path=Join-Path $destination $name;$relative='.castlink-control/'+$name
    $sourceName=if($name -ceq $iconName){'simple-easy-setup-control.ico'}else{$name}
    if(-not(Test-Path -LiteralPath (Join-Path $SourceFolder $sourceName) -PathType Leaf)){throw 'В пакете отсутствует файл управления CastLink.'}
    if(Test-Path -LiteralPath $path){
      $entry=@($receipt.files|Where-Object{$_.path.Replace('\','/') -ceq $relative})
      if($entry.Count -ne 1 -or (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant() -cne $entry[0].sha256){throw 'Сохранены прежние файлы управления CastLink: их происхождение или изменения не совпали с учётом.'}
    }
  }
  $receipt.installationId=$State.installationId
  $null=New-Item -ItemType Directory -Path $destination -Force
  foreach($name in $names){
    $sourceName=if($name -ceq $iconName){'simple-easy-setup-control.ico'}else{$name}
    $path=Join-Path $destination $name;Copy-Item -LiteralPath (Join-Path $SourceFolder $sourceName) -Destination $path -Force
    $relative='.castlink-control/'+$name
    $receipt.files=@($receipt.files|Where-Object{$_.path.Replace('\','/') -cne $relative})+@([pscustomobject]@{path=$relative;sha256=(Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash.ToLowerInvariant()})
    Save-SimpleControlOwnership $Folder $receipt
  }
  if(-not $receipt.PSObject.Properties['windowsLinks']){$receipt|Add-Member -NotePropertyName windowsLinks -NotePropertyValue @()}
  Remove-SimpleControlLinks $Folder $State $receipt -StartupOnly
  $outcome=[pscustomobject]@{desktop=$false}
  foreach($kind in @('desktop')){
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
  }finally{Exit-SimpleControlGuard $panelGuard}
}
function Remove-SimpleControlLinks([string]$Folder,[object]$State,[object]$Receipt,[switch]$StartupOnly) {
  if(-not $Receipt -or $Receipt.installationId -cne $State.installationId -or $Receipt.folder -cne [IO.Path]::GetFullPath($Folder)){return}
  if(-not $Receipt.PSObject.Properties['windowsLinks']){return}
  $retained=@()
  foreach($entry in $Receipt.windowsLinks){
    if($StartupOnly -and $entry.kind -cne 'startup'){$retained+=$entry;continue}
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
function Enter-SimplePanelUpdateGuard([string]$InstallationId) {
  $guard=New-Object Threading.Mutex($false,('Local\CastLink-panel-'+([Guid]$InstallationId).ToString('N')))
  $entered=$false
  try{
    try{$entered=$guard.WaitOne(0)}catch [Threading.AbandonedMutexException]{$entered=$true}
    if(-not $entered){throw 'Перед обновлением или удалением выбери «Остановить и выйти» в трее CastLink и дождись остановки служб. Закрытие окна только скрывает панель в трей.'}
    return $guard
  }catch{$guard.Dispose();throw}
}
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
function Get-SimpleControlBuildMetadata([object]$Installation) {
  $commit='';$version=''
  $image=[string]$Installation.compose.services.web.image
  if($image -cmatch '^castlink-easy-web:([a-f0-9]{40})$'){
    $commit=$matches[1]
    if([string]$Installation.state.commit -ceq $commit){$version=[string]$Installation.state.version}
  }
  return [pscustomobject]@{version=$version;commit=$commit}
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
      if(-not(Get-Process -Name 'Docker Desktop' -ErrorAction SilentlyContinue)){$null=Start-SimpleDockerDesktop $desktop}
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
      Assert-SimpleControlContainers $installation $rows
      $null=Invoke-DeploymentCompose -Arguments (@('start')+$installation.services) -TimeoutSeconds 60 -ProjectName $installation.project
    }
    return 'Запуск служб выполнен. Готовность HTTPS проверь на главной странице.'
  } finally {Exit-SimpleControlGuard $guard}
}
function Assert-SimpleControlContainers([object]$Installation,[object[]]$Rows) {
  $raw=Invoke-DeploymentDocker @('ps','-a','-q','--filter',('label=com.docker.compose.project='+$Installation.project)) '' 8
  $ids=@($raw -split '\r?\n'|Where-Object{$_})
  if($ids.Count -ne $Rows.Count -or @($ids|Where-Object{$_ -cnotmatch '^[a-f0-9]{12,64}$'}).Count){throw 'Не удалось подтвердить контейнеры выбранной установки.'}
  if(-not $ids.Count){return}
  $containers=ConvertFrom-Json -InputObject (Invoke-DeploymentDocker (@('inspect')+$ids) '' 8)
  $seen=@()
  foreach($container in @($containers)){
    $labels=$container.Config.Labels;$service=[string]$labels.'com.docker.compose.service'
    if($labels.'com.docker.compose.project' -cne $Installation.project -or $service -cnotin $Installation.services -or $service -cin $seen){throw 'Обнаружен контейнер другой установки или неизвестной службы.'}
    $seen+=$service
  }
  if($seen.Count -ne $Rows.Count -or @($Rows|Where-Object{$_.name -cnotin $seen}).Count){throw 'Не удалось подтвердить службы выбранной установки.'}
}
function Get-SimpleControlStopTimeout([object]$Installation,[string[]]$Services=$Installation.services,[int]$GraceSeconds=20) {
  $depth=@{};$dependencies=@{}
  foreach($name in $Installation.services){
    $depth[$name]=0;$service=$Installation.compose.services.PSObject.Properties[$name].Value
    $depends=if($service.PSObject.Properties['depends_on']){$service.depends_on}else{$null}
    $names=@()
    if($null -ne $depends){
      if($depends -is [Array]){$names=@($depends)}elseif($depends -is [pscustomobject]){$names=@($depends.PSObject.Properties.Name)}else{throw 'Некорректные зависимости службы CastLink.'}
      if(@($names|Where-Object{$_ -cnotin $Installation.services}).Count){throw 'Неизвестная зависимость службы CastLink.'}
    }
    $dependencies[$name]=$names
  }
  for($pass=0;$pass -lt $Installation.services.Count;$pass++){
    $changed=$false
    foreach($name in $Installation.services){
      $weight=if($name -cin $Services){1}else{0};$value=$weight
      foreach($dependency in $dependencies[$name]){$value=[Math]::Max($value,$weight+$depth[$dependency])}
      if($value -ne $depth[$name]){$depth[$name]=$value;$changed=$true}
    }
    if(-not $changed){break}
    if($pass -eq $Installation.services.Count-1){throw 'Циклические зависимости служб CastLink.'}
  }
  $waves=1;foreach($value in $depth.Values){$waves=[Math]::Max($waves,$value)}
  # Compose stops dependency waves serially; --timeout applies per container.
  return ($waves*$GraceSeconds+15)
}
function New-SimpleControlStopSnapshot([object]$Installation,[object[]]$Rows) {
  $services=@()
  foreach($name in $Installation.services){
    $row=@($Rows|Where-Object{$_.name -ceq $name});$state=if($row.Count){$row[0].state}else{'missing'}
    $services+=[pscustomobject]@{name=$name;state=$state}
  }
  return [pscustomobject]@{url=$Installation.url;docker='Linux containers готовы';https='Ожидание служб';summary='Не удалось остановить службы';services=$services;stopped=[bool]$Installation.state.stopped}
}
function Stop-SimpleControlServices([string]$Folder,[int]$SettleSeconds=20) {
  $installation=Read-SimpleControlInstallation $Folder
  $guard=Enter-SimpleControlGuard $installation.state.installationId 1
  try{
    $installation=Read-SimpleControlInstallation $Folder
    if($installation.state.stopped){return 'Службы CastLink остановлены. Данные сохранены.'}
    $desktop=Find-Desktop
    if(-not $desktop){throw 'Docker Desktop не найден.'}
    Set-SimpleControlDocker $Folder $desktop
    if(-not(Test-LinuxEngine $script:DockerExe)){throw 'Linux containers пока недоступны.'}
    $rows=@(Get-SimpleControlServices $installation)
    $active=@($rows|Where-Object{$_.state -cin @('running','restarting','paused')})
    if($active.Count){
      Assert-SimpleControlContainers $installation $rows
      $names=@($active|ForEach-Object{$_.name});$timeout=Get-SimpleControlStopTimeout $installation $names
      $timedOut=$false
      try{$null=Invoke-DeploymentCompose -Arguments (@('stop','--timeout','20')+$names) -TimeoutSeconds $timeout -ProjectName $installation.project}
      catch [TimeoutException]{$timedOut=$true}
      catch {} # Reconcile state after any CLI failure; the daemon may have stopped.
      $after=@(Get-SimpleControlServices $installation)
      $remaining=@($after|Where-Object{$_.state -cin @('running','restarting','paused')})
      if($remaining.Count -and $timedOut){
        $deadline=[DateTime]::UtcNow.AddSeconds($SettleSeconds)
        while($remaining.Count -and [DateTime]::UtcNow -lt $deadline){
          Start-Sleep -Milliseconds 500
          $after=@(Get-SimpleControlServices $installation)
          $remaining=@($after|Where-Object{$_.state -cin @('running','restarting','paused')})
        }
      }
      if($remaining.Count){
        $stopError=New-Object InvalidOperationException 'Службы выбранного CastLink ещё работают.'
        $stopError.Data['SimpleControlStatus']=New-SimpleControlStopSnapshot $installation $after
        throw $stopError
      }
    }
    return 'Службы CastLink остановлены. Данные сохранены.'
  }finally{Exit-SimpleControlGuard $guard}
}
function Initialize-SimpleControlNative {
  if('CastLinkControl.Native' -as [type]){return}
  Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
namespace CastLinkControl {
 public static class Native {
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern uint RegisterWindowMessage(string name);
  [DllImport("user32.dll")] public static extern bool PostMessage(IntPtr hwnd,uint message,IntPtr wparam,IntPtr lparam);
  [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr hwnd);
  [DllImport("shell32.dll", CharSet=CharSet.Unicode, ExactSpelling=true)] public static extern void SHChangeNotify(uint eventId,uint flags,string path,IntPtr item2);
 }
}
'@
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
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Title="CastLink" Width="520" Height="760" MinWidth="440" MinHeight="630" WindowStartupLocation="CenterScreen" Background="#111315" Foreground="#EEF0F2" FontFamily="Segoe UI" FontSize="14" UseLayoutRounding="True" SnapsToDevicePixels="True" TextOptions.TextFormattingMode="Display">
 <Window.Resources>
  <SolidColorBrush x:Key="PanelBrush" Color="#191C20"/>
  <SolidColorBrush x:Key="LineBrush" Color="#343A42"/>
  <SolidColorBrush x:Key="FocusBrush" Color="#ACD9BB"/>
  <SolidColorBrush x:Key="MutedBrush" Color="#ADB4BD"/>
  <Style x:Key="ButtonFocusStyle" TargetType="Control">
   <Setter Property="Template"><Setter.Value><ControlTemplate TargetType="Control"><Border Margin="-4" CornerRadius="10" BorderBrush="{StaticResource FocusBrush}" BorderThickness="2"/></ControlTemplate></Setter.Value></Setter>
  </Style>
  <Style TargetType="Button">
   <Setter Property="Background" Value="#25292E"/>
   <Setter Property="Foreground" Value="#EEF0F2"/>
   <Setter Property="BorderBrush" Value="#444B54"/>
   <Setter Property="BorderThickness" Value="1"/>
   <Setter Property="Padding" Value="15,10"/>
   <Setter Property="MinHeight" Value="42"/>
   <Setter Property="FontSize" Value="13"/>
   <Setter Property="Cursor" Value="Hand"/>
   <Setter Property="FocusVisualStyle" Value="{StaticResource ButtonFocusStyle}"/>
   <Setter Property="Template"><Setter.Value>
    <ControlTemplate TargetType="Button">
     <Border x:Name="Surface" Background="{TemplateBinding Background}" BorderBrush="{TemplateBinding BorderBrush}" BorderThickness="{TemplateBinding BorderThickness}" CornerRadius="8" Padding="{TemplateBinding Padding}">
      <ContentPresenter HorizontalAlignment="Center" VerticalAlignment="Center" RecognizesAccessKey="True"/>
     </Border>
     <ControlTemplate.Triggers>
      <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="Surface" Property="Opacity" Value="0.85"/></Trigger>
      <Trigger Property="IsPressed" Value="True"><Setter TargetName="Surface" Property="Opacity" Value="0.7"/></Trigger>
      <Trigger Property="IsKeyboardFocused" Value="True"><Setter TargetName="Surface" Property="BorderBrush" Value="{StaticResource FocusBrush}"/><Setter TargetName="Surface" Property="BorderThickness" Value="2"/></Trigger>
      <Trigger Property="IsEnabled" Value="False"><Setter TargetName="Surface" Property="Opacity" Value="0.45"/><Setter Property="Cursor" Value="Arrow"/></Trigger>
     </ControlTemplate.Triggers>
    </ControlTemplate>
   </Setter.Value></Setter>
  </Style>
    <Style TargetType="ScrollBar">
      <Setter Property="Width" Value="12" />
      <Setter Property="Background" Value="{StaticResource PanelBrush}" />
      <Setter Property="Template">
        <Setter.Value>
          <ControlTemplate TargetType="ScrollBar">
            <Track x:Name="PART_Track" IsDirectionReversed="True" Orientation="{TemplateBinding Orientation}">
              <Track.DecreaseRepeatButton>
                <RepeatButton Command="ScrollBar.PageUpCommand" Focusable="False">
                  <RepeatButton.Template><ControlTemplate TargetType="RepeatButton"><Border Background="Transparent" /></ControlTemplate></RepeatButton.Template>
                </RepeatButton>
              </Track.DecreaseRepeatButton>
              <Track.Thumb>
                <Thumb>
                  <Thumb.Template>
                    <ControlTemplate TargetType="Thumb">
                      <Border x:Name="ScrollThumb" Background="#444B54" CornerRadius="3" Margin="3,2" />
                      <ControlTemplate.Triggers>
                        <Trigger Property="IsMouseOver" Value="True"><Setter TargetName="ScrollThumb" Property="Background" Value="{StaticResource MutedBrush}" /></Trigger>
                        <Trigger Property="IsDragging" Value="True"><Setter TargetName="ScrollThumb" Property="Background" Value="{StaticResource FocusBrush}" /></Trigger>
                      </ControlTemplate.Triggers>
                    </ControlTemplate>
                  </Thumb.Template>
                </Thumb>
              </Track.Thumb>
              <Track.IncreaseRepeatButton>
                <RepeatButton Command="ScrollBar.PageDownCommand" Focusable="False">
                  <RepeatButton.Template><ControlTemplate TargetType="RepeatButton"><Border Background="Transparent" /></ControlTemplate></RepeatButton.Template>
                </RepeatButton>
              </Track.IncreaseRepeatButton>
            </Track>
          </ControlTemplate>
        </Setter.Value>
      </Setter>
    </Style>
 </Window.Resources>
 <ScrollViewer x:Name="ContentScroll" VerticalScrollBarVisibility="Auto" HorizontalScrollBarVisibility="Disabled"><Grid Margin="28"><Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/></Grid.RowDefinitions>
  <Grid><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="150"/></Grid.ColumnDefinitions><StackPanel><StackPanel Orientation="Horizontal"><Image x:Name="BrandIcon" Width="32" Height="32" Margin="0,0,9,0"/><TextBlock Text="CastLink" FontSize="29" FontWeight="SemiBold"/></StackPanel><TextBlock x:Name="BuildText" Text="Версия неизвестна" Foreground="#ADB4BD" FontSize="11" Margin="0,7,0,0" TextWrapping="Wrap"/><TextBlock x:Name="LocalTitle" Text="Локальный сервер" Foreground="#ADB4BD" Margin="0,5,0,20"/></StackPanel><StackPanel Grid.Column="1" Margin="0,2,0,0"><TextBlock x:Name="LanguageTitle" Text="Язык" Foreground="#ADB4BD" FontSize="12" Margin="0,0,0,6"/><StackPanel Orientation="Horizontal"><Button x:Name="LanguageRu" MinHeight="34" FontSize="12" Content="RU" Width="44" Padding="4,5"/><Button x:Name="LanguageEn" MinHeight="34" FontSize="12" Content="EN" Width="44" Padding="4,5" Margin="6,0,0,0"/><Button x:Name="LanguageZh" MinHeight="34" FontSize="12" Content="中文" Width="44" Padding="4,5" Margin="6,0,0,0"/></StackPanel></StackPanel></Grid>
  <Border Grid.Row="1" Background="{StaticResource PanelBrush}" BorderBrush="{StaticResource LineBrush}" BorderThickness="1" CornerRadius="12" Padding="18"><StackPanel><TextBlock x:Name="Summary" Text="Проверяю службы…" FontSize="17" FontWeight="SemiBold" TextWrapping="Wrap"/><TextBlock x:Name="Address" Foreground="#ADB4BD" Margin="0,9,0,0" TextWrapping="Wrap"/></StackPanel></Border>
  <StackPanel Grid.Row="2" Margin="0,20,0,16"><TextBlock x:Name="ServicesTitle" Text="Службы" FontSize="16" FontWeight="SemiBold" Margin="0,0,0,10"/><TextBlock x:Name="Services" Text="Docker Desktop: проверка…" FontSize="14" LineHeight="28" TextWrapping="Wrap"/><TextBlock x:Name="Notice" Foreground="#ADB4BD" Margin="0,12,0,0" TextWrapping="Wrap" FontSize="12"/></StackPanel>
  <StackPanel Grid.Row="3"><Grid><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="10"/><ColumnDefinition Width="120"/></Grid.ColumnDefinitions><Button x:Name="Open" Content="Открыть CastLink" Background="#ACD9BB" Foreground="#111315" FontWeight="SemiBold"/><Button Grid.Column="2" x:Name="Hide" Content="Скрыть в трей" Padding="8,10"/></Grid><Grid Margin="0,10,0,0"><Grid.ColumnDefinitions><ColumnDefinition/><ColumnDefinition Width="10"/><ColumnDefinition/></Grid.ColumnDefinitions><Button x:Name="Start" Content="Запустить службы"/><Button Grid.Column="2" x:Name="Stop" Content="Остановить службы"/></Grid><Button x:Name="Refresh" Content="Обновить статус" Margin="0,10,0,0"/></StackPanel>
  <TextBlock x:Name="Footer" Grid.Row="4" Text="Закрытие окна скрывает панель в трей; службы продолжают работать. Кнопка «Остановить службы» останавливает только этот CastLink; данные сохраняются." TextWrapping="Wrap" Foreground="#ADB4BD" FontSize="12" Margin="0,18,0,0"/>
 </Grid></ScrollViewer>
</Window>
'@
  $reader=New-Object Xml.XmlNodeReader $xaml
  $window=[Windows.Markup.XamlReader]::Load($reader)
  $iconPath=Join-Path $PSScriptRoot 'simple-easy-setup-control.ico'
  $iconStream=[IO.File]::OpenRead($iconPath)
  try{
    $iconDecoder=[Windows.Media.Imaging.BitmapDecoder]::Create($iconStream,[Windows.Media.Imaging.BitmapCreateOptions]::PreservePixelFormat,[Windows.Media.Imaging.BitmapCacheOption]::OnLoad)
    $brandIcon=@($iconDecoder.Frames|Sort-Object PixelWidth -Descending)[0];$brandIcon.Freeze()
  }finally{$iconStream.Dispose()}
  $window.Icon=$brandIcon;$window.FindName('BrandIcon').Source=$brandIcon
  $work=[Windows.SystemParameters]::WorkArea
  $window.MinWidth=[Math]::Min(440,[Math]::Max(1,$work.Width-20));$window.Width=[Math]::Min(520,[Math]::Max(1,$work.Width-20))
  $window.MinHeight=[Math]::Min(480,[Math]::Max(1,$work.Height-20));$window.Height=[Math]::Min(760,[Math]::Max(1,$work.Height-20))
  Update-SimpleControlLanguage $window $Language
  return $window
}
function Update-SimpleControlLanguage([object]$Window,[string]$Language,[object]$Build=$null) {
  $Window.FindName('BuildText').Text=Format-SimpleBuildText $Build $Language
  $Window.FindName('Summary').Text=ConvertTo-SimpleControlText 'Проверяю службы…' $Language
  $Window.FindName('Services').Text=ConvertTo-SimpleControlText 'Docker Desktop: проверка…' $Language
  $texts=@{LocalTitle='Локальный сервер';LanguageTitle='Язык';ServicesTitle='Службы';Footer='Закрытие окна скрывает панель в трей; службы продолжают работать. Кнопка «Остановить службы» останавливает только этот CastLink; данные сохраняются.'}
  foreach($name in $texts.Keys){$Window.FindName($name).Text=ConvertTo-SimpleControlText $texts[$name] $Language}
  foreach($button in @(@('Open','Открыть CastLink'),@('Start','Запустить службы'),@('Stop','Остановить службы'),@('Refresh','Обновить статус'),@('Hide','Скрыть в трей'))){$Window.FindName($button[0]).Content=ConvertTo-SimpleControlText $button[1] $Language}
  foreach($item in @(@('LanguageRu','ru'),@('LanguageEn','en'),@('LanguageZh','zh-CN'))){
    $selected=($item[1] -ceq $Language);$button=$Window.FindName($item[0])
    $button.Background=if($selected){'#ACD9BB'}else{'#25292E'};$button.Foreground=if($selected){'#111315'}else{'#EEF0F2'}
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
  $Window.FindName('Start').IsEnabled=-not $Status.stopped;$Window.FindName('Stop').IsEnabled=-not $Status.stopped
}
function Update-SimpleControlTransition([object]$Window,[object]$State) {
  $locale=$State.language
  $starting=($State.mode -ceq 'start' -and -not $State.closing)
  $summary=if($starting){'Запускаю CastLink…'}else{'Останавливаю CastLink…'}
  $operation=if($starting){'Запуск…'}else{'Остановка…'}
  $serviceState=if($starting){'запускается'}else{'останавливается'}
  $Window.FindName('Summary').Text=ConvertTo-SimpleControlText $summary $locale
  $lines=@('CastLink: '+(ConvertTo-SimpleControlText $operation $locale))
  foreach($name in $State.serviceNames){$lines+=($name+': '+(ConvertTo-SimpleControlText $serviceState $locale))}
  $Window.FindName('Services').Text=$lines -join "`n"
  $elapsed=[int][Math]::Floor([Math]::Max(0,([DateTime]::UtcNow-$State.phaseStarted).TotalSeconds))
  if($starting){
    $phase=ConvertTo-SimpleControlText 'Запускаю Docker Desktop и службы. Это может занять до 2 минут.' $locale
  }elseif($State.mode -ceq 'stop'){
    $phase=ConvertTo-SimpleControlText 'Останавливаю службы CastLink. Данные сохраняются.' $locale
  }else{
    $phase=ConvertTo-SimpleControlText 'Ожидаю завершения текущей операции перед остановкой служб.' $locale
  }
  $counter=(ConvertTo-SimpleControlText 'Прошло {0} с' $locale) -f $elapsed
  $Window.FindName('Notice').Text=$phase+"`n"+$counter
}
function Show-SimpleControlWindow([string]$Folder,[string]$ReadyEvent='') {
  $installation=Read-SimpleControlInstallation $Folder
  $build=Get-SimpleControlBuildMetadata $installation
  Initialize-SimpleControlNative
  $message=[CastLinkControl.Native]::RegisterWindowMessage('CastLinkPanel-'+([Guid]$installation.state.installationId).ToString('N'))
  $session=New-Object Threading.Mutex($false,('Local\CastLink-panel-'+([Guid]$installation.state.installationId).ToString('N')))
  $entered=$false
  try{$entered=$session.WaitOne(0)}catch [Threading.AbandonedMutexException]{$entered=$true}
  $visibleEventName='Local\CastLink-panel-visible-'+([Guid]$installation.state.installationId).ToString('N')
  if(-not $entered){
    try{
      if($ReadyEvent){
        $visible=[Threading.EventWaitHandle]::OpenExisting($visibleEventName)
        try{if(-not $visible.WaitOne(10000)){throw 'Existing panel is still initializing'}}finally{$visible.Dispose()}
      }
      $null=[CastLinkControl.Native]::PostMessage([IntPtr]0xffff,$message,[IntPtr]::Zero,[IntPtr]::Zero)
      Confirm-SimpleControlReady $ReadyEvent;return
    }finally{$session.Dispose()}
  }
  $tray=$null;$trayIcon=$null;$trayMenu=$null;$timer=$null;$window=$null;$visible=$null
  try{
    $visible=New-Object Threading.EventWaitHandle($false,[Threading.EventResetMode]::ManualReset,$visibleEventName)
    $null=$visible.Reset()
    Add-Type -AssemblyName System.Windows.Forms,System.Drawing
    $language=if(Get-Command Get-SimpleGuiLanguage -ErrorAction SilentlyContinue){Get-SimpleGuiLanguage}else{'ru'}
    $window=New-SimpleControlWindow $language
    $window.FindName('BuildText').Text=Format-SimpleBuildText $build $language
    $summary=$window.FindName('Summary');$address=$window.FindName('Address');$notice=$window.FindName('Notice')
    $open=$window.FindName('Open');$start=$window.FindName('Start');$stop=$window.FindName('Stop');$refresh=$window.FindName('Refresh');$hide=$window.FindName('Hide')
    $address.Text=$installation.url;$start.IsEnabled=-not $installation.state.stopped
    $open.Add_Click({Start-Process -FilePath $installation.url}.GetNewClosure())
    $tray=New-Object Windows.Forms.NotifyIcon
    $iconPath=Join-Path $PSScriptRoot 'simple-easy-setup-control.ico'
    if(Test-Path -LiteralPath $iconPath){$trayIcon=New-Object Drawing.Icon($iconPath);$tray.Icon=$trayIcon}else{$tray.Icon=[Drawing.SystemIcons]::Application}
    $tray.Text='CastLink';$trayMenu=New-Object Windows.Forms.ContextMenuStrip
    $trayMenu.RenderMode=[Windows.Forms.ToolStripRenderMode]::System
    $trayMenu.BackColor=[Drawing.ColorTranslator]::FromHtml('#191C20');$trayMenu.ForeColor=[Drawing.ColorTranslator]::FromHtml('#EEF0F2')
    $trayOpen=$trayMenu.Items.Add('Открыть панель');$null=$trayMenu.Items.Add('-');$trayExit=$trayMenu.Items.Add('Остановить и выйти')
    $tray.ContextMenuStrip=$trayMenu;$tray.Visible=$true
    $job=[pscustomobject]@{pipeline=$null;handle=$null;mode='start';next=[DateTime]::UtcNow;language=$language;build=$build;status=$null;notice='';stopped=[bool]$installation.state.stopped;closing=$false;canClose=$false;initial=$true;tray=$tray;trayOpen=$trayOpen;trayExit=$trayExit;phaseStarted=[DateTime]::UtcNow;serviceNames=$installation.services}
    $window.Tag=$job
    $source=$PSCommandPath
    # Event closures keep all helpers/catalog in a private bound object.
    $uiHelpers=New-Module -AsCustomObject -ArgumentList $source -ScriptBlock {
      param([string]$Controller)
      . $Controller -FunctionsOnly
      function Translate([string]$Text,[string]$Locale){return (ConvertTo-SimpleControlText $Text $Locale)}
      function ApplyLanguage([object]$View,[object]$State){
        if(Get-Command Set-SimpleGuiLanguage -ErrorAction SilentlyContinue){$null=Set-SimpleGuiLanguage -Language $State.language}
        Update-SimpleControlLanguage $View $State.language $State.build
        if($State.closing -or ($State.pipeline -and $State.mode -cin @('start','stop'))){Update-SimpleControlTransition $View $State}elseif($State.status){Update-SimpleControlWindow $View $State.status $State.language}
        $State.trayOpen.Text=ConvertTo-SimpleControlText 'Открыть панель' $State.language
        $State.trayExit.Text=ConvertTo-SimpleControlText 'Остановить и выйти' $State.language
      }
      function UpdateStatus([object]$View,[object]$State,[string]$Locale){Update-SimpleControlWindow $View $State $Locale}
      function UpdateTransition([object]$View,[object]$State){Update-SimpleControlTransition $View $State}
      Export-ModuleMember -Function Translate,ApplyLanguage,UpdateStatus,UpdateTransition
    }
    $trayOpen.Text=$uiHelpers.Translate('Открыть панель',$language);$trayExit.Text=$uiHelpers.Translate('Остановить и выйти',$language)
    $restore={
      $window.Show();$window.WindowState='Normal'
      $null=$window.Activate()
      $handle=(New-Object Windows.Interop.WindowInteropHelper($window)).Handle
      if($handle -ne [IntPtr]::Zero){$null=[CastLinkControl.Native]::SetForegroundWindow($handle)}
    }.GetNewClosure()
    # Hide already removes the taskbar button. Changing ShowInTaskbar can
    # recreate the native handle and detach the single-instance restore hook.
    $hide.Add_Click({if(-not $job.closing){$window.Hide()}}.GetNewClosure())
    $trayOpen.Add_Click({& $restore}.GetNewClosure());$tray.Add_DoubleClick({& $restore}.GetNewClosure())
    $window.Add_SourceInitialized({
      $handle=(New-Object Windows.Interop.WindowInteropHelper($window)).Handle
      $nativeSource=[Windows.Interop.HwndSource]::FromHwnd($handle)
      $restoreMessage=$message;$restoreHandler=$restore
      $hookScript={param($hwnd,$msg,$wparam,$lparam,[ref]$handled)
        if($msg -eq $restoreMessage){& $restoreHandler;$handled.Value=$true}
        return [IntPtr]::Zero
      }.GetNewClosure()
      $hook=[Windows.Interop.HwndSourceHook]$hookScript
      $nativeSource.AddHook($hook)
    }.GetNewClosure())
    $begin={param([string]$Mode)
      if($job.pipeline){return}
      $job.notice=if($Mode -ceq 'start'){'Запускаю Docker Desktop и службы. Это может занять до 2 минут.'}elseif($Mode -ceq 'stop'){'Останавливаю службы CastLink. Данные сохраняются.'}else{''}
      $notice.Text=$uiHelpers.Translate($job.notice,$job.language)
      $start.IsEnabled=$false;$stop.IsEnabled=$false;$refresh.IsEnabled=$false;$hide.IsEnabled=-not $job.closing;$job.mode=$Mode
      if($Mode -cin @('start','stop')){$job.status=$null;$job.phaseStarted=[DateTime]::UtcNow;$uiHelpers.UpdateTransition($window,$job)}
      $job.pipeline=[PowerShell]::Create()
      $null=$job.pipeline.AddScript('param($source,$folder,$mode);. $source -FunctionsOnly;. (Join-Path (Split-Path $source -Parent) "simple-easy-setup-deploy.ps1");. (Join-Path (Split-Path $source -Parent) "simple-easy-setup-runtime.ps1");if($mode -ceq "start"){Start-SimpleControlServices $folder}elseif($mode -ceq "stop"){try{$message=Stop-SimpleControlServices $folder;[pscustomobject]@{controlResult="stopped";message=[string]$message}}catch{if($_.Exception.Data["SimpleControlStatus"]){[pscustomobject]@{controlResult="stop-refused";status=$_.Exception.Data["SimpleControlStatus"]}}else{throw}}}else{Get-SimpleControlStatus $folder}').AddArgument($source).AddArgument($Folder).AddArgument($Mode)
      $job.handle=$job.pipeline.BeginInvoke()
    }.GetNewClosure()
    foreach($item in @(@('LanguageRu','ru'),@('LanguageEn','en'),@('LanguageZh','zh-CN'))){
      $selectedLanguage=$item[1]
      $window.FindName($item[0]).Add_Click({
        $job.language=$selectedLanguage;$uiHelpers.ApplyLanguage($window,$job)
        if($job.closing -or ($job.pipeline -and $job.mode -cin @('start','stop'))){$uiHelpers.UpdateTransition($window,$job)}else{$notice.Text=$uiHelpers.Translate($job.notice,$job.language)}
        $start.IsEnabled=-not ($job.stopped -or $job.closing -or $job.pipeline);$stop.IsEnabled=-not ($job.stopped -or $job.closing -or $job.pipeline)
      }.GetNewClosure())
    }
    $start.Add_Click({if(-not $job.closing){& $begin 'start'}}.GetNewClosure());$refresh.Add_Click({if(-not $job.closing){& $begin 'status'}}.GetNewClosure())
    $stop.Add_Click({if(-not $job.closing){& $begin 'stop'}}.GetNewClosure())
    $trayExit.Add_Click({
      & $restore;$job.closing=$true;$job.phaseStarted=[DateTime]::UtcNow;$job.status=$null
      $uiHelpers.UpdateTransition($window,$job)
      $start.IsEnabled=$false;$stop.IsEnabled=$false;$refresh.IsEnabled=$false;$hide.IsEnabled=$false
      if(-not $job.pipeline){& $begin 'stop'}
    }.GetNewClosure())
    $window.Add_Closing({param($sender,$event)
      if($job.canClose){return}
      $event.Cancel=$true;$window.Hide()
    }.GetNewClosure())
    $timer=New-Object Windows.Threading.DispatcherTimer;$timer.Interval=[TimeSpan]::FromMilliseconds(250)
    $timer.Add_Tick({
      if($job.closing -or ($job.pipeline -and $job.mode -cin @('start','stop'))){$uiHelpers.UpdateTransition($window,$job)}
      if($job.pipeline -and $job.handle.IsCompleted){
        $completedMode=$job.mode;$failed=$false;$failureStatus=$null
        try{
          $output=@($job.pipeline.EndInvoke($job.handle))
          # Caught CLI failures remain in HadErrors even after reconciliation.
          # Only explicit authoritative stop outcomes may override that history.
          if($completedMode -ceq 'stop'){
            if($output.Count -eq 1 -and $output[0].controlResult -ceq 'stop-refused'){$failureStatus=$output[0].status;throw 'stop-refused'}
            if($output.Count -ne 1 -or $output[0].controlResult -cne 'stopped'){throw 'operation-refused'}
            $output=@($output[0].message)
          }elseif($job.pipeline.HadErrors){throw 'operation-refused'}
          if($job.closing -and $completedMode -cne 'stop'){$uiHelpers.UpdateTransition($window,$job)}elseif($completedMode -ceq 'status'){$job.status=$output[-1];$job.stopped=[bool]$job.status.stopped;$uiHelpers.UpdateStatus($window,$job.status,$job.language)}else{$job.notice=[string]$output[-1];$notice.Text=$uiHelpers.Translate($job.notice,$job.language)}
        }catch{
          $failed=$true
          if($completedMode -ceq 'stop'){
            $job.closing=$false;$job.status=$failureStatus;& $restore
            if($failureStatus){$uiHelpers.UpdateStatus($window,$failureStatus,$job.language)}else{$window.FindName('Services').Text=$uiHelpers.Translate('Статус служб недоступен',$job.language)}
            $summary.Text=$uiHelpers.Translate('Не удалось остановить службы',$job.language)
            $job.notice='Проверь Docker Desktop и повтори остановку служб. Данные сохранены; панель остаётся открытой.'
          }elseif(-not $job.closing){$summary.Text=$uiHelpers.Translate('Требуется проверка',$job.language);$job.notice='Проверь Docker Desktop и сохранённую установку. Если службы удалены, восстанови их через Easy Setup с той же папкой.'}
          if($job.closing){$uiHelpers.UpdateTransition($window,$job)}else{$notice.Text=$uiHelpers.Translate($job.notice,$job.language)}
        }finally{
          $job.pipeline.Dispose();$job.pipeline=$null;$job.handle=$null;$job.initial=$false
          $start.IsEnabled=-not ($job.stopped -or $job.closing);$stop.IsEnabled=-not ($job.stopped -or $job.closing);$refresh.IsEnabled=-not $job.closing;$hide.IsEnabled=-not $job.closing
          $job.next=[DateTime]::UtcNow.AddSeconds(10)
        }
        if($completedMode -ceq 'stop' -and -not $failed){if($job.closing){$job.canClose=$true;$window.Close();return};$job.next=[DateTime]::UtcNow}
        if($job.closing){& $begin 'stop'}elseif($completedMode -ceq 'start'){$job.next=[DateTime]::UtcNow}
      }
      if(-not $job.pipeline -and -not $job.closing -and [DateTime]::UtcNow -ge $job.next){$mode=if($job.initial){'start'}else{'status'};& $begin $mode}
    }.GetNewClosure())
    $frame=New-Object Windows.Threading.DispatcherFrame
    $window.Add_Closed({$timer.Stop();$tray.Visible=$false;$frame.Continue=$false}.GetNewClosure())
    $timer.Start();$window.Show();$null=$visible.Set();Confirm-SimpleControlReady $ReadyEvent;[Windows.Threading.Dispatcher]::PushFrame($frame)
  }finally{
    if($timer){$timer.Stop()}
    if($tray){$tray.Visible=$false;$tray.Dispose()}
    if($trayMenu){$trayMenu.Dispose()};if($trayIcon){$trayIcon.Dispose()}
    if($visible){$null=$visible.Reset();$visible.Dispose()}
    if($entered){Exit-SimpleControlGuard $session}
  }
}
if(-not $ControlFunctionsOnly){
  # Retired shortcuts from earlier versions must never start services at logon.
  if($Startup){exit 0}
  $launchFolder=$ControlFolder
  . (Join-Path $PSScriptRoot 'simple-easy-setup-deploy.ps1')
  . (Join-Path $PSScriptRoot 'simple-easy-setup-runtime.ps1')
  try{
    Show-SimpleControlWindow $launchFolder $ReadyEvent
  }catch{
      Add-Type -AssemblyName PresentationFramework
      $language=if(Get-Command Get-SimpleGuiLanguage -ErrorAction SilentlyContinue){Get-SimpleGuiLanguage}else{'ru'}
      $message=ConvertTo-SimpleControlText 'Не удалось открыть управление CastLink. Проверь сохранённую папку установки и Docker Desktop. Данные не изменены.' $language
      $null=[Windows.MessageBox]::Show($message,'CastLink')
    exit 1
  }
}
