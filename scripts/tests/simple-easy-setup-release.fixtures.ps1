param([string]$EntryPath)
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly
$script:fixtureFolder=Join-Path $env:TEMP ('castlink-release-fixture-'+[Guid]::NewGuid().ToString())
$null=New-Item -ItemType Directory -Path $script:fixtureFolder
$script:fixtureZip=Join-Path $script:fixtureFolder 'fake.zip'
[IO.File]::WriteAllText($script:fixtureZip,'package-fixture')
$script:fixtureHash=(Get-FileHash $script:fixtureZip -Algorithm SHA256).Hash.ToLowerInvariant()
$script:headCalls=0;$script:windowsDownloads=0
function Invoke-RestMethod { throw 'Unexpected dependency on api.github.com' }
function Invoke-WebRequest {
 param($Uri,$Method,$OutFile,$Headers,[switch]$UseBasicParsing,$TimeoutSec)
 if ($Method -eq 'Head') {
  $script:headCalls++
  return [pscustomobject]@{BaseResponse=[pscustomobject]@{ResponseUri=[Uri]'https://github.com/resokol/studiolink/releases/tag/easy-setup-fixture'}}
 }
 if ($Uri -like '*/SHA256SUMS') { [IO.File]::WriteAllText($OutFile,($script:fixtureHash+'  CastLink-Windows.zip'+"`n"+$script:fixtureHash+'  CastLink-Linux.tar.gz'+"`n")); return }
 if ($Uri -like '*/CastLink-Windows.zip') { $script:windowsDownloads++ }
 Copy-Item $script:fixtureZip $OutFile -Force
}
function Expand-Archive {
 param($LiteralPath,$DestinationPath,[switch]$Force)
 $null=New-Item -ItemType Directory -Path (Join-Path $DestinationPath 'payload') -Force
 [IO.File]::WriteAllText((Join-Path $DestinationPath 'payload\release.json'),'{}')
}
try {
 $current=Get-SimpleCurrentRelease $script:fixtureFolder
 if ($current.release.tag_name -ne 'easy-setup-fixture' -or -not (Test-Path (Join-Path $script:fixtureFolder 'EasySetup.cmd'))) { throw 'Browser latest feed/installed launcher missing' }
 $null=Get-SimpleCurrentRelease $script:fixtureFolder
 if ($script:headCalls -ne 2 -or $script:windowsDownloads -ne 1) { throw 'Current release check or verified cache reuse failed' }
 $linux=Get-SimpleLinuxPackage $current $script:fixtureFolder
 if ((Get-FileHash $linux).Hash.ToLowerInvariant() -ne $script:fixtureHash) { throw 'Same-tag Linux package verification failed' }
 Write-Output 'CURRENT_RELEASE_BROWSER_FEED_CACHE_LAUNCHER_PASS'
} finally { Remove-Item $script:fixtureFolder -Recurse -Force }
