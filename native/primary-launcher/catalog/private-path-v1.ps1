$ErrorActionPreference='Stop'
try {
$r=[Console]::In.ReadToEnd()|ConvertFrom-Json
if(($r.PSObject.Properties.Name|Sort-Object)-join ',' -cne 'directory,path' -or $r.path -isnot [string] -or $r.directory -isnot [bool] -or $r.path.Length -gt 1024 -or $r.path.Length -lt 4 -or $r.path -cnotmatch '^[A-Z]:\\' -or $r.path -match '[\x00-\x1f]'){exit 4}
$item=Get-Item -Force -LiteralPath $r.path
if(($item.Attributes-band [IO.FileAttributes]::ReparsePoint)-ne 0 -or $item.PSIsContainer-ne $r.directory){exit 4}
$owner=[Security.Principal.WindowsIdentity]::GetCurrent().User
$before=$item.GetAccessControl()
if($before.GetOwner([Security.Principal.SecurityIdentifier]).Value-cne $owner.Value){exit 4}
$acl=[Security.AccessControl.FileSecurity]::new()
$inheritance=[Security.AccessControl.InheritanceFlags]::None
if($r.directory){$acl=[Security.AccessControl.DirectorySecurity]::new();$inheritance=[Security.AccessControl.InheritanceFlags]'ContainerInherit, ObjectInherit'}
$acl.SetOwner($owner)
$acl.SetAccessRuleProtection($true,$false)
foreach($sid in @($owner,[Security.Principal.SecurityIdentifier]::new('S-1-5-18'))){$acl.AddAccessRule([Security.AccessControl.FileSystemAccessRule]::new($sid,'FullControl',$inheritance,'None','Allow'))}
$item.SetAccessControl($acl)
[Console]::Out.Write('{}')
exit 0
}catch{exit 4}
