param([string]$HelperPath=(Join-Path $PSScriptRoot '../simple-easy-setup-reserves.ps1'))
$ErrorActionPreference='Stop'
. (Join-Path (Split-Path $HelperPath -Parent) 'windows-simple-easy-setup.ps1') -FunctionsOnly
. $HelperPath
$script:values=New-Object 'Collections.Generic.Queue[string]';foreach($value in @('да','8.8.8.8','22','Мой резерв','1','нет')){$script:values.Enqueue($value)}
$script:answers=New-Object 'Collections.Generic.Queue[string]';foreach($value in @('2','yes')){$script:answers.Enqueue($value)}
$script:operatorCalls=0;$script:logs=@();$script:stored=$null
function Read-SimpleValue($Prompt,$Default){return $script:values.Dequeue()}
function Read-Host {param($Prompt,[switch]$AsSecureString);if($AsSecureString){return ConvertTo-SecureString 'fixture-private-password' -AsPlainText -Force};return $script:answers.Dequeue()}
function Assert-SimplePublicIPv4($Value){if($Value -cne '8.8.8.8'){throw 'Unexpected host'}}
function Invoke-DeploymentCompose($Arguments,$InputText,$TimeoutSeconds){$j=$InputText|ConvertFrom-Json;if($j.action -cne 'fingerprint' -or $InputText -match 'password'){throw 'Probe used password'};return '{"fingerprint":"SHA256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA"}'}
function Invoke-SimpleReserveOperator([string]$InputText){$script:operatorCalls++;$j=$InputText|ConvertFrom-Json;if($j.action -cne 'provision' -or $j.input.mode -cne 'connect' -or $j.input.authType -cne 'password' -or $j.input.password -cne 'fixture-private-password'){throw 'Bad operator input'};return [pscustomobject]@{id='peer-id';label='Мой резерв';origin='https://8.8.8.8';installationId='11111111-1111-4111-8111-111111111111'}}
function Save-SimpleState($Folder,$State){$script:stored=$State|ConvertTo-Json -Depth 6}
function Write-Host {param([Parameter(ValueFromRemainingArguments=$true)]$Object);$script:logs+=($Object -join ' ')}
$state=[pscustomobject]@{installationId='22222222-2222-4222-8222-222222222222'}
Add-SimpleReserveServers '/tmp/fixture' $state
if($script:operatorCalls -ne 1 -or -not $state.serverProfiles -or $script:stored -match 'fixture-private-password|secret' -or ($script:logs -join ' ') -match 'fixture-private-password'){throw 'Reserve input or persisted/logged credentials are invalid'}
$keyFile=[IO.Path]::GetTempFileName()
try{
  [IO.File]::WriteAllText($keyFile,'fixture-private-key-only')
  foreach($value in @('да','8.8.8.8','22','Мой резерв','2',$keyFile,'нет')){$script:values.Enqueue($value)}
  foreach($value in @('2','yes')){$script:answers.Enqueue($value)}
  function Invoke-SimpleReserveOperator([string]$InputText){$script:operatorCalls++;$j=$InputText|ConvertFrom-Json;if($j.input.authType -cne 'private-key' -or $j.input.privateKey -cne 'fixture-private-key-only' -or $j.input.passphrase -cne 'fixture-private-password' -or $j.input.PSObject.Properties['password']){throw 'Bad private-key operator input'};return [pscustomobject]@{id='peer-key';label='key';origin='https://8.8.8.8'}}
  Add-SimpleReserveServers '/tmp/fixture' $state
  if($script:operatorCalls -ne 2 -or $script:stored -match 'fixture-private|passphrase|privateKey' -or ($script:logs -join ' ') -match 'fixture-private'){throw 'Reserve private key leaked or was not sent through stdin'}
}finally{Remove-Item -LiteralPath $keyFile -Force}
$reader=New-Object IO.StringReader('{"progress":{"stage":"download","bytes":1048576,"total":2097152,"bytesPerSecond":1048576}}'+"`n"+'{"ok":true,"profile":{"id":"peer"}}'+"`n")
$profile=Read-SimpleReserveStream $reader 2
if($profile.id -cne 'peer'){throw 'Streaming operator result was lost'}
Write-Output 'Reserve installer fixtures passed'
