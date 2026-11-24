param([Parameter(Mandatory)][string]$CandidateDirectory,[Parameter(Mandatory)][string]$ExpectedSource,[Parameter(Mandatory)][string]$ScratchRoot)
$ErrorActionPreference='Stop'
$qaPackage=[IO.Path]::GetFullPath($CandidateDirectory)
$qaInstaller=Join-Path $qaPackage 'install-server-windows.ps1'
$qaRoot=Join-Path ([IO.Path]::GetFullPath($ScratchRoot)) ('PackagedWslControls-'+[guid]::NewGuid().ToString('N'))
$qaManifest=Get-Content -Raw -Encoding UTF8 (Join-Path $qaPackage 'manifest.json')|ConvertFrom-Json
if($qaManifest.sourceCommit -cne $ExpectedSource){throw 'Unexpected source'}
$listed=[IO.File]::ReadAllLines((Join-Path $qaPackage 'SHA256SUMS'))
foreach($line in $listed){
 if($line -cnotmatch '^([a-f0-9]{64})  ([A-Za-z0-9._-]+)$'){throw 'Malformed release sum'}
 $digest=$Matches[1];$name=$Matches[2]
 if($name -cin @($qaManifest.sources.file,$qaManifest.upstreamSources.file)){continue}
 if((Get-FileHash -LiteralPath (Join-Path $qaPackage $name)).Hash.ToLowerInvariant() -cne $digest){throw ('Windows package digest mismatch: '+$name)}
}
. $qaInstaller
if($script:PackagedReleaseTag -cne $qaManifest.releaseTag -or $script:PackagedRepository -cne 'resokol/castlink'){throw 'Generated installer release pin mismatch'}
Assert-CastlinkPackage $qaPackage $script:PackagedReleaseTag $script:PackagedRepository $script:PackagedRootfsSha256 $script:PackagedManifestSha256
$state=Get-CastlinkInstallation $qaRoot $script:PackagedReleaseTag $script:PackagedRepository $script:PackagedRootfsSha256
[void][IO.Directory]::CreateDirectory($qaRoot)
Protect-CastlinkInstallationDirectory $qaRoot
$statusFixture=[pscustomobject]@{origin='https://127.0.0.1';ready=$true;buildId=($qaManifest.releaseTag -creplace '^server-wsl-v','')}
$panel=Prepare-CastlinkNativePanel $qaRoot $state $statusFixture $qaPackage $qaInstaller $false
[void](Assert-CastlinkNativePanelReceipt $qaRoot $state)
if($qaManifest.version -ceq '1.0.8'){
 $entry, $other=@($qaManifest.nativePanel.files|Where-Object {$_.file -ceq 'castlink-updater.ps1'})
 if($other -or -not $entry -or (Get-FileHash (Join-Path $qaRoot 'native-panel\castlink-updater.ps1')).Hash.ToLowerInvariant() -cne $entry.sha256){throw 'Packaged updater did not stage as inventoried'}
}
[ordered]@{tag=$qaManifest.releaseTag;source=$qaManifest.sourceCommit;manifestSha256=$script:PackagedManifestSha256;rootfsSha256=$script:PackagedRootfsSha256;nativeHelperCount=$qaManifest.nativePanel.files.Count;controlCompiled=$true;bindingVerified=$true}|ConvertTo-Json
