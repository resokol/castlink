param([string]$ControlPath,[string]$ProofFolder='')
$ErrorActionPreference='Stop'
$FunctionsOnly=$false
. $ControlPath -FunctionsOnly
if($FunctionsOnly){throw 'Control helper clobbered installer FunctionsOnly launch mode'}
$source=Split-Path $ControlPath -Parent
. (Join-Path $source 'simple-easy-setup-deploy.ps1')
. (Join-Path $source 'simple-easy-setup-runtime.ps1')
$script:realControlInvoke=${function:Invoke-SimpleProcess}
$root=Join-Path $env:TEMP ('castlink-control-fixture-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory -Path $root
$script:controlDesktop=Join-Path $root 'desktop';$script:controlStartup=Join-Path $root 'startup'
function Get-SimpleControlLinkFolder([string]$Kind){if($Kind -ceq 'desktop'){return $script:controlDesktop};return $script:controlStartup}
function Get-SimpleRuntimeReceiptPath {return (Join-Path $root 'runtime.json')}
$script:controlCalls=New-Object Collections.Generic.List[object]
$script:controlRows='';$script:controlRemoved=$false;$script:controlForeign=$false
$script:fakeDesktop=Join-Path $root 'Docker Desktop.exe'
$script:fakeDocker=Join-Path $root 'resources/bin/docker.exe'
$null=New-Item -ItemType Directory -Path (Split-Path $script:fakeDocker -Parent) -Force
Write-SimpleText $script:fakeDesktop 'fixture';Write-SimpleText $script:fakeDocker 'fixture'
function Find-Desktop {return $script:fakeDesktop}
$script:engineReady=$true;$script:desktopStarts=0
function Test-LinuxEngine([string]$Docker){return $script:engineReady}
function Get-Process {return $null}
function Start-Process([string]$FilePath,[switch]$PassThru){if($FilePath -cne $script:fakeDesktop){throw 'Unexpected native start'};$script:desktopStarts++;$script:engineReady=$true}
function Invoke-SimpleProcess([string]$File,[string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900){
  if($File -cne $script:fakeDocker -or $Arguments[0] -cne '--context' -or $Arguments[1] -cne 'desktop-linux'){throw 'Controller escaped selected Desktop Linux engine'}
  $script:controlCalls.Add([pscustomobject]@{arguments=$Arguments;timeout=$TimeoutSeconds})
  $argsOnly=$Arguments[2..($Arguments.Count-1)];$out=''
  if($argsOnly[0] -ceq 'ps'){
    if($argsOnly -contains '--format'){$out=$script:controlRows}else{if(-not $script:controlRemoved){$out='own-container'}}
  }elseif($argsOnly[0] -ceq 'inspect'){
    $project=$script:controlProject;if($script:controlForeign){$project='other-project'}
    $out=ConvertTo-Json -InputObject @([pscustomobject]@{Config=[pscustomobject]@{Labels=[pscustomobject]@{'com.docker.compose.project'=$project;'com.docker.compose.service'='web'}}}) -Depth 8 -Compress
  }elseif($argsOnly[0] -ceq 'compose'){
    if($argsOnly -contains 'down'){$script:controlRemoved=$true}
    elseif($argsOnly -notcontains 'start'){throw 'Controller created or rebuilt containers'}
  }elseif($argsOnly[0] -cnotin @('volume','network')){throw 'Unexpected Docker command'}
  return [pscustomobject]@{code=0;stdout=$out;stderr=''}
}
function Get-SimpleControlHttps([string]$Url){return $script:httpsStatus}
function New-ControlFixtureInstall([string]$Name){
  $folder=Join-Path $root $Name;$null=New-Item -ItemType Directory -Path $folder
  $null=Open-SimpleOwnership $folder -FolderWasNew
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:test';postgres='postgres:test';livekit='livekit:test';caddy='caddy:test'}}
  $state=New-SimpleConfiguration $folder '192.168.1.22' $false $release
  Set-SimpleTarget $folder $state 'local';$state.completed=$true;Save-SimpleState $folder $state
  Write-SimpleConfiguration $folder $state $release '192.168.1.22'
  return [pscustomobject]@{folder=$folder;state=$state;release=$release}
}
try {
  $install=New-ControlFixtureInstall 'local'
  $incoming=Join-Path $root 'incoming';$null=New-Item -ItemType Directory -Path $incoming
  foreach($name in @('simple-easy-setup-control.ps1','simple-easy-setup-cleanup.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-language.ps1','simple-easy-setup-control.ico')){Copy-Item -LiteralPath (Join-Path $source $name) -Destination $incoming}
  $null=New-Item -ItemType Directory -Path $script:controlDesktop
  $preexisting=Join-Path $script:controlDesktop 'CastLink.lnk';Write-SimpleText $preexisting 'PREEXISTING USER SHORTCUT'
  $null=Install-SimpleLocalControl $install.folder $install.state $incoming
  $null=Update-SimpleOwnership $install.folder $install.state
  $owned=Open-SimpleOwnership $install.folder
  if($owned.windowsLinks.Count -ne 2 -or [IO.File]::ReadAllText($preexisting) -cne 'PREEXISTING USER SHORTCUT'){throw 'Pre-existing Desktop shortcut overwritten or new links missing'}
  $shell=New-Object -ComObject WScript.Shell
  try{
    foreach($linkEntry in $owned.windowsLinks){
      $link=$shell.CreateShortcut($linkEntry.path)
      try{
        if($link.TargetPath -cne (Get-SimpleControlPowerShell) -or $link.Arguments -notmatch '\.castlink-control' -or $link.Arguments.Contains($incoming) -or $link.WorkingDirectory -cne $install.folder -or $link.IconLocation -notmatch '\.castlink-control.*\.ico'){throw 'Shortcut is not a persistent branded controller'}
        if(($linkEntry.kind -ceq 'startup') -ne $link.Arguments.EndsWith(' -Startup')){throw 'Desktop/startup launch modes crossed'}
      }finally{$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)}
    }
  }finally{$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
  $null=Install-SimpleLocalControl $install.folder $install.state $incoming
  $owned=Open-SimpleOwnership $install.folder
  if($owned.windowsLinks.Count -ne 2 -or @($owned.files|Where-Object{$_.path -like '.castlink-control/*'}).Count -ne 6){throw 'Repeated setup lost persistent ownership'}
  Remove-Item -LiteralPath $incoming -Recurse -Force
  $persisted=Join-Path $install.folder '.castlink-control/simple-easy-setup-control.ps1'
  $code='param($controller,$folder);. $controller -FunctionsOnly;. (Join-Path (Split-Path $controller -Parent) "simple-easy-setup-deploy.ps1");. (Join-Path (Split-Path $controller -Parent) "simple-easy-setup-runtime.ps1");(Read-SimpleControlInstallation $folder).project'
  $childScript=Join-Path $root 'persisted-check.ps1';Write-SimpleText $childScript $code
  # Real child loads the persisted helper set after the extracted source is gone.
  $child=& $script:realControlInvoke -File (Get-SimpleControlPowerShell) -Arguments @('-NoProfile','-NonInteractive','-File',$childScript,$persisted,$install.folder) -TimeoutSeconds 20
  if($child.code -ne 0 -or $child.stdout.Trim() -cne ('castlink-easy-'+$install.state.installationId.Replace('-',''))){throw 'Persisted controller still depends on removed ZIP/source'}
  $script:controlProject='castlink-easy-'+$install.state.installationId.Replace('-','')
  $script:controlRows="caddy|exited`nlivekit|running`npostgres|running`nweb|exited";$script:httpsStatus='HTTPS недоступен'
  $script:engineReady=$false;$null=Start-SimpleControlServices $install.folder 0
  $startCalls=@($script:controlCalls|Where-Object{$_.arguments -contains 'start'})
  if($script:desktopStarts -ne 1 -or $startCalls.Count -ne 1 -or $startCalls[0].arguments -notcontains $script:controlProject -or $startCalls[0].timeout -ne 60){throw 'Scoped startup did not start signed Desktop/existing target containers'}
  $script:controlCalls.Clear();$status=Get-SimpleControlStatus $install.folder
  if($status.https -cne 'HTTPS недоступен' -or $status.summary -cne 'Часть служб не работает' -or @($script:controlCalls|Where-Object{$_.arguments[2] -ceq 'compose'}).Count){throw 'Read-only status mutated services or hid application unavailability'}
  $script:controlRows="caddy|running`nlivekit|running`npostgres|running`nweb|running";$script:httpsStatus='Сертификат HTTPS не доверен'
  $status=Get-SimpleControlStatus $install.folder
  if($status.summary -cne 'Контейнеры запущены; HTTPS не готов'){throw 'Running containers falsely claimed healthy CastLink'}
  $script:httpsStatus='Доступен по HTTPS';$status=Get-SimpleControlStatus $install.folder
  if($status.summary -cne 'CastLink доступен'){throw 'Verified application status not shown'}
  foreach($failure in @('stopped','remote','foreign','missing','duplicate')){
    $script:controlCalls.Clear();$candidate=$install.state|ConvertTo-Json -Depth 10|ConvertFrom-Json
    $script:controlForeign=($failure -ceq 'foreign')
    $script:controlRows="caddy|exited`nlivekit|running`npostgres|running`nweb|running"
    if($failure -ceq 'stopped'){$candidate|Add-Member -NotePropertyName stopped -NotePropertyValue $true -Force}
    if($failure -ceq 'remote'){$candidate.target='remote'}
    if($failure -ceq 'missing'){$script:controlRows="caddy|exited`nlivekit|running`nweb|running"}
    if($failure -ceq 'duplicate'){$script:controlRows+="`nweb|running"}
    Save-SimpleState $install.folder $candidate
    $refused=$false;try{$null=Start-SimpleControlServices $install.folder 0}catch{$refused=$true}
    if(-not $refused -or @($script:controlCalls|Where-Object{$_.arguments -contains 'start'}).Count){throw ('Unsafe startup accepted: '+$failure)}
  }
  $script:controlForeign=$false;Save-SimpleState $install.folder $install.state
  $script:controlCalls.Clear();$script:controlRows="caddy|running`nlivekit|running`npostgres|running`nweb|running"
  $null=Start-SimpleControlServices $install.folder 0
  if(@($script:controlCalls|Where-Object{$_.arguments -contains 'start'}).Count){throw 'Already-running containers unnecessarily restarted'}
  # Changed and forged external entries stay untouched; only exact owned links go.
  $desktopEntry=@($owned.windowsLinks|Where-Object{$_.kind -ceq 'desktop'})[0]
  Write-SimpleText $desktopEntry.path 'USER MODIFICATION'
  $foreign=Join-Path $root 'foreign.lnk';Write-SimpleText $foreign 'FOREIGN'
  $owned.windowsLinks+= [pscustomobject]@{kind='startup';path=$foreign;sha256=(Get-FileHash -LiteralPath $foreign).Hash.ToLowerInvariant()}
  Save-SimpleControlOwnership $install.folder $owned
  $null=Remove-SimpleDeployment $install.folder $install.state -Confirmed
  if(-not(Test-Path -LiteralPath $desktopEntry.path) -or -not(Test-Path -LiteralPath $foreign) -or @(Get-ChildItem -LiteralPath $script:controlStartup -File).Count -or -not (Get-Content -LiteralPath (Join-Path $install.folder '.castlink-install.json') -Raw|ConvertFrom-Json).stopped){throw 'Data-preserving uninstall removed user assets or kept owned startup'}
  $full=New-ControlFixtureInstall 'full';$script:controlRemoved=$false
  $null=Install-SimpleLocalControl $full.folder $full.state $source
  $fullLinks=@((Open-SimpleOwnership $full.folder).windowsLinks|ForEach-Object{$_.path})
  $script:controlProject='castlink-easy-'+$full.state.installationId.Replace('-','')
  $script:ServerFolder=$full.folder.Replace('\','/')
  $null=Remove-SimpleDeployment $full.folder $full.state -Confirmed -DeleteData -DeferFileCleanup
  if(@($fullLinks|Where-Object{Test-Path -LiteralPath $_}).Count -or (Test-Path -LiteralPath (Join-Path $full.folder '.castlink-install.json'))){throw 'Full removal kept owned desktop/startup links'}
  $remote=New-ControlFixtureInstall 'remote';$remote.state.target='remote'
  $null=Install-SimpleLocalControl $remote.folder $remote.state $source
  if(Test-Path -LiteralPath (Join-Path $remote.folder '.castlink-control')){throw 'Remote install enabled local server controller/autostart'}
  $userFiles=New-ControlFixtureInstall 'user-created-control'
  $userControl=Join-Path $userFiles.folder '.castlink-control/simple-easy-setup-control.ps1'
  $null=New-Item -ItemType Directory -Path (Split-Path $userControl -Parent)
  Write-SimpleText $userControl 'USER CREATED AFTER OWNERSHIP BASELINE'
  foreach($attempt in 1..2){
    $refused=$false;try{$null=Install-SimpleLocalControl $userFiles.folder $userFiles.state $source}catch{$refused=$true}
    # Match the installer's finally path before a later retry.
    $checked=Update-SimpleOwnership $userFiles.folder $userFiles.state
    if(-not $refused -or [IO.File]::ReadAllText($userControl) -cne 'USER CREATED AFTER OWNERSHIP BASELINE' -or @($checked.files|Where-Object{$_.path.Replace('\','/') -ceq '.castlink-control/simple-easy-setup-control.ps1'}).Count){throw 'After-baseline user control file adopted or overwritten'}
  }
  if($ProofFolder){
    $null=New-Item -ItemType Directory -Path $ProofFolder -Force
    Add-Type -AssemblyName PresentationCore
    foreach($locale in @('ru','en','zh-CN')){
      $status.stopped=$false;$window=New-SimpleControlWindow $locale
      try{
        Update-SimpleControlWindow $window $status $locale
        $window.Show();$window.UpdateLayout()
        $null=$window.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::Render)
        $bitmap=New-Object Windows.Media.Imaging.RenderTargetBitmap([int]$window.ActualWidth,[int]$window.ActualHeight,96,96,[Windows.Media.PixelFormats]::Pbgra32)
        $bitmap.Render($window);$encoder=New-Object Windows.Media.Imaging.PngBitmapEncoder;$encoder.Frames.Add([Windows.Media.Imaging.BitmapFrame]::Create($bitmap))
        $stream=[IO.File]::Create((Join-Path $ProofFolder ('castlink-control-'+$locale+'.png')));try{$encoder.Save($stream)}finally{$stream.Dispose()}
        if($window.FindName('Summary').Text -cne (ConvertTo-SimpleControlText 'CastLink доступен' $locale) -or $window.FindName('Start').IsEnabled -ne $true){throw 'Actual WPF renderer missed healthy services'}
        if(($window.FindName('Services').Text -split "`n").Count -ne 6){throw 'Service renderer joined unrelated status lines'}
        if($locale -cne 'ru'){
          foreach($name in @('LocalTitle','LanguageTitle','ServicesTitle','Footer','Summary','Services')){if($window.FindName($name).Text -match '[\u0400-\u04ff]'){throw ('Companion text not translated: '+$locale+' '+$name)}}
          foreach($name in @('Open','Start','Refresh')){if($window.FindName($name).Content -match '[\u0400-\u04ff]'){throw ('Companion button not translated: '+$locale+' '+$name)}}
        }
        $footer=$window.FindName('Footer');$origin=$footer.TranslatePoint((New-Object Windows.Point(0,0)),$window)
        if($origin.Y+$footer.ActualHeight -gt $window.ActualHeight){throw 'Companion footer clipped outside the window'}
        $status.stopped=$true;Update-SimpleControlWindow $window $status $locale
        if($window.FindName('Start').IsEnabled){throw 'Actual controller offered start after removal preserving data'}
      }finally{$window.Close()}
    }
  }
  # Drive the actual ShowDialog, dispatcher timer and async worker. Only the
  # native Docker/HTTPS boundaries are replaced in this isolated source copy.
  $ui=New-ControlFixtureInstall 'event-loop'
  $null=Update-SimpleOwnership $ui.folder $ui.state
  $uiSource=Join-Path $root 'ui-source';$null=New-Item -ItemType Directory -Path $uiSource
  Copy-Item -LiteralPath $ControlPath -Destination (Join-Path $uiSource 'simple-easy-setup-control.ps1')
  Copy-Item -LiteralPath (Join-Path $source 'simple-easy-setup-language.ps1') -Destination $uiSource
  $uiLog=Join-Path $root 'ui-worker.log';$uiProject='castlink-easy-'+$ui.state.installationId.Replace('-','')
  $boundary=@'
. '__SOURCE__/simple-easy-setup-deploy.ps1'
function Invoke-SimpleProcess([string]$File,[string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900){
  if($File -cne '__DOCKER__' -or $Arguments[0] -cne '--context' -or $Arguments[1] -cne 'desktop-linux' -or $Arguments[2] -cne 'ps' -or $Arguments -notcontains 'label=com.docker.compose.project=__PROJECT__'){throw 'UI worker escaped read-only fixture scope'}
  [IO.File]::AppendAllText('__LOG__',"query`n")
  return [pscustomobject]@{code=0;stdout="caddy|running`nlivekit|running`npostgres|running`nweb|running";stderr=''}
}
'@
  $boundary=$boundary.Replace('__SOURCE__',$source.Replace("'","''")).Replace('__DOCKER__',$script:fakeDocker.Replace("'","''")).Replace('__PROJECT__',$uiProject).Replace('__LOG__',$uiLog.Replace("'","''"))
  [IO.File]::WriteAllText((Join-Path $uiSource 'simple-easy-setup-deploy.ps1'),$boundary,(New-Object Text.UTF8Encoding($true)))
  $runtime=@'
. '__SOURCE__/simple-easy-setup-runtime.ps1'
function Find-Desktop {return '__DESKTOP__'}
function Test-LinuxEngine([string]$Docker){return $true}
function Get-SimpleControlHttps([string]$Url){return 'Доступен по HTTPS'}
'@
  $runtime=$runtime.Replace('__SOURCE__',$source.Replace("'","''")).Replace('__DESKTOP__',$script:fakeDesktop.Replace("'","''"))
  [IO.File]::WriteAllText((Join-Path $uiSource 'simple-easy-setup-runtime.ps1'),$runtime,(New-Object Text.UTF8Encoding($true)))
  . (Join-Path $uiSource 'simple-easy-setup-control.ps1') -FunctionsOnly
  $script:controlRealWindow=${function:New-SimpleControlWindow}
  $script:uiFlow=[pscustomobject]@{stage=0;finished=$false;timedOut=$false;closed=$false;deadline=[DateTime]::UtcNow.AddSeconds(30);timer=$null}
  function Get-SimpleGuiLanguage {return 'ru'}
  function Set-SimpleGuiLanguage([string]$Language){throw 'UI fixture must not change user language preference'}
  function New-SimpleControlWindow([string]$Language='ru'){
    $view=& $script:controlRealWindow $Language
    $flow=$script:uiFlow
    $flow.timer=New-Object Windows.Threading.DispatcherTimer
    $flow.timer.Interval=[TimeSpan]::FromMilliseconds(100)
    $flow.timer.Add_Tick({
      if([DateTime]::UtcNow -gt $flow.deadline){$flow.timedOut=$true;$flow.timer.Stop();$view.Close();return}
      $refreshButton=$view.FindName('Refresh');$startButton=$view.FindName('Start')
      if($view.FindName('Summary').Text -cne 'CastLink доступен' -or -not $refreshButton.IsEnabled){return}
      if($flow.stage -eq 0){
        $refreshButton.RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        if($refreshButton.IsEnabled){throw 'Actual Refresh did not dispatch an async status worker'}
        $flow.stage=1
      }elseif($flow.stage -eq 1){
        $startButton.RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        if($refreshButton.IsEnabled -or $startButton.IsEnabled){throw 'Actual Start did not dispatch a bounded async worker'}
        $flow.stage=2
      }else{
        $flow.finished=$true;$flow.timer.Stop();$view.Close()
      }
    }.GetNewClosure())
    $view.Add_Loaded({$flow.timer.Start()}.GetNewClosure())
    $view.Add_Closed({$flow.closed=$true;$flow.timer.Stop()}.GetNewClosure())
    return $view
  }
  Show-SimpleControlWindow $ui.folder
  if(-not $script:uiFlow.finished -or -not $script:uiFlow.closed -or $script:uiFlow.timedOut -or @([IO.File]::ReadAllLines($uiLog)).Count -lt 3){throw 'Actual control Show/timer/async/Refresh/Start/Closed lifecycle did not complete'}
  Write-Output 'SIMPLE_CONTROL_FIXTURES_PASS persistent-COM-shortcuts branded-icon logon-desktop-linux read-only-health scoped-start foreign/missing/stopped-refusal uninstall-preservation WPF'
  $global:LASTEXITCODE=0
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
