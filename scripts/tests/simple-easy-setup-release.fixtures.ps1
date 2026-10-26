param([string]$EntryPath)
$ErrorActionPreference='Stop'
. $EntryPath -FunctionsOnly
$script:fixtureFolder=Join-Path $env:TEMP ('castlink-release-fixture-'+[Guid]::NewGuid().ToString())
$null=New-Item -ItemType Directory -Path $script:fixtureFolder
$script:fixtureZip=Join-Path $script:fixtureFolder 'fake.zip'
[IO.File]::WriteAllText($script:fixtureZip,'package-fixture')
$script:fixtureHash=(Get-FileHash $script:fixtureZip -Algorithm SHA256).Hash.ToLowerInvariant()
$script:apiReleases=@()
$script:apiPages=$null
$script:apiCalls=New-Object 'Collections.Generic.List[int]'
$script:redirect='https://github.com/resokol/castlink-releases/releases/tag/easy-setup-aaaaaaaaaaaa';$script:headCalls=0;$script:windowsDownloads=0;$script:linuxDownloads=0
function Invoke-RestMethod { throw 'Unexpected dependency on api.github.com' }
function Invoke-WebRequest {
 param($Uri,$Method,$OutFile,$Headers,[switch]$UseBasicParsing,$TimeoutSec)
 if ($Uri -like 'https://api.github.com/*') {
  if($null -eq $script:apiReleases){throw 'API unavailable fixture'}
  $page=[int]([regex]::Match([string]$Uri,'[?&]page=(\d+)').Groups[1].Value)
  $script:apiCalls.Add($page)
  $pageReleases=@($script:apiReleases)
  if($null -ne $script:apiPages){$pageReleases=@();if($script:apiPages.ContainsKey($page)){$pageReleases=@($script:apiPages[$page])}}
  return [pscustomobject]@{Content=ConvertTo-Json -InputObject $pageReleases -Depth 10 -Compress}
 }
 if ($Method -eq 'Head') {
  if ([string]$Uri -cne 'https://github.com/resokol/castlink-releases/releases/latest') { throw 'Updater contacted private source repository' }
  $script:headCalls++
  return [pscustomobject]@{BaseResponse=[pscustomobject]@{ResponseUri=[Uri]$script:redirect}}
 }
 if ($Uri -like '*/SHA256SUMS') { [IO.File]::WriteAllText($OutFile,($script:fixtureHash+'  CastLink-Windows.zip'+"`n"+$script:fixtureHash+'  CastLink-Linux.tar.gz'+"`n")); return }
 if ($Uri -like '*/CastLink-Linux.tar.gz') { $script:linuxDownloads++ }
 if ($Uri -like '*/CastLink-Windows.zip') { $script:windowsDownloads++ }
 Copy-Item $script:fixtureZip $OutFile -Force
}
function Invoke-SimpleDownload { param($Uri,$OutFile,$Label,$Headers) Invoke-WebRequest -Uri $Uri -OutFile $OutFile -Headers $Headers }
function Expand-Archive {
 param($LiteralPath,$DestinationPath,[switch]$Force)
 $null=New-Item -ItemType Directory -Path (Join-Path $DestinationPath 'payload') -Force
 $tag=([Uri]$script:redirect).Segments[-1]
 $commit=($tag.Substring($tag.Length-12,1)*40)
 $meta=@{schemaVersion=1;commit=$commit;distributionRepository='resokol/castlink-releases'}
 if($script:apiReleases){$meta.track='server-setup';$meta.version='1.0.0-rc.8';$meta.sourceCommit=$commit}
 [IO.File]::WriteAllText((Join-Path $DestinationPath 'payload\release.json'),($meta|ConvertTo-Json -Compress))
}
try {
 $current=Get-SimpleCurrentRelease $script:fixtureFolder
 if ($current.release.tag_name -ne 'easy-setup-aaaaaaaaaaaa' -or -not (Test-Path (Join-Path $script:fixtureFolder 'EasySetup.cmd'))) { throw 'Browser latest feed/installed launcher missing' }
 $gui=Join-Path $current.folder 'scripts';$null=New-Item -ItemType Directory $gui -Force;[IO.File]::WriteAllText((Join-Path $gui 'simple-easy-setup-gui.ps1'),'fixture')
 $null=Get-SimpleCurrentRelease $script:fixtureFolder
 $launcher=[IO.File]::ReadAllText((Join-Path $script:fixtureFolder 'EasySetup.cmd'));if($launcher -notmatch 'simple-easy-setup-gui' -or $launcher -match '-InstallFolder'){throw 'Saved GUI launcher forced old folder across target choice'}
 if([IO.File]::ReadAllText((Join-Path $script:fixtureFolder 'EasySetup-Console.cmd')) -notmatch 'windows-simple-easy-setup'){throw 'Console mode lost'}
 if ($script:headCalls -ne 2 -or $script:windowsDownloads -ne 1) { throw 'Current release check or verified cache reuse failed' }
 $installedState=Join-Path $script:fixtureFolder '.castlink-install.json'
 [IO.File]::WriteAllText($installedState,(@{schemaVersion=1;completed=$true;commit=('a'*40);version='1.0.0-rc.8'}|ConvertTo-Json))
 $beforeDownloads=$script:windowsDownloads
 $same=Get-SimpleCurrentRelease $script:fixtureFolder -CheckInstalled
 if(-not $same.alreadyCurrent -or $same.folder -or $script:windowsDownloads -ne $beforeDownloads){throw 'Already current update fetched payload instead of returning explicit no-op'}
 Remove-Item -LiteralPath $installedState
 $linux=Get-SimpleLinuxPackage $current $script:fixtureFolder
 if ((Get-FileHash $linux).Hash.ToLowerInvariant() -ne $script:fixtureHash) { throw 'Same-tag Linux package verification failed' }
 $null=Get-SimpleLinuxPackage $current $script:fixtureFolder
 if($script:linuxDownloads -ne 1){throw 'Verified Linux archive was downloaded twice'}
 $trust=Join-Path $script:fixtureFolder 'Trust-Certificate.ps1';[IO.File]::WriteAllText($trust,'param($Action) exit 7')
 if(Install-SimpleLocalTrust $script:fixtureFolder){throw 'Denied trust falsely reported as trusted'}
 if($LASTEXITCODE -ne 0){throw 'Handled optional trust refusal poisoned final installer exit status'}
 [IO.File]::WriteAllText($trust,'param($Action) exit 0')
 if(-not(Install-SimpleLocalTrust $script:fixtureFolder)){throw 'Successful trust lost'}
 $bundle=Join-Path $script:fixtureFolder 'bundle';$null=New-Item -ItemType Directory (Join-Path $bundle 'payload') -Force
 Copy-Item -LiteralPath (Split-Path $EntryPath -Parent) -Destination (Join-Path $bundle 'scripts') -Recurse
 Copy-Item -LiteralPath $script:fixtureZip -Destination (Join-Path $bundle 'payload/images.tar.gz')
 Copy-Item -LiteralPath (Join-Path (Split-Path (Split-Path $EntryPath -Parent) -Parent) 'LICENSE') -Destination (Join-Path $bundle 'LICENSE')
 $files=@{};Get-ChildItem (Join-Path $bundle 'scripts') -File|ForEach-Object{$files['scripts/'+$_.Name]=(Get-FileHash $_.FullName).Hash.ToLowerInvariant()}
 $files.LICENSE=(Get-FileHash (Join-Path $bundle 'LICENSE')).Hash.ToLowerInvariant()
 $commit='a'*40;$script:redirect='https://github.com/resokol/castlink-releases/releases/tag/easy-setup-'+$commit.Substring(0,12)
 [IO.File]::WriteAllText((Join-Path $bundle 'payload/release.json'),(@{schemaVersion=1;distributionRepository='resokol/castlink-releases';commit=$commit;imageArchive='images.tar.gz';imageArchiveSha256=$script:fixtureHash;bundleFiles=$files}|ConvertTo-Json -Depth 5))
 . (Join-Path $bundle 'scripts/windows-simple-easy-setup.ps1') -FunctionsOnly
 function Invoke-SimpleDownload { param($Uri,$OutFile,$Label,$Headers) Invoke-WebRequest -Uri $Uri -OutFile $OutFile -Headers $Headers }
 $fresh=Join-Path $script:fixtureFolder 'fresh-install'
 $reused=Get-SimpleCurrentRelease $fresh
 if($script:windowsDownloads -ne 1 -or -not (Test-Path (Join-Path $reused.folder 'payload/images.tar.gz')) -or (Get-ChildItem (Join-Path $fresh '.downloads') -Filter '*.zip').Count){throw 'Verified current bundled payload downloaded another full ZIP'}
 [IO.File]::WriteAllText((Join-Path $bundle 'payload/images.tar.gz'),'tampered')
 $null=Get-SimpleCurrentRelease (Join-Path $script:fixtureFolder 'tampered-install')
 if($script:windowsDownloads -ne 2){throw 'Tampered bundled payload skipped verified download fallback'}
 Copy-Item -LiteralPath $script:fixtureZip -Destination (Join-Path $bundle 'payload/images.tar.gz') -Force
 $script:redirect='https://github.com/resokol/castlink-releases/releases/tag/easy-setup-'+('b'*12)
 $null=Get-SimpleCurrentRelease (Join-Path $script:fixtureFolder 'updated-install')
 if($script:windowsDownloads -ne 3){throw 'Older bundled commit skipped current release download'}
 $script:redirect='https://github.com/resokol/studiolink/releases/tag/easy-setup-aaaaaaaaaaaa'
 $refused=$false;try{$null=Get-SimpleCurrentRelease $script:fixtureFolder}catch{$refused=$_.Exception.Message -like 'GitHub*'}
 if(-not $refused -or $script:windowsDownloads -ne 3){throw 'Cross-repository redirect was accepted'}
 $commit='a'*40
 $meta=[pscustomobject]@{commit=$commit;sourceCommit=$commit;version='1.0.0-rc.8';track='server-setup'}
 if(-not(Test-SimpleReleaseTag $meta ('server-setup-v1.0.0-rc.8-'+('a'*12)))){throw 'Independent setup provenance rejected'}
 if(Test-SimpleReleaseTag $meta ('linux-v1.0.0-rc.8-'+('a'*12))){throw 'Standalone Linux tag accepted for Windows setup'}
 $meta.sourceCommit='b'*40
 if(Test-SimpleReleaseTag $meta ('server-setup-v1.0.0-rc.8-'+('a'*12))){throw 'Source commit mismatch accepted'}
 function New-FixtureRelease($tag,$published,$draft=$false){
  $assets=@();foreach($name in @('CastLink-Windows.zip','CastLink-Linux.tar.gz','CastLink-Provisioning.json','manifest.json','SHA256SUMS','CastLink-ThirdParty-Sources.tar.gz','CastLink-ThirdParty-Office-Sources.tar.gz')){$assets+=,[pscustomobject]@{name=$name;state='uploaded';size=1;browser_download_url=('https://github.com/resokol/castlink-releases/releases/download/'+$tag+'/'+$name)}}
  return [pscustomobject]@{tag_name=$tag;published_at=$published;draft=$draft;assets=$assets}
 }
 $good=New-FixtureRelease ('server-setup-v1.0.0-rc.8-'+('a'*12)) '2026-10-20T12:00:00Z'
 $canonical=New-FixtureRelease ('server-setup-v1.0.0-rc.9-'+('b'*12)) '2026-10-21T12:00:00Z'
 foreach($asset in $canonical.assets){$asset.browser_download_url=$asset.browser_download_url.Replace('/resokol/castlink-releases/','/resokol/castlink/')}
 $script:apiReleases=@($canonical)
 $renamed=@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{})
 if($renamed.Count -ne 1 -or $renamed[0].tag_name -cne $canonical.tag_name){throw 'Canonical asset URLs after the repository rename were rejected'}
 $exact=$canonical.assets[0].browser_download_url
 foreach($bad in @($exact.Replace('/resokol/','/other/'),$exact.Replace('/castlink/','/studiolink/'),($exact+'?download=1'),($exact+'#file'),$exact.Replace($canonical.tag_name,'other-tag'),$exact.Replace('/releases/download/','/releases/download/../'),$exact.Replace('https://github.com/','https://github.com.evil.example/'),$exact.Replace('https://github.com/','https://user@github.com/'))){
  $canonical.assets[0].browser_download_url=$bad
  if(@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{}).Count){throw ('Nonexact renamed asset URL accepted: '+$bad)}
 }
 $canonical.assets[0].browser_download_url=$exact
 $higherOlder=New-FixtureRelease ('server-setup-v1.0.0-rc.11-'+('b'*12)) '2026-10-19T12:00:00Z'
 $script:apiReleases=@($good,$higherOlder)
 $semantic=@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{})
 if($semantic.Count -ne 1 -or $semantic[0].tag_name -cne $higherOlder.tag_name){throw 'Newer publication date overrode a higher semantic version'}
 $sameVersionNewer=New-FixtureRelease ('server-setup-v1.0.0-rc.11-'+('c'*12)) '2026-10-21T12:00:00Z'
 $script:apiReleases=@($higherOlder,$sameVersionNewer)
 $semantic=@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{})
 if($semantic[0].tag_name -cne $sameVersionNewer.tag_name){throw 'Equal-version release did not use publication time'}
 if((Compare-SimpleReleaseVersion '1.0.0-rc.9' '1.0.0-rc.11') -ge 0 -or (Compare-SimpleReleaseVersion '1.0.0' '1.0.0-rc.99') -le 0 -or (Compare-SimpleReleaseVersion '1.0.0+build.2' '1.0.0+build.1') -ne 0){throw 'Semantic release comparison is inconsistent'}
 $downgradeFolder=Join-Path $script:fixtureFolder 'higher-installed';$null=New-Item -ItemType Directory $downgradeFolder
 [IO.File]::WriteAllText((Join-Path $downgradeFolder '.castlink-install.json'),(@{schemaVersion=1;completed=$true;version='1.0.0-rc.12';commit=('d'*40)}|ConvertTo-Json))
 $script:apiReleases=@($good);$beforeDownloads=$script:windowsDownloads
 $refused=$false;try{$null=Get-SimpleCurrentRelease $downgradeFolder -CheckInstalled}catch{$refused=$_.Exception.Message -like 'Refusing a server downgrade*'}
 if(-not $refused -or $script:windowsDownloads -ne $beforeDownloads -or (Test-Path (Join-Path $downgradeFolder '.downloads'))){throw 'Installed higher release was downgraded or downloaded a package'}
 $partial=New-FixtureRelease ('server-setup-v1.0.0-rc.9-'+('b'*12)) '2026-10-20T14:00:00Z';$partial.assets=@($partial.assets|Where-Object{$_.name -ne 'CastLink-ThirdParty-Sources.tar.gz'})
 # Keep the real JSON array boundary: Windows PowerShell 5 must unwrap empty,
 # single and multiple records, and continue after a full page of 100 records.
 $script:apiReleases=@();$script:apiCalls.Clear()
 if(@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{}).Count -or ($script:apiCalls -join ',') -cne '1'){throw 'Empty setup page did not stop discovery'}
 $script:apiReleases=@($good)
 $single=@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{})
 if($single.Count -ne 1 -or $single[0].tag_name -cne $good.tag_name){throw 'Single-record setup array was not selected'}
 $client=New-FixtureRelease ('client-v1.0.0-rc.9-'+('b'*12)) '2026-10-20T15:00:00Z'
 $newest=New-FixtureRelease ('server-setup-v1.0.0-rc.11-'+('d'*12)) '2026-10-20T17:00:00Z'
 $script:apiPages=@{1=@((1..99|ForEach-Object{$client})+@($good));2=@($newest)};$script:apiCalls.Clear()
 $paged=@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{})
 if($paged.Count -ne 1 -or $paged[0].tag_name -cne $newest.tag_name -or ($script:apiCalls -join ',') -cne '1,2'){throw 'Setup discovery did not select the newest complete release across pages'}
 $script:apiPages=$null
 $script:apiReleases=@($client,$partial,(New-FixtureRelease ('server-setup-v1.0.0-rc.10-'+('c'*12)) '2026-10-20T16:00:00Z' $true),$good)
 $selected=@(Find-SimpleServerSetupRelease 'resokol/castlink-releases' @{})
 if($selected.Count -ne 1 -or $selected[0].tag_name -cne $good.tag_name){throw 'Wrong product, partial or draft setup selected'}
 $script:redirect='https://github.com/resokol/castlink-releases/releases/tag/'+$good.tag_name
 $heads=$script:headCalls
 $independent=Get-SimpleCurrentRelease (Join-Path $script:fixtureFolder 'independent-track')
 if($independent.release.tag_name -cne $good.tag_name -or $script:headCalls -ne $heads){throw 'Independent setup used the global latest channel'}
 $script:apiReleases=@()
 $script:redirect='https://github.com/resokol/castlink/releases/tag/easy-setup-'+('a'*12)
 $canonicalLegacy=Get-SimpleCurrentRelease (Join-Path $script:fixtureFolder 'canonical-legacy')
 if($canonicalLegacy.release.tag_name -cne ('easy-setup-'+('a'*12))){throw 'Canonical repository redirect broke the historical combined fallback'}
 foreach($suffix in @('?download=1','#file')){
  $script:redirect='https://github.com/resokol/castlink/releases/tag/easy-setup-'+('a'*12)+$suffix
  $refused=$false;try{$null=Get-SimpleCurrentRelease (Join-Path $script:fixtureFolder 'unsafe-legacy')}catch{$refused=$_.Exception.Message -like 'GitHub*'}
  if(-not $refused){throw 'Nonexact historical release redirect accepted'}
 }
 $script:apiReleases=$null
 $heads=$script:headCalls;$downloads=$script:windowsDownloads
 $refused=$false;try{$null=Get-SimpleCurrentRelease (Join-Path $script:fixtureFolder 'api-down')}catch{$refused=$_.Exception.Message -like '*канал установщика*'}
 if(-not $refused -or $script:headCalls -ne $heads -or $script:windowsDownloads -ne $downloads){throw 'Discovery failure silently downgraded to the legacy channel'}
 Write-Output 'CURRENT_RELEASE_BROWSER_FEED_CACHE_LAUNCHER_PASS'
} finally { Remove-Item $script:fixtureFolder -Recurse -Force }

