param([string]$EntryPath,[string]$GuiPath)
$ErrorActionPreference='Stop'
$root=Join-Path ([IO.Path]::GetTempPath()) ('castlink-runtime-scope-'+[Guid]::NewGuid())
$null=New-Item -ItemType Directory -Path $root
try {
  $package=Join-Path $root 'package';$scripts=Join-Path $package 'scripts'
  $null=New-Item -ItemType Directory -Path $scripts
  $source=Split-Path $EntryPath -Parent
  foreach($name in @('windows-simple-easy-setup.ps1','simple-easy-setup-download.ps1','simple-easy-setup-deploy.ps1','simple-easy-setup-network.ps1','simple-easy-setup-cleanup.ps1','simple-easy-setup-runtime.ps1','simple-easy-setup-release.json')) {
    Copy-Item -LiteralPath (Join-Path $source $name) -Destination (Join-Path $scripts $name)
  }
  $utf8=New-Object Text.UTF8Encoding($true)
  # Mock only OS/network boundaries, retaining real installer call scopes and
  # Start/Complete runtime ownership. Never install Docker or import images.
  $runtime=Join-Path $scripts 'simple-easy-setup-runtime.ps1'
  [IO.File]::AppendAllText($runtime,@'

function Find-Desktop { return (Join-Path $global:ScopeFixtureRoot 'Docker Desktop.exe') }
function Prepare-LocalRuntime { Write-Host 'FIXTURE_RUNTIME_READY' }
function Get-SimpleResumePointerPath { return (Join-Path $global:ScopeFixtureRoot 'resume.json') }
'@,$utf8)
  $deploy=Join-Path $scripts 'simple-easy-setup-deploy.ps1'
  [IO.File]::AppendAllText($deploy,@'

function Get-SimpleRuntimeReceiptPath { return (Join-Path $global:ScopeFixtureRoot 'runtime.json') }
function Assert-SimplePortAvailability { }
function Invoke-DeploymentDocker { throw 'IMAGE_LOAD_BOUNDARY' }
'@,$utf8)
  $entry=Join-Path $scripts 'windows-simple-easy-setup.ps1'
  $text=[IO.File]::ReadAllText($entry)
  $overrides=@'
function Get-SimpleIPv4 { return @('192.168.1.10') }
function Get-SimpleCurrentRelease { return [pscustomobject]@{folder=$PSScriptRoot.Substring(0,$PSScriptRoot.Length-8)} }
'@
  $text=$text.Replace('if (-not $FunctionsOnly) {',($overrides+"`nif (-not `$FunctionsOnly) {"))
  [IO.File]::WriteAllText($entry,$text,$utf8)
  $payload=Join-Path $package 'payload';$null=New-Item -ItemType Directory $payload
  $images=@{};foreach($service in @('web','postgres','livekit','caddy')){$images[$service]='castlink-easy-'+$service+':'+('a'*40)}
  $release=@{version='scope-fixture';commit=('a'*40);images=$images}
  [IO.File]::WriteAllText((Join-Path $payload 'release.json'),($release|ConvertTo-Json -Depth 5),$utf8)
  $wrapper=Join-Path $root 'invoke.ps1'
  [IO.File]::WriteAllText($wrapper,@'
param([string]$Root,[string]$Entry,[string]$Folder,[switch]$Forward)
$global:ScopeFixtureRoot=$Root
& $Entry -Action install -Target local -InstallFolder $Folder -Address '192.168.1.10' -UseDownloadedPayload:(-not $Forward)
'@,$utf8)
  . $GuiPath -FunctionsOnly
  foreach($forward in @($false,$true)) {
    $folder=Join-Path $root ('install-'+$forward)
    $channel=New-SimpleGuiChannel
    $worker=Start-SimpleGuiWorker $wrapper @{Root=$root;Entry=$entry;Folder=$folder;Forward=$forward} $channel
    $messages=New-Object Collections.Generic.List[object];$creationPrompts=0
    try {
      do {
        $message=$null
        if(-not $channel.messages.TryTake([ref]$message,30000)){throw 'Installer fixture stalled before image boundary'}
        $messages.Add($message)
        if($message.kind -eq 'prompt'){
          if($message.secure -and $creationPrompts -lt 2 -and ($message.text -like 'Задайте пароль создания комнат*' -or $message.text -ceq 'Повторите пароль создания комнат')){
            $creationPrompts++
            $channel.responses.Add([pscustomobject]@{value=(ConvertTo-SecureString 'scope-fixture-only-password' -AsPlainText -Force)})
          }else{$channel.responses.Add([pscustomobject]@{cancelled=$true;value=$null});throw ('Unexpected install prompt: '+$message.text)}
        }
      } while($message.kind -ne 'done')
    } finally { Close-SimpleGuiWorker $worker }
    $logs=$messages.text -join "`n"
    if($message.exitCode -ne 1 -or $logs -notmatch 'IMAGE_LOAD_BOUNDARY') {
      throw ("Actual GUI installer scope failed (forward=$forward): "+$logs)
    }
    $ready=@($messages|Where-Object{$_.text -ceq 'FIXTURE_RUNTIME_READY'}).Count
    if($ready -ne $(if($forward){2}else{1})){throw 'Fresh payload did not execute actual preparation/forwarding'}
    $state=Get-Content -LiteralPath (Join-Path $folder '.castlink-install.json') -Encoding UTF8 -Raw|ConvertFrom-Json
    if($state.completed -or $state.databasePhase -cne 'new'){throw 'Boundary refusal falsely completed deployment'}
    if($creationPrompts -ne 2 -or $state.roomCreationPasswordHash -cnotmatch '^[a-f0-9]{64}$'){throw 'Actual secure room password setup was not preserved before the image boundary'}
  }
  Write-Output 'SIMPLE_RUNTIME_SCOPE_PASS actual-local-entry GUI current-payload-forward ownership-after-prepare failure-not-success'
} finally { Remove-Item -LiteralPath $root -Recurse -Force }
