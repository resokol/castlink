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
  $Target='local';$InstallFolder=$folder;$state=[pscustomobject]@{address='192.0.2.8'};$current=[pscustomobject]@{folder=$folder}
  $script:installed=$false;$script:checkpoint=$false;$script:stops=0;$global:SimpleGuiControlFolder=''
  function Install-SimpleLocalControl {$script:installed=$true;return [pscustomobject]@{desktop=$true}}
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
