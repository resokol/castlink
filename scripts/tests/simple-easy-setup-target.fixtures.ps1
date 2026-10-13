param([string]$EntryPath,[string]$DeployPath)
$ErrorActionPreference='Stop'
. $DeployPath
$root=Join-Path $env:TEMP ('castlink-target-fixture-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $root
try {
  function Get-SimpleCurrentRelease([string]$Folder) { $script:feedFolder=$Folder;throw 'FEED_STOP' }
  function Read-Host([string]$Prompt) {
    $script:prompts.Add($Prompt)
    if ($Prompt -like 'Где установить CastLink?*') {
      if ($Prompt -cne 'Где установить CastLink? 1 — Локально; 2 — Внешний сервер') { throw 'Target labels are not the requested two choices' }
      return '2'
    }
    if ($Prompt -like 'Домен (*') { return $script:domainAnswer }
    if ($Prompt -ceq 'IPv4 внешнего сервера [203.0.113.10]' -or $Prompt -ceq 'SSH порт [22]') { return '' }
    if ($Prompt -like 'Где удалить CastLink?*') {
      if ($Prompt -cne 'Где удалить CastLink? 1 — Локально; 2 — Внешний сервер') { throw 'Removal target labels changed' }
      return '2'
    }
    throw ('Unexpected question: '+$Prompt)
  }
  function Begin-RemoteFixture([string]$Ip,[int]$Port,[string]$Folder='') {
    . $EntryPath -FunctionsOnly -Action install -Target choose -ServerIp $Ip -SshPort $Port -InstallFolder $Folder
    function Get-SimpleCurrentRelease([string]$Folder) { $script:feedFolder=$Folder;throw 'FEED_STOP' }
    function Get-SimpleRemoteWorkspace([string]$Ip,[int]$Port) { return (Join-Path $root ($Ip+'-'+$Port)) }
    function Get-SimplePreviousWorkspace { return '' }
    $script:prompts=New-Object Collections.Generic.List[string];$script:feedFolder='';$script:domainAnswer=''
    $message='';try { Start-SimpleSetup } catch { $message=$_.Exception.Message }
    if ($message -cne 'FEED_STOP') { throw ('Remote frontdoor failed before download: '+$message) }
    if ($script:prompts.Count -ne 2) { throw 'Remote install asked for Windows folder' }
    return $script:feedFolder
  }
  $first=Begin-RemoteFixture '203.0.113.10' 22
  if ($script:Domain -cne '203.0.113.10') { throw 'Empty optional domain did not choose IP' }
  $state=[pscustomobject]@{schemaVersion=1;installationId=[Guid]::NewGuid().ToString();target='remote';serverIp='203.0.113.10';sshPort=22;sshLogin='root';address='meet.example.com';publicHttps=$true}
  Save-SimpleState $first $state
  $again=Begin-RemoteFixture '203.0.113.10' 22
  if ($first -cne $again -or (Get-Content (Join-Path $again '.castlink-install.json') -Raw | ConvertFrom-Json).installationId -cne $state.installationId) { throw 'Same VPS retry changed workspace/UUID' }
  $other=Begin-RemoteFixture '203.0.113.11' 22
  $otherPort=Begin-RemoteFixture '203.0.113.10' 2222
  if ($first -ceq $other -or $first -ceq $otherPort -or (Test-Path (Join-Path $other '.castlink-install.json'))) { throw 'Different VPS endpoint reused another state' }
  $explicit=Join-Path $root 'explicit-workspace';$actual=Begin-RemoteFixture '203.0.113.12' 22 $explicit
  if ($actual -cne $explicit) { throw 'Explicit InstallFolder ignored' }
  . $EntryPath -FunctionsOnly -Action install -Target remote
  $default=Get-SimpleRemoteWorkspace '203.0.113.10' 22
  if ((Split-Path $default -Leaf) -cne '203.0.113.10-22' -or $default -match '\.codex|GitHub.SL.studiolink') { throw 'Remote default workspace uses development/agent path' }
  # A launcher in an existing legacy workspace reuses that folder after the
  # selected endpoint is confirmed; it must not invent a replacement UUID.
  . $EntryPath -FunctionsOnly -Action install -Target remote
  function Get-SimpleCurrentRelease([string]$Folder) { $script:feedFolder=$Folder;throw 'FEED_STOP' }
  function Get-SimplePreviousWorkspace { return $first }
  $script:prompts.Clear();$script:feedFolder=''
  $message='';try { Start-SimpleSetup } catch { $message=$_.Exception.Message }
  if ($message -cne 'FEED_STOP' -or $script:feedFolder -cne $first -or $script:Domain -cne 'meet.example.com' -or $script:prompts.Count -ne 3) { throw 'Saved remote launcher endpoint/workspace/domain lost' }
  . $EntryPath -FunctionsOnly -Action install -Target remote -ServerIp '203.0.113.11' -SshPort 22
  function Get-SimplePreviousWorkspace { return $first }
  function Get-SimpleRemoteWorkspace([string]$Ip,[int]$Port) { return (Join-Path $root ($Ip+'-'+$Port)) }
  function Get-SimpleCurrentRelease([string]$Folder) { $script:feedFolder=$Folder;throw 'FEED_STOP' }
  $message='';try { Start-SimpleSetup } catch { $message=$_.Exception.Message }
  if ($message -cne 'FEED_STOP' -or $script:feedFolder -cne $other -or $script:Domain -cne '203.0.113.11') { throw 'Another VPS adopted previous launcher state/domain' }
  . $EntryPath -FunctionsOnly -Action install -Target remote -InstallFolder $first -ServerIp '203.0.113.11' -SshPort 22
  $message='';try { Start-SimpleSetup } catch { $message=$_.Exception.Message }
  if ($message -notmatch 'SSH адрес или порт не совпал') { throw 'Explicit saved endpoint mismatch accepted' }
  # Saved IP installations offer the domain again; explicit empty Domain is
  # a resolved IP choice and must not ask a second time after payload forwarding.
  $ipState=$state|ConvertTo-Json|ConvertFrom-Json;$ipState.address='203.0.113.10';$ipState|Add-Member -NotePropertyName completed -NotePropertyValue $true
  Save-SimpleState $first $ipState
  . $EntryPath -FunctionsOnly -Action install -Target remote -InstallFolder $first -ServerIp '203.0.113.10' -SshPort 22
  $script:domainAnswer='new.example.com';$script:prompts.Clear()
  function Get-SimpleCurrentRelease([string]$Folder) { throw 'FEED_STOP' }
  $message='';try { Start-SimpleSetup } catch { $message=$_.Exception.Message }
  if ($message -cne 'FEED_STOP' -or $script:Domain -cne 'new.example.com' -or $script:prompts.Count -ne 1) { throw 'Saved IP did not offer adding domain' }
  . $EntryPath -FunctionsOnly -Action install -Target remote -InstallFolder $first -ServerIp '203.0.113.10' -SshPort 22 -Domain ''
  function Get-SimpleCurrentRelease([string]$Folder) { throw 'FEED_STOP' }
  $script:prompts.Clear();$message='';try { Start-SimpleSetup } catch { $message=$_.Exception.Message }
  if ($message -cne 'FEED_STOP' -or $script:Domain -cne '203.0.113.10' -or $script:prompts.Count -ne 0) { throw 'Explicit empty domain asked again or lost IP choice' }
  . $EntryPath -FunctionsOnly -Action install -Target remote -InstallFolder $first -ServerIp '203.0.113.10' -SshPort 22 -Domain 'new.example.com'
  function Get-SimpleCurrentRelease([string]$Folder) { throw 'FEED_STOP' }
  $script:prompts.Clear();$message='';try { Start-SimpleSetup } catch { $message=$_.Exception.Message }
  if ($message -cne 'FEED_STOP' -or $script:Domain -cne 'new.example.com' -or $script:prompts.Count) { throw 'Explicit domain lost after forwarding' }
  # Existing remote removal retains explicit saved folder handling and never
  # starts the install workspace/download path.
  . $EntryPath -FunctionsOnly -Action remove -Target choose -InstallFolder $first
  function Start-SimpleRemoteRemoval { $script:removeFolder=$InstallFolder }
  Start-SimpleSetup
  if ($script:removeFolder -cne $first) { throw 'Remote removal lost saved workspace' }
  Write-Output 'SIMPLE_TARGET_FIXTURES_PASS labels remote-no-folder same-endpoint other-endpoint explicit legacy remove'
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
