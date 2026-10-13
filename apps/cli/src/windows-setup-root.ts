// Default creation is bounded to CastLink/profiles under the current SID-owned
// LocalAppData base. Explicit roots require a private parent; existing ACLs are never repaired.
export const windowsProfileRootPowerShell=String.raw`$ErrorActionPreference='Stop'
try {
$r=[Console]::In.ReadToEnd()|ConvertFrom-Json
$mode=$r.action
$root=$r.path;if(!$root -or $root -notmatch '^[A-Z]:\\' -or $root -match '[\x00-\x1f\x7f]' -or $root.Split('\') -contains '..' -or [IO.Path]::GetFullPath($root) -cne $root){throw 'path'}
$owner=[System.Security.Principal.WindowsIdentity]::GetCurrent().User
function Check([string]$directory,[bool]$private){
 $item=Get-Item -Force -LiteralPath $directory
 if(!$item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)){throw 'directory'}
 $acl=$item.GetAccessControl()
 if($acl.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $owner.Value){throw 'directory owner'}
 if(!$private){return}
 if(!$acl.AreAccessRulesProtected){throw 'private parent'}
 $rules=@($acl.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier]))
 if($rules.Count -ne 2){throw 'private parent'}
 $seen=@{}
 foreach($rule in $rules){$sid=$rule.IdentityReference.Value;if(($sid -ne $owner.Value -and $sid -ne 'S-1-5-18') -or $seen.ContainsKey($sid) -or $rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl' -or $rule.PropagationFlags -ne 'None' -or $rule.InheritanceFlags.ToString() -ne 'ContainerInherit, ObjectInherit'){throw 'private parent'};$seen[$sid]=$true}
}
if($mode -eq 'inspect'){Check $root ([bool]$r.privateDirectory)}
elseif($mode -eq 'create'){
 Check ([IO.Path]::GetDirectoryName($root)) ([bool]$r.privateParent)
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using System.ComponentModel;
public static class CastLinkSetupDirectory {
 [StructLayout(LayoutKind.Sequential)] public struct SA {public int length;public IntPtr descriptor;public int inherit;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string s,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateDirectory(string path,ref SA security);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr pointer);
 public static void Create(string path,string sid){IntPtr sd;uint size;if(!ConvertStringSecurityDescriptorToSecurityDescriptor("O:"+sid+"D:P(A;OICI;FA;;;"+sid+")(A;OICI;FA;;;SY)",1,out sd,out size))throw new Win32Exception();try{SA sa=new SA{length=Marshal.SizeOf(typeof(SA)),descriptor=sd,inherit=0};if(!CreateDirectory(path,ref sa))throw new Win32Exception(Marshal.GetLastWin32Error());}finally{LocalFree(sd);}}
}
'@

 [CastLinkSetupDirectory]::Create($root,$owner.Value)
 Check $root $true
}else{throw 'mode'}
[Console]::Write('{"verified":true}')
} catch {exit 4}
`;
export const windowsProfileRootNode=String.raw`
const fs=require('node:fs'),path=require('node:path');
try {
 if(process.platform!=='win32'||typeof globalThis.__castlinkWindowsNativeConfigRead!=='function')throw Error();
 const input=globalThis.__castlinkWindowsNativeConfigRead();if(!Buffer.isBuffer(input)||input.length>4096)throw Error();const r=JSON.parse(input.toString('utf8'));if(Object.keys(r).join(',')!=='root'||typeof r.root!=='string'||!path.win32.isAbsolute(r.root)||path.win32.normalize(r.root)!==r.root||/[\x00-\x1f\x7f]/.test(r.root))throw Error();
 function bridge(mode,directory,privateDirectory=true,privateParent=true){
  const hook=mode==='probe'?globalThis.__castlinkWindowsNativeBridge:globalThis.__castlinkWindowsNativeSetupRoot;
  if(typeof hook!=='function')throw Error();const result=hook(mode==='probe'?{action:'registry-status'}:{action:mode,path:directory,privateDirectory,privateParent});
  if(!result||Object.keys(result).sort().join(',')!=='status,stdout'||result.status!=='ok'||typeof result.stdout!=='string'||Buffer.byteLength(result.stdout)>1024)throw Error();const value=JSON.parse(result.stdout);
  if(mode==='probe'){if(Object.keys(value).join(',')!=='present'||typeof value.present!=='boolean')throw Error();return value.present?'present':'absent'}
  if(Object.keys(value).join(',')!=='verified'||value.verified!==true)throw Error();return '';
 }
 function present(p){try{fs.lstatSync(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
 function chain(p){for(;;){const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory()||fs.realpathSync.native(p)!==p)throw Error();const parent=path.win32.dirname(p);if(parent===p)break;p=parent}}
 const explicit=process.env.CASTLINK_PROFILE_ROOT!==undefined;
 const base=process.env.LOCALAPPDATA||path.win32.join(require('node:os').homedir(),'AppData','Local');
 if(explicit){if(path.win32.normalize(process.env.CASTLINK_PROFILE_ROOT)!==r.root)throw Error()}
 else if(!path.win32.isAbsolute(base)||path.win32.normalize(base)!==base||/[\x00-\x1f\x7f]/.test(base)||r.root!==path.win32.join(base,'CastLink','profiles'))throw Error();
 const locator=bridge('probe');if(locator!=='present'&&locator!=='absent')throw Error();
 if(locator==='absent'){
  if(explicit){chain(present(r.root)?r.root:path.win32.dirname(r.root));if(present(r.root))bridge('inspect',r.root);else bridge('create',r.root)}
  else {
   chain(base);bridge('inspect',base,false);
   for(const directory of [path.win32.join(base,'CastLink'),r.root]){if(present(directory)){chain(directory);bridge('inspect',directory)}else{bridge('create',directory,true,directory===r.root);chain(directory)}}
  }
 }
 process.stdout.write('{"verified":true}');
}catch{process.exitCode=4}
`;
