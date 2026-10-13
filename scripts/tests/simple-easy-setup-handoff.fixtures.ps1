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
    if($label -notlike '*1.0.0-rc.2*' -or $label -notlike '*aaaaaaaaaaaa*' -or ($locale -cne 'ru' -and $label -match '[\u0400-\u04ff]')){throw 'Wizard version/build label was missing or untranslated'}
  }
  Remove-Item -LiteralPath (Join-Path $root 'payload/release.json')
  if((Format-SimpleBuildText (Get-SimpleGuiBuildMetadata (Join-Path $root 'scripts')) 'ru') -cne 'Версия неизвестна'){throw 'Missing shipped metadata invented a wizard version'}
  $installation=[pscustomobject]@{state=[pscustomobject]@{version='1.0.0-rc.1';commit=$installedCommit;stopped=$true};compose=[pscustomobject]@{services=[pscustomobject]@{web=[pscustomobject]@{image=('castlink-easy-web:'+$installedCommit)}}}}
  $metadata=Get-SimpleControlBuildMetadata $installation
  $label=Format-SimpleBuildText $metadata 'ru'
  if($label -notlike '*1.0.0-rc.1*' -or $label -notlike '*bbbbbbbbbbbb*' -or $label -like '*aaaaaaaaaaaa*'){throw 'Stopped panel did not display its own installed version/build'}
  $installation.state.commit=$wizardCommit
  $label=Format-SimpleBuildText (Get-SimpleControlBuildMetadata $installation) 'ru'
  if($label -notlike 'Версия неизвестна*' -or $label -notlike '*bbbbbbbbbbbb*' -or $label -like '*1.0.0-rc.1*'){throw 'Panel accepted stale metadata for a different Compose build'}
  $installation.state=[pscustomobject]@{stopped=$false}
  if((Format-SimpleBuildText (Get-SimpleControlBuildMetadata $installation) 'en') -cne 'Version unknown · Build bbbbbbbbbbbb'){throw 'Legacy panel lost its pinned build or invented a version'}
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
