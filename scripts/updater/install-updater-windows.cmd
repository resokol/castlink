@echo off
setlocal
set "CASTLINK_UPDATER_BOOTSTRAP=%~f0"
"%SystemRoot%\System32\WindowsPowerShell\v1.0\powershell.exe" -NoLogo -NoProfile -STA -ExecutionPolicy Bypass -Command "$ErrorActionPreference='Stop';try{$raw=[IO.File]::ReadAllText($env:CASTLINK_UPDATER_BOOTSTRAP).Replace([string][char]13,'');$mark=([string][char]10)+'# CASTLINK_BOOTSTRAP_PAYLOAD'+[char]10;$offset=$raw.IndexOf($mark);if($offset -lt 0){throw 'Bootstrap payload missing'};& ([scriptblock]::Create($raw.Substring($offset+$mark.Length)))}catch{Write-Host ('CastLink updater: '+$_.Exception.Message);exit 1}"
set "castlink_updater_exit=%errorlevel%"
if not "%castlink_updater_exit%"=="0" pause
exit /b %castlink_updater_exit%
# CASTLINK_BOOTSTRAP_PAYLOAD
param([switch]$FunctionsOnly)
$ErrorActionPreference='Stop'
function Get-CLBBytes([string]$Url,[long]$Limit){
 $uri=[uri]$Url;if($uri.Scheme -cne 'https' -or $uri.Host -cnotin @('api.github.com','github.com')){throw 'Invalid release origin'}
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12
 $request=[Net.HttpWebRequest]::Create($uri);$request.UserAgent='CastLink-Updater-Bootstrap/1';$request.Timeout=30000;$request.ReadWriteTimeout=30000
 $response=$request.GetResponse();$memory=[IO.MemoryStream]::new()
 try{
  if($response.ResponseUri.Scheme -cne 'https' -or $response.ResponseUri.Host -cnotin @('api.github.com','github.com','objects.githubusercontent.com','release-assets.githubusercontent.com') -or $response.ContentLength -gt $Limit){throw 'Invalid release response'}
  $stream=$response.GetResponseStream();$buffer=New-Object byte[] 65536;$clock=[Diagnostics.Stopwatch]::StartNew()
  while(($n=$stream.Read($buffer,0,$buffer.Length)) -gt 0){if($memory.Length+$n -gt $Limit -or $clock.Elapsed.TotalSeconds -gt 120){throw 'Release response exceeds limit'};$memory.Write($buffer,0,$n)}
  return ,$memory.ToArray()
 }finally{$memory.Dispose();$response.Dispose()}
}
function Read-CLBJson([byte[]]$Bytes){$value=ConvertFrom-Json -InputObject ([Text.Encoding]::UTF8.GetString($Bytes));return $value}
function Get-CLBHash([byte[]]$Bytes){$sha=[Security.Cryptography.SHA256]::Create();try{return ([BitConverter]::ToString($sha.ComputeHash($Bytes))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}}
function Get-CLBCatalog{
 $all=@();for($page=1;$page -le 10;$page++){$bytes=Get-CLBBytes ('https://api.github.com/repos/resokol/castlink/releases?per_page=100&page='+$page) 4194304;$batch=@(Read-CLBJson $bytes);$all+=@($batch);if($batch.Count -lt 100){return $all}};throw 'Release catalogue is incomplete'
}
function Get-CLBAsset($Release,[string]$Name,[long]$Limit){
 $items=@($Release.assets|Where-Object {$_.name -ceq $Name});if($items.Count -ne 1){throw 'Missing or duplicate release asset'};$asset=$items[0]
 if($asset.id -le 0 -or $asset.state -cne 'uploaded' -or $asset.size -le 0 -or $asset.size -gt $Limit -or $asset.digest -cnotmatch '^sha256:[a-f0-9]{64}$' -or $asset.browser_download_url -cne ('https://github.com/resokol/castlink/releases/download/'+$Release.tag_name+'/'+$Name)){throw 'Invalid release asset metadata'}
 $bytes=Get-CLBBytes $asset.browser_download_url $asset.size
 if($bytes.Length -ne $asset.size -or (Get-CLBHash $bytes) -cne $asset.digest.Substring(7)){throw 'Release asset checksum or size mismatch'}
 return [pscustomobject]@{metadata=$asset;bytes=$bytes}
}
function Invoke-CLBScript([string]$File,[switch]$Install){$arguments=@('-NoLogo','-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',$File);if($Install){$arguments+='-Install'};& (Join-Path $PSHOME 'powershell.exe') @arguments;if($LASTEXITCODE -ne 0){throw 'Updater installation or launch failed'}}
function Invoke-CLBInstall{
 $pattern='^updater-v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))-([a-f0-9]{12})$'
 $stable=@(Get-CLBCatalog|Where-Object {$_.draft -eq $false -and $_.prerelease -eq $false -and $_.published_at -and $_.tag_name -cmatch $pattern}|Sort-Object {[version]([regex]::Match($_.tag_name,$pattern).Groups[1].Value)} -Descending)
 if(-not $stable.Count){throw 'No stable updater release available'};$selected=$stable[0];$tag=[regex]::Match($selected.tag_name,$pattern)
 if(@($stable|Where-Object {([regex]::Match($_.tag_name,$pattern).Groups[1].Value -ceq $tag.Groups[1].Value) -and $_.tag_name -cne $selected.tag_name}).Count){throw 'Ambiguous updater version identity'}
 if($selected.id -le 0){throw 'Numeric release identity required'}
 $release=Read-CLBJson (Get-CLBBytes ('https://api.github.com/repos/resokol/castlink/releases/'+$selected.id) 4194304)
 if($release.id -ne $selected.id -or $release.tag_name -cne $selected.tag_name -or $release.draft -ne $false -or $release.prerelease -ne $false -or -not $release.published_at){throw 'Release identity changed'}
 $manifestAsset=Get-CLBAsset $release 'manifest.json' 1048576;$manifest=Read-CLBJson $manifestAsset.bytes
 if($manifest.schemaVersion -ne 1 -or $manifest.protocolVersion -ne 1 -or $manifest.channel -cne 'updater' -or $manifest.repository -cne 'resokol/castlink' -or $manifest.version -cne $tag.Groups[1].Value -or $manifest.releaseTag -cne $release.tag_name -or $manifest.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $manifest.sourceCommit.Substring(0,12) -cne $tag.Groups[2].Value -or $release.target_commitish -cne $manifest.sourceCommit){throw 'Updater manifest identity or protocol mismatch'}
 $platform=$manifest.platforms.windows;if($platform.entry -cne 'castlink-updater.ps1' -or @($platform.files).Count -ne 1 -or $platform.files[0].file -cne $platform.entry){throw 'Invalid Windows updater inventory'}
 $asset=Get-CLBAsset $release $platform.entry 4194304;$entry=$platform.files[0]
 if($entry.size -ne $asset.metadata.size -or $entry.sha256 -cne $asset.metadata.digest.Substring(7)){throw 'Updater manifest checksum mismatch'}
 $dir=Join-Path ([IO.Path]::GetTempPath()) ('castlink-updater-install-'+[guid]::NewGuid().ToString('N'))
 try{
  [void][IO.Directory]::CreateDirectory($dir);$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$acl=[Security.AccessControl.DirectorySecurity]::new();$acl.SetOwner($sid);$acl.SetAccessRuleProtection($true,$false);$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl','ContainerInherit,ObjectInherit','None','Allow'));([IO.DirectoryInfo]::new($dir)).SetAccessControl($acl)
  $file=Join-Path $dir 'castlink-updater.ps1';[IO.File]::WriteAllBytes($file,$asset.bytes)
  Invoke-CLBScript $file -Install;Invoke-CLBScript $file
 }finally{if(Test-Path -LiteralPath $dir){Remove-Item -LiteralPath $dir -Recurse -Force}}
}
if(-not $FunctionsOnly){Invoke-CLBInstall}
