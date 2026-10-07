param([string]$HelperPath,[string]$EntryPath)
$ErrorActionPreference='Stop'
. $HelperPath
$folder=Join-Path ([IO.Path]::GetTempPath()) ('castlink-remove-fixture-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $folder
try {
  $release=[pscustomobject]@{images=[pscustomobject]@{web='web:test';postgres='postgres:test';livekit='livekit:test';caddy='caddy:test'}}
  $state=New-SimpleConfiguration $folder '192.168.1.20' $false $release
  Write-SimpleConfiguration $folder $state $release $state.address
  $script:ServerFolder=$folder.Replace('\','/');$script:SshSession=$null
  $script:commands=New-Object Collections.Generic.List[object]
  $script:failDown=$false;$script:foreign=$false;$script:unlabeled=$false;$script:validContainer=$false
  function Invoke-DeploymentDocker([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900) {
    $script:commands.Add($Arguments)
    if ($Arguments[0] -eq 'ps') { if ($script:foreign -or $script:validContainer) { return 'container1' }; return '' }
    if ($script:unlabeled -and $Arguments[0] -eq 'volume' -and $Arguments -contains '{{.Name}}') { return ('castlink-easy-'+$state.installationId.Replace('-','')+'_postgres-data') }
    if ($Arguments[0] -eq 'volume' -and $Arguments[1] -eq 'inspect') { return '[{"Name":"unexpected","Labels":{}}]' }
    if ($script:validContainer -and $Arguments[0] -eq 'inspect') { if ($Arguments[1] -ne 'container1') { throw 'Inspect arguments merged' };return ('[{"Config":{"Labels":{"com.docker.compose.project":"castlink-easy-'+$state.installationId.Replace('-','')+'","com.docker.compose.service":"web"}}}]') }
    if ($Arguments[0] -eq 'inspect') { return '[{"Config":{"Labels":{"com.docker.compose.project":"other","com.docker.compose.service":"web"}}}]' }
    return ''
  }
  function Invoke-DeploymentCompose([string[]]$Arguments,[string]$InputText='',[int]$TimeoutSeconds=900,[string]$ProjectName='') {
    if ($ProjectName -cne ('castlink-easy-'+$state.installationId.Replace('-',''))) { throw 'Explicit project name missing' }
    $script:commands.Add($Arguments)
    if ($script:failDown) { throw 'simulated down failure' };$script:validContainer=$false;return ''
  }
  if ($EntryPath) {
    . $EntryPath -FunctionsOnly -Action remove -Target local -InstallFolder $folder
    function Get-SimpleCurrentRelease { throw 'Remove downloaded a Release' }
    function Read-Host([string]$Prompt) { if ($Prompt -like 'Для подтверждения*') { return 'cancel' };return '1' }
    Start-SimpleSetup
    if ($script:commands.Count) { throw 'Cancel menu dispatched effect' }
  }
  $null=Remove-SimpleDeployment $folder $state -Confirmed:$false
  if ($script:commands.Count) { throw 'Cancel dispatched Docker' }
  $null=Remove-SimpleDeployment $folder $state -Confirmed:$true
  $down=@($script:commands | Where-Object { $_[0] -eq 'down' })
  if ($down.Count -ne 1 -or $down[0] -contains '--volumes') { throw 'Keep-data removed volumes' }
  if (-not (Test-Path (Join-Path $folder 'postgres.env')) -or -not (Test-Path (Join-Path $folder '.castlink-install.json'))) { throw 'Keep-data removed restore credentials' }
  $script:commands.Clear();$script:validContainer=$true
  $null=Remove-SimpleDeployment $folder $state -Confirmed:$true
  if (@($script:commands | Where-Object { $_[0] -eq 'down' }).Count -ne 1) { throw 'Owned container removal refused' }
  $script:validContainer=$false;$script:commands.Clear();$script:foreign=$true
  $refused=$false;try { Remove-SimpleDeployment $folder $state -Confirmed:$true } catch {$refused=$true}
  if (-not $refused -or @($script:commands | Where-Object { $_[0] -eq 'down' }).Count) { throw 'Foreign resource was removed' }
  $script:foreign=$false;$script:unlabeled=$true;$script:commands.Clear()
  $refused=$false;try { Remove-SimpleDeployment $folder $state -Confirmed:$true -DeleteData } catch {$refused=$true}
  if (-not $refused -or @($script:commands | Where-Object { $_[0] -eq 'down' }).Count) { throw 'Unlabeled generated-name volume accepted' }
  $script:unlabeled=$false;$script:commands.Clear();$script:failDown=$true
  $refused=$false;try { Remove-SimpleDeployment $folder $state -Confirmed:$true -DeleteData } catch {$refused=$true}
  if (-not $refused -or -not (Test-Path (Join-Path $folder 'web.env')) -or -not (Test-Path (Join-Path $folder '.castlink-install.json'))) { throw 'Failed down erased saved installation' }
  $script:failDown=$false;$script:commands.Clear()
  $composePath=Join-Path $folder 'compose.json';$original=Get-Content $composePath -Raw
  $wrong=$original | ConvertFrom-Json;$wrong.name='another-project';Write-SimpleText $composePath ($wrong | ConvertTo-Json -Depth 15)
  $refused=$false;try { Remove-SimpleDeployment $folder $state -Confirmed:$true } catch {$refused=$true}
  if (-not $refused -or $script:commands.Count) { throw 'Wrong project was accepted' }
  Write-SimpleText $composePath $original
  $extra=$original | ConvertFrom-Json;$extra | Add-Member -NotePropertyName include -NotePropertyValue 'foreign.yml'
  Write-SimpleText $composePath ($extra | ConvertTo-Json -Depth 15)
  $refused=$false;try { Remove-SimpleDeployment $folder $state -Confirmed } catch {$refused=$true}
  if (-not $refused -or $script:commands.Count) { throw 'Compose include accepted' }
  Write-SimpleText $composePath $original
  Set-SimpleTarget $folder $state 'remote' '203.0.113.22' 'root' 2222
  $refused=$false;try { Assert-SimpleTarget $state 'remote' '203.0.113.23' 2222 } catch {$refused=$true}
  if (-not $refused) { throw 'Saved endpoint mismatch accepted' }
  Assert-SimpleTarget $state 'remote' '203.0.113.22' 2222
  $refused=$false;try { Assert-SimpleTarget ([pscustomobject]@{installationId=$state.installationId;publicHttps=$true}) 'local' } catch {$refused=$true}
  if (-not $refused) { throw 'Legacy VPS accepted as local target' }
  Assert-SimpleTarget ([pscustomobject]@{installationId=$state.installationId;publicHttps=$true}) 'remote' '203.0.113.23' 22
  $script:SshSession=[pscustomobject]@{fixture=$true};$script:remoteWrong=$true;$script:remoteCalls=New-Object Collections.Generic.List[string]
  function Invoke-SimpleSshCommand($Client,[string]$Command) {
    $script:remoteCalls.Add($Command)
    if ($Command -like 'cat --*') { if ($script:remoteWrong) { return [pscustomobject]@{code=0;stdout=$original.Replace('castlink-easy-','other-')} };return [pscustomobject]@{code=0;stdout=$original} }
    return [pscustomobject]@{code=0;stdout=''}
  }
  function ConvertTo-SimplePosixLiteral([string]$Value) { return "'"+$Value.Replace("'","'\''")+"'" }
  $script:commands.Clear();$refused=$false;try { Remove-SimpleDeployment $folder $state -Confirmed -DeleteData } catch {$refused=$true}
  if (-not $refused -or $script:commands.Count) { throw 'Remote project mismatch dispatched removal' }
  $script:remoteWrong=$false;$script:commands.Clear();$null=Remove-SimpleDeployment $folder $state -Confirmed
  if (-not (Test-Path (Join-Path $folder 'web.env')) -or $script:remoteCalls | Where-Object { $_ -like 'rm *' }) { throw 'Remote keep-data deleted configuration' }
  $script:SshSession=$null
  Write-SimpleText (Join-Path $folder 'my-document.txt') 'unrelated'
  $script:commands.Clear();$script:SshSession=[pscustomobject]@{fixture=$true}
  $null=Remove-SimpleDeployment $folder $state -Confirmed:$true -DeleteData
  $remoteDelete=@($script:remoteCalls | Where-Object { $_ -like 'rm *' })
  if ($remoteDelete.Count -ne 1 -or $remoteDelete[0] -notlike 'rm -f -- *' -or $remoteDelete[0] -match '--recursive|-rf|my-document') { throw 'Remote purge removed foreign files' }
  $down=@($script:commands | Where-Object { $_[0] -eq 'down' })
  if ($down.Count -ne 1 -or $down[0] -notcontains '--volumes') { throw 'Purge missed own volumes' }
  if (Test-Path (Join-Path $folder 'web.env')) { throw 'Purge left active secret configuration' }
  if (-not (Test-Path (Join-Path $folder 'my-document.txt'))) { throw 'Purge removed unrelated file' }
  if (($script:commands | ConvertTo-Json -Depth 8) -match 'prune|rmi|system|wsl') { throw 'Global cleanup dispatched' }
  Write-Output 'SIMPLE_REMOVE_FIXTURES_PASS cancellation keep purge mismatch foreign failure legacy endpoint'
} finally { Remove-Item -LiteralPath $folder -Recurse -Force }
