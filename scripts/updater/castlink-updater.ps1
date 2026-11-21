# CastLink permanent per-user updater. Windows PowerShell 5.1, no Node dependency.
[CmdletBinding()]
param([switch]$Install,[switch]$FunctionsOnly,[switch]$Engine,[switch]$Probe,
 [string]$InstallRoot,[ValidateSet('ru','en','zh-CN')][string]$Language='ru',
 [string]$ToolDirectory,[string]$UpdaterRoot)
$script:CLURequest=@{install=[bool]$Install;functionsOnly=[bool]$FunctionsOnly;engine=[bool]$Engine;probe=[bool]$Probe;selected=$InstallRoot;language=$Language;languageExplicit=$PSBoundParameters.ContainsKey('Language');tool=$ToolDirectory;root=$UpdaterRoot;source=$PSCommandPath}
$script:CLURepository='resokol/castlink'
function Assert-CLUPath([string]$Path){
 if(-not [IO.Path]::IsPathRooted($Path)){throw 'An absolute local path is required'}
 $p=[IO.Path]::GetFullPath($Path);if($p.StartsWith('\\')){throw 'Network paths are unsupported'};$a=$p
 while($a){if((Test-Path -LiteralPath $a) -and ((Get-Item -LiteralPath $a -Force).Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'Updater paths cannot contain reparse points'};$a=[IO.Path]::GetDirectoryName($a)};return $p
}
function Assert-CLUName([string]$Name){if($Name -cnotmatch '^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$' -or $Name.Contains('..')){throw 'Unsafe asset filename'}}
function Get-CLUHash([string]$Path){return (Get-FileHash -LiteralPath (Assert-CLUPath $Path) -Algorithm SHA256).Hash.ToLowerInvariant()}
function Read-CLUJson([string]$Path,[long]$Limit=1048576){$p=Assert-CLUPath $Path;$s=Get-Item -LiteralPath $p -Force;if($s.PSIsContainer -or $s.Length -gt $Limit){throw 'JSON metadata exceeds limit'};$value=ConvertFrom-Json -InputObject ([IO.File]::ReadAllText($p,[Text.Encoding]::UTF8));return $value}
function Protect-CLUDirectory([string]$Path){
 $p=Assert-CLUPath $Path;[void][IO.Directory]::CreateDirectory($p);$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 $directory=[IO.DirectoryInfo]::new($p);$acl=$directory.GetAccessControl([Security.AccessControl.AccessControlSections]'Access, Owner');$acl.SetAccessRuleProtection($true,$false);foreach($r in @($acl.Access)){$null=$acl.RemoveAccessRuleSpecific($r)}
 foreach($id in @($sid,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'),[Security.Principal.SecurityIdentifier]::new('S-1-5-32-544'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($id,'FullControl','ContainerInherit,ObjectInherit','None','Allow'))}
 # An existing owner can change its DACL without WRITE_OWNER. Grant private access first.
 $directory.SetAccessControl($acl);$owner=$directory.GetAccessControl([Security.AccessControl.AccessControlSections]::Owner)
 if($owner.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid.Value){$owner.SetOwner($sid);$directory.SetAccessControl($owner)};Assert-CLUPrivate $p
}
function Assert-CLUPrivate([string]$Path){
 $p=Assert-CLUPath $Path;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$acl=Get-Acl -LiteralPath $p
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid){throw 'Updater owner differs from the current user'}
 foreach($rule in $acl.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($rule.AccessControlType -eq 'Allow' -and $rule.IdentityReference.Value -notin @($sid,'S-1-5-18','S-1-5-32-544')){throw 'Updater cache is writable/readable by another account'}}
}
function Set-CLUCreatedFileOwner([string]$Path){
 $path=Assert-CLUPath $Path;$file=[IO.FileInfo]::new($path);$acl=$file.GetAccessControl([Security.AccessControl.AccessControlSections]::Owner);$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User
 if($acl.GetOwner([Security.Principal.SecurityIdentifier]).Value -cne $sid.Value){$acl.SetOwner($sid);$file.SetAccessControl($acl)}
}
function Write-CLUJson([string]$Path,$Value){
 $p=Assert-CLUPath $Path;$tmp=$p+'.'+[guid]::NewGuid().ToString('N')+'.new';$bytes=[Text.UTF8Encoding]::new($false).GetBytes(($Value|ConvertTo-Json -Depth 48))
 try{$f=[IO.File]::Open($tmp,'CreateNew','Write','None');try{$f.Write($bytes,0,$bytes.Length);$f.Flush($true)}finally{$f.Dispose()};Set-CLUCreatedFileOwner $tmp;if(Test-Path -LiteralPath $p){[IO.File]::Replace($tmp,$p,[NullString]::Value)}else{[IO.File]::Move($tmp,$p)}}finally{if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force}}
}
function Enter-CLULock([string]$Root,[string]$Identity){
 $dir=Join-Path (Assert-CLUPath $Root) 'locks';Protect-CLUDirectory $dir;$sha=[Security.Cryptography.SHA256]::Create();try{$key=([BitConverter]::ToString($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes($Identity)))).Replace('-','').ToLowerInvariant()}finally{$sha.Dispose()}
 try{return [IO.File]::Open((Join-Path $dir ($key+'.lock')),'OpenOrCreate','ReadWrite','None')}catch{throw 'Another updater owns this installation lock'}
}
function Compare-CLUVersion([string]$Left,[string]$Right){
 $pattern='^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$';$a=[regex]::Match($Left,$pattern);$b=[regex]::Match($Right,$pattern)
 if(-not $a.Success -or -not $b.Success){throw 'Invalid product version'}
 for($i=1;$i -le 3;$i++){$x=[Numerics.BigInteger]::Parse($a.Groups[$i].Value);$y=[Numerics.BigInteger]::Parse($b.Groups[$i].Value);if($x -ne $y){return $x.CompareTo($y)}}
 $x=$a.Groups[4].Value;$y=$b.Groups[4].Value;if($x -ceq $y){return 0};if(-not $x){return 1};if(-not $y){return -1}
 $xs=$x.Split('.');$ys=$y.Split('.');for($i=0;$i -lt [Math]::Max($xs.Count,$ys.Count);$i++){if($i -ge $xs.Count){return -1};if($i -ge $ys.Count){return 1};if($xs[$i] -ceq $ys[$i]){continue};$xn=$xs[$i] -match '^[0-9]+$';$yn=$ys[$i] -match '^[0-9]+$';if($xn -and $yn){return ([Numerics.BigInteger]::Parse($xs[$i])).CompareTo([Numerics.BigInteger]::Parse($ys[$i]))};if($xn){return -1};if($yn){return 1};return [string]::CompareOrdinal($xs[$i],$ys[$i])};return 0
}
function Select-CLURelease([object[]]$Releases,[ValidateSet('updater','client','server-wsl')][string]$Channel,[string]$CurrentVersion){
 $best=$null;$version='';foreach($r in $Releases){if($r.draft -ne $false -or $r.prerelease -ne $false){continue};$m=[regex]::Match([string]$r.tag_name,('^'+$Channel+'-v((?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*))-([a-f0-9]{12})$'));if(-not $m.Success){continue};if($r.id -le 0){throw 'Release numeric identity is invalid'};$v=$m.Groups[1].Value;if($CurrentVersion -and (Compare-CLUVersion $v $CurrentVersion) -le 0){continue};if(-not $best -or (Compare-CLUVersion $v $version) -gt 0){$best=$r;$version=$v}elseif((Compare-CLUVersion $v $version) -eq 0 -and $r.tag_name -cne $best.tag_name){throw 'Ambiguous stable product version'}};return $best
}
function Receive-CLUUrl([string]$Url,[string]$Destination,[long]$Limit){
 $uri=[uri]$Url;if($uri.Scheme -cne 'https' -or $uri.Host -cnotin @('api.github.com','github.com') -or $Limit -le 0 -or $Limit -gt 68719476736L){throw 'Invalid download origin or bound'}
 [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;$request=[Net.HttpWebRequest]::Create($uri);$request.UserAgent='CastLink-Updater/1';$request.Timeout=30000;$request.ReadWriteTimeout=60000;$response=$null;$inputStream=$null;$outputStream=$null;$p=Assert-CLUPath $Destination
 try{$response=$request.GetResponse();if($response.ResponseUri.Scheme -cne 'https' -or $response.ContentLength -gt $Limit){throw 'HTTPS/download size validation failed'};$inputStream=$response.GetResponseStream();$outputStream=[IO.File]::Open($p,'CreateNew','Write','None');$buffer=New-Object byte[] 1048576;$size=0L;$clock=[Diagnostics.Stopwatch]::StartNew();while(($n=$inputStream.Read($buffer,0,$buffer.Length)) -gt 0){$size+=$n;if($size -gt $Limit -or $clock.Elapsed.TotalMinutes -gt 60){throw 'Download exceeded its bound'};$outputStream.Write($buffer,0,$n)};$outputStream.Flush($true)}catch{if($outputStream){$outputStream.Dispose();$outputStream=$null};if(Test-Path -LiteralPath $p){Remove-Item -LiteralPath $p -Force};throw}finally{if($outputStream){$outputStream.Dispose()};if($inputStream){$inputStream.Dispose()};if($response){$response.Dispose()}}
}
function Get-CLUJsonUrl([string]$Url,[long]$Limit=4194304){
 $tmp=Join-Path ([IO.Path]::GetTempPath()) ('castlink-release-'+[guid]::NewGuid().ToString('N')+'.json')
 try{Receive-CLUUrl $Url $tmp $Limit;return Read-CLUJson $tmp $Limit}finally{if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force}}
}
function Get-CLUReleases{
 $all=@();for($page=1;$page -le 10;$page++){$batch=@(Get-CLUJsonUrl ('https://api.github.com/repos/resokol/castlink/releases?per_page=100&page='+$page));$all+=@($batch);if($batch.Count -lt 100){return $all}};throw 'Release catalogue is incomplete; retry later'
}
function Get-CLURelease([long]$Id){if($Id -le 0){throw 'Numeric release ID is required'};return Get-CLUJsonUrl ('https://api.github.com/repos/resokol/castlink/releases/'+$Id)}
function Get-CLUAsset($Release,[string]$Name,[long]$Limit=4194304){
 Assert-CLUName $Name;$items=@($Release.assets|Where-Object {$_.name -ceq $Name});if($items.Count -ne 1){throw ('Release asset is missing or duplicated: '+$Name)};$a=$items[0]
 if($a.id -le 0 -or $a.state -cne 'uploaded' -or $a.size -le 0 -or $a.size -gt $Limit -or $a.digest -cnotmatch '^sha256:[a-f0-9]{64}$' -or $a.browser_download_url -cne ('https://github.com/resokol/castlink/releases/download/'+$Release.tag_name+'/'+$Name)){throw ('Invalid asset metadata: '+$Name)};return $a
}
function Assert-CLUFile([string]$Directory,$Entry){
 Assert-CLUName $Entry.file;$p=Assert-CLUPath (Join-Path $Directory $Entry.file);if($Entry.sha256 -cnotmatch '^[a-f0-9]{64}$' -or $Entry.size -le 0 -or -not (Test-Path -LiteralPath $p -PathType Leaf) -or (Get-Item -LiteralPath $p).Length -ne $Entry.size -or (Get-CLUHash $p) -cne $Entry.sha256){throw ('File checksum or size mismatch: '+$Entry.file)};return $p
}
function Receive-CLUAsset([string]$Directory,$Release,[string]$Name,[long]$Limit=4194304){
 $a=Get-CLUAsset $Release $Name $Limit;$entry=[pscustomobject]@{file=$Name;size=$a.size;sha256=$a.digest.Substring(7)};$p=Join-Path (Assert-CLUPath $Directory) $Name
 if(-not (Test-Path -LiteralPath $p)){$tmp=$p+'.'+[guid]::NewGuid().ToString('N')+'.part';try{Receive-CLUUrl $a.browser_download_url $tmp $a.size;Set-CLUCreatedFileOwner $tmp;if((Get-Item -LiteralPath $tmp).Length -ne $a.size -or (Get-CLUHash $tmp) -cne $entry.sha256){throw 'Downloaded asset checksum or size mismatch'};[IO.File]::Move($tmp,$p)}finally{if(Test-Path -LiteralPath $tmp){Remove-Item -LiteralPath $tmp -Force}}};$null=Assert-CLUFile $Directory $entry;return $p
}
function Assert-CLUManifest($Manifest,$Release,[string]$Platform='windows'){
 if($Manifest.protocolVersion -ne 1){throw 'Unsupported updater protocol; installed products were retained'}
 if($Manifest.schemaVersion -ne 1 -or $Manifest.channel -cne 'updater' -or $Manifest.repository -cne 'resokol/castlink' -or $Manifest.version -cnotmatch '^(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)$' -or $Manifest.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $Release.target_commitish -cne $Manifest.sourceCommit -or $Manifest.releaseTag -cne $Release.tag_name -or $Manifest.releaseTag -cne ('updater-v'+$Manifest.version+'-'+$Manifest.sourceCommit.Substring(0,12)) -or $Release.draft -ne $false -or $Release.prerelease -ne $false){throw 'Updater manifest identity mismatch'}
 $platformInfo=$Manifest.platforms.$Platform;if($Platform -cne 'windows' -or $platformInfo.entry -cne 'castlink-updater.ps1' -or @($platformInfo.files).Count -ne 1 -or $platformInfo.files[0].file -cne $platformInfo.entry){throw 'Unsupported platform entry or file inventory'}
 foreach($e in $platformInfo.files){Assert-CLUName $e.file;$a=Get-CLUAsset $Release $e.file;if($e.size -ne $a.size -or $e.sha256 -cne $a.digest.Substring(7)){throw 'Updater file inventory checksum mismatch'}};return $Manifest
}
function Assert-CLUCache([string]$Directory){
 $dir=Assert-CLUPath $Directory;Assert-CLUPrivate $dir;$record=Read-CLUJson (Join-Path $dir 'verified-release.json') 4194304;$release=$record.release;$manifestAsset=Get-CLUAsset $release 'manifest.json' 1048576
 $null=Assert-CLUFile $dir ([pscustomobject]@{file='manifest.json';size=$manifestAsset.size;sha256=$manifestAsset.digest.Substring(7)})
 $m=Assert-CLUManifest (Read-CLUJson (Join-Path $dir 'manifest.json')) $release windows
 foreach($e in $m.platforms.windows.files){$null=Assert-CLUFile $dir $e;Assert-CLUPrivate (Join-Path $dir $e.file)};return $m
}
function Start-CLUEngine([string]$Directory,[string]$Root,[string]$SelectedRoot,[string]$Language,[switch]$Probe){
 $null=Assert-CLUCache $Directory;$entry=Join-Path $Directory 'castlink-updater.ps1';$tokens=$null;$errors=$null;[void][Management.Automation.Language.Parser]::ParseFile($entry,[ref]$tokens,[ref]$errors);if($errors.Count){throw 'Downloaded updater script cannot be parsed'}
 $args=@('-NoLogo','-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',$entry,'-Engine','-ToolDirectory',$Directory,'-UpdaterRoot',$Root,'-Language',$Language);if($SelectedRoot){$args+=@('-InstallRoot',$SelectedRoot)};if($Probe){$args+='-Probe'}
 $runLease=Enter-CLUVersionLease $Directory;try{& (Join-Path $PSHOME 'powershell.exe') @args;if($LASTEXITCODE -ne 0){throw 'Updater engine activation failed'}}finally{$runLease.Dispose()}
}
function Update-CLUTool([string]$Root,[string]$SelectedRoot,[string]$Language){
 $Root=Assert-CLUPath $Root;Assert-CLUPrivate $Root;$lease=Enter-CLULock $Root 'self-update'
 try{
  $latest=Select-CLURelease @(Get-CLUReleases) updater;if(-not $latest){throw 'No stable updater release is available'};$exact=Get-CLURelease ([long]$latest.id);if($exact.id -ne $latest.id -or $exact.tag_name -cne $latest.tag_name){throw 'Release numeric identity changed'}
  $a=Get-CLUAsset $exact 'manifest.json' 1048576;$versions=Join-Path $Root 'versions';Protect-CLUDirectory $versions;$dir=Join-Path $versions ($exact.tag_name+'-'+$a.digest.Substring(7,12));if(-not (Test-Path -LiteralPath $dir)){Protect-CLUDirectory $dir}else{Assert-CLUPrivate $dir}
  $null=Receive-CLUAsset $dir $exact 'manifest.json' 1048576;$m=Assert-CLUManifest (Read-CLUJson (Join-Path $dir 'manifest.json')) $exact windows
  $activePath=Join-Path $Root 'active.json';$old=$null;if(Test-Path -LiteralPath $activePath){$old=Read-CLUJson $activePath;if((Compare-CLUVersion $m.version $old.current.version) -lt 0){throw 'Stable catalogue would downgrade the updater'};if($m.version -ceq $old.current.version -and ($old.current.releaseTag -cne $m.releaseTag -or $old.current.releaseId -ne $exact.id -or $old.current.manifestSha256 -cne $a.digest.Substring(7) -or $old.current.sourceCommit -cne $m.sourceCommit)){throw 'Same updater version has a changed immutable release identity'}}
  foreach($e in $m.platforms.windows.files){$null=Receive-CLUAsset $dir $exact $e.file};Write-CLUJson (Join-Path $dir 'verified-release.json') ([pscustomobject]@{schemaVersion=1;release=$exact});$null=Assert-CLUCache $dir
  $record=[pscustomobject]@{version=$m.version;releaseTag=$m.releaseTag;sourceCommit=$m.sourceCommit;releaseId=$exact.id;manifestSha256=$a.digest.Substring(7);directory=$dir}
  Start-CLUEngine $dir $Root $SelectedRoot $Language -Probe
  if(-not $old -or $old.current.directory -cne $dir){Write-CLUJson $activePath ([pscustomobject]@{schemaVersion=1;current=$record;previous=$(if($old){$old.current}else{$null})})}
  Clear-CLUVersionCache $Root
  return $record
 }finally{$lease.Dispose()}
}
function Enter-CLUVersionLease([string]$Directory){
 Assert-CLUPrivate $Directory
 return [IO.File]::Open((Join-Path $Directory 'engine.lock'),'OpenOrCreate','ReadWrite','ReadWrite')
}
function Clear-CLUVersionCache([string]$Root){
 $pointer=Join-Path $Root 'active.json';if(-not (Test-Path -LiteralPath $pointer)){return}
 $active=Read-CLUJson $pointer;$keep=@($active.current.directory,$active.previous.directory);$versions=Join-Path $Root 'versions'
 foreach($dir in Get-ChildItem -LiteralPath $versions -Directory -Force){
  if($dir.FullName -in $keep){continue};$lease=$null
  try{
   $m=Assert-CLUCache $dir.FullName;$known=@('manifest.json','verified-release.json','engine.lock')+@($m.platforms.windows.files|ForEach-Object {$_.file})
   $files=@(Get-ChildItem -LiteralPath $dir.FullName -Force)
   if(@($files|Where-Object {$_.PSIsContainer -or $_.Name -cnotin $known -or ($_.Attributes -band [IO.FileAttributes]::ReparsePoint)}).Count){continue}
   $lease=[IO.File]::Open((Join-Path $dir.FullName 'engine.lock'),'OpenOrCreate','ReadWrite','None')
   foreach($file in $files){if($file.Name -cne 'engine.lock'){Remove-Item -LiteralPath $file.FullName -Force}}
   $lease.Dispose();$lease=$null;Remove-Item -LiteralPath (Join-Path $dir.FullName 'engine.lock') -Force;[IO.Directory]::Delete($dir.FullName)
  }catch{# Unknown, altered or currently running cache is preserved.
  }finally{if($lease){$lease.Dispose()}}
 }
}
function Set-CLUProductPending($Plan,[bool]$Pending){
 $path=Join-Path $Plan.directory 'pending-installations.json';$items=@();if(Test-Path -LiteralPath $path){$items=@((Read-CLUJson $path).installations)}
 $items=@($items|Where-Object {$_ -cne $Plan.installation.folder});if($Pending){$items+=@($Plan.installation.folder)}
 Write-CLUJson $path ([pscustomobject]@{schemaVersion=1;installations=$items})
}
function Clear-CLUProductPayload($Plan){
 $path=Join-Path $Plan.directory 'pending-installations.json';if(Test-Path -LiteralPath $path){$pending=Read-CLUJson $path;if($pending.schemaVersion -ne 1 -or @($pending.installations).Count){return}}
 Assert-CLUPrivate $Plan.directory
 foreach($asset in $Plan.release.assets){
  # Keep the small pinned metadata and tools; free only verified, completed installers/archives.
  if($asset.name -cnotmatch '\.(?:exe|tar\.gz|zip)$'){continue}
  $entry=[pscustomobject]@{file=$asset.name;size=$asset.size;sha256=$asset.digest.Substring(7)};$file=Join-Path $Plan.directory $asset.name
  if(Test-Path -LiteralPath $file){$null=Assert-CLUFile $Plan.directory $entry;Remove-Item -LiteralPath $file -Force}
 }
}
function Get-CLUPreferences([string]$Root,[string]$ClientSettings=(Join-Path $env:APPDATA 'CastLink Client\updates.json')){
 $path=Join-Path $Root 'preferences.json';if(Test-Path -LiteralPath $path){$p=Read-CLUJson $path;if($p.schemaVersion -ne 1 -or $p.automatic -isnot [bool] -or $p.language -cnotin @('ru','en','zh-CN')){throw 'Updater preferences are invalid'};return $p}
 $automatic=$true;if(Test-Path -LiteralPath $ClientSettings){$c=Read-CLUJson $ClientSettings;if($c.automatic -is [bool]){$automatic=$c.automatic}};return [pscustomobject]@{schemaVersion=1;automatic=$automatic;language='ru'}
}
function Set-CLUPreferences([string]$Root,[bool]$Automatic,[string]$Language){if($Language -cnotin @('ru','en','zh-CN')){throw 'Unsupported language'};Write-CLUJson (Join-Path $Root 'preferences.json') ([pscustomobject]@{schemaVersion=1;automatic=$Automatic;language=$Language})}
function Read-CLUWslInstallation([string]$Root){
 $selected=Assert-CLUPath $Root;$actual=$selected;$p=$null;$pointer=Join-Path $selected 'active-generation.json'
 if(Test-Path -LiteralPath $pointer){$p=Read-CLUJson $pointer;if($p.schemaVersion -ne 1 -or $p.selectedRoot -cne $selected -or $p.installationId -cnotmatch '^[a-f0-9]{32}$'){throw 'WSL active generation identity mismatch'};$actual=Assert-CLUPath $p.activeRoot}
 $s=Read-CLUJson (Join-Path $actual 'installation.json');if($s.schemaVersion -ne 1 -or $s.installationId -cnotmatch '^[a-f0-9]{32}$' -or $s.distroName -cne ('CastLink-Server-'+$s.installationId.Substring(0,12)) -or $s.rootPath -cne $actual -or $s.repository -cne 'resokol/castlink' -or $s.rootfsSha256 -cnotmatch '^[a-f0-9]{64}$' -or $s.phase -cnotin @('ready','imported','maintenance') -or ($p -and $p.installationId -cne $s.installationId)){throw 'WSL ownership receipt identity mismatch'}
 $match=[regex]::Match($s.releaseTag,'^server-wsl-v(.+)-[a-f0-9]{12}$');if(-not $match.Success){throw 'WSL release identity mismatch'};$null=Compare-CLUVersion $match.Groups[1].Value $match.Groups[1].Value;$origin=''
 if($s.nativePanel -and $s.nativePanel.bindingPath -and (Get-CLUHash $s.nativePanel.bindingPath) -ceq $s.nativePanel.bindingSha256){$origin=(Read-CLUJson $s.nativePanel.bindingPath).origin}
 return [pscustomobject]@{channel='server-wsl';identity=$s.installationId;logicalId=$(if($s.logicalInstallationId){$s.logicalInstallationId}else{$s.installationId});availability='available';folder=$selected;activeRoot=$actual;version=$match.Groups[1].Value;releaseTag=$s.releaseTag;domain=$origin;phase=$s.phase;receipt=$s;label=('WSL '+$origin+' | '+$selected+' | '+$match.Groups[1].Value)}
}
function Read-CLUClientBuild([string]$Folder){
 $folder=Assert-CLUPath $Folder;$exe=Join-Path $folder 'CastLink Client.exe';if(-not (Test-Path -LiteralPath $exe -PathType Leaf)){throw 'Installed Client executable is absent'};$archive=Assert-CLUPath (Join-Path $folder 'resources\app.asar');$stream=[IO.File]::OpenRead($archive)
 try{$reader=[IO.BinaryReader]::new($stream);$null=$reader.ReadUInt32();$size=$reader.ReadUInt32();if($size -lt 8 -or $size -gt 16777216){throw 'Client ASAR header bound'};$raw=$reader.ReadBytes($size);if($raw.Length -ne $size){throw 'Client ASAR truncated'};$length=[BitConverter]::ToUInt32($raw,4);if($length -gt $size-8){throw 'Client ASAR metadata bound'};$header=[Text.Encoding]::UTF8.GetString($raw,8,$length)|ConvertFrom-Json;$e=$header.files.'build-info.json';if(-not $e -or $e.link -or $e.unpacked -or $e.size -le 0 -or $e.size -gt 65536 -or [string]$e.offset -cnotmatch '^[0-9]+$'){throw 'Client build metadata is unavailable'};$offset=8L+$size+[long]$e.offset;if($offset+$e.size -gt $stream.Length){throw 'Client build metadata is truncated'};$stream.Position=$offset;$bytes=$reader.ReadBytes($e.size);$build=[Text.Encoding]::UTF8.GetString($bytes)|ConvertFrom-Json}finally{$stream.Dispose()}
 if($build.track -cne 'client' -or $build.sourceCommit -cnotmatch '^[a-f0-9]{40}$'){throw 'Installed package is not a supported Client'};$null=Compare-CLUVersion $build.version $build.version
 return [pscustomobject]@{channel='client';identity=$folder;folder=$folder;version=$build.version;sourceCommit=$build.sourceCommit;executable=$exe;label=('Client | '+$folder+' | '+$build.version)}
}
function Get-CLUClientFolders{
 $folders=@((Join-Path $env:LOCALAPPDATA 'Programs\CastLink Client'))
 foreach($hive in @('HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall','HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall')){if(Test-Path $hive){foreach($key in Get-ChildItem $hive){$p=Get-ItemProperty $key.PSPath;if($p.DisplayName -ceq 'CastLink Client'){if($p.InstallLocation){$folders+=@($p.InstallLocation)}elseif($p.DisplayIcon -match '^"?(.+?\.exe)"?(?:,\d+)?$'){$folders+=@(Split-Path $Matches[1] -Parent)}}}}};return @($folders|Select-Object -Unique)
}
function Get-CLULocationRecords{
 $directory=Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry';$path=Join-Path $directory 'installations.json'
 if(-not (Test-Path -LiteralPath $directory)){return @()};Assert-CLUPrivate $directory
 if(-not (Test-Path -LiteralPath $path)){return @()};Assert-CLUPrivate $path;$value=Read-CLUJson $path
 if($value.schemaVersion -ne 1 -or $value.owner -cne 'castlink-wsl-location-v1' -or $value.userSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $null -eq $value.installations -or $value.installations -isnot [array]){throw 'Invalid installation location registry identity'}
 $ids=@{};$roots=@{};$physical=@{};$installationIds=@{};$rows=@()
 foreach($row in $value.installations){
  if($row.logicalId -cnotmatch '^[a-f0-9]{32}$' -or $row.installationId -cnotmatch '^[a-f0-9]{32}$'){throw 'Invalid installation location registry identity'}
  foreach($field in @('selectedRoot','activeRoot')){$path=Assert-CLUPath $row.$field;if($path -cne $row.$field -or $path -eq [IO.Path]::GetPathRoot($path)){throw 'Invalid installation location registry path'}}
  if($installationIds.ContainsKey($row.installationId) -or $ids.ContainsKey($row.logicalId) -or $roots.ContainsKey($row.selectedRoot) -or $physical.ContainsKey($row.activeRoot)){throw 'Conflicting or duplicate installation location registry identity'}
  $installationIds[$row.installationId]=$true;$ids[$row.logicalId]=$true;$roots[$row.selectedRoot]=$true;$physical[$row.activeRoot]=$true;$rows+=@($row)
 };return $rows
}
function Read-CLURegisteredInstallation($Record){
 $selected=$Record.selectedRoot;$active=$Record.activeRoot;$selectedPresent=Test-Path -LiteralPath $selected;$activePresent=Test-Path -LiteralPath $active
 if($selectedPresent){
  Assert-CLUPrivate $selected;$pointer=[IO.Path]::Combine($selected,'active-generation.json')
  if(Test-Path -LiteralPath $pointer){Assert-CLUPrivate $pointer;$p=Read-CLUJson $pointer;if($p.schemaVersion -ne 1 -or $p.selectedRoot -cne $selected -or $p.activeRoot -cne $active -or $p.installationId -cne $Record.installationId){throw 'Registry and active generation identity conflict'}}
  elseif($active -cne $selected){throw 'Registry active root mismatch: logical pointer is absent'}
 }
 if(-not $selectedPresent -or -not $activePresent){return [pscustomobject]@{channel='server-wsl';identity=$Record.installationId;logicalId=$Record.logicalId;folder=$selected;activeRoot=$active;availability='unavailable';version='';receipt=$null;label=('WSL | '+$selected)}}
 Assert-CLUPrivate $active;Assert-CLUPrivate ([IO.Path]::Combine($active,'installation.json'));$row=Read-CLUWslInstallation $selected
 if($row.activeRoot -cne $active -or $row.identity -cne $Record.installationId -or $row.logicalId -cne $Record.logicalId){throw 'Registry and ownership receipt identity conflict'};return $row
}
function Resolve-CLUCompletedRelocation([string]$Root,$Records,[string[]]$Visited=@(),[string]$ExpectedLogicalId=''){
 $Root=Assert-CLUPath $Root;if($Visited.Count -ge 32 -or $Root -iin $Visited){throw 'Completed relocation chain has a cycle or exceeds its bound'}
 $marker=Join-Path $Root 'relocated-to.json';if(-not (Test-Path -LiteralPath $marker)){return $null}
 Assert-CLUPrivate $Root;Assert-CLUPrivate $marker;$m=Read-CLUJson $marker
 if($m.schemaVersion -ne 1 -or $m.logicalId -cnotmatch '^[a-f0-9]{32}$' -or $m.transactionId -cnotmatch '^[a-f0-9]{32}$' -or ($ExpectedLogicalId -and $m.logicalId -cne $ExpectedLogicalId) -or (Assert-CLUPath $m.destinationRoot) -cne $m.destinationRoot){throw 'Completed relocation identity is invalid'}
 $matches=@($Records|Where-Object {$_.logicalId -ceq $m.logicalId})
 if($matches.Count -ne 1){throw 'Completed relocation has no unique registered destination'}
 $operation=Join-Path $env:LOCALAPPDATA ('CastLinkServerRegistry\operations\'+$m.transactionId);$journal=Join-Path $operation 'journal.json';$pointer=Join-Path $Root 'maintenance-transaction.json'
 foreach($path in @($operation,$journal,$pointer)){Assert-CLUPrivate $path};$p=Read-CLUJson $pointer;$j=Read-CLUJson $journal
 if($p.schemaVersion -ne 1 -or $p.kind -cne 'move' -or $p.id -cne $m.transactionId -or $p.selectedRoot -cne $Root -or $p.journal -cne $journal -or $p.journalSelectedRoot -cne $j.selectedRoot -or $j.schemaVersion -ne 1 -or $j.id -cne $m.transactionId -or $j.kind -cne 'move' -or $j.phase -cne 'completed' -or $j.logicalId -cne $m.logicalId -or $j.destinationRoot -cne $m.destinationRoot -or $Root -cnotin @($j.selectedRoot,$j.sourceRoot)){throw 'Completed relocation journal identity mismatch'}
 if($matches[0].selectedRoot -cne $m.destinationRoot){$resolved=Resolve-CLUCompletedRelocation $m.destinationRoot $Records @($Visited+$Root) $m.logicalId;if(-not $resolved -or $resolved -cne $matches[0].selectedRoot){throw 'Completed relocation chain has no verified registered destination'};return $resolved}
 $null=Read-CLURegisteredInstallation $matches[0];return $matches[0].selectedRoot
}
function Resolve-CLUSelectedRoot([string]$Root){
 $root=Assert-CLUPath $Root
 $records=@(Get-CLULocationRecords);$relocated=Resolve-CLUCompletedRelocation $root $records;if($relocated){return $relocated};$registered=@($records|Where-Object {$_.selectedRoot -ieq $root -or $_.activeRoot -ieq $root});if($registered.Count -gt 1){throw 'Ambiguous registered installation root'};if($registered.Count -eq 1){$null=Read-CLURegisteredInstallation $registered[0];return $registered[0].selectedRoot}
 if((Split-Path (Split-Path $root -Parent) -Leaf) -cne 'lifecycle-generations'){return $root}
 $storage=Split-Path (Split-Path $root -Parent) -Parent;$queue=[Collections.Generic.Queue[string]]::new();$queue.Enqueue($storage);$matches=@();$count=0
 while($queue.Count){
  $dir=$queue.Dequeue();$count++;if($count -gt 4096){throw 'Too many directories to resolve a unique logical installation root'}
  $pointer=Join-Path $dir 'active-generation.json'
  if(Test-Path -LiteralPath $pointer){$v=Read-CLUJson $pointer;if($v.activeRoot -ceq $root){$row=Read-CLUWslInstallation $dir;if($row.activeRoot -ceq $root){$matches+=@($dir)}}}
  foreach($child in Get-ChildItem -LiteralPath $dir -Directory -Force){if($child.Name -in @('distribution','release','native-panel','lifecycle-transactions','lifecycle-cache','lifecycle-packages','lifecycle-generations') -or ($child.Attributes -band [IO.FileAttributes]::ReparsePoint)){continue};$queue.Enqueue($child.FullName)}
 }
 if($matches.Count -ne 1){throw 'Physical generation has no unique logical installation root; ambiguous or moved installation'}
 return $matches[0]
}
function Get-CLUInstallations([string]$SelectedRoot){
 $rows=@();$records=@(Get-CLULocationRecords);$seen=@{};$physical=@{}
 if($SelectedRoot){$resolved=Resolve-CLUSelectedRoot $SelectedRoot;$registered=@($records|Where-Object {$_.selectedRoot -ieq $resolved});if($registered.Count -eq 1){return @(Read-CLURegisteredInstallation $registered[0])};return @(Read-CLUWslInstallation $resolved)}
 foreach($folder in Get-CLUClientFolders){try{$rows+=@(Read-CLUClientBuild $folder)}catch{}}
 foreach($record in $records){$row=Read-CLURegisteredInstallation $record;$rows+=@($row);$seen[$row.logicalId]=$row;$physical[$row.identity]=$row}
 $base=Join-Path $env:LOCALAPPDATA 'CastLinkServer';if(Test-Path -LiteralPath $base){$queue=[Collections.Generic.Queue[string]]::new();$queue.Enqueue((Assert-CLUPath $base));$count=0
  while($queue.Count){$dir=$queue.Dequeue();$count++;if($count -gt 4096){throw 'Too many local server directories; choose an explicit installation'}
   $relocated=Resolve-CLUCompletedRelocation $dir $records
   if(-not $relocated -and ((Test-Path -LiteralPath (Join-Path $dir 'installation.json')) -or (Test-Path -LiteralPath (Join-Path $dir 'active-generation.json')))){
    $row=$null;try{$row=Read-CLUWslInstallation $dir}catch{}
    if($row){$previous=$seen[$row.logicalId];if(-not $previous){$previous=$physical[$row.identity]};if($previous){if($previous.folder -ine $row.folder -or $previous.activeRoot -ine $row.activeRoot){throw 'Ambiguous or conflicting installation identity; copied locations cannot be adopted'}}else{$rows+=@($row);$seen[$row.logicalId]=$row;$physical[$row.identity]=$row}}
   }
   foreach($d in Get-ChildItem -LiteralPath $dir -Directory -Force){if($d.Name -in @('distribution','release','native-panel','lifecycle-transactions','lifecycle-cache','lifecycle-packages','lifecycle-generations') -or ($d.Attributes -band [IO.FileAttributes]::ReparsePoint)){continue};$queue.Enqueue($d.FullName)}
  }
 };return $rows
}
function Get-CLUMovePlan($Installation,[string]$Language='ru'){
 if($Installation.channel -cne 'server-wsl'){throw 'Move is available only for WSL servers'}
 if($Installation.availability -ceq 'unavailable'){throw (Get-CLUText unavailable $Language)}
 $fresh=@(Get-CLUInstallations $Installation.folder)[0];if($fresh.identity -cne $Installation.identity -or $fresh.activeRoot -cne $Installation.activeRoot -or $fresh.releaseTag -cne $Installation.releaseTag){throw 'Installation changed; refresh before opening maintenance'}
 $s=$fresh.receipt;if($s.locationContract -cne 'castlink-wsl-location-v1'){throw (Get-CLUText moveUpgrade $Language)}
 foreach($path in @($fresh.folder,$fresh.activeRoot,(Join-Path $fresh.activeRoot 'installation.json'))){Assert-CLUPrivate $path}
 if($s.nativePanel){
  $panel=$s.nativePanel;$panelRoot=Join-Path $fresh.activeRoot 'native-panel'
  if($panel.schemaVersion -ne 1 -or $panel.bindingPath -cne (Join-Path $panelRoot 'server-native-binding.json') -or $panel.hostPath -cne (Join-Path $panelRoot 'CastLinkServer.exe')){throw 'Installed panel binding path mismatch'}
  Assert-CLUPrivate $panelRoot
  foreach($pair in @(@($panel.bindingPath,$panel.bindingSha256),@($panel.hostPath,$panel.hostSha256))){Assert-CLUPrivate $pair[0];if($pair[1] -cnotmatch '^[a-f0-9]{64}$' -or (Get-CLUHash $pair[0]) -cne $pair[1]){throw 'Installed panel binding checksum mismatch'}}
  $binding=Read-CLUJson $panel.bindingPath
  if($binding.installRoot -cne $fresh.activeRoot -or $binding.installationId -cne $s.installationId -or $binding.expectedBuildId -cne ($s.releaseTag -creplace '^server-wsl-v','')){throw 'Installed panel binding identity mismatch'}
 }
 $dir=Join-Path $fresh.activeRoot 'release';Assert-CLUPrivate $dir;$manifestPath=Join-Path $dir 'manifest.json';Assert-CLUPrivate $manifestPath
 $pin=if($s.releaseManifestSha256){$s.releaseManifestSha256}elseif($s.nativePanel){$s.nativePanel.manifestSha256}else{''}
 if($pin -cnotmatch '^[a-f0-9]{64}$' -or (Get-CLUHash $manifestPath) -cne $pin){throw 'Installed manifest checksum mismatch'}
 $m=Read-CLUJson $manifestPath
 if($m.schemaVersion -ne 1 -or $m.repository -cne 'resokol/castlink' -or $m.channel -cne 'server-wsl' -or $m.architecture -cne 'amd64' -or $m.releaseTag -cne $s.releaseTag -or $m.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $m.releaseTag -cne ('server-wsl-v'+$m.version+'-'+$m.sourceCommit.Substring(0,12)) -or $m.rootfs.sha256 -cne $s.rootfsSha256 -or $m.lifecycle.schemaVersion -ne 1 -or $m.lifecycle.runtimeContract -cne 'castlink-wsl-pg16-v1'){throw 'Installed manifest identity mismatch'}
 if($m.lifecycle.locationContract -cne 'castlink-wsl-location-v1'){throw (Get-CLUText moveUpgrade $Language)}
 $seen=@{};foreach($e in @($m.lifecycle.helpers)+@($m.nativePanel.files)){if(-not $e){continue};Assert-CLUName $e.file;if($seen.ContainsKey($e.file)){if($seen[$e.file] -cne ($e.sha256+':'+$e.size)){throw 'Conflicting installed helper inventory'};continue};$seen[$e.file]=$e.sha256+':'+$e.size;$file=Assert-CLUFile $dir $e;Assert-CLUPrivate $file}
 foreach($name in @('server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-location.ps1','server-wsl-maintenance.py','server-wsl-runtime.py','install-server-windows.template.ps1')){if($name -cnotin @($m.lifecycle.helpers|ForEach-Object {$_.file})){throw 'Installed lifecycle helper inventory is incomplete'}}
 $entry=Join-Path $dir 'server-wsl-maintenance-ui.ps1'
 return [pscustomobject]@{entry=$entry;selectedRoot=$fresh.folder;logicalId=$fresh.logicalId;manifestPin=$pin;arguments=@('-NoLogo','-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',$entry,'-InstallRoot',$fresh.folder,'-Lang',$Language,'-InitialAction','Move')}
}
function Start-CLULifecycleUi($Plan){$arguments=$Plan.arguments;& (Join-Path $PSHOME 'powershell.exe') @arguments;if($LASTEXITCODE -ne 0){throw 'Installed maintenance UI failed'}}
function Open-CLUMoveUi($Installation,[string]$Language){$plan=Get-CLUMovePlan $Installation $Language;Start-CLULifecycleUi $plan}
function Test-CLUWslCompatibility($Manifest,$Installation){if($Installation.releaseTag -cnotin @($Manifest.lifecycle.supportedSources)){throw 'This release does not support a direct upgrade from the installed WSL version'};return $true}
function Get-CLUProductDirectory($Installation,[string]$Root,$Release){
 Assert-CLUName $Release.tag_name;if($Release.id -le 0){throw 'Invalid product release identity'};$name=$Release.tag_name+'-'+$Release.id
 if($Installation.channel -ceq 'client'){$directory=Join-Path (Join-Path $Root 'products') $name;Protect-CLUDirectory $directory;return $directory}
 if($Installation.channel -cne 'server-wsl' -or $Installation.availability -ceq 'unavailable'){throw 'An available WSL installation is required for its package cache'}
 $fresh=@(Get-CLUInstallations $Installation.folder)[0]
 if($fresh.identity -cne $Installation.identity -or $fresh.releaseTag -cne $Installation.releaseTag -or $fresh.activeRoot -cne $Installation.activeRoot){throw 'Installation changed before selecting its package cache'}
 foreach($path in @($fresh.folder,$fresh.activeRoot,(Join-Path $fresh.activeRoot 'installation.json'))){Assert-CLUPrivate $path}
 $lease=Enter-CLULock $Root ('product-location:'+ $fresh.logicalId)
 try{
  $cache=Join-Path $fresh.folder 'lifecycle-updater';$directory=Join-Path $cache $name
  foreach($path in @($cache,$directory)){
   $marker=Join-Path $path 'package-owner.json';$record=[pscustomobject]@{schemaVersion=1;owner='castlink-updater-products-v1';logicalId=$fresh.logicalId;selectedRoot=$fresh.folder;releaseTag=$(if($path -ceq $directory){$Release.tag_name}else{''});releaseId=$(if($path -ceq $directory){$Release.id}else{0})}
   if(Test-Path -LiteralPath $path){
    Assert-CLUPrivate $path;if(-not (Test-Path -LiteralPath $marker -PathType Leaf)){throw 'Package cache ownership collision; existing files were preserved'};Assert-CLUPrivate $marker;$old=Read-CLUJson $marker
    foreach($field in @('schemaVersion','owner','logicalId','selectedRoot','releaseTag','releaseId')){if($old.$field -cne $record.$field){throw 'Package cache ownership identity mismatch'}}
   }else{Protect-CLUDirectory $path;Write-CLUJson $marker $record}
  };return $directory
 }finally{$lease.Dispose()}
}
function Get-CLUProductPlan($Installation,[object[]]$Releases,[string]$Root,[switch]$Recovery){
 if($Installation.availability -ceq 'unavailable'){throw 'Installation disk is unavailable; reconnect it and refresh'}
 $selected=Select-CLURelease $Releases $Installation.channel $(if($Recovery){''}else{$Installation.version});if(-not $selected){return $null};$r=Get-CLURelease ([long]$selected.id);if($r.id -ne $selected.id -or $r.tag_name -cne $selected.tag_name -or $r.draft -ne $false -or $r.prerelease -ne $false){throw 'Product release changed during selection'}
 $match=[regex]::Match($r.tag_name,('^'+$Installation.channel+'-v([0-9]+\.[0-9]+\.[0-9]+)-([a-f0-9]{12})$'));if(-not $match.Success){throw 'Invalid stable product tag'};$v=$match.Groups[1].Value;$dir=Get-CLUProductDirectory $Installation $Root $r
 $plan=[pscustomobject]@{installation=$Installation;release=$r;version=$v;directory=$dir;manifest=$null;manifestPin='';installer=$null;notes=[string]$r.body}
 if($Installation.channel -ceq 'client'){$name='CastLink-Client-'+$v+'-'+$match.Groups[2].Value+'-setup.exe';$plan.installer=Get-CLUAsset $r $name 2147483648L;$null=Get-CLUAsset $r 'SHA256SUMS' 1048576;return $plan}
 $ma=Get-CLUAsset $r 'manifest.json' 1048576;$manifestFile=Receive-CLUAsset $dir $r 'manifest.json' 1048576;$m=Read-CLUJson $manifestFile;$plan.manifest=$m;$plan.manifestPin=$ma.digest.Substring(7)
 if($m.schemaVersion -ne 1 -or $m.channel -cne 'server-wsl' -or $m.repository -cne 'resokol/castlink' -or $m.architecture -cne 'amd64' -or $m.version -cne $v -or $m.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $m.releaseTag -cne $r.tag_name -or $m.releaseTag -cne ('server-wsl-v'+$m.version+'-'+$m.sourceCommit.Substring(0,12)) -or $m.lifecycle.schemaVersion -ne 1 -or $m.lifecycle.runtimeContract -cne 'castlink-wsl-pg16-v1' -or $m.lifecycle.postgresMajor -ne 16){throw 'Unsupported WSL target identity, architecture or lifecycle'}
 if(-not $Recovery){$null=Test-CLUWslCompatibility $m $Installation}
 $seen=@{};foreach($e in @($m.rootfs,$m.sources,$m.upstreamSources,$m.inventory)+@($m.nativePanel.files)+@($m.lifecycle.helpers)){Assert-CLUName $e.file;if($seen.ContainsKey($e.file)){if($seen[$e.file] -cne ($e.sha256+':'+$e.size)){throw 'Conflicting WSL file inventory'};continue};$seen[$e.file]=$e.sha256+':'+$e.size;$asset=Get-CLUAsset $r $e.file 68719476736L;if($e.sha256 -cne $asset.digest.Substring(7) -or $e.size -ne $asset.size){throw 'WSL manifest asset metadata mismatch'}}
 foreach($name in @('server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-maintenance.py','server-wsl-runtime.py','install-server-windows.template.ps1')){if($name -cnotin @($m.lifecycle.helpers|ForEach-Object {$_.file})){throw 'WSL maintenance helper inventory is incomplete'}};return $plan
}
function Get-CLURecoveryPlan($Installation,[string]$Language='ru'){
 if($Installation.channel -cne 'server-wsl'){throw 'Recovery requires a WSL installation'}
 $root=Assert-CLUPath $Installation.folder;$pointer=Read-CLUJson (Join-Path $root 'maintenance-transaction.json');$journalPath=Assert-CLUPath $pointer.journal;$journal=Read-CLUJson $journalPath
 if($pointer.kind -ceq 'move' -or $journal.kind -ceq 'move'){
  if($Language -cnotin @('ru','en','zh-CN')){$Language='ru'}
  if($pointer.id -cnotmatch '^[a-f0-9]{32}$'){throw 'Move recovery journal identity mismatch'}
  $operation=Join-Path $env:LOCALAPPDATA ('CastLinkServerRegistry\operations\'+$pointer.id);$expected=Join-Path $operation 'journal.json'
  foreach($path in @((Join-Path $env:LOCALAPPDATA 'CastLinkServerRegistry'),$operation,$root,(Join-Path $root 'maintenance-transaction.json'),$journalPath)){Assert-CLUPrivate $path}
  if($pointer.schemaVersion -ne 1 -or $pointer.kind -cne 'move' -or $pointer.selectedRoot -cne $root -or $journalPath -cne $expected -or $journal.schemaVersion -ne 1 -or $journal.kind -cne 'move' -or $journal.id -cne $pointer.id -or $journal.journal -cne $expected -or $journal.selectedRoot -cne $pointer.journalSelectedRoot -or $root -cnotin @($journal.selectedRoot,$journal.sourceRoot,$journal.destinationRoot) -or $journal.logicalId -cne $Installation.logicalId -or $journal.source.installationId -cne $Installation.identity -or $journal.source.releaseTag -cne $Installation.releaseTag -or $journal.source.rootfsSha256 -cne $Installation.receipt.rootfsSha256){throw 'Move recovery journal identity mismatch'}
  $ui=Get-CLUMovePlan $Installation $Language;$ui.arguments=@($ui.arguments[0..($ui.arguments.Count-3)]) # Pending selected-root UI enables Recover without requesting a new Move.
  return [pscustomobject]@{kind='move';installation=$Installation;version=$Installation.version;directory=(Split-Path $ui.entry -Parent);manifestPin=$ui.manifestPin;lifecycleUi=$ui;language=$Language;journalSha256=(Get-CLUHash $journalPath);journalPath=$journalPath;notes=((Get-CLUText recover $Language)+' '+$journal.id)}
 }
 if($pointer.schemaVersion -ne 1 -or $pointer.selectedRoot -cne $root -or $journal.schemaVersion -ne 1 -or $journal.id -cne $pointer.id -or $journal.journal -cne $journalPath -or $journal.selectedRoot -cne $root -or $journal.kind -cne 'update'){throw 'Use original maintenance for this transaction type; update journal identity is required'}
 $dir=Assert-CLUPath $journal.targetDirectory;Assert-CLUPrivate $dir;$manifestPath=Join-Path $dir 'manifest.json'
 if($journal.manifestSha256 -cnotmatch '^[a-f0-9]{64}$' -or (Get-CLUHash $manifestPath) -cne $journal.manifestSha256){throw 'Recorded recovery manifest checksum mismatch'}
 $m=Read-CLUJson $manifestPath
 if($m.schemaVersion -ne 1 -or $m.channel -cne 'server-wsl' -or $m.repository -cne 'resokol/castlink' -or $m.releaseTag -cne $journal.target.releaseTag -or $m.sourceCommit -cnotmatch '^[a-f0-9]{40}$' -or $m.releaseTag -cne ('server-wsl-v'+$m.version+'-'+$m.sourceCommit.Substring(0,12)) -or $m.lifecycle.schemaVersion -ne 1 -or $m.lifecycle.runtimeContract -cne 'castlink-wsl-pg16-v1'){throw 'Recorded recovery target identity mismatch'}
 $helpers=@($m.lifecycle.helpers|Where-Object {$_.file -ceq 'server-wsl-maintenance.ps1'});if($helpers.Count -ne 1){throw 'Recorded recovery helper is missing or duplicated'}
 $helper=Assert-CLUFile $dir $helpers[0];Assert-CLUPrivate $helper
 $assets=@();$seen=@{};foreach($entry in @($m.rootfs,$m.sources,$m.upstreamSources,$m.inventory)+@($m.nativePanel.files)+@($m.lifecycle.helpers)){if(-not $entry){continue};Assert-CLUName $entry.file;if(-not $seen.ContainsKey($entry.file)){$seen[$entry.file]=$true;$assets+=@([pscustomobject]@{name=$entry.file;size=$entry.size;digest=('sha256:'+$entry.sha256)})}}
 return [pscustomobject]@{installation=$Installation;version=$m.version;directory=$dir;manifest=$m;manifestPin=$journal.manifestSha256;recoveryHelper=$helper;journalSha256=(Get-CLUHash $journalPath);journalPath=$journalPath;notes=('Recover recorded transaction '+$journal.id);release=[pscustomobject]@{assets=$assets}}
}
function Receive-CLUWslTools($Plan,[switch]$Complete){
 $entries=@($Plan.manifest.lifecycle.helpers)+@($Plan.manifest.nativePanel.files);if($Complete){$entries+=@($Plan.manifest.rootfs,$Plan.manifest.sources,$Plan.manifest.upstreamSources,$Plan.manifest.inventory)}
 foreach($e in $entries){$null=Receive-CLUAsset $Plan.directory $Plan.release $e.file 68719476736L;$null=Assert-CLUFile $Plan.directory $e};return Join-Path $Plan.directory 'server-wsl-maintenance.ps1'
}
function Apply-CLUProduct($Plan,[string]$Root,[switch]$Recovery){
 $installation=$Plan.installation;$lease=Enter-CLULock $Root ($installation.channel+':'+$installation.identity);$cacheLease=$null
 try{
  $cacheLease=Enter-CLULock $Root ('product-cache:'+ $Plan.directory)
  if($Recovery){$fresh=Get-CLURecoveryPlan $installation $Plan.language;if($fresh.journalSha256 -cne $Plan.journalSha256 -or $fresh.manifestPin -cne $Plan.manifestPin){throw 'Recovery journal changed after confirmation'};if($fresh.kind -ceq 'move'){Start-CLULifecycleUi $fresh.lifecycleUi;return};. $fresh.recoveryHelper -FunctionsOnly;$result=Invoke-CastlinkMaintenance -Action Recover -InstallRoot $installation.folder;if($result.phase -eq 'completed' -or ($result.phase -eq 'rolled-back' -and -not (Test-Path -LiteralPath $result.candidateRoot))){Set-CLUProductPending $fresh $false;Clear-CLUProductPayload $fresh};return}
  Set-CLUProductPending $Plan $true
  if($installation.channel -ceq 'client'){
   $now=Read-CLUClientBuild $installation.folder;if($now.sourceCommit -cne $installation.sourceCommit -or $now.version -cne $installation.version){throw 'Client identity changed; check updates again'}
   $sums=Receive-CLUAsset $Plan.directory $Plan.release 'SHA256SUMS' 1048576;$rows=@([IO.File]::ReadAllLines($sums)|Where-Object {$_ -cmatch ('^[a-f0-9]{64}  '+[regex]::Escape($Plan.installer.name)+'$')});if($rows.Count -ne 1 -or $rows[0].Substring(0,64) -cne $Plan.installer.digest.Substring(7)){throw 'Client installer SHA256SUMS mismatch'}
   $file=Receive-CLUAsset $Plan.directory $Plan.release $Plan.installer.name 2147483648L
   # The setup wizard owns shutdown/installation. Never terminate a live Client here.
   $process=Start-Process -FilePath $file -ArgumentList ('/D='+$installation.folder) -PassThru -Wait;if($process.ExitCode -ne 0){throw 'Client setup failed or was cancelled; existing installation was retained'};Set-CLUProductPending $Plan $false;Clear-CLUProductPayload $Plan;return
  }
  $now=Read-CLUWslInstallation $installation.folder;if($now.identity -cne $installation.identity -or $now.releaseTag -cne $installation.releaseTag){throw 'WSL identity changed; check updates again'}
  $module=Receive-CLUWslTools $Plan -Complete;. $module -FunctionsOnly
  $null=Invoke-CastlinkMaintenance -Action Check -InstallRoot $installation.folder -TargetDirectory $Plan.directory -ExpectedManifestSha256 $Plan.manifestPin;Invoke-CastlinkMaintenance -Action Update -InstallRoot $installation.folder -TargetDirectory $Plan.directory -ExpectedManifestSha256 $Plan.manifestPin -Confirmation $installation.receipt.distroName|Out-Null
  Set-CLUProductPending $Plan $false;Clear-CLUProductPayload $Plan
 }finally{if($cacheLease){$cacheLease.Dispose()};$lease.Dispose()}
}
function Invoke-CLUConfirmedUpdate($Plan,[string]$Root,[bool]$Confirmed,[switch]$Recovery){if(-not $Confirmed){return};if(-not $Plan){throw 'Check this exact installation before applying an update'};Apply-CLUProduct $Plan $Root -Recovery:$Recovery}
function Get-CLUText([string]$Key,[string]$Language){
 $t=@{move=@('Перенести сервер…','Move server…','移动服务器…');refresh=@('Обновить список','Refresh','刷新');unavailable=@('Папка установки недоступна. Подключите диск и обновите список.','Installation folder unavailable. Reconnect the disk and refresh.','安装文件夹不可用。请重新连接磁盘并刷新。');moveUpgrade=@('Сначала явно обновите сервер до выпуска с поддержкой переноса, затем выберите «Перенести сервер…».','First explicitly update this server to a release supporting relocation, then choose Move server.','请先明确将此服务器更新到支持迁移的版本，然后选择移动服务器。');title=@('Обновить CastLink','Update CastLink','更新 CastLink');select=@('Выберите локальную установку','Select a local installation','选择本机安装');check=@('Проверить','Check','检查');update=@('Обновить…','Update…','更新…');recover=@('Восстановить операцию…','Recover transaction…','恢复事务…');automatic=@('Проверять при запуске','Check at startup','启动时检查');latest=@('Обновлений нет','No updates available','没有可用更新');available=@('Доступна версия','Available version','可用版本');busy=@('Выполняется проверка или загрузка…','Checking or downloading…','正在检查或下载…');done=@('Операция завершена','Operation completed','操作已完成');confirm=@('Обновить выбранную установку? Работа сервера прервётся. Установщик Client может закрыть приложение.','Update this installation? Server service will be interrupted. Client setup may close the app.','更新此安装？服务器服务将中断。客户端安装程序可能关闭应用。');failure=@('Ошибка проверки или обновления. Установленные данные сохранены. Повторите проверку; для прерванной WSL-операции используйте восстановление.','Check or update failed. Existing data was retained. Retry Check; use Recover for an interrupted WSL transaction.','检查或更新失败。现有数据已保留。请重试检查；WSL 事务中断时请使用恢复。');none=@('Установки не найдены. Для WSL откройте обновлятор из панели сервера или укажите -InstallRoot.','No installations found. For WSL, open from its server panel or pass -InstallRoot.','未找到安装。对于 WSL，请从服务器面板打开或指定 -InstallRoot。');legacy=@('Legacy Docker обслуживается прежним инструментом; автоматический переход на WSL не выполняется.','Legacy Docker uses its original maintenance tool; automatic WSL migration is unavailable.','旧版 Docker 请使用原维护工具；不提供自动迁移到 WSL。')};$i=if($Language -ceq 'en'){1}elseif($Language -ceq 'zh-CN'){2}else{0};if(-not $t.ContainsKey($Key)){return $Key};return $t[$Key][$i]
}
function Invoke-CLUUiWork([ValidateSet('Check','Overview','RecoveryPlan','Apply','Recover','Move')][string]$Operation,$Rows,[string]$Root,$Plan){
 # Keep WPF responsive while network, setup or the established WSL transaction owns its own runspace.
 $pipeline=[PowerShell]::Create();$source=$script:CLURequest.source
 $code='param($source,$operation,$rows,$root,$plan);$ErrorActionPreference="Stop";. $source -FunctionsOnly;switch($operation){Move{Open-CLUMoveUi $rows $plan};Check{Get-CLUProductPlan $rows @(Get-CLUReleases) $root};RecoveryPlan{Get-CLURecoveryPlan $rows $plan};Overview{$catalog=@(Get-CLUReleases);foreach($row in $rows){[pscustomobject]@{installation=$row;plan=$(if($row.availability -cne "unavailable"){Get-CLUProductPlan $row $catalog $root}else{$null})}}};Apply{Apply-CLUProduct $plan $root};Recover{Apply-CLUProduct $plan $root -Recovery}}'
 $null=$pipeline.AddScript($code).AddArgument($source).AddArgument($Operation).AddArgument($Rows).AddArgument($Root).AddArgument($Plan)
 $handle=$pipeline.BeginInvoke();$frame=[Windows.Threading.DispatcherFrame]::new();$timer=[Windows.Threading.DispatcherTimer]::new();$timer.Interval=[TimeSpan]::FromMilliseconds(100);$timer.Add_Tick({if($handle.IsCompleted){$frame.Continue=$false}})
 try{$timer.Start();[Windows.Threading.Dispatcher]::PushFrame($frame);$result=@($pipeline.EndInvoke($handle));if($pipeline.HadErrors){throw [string]$pipeline.Streams.Error[0]};return $result}finally{$timer.Stop();$pipeline.Dispose()}
}
function Show-CLUWindow([string]$Root,[string]$SelectedRoot,[string]$Language){
 Add-Type -AssemblyName PresentationFramework
 [xml]$xml=@'
<Window xmlns="http://schemas.microsoft.com/winfx/2006/xaml/presentation" xmlns:x="http://schemas.microsoft.com/winfx/2006/xaml" Width="760" Height="650" MinWidth="620" MinHeight="500" WindowStartupLocation="CenterScreen" Background="#FAFAF9"><Grid Margin="24"><Grid.RowDefinitions><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="Auto"/><RowDefinition Height="*"/><RowDefinition Height="Auto"/></Grid.RowDefinitions><TextBlock x:Name="Heading" FontSize="27" FontWeight="SemiBold"/><ComboBox x:Name="Language" Grid.Row="1" HorizontalAlignment="Right" Width="150" Margin="0,12"><ComboBoxItem Content="Русский"/><ComboBoxItem Content="English"/><ComboBoxItem Content="简体中文"/></ComboBox><TextBlock x:Name="SelectLabel" Grid.Row="2"/><ComboBox x:Name="Products" Grid.Row="3" Margin="0,6,0,12" MinHeight="36"/><StackPanel Grid.Row="4"><CheckBox x:Name="Automatic" Margin="0,0,0,12"/><WrapPanel><Button x:Name="Check" MinWidth="100" Padding="12,8" Margin="0,0,8,8"/><Button x:Name="Update" MinWidth="100" Padding="12,8" Margin="0,0,8,8" IsEnabled="False"/><Button x:Name="Recover" MinWidth="100" Padding="12,8" Margin="0,0,8,8"/><Button x:Name="Move" MinWidth="100" Padding="12,8" Margin="0,0,8,8" IsEnabled="False"/><Button x:Name="Refresh" MinWidth="100" Padding="12,8" Margin="0,0,8,8"/></WrapPanel></StackPanel><TextBox x:Name="Result" Grid.Row="5" TextWrapping="Wrap" IsReadOnly="True" VerticalScrollBarVisibility="Auto" BorderThickness="0" Background="Transparent"/><TextBlock x:Name="Legacy" Grid.Row="6" TextWrapping="Wrap" Foreground="#666666" Margin="0,12,0,0"/></Grid></Window>
'@
 $window=[Windows.Markup.XamlReader]::Load([Xml.XmlNodeReader]::new($xml));$rows=@(Get-CLUInstallations $SelectedRoot);if($SelectedRoot -and $rows.Count -eq 1){$SelectedRoot=$rows[0].folder};$prefs=Get-CLUPreferences $Root;$state=@{rows=$rows;plan=$null;lang=$Language;busy=$false}
 $window.FindName('Automatic').IsChecked=$prefs.automatic;$window.FindName('Language').SelectedIndex=if($Language -ceq 'en'){1}elseif($Language -ceq 'zh-CN'){2}else{0}
 $render={foreach($pair in @(@('Heading','title'),@('SelectLabel','select'),@('Check','check'),@('Update','update'),@('Recover','recover'),@('Move','move'),@('Refresh','refresh'),@('Automatic','automatic'),@('Legacy','legacy'))){$control=$window.FindName($pair[0]);$text=Get-CLUText $pair[1] $state.lang;if($control -is [Windows.Controls.TextBlock]){$control.Text=$text}else{$control.Content=$text}};$window.Title=Get-CLUText title $state.lang};& $render
 foreach($row in $rows){$null=$window.FindName('Products').Items.Add(($row.label+$(if($row.availability -ceq 'unavailable'){' | '+(Get-CLUText unavailable $state.lang)}else{''})))};if($SelectedRoot -and $rows.Count -eq 1){$window.FindName('Products').SelectedIndex=0};if(-not $rows.Count){$window.FindName('Result').Text=Get-CLUText none $state.lang}
 $choose={ $index=$window.FindName('Products').SelectedIndex;if($index -lt 0 -or $index -ge $state.rows.Count){throw (Get-CLUText select $state.lang)};return $state.rows[$index] }
 $setBusy={param([bool]$Value)$state.busy=$Value;foreach($n in @('Check','Recover','Refresh','Products','Language')){$window.FindName($n).IsEnabled=-not $Value};$window.FindName('Update').IsEnabled=(-not $Value -and $null -ne $state.plan);$index=$window.FindName('Products').SelectedIndex;$window.FindName('Move').IsEnabled=(-not $Value -and $index -ge 0 -and $state.rows[$index].channel -ceq 'server-wsl' -and $state.rows[$index].availability -cne 'unavailable')}
 $refresh={param($Keep)
  $fresh=@(Get-CLUInstallations);$key=if($Keep.logicalId){$Keep.logicalId}else{$Keep.identity};$matches=@($fresh|Where-Object {$(if($_.logicalId){$_.logicalId}else{$_.identity}) -ceq $key -and $_.channel -ceq $Keep.channel})
  if($SelectedRoot){if($matches.Count -eq 1){$fresh=$matches}else{$fresh=@(Get-CLUInstallations $SelectedRoot)}}
  $state.plan=$null;$state.rows=$fresh;$window.FindName('Products').Items.Clear();$select=-1
  for($i=0;$i -lt $fresh.Count;$i++){$row=$fresh[$i];$null=$window.FindName('Products').Items.Add(($row.label+$(if($row.availability -ceq 'unavailable'){' | '+(Get-CLUText unavailable $state.lang)}else{''})));if($(if($row.logicalId){$row.logicalId}else{$row.identity}) -ceq $key -and $row.channel -ceq $Keep.channel){$select=$i}}
  $window.FindName('Products').SelectedIndex=$select
 }
 $check={try{& $setBusy $true;$state.plan=$null;$window.FindName('Result').Text=Get-CLUText busy $state.lang;$window.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::Render);$row=& $choose;$state.plan=Invoke-CLUUiWork Check $row $Root $null;if($state.plan){$window.FindName('Result').Text=$row.label+"`n"+(Get-CLUText available $state.lang)+': '+$state.plan.version+"`n`n"+$state.plan.notes}else{$window.FindName('Result').Text=Get-CLUText latest $state.lang}}catch{$window.FindName('Result').Text=(Get-CLUText failure $state.lang)+"`n"+$_.Exception.Message}finally{& $setBusy $false}}
 $window.FindName('Check').Add_Click($check)
 $window.FindName('Products').Add_SelectionChanged({$state.plan=$null;& $setBusy $state.busy})
 $window.FindName('Language').Add_SelectionChanged({$state.lang=@('ru','en','zh-CN')[$window.FindName('Language').SelectedIndex];& $render;Set-CLUPreferences $Root ([bool]$window.FindName('Automatic').IsChecked) $state.lang})
 $window.FindName('Automatic').Add_Click({Set-CLUPreferences $Root ([bool]$window.FindName('Automatic').IsChecked) $state.lang})
 $apply={param([bool]$Recovery)try{& $setBusy $true;$row=& $choose;$plan=$state.plan;if($Recovery){if($row.channel -cne 'server-wsl'){throw 'Recovery is available for WSL servers'};$plan=Invoke-CLUUiWork RecoveryPlan $row $Root $state.lang};if(-not $plan){throw 'Check this installation first'};if($Recovery -and $plan.kind -ceq 'move'){Invoke-CLUUiWork Recover $row $Root $plan|Out-Null;& $refresh $row;return};$prompt=(Get-CLUText confirm $state.lang)+"`n`n"+$row.label+"`n"+$plan.version+"`n`n"+$plan.notes;$confirmed=[Windows.MessageBox]::Show($window,$prompt,(Get-CLUText title $state.lang),'YesNo','Warning','No') -eq 'Yes';if(-not $confirmed){return};$window.FindName('Result').Text=Get-CLUText busy $state.lang;$window.Dispatcher.Invoke([Action]{},[Windows.Threading.DispatcherPriority]::Render);Invoke-CLUUiWork $(if($Recovery){'Recover'}else{'Apply'}) $row $Root $plan|Out-Null;& $refresh $row;$window.FindName('Result').Text=Get-CLUText done $state.lang}catch{$window.FindName('Result').Text=(Get-CLUText failure $state.lang)+"`n"+$_.Exception.Message}finally{& $setBusy $false}}
 $window.FindName('Update').Add_Click({& $apply $false});$window.FindName('Recover').Add_Click({& $apply $true})
 $window.FindName('Refresh').Add_Click({try{$keep=$null;if($window.FindName('Products').SelectedIndex -ge 0){$keep=& $choose};& $setBusy $true;& $refresh $keep}catch{$window.FindName('Result').Text=$_.Exception.Message}finally{& $setBusy $false}})
 $window.FindName('Move').Add_Click({try{& $setBusy $true;$row=& $choose;Invoke-CLUUiWork Move $row $Root $state.lang|Out-Null;& $refresh $row}catch{$window.FindName('Result').Text=(Get-CLUText failure $state.lang)+"`n"+$_.Exception.Message}finally{& $setBusy $false}})
 & $setBusy $false
 if($prefs.automatic -and $rows.Count){if($SelectedRoot -and $rows.Count -eq 1){$window.Add_ContentRendered({& $check})}else{$window.Add_ContentRendered({try{& $setBusy $true;$overview=@(Invoke-CLUUiWork Overview $rows $Root $null);$lines=@();foreach($item in $overview){$row=$item.installation;$target=$item.plan;$lines+=@($row.label+' — '+$(if($row.availability -ceq 'unavailable'){Get-CLUText unavailable $state.lang}elseif($target){(Get-CLUText available $state.lang)+': '+$target.version}else{Get-CLUText latest $state.lang}))};$window.FindName('Result').Text=$lines -join "`n`n"}catch{$window.FindName('Result').Text=(Get-CLUText failure $state.lang)+"`n"+$_.Exception.Message}finally{& $setBusy $false}})}}
 $window.Add_Closing({param($sender,$event);if($state.busy){$event.Cancel=$true}});$null=$window.ShowDialog()
}
function Register-CLUShortcut([string]$Root,[string]$Language){
 $bootstrap=Join-Path $Root 'castlink-updater.ps1';$shell=New-Object -ComObject WScript.Shell;$programs=[Environment]::GetFolderPath('Programs');$shortcut=$shell.CreateShortcut((Join-Path $programs 'Update CastLink.lnk'));$shortcut.TargetPath=Join-Path $PSHOME 'powershell.exe';$shortcut.Arguments='-NoLogo -NoProfile -STA -WindowStyle Hidden -ExecutionPolicy Bypass -File "'+$bootstrap+'"';$shortcut.WorkingDirectory=$Root;$shortcut.Description=Get-CLUText title $Language;$shortcut.Save()
}
function Install-CLUUpdater([string]$Source,[string]$Root,[string]$Language){
 $sid=[Security.Principal.WindowsIdentity]::GetCurrent().User.Value;$bootstrap=Join-Path $Root 'castlink-updater.ps1';$registration=Join-Path $Root 'registration.json';$intentPath=Join-Path $Root 'registration-intent.json';$sourceHash=Get-CLUHash $Source
 if(Test-Path -LiteralPath $Root){if(@(Get-ChildItem -LiteralPath $Root -Force).Count -and -not (Test-Path -LiteralPath $registration)){if(-not (Test-Path -LiteralPath $intentPath)){throw 'Updater directory already belongs to another installation'};Assert-CLUPrivate $Root;$intent=Read-CLUJson $intentPath;if($intent.schemaVersion -ne 1 -or $intent.ownerSid -cne $sid -or $intent.bootstrapSha256 -cne $sourceHash -or ((Test-Path -LiteralPath $bootstrap) -and (Get-CLUHash $bootstrap) -cne $sourceHash)){throw 'Interrupted updater registration ownership differs'}};if(Test-Path -LiteralPath $registration){Assert-CLUPrivate $Root;$old=Read-CLUJson $registration;if($old.schemaVersion -ne 1 -or $old.ownerSid -cne $sid -or $old.bootstrapSha256 -cne (Get-CLUHash $bootstrap)){throw 'Existing updater registration or bootstrap differs'}}}
 Protect-CLUDirectory $Root
 if(-not (Test-Path -LiteralPath $registration)){Write-CLUJson $intentPath ([pscustomobject]@{schemaVersion=1;ownerSid=$sid;bootstrapSha256=$sourceHash})}
 if(-not (Test-Path -LiteralPath $bootstrap)){[IO.File]::Copy((Assert-CLUPath $Source),$bootstrap,$false);Set-CLUCreatedFileOwner $bootstrap}
 Write-CLUJson $registration ([pscustomobject]@{schemaVersion=1;repository='resokol/castlink';ownerSid=$sid;bootstrapSha256=(Get-CLUHash $bootstrap)})
 Register-CLUShortcut $Root $Language
 if(-not (Test-Path -LiteralPath (Join-Path $Root 'preferences.json'))){$p=Get-CLUPreferences $Root;Set-CLUPreferences $Root $p.automatic $Language}
}
function Invoke-CLUMain($Request){
 $root=if($Request.root){Assert-CLUPath $Request.root}else{Join-Path $env:LOCALAPPDATA 'CastLinkUpdater'}
 if($Request.engine){Assert-CLUPrivate $root;$m=Assert-CLUCache $Request.tool;if((Assert-CLUPath $Request.source) -cne (Join-Path (Assert-CLUPath $Request.tool) 'castlink-updater.ps1')){throw 'Engine must run from its verified version directory'};if($Request.probe){return};$engineLease=Enter-CLUVersionLease $Request.tool;try{Show-CLUWindow $root $Request.selected $Request.language}finally{$engineLease.Dispose()};return}
 if($Request.install){Install-CLUUpdater $Request.source $root $Request.language;return}
 if(-not (Test-Path -LiteralPath (Join-Path $root 'registration.json'))){throw 'Run install-updater-windows.cmd once to register the permanent updater'}
 Assert-CLUPrivate $root;$registration=Read-CLUJson (Join-Path $root 'registration.json');if($registration.schemaVersion -ne 1 -or $registration.ownerSid -cne [Security.Principal.WindowsIdentity]::GetCurrent().User.Value -or $registration.bootstrapSha256 -cne (Get-CLUHash (Join-Path $root 'castlink-updater.ps1'))){throw 'Permanent updater registration mismatch'}
 $p=Get-CLUPreferences $root;$lang=$Request.language;if(-not $Request.languageExplicit){$lang=$p.language};$record=Update-CLUTool $root $Request.selected $lang
 try{Start-CLUEngine $record.directory $root $Request.selected $lang}catch{$active=Read-CLUJson (Join-Path $root 'active.json');if($active.current.directory -ceq $record.directory -and $active.previous){Write-CLUJson (Join-Path $root 'active.json') ([pscustomobject]@{schemaVersion=1;current=$active.previous;previous=$null})};throw}
}
if(-not $script:CLURequest.functionsOnly){$ErrorActionPreference='Stop';try{Add-Type -AssemblyName System.Numerics;Invoke-CLUMain $script:CLURequest}catch{Add-Type -AssemblyName PresentationFramework;[void][Windows.MessageBox]::Show(((Get-CLUText failure $script:CLURequest.language)+"`n"+$_.Exception.Message),(Get-CLUText title $script:CLURequest.language),'OK','Error');exit 1}}
