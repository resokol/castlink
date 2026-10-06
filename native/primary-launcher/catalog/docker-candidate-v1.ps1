$ErrorActionPreference='Stop'
try {
# This catalog only observes candidates. Native owns held identity and execution.
Import-Module ([IO.Path]::Combine([Environment]::SystemDirectory,'WindowsPowerShell\v1.0\Modules\Microsoft.PowerShell.Security\Microsoft.PowerShell.Security.psd1')) -ErrorAction Stop
$raw=[Console]::In.ReadToEnd();if([Text.Encoding]::UTF8.GetByteCount($raw) -gt 4096){throw 'input'}
$r=$raw|ConvertFrom-Json
if((($r.PSObject.Properties.Name|Sort-Object) -join ',') -cne 'context,customConfig,host' -or $r.customConfig -isnot [bool] -or $r.customConfig){throw 'selector'}
$endpoint='npipe:////./pipe/dockerDesktopLinuxEngine'
# Context names can be repointed. This initial provider accepts only an explicit
# endpoint selection and no context/custom config, never silently redirects one.
if($r.context -isnot [string] -or $r.host -isnot [string] -or $r.context -cne '' -or $r.host -cne $endpoint){throw 'selector'}
$found=@()
foreach($c in @(@{machine=$true;base=[Environment]::GetFolderPath('ProgramFiles');relative='Docker\Docker'},@{machine=$false;base=[Environment]::GetFolderPath('LocalApplicationData');relative='Programs\DockerDesktop'})){
 if(!$c.base){continue};$root=[IO.Path]::Combine($c.base,$c.relative);$desktop=[IO.Path]::Combine($root,'Docker Desktop.exe');$docker=[IO.Path]::Combine($root,'resources','bin','docker.exe')
 if(!(Test-Path -LiteralPath $desktop) -and !(Test-Path -LiteralPath $docker)){continue}
 $records=@()
 foreach($p in @($desktop,$docker)){
  $item=Get-Item -Force -LiteralPath $p;if($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'candidate'}
  $f=[IO.File]::Open($p,[IO.FileMode]::Open,[IO.FileAccess]::Read,[IO.FileShare]::Read)
  try{
   if($f.Length -lt 1 -or $f.Length -gt 536870912 -or ($p -ceq $docker -and $f.Length -gt 67108864)){throw 'size'}
   $signature=Get-AuthenticodeSignature -LiteralPath $p
   if($signature.Status -ne 'Valid' -or !$signature.SignerCertificate -or $signature.SignerCertificate.GetNameInfo([Security.Cryptography.X509Certificates.X509NameType]::SimpleName,$false) -cne 'Docker Inc'){throw 'publisher'}
   $sha=[Security.Cryptography.SHA256]::Create();try{$hash=$sha.ComputeHash($f)}finally{$sha.Dispose()};$records+=@{bytes=[uint32]$f.Length;sha=$hash}
  }finally{$f.Dispose()}
 }
 $found+=@{machine=$c.machine;base=$c.base;records=$records}
}
if($found.Count -ne 1){throw 'unique candidate'};$c=$found[0];$base=[Text.Encoding]::UTF8.GetBytes($c.base);if($base.Length -lt 3 -or $base.Length -gt 3072){throw 'base'}
$out=[Console]::OpenStandardOutput();$magic=[Text.Encoding]::ASCII.GetBytes('CLDKSEL1');$out.Write($magic,0,8);$out.WriteByte([byte]$c.machine);$out.WriteByte([byte]($base.Length -shr 8));$out.WriteByte([byte]($base.Length -band 255));$out.Write($base,0,$base.Length)
foreach($a in $c.records){$n=$a.bytes;$out.WriteByte([byte](($n -shr 24) -band 255));$out.WriteByte([byte](($n -shr 16) -band 255));$out.WriteByte([byte](($n -shr 8) -band 255));$out.WriteByte([byte]($n -band 255));$out.Write($a.sha,0,32)};$out.Flush()
} catch {exit 4}
