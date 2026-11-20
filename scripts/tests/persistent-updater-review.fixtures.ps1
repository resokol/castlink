[CmdletBinding()]param([string]$SourcePath)
if(-not $SourcePath){$SourcePath=Join-Path $PSScriptRoot '../updater/castlink-updater.ps1'}
$ErrorActionPreference='Stop'
$script:failures=@();$script:passes=0
function Assert($Condition,$Message){if(-not $Condition){throw $Message}}
function Throws([scriptblock]$Body,[string]$Pattern){try{& $Body}catch{if($_.Exception.Message -match $Pattern){return};throw};throw ('Expected refusal: '+$Pattern)}
function Test($Name,[scriptblock]$Body){try{&{. $SourcePath -FunctionsOnly;& $Body};$script:passes++;Write-Output ('PASS '+$Name)}catch{$script:failures+=@($Name+': '+$_.Exception.Message);Write-Output ('FAIL '+$Name+': '+$_.Exception.Message)}}
$base=Join-Path $env:TEMP ('castlink-review-'+[guid]::NewGuid().ToString('N'));[void][IO.Directory]::CreateDirectory($base)
function Bytes($Value){return [Text.Encoding]::UTF8.GetBytes($Value)}
function Hash([byte[]]$Value){$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($Value))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function AddAsset($Release,$Name,[byte[]]$Data){$asset=[pscustomobject]@{id=(100+$Release.assets.Count);name=$Name;state='uploaded';size=$Data.Length;digest=('sha256:'+(Hash $Data));browser_download_url=('https://github.com/resokol/castlink/releases/download/'+$Release.tag_name+'/'+$Name)};$Release.assets+=@($asset);$script:payload[$asset.browser_download_url]=$Data;return $asset}
function Tool($Version,$Id){$r=[pscustomobject]@{id=$Id;tag_name=('updater-v'+$Version+'-'+('a'*12));target_commitish=('a'*40);published_at='2026-11-21T00:00:00Z';draft=$false;prerelease=$false;assets=@()};$asset=AddAsset $r 'castlink-updater.ps1' (Bytes ('# verified '+$Version));$m=@{schemaVersion=1;protocolVersion=1;repository='resokol/castlink';channel='updater';version=$Version;sourceCommit=('a'*40);releaseTag=$r.tag_name;platforms=@{windows=@{entry=$asset.name;files=@(@{file=$asset.name;size=$asset.size;sha256=$asset.digest.Substring(7)})}}};$null=AddAsset $r 'manifest.json' (Bytes ($m|ConvertTo-Json -Depth 20));return $r}
function Receipt($Root,$Id){return [pscustomobject]@{schemaVersion=1;installationId=$Id;distroName=('CastLink-Server-'+$Id.Substring(0,12));rootPath=$Root;repository='resokol/castlink';releaseTag=('server-wsl-v1.0.7-'+('a'*12));rootfsSha256=('d'*64);phase='ready'}}
try{
 Test 'raw JSON catalogue enumerates 100 entries and page two' {
  $script:pages=@();$first=@(1..100|ForEach-Object {@{id=$_;tag_name=('client-v0.0.'+$_+'-'+('a'*12));draft=$false;prerelease=$false}});$script:raw1=ConvertTo-Json -InputObject $first -Depth 10;$script:raw2='[{"id":101,"tag_name":"updater-v1.0.0-aaaaaaaaaaaa","draft":false,"prerelease":false}]'
  function Receive-CLUUrl($Url,$Destination,$Limit){$script:pages+=@($Url);[IO.File]::WriteAllText($Destination,$(if($Url.EndsWith('page=1')){$script:raw1}else{$script:raw2}))}
  $all=@(Get-CLUReleases);Assert ($all.Count -eq 101 -and $script:pages.Count -eq 2) 'real JSON pages must be flattened and fully traversed';Assert ((Select-CLURelease $all updater).id -eq 101) 'page two release selected individually'
 }
 Test 'active updater identity rejects replaced manifest, numeric ID and full source' {
  $script:payload=@{};$script:r=Tool '1.0.0' 11;$root=Join-Path $base 'identity';Protect-CLUDirectory $root
  function Get-CLUReleases{return $script:r};function Get-CLURelease($Id){return $script:r};function Receive-CLUUrl($Url,$Destination,$Limit){[IO.File]::WriteAllBytes($Destination,$script:payload[$Url])};function Start-CLUEngine{}
  $a=Update-CLUTool $root '' en;$script:r.id=12;Throws {Update-CLUTool $root '' en} 'identity|changed|same';$script:r.id=11
  $old=$script:r.assets[1];$data=Bytes (([Text.Encoding]::UTF8.GetString($script:payload[$old.browser_download_url]))+"`n");$script:r.assets=@($script:r.assets[0]);$null=AddAsset $script:r 'manifest.json' $data
  Throws {Update-CLUTool $root '' en} 'identity|changed|same'
  $m=Read-CLUJson (Join-Path $a.directory 'manifest.json');$script:r.target_commitish='b'*40;Throws {Assert-CLUManifest $m $script:r windows} 'source|identity'
 }
 Test 'panel generations resolve to original root across two upgrades and reject duplicate pointers' {
  $storage=Join-Path $base 'servers';$logical=Join-Path $storage 'original';[void][IO.Directory]::CreateDirectory($logical)
  foreach($id in @(('b'*32),('c'*32))){$physical=Join-Path $storage ('lifecycle-generations/'+$id);[void][IO.Directory]::CreateDirectory($physical);Write-CLUJson (Join-Path $physical 'installation.json') (Receipt $physical $id);Write-CLUJson (Join-Path $logical 'active-generation.json') @{schemaVersion=1;selectedRoot=$logical;activeRoot=$physical;installationId=$id};$rows=@(Get-CLUInstallations $physical);Assert ($rows.Count -eq 1 -and $rows[0].folder -ceq $logical -and $rows[0].activeRoot -ceq $physical) 'panel must retain the logical installation root after every upgrade'}
  $duplicate=Join-Path $storage 'duplicate';[void][IO.Directory]::CreateDirectory($duplicate);Write-CLUJson (Join-Path $duplicate 'active-generation.json') @{schemaVersion=1;selectedRoot=$duplicate;activeRoot=$physical;installationId=$id};Throws {Get-CLUInstallations $physical} 'ambiguous|unique|multiple'
 }
 Test 'recovery uses pinned transaction helper without release discovery' {
  $logical=Join-Path $base 'recovery-server';Protect-CLUDirectory $logical;Write-CLUJson (Join-Path $logical 'installation.json') (Receipt $logical ('e'*32));$row=Read-CLUWslInstallation $logical
  $package=Join-Path $base 'recovery-package';Protect-CLUDirectory $package;$helper=Join-Path $package 'server-wsl-maintenance.ps1';[IO.File]::WriteAllText($helper,'param([switch]$FunctionsOnly);function Invoke-CastlinkMaintenance{}');Set-CLUCreatedFileOwner $helper
  $manifest=@{schemaVersion=1;channel='server-wsl';repository='resokol/castlink';architecture='amd64';version='1.0.8';sourceCommit=('b'*40);releaseTag=('server-wsl-v1.0.8-'+('b'*12));lifecycle=@{schemaVersion=1;runtimeContract='castlink-wsl-pg16-v1';postgresMajor=16;helpers=@(@{file='server-wsl-maintenance.ps1';size=(Get-Item $helper).Length;sha256=(Get-CLUHash $helper)})}}
  Write-CLUJson (Join-Path $package 'manifest.json') $manifest;$pin=Get-CLUHash (Join-Path $package 'manifest.json');$journal=Join-Path $logical 'journal.json';Write-CLUJson $journal @{schemaVersion=1;id='test-transaction';selectedRoot=$logical;journal=$journal;kind='update';phase='stop-source';targetDirectory=$package;manifestSha256=$pin;target=$manifest;source=$row.receipt};Write-CLUJson (Join-Path $logical 'maintenance-transaction.json') @{schemaVersion=1;id='test-transaction';selectedRoot=$logical;journal=$journal}
  function Get-CLUReleases{throw 'latest release must not be consulted'};function Get-CLURelease{throw 'latest release must not be consulted'}
  $plan=Get-CLURecoveryPlan $row;Assert ($plan.version -ceq '1.0.8' -and $plan.directory -ceq $package -and $plan.manifestPin -ceq $pin) 'recovery must retain interrupted target B even if newer C exists'
  [IO.File]::AppendAllText($helper,'corrupt');Throws {Get-CLURecoveryPlan $row} 'checksum|size'
 }
 Test 'failed initial registration can retry without adopting foreign files' {
  $root=Join-Path $base 'registration';$script:interrupt=$true
  function Register-CLUShortcut{}
  $writer=${function:Write-CLUJson}
  function Write-CLUJson($Path,$Value){if($script:interrupt -and $Path.EndsWith('registration.json')){$script:interrupt=$false;throw 'simulated interruption'};& $writer $Path $Value}
  Throws {Install-CLUUpdater $SourcePath $root en} 'interruption';Install-CLUUpdater $SourcePath $root en;Assert (Test-Path (Join-Path $root 'registration.json')) 'registration retry must succeed'
  $foreign=Join-Path $base 'foreign';[void][IO.Directory]::CreateDirectory($foreign);[IO.File]::WriteAllText((Join-Path $foreign 'castlink-updater.ps1'),'unowned');Throws {Install-CLUUpdater $SourcePath $foreign en} 'belongs|ownership|registration'
 }
 Test 'obsolete tool cleanup preserves current previous active users and foreign bytes' {
  $script:payload=@{};$root=Join-Path $base 'cleanup';Protect-CLUDirectory $root;function Get-CLUReleases{return $script:r};function Get-CLURelease($Id){return $script:r};function Receive-CLUUrl($Url,$Destination,$Limit){[IO.File]::WriteAllBytes($Destination,$script:payload[$Url])};function Start-CLUEngine{}
  $script:r=Tool '1.0.0' 1;$one=Update-CLUTool $root '' en;$script:r=Tool '1.0.1' 2;$two=Update-CLUTool $root '' en
  $lease=Enter-CLUVersionLease $one.directory
  try{$script:r=Tool '1.0.2' 3;$three=Update-CLUTool $root '' en;Clear-CLUVersionCache $root;Assert (Test-Path $one.directory) 'in-use version retained'}finally{$lease.Dispose()}
  $foreign=Join-Path (Join-Path $root 'versions') 'foreign';[void][IO.Directory]::CreateDirectory($foreign);[IO.File]::WriteAllText((Join-Path $foreign 'notes.txt'),'retain')
  Clear-CLUVersionCache $root;Assert (-not (Test-Path $one.directory)) 'obsolete verified tool removed';Assert ((Test-Path $two.directory) -and (Test-Path $three.directory) -and (Test-Path $foreign)) 'current previous and unowned files retained'
 }
 Test 'completed product cache frees archives while pending transaction remains intact' {
  $dir=Join-Path $base 'products';Protect-CLUDirectory $dir;$script:payload=@{};$release=[pscustomobject]@{assets=@();tag_name=('server-wsl-v1.0.8-'+('a'*12))};$asset=AddAsset $release 'rootfs.tar.gz' (Bytes 'large archive fixture');[IO.File]::WriteAllBytes((Join-Path $dir $asset.name),$script:payload[$asset.browser_download_url]);$plan=[pscustomobject]@{directory=$dir;release=$release;installation=[pscustomobject]@{identity='selected';channel='server-wsl';folder=(Join-Path $base 'selected')}}
  Set-CLUProductPending $plan $true;Clear-CLUProductPayload $plan;Assert (Test-Path (Join-Path $dir $asset.name)) 'pending operation payload retained';Set-CLUProductPending $plan $false;Clear-CLUProductPayload $plan;Assert (-not (Test-Path (Join-Path $dir $asset.name))) 'successful owned payload removed'
 }
 Test 'standalone CMD never trusts neighboring scripts and embeds manifest verification' {
  $cmd=[IO.File]::ReadAllText((Join-Path (Split-Path $SourcePath -Parent) 'install-updater-windows.cmd'))
  Assert (-not $cmd.Contains('if exist "%~dp0castlink-updater.ps1"')) 'unverified neighboring script is executable'
  Assert ($cmd.Contains('# CASTLINK_BOOTSTRAP_PAYLOAD') -and $cmd.Contains('manifest.json') -and $cmd.Contains('protocolVersion')) 'standalone first execution requires a pinned compatible manifest'
 }
 Test 'standalone CMD payload verifies raw pages manifest protocol and bytes before either execution' {
  $cmd=[IO.File]::ReadAllText((Join-Path (Split-Path $SourcePath -Parent) 'install-updater-windows.cmd')).Replace([string][char]13,'');$mark="`n# CASTLINK_BOOTSTRAP_PAYLOAD`n";$offset=$cmd.IndexOf($mark);Assert ($offset -gt 0) 'embedded standalone bootstrap required'
  . ([scriptblock]::Create($cmd.Substring($offset+$mark.Length))) -FunctionsOnly
  $script:payload=@{};$script:r=Tool '1.0.0' 42;$script:executions=@();$script:pageReads=0
  function Get-CLBBytes($Url,$Limit){
   if($Url.Contains('?per_page=100&page=1')){$script:pageReads++;return ,(Bytes (ConvertTo-Json -InputObject @(1..100|ForEach-Object {@{id=$_;tag_name='other';draft=$false;prerelease=$false}}) -Depth 10))}
   if($Url.Contains('?per_page=100&page=2')){$script:pageReads++;return ,(Bytes (ConvertTo-Json -InputObject @($script:r) -Depth 20))}
   if($Url.EndsWith('/releases/42')){return ,(Bytes ($script:r|ConvertTo-Json -Depth 20))}
   return ,$script:payload[$Url]
  }
  function Invoke-CLBScript($File,[switch]$Install){Assert ((Get-CLUHash $File) -ceq $script:r.assets[0].digest.Substring(7)) 'first execution must use verified bytes';$script:executions+=@([bool]$Install)}
  Invoke-CLBInstall;Assert ($script:pageReads -eq 2 -and $script:executions.Count -eq 2 -and $script:executions[0] -and -not $script:executions[1]) 'raw catalogue paginated, verified registration precedes GUI'
  $script:executions=@();$asset=$script:r.assets[1];$manifest=Read-CLBJson $script:payload[$asset.browser_download_url];$manifest.protocolVersion=2;$script:r.assets=@($script:r.assets[0]);$null=AddAsset $script:r 'manifest.json' (Bytes ($manifest|ConvertTo-Json -Depth 20));Throws {Invoke-CLBInstall} 'protocol';Assert ($script:executions.Count -eq 0) 'incompatible first tool never executes'
  $script:payload=@{};$script:r=Tool '1.0.0' 42;$script:payload[$script:r.assets[0].browser_download_url]=Bytes 'corrupted';Throws {Invoke-CLBInstall} 'checksum|size';Assert ($script:executions.Count -eq 0) 'tampered first tool never executes'
 }

}finally{Remove-Item -LiteralPath $base -Recurse -Force}
if($script:failures.Count){throw ($script:failures -join "`n")};Write-Output ('PASS '+$script:passes+' review regressions')
