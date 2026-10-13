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
$script:controlRows='';$script:controlRemoved=$false;$script:controlForeign=$false;$script:controlStopFail=$false;$script:controlTimeoutMode='';$script:controlSettleReads=0
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
    if($argsOnly -contains '--format'){if($script:controlSettleReads -gt 0){$script:controlSettleReads--;if($script:controlSettleReads -eq 0){$script:controlRows=($script:controlRows -replace '\|running','|exited')}};$out=$script:controlRows}else{if(-not $script:controlRemoved){$names=@($script:controlRows -split '\r?\n'|Where-Object{$_}|ForEach-Object{$_.Split('|')[0]});$out=(@(for($i=0;$i -lt $names.Count;$i++){($i+1).ToString('x12')}) -join "`n")}}
  }elseif($argsOnly[0] -ceq 'inspect'){
    $project=$script:controlProject;if($script:controlForeign){$project='other-project'}
    $names=@($script:controlRows -split '\r?\n'|Where-Object{$_}|ForEach-Object{$_.Split('|')[0]})
    $objects=@(foreach($id in $argsOnly[1..($argsOnly.Count-1)]){$index=[Convert]::ToInt32($id,16)-1;[pscustomobject]@{Config=[pscustomobject]@{Labels=[pscustomobject]@{'com.docker.compose.project'=$project;'com.docker.compose.service'=$names[$index]}}}})
    $out=ConvertTo-Json -InputObject $objects -Depth 8 -Compress
  }elseif($argsOnly[0] -ceq 'compose'){
    if($argsOnly -contains 'down'){$script:controlRemoved=$true}
    elseif($argsOnly -contains 'stop'){
      if($script:controlTimeoutMode -ceq 'running'){throw (New-Object TimeoutException 'fixture timeout')}
      if($script:controlTimeoutMode -ceq 'settle'){$script:controlSettleReads=2;throw (New-Object TimeoutException 'fixture timeout')}
      if($script:controlStopFail){return [pscustomobject]@{code=7;stdout='';stderr='fixture stop failure'}}
      $script:controlRows=(@($script:controlRows -split '\r?\n'|Where-Object{$_}|ForEach-Object{$_.Split('|')[0]+'|exited'}) -join "`n")
      if($script:controlTimeoutMode -ceq 'stopped'){throw (New-Object TimeoutException 'fixture timeout')}
    }elseif($argsOnly -notcontains 'start'){throw 'Controller created or rebuilt containers'}
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
  if($owned.windowsLinks.Count -ne 1 -or [IO.File]::ReadAllText($preexisting) -cne 'PREEXISTING USER SHORTCUT'){throw 'Pre-existing Desktop shortcut overwritten or new links missing'}
  $shell=New-Object -ComObject WScript.Shell
  try{
    foreach($linkEntry in $owned.windowsLinks){
      $link=$shell.CreateShortcut($linkEntry.path)
      try{
        if($link.TargetPath -cne (Get-SimpleControlPowerShell) -or $link.Arguments -notmatch '\.castlink-control' -or $link.Arguments.Contains($incoming) -or $link.WorkingDirectory -cne $install.folder -or $link.IconLocation -notmatch '\.castlink-control.*\.ico'){throw 'Shortcut is not a persistent branded controller'}
        if($linkEntry.kind -cne 'desktop' -or $link.Arguments.EndsWith(' -Startup')){throw 'Desktop installed a logon startup mode'}
      }finally{$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($link)}
    }
  }finally{$null=[Runtime.InteropServices.Marshal]::FinalReleaseComObject($shell)}
  # Retire only the exact unchanged Startup link owned by the previous version.
  $null=New-Item -ItemType Directory -Path $script:controlStartup -Force
  $oldStartup=Join-Path $script:controlStartup (@(Get-SimpleControlLinkNames 'startup' $install.state.installationId)[0])
  Write-SimpleText $oldStartup 'OLD OWNED STARTUP'
  $foreignStartup=Join-Path $script:controlStartup 'Preexisting Startup.lnk';Write-SimpleText $foreignStartup 'USER STARTUP'
  $owned.windowsLinks+= [pscustomobject]@{kind='startup';path=$oldStartup;sha256=(Get-FileHash -LiteralPath $oldStartup).Hash.ToLowerInvariant()}
  Save-SimpleControlOwnership $install.folder $owned
  $null=Install-SimpleLocalControl $install.folder $install.state $incoming
  $owned=Open-SimpleOwnership $install.folder
  if((Test-Path -LiteralPath $oldStartup) -or -not(Test-Path -LiteralPath $foreignStartup)){throw 'Upgrade did not retire only its owned Startup link'}
  if($owned.windowsLinks.Count -ne 1 -or @($owned.files|Where-Object{$_.path -like '.castlink-control/*'}).Count -ne 6){throw 'Repeated setup lost persistent ownership'}
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
  $script:controlCalls.Clear();$beforeCompose=[IO.File]::ReadAllText((Join-Path $install.folder 'compose.json'))
  $null=Stop-SimpleControlServices $install.folder
  $stops=@($script:controlCalls|Where-Object{$_.arguments -contains 'stop'})
  if($stops.Count -ne 1 -or $stops[0].timeout -ne 75 -or $stops[0].arguments -notcontains $script:controlProject -or $stops[0].arguments -contains 'down' -or $stops[0].arguments -contains '--volumes' -or [IO.File]::ReadAllText((Join-Path $install.folder 'compose.json')) -cne $beforeCompose){throw 'Panel stop escaped its project or changed retained configuration'}
  $plan=Read-SimpleControlInstallation $install.folder
  if((Get-SimpleControlStopTimeout $plan @('caddy','postgres')) -ne 55 -or (Get-SimpleControlStopTimeout $plan @('postgres')) -ne 35){throw 'Partial stop lost transitive dependency ordering or active-only deadline'}
  $turnPlan=$plan|ConvertTo-Json -Depth 15|ConvertFrom-Json
  $turnPlan.services+= 'turn-tls';$turnPlan.compose.services|Add-Member -NotePropertyName 'turn-tls' -NotePropertyValue ([pscustomobject]@{depends_on=@('caddy','livekit')})
  if((Get-SimpleControlStopTimeout $turnPlan) -ne 95){throw 'TURN stop did not account for fourth dependency wave'}
  foreach($mode in @('stopped','settle','running')){
    $script:controlRows="caddy|running`nlivekit|running`npostgres|running`nweb|running";$script:controlTimeoutMode=$mode;$script:controlCalls.Clear();$failed=$false;$observed=$null
    try{$null=Stop-SimpleControlServices $install.folder -SettleSeconds $(if($mode -ceq 'settle'){2}else{0})}catch{$failed=$true;$observed=$_.Exception.Data['SimpleControlStatus']}
    if($mode -ceq 'running'){
      if(-not $failed -or -not $observed -or @($observed.services|Where-Object{$_.state -ceq 'running'}).Count -ne 4){throw 'True timeout did not retain failure with rechecked active service states'}
    }elseif($failed -or $script:controlRows -match '\|running'){throw 'CLI timeout falsely failed after daemon confirmed services stopped'}
    if(@($script:controlCalls|Where-Object{$_.arguments -contains 'stop'}).Count -ne 1){throw 'Timeout reconciliation repeated a mutating stop'}
  }
  $script:controlTimeoutMode='';$script:controlRows="caddy|exited`nlivekit|exited`npostgres|running`nweb|exited";$script:controlCalls.Clear()
  $null=Stop-SimpleControlServices $install.folder
  $partial=@($script:controlCalls|Where-Object{$_.arguments -contains 'stop'})
  if($partial.Count -ne 1 -or $partial[0].timeout -ne 35 -or $partial[0].arguments[-1] -cne 'postgres'){throw 'Retry stopped inactive services or forgot PostgreSQL graceful deadline'}
  $script:controlRows="caddy|running`nlivekit|running`npostgres|running`nweb|running";$script:controlStopFail=$true
  $refused=$false;try{$null=Stop-SimpleControlServices $install.folder}catch{$refused=$true}
  if(-not $refused -or $script:controlRows -notmatch 'running'){throw 'Failed stop falsely claimed services stopped'}
  $script:controlStopFail=$false
  $script:controlForeign=$true;$script:controlCalls.Clear()
  $refused=$false;try{$null=Stop-SimpleControlServices $install.folder}catch{$refused=$true}
  if(-not $refused -or @($script:controlCalls|Where-Object{$_.arguments -contains 'stop'}).Count){throw 'Panel stopped a foreign project'}
  $script:controlForeign=$false
  $localCompose=Get-Content -LiteralPath (Join-Path $install.folder 'compose.json') -Raw|ConvertFrom-Json
  if(@($localCompose.services.PSObject.Properties.Value|Where-Object{$_.restart -cne 'no'}).Count){throw 'Local services could restart before panel opens'}
  $legacyProbe=& $script:realControlInvoke -File (Get-SimpleControlPowerShell) -Arguments @('-NoProfile','-NonInteractive','-File',$persisted,'-ControlFolder',$install.folder,'-Startup') -TimeoutSeconds 15
  if($legacyProbe.code -ne 0 -or $legacyProbe.stdout.Length -or $legacyProbe.stderr.Length){throw 'Retired Startup shortcut did not exit without starting services'}
  # Changed and forged external entries stay untouched; only exact owned links go.
  $desktopEntry=@($owned.windowsLinks|Where-Object{$_.kind -ceq 'desktop'})[0]
  Write-SimpleText $desktopEntry.path 'USER MODIFICATION'
  $foreign=Join-Path $root 'foreign.lnk';Write-SimpleText $foreign 'FOREIGN'
  $owned.windowsLinks+= [pscustomobject]@{kind='startup';path=$foreign;sha256=(Get-FileHash -LiteralPath $foreign).Hash.ToLowerInvariant()}
  Save-SimpleControlOwnership $install.folder $owned
  $null=Remove-SimpleDeployment $install.folder $install.state -Confirmed
  if(-not(Test-Path -LiteralPath $desktopEntry.path) -or -not(Test-Path -LiteralPath $foreign) -or @(Get-ChildItem -LiteralPath $script:controlStartup -File).Count -ne 1 -or -not (Get-Content -LiteralPath (Join-Path $install.folder '.castlink-install.json') -Raw|ConvertFrom-Json).stopped){throw 'Data-preserving uninstall removed user assets or kept owned startup'}
  $full=New-ControlFixtureInstall 'full';$script:controlRemoved=$false
  $null=Install-SimpleLocalControl $full.folder $full.state $source
  $fullLinks=@((Open-SimpleOwnership $full.folder).windowsLinks|ForEach-Object{$_.path})
  $script:controlProject='castlink-easy-'+$full.state.installationId.Replace('-','')
  $script:ServerFolder=$full.folder.Replace('\','/')
  $null=Remove-SimpleDeployment $full.folder $full.state -Confirmed -DeleteData -DeferFileCleanup
  if(@($fullLinks|Where-Object{Test-Path -LiteralPath $_}).Count -or (Test-Path -LiteralPath (Join-Path $full.folder '.castlink-install.json'))){throw 'Full removal kept owned desktop/startup links'}
  $remote=New-ControlFixtureInstall 'remote';$remote.state.target='remote'
  Write-SimpleConfiguration $remote.folder $remote.state $remote.release '192.168.1.22'
  $remoteCompose=Get-Content -LiteralPath (Join-Path $remote.folder 'compose.json') -Raw|ConvertFrom-Json
  if(@($remoteCompose.services.PSObject.Properties.Value|Where-Object{$_.restart -cne 'unless-stopped'}).Count){throw 'VPS background restart policy changed'}
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
          foreach($name in @('Open','Start','Refresh','Hide')){if($window.FindName($name).Content -match '[\u0400-\u04ff]'){throw ('Companion button not translated: '+$locale+' '+$name)}}
        }
        $footer=$window.FindName('Footer');$origin=$footer.TranslatePoint((New-Object Windows.Point(0,0)),$window)
        if($origin.Y+$footer.ActualHeight -gt $window.ActualHeight){throw 'Companion footer clipped outside the window'}
        $status.stopped=$true;Update-SimpleControlWindow $window $status $locale
        if($window.FindName('Start').IsEnabled){throw 'Actual controller offered start after removal preserving data'}
      }finally{$window.Close()}
    }
  }
  # Native runspace boundary: a caught terminating error still marks HadErrors,
  # while the successful output carries the reconciled stop-refused snapshot.
  $caughtWorker=[PowerShell]::Create()
  try{
    $null=$caughtWorker.AddScript('try{throw (New-Object InvalidOperationException "fixture stop refusal")}catch{[pscustomobject]@{controlResult="stop-refused";status=[pscustomobject]@{services=@([pscustomobject]@{name="postgres";state="running"})}}}')
    $caughtHandle=$caughtWorker.BeginInvoke();$caughtOutput=@($caughtWorker.EndInvoke($caughtHandle))
    if(-not $caughtWorker.HadErrors -or $caughtOutput.Count -ne 1 -or $caughtOutput[0].controlResult -cne 'stop-refused' -or $caughtOutput[0].status.services[0].state -cne 'running'){throw 'Native caught-error worker did not retain both error history and reconciled status output'}
  }finally{$caughtWorker.Dispose()}
  # Genuine -File sessions: opening starts, tray keeps working, and Exit/X stop.
  foreach($scenario in @('tray','close-start')){
    $ui=New-ControlFixtureInstall ('event-'+$scenario);$null=Update-SimpleOwnership $ui.folder $ui.state
    $uiSource=Join-Path $root ('ui-source-'+$scenario);$null=New-Item -ItemType Directory -Path $uiSource
    foreach($name in @('simple-easy-setup-control.ps1','simple-easy-setup-language.ps1','simple-easy-setup-control.ico')){Copy-Item -LiteralPath (Join-Path $source $name) -Destination $uiSource}
    $uiLog=Join-Path $root ($scenario+'.log');$running=Join-Path $root ($scenario+'.running');$uiProject='castlink-easy-'+$ui.state.installationId.Replace('-','')
    $boundary=@'
. '__SOURCE__/simple-easy-setup-deploy.ps1'
$script:realNative=${function:Invoke-SimpleProcess}
function Invoke-SimpleProcess([string]$File,[string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900){
  if($File -cne '__DOCKER__' -or $Arguments[0] -cne '--context' -or $Arguments[1] -cne 'desktop-linux'){throw 'UI worker escaped Desktop Linux fixture'}
  $argsOnly=$Arguments[2..($Arguments.Count-1)];$out='';$names=@('caddy','livekit','postgres','web')
  if($argsOnly[0] -ceq 'ps'){
    if($argsOnly -notcontains 'label=com.docker.compose.project=__PROJECT__'){throw 'UI worker queried another project'}
    if($argsOnly -contains '--format'){
      [IO.File]::AppendAllText('__LOG__',"query`n")
      $active=Test-Path -LiteralPath '__RUNNING__'
      if($active -and '__SCENARIO__' -ceq 'tray' -and -not(Test-Path -LiteralPath '__LOG__.status-error')){[IO.File]::WriteAllText('__LOG__.status-error','');return [pscustomobject]@{code=7;stdout='';stderr='fixture transient status error'}}
      if($active){Start-Sleep -Milliseconds 450}
      $state=if($active){'running'}else{'exited'};$out=(@($names|ForEach-Object{$_+'|'+$state}) -join "`n")
    }else{$out="000000000001`n000000000002`n000000000003`n000000000004"}
  }elseif($argsOnly[0] -ceq 'inspect'){
    $out=ConvertTo-Json -InputObject @($names|ForEach-Object{[pscustomobject]@{Config=[pscustomobject]@{Labels=[pscustomobject]@{'com.docker.compose.project'='__PROJECT__';'com.docker.compose.service'=$_}}}}) -Depth 8 -Compress
  }elseif($argsOnly[0] -ceq 'compose'){
    if($argsOnly -notcontains '__PROJECT__' -or $argsOnly -contains 'down' -or $argsOnly -contains '--volumes'){throw 'UI worker escaped own start/stop scope'}
    if($argsOnly -contains 'start'){
      [IO.File]::AppendAllText('__LOG__',"start`n");[IO.File]::WriteAllText('__RUNNING__','');Start-Sleep -Milliseconds 650
    }elseif($argsOnly -contains 'stop'){
      [IO.File]::AppendAllText('__LOG__',"stop-attempt`n")
      if('__SCENARIO__' -ceq 'tray' -and -not(Test-Path -LiteralPath '__LOG__.stop-error')){[IO.File]::WriteAllText('__LOG__.stop-error','');return [pscustomobject]@{code=7;stdout='';stderr='fixture stop failure'}}
      Remove-Item -LiteralPath '__RUNNING__' -Force -ErrorAction SilentlyContinue;[IO.File]::AppendAllText('__LOG__',"stop`n")
      if('__SCENARIO__' -ceq 'tray'){[IO.File]::AppendAllText('__LOG__',"stop-cli-timeout`n");throw (New-Object TimeoutException 'fixture CLI timeout after daemon stopped')}
    }else{throw 'Unexpected compose operation'}
  }else{throw 'Unexpected native Docker operation'}
  return [pscustomobject]@{code=0;stdout=$out;stderr=''}
}
'@
    $boundary=$boundary.Replace('__SOURCE__',$source.Replace("'","''")).Replace('__DOCKER__',$script:fakeDocker.Replace("'","''")).Replace('__PROJECT__',$uiProject).Replace('__LOG__',$uiLog.Replace("'","''")).Replace('__RUNNING__',$running.Replace("'","''")).Replace('__SCENARIO__',$scenario)
    [IO.File]::WriteAllText((Join-Path $uiSource 'simple-easy-setup-deploy.ps1'),$boundary,(New-Object Text.UTF8Encoding($true)))
    $runtime=@'
. '__SOURCE__/simple-easy-setup-runtime.ps1'
function Find-Desktop {return '__DESKTOP__'}
function Test-LinuxEngine([string]$Docker){return $true}
function Get-SimpleControlHttps([string]$Url){return 'Доступен по HTTPS'}
'@
    [IO.File]::WriteAllText((Join-Path $uiSource 'simple-easy-setup-runtime.ps1'),$runtime.Replace('__SOURCE__',$source.Replace("'","''")).Replace('__DESKTOP__',$script:fakeDesktop.Replace("'","''")),(New-Object Text.UTF8Encoding($true)))
    $localeLog=Join-Path $root ($scenario+'.locale')
    $localeBoundary=@'
function Get-SimpleGuiLanguage {return 'ru'}
function Set-SimpleGuiLanguage([string]$Language){[IO.File]::AppendAllText('__LOCALE_LOG__',$Language+"`n");return $true}
'@
    $localePath=Join-Path $uiSource 'simple-easy-setup-language.ps1'
    [IO.File]::WriteAllText($localePath,([IO.File]::ReadAllText($localePath)+"`n"+$localeBoundary.Replace('__LOCALE_LOG__',$localeLog.Replace("'","''"))),(New-Object Text.UTF8Encoding($true)))
    $guardProbe=@'
param($Controller,$Folder)
. $Controller -FunctionsOnly
. (Join-Path (Split-Path $Controller -Parent) 'simple-easy-setup-deploy.ps1')
$state=Get-Content -LiteralPath (Join-Path $Folder '.castlink-install.json') -Raw|ConvertFrom-Json
function Invoke-DeploymentDocker {throw 'UNEXPECTED_EFFECT'}
$refused=$false;try{$null=Remove-SimpleDeployment $Folder $state -Confirmed}catch{if($_.Exception.Message -match 'Закрой панель CastLink'){$refused=$true}else{throw}}
if(-not $refused -or -not(Test-Path -LiteralPath (Join-Path $Folder 'compose.json'))){throw 'Active-panel removal performed effects'}
Write-Output 'ACTIVE_PANEL_REMOVAL_REFUSED'
'@
    $probePath=Join-Path $uiSource 'guard-probe.ps1';[IO.File]::WriteAllText($probePath,$guardProbe,(New-Object Text.UTF8Encoding($true)))
    $harness=@'
param([string]$Controller,[string]$Folder,[string]$LogPath,[string]$Running,[string]$Scenario,[string]$LocaleLog,[string]$Probe)
$ErrorActionPreference='Stop'
. $Controller -FunctionsOnly
. (Join-Path (Split-Path $Controller -Parent) 'simple-easy-setup-deploy.ps1')
. (Join-Path (Split-Path $Controller -Parent) 'simple-easy-setup-runtime.ps1')
$script:factory=${function:New-SimpleControlWindow}
$script:flow=[pscustomobject]@{stage=0;finished=$false;closed=$false;deadline=[DateTime]::UtcNow.AddSeconds(35);timer=$null;failure='';stopError=(ConvertTo-SimpleControlText 'Не удалось остановить службы' 'en')}
function New-SimpleControlWindow([string]$Language='ru'){
  $view=& $script:factory $Language;$flow=$script:flow;$native=$script:realNative
  $exe=Get-SimpleControlPowerShell
  $flow.timer=New-Object Windows.Threading.DispatcherTimer;$flow.timer.Interval=[TimeSpan]::FromMilliseconds(100)
  $flow.timer.Add_Tick({
    try{
      $job=$view.Tag
      if([DateTime]::UtcNow -gt $flow.deadline){throw 'Actual tray/close lifecycle timed out'}
      $refresh=$view.FindName('Refresh');$start=$view.FindName('Start')
      if($Scenario -ceq 'close-start'){
        if($flow.stage -eq 0 -and $job.pipeline -and $job.mode -ceq 'start' -and -not $job.handle.IsCompleted){$view.Close();if(-not $job.closing){throw 'Close did not queue after pending start'};$flow.stage=1}
        if($job.closing -and $view.FindName('Summary').Text -ceq 'CastLink доступен'){throw 'Pending start overwrote closing transition with stale availability'}
        return
      }
      $summary=$view.FindName('Summary').Text
      if($flow.stage -eq 0){
        if($summary -cne 'Требуется проверка' -or -not $refresh.IsEnabled){return}
        if(-not $start.IsEnabled){throw 'Transient status error permanently disabled retry'}
        $start.RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)));$flow.stage=1
      }elseif($flow.stage -eq 1){
        if($summary -cne 'CastLink доступен' -or -not $refresh.IsEnabled){return}
        $originalHandle=(New-Object Windows.Interop.WindowInteropHelper($view)).Handle
        $view.FindName('Hide').RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        if($view.IsVisible -or -not(Test-Path -LiteralPath $Running) -or [IO.File]::ReadAllText($LogPath) -match '^stop'){throw 'Hide stopped services or exited event loop'}
        $job.trayOpen.PerformClick();if(-not $view.IsVisible){throw 'Tray restore did not show window'}
        if((New-Object Windows.Interop.WindowInteropHelper($view)).Handle -ne $originalHandle){throw 'Tray hide/restore replaced the hooked native window'}
        $view.FindName('Hide').RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        $second=& $native -File $exe -Arguments @('-NoProfile','-NonInteractive','-STA','-File',$Controller,'-ControlFolder',$Folder) -TimeoutSeconds 10
        if($second.code -ne 0){throw 'Second panel instance did not return'}
        $probe=& $native -File $exe -Arguments @('-NoProfile','-NonInteractive','-STA','-File',$Probe,$Controller,$Folder) -TimeoutSeconds 10
        if($probe.code -ne 0 -or $probe.stdout -notmatch 'ACTIVE_PANEL_REMOVAL_REFUSED'){throw 'Active panel did not guard removal before effects'}
        $flow.stage=2
      }elseif($flow.stage -eq 2){
        if(-not $view.IsVisible -or -not $refresh.IsEnabled){return}
        $view.FindName('LanguageEn').RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        if($view.FindName('Summary').Text -cne 'CastLink available'){throw 'English scoped callback failed'}
        $refresh.RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        $view.Close();if(-not $job.closing -or $job.mode -cne 'status'){throw 'Close did not serialize pending read-only status'}
        if($view.FindName('Summary').Text -ceq 'CastLink available' -or $view.FindName('Services').Text -match 'Running' -or $view.FindName('Notice').Text -notmatch 'Elapsed'){throw 'Closing failed to invalidate stale available/running state or show progress'}
        $flow.stage=3
      }elseif($flow.stage -eq 3){
        if($job.closing -and $summary -ceq 'CastLink available'){throw 'Pending status completion overwrote stopping transition'}
        if($summary -cne $flow.stopError -or -not $refresh.IsEnabled){return}
        if(-not $view.IsVisible -or $job.closing -or -not(Test-Path -LiteralPath $Running)){throw 'Failed stop closed panel or hid retry'}
        if($view.FindName('Services').Text -notmatch 'Running' -or -not $job.status){throw 'Failed stop did not show fresh rechecked running service states'}
        $view.FindName('LanguageZh').RaiseEvent((New-Object Windows.RoutedEventArgs([Windows.Controls.Button]::ClickEvent)))
        if($view.FindName('LanguageTitle').Text -cne '语言'){throw 'Chinese scoped callback failed'}
        $job.trayExit.PerformClick();$flow.stage=4
      }
    }catch{
      $diagnostic=[ordered]@{reason=$_.Exception.Message;scenario=[string]$Scenario;stage=$flow.stage;visible=$view.IsVisible;summary=$view.FindName('Summary').Text;notice=$view.FindName('Notice').Text;mode=$job.mode;initial=$job.initial;closing=$job.closing;complete=($job.handle -and $job.handle.IsCompleted);state=if($job.pipeline){[string]$job.pipeline.InvocationStateInfo.State}else{'none'};statusServices=@($job.status.services);renderedServices=$view.FindName('Services').Text;boundFolder=[bool]$Folder;boundController=[bool]$Controller;boundLog=[bool]$LogPath;boundRunning=[bool]$Running}
      $flow.failure='LIFECYCLE_DIAGNOSTIC_BASE64='+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes(($diagnostic|ConvertTo-Json -Depth 4 -Compress)))
      $flow.timer.Stop()
      try{
        $active=$view.Tag
        if($active -and $active.PSObject.Properties['canClose']){$active.canClose=$true}
        $view.Close()
      }catch{$flow.failure+=' CLEANUP_DIAGNOSTIC_BASE64='+[Convert]::ToBase64String([Text.Encoding]::UTF8.GetBytes($_.Exception.Message))}
    }
  }.GetNewClosure())
  $view.Add_Loaded({$flow.timer.Start()}.GetNewClosure())
  $view.Add_Closed({$flow.closed=$true;$flow.finished=($flow.stage -eq 4 -or ($Scenario -ceq 'close-start' -and $flow.stage -eq 1));$flow.timer.Stop()}.GetNewClosure())
  return $view
}
Show-SimpleControlWindow $Folder
if($script:flow.failure){throw $script:flow.failure}
$log=[IO.File]::ReadAllLines($LogPath)
if(-not $script:flow.finished -or -not $script:flow.closed -or (Test-Path -LiteralPath $Running) -or @($log|Where-Object{$_ -ceq 'start'}).Count -ne 1 -or @($log|Where-Object{$_ -ceq 'stop'}).Count -ne 1 -or [Array]::IndexOf($log,'start') -gt [Array]::IndexOf($log,'stop')){throw 'Open/tray/serialized-close did not start then stop only own services'}
if($Scenario -ceq 'tray' -and (@($log|Where-Object{$_ -ceq 'stop-attempt'}).Count -ne 2 -or @($log|Where-Object{$_ -ceq 'stop-cli-timeout'}).Count -ne 1 -or [IO.File]::ReadAllText($LocaleLog).Trim().Replace("`r",'').Replace("`n",',') -cne 'en,zh-CN')){throw 'Stop retry or isolated locale callback missing'}
$installation=Read-SimpleControlInstallation $Folder;$guard=Enter-SimplePanelUpdateGuard $installation.state.installationId;Exit-SimpleControlGuard $guard
foreach($name in @('Translate','ApplyLanguage','UpdateStatus','UpdateTransition')){if(Get-Command $name -ErrorAction SilentlyContinue){throw 'Private UI helper module polluted command scope'}}
Write-Output 'SIMPLE_CONTROL_FILE_UI_PASS open-start tray-restore single-instance active-panel-guard serialized-close stop-retry scoped-data-retained'
'@
    $uiHarness=Join-Path $uiSource 'ui-file-harness.ps1';[IO.File]::WriteAllText($uiHarness,$harness,(New-Object Text.UTF8Encoding($true)))
    $uiChild=& $script:realControlInvoke -File (Get-SimpleControlPowerShell) -Arguments @('-NoProfile','-NonInteractive','-STA','-File',$uiHarness,(Join-Path $uiSource 'simple-easy-setup-control.ps1'),$ui.folder,$uiLog,$running,$scenario,$localeLog,$probePath) -TimeoutSeconds 50
    if($uiChild.code -ne 0 -or $uiChild.stdout -notmatch 'SIMPLE_CONTROL_FILE_UI_PASS'){throw ('Actual -File lifecycle child failed ('+$scenario+'): '+$uiChild.stderr)}
    $script:controlProject=$uiProject;$script:controlRemoved=$false;$script:controlRows="caddy|exited`nlivekit|exited`npostgres|exited`nweb|exited";$script:ServerFolder=$ui.folder.Replace('\','/')
    $null=Remove-SimpleDeployment $ui.folder $ui.state -Confirmed
    if(-not(Get-Content -LiteralPath (Join-Path $ui.folder '.castlink-install.json') -Raw|ConvertFrom-Json).stopped){throw 'Removal could not retry after panel closed'}
  }
  Write-Output 'SIMPLE_CONTROL_FIXTURES_PASS persistent-COM-shortcuts branded-icon no-logon desktop-linux read-only-health scoped-start foreign/missing/stopped-refusal uninstall-preservation open-start tray close-stop WPF'
  $global:LASTEXITCODE=0
}finally{Remove-Item -LiteralPath $root -Recurse -Force}
