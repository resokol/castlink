$ErrorActionPreference='Stop'
try {
# This catalog only observes candidates. Native owns held identity and execution.
Import-Module ([IO.Path]::Combine([Environment]::SystemDirectory,'WindowsPowerShell\v1.0\Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1')) -ErrorAction Stop
$raw=[Console]::In.ReadToEnd();if([Text.Encoding]::UTF8.GetByteCount($raw) -gt 4096){throw 'input'}
$r=$raw|ConvertFrom-Json
$keys=($r.PSObject.Properties.Name|Sort-Object) -join ','
$preflight=$keys -ceq 'context,customConfig,host,preflight,profile'
if(($keys -cne 'context,customConfig,host,profile' -and !$preflight) -or ($preflight -and ($r.preflight -isnot [bool] -or !$r.preflight)) -or $r.customConfig -isnot [bool] -or $r.customConfig){throw 'selector'}
$endpoint='npipe:////./pipe/dockerDesktopLinuxEngine'
# Context names alone grant no endpoint; native holds original metadata, then
# immutable primary JS parses it strictly before native closed finalize.
if($r.context -isnot [string] -or $r.host -isnot [string]){throw 'selector'}
if($r.context -ceq 'desktop-linux'){$kind=2}
elseif($r.context -ceq '' -and $r.host -ceq $endpoint){$kind=0}
elseif($r.context -ceq '' -and $r.host -ceq ''){$kind=1}
else{throw 'selector'}
function ContextRecord([string]$path){
 $item=Get-Item -Force -LiteralPath $path;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'context file'}
 $f=[IO.File]::Open($path,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
 try{if($f.Length -lt 1 -or $f.Length -gt 65536){throw 'context size'};$sha=[Security.Cryptography.SHA256]::Create();try{$hash=$sha.ComputeHash($f)}finally{$sha.Dispose()};return @{bytes=[uint32]$f.Length;sha=$hash}}finally{$f.Dispose()}
}
if($kind){
 $profile=[Environment]::GetFolderPath('UserProfile');if(!$profile -or $r.profile -isnot [string] -or ($r.profile -ne '' -and $r.profile -ine $profile)){throw 'profile'}
 $sha=[Security.Cryptography.SHA256]::Create();try{$id=-join ($sha.ComputeHash([Text.Encoding]::UTF8.GetBytes('desktop-linux'))|ForEach-Object {$_.ToString('x2')})}finally{$sha.Dispose()}
 $meta=ContextRecord ([IO.Path]::Combine($profile,'.docker','contexts','meta',$id,'meta.json'))
 if($kind -eq 1){$cfg=ContextRecord ([IO.Path]::Combine($profile,'.docker','config.json'))}else{$cfg=@{bytes=[uint32]0;sha=(New-Object byte[] 32)}}
}
$found=@()
foreach($c in @(@{machine=$true;base=[Environment]::GetFolderPath('ProgramFiles');relative='Docker\Docker'},@{machine=$false;base=[Environment]::GetFolderPath('LocalApplicationData');relative='Programs\DockerDesktop'})){
 if(!$c.base){continue};$root=[IO.Path]::Combine($c.base,$c.relative);$desktop=[IO.Path]::Combine($root,'Docker Desktop.exe');$docker=[IO.Path]::Combine($root,'resources','bin','docker.exe')
 if(!(Test-Path -LiteralPath $desktop) -and !(Test-Path -LiteralPath $docker)){continue}
 $records=@()
 $files=@($desktop,$docker);if($preflight){$files+=([IO.Path]::Combine($root,'resources','cli-plugins','docker-compose.exe'))}
 foreach($p in $files){
  $item=Get-Item -Force -LiteralPath $p;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'candidate'}
  $f=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try{
   if($f.Length -lt 1 -or $f.Length -gt 536870912 -or ($p -ceq $docker -and $f.Length -gt 67108864) -or ($preflight -and $p -ceq $files[2] -and $f.Length -gt 134217728)){throw 'size'}
   $signature=Get-AuthenticodeSignature -LiteralPath $p
   if($signature.Status -ne 'Valid' -or !$signature.SignerCertificate -or $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -cne 'Docker Inc'){throw 'publisher'}
   $sha=[Security.Cryptography.SHA256]::Create();try{$hash=$sha.ComputeHash($f)}finally{$sha.Dispose()};$records+=@{bytes=[uint32]$f.Length;sha=$hash}
  }finally{$f.Dispose()}
 }
 $found+=@{machine=$c.machine;base=$c.base;records=$records}
}
if($found.Count -ne 1){throw 'unique candidate'};$c=$found[0];$base=[Text.Encoding]::UTF8.GetBytes($c.base);if($base.Length -lt 3 -or $base.Length -gt 3072){throw 'base'}
$out=[Console]::OpenStandardOutput();$magic=[Text.Encoding]::ASCII.GetBytes($(if($preflight){if($kind){'CLDKSEL4'}else{'CLDKSEL3'}}elseif($kind){'CLDKSEL2'}else{'CLDKSEL1'}));$out.Write($magic,0,8);$out.WriteByte([byte]$c.machine);$out.WriteByte([byte]($base.Length -shr 8));$out.WriteByte([byte]($base.Length -band 255));$out.Write($base,0,$base.Length)
foreach($a in $c.records){$n=$a.bytes;$out.WriteByte([byte](($n -shr 24) -band 255));$out.WriteByte([byte](($n -shr 16) -band 255));$out.WriteByte([byte](($n -shr 8) -band 255));$out.WriteByte([byte]($n -band 255));$out.Write($a.sha,0,32)}
if($kind){$p=[Text.Encoding]::UTF8.GetBytes($profile);if($p.Length -lt 3 -or $p.Length -gt 3072){throw 'profile'};$out.WriteByte([byte]$kind);$out.WriteByte([byte]($p.Length -shr 8));$out.WriteByte([byte]($p.Length -band 255));$out.Write($p,0,$p.Length);foreach($a in @($cfg,$meta)){$n=$a.bytes;$out.WriteByte([byte](($n -shr 24) -band 255));$out.WriteByte([byte](($n -shr 16) -band 255));$out.WriteByte([byte](($n -shr 8) -band 255));$out.WriteByte([byte]($n -band 255));$out.Write($a.sha,0,32)}};$out.Flush()
} catch {exit 4}
