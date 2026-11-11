param([string]$ControlPath)
$ErrorActionPreference='Stop'
$PSModuleAutoLoadingPreference='None'
. $ControlPath -FunctionsOnly
if(-not(Get-Command Invoke-SimpleControlRecovery -CommandType Function -ErrorAction SilentlyContinue)){throw 'Recovery helper not implemented'}
$script:recoveryCalls=New-Object Collections.Generic.List[object]
$script:recoveryForeign=$false;$script:recoveryRunning=$true;$script:recoveryFailure=$false
$iid=[Guid]::NewGuid().ToString()
function Read-SimpleControlInstallation([string]$Folder){return [pscustomobject]@{state=[pscustomobject]@{installationId=$iid;stopped=$false};project='castlink-fixture';services=@('web')}}
function Enter-SimpleRetentionGuard([string]$Folder){return $null}
function Exit-SimpleRetentionGuard($Guard){}
function Enter-SimpleControlGuard([string]$InstallationId,[int]$TimeoutSeconds){return $null}
function Exit-SimpleControlGuard($Guard){}
function Find-Desktop {return 'fixture-desktop'}
function Set-SimpleControlDocker([string]$Folder,[string]$Desktop){$script:DockerExe='fixture-docker'}
function Test-LinuxEngine([string]$Docker){return $true}
function Get-SimpleControlServices($Installation){return @([pscustomobject]@{name='web';state=$(if($script:recoveryRunning){'running'}else{'exited'})})}
function Assert-SimpleControlContainers($Installation,$Rows){if($script:recoveryForeign){throw 'foreign container'}}
function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName=''){
  $script:recoveryCalls.Add([pscustomobject]@{arguments=$Arguments;input=$InputText;project=$ProjectName;timeout=$TimeoutSeconds})
  if($script:recoveryFailure){throw 'SECRET-RECOVERY'}
  return '{"ok":true,"profile":{"id":"peer","label":"Source","origin":"https://source.example","installationId":"source"}}'
}
$result=Invoke-SimpleControlRecovery 'fixture-folder' 'SECRET-RECOVERY'
if($script:recoveryCalls.Count -ne 1){throw 'Recovery did not make one operator call'}
$call=$script:recoveryCalls[0];$input=$call.input|ConvertFrom-Json
if(($call.arguments -join ' ') -cne 'exec -T web node /app/scripts/server-recovery-client.mjs' -or $input.action -cne 'recover' -or $input.code -cne 'SECRET-RECOVERY' -or $call.project -cne 'castlink-fixture' -or $call.timeout -ne 75){throw 'Recovery escaped stdin or selected installation'}
if([string]$result -match 'SECRET-RECOVERY'){throw 'Recovery exposed code in result'}
foreach($mode in @('foreign','stopped','failure')){
  $script:recoveryCalls.Clear();$script:recoveryForeign=$mode -ceq 'foreign';$script:recoveryRunning=$mode -cne 'stopped';$script:recoveryFailure=$mode -ceq 'failure'
  $refused=$false
  try{$null=Invoke-SimpleControlRecovery 'fixture-folder' 'SECRET-RECOVERY'}catch{$refused=$true;if($_.Exception.Message -match 'SECRET-RECOVERY'){throw 'Recovery exposed code in error'}}
  if(-not $refused){throw ('Unsafe recovery accepted: '+$mode)}
  if($mode -cne 'failure' -and $script:recoveryCalls.Count){throw 'Recovery reached an unverified or stopped web container'}
}
$window=New-SimpleControlWindow 'en'
try{
  if($window.FindName('RecoveryDetails').IsExpanded){throw 'Recovery section must start collapsed'}
  if($window.FindName('RecoveryCode') -isnot [Windows.Controls.PasswordBox]){throw 'Recovery input is not hidden'}
  if($window.FindName('RecoveryCode').MaxLength -ne 65536){throw 'Recovery input is too small for the code contract'}
  foreach($lang in @('ru','en','zh-CN')){
    Update-SimpleControlLanguage $window $lang
    if(-not [string]$window.FindName('RecoveryButton').Content -or -not [string]$window.FindName('RecoveryHelp').Text){throw 'Recovery translation missing'}
    if($lang -cne 'ru' -and [string]$window.FindName('RecoveryHelp').Text -match 'Код'){throw 'Recovery copy was not translated'}
  }
}finally{$window.Close()}
Write-Output 'SIMPLE_CONTROL_RECOVERY_STDIN_SCOPE_REDACTION_WPF_PASS'
