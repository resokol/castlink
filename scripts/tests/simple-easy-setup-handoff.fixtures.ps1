param([string]$EntryPath,[string]$ControlPath)
$ErrorActionPreference='Stop'
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-handoff-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $folder
try{
  $tokens=$null;$errors=$null
  $entry=[Management.Automation.Language.Parser]::ParseFile($EntryPath,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Installer parsing failed'}
  $tail=$entry.FindAll({param($node) $node -is [Management.Automation.Language.IfStatementAst] -and $node.Extent.Text -match '^if\(\$Target -eq ''local''\)' -and $node.Extent.Text -match 'Install-SimpleLocalControl'},$true)
  if($tail.Count -ne 1){throw 'Local installer completion branch missing or ambiguous'}
  $Target='local';$InstallFolder=$folder;$state=[pscustomobject]@{address='192.0.2.8'};$current=[pscustomobject]@{folder=$folder};$release=[pscustomobject]@{version='1.0.0-rc.2';commit=('a'*40)}
  $script:installed=$false;$script:checkpoint=$false;$script:stops=0;$global:SimpleGuiControlFolder=''
  function Install-SimpleLocalControl {$script:installed=$true;return [pscustomobject]@{desktop=$true}}
  function Save-SimpleState {}
  function Complete-SimpleSetupCheckpoint {$script:checkpoint=$true}
  function Write-SimpleStage {}
  function Stop-SimpleControlServices {$script:stops++;throw 'Services are intentionally still running'}
  & ([scriptblock]::Create($tail[0].Extent.Text))
  if(-not $script:installed -or -not $script:checkpoint -or $script:stops -or $global:SimpleGuiControlFolder -cne [IO.Path]::GetFullPath($folder)){throw 'Installer did not preserve running services and structured handoff'}

  $control=[Management.Automation.Language.Parser]::ParseFile($ControlPath,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Controller parsing failed'}
  $closing=$control.Find({param($node) $node -is [Management.Automation.Language.InvokeMemberExpressionAst] -and $node.Member.Value -ceq 'Add_Closing'},$true)
  if(-not $closing){throw 'Panel closing policy missing'}
  $callback=$closing.Arguments[0].Find({param($node) $node -is [Management.Automation.Language.ScriptBlockExpressionAst]},$true)
  $window=[pscustomobject]@{hidden=$false};$window|Add-Member ScriptMethod Hide {$this.hidden=$true}
  $job=[pscustomobject]@{canClose=$false;closing=$false;phaseStarted=[DateTime]::UtcNow;status=$null;pipeline=$null}
  $event=[pscustomobject]@{Cancel=$false};$script:stopRequests=0
  $uiHelpers=[pscustomobject]@{};$uiHelpers|Add-Member ScriptMethod UpdateTransition {}
  $start=[pscustomobject]@{IsEnabled=$true};$refresh=[pscustomobject]@{IsEnabled=$true};$hide=[pscustomobject]@{IsEnabled=$true}
  $begin={param($Mode) if($Mode -ceq 'stop'){$script:stopRequests++}}
  & ([scriptblock]::Create($callback.ScriptBlock.Extent.Text.Trim('{}'))) $window $event
  if(-not $event.Cancel -or -not $window.hidden -or $job.closing -or $script:stopRequests){throw 'Window X did not hide to tray while preserving running services'}
  . (Join-Path (Split-Path $EntryPath -Parent) 'simple-easy-setup-gui.ps1') -FunctionsOnly
  $signal=New-Object Threading.ManualResetEvent($false)
  try{
    $launch=[pscustomobject]@{event=$signal;process=[pscustomobject]@{HasExited=$false};deadline=[DateTime]::UtcNow.AddSeconds(15)}
    if((Get-SimpleGuiPanelLaunchState $launch) -cne 'pending'){throw 'Unacknowledged child was reported ready'}
    $launch.process.HasExited=$true;$refused=$false;try{$null=Get-SimpleGuiPanelLaunchState $launch}catch{$refused=$true}
    if(-not $refused){throw 'Early child exit was reported ready'}
    $launch.process.HasExited=$false;$launch.deadline=[DateTime]::UtcNow.AddSeconds(-1)
    $refused=$false;try{$null=Get-SimpleGuiPanelLaunchState $launch}catch{$refused=$true}
    if(-not $refused){throw 'Unacknowledged timeout was reported ready'}
    $null=$signal.Set()
    if((Get-SimpleGuiPanelLaunchState $launch) -cne 'ready'){throw 'Actual readiness signal was ignored'}
  }finally{$signal.Dispose()}
  Write-Output 'SIMPLE_HANDOFF_PASS installer-keeps-services structured-folder X-hides-without-stop'
}finally{Remove-Item -LiteralPath $folder -Recurse -Force;$global:SimpleGuiControlFolder=''}

# Version metadata is part of successful setup handoff.
& {
param([string]$GuiPath,[string]$ControlPath,[string]$EntryPath)
$ErrorActionPreference='Stop'
. $GuiPath -FunctionsOnly
. $ControlPath -FunctionsOnly
$root=Join-Path ([IO.Path]::GetTempPath()) ('castlink-version-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory (Join-Path $root 'scripts') -Force
$null=New-Item -ItemType Directory (Join-Path $root 'payload') -Force
try{
  $wizardCommit='a'*40;$installedCommit='b'*40
  $release=[pscustomobject]@{version='1.0.0-rc.2';commit=$wizardCommit}
  [IO.File]::WriteAllText((Join-Path $root 'payload/release.json'),($release|ConvertTo-Json))
  $metadata=Get-SimpleGuiBuildMetadata (Join-Path $root 'scripts')
  foreach($locale in @('ru','en','zh-CN')){
    $label=Format-SimpleBuildText $metadata $locale
    if($label -notlike '*1.0.0-rc.2*' -or $label -notlike '*aaaaaa*' -or ($locale -cne 'ru' -and $label -match '[\u0400-\u04ff]')){throw 'Wizard version/build label was missing or untranslated'}
  }
  Remove-Item -LiteralPath (Join-Path $root 'payload/release.json')
  if((Format-SimpleBuildText (Get-SimpleGuiBuildMetadata (Join-Path $root 'scripts')) 'ru') -cne 'Версия неизвестна'){throw 'Missing shipped metadata invented a wizard version'}
  $installation=[pscustomobject]@{state=[pscustomobject]@{version='1.0.0-rc.1';commit=$installedCommit;stopped=$true};compose=[pscustomobject]@{services=[pscustomobject]@{web=[pscustomobject]@{image=('castlink-easy-web:'+$installedCommit)}}}}
  $metadata=Get-SimpleControlBuildMetadata $installation
  $label=Format-SimpleBuildText $metadata 'ru'
  if($label -notlike '*1.0.0-rc.1*' -or $label -notlike '*bbbbbb*' -or $label -like '*aaaaaa*'){throw 'Stopped panel did not display its own installed version/build'}
  $installation.state.commit=$wizardCommit
  $label=Format-SimpleBuildText (Get-SimpleControlBuildMetadata $installation) 'ru'
  if($label -notlike 'Версия неизвестна*' -or $label -notlike '*bbbbbb*' -or $label -like '*1.0.0-rc.1*'){throw 'Panel accepted stale metadata for a different Compose build'}
  $installation.state=[pscustomobject]@{stopped=$false}
  if((Format-SimpleBuildText (Get-SimpleControlBuildMetadata $installation) 'en') -cne 'Version unknown · Build bbbbbb'){throw 'Legacy panel lost its pinned build or invented a version'}
  foreach($bad in @([pscustomobject]@{version='bad-version';commit='c'*40},[pscustomobject]@{version='1.0.0';commit='invalid'})){
    if((Format-SimpleBuildText $bad 'ru') -like '*bad-version*' -or (Format-SimpleBuildText $bad 'ru') -like '*invalid*'){throw 'Malformed metadata leaked into the version label'}
  }
  $tokens=$null;$errors=$null;$entry=[Management.Automation.Language.Parser]::ParseFile($EntryPath,[ref]$tokens,[ref]$errors)
  if($errors.Count){throw 'Installer parsing failed'}
  $tail=$entry.FindAll({param($node) $node -is [Management.Automation.Language.IfStatementAst] -and $node.Extent.Text -match '^if\(\$Target -eq ''local''\)' -and $node.Extent.Text -match 'Install-SimpleLocalControl'},$true)
  if($tail.Count -ne 1){throw 'Local completion branch missing'}
  $Target='local';$InstallFolder=$root;$state=[pscustomobject]@{address='192.0.2.8'};$current=[pscustomobject]@{folder=$root}
  $script:saved=$null
  function Save-SimpleState($Folder,$State){$script:saved=$State}
  function Install-SimpleLocalControl {return [pscustomobject]@{desktop=$false}}
  function Complete-SimpleSetupCheckpoint {}
  function Write-SimpleStage {}
  & ([scriptblock]::Create($tail[0].Extent.Text))
  if(-not $script:saved -or $script:saved.version -cne $release.version -or $script:saved.commit -cne $release.commit){throw 'Successful local setup did not persist its actual release identity'}
  Write-Output 'SIMPLE_VERSION_PASS loaded-wizard installed-panel stopped legacy mismatch malformed localized successful-persistence'
}finally{Remove-Item -LiteralPath $root -Recurse -Force}

} -GuiPath (Join-Path (Split-Path $EntryPath -Parent) 'simple-easy-setup-gui.ps1') -ControlPath $ControlPath -EntryPath $EntryPath

# Windows UX regressions; isolate backend variables and boundary stubs.
& {
param([string]$SourceRoot)
$ErrorActionPreference='Stop'
. (Join-Path $SourceRoot 'simple-easy-setup-gui.ps1') -FunctionsOnly
. (Join-Path $SourceRoot 'simple-easy-setup-control.ps1') -FunctionsOnly
# Render actual localized transition text without requiring WPF on this host.
$view=[pscustomobject]@{controls=@{}}
foreach($name in @('Summary','Services','Notice')){$view.controls[$name]=[pscustomobject]@{Text=''}}
$view|Add-Member -MemberType ScriptMethod -Name FindName -Value {param($name) return $this.controls[$name]}
foreach($locale in @('ru','en','zh-CN')){
  foreach($mode in @('start','stop')){
    $state=[pscustomobject]@{language=$locale;mode=$mode;closing=$false;serviceNames=@('web','postgres');phaseStarted=[DateTime]::UtcNow.AddSeconds(-4)}
    Update-SimpleControlTransition $view $state
    $expected=if($mode -ceq 'start'){'Запускаю CastLink…'}else{'Останавливаю CastLink…'}
    if($view.FindName('Summary').Text -cne (ConvertTo-SimpleControlText $expected $locale)){throw 'Start/stop transition displayed the wrong operation'}
    if($view.FindName('Notice').Text -notlike ('*'+((ConvertTo-SimpleControlText 'Прошло {0} с' $locale) -f 4))){throw 'Start/stop elapsed time was missing or not based on phase start'}
    $state.phaseStarted=$state.phaseStarted.AddSeconds(-3);Update-SimpleControlTransition $view $state
    if($view.FindName('Notice').Text -notlike ('*'+((ConvertTo-SimpleControlText 'Прошло {0} с' $locale) -f 7))){throw 'Elapsed time did not advance'}
  }
}
$root=Join-Path ([IO.Path]::GetTempPath()) ('castlink-ux-'+[Guid]::NewGuid().ToString('N'))
$null=New-Item -ItemType Directory $root
try{
  # Different canonical bytes must change Explorer's icon identity, while all
  # generated assets stay owned and user-created collisions remain untouched.
  . (Join-Path $SourceRoot 'simple-easy-setup-deploy.ps1')
  . (Join-Path $SourceRoot 'simple-easy-setup-runtime.ps1')
  $incoming=Join-Path $root 'incoming';$null=New-Item -ItemType Directory $incoming
  foreach($name in @('control.ps1','deploy.ps1','cleanup.ps1','runtime.ps1','language.ps1','control.ico')){Copy-Item -LiteralPath (Join-Path $SourceRoot ('simple-easy-setup-'+$name)) -Destination $incoming}
  $desktop=Join-Path $root 'desktop'
  function Get-SimpleControlLinkFolder([string]$Kind){return $desktop}
  function New-SimpleControlShortcut([string]$Path,[string]$Folder,[string]$Kind){Write-SimpleText $Path (Get-SimpleControlShortcutIcon $Folder)}
  function New-UxInstall([string]$Name){
    $folder=Join-Path $root $Name;$null=New-Item -ItemType Directory $folder
    $null=Open-SimpleOwnership $folder -FolderWasNew
    $release=[pscustomobject]@{images=[pscustomobject]@{web='web:test';postgres='postgres:test';livekit='livekit:test';caddy='caddy:test'}}
    $state=New-SimpleConfiguration $folder '192.168.1.22' $false $release
    Set-SimpleTarget $folder $state 'local';$state.completed=$true
    Write-SimpleConfiguration $folder $state $release '192.168.1.22'
    return [pscustomobject]@{folder=$folder;state=$state}
  }
  $install=New-UxInstall 'install';$null=Install-SimpleLocalControl $install.folder $install.state $incoming
  $oldIcon=Get-SimpleControlShortcutIcon $install.folder
  [IO.File]::AppendAllText((Join-Path $incoming 'simple-easy-setup-control.ico'),'fixture branding update')
  $null=Install-SimpleLocalControl $install.folder $install.state $incoming
  $newIcon=Get-SimpleControlShortcutIcon $install.folder
  if($oldIcon -ceq $newIcon -or -not(Test-Path -LiteralPath $newIcon)){throw 'Canonical icon update reused the stale Explorer cache identity'}
  $owned=Open-SimpleOwnership $install.folder
  if([IO.File]::ReadAllText($owned.windowsLinks[0].path) -cne $newIcon){throw 'Updated Desktop shortcut did not target the new icon'}
  $relative=$newIcon.Substring($install.folder.Length+1).Replace('\','/')
  if(@($owned.files|Where-Object{$_.path -ceq $relative}).Count -ne 1 -or @((Get-SimpleOwnedCandidates $install.folder)|Where-Object{$_.FullName -ceq $newIcon}).Count -ne 1){throw 'Versioned icon lost cleanup ownership'}
  $collision=New-UxInstall 'collision';$dir=Join-Path $collision.folder '.castlink-control';$null=New-Item -ItemType Directory $dir
  $hash=(Get-FileHash -LiteralPath (Join-Path $incoming 'simple-easy-setup-control.ico')).Hash.ToLowerInvariant()
  $userIcon=Join-Path $dir ('simple-easy-setup-control-'+$hash+'.ico');Write-SimpleText $userIcon 'USER ICON'
  $refused=$false;try{$null=Install-SimpleLocalControl $collision.folder $collision.state $incoming}catch{$refused=$true}
  if(-not $refused -or [IO.File]::ReadAllText($userIcon) -cne 'USER ICON' -or (Test-Path (Join-Path $dir 'simple-easy-setup-control.ps1'))){throw 'Icon collision overwrote user data or partially replaced helpers'}
  # The backend action prompt is the GUI's source of its three choice buttons.
  . (Join-Path $SourceRoot 'windows-simple-easy-setup.ps1') -FunctionsOnly
  function Get-SimplePendingSetup {return $null}
  $script:uxPrompt=''
  function Read-Host([string]$Prompt){$script:uxPrompt=$Prompt;throw 'fixture action prompt captured'}
  try{Start-SimpleSetup}catch{if($_.Exception.Message -cne 'fixture action prompt captured'){throw}}
  $prompt=Get-SimpleGuiPrompt $script:uxPrompt $false
  if($prompt.choices.Count -ne 3 -or ($prompt.choices.value -join ',') -cne '1,2,3' -or ($prompt.choices.label -join ',') -cne 'Установить,Обновить,Удалить'){throw 'Backend did not expose separate Install Update Remove choices'}
  foreach($choice in @(@('1','Где установить CastLink?'),@('2','Где обновить CastLink?'),@('3','Где удалить CastLink?'))){
    $Action='choose';$Target='choose';$script:uxChoice=$choice[0]
    function Read-Host([string]$Prompt){if($Prompt.StartsWith('CastLink:')){return $script:uxChoice};$script:uxPrompt=$Prompt;throw 'fixture target prompt captured'}
    try{Start-SimpleSetup}catch{if($_.Exception.Message -cne 'fixture target prompt captured'){throw}}
    if(-not $script:uxPrompt.StartsWith($choice[1])){throw 'Selected action was routed to the wrong target prompt'}
  }
  $Action='update';$Target='local';$InstallFolder=Join-Path $root 'missing-update';$Address='192.168.1.22'
  function Complete-SimpleInputPhase {throw 'UPDATE_CROSSED_MUTATION_BOUNDARY'}
  $refused=$false;try{Start-SimpleSetup}catch{if($_.Exception.Message -eq 'UPDATE_CROSSED_MUTATION_BOUNDARY'){throw};$refused=$_.Exception.Message -like 'Для обновления*'}
  if(-not $refused -or (Test-Path $InstallFolder)){throw 'Explicit update created a new installation'}
  # Remote update must select the saved wizard workspace, not infer an existing
  # VPS identity from its address or create fresh installation credentials.
  $remoteFolder=Join-Path $root 'remote-workspace';$null=New-Item -ItemType Directory $remoteFolder
  $remote=[pscustomobject]@{target='remote';serverIp='192.0.2.22';sshPort=22;sshLogin='root';address='192.0.2.22';publicHttps=$true;installationId=[Guid]::NewGuid().ToString();completed=$true;stopped=$false}
  $remoteBytes=$remote|ConvertTo-Json;[IO.File]::WriteAllText((Join-Path $remoteFolder '.castlink-install.json'),$remoteBytes)
  $Action='update';$Target='remote';$InstallFolder='';$ServerIp=$remote.serverIp;$SshPort=22;$Domain=$remote.address;$Login='root';$script:SimpleDomainSpecified=$true;$TurnDomain=''
  function Read-SimpleValue([string]$Prompt,[string]$Default=''){if($Prompt -cne 'Папка сохранённых данных мастера на этом ПК'){throw 'Remote update did not ask for its saved workspace'};return $remoteFolder}
  $selected=$false;try{Start-SimpleSetup}catch{if($_.Exception.Message -ceq 'UPDATE_CROSSED_MUTATION_BOUNDARY'){$selected=$true}else{throw}}
  if(-not $selected -or $script:InstallFolder -cne $remoteFolder -or [IO.File]::ReadAllText((Join-Path $remoteFolder '.castlink-install.json')) -cne $remoteBytes){throw 'Remote update lost or changed the selected installation identity'}
  $InstallFolder=Join-Path $root 'remote-missing';$refused=$false
  try{Start-SimpleSetup}catch{if($_.Exception.Message -eq 'UPDATE_CROSSED_MUTATION_BOUNDARY'){throw};$refused=$_.Exception.Message -like 'Для обновления VPS*'}
  if(-not $refused -or (Test-Path $InstallFolder)){throw 'Remote update silently created a new installation or hid its workspace requirement'}
  foreach($locale in @('en','zh-CN')){foreach($choice in $prompt.choices){if((ConvertTo-SimpleGuiText $choice.label $locale) -match '[\u0400-\u04ff]'){throw 'Action choice omitted translation'}}}
  Write-Output 'SIMPLE_UX_FIXTURES_PASS operation-elapsed icon-cache-identity icon-ownership separate-actions'
}finally{Remove-Item -LiteralPath $root -Recurse -Force}

} -SourceRoot (Split-Path $EntryPath -Parent)
