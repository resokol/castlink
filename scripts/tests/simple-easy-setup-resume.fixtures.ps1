param([string]$EntryPath,[string]$GuiPath)
$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('castlink-resume-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory $root
try {
  . $EntryPath -FunctionsOnly
  $wslProbe=(Get-Command Get-SimpleWslState).ScriptBlock
  function Get-WindowsOptionalFeature { return [pscustomobject]@{State='EnablePending'} }
  if((& $wslProbe) -cne 'reboot-required'){throw 'Actual WSL probe missed a pending virtualization feature'}
  # The real Windows executable must receive an option, not a quoted Linux
  # command. Compare with PowerShell's direct native invocation on this OS.
  $wsl=Join-Path $env:SystemRoot 'System32/wsl.exe'
  if(Test-Path -LiteralPath $wsl){
    $null=& $wsl --status 2>&1;$directCode=$LASTEXITCODE
    $probeCode=Get-SimpleWslStatusCode $wsl
    if($probeCode -ne $directCode){throw "WSL option parsing differs: direct=$directCode probe=$probeCode"}
    $global:LASTEXITCODE=0
  }
  $script:InstallFolder=Join-Path $root 'install'
  $null=New-Item -ItemType Directory $script:InstallFolder
  function Get-SimpleResumePointerPath { return (Join-Path $root 'resume.json') }
  $script:Address='192.168.53.68'
  $script:SkipCertificateTrust=$true;$script:SkipReserveServers=$true
  # The checkpoint must exist before any reboot boundary and contain only choices.
  Save-SimpleSetupCheckpoint -Folder $script:InstallFolder -Address $script:Address -Stage 'runtime'
  $checkpoint=Read-SimpleSetupCheckpoint $script:InstallFolder
  if(-not $checkpoint -or $checkpoint.address -cne $script:Address){throw 'Local choices were not saved before prerequisite preparation'}
  $raw=Get-Content (Join-Path $script:InstallFolder '.castlink-setup-pending.json') -Raw
  if($raw -match 'password|token|secret|ssh|login'){throw 'Checkpoint contains credential fields'}
  $script:Boot='before-reboot'
  function Get-SimpleBootIdentity { return $script:Boot }
  function Find-Desktop { return $script:Desktop }
  function Get-SimpleWslState { return $script:Wsl }
  function Test-LinuxEngine { return $script:Engine }
  function Invoke-SimpleDownload { param($Uri,$OutFile,$Label,$TimeoutSec); $script:Downloads++;[IO.File]::WriteAllText($OutFile,'fixture') }
  function Get-AuthenticodeSignature { return [pscustomobject]@{Status='Valid';SignerCertificate=[pscustomobject]@{Subject='Docker'}} }
  function Read-Host { $script:Prompts++;return 'да' }
  function Get-Process { return $null }
  function Start-Sleep { }
  function Start-Process {
    param($FilePath,$ArgumentList,[switch]$Wait,[switch]$PassThru,$Verb,$WindowStyle)
    if($FilePath -like '*Installer.exe'){$script:Installs++;return [pscustomobject]@{ExitCode=3010}}
    if($FilePath -like '*Docker Desktop.exe' -and ($ArgumentList -cne '--background' -or $WindowStyle -cne 'Hidden')){throw 'Docker startup must request background mode without opening its dashboard'}
    $script:Starts++;$script:Engine=$true
    return [pscustomobject]@{ExitCode=0}
  }
  $script:Desktop=$null;$script:Wsl='ready';$script:Engine=$false
  $script:Downloads=0;$script:Installs=0;$script:Prompts=0;$script:Starts=0
  try { Prepare-LocalRuntime;throw 'Installer reboot was silently accepted' } catch { if($_.Exception.Message -notmatch 'Перезагрузи'){throw} }
  if($script:Downloads -ne 1 -or $script:Installs -ne 1){throw 'First Docker installation was not performed once'}
  # A retry before reboot must never re-download or re-run the installer.
  try { Prepare-LocalRuntime;throw 'Pre-reboot retry was silently accepted' } catch { if($_.Exception.Message -notmatch 'Перезагрузи'){throw} }
  if($script:Downloads -ne 1 -or $script:Installs -ne 1){throw 'Docker installer repeated before reboot'}
  # After reboot an installed but closed Desktop must start, not install again.
  $script:Boot='after-reboot';$script:Desktop=Join-Path $root 'Docker Desktop.exe'
  $null=New-Item -ItemType Directory (Join-Path $root 'resources/bin') -Force
  [IO.File]::WriteAllText((Join-Path $root 'resources/bin/docker.exe'),'fixture')
  Prepare-LocalRuntime
  if($script:Starts -ne 1 -or $script:Installs -ne 1 -or $script:Downloads -ne 1){throw 'Installed but stopped Docker was reinstalled'}
  # Pending Windows virtualization must pause even with Docker already installed.
  $script:Engine=$false;$script:Wsl='reboot-required'
  try { Prepare-LocalRuntime;throw 'Pending virtualization was ignored' } catch { if($_.Exception.Message -notmatch 'Перезагрузи'){throw} }
  if($script:Starts -ne 1 -or $script:Installs -ne 1){throw 'Pending virtualization started/reinstalled Docker'}
  $script:Boot='after-virtualization-reboot';$script:Wsl='ready';$script:Engine=$true
  Prepare-LocalRuntime
  $resumed=Read-SimpleSetupCheckpoint $script:InstallFolder
  if($resumed.address -cne $checkpoint.address -or $resumed.skipCertificateTrust -ne $true -or $resumed.skipReserveServers -ne $true){throw 'Runtime progression reset nonsecret choices'}
  # A checkpoint from the old false WSL reboot must not trap the same boot
  # after upgrading the wizard, when WSL and the engine are already ready.
  $stale=Read-SimpleSetupCheckpoint $script:InstallFolder
  $stale.stage='wsl-reboot';$stale.restartBoot=$script:Boot;Write-SimpleSetupCheckpoint $stale
  Prepare-LocalRuntime
  $stale.stage='runtime';Write-SimpleSetupCheckpoint $stale
  # Installer success plus an unresolved probe is not evidence for another reboot.
  $script:Engine=$false;$script:Wsl='unready'
  try { Prepare-LocalRuntime;throw 'Unready WSL was silently accepted' } catch {
    if($_.Exception.Data['SimpleSetupRestartRequired']){throw 'Unresolved WSL was incorrectly classified as requiring another reboot'}
    if($_.Exception.Message -notmatch 'WSL2 пока не готова'){throw}
  }
  $script:Wsl='ready';$script:Engine=$true
  Write-Output 'SIMPLE_RESUME_RUNTIME_PASS installed-stopped reboot-no-reinstall virtualization-pending choices-no-secrets'
  # Execute the real entry in fresh processes/runspaces. Mock prerequisite and
  # release boundaries only; the actual entry must restore choices itself.
  $package=Join-Path $root 'package';$scripts=Join-Path $package 'scripts'
  $null=New-Item -ItemType Directory $scripts -Force
  foreach($name in @('windows-simple-easy-setup.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-download.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-cleanup.ps1')){Copy-Item (Join-Path (Split-Path $EntryPath -Parent) $name) (Join-Path $scripts $name)}
  $utf8=New-Object Text.UTF8Encoding($true)
  [IO.File]::AppendAllText((Join-Path $scripts 'simple-easy-setup-runtime.ps1'),@'

function Get-SimpleResumePointerPath { return (Join-Path $global:ResumeFixtureRoot 'entry-resume.json') }
function Get-SimpleBootIdentity { return 'fixture-boot' }
function Prepare-LocalRuntime {
  $marker=Join-Path $global:ResumeFixtureRoot 'prerequisite-requested'
  if(-not(Test-Path $marker)){[IO.File]::WriteAllText($marker,'once');Suspend-SimpleRuntimeForRestart 'docker-reboot' 'Перезагрузи Windows.'}
  Write-Host ('RESUMED_ADDRESS '+$Address)
}
function Find-Desktop { return (Join-Path $global:ResumeFixtureRoot 'Docker Desktop.exe') }
'@,$utf8)
  [IO.File]::AppendAllText((Join-Path $scripts 'simple-easy-setup-deploy.ps1'),@'

function Get-SimpleRuntimeReceiptPath { return (Join-Path $global:ResumeFixtureRoot 'runtime.json') }
function Assert-SimplePortAvailability { }
'@,$utf8)
  $entry=Join-Path $scripts 'windows-simple-easy-setup.ps1'
  $source=[IO.File]::ReadAllText($entry)
  $source=$source.Replace('if (-not $FunctionsOnly) {',@'
function Get-SimpleCurrentRelease { throw 'RELEASE_BOUNDARY' }
if (-not $FunctionsOnly) {
'@)
  [IO.File]::WriteAllText($entry,$source,$utf8)
  $wrapper=Join-Path $root 'invoke-entry.ps1'
  [IO.File]::WriteAllText($wrapper,@'
param($Root,$Entry,[switch]$First)
$global:ResumeFixtureRoot=$Root
if(-not $global:SimpleGuiMessages){function global:Read-Host { param($Prompt);if($Prompt -notlike 'Продолжить незавершённую установку?*'){throw ('Unexpected CLI prompt: '+$Prompt)};return '' }}
if($First){& $Entry -Action install -Target local -InstallFolder (Join-Path $Root 'entry-install') -Address '192.168.53.68' -SkipCertificateTrust -SkipReserveServers}
else{& $Entry}
exit $LASTEXITCODE
'@,$utf8)
  # Get-Process is mocked for Docker above; discover the current shell directly.
  $shell=[Diagnostics.Process]::GetCurrentProcess().MainModule.FileName
  $first=& $shell -NoProfile -File $wrapper -Root $root -Entry $entry -First
  if($LASTEXITCODE -notin @(3010,194) -or ($first -join "`n") -notmatch 'Перезагрузи'){throw 'CLI did not preserve the prerequisite reboot boundary'}
  $global:LASTEXITCODE=0 # The expected native failure was checked above.
  $second=& $shell -NoProfile -File $wrapper -Root $root -Entry $entry
  if($LASTEXITCODE -ne 1 -or ($second -join "`n") -notmatch 'Продолжаю сохранённую установку' -or ($second -join "`n") -notmatch 'RELEASE_BOUNDARY'){throw ('CLI failed to resume saved choices: '+($second -join "`n"))}
  $global:LASTEXITCODE=0 # Keep the GitHub shell trailer from propagating the fixture's checked refusal.
  . $GuiPath -FunctionsOnly
  $channel=New-SimpleGuiChannel
  $worker=Start-SimpleGuiWorker $wrapper @{Root=$root;Entry=$entry} $channel
  $messages=New-Object Collections.Generic.List[object]
  try {
    do {
      $message=$null
      if(-not $channel.messages.TryTake([ref]$message,10000)){throw 'GUI resume stalled'}
      $messages.Add($message)
      if($message.kind -eq 'prompt'){if($message.text -notlike 'Продолжить незавершённую установку?*'){throw ('GUI reset saved choices: '+$message.text)};$channel.responses.Add([pscustomobject]@{value='да'})}
    } while($message.kind -ne 'done')
  } finally { Close-SimpleGuiWorker $worker }
  if($message.exitCode -ne 1 -or ($messages.text -join "`n") -notmatch 'RELEASE_BOUNDARY'){throw 'GUI did not continue through the same saved setup entry'}
  $entryCheckpoint=Read-SimpleSetupCheckpoint (Join-Path $root 'entry-install')
  if($entryCheckpoint.stage -cne 'runtime-ready' -or -not $entryCheckpoint.skipCertificateTrust -or -not $entryCheckpoint.skipReserveServers){throw 'Resumed entry reset progress or saved flags'}
  Remove-Item (Join-Path $root 'prerequisite-requested')
  $channel=New-SimpleGuiChannel
  $worker=Start-SimpleGuiWorker $wrapper @{Root=$root;Entry=$entry;First=$true} $channel
  try {
    do {$message=$null;if(-not $channel.messages.TryTake([ref]$message,10000)){throw 'GUI reboot boundary stalled'}}while($message.kind -ne 'done')
  } finally {Close-SimpleGuiWorker $worker}
  if($message.exitCode -ne 3010 -or -not $message.restartRequired){throw 'GUI did not identify a reboot checkpoint separately from installation failure'}
  # Declining auto-resume leaves the folder checkpoint intact and permits
  # removal/another target; a broken pointer also cannot trap the action menu.
  . $EntryPath -FunctionsOnly
  function Get-SimpleResumePointerPath {return (Join-Path $root 'entry-resume.json')}
  function Read-Host {param($Prompt);if($Prompt -like 'Продолжить незавершённую установку?*'){return 'нет'};if($Prompt -like 'CastLink:*'){return '3'};if($Prompt -like 'Где удалить*'){return '2'};throw ('Unexpected decline prompt: '+$Prompt)}
  function Start-SimpleRemoteRemoval {Write-Output 'DECLINED_RESUME_REMOTE_REMOVE'}
  $declined=Start-SimpleSetup
  if($declined -notcontains 'DECLINED_RESUME_REMOTE_REMOVE' -or (Test-Path (Get-SimpleResumePointerPath)) -or -not(Test-Path (Join-Path $root 'entry-install/.castlink-setup-pending.json'))){throw 'Declining resume discarded the checkpoint or blocked another action'}
  [IO.File]::WriteAllText((Get-SimpleResumePointerPath),'broken-json')
  if(Get-SimplePendingSetup){throw 'Broken resume pointer was accepted'}
  Write-Output 'SIMPLE_RESUME_ENTRY_PASS real-cli real-gui fresh-launch saved-choices progress-retained'
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
