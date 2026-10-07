param([string]$EntryPath)
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly
$script:fixtureFolder=Join-Path $env:TEMP ('castlink-release-fixture-'+[Guid]::NewGuid().ToString())
$null=New-Item -ItemType Directory -Path $script:fixtureFolder
$script:fixtureZip=Join-Path $script:fixtureFolder 'fake.zip'
[IO.File]::WriteAllText($script:fixtureZip,'package-fixture')
$script:fixtureHash=(Get-FileHash $script:fixtureZip -Algorithm SHA256).Hash.ToLowerInvariant()
$script:redirect='https://github.com/resokol/castlink-releases/releases/tag/easy-setup-fixture';$script:headCalls=0;$script:windowsDownloads=0
function Invoke-RestMethod { throw 'Unexpected dependency on api.github.com' }
function Invoke-WebRequest {
 param($Uri,$Method,$OutFile,$Headers,[switch]$UseBasicParsing,$TimeoutSec)
 if ($Method -eq 'Head') {
  if ([string]$Uri -cne 'https://github.com/resokol/castlink-releases/releases/latest') { throw 'Updater contacted private source repository' }
  $script:headCalls++
  return [pscustomobject]@{BaseResponse=[pscustomobject]@{ResponseUri=[Uri]$script:redirect}}
 }
 if ($Uri -like '*/SHA256SUMS') { [IO.File]::WriteAllText($OutFile,($script:fixtureHash+'  CastLink-Windows.zip'+"`n"+$script:fixtureHash+'  CastLink-Linux.tar.gz'+"`n")); return }
 if ($Uri -like '*/CastLink-Windows.zip') { $script:windowsDownloads++ }
 Copy-Item $script:fixtureZip $OutFile -Force
}
function Invoke-SimpleDownload { param($Uri,$OutFile,$Label,$Headers) Invoke-WebRequest -Uri $Uri -OutFile $OutFile -Headers $Headers }
function Expand-Archive {
 param($LiteralPath,$DestinationPath,[switch]$Force)
 $null=New-Item -ItemType Directory -Path (Join-Path $DestinationPath 'payload') -Force
 [IO.File]::WriteAllText((Join-Path $DestinationPath 'payload\release.json'),'{}')
}
try {
 $current=Get-SimpleCurrentRelease $script:fixtureFolder
 if ($current.release.tag_name -ne 'easy-setup-fixture' -or -not (Test-Path (Join-Path $script:fixtureFolder 'EasySetup.cmd'))) { throw 'Browser latest feed/installed launcher missing' }
 $gui=Join-Path $current.folder 'scripts';$null=New-Item -ItemType Directory $gui -Force;[IO.File]::WriteAllText((Join-Path $gui 'simple-easy-setup-gui.ps1'),'fixture')
 $null=Get-SimpleCurrentRelease $script:fixtureFolder
 $launcher=[IO.File]::ReadAllText((Join-Path $script:fixtureFolder 'EasySetup.cmd'));if($launcher -notmatch 'simple-easy-setup-gui' -or $launcher -match '-InstallFolder'){throw 'Saved GUI launcher forced old folder across target choice'}
 if([IO.File]::ReadAllText((Join-Path $script:fixtureFolder 'EasySetup-Console.cmd')) -notmatch 'windows-simple-easy-setup'){throw 'Console mode lost'}
 if ($script:headCalls -ne 2 -or $script:windowsDownloads -ne 1) { throw 'Current release check or verified cache reuse failed' }
 $linux=Get-SimpleLinuxPackage $current $script:fixtureFolder
 if ((Get-FileHash $linux).Hash.ToLowerInvariant() -ne $script:fixtureHash) { throw 'Same-tag Linux package verification failed' }
 $script:redirect='https://github.com/resokol/studiolink/releases/tag/easy-setup-fixture'
 $refused=$false;try{$null=Get-SimpleCurrentRelease $script:fixtureFolder}catch{$refused=$_.Exception.Message -like 'GitHub*'}
 if(-not $refused -or $script:windowsDownloads -ne 1){throw 'Cross-repository redirect was accepted'}
 Write-Output 'CURRENT_RELEASE_BROWSER_FEED_CACHE_LAUNCHER_PASS'
} finally { Remove-Item $script:fixtureFolder -Recurse -Force }
