param([string]$UiPath)
$ErrorActionPreference='Stop'
Set-StrictMode -Version Latest
if(-not $UiPath){$UiPath=Join-Path $PSScriptRoot '../server-wsl-maintenance-ui.ps1'}
. $UiPath -FunctionsOnly -InitialAction Move
function Assert($Condition,[string]$Message){if(-not $Condition){throw $Message}}
function Reject([scriptblock]$Block,[string]$Pattern){try{& $Block}catch{Assert ($_.Exception.Message -match $Pattern) ('Unexpected rejection: '+$_.Exception.Message);return};throw ('Expected rejection: '+$Pattern)}
$fixture=Join-Path ([IO.Path]::GetTempPath()) ('castlink-location-ui-'+[guid]::NewGuid().ToString('N'))
[void][IO.Directory]::CreateDirectory($fixture)
$w=New-CLMWindow en
try{
 Assert ($maintenanceUiRequest.initialAction -ceq 'Move') 'Updater initial Move intent was lost while loading helpers'
 Assert ($null -ne $w.FindName('Move')) 'Actual maintenance WPF window has no Move action'
 $rows=@([pscustomobject]@{root=(Join-Path $fixture 'first');activeRoot=(Join-Path $fixture 'first-generation');distroName='CastLink-Server-111111111111';domain='https://first.test';version='1.0.8';state='ready';logicalId=('1'*32)},[pscustomobject]@{root=(Join-Path $fixture 'second');activeRoot=(Join-Path $fixture 'active-generation');distroName='CastLink-Server-222222222222';domain='https://second.test';version='1.0.8';state='ready';logicalId=('2'*32)})
 $state=@{rows=$rows;checkedRoot='';checkedTarget='';targetDirectory='';targetPin='';lang='en';adapter=$null;job=$null;operationRoot=$rows[1].root;operationLogicalId=$rows[1].logicalId}
 foreach($row in $rows){$null=$w.FindName('Server').Items.Add($row.root)};$w.FindName('Server').SelectedIndex=1
 $dest=Join-Path $fixture 'new destination сервер'
 $w.FindName('Destination').Text=$dest
 Assert ($null -eq (Get-CLMUiActionArguments $w $state Move $false)) 'Cancelled Move generated an operation'
 $arguments=Get-CLMUiActionArguments $w $state Move $true
 Assert ($arguments.Action -ceq 'Move' -and $arguments.InstallRoot -ceq $rows[1].root -and $arguments.DestinationRoot -ceq $dest -and $arguments.Confirmation -ceq 'CastLink-Server-222222222222') 'Move lost exact logical root, destination or distro identity'
 Assert (-not $arguments.ContainsKey('TargetDirectory') -and -not $arguments.ContainsKey('ExpectedManifestSha256')) 'Move still depends on an unrelated target release'
 $estimate=[pscustomobject]@{requiredBytes=2048;freeBytes=4096;sourceRoot=$rows[1].activeRoot;destinationRoot=$dest}
 $message=Get-CLMUiConfirmationText $w $rows[1] $arguments en $estimate
 Assert ($message.Contains('2048') -and $message.Contains('4096')) 'Move confirmation omits read-only required and available space estimate'
 Assert ($message.Contains($rows[1].activeRoot) -and $message.Contains($dest) -and $message -match 'interrupt|unavailable|downtime') 'Move confirmation omits active source, destination or interruption'
 $w.FindName('Destination').Text='';Reject {Get-CLMUiActionArguments $w $state Move $true} 'destination|folder'
 $w.FindName('Destination').Text=$fixture;Reject {Get-CLMUiActionArguments $w $state Move $true} 'new|exist'
 $w.FindName('Destination').Text=$dest
 $rows[1].state='unavailable';Reject {Get-CLMUiActionArguments $w $state Move $true} 'unavailable|accessible|available'
 $rows[1].state='conflict';Reject {Get-CLMUiActionArguments $w $state Update $true} 'conflict|Recover|available'
 $rows[1].state='recovery';$recovery=Get-CLMUiActionArguments $w $state Recover $true
 Assert ($null -ne $w.FindName('CancelMove')) 'Pending move has no cancellation affordance'
 $rows[1]|Add-Member NoteProperty canCancelMove $true
 $cancel=Get-CLMUiActionArguments $w $state CancelMove $true
 Assert ($cancel.Action -ceq 'CancelMove' -and $cancel.InstallRoot -ceq $rows[1].root -and $cancel.Confirmation -ceq $rows[1].distroName) 'CancelMove lost selected recovery root or exact confirmation'
 Assert ($null -eq (Get-CLMUiActionArguments $w $state CancelMove $false)) 'Cancelled cancellation confirmation generated an operation'
 Assert ($recovery.InstallRoot -ceq $rows[1].root -and $recovery.Action -ceq 'Recover') 'Pending move lost its original recovery pointer root'
 Update-CLMUiAvailability $w $state
 Assert ($w.FindName('CancelMove').IsEnabled -and $w.FindName('Recover').IsEnabled -and -not $w.FindName('Move').IsEnabled -and -not $w.FindName('OpenPanel').IsEnabled) 'Pending move exposes management or hides Recover'
 $rows[1].canCancelMove=$false;Update-CLMUiAvailability $w $state
 Assert (-not $w.FindName('CancelMove').IsEnabled) 'Move past its copy phase exposes cancellation'
 $state.job=@{action='Move'};Update-CLMUiAvailability $w $state
 Assert (-not $w.FindName('Recover').IsEnabled -and -not $w.FindName('Move').IsEnabled -and -not $w.FindName('DestinationBrowse').IsEnabled) 'Move leaves actions active during operation'
 $state.job=$null;$rows[1].state='unavailable';Update-CLMUiAvailability $w $state
 Assert (-not $w.FindName('Recover').IsEnabled -and -not $w.FindName('OpenPanel').IsEnabled) 'Unavailable row exposes an executable action'
 foreach($lang in @('ru','en','zh-CN')){Assert ((Get-CLMText move $lang) -cne 'move') ('Missing Move localization '+$lang)}
 $chosen=Get-CLMUiDestinationFromParent $fixture Move
 Assert ($chosen.StartsWith($fixture+'\') -and $chosen -notmatch 'Restored-' -and -not (Test-Path -LiteralPath $chosen)) 'Move folder picker changed disk, used Restore naming or created destination'
 $after=@([pscustomobject]@{root=$dest;logicalId=$rows[1].logicalId},[pscustomobject]@{root=$rows[0].root;logicalId=$rows[0].logicalId})
 $result=@{kind='move';phase='completed';destinationRoot=$dest;logicalId=$rows[1].logicalId}
 Assert ((Get-CLMUiResultSelection $after $state $result) -eq 0) 'Completed Move/Recover lost selected logical server at destination'
 Assert ((Get-CLMUiResultSelection $after $state ([pscustomobject]@{phase='completed'})) -eq 0) 'An ordinary update result lost logical selection without a Move kind'
 $rows[1].state='ready';$script:ReleaseDestination=''
 function Receive-CastlinkWslReleaseManifest($Choice,[string]$InstallRoot){$script:ReleaseDestination=$InstallRoot;return [pscustomobject]@{directory='selected-volume-package';manifestSha256=('c'*64);releaseTag='server-wsl-v1.0.9'}}
 $selectedRelease=Receive-CLMUiRelease ([pscustomobject]@{releaseTag='server-wsl-v1.0.9'}) $w $state
 Assert ($script:ReleaseDestination -ceq $rows[1].root -and $selectedRelease.directory -ceq 'selected-volume-package') 'Release picker staged package without the exact selected logical installation'
 Remove-Item Function:Receive-CastlinkWslReleaseManifest
 $oldAppData=$env:LOCALAPPDATA;$env:LOCALAPPDATA=Join-Path $fixture 'profile';[void][IO.Directory]::CreateDirectory($env:LOCALAPPDATA)
 try{
  # Read-only discovery is isolated; real private move journal/pointer parsing stays enabled.
  $source=Join-Path $fixture 'pending-source';Protect-CLMDirectory $source
  $tx='a'*32;$op=Get-CLMMoveDirectory $tx;Protect-CLMDirectory $op;$journal=Join-Path $op 'journal.json'
  $j=@{schemaVersion=1;kind='move';id=$tx;journal=$journal;phase='move-wsl';selectedRoot=$source;sourceRoot=$source;destinationRoot=$dest;logicalId=('2'*32);source=@{releaseTag='server-wsl-v1.0.8';distroName='CastLink-Server-222222222222'}}
  Write-CLMJson $journal $j;Write-CLMJson (Join-Path $source 'maintenance-transaction.json') @{schemaVersion=1;kind='move';selectedRoot=$source;journalSelectedRoot=$source;id=$tx;journal=$journal}
  function Get-CastlinkMaintenanceInstallations {return @()}
  $pending=@(Get-CLMUiRows $source)
  Assert ($pending.Count -eq 1 -and $pending[0].root -ceq $source -and $pending[0].state -ceq 'recovery') 'Selected pending move disappeared because active-root resolution refuses it'
  Assert ($pending[0].canCancelMove) 'A WSL command that failed before moving the disk cannot request verified cancellation'
  $j.phase='move-bindings';Write-CLMJson $journal $j;$pending=@(Get-CLMUiRows $source)
  Assert (-not $pending[0].canCancelMove) 'Verified moved-disk bindings phase exposes cancellation'
  $j.phase='move-copy';Write-CLMJson $journal $j;$pending=@(Get-CLMUiRows $source)
  Assert ($pending[0].canCancelMove) 'Verified pre-VHD copy phase cannot be cancelled'
 }finally{$env:LOCALAPPDATA=$oldAppData;Remove-Item Function:Get-CastlinkMaintenanceInstallations}
 # Show the actual maintenance event wiring with synthetic discovery, then close
 # after its first render; no action buttons are invoked and no product is read.
 $script:UiRealWindow=(Get-Command New-CLMWindow).ScriptBlock
 $script:UiRealRows=(Get-Command Get-CLMUiRows).ScriptBlock
 $script:UiEstimateRecords=New-Object Collections.Generic.List[object]
 function Get-CastlinkMoveEstimate([string]$InstallRoot,[string]$DestinationRoot){$script:UiEstimateRecords.Add(@{root=$InstallRoot;destination=$DestinationRoot});return [pscustomobject]@{requiredBytes=2048;freeBytes=4096;sourceRoot=$InstallRoot;destinationRoot=$DestinationRoot}}
 $script:UiRealConfirm=(Get-Command Confirm-CLMUiAction).ScriptBlock
 $script:UiConfirmRecords=New-Object Collections.Generic.List[object]
 function Confirm-CLMUiAction($Window,$Row,$Arguments,[string]$Language){$script:UiConfirmRecords.Add($Arguments);return $false}
 $script:UiPreviewRows=@($rows[0]);$script:UiPreviewFailures=New-Object Collections.Generic.List[string];$script:UiPreviewCount=New-Object Collections.Generic.List[int]
 function Get-CLMUiRows {return $script:UiPreviewRows}
 function New-CLMWindow([string]$Language){
  $preview=& $script:UiRealWindow $Language
  $expectedLabel=Get-CLMText move $Language;$expectedNotice=Get-CLMText moveInterruption $Language
  $preview.Tag=@{counts=$script:UiPreviewCount;failures=$script:UiPreviewFailures;label=$expectedLabel;notice=$expectedNotice;destination=(Join-Path $fixture 'preview new destination')}
  $preview.Add_ContentRendered({param($sender,$event)
   $proof=$sender.Tag
   try{
    $proof.counts.Add(1)
    if($sender.FindName('Move').Content -cne $proof.label){throw 'Rendered Move label has wrong locale'}
    if($sender.FindName('Result').Text -cne $proof.notice){throw 'Initial Move did not explain interruption'}
    if(-not $sender.FindName('Move').IsEnabled -or $sender.FindName('Server').SelectedIndex -ne 0){throw 'Initial selected ready server lost its Move action'}
    $sender.FindName('Destination').Text=$proof.destination
    $sender.FindName('Move').RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.Button]::ClickEvent))
   }catch{$proof.failures.Add($_.Exception.Message)}finally{$sender.Close()}
  })
  return $preview
 }
 try{foreach($locale in @('ru','en','zh-CN')){Show-CastlinkMaintenance $rows[0].root $locale '' '' -InitialAction Move}}finally{Set-Item Function:New-CLMWindow $script:UiRealWindow;Set-Item Function:Get-CLMUiRows $script:UiRealRows;Set-Item Function:Confirm-CLMUiAction $script:UiRealConfirm}
 Assert ($script:UiPreviewCount.Count -eq 3 -and $script:UiPreviewFailures.Count -eq 0) ('Actual rendered UI failure: '+($script:UiPreviewFailures -join '; '))
 Assert ($script:UiEstimateRecords.Count -eq 3 -and @($script:UiEstimateRecords|Where-Object {$_.root -cne $rows[0].root -or $_.destination -cne (Join-Path $fixture 'preview new destination')}).Count -eq 0) 'Move confirmation did not first estimate space for the exact selected roots'
 Assert ($script:UiConfirmRecords.Count -eq 3 -and @($script:UiConfirmRecords|Where-Object {$_.Action -cne 'Move' -or $_.InstallRoot -cne $rows[0].root -or $_.DestinationRoot -cne (Join-Path $fixture 'preview new destination')}).Count -eq 0) 'Actual Move button dispatched the wrong action or selected source/destination'
 # The updater recovery handoff focuses Recover and never starts it automatically.
 . $UiPath -FunctionsOnly -InitialAction Recover
 Assert ($maintenanceUiRequest.initialAction -ceq 'Recover') 'Updater recovery intent was lost'
 $script:UiRecoveryProof=@{rendered=$false;failure='';cancel=$null}
 function Confirm-CLMUiAction($Window,$Row,$Arguments,[string]$Language){$script:UiRecoveryProof.cancel=$Arguments;return $false}
 $script:UiRecoveryRow=[pscustomobject]@{root=$rows[0].root;activeRoot=$rows[0].root;domain='?';version='1.0.8';state='recovery';canCancelMove=$true;distroName=$rows[0].distroName;logicalId=$rows[0].logicalId}
 function Get-CLMUiRows {return @($script:UiRecoveryRow)}
 function New-CLMWindow([string]$Language){
  $preview=& $script:UiRealWindow $Language;$preview.Tag=$script:UiRecoveryProof
  $preview.Add_ContentRendered({param($sender,$event)
   try{
    $sender.Tag.rendered=$true
    if(-not $sender.FindName('Recover').IsEnabled -or $sender.FindName('Move').IsEnabled){throw 'Recovery handoff enables the wrong actions'}
    if(-not $sender.FindName('Recover').IsKeyboardFocused){throw 'Initial recovery did not focus Recover'}
    if($sender.FindName('Progress').IsIndeterminate){throw 'Recovery handoff automatically started an operation'}
    if(-not $sender.FindName('CancelMove').IsEnabled){throw 'Early pending move lacks cancellation'}
    $sender.FindName('CancelMove').RaiseEvent([Windows.RoutedEventArgs]::new([Windows.Controls.Button]::ClickEvent))
   }catch{$sender.Tag.failure=$_.Exception.Message}finally{$sender.Close()}
  })
  return $preview
 }
 try{Show-CastlinkMaintenance $rows[0].root en '' '' -InitialAction Recover}finally{Set-Item Function:New-CLMWindow $script:UiRealWindow;Set-Item Function:Get-CLMUiRows $script:UiRealRows;Set-Item Function:Confirm-CLMUiAction $script:UiRealConfirm}
 Assert ($script:UiRecoveryProof.rendered -and -not $script:UiRecoveryProof.failure) ('Actual recovery handoff failed: '+$script:UiRecoveryProof.failure)
 Assert ($script:UiRecoveryProof.cancel -and $script:UiRecoveryProof.cancel.Action -ceq 'CancelMove' -and $script:UiRecoveryProof.cancel.InstallRoot -ceq $rows[0].root -and $script:UiRecoveryProof.cancel.Confirmation -ceq $rows[0].distroName) 'Actual cancellation button lost explicit selected-root/distro confirmation'
 Write-Host 'PASS: actual WPF Move controls, exact argument mapping, confirmation, unavailable/pending guards, private recovery discovery and destination selection; no WSL/product actions'
}finally{$w.Close();Remove-Item -LiteralPath $fixture -Recurse -Force}
