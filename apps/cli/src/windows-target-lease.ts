// Native Windows primitive preview. Installed fixed Node effect handlers remain
// Windows-refusing until their filesystem/SQL guards adopt this contract.
// No caller path selects the lease domain: the private HKCU locator is immutable
// after one atomic first-use reservation. Missing/partial settings fail closed.
export type WindowsTargetGeneration={schemaVersion:1;principal:string;scope:string;engine:string;endpoint:string;epoch:number;active:boolean};
const windowsBridge=String.raw`
$ErrorActionPreference='Stop'
try {
Add-Type -TypeDefinition @'
using System;using System.IO;using System.Text;using System.ComponentModel;using System.Runtime.InteropServices;using System.Security.AccessControl;using System.Security.Principal;using Microsoft.Win32;using Microsoft.Win32.SafeHandles;
public static class CastLinkPrivate {
 [StructLayout(LayoutKind.Sequential)] public struct SA {public int length;public IntPtr descriptor;public int inherit;}
 [StructLayout(LayoutKind.Sequential)] public struct INFO {public uint attributes;public System.Runtime.InteropServices.ComTypes.FILETIME creation,access,write;public uint volume,sizeHigh,sizeLow,links,indexHigh,indexLow;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string s,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateDirectory(string path,ref SA security);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern SafeFileHandle CreateFile(string path,uint access,uint share,ref SA security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateFileW")] static extern SafeFileHandle OpenFile(string path,uint access,uint share,IntPtr security,uint creation,uint flags,IntPtr template);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle handle,out INFO info);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandle(SafeFileHandle handle,StringBuilder path,uint length,uint flags);
 [DllImport("advapi32.dll")] static extern uint GetSecurityInfo(SafeFileHandle handle,int type,uint flags,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr descriptor);
 [DllImport("advapi32.dll")] static extern uint GetSecurityDescriptorLength(IntPtr descriptor);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegCreateKeyEx(IntPtr root,string name,int reserved,string cls,int options,int access,ref SA security,out IntPtr key,out int disposition);
 [DllImport("advapi32.dll")] static extern int RegCloseKey(IntPtr key);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern int RegQueryValueEx(IntPtr key,string name,IntPtr reserved,out int type,byte[] data,ref int size);
 public static string Value(RegistryKey key,string name){int type,size=0;if(RegQueryValueEx(key.Handle.DangerousGetHandle(),name,IntPtr.Zero,out type,null,ref size)!=0||type!=1||size<2||size>8192||size%2!=0)Fail();byte[] b=new byte[size];int expected=size;if(RegQueryValueEx(key.Handle.DangerousGetHandle(),name,IntPtr.Zero,out type,b,ref size)!=0||type!=1||size!=expected||b[size-1]!=0||b[size-2]!=0)Fail();string value=Encoding.Unicode.GetString(b,0,size-2);if(value.IndexOf('\0')>=0)Fail();return value;}
 public static string Sid {get{return WindowsIdentity.GetCurrent().User.Value;}}
 static void Fail(){throw new InvalidOperationException("native-target-private-unverified");}
 static SA Security(bool directory,bool registry,out IntPtr sd){uint length;string rights=registry?"KA":"FA",flags=directory?"OICI":"";string s="O:"+Sid+"D:P(A;"+flags+";"+rights+";;;"+Sid+")(A;"+flags+";"+rights+";;;SY)";if(!ConvertStringSecurityDescriptorToSecurityDescriptor(s,1,out sd,out length))Fail();return new SA{length=Marshal.SizeOf(typeof(SA)),descriptor=sd,inherit=0};}
 public static void ReserveRegistry(string name){IntPtr sd,key;SA sa=Security(false,true,out sd);try{int disposition;int result=RegCreateKeyEx(new IntPtr(unchecked((int)0x80000001)),name,0,null,0,0xF003F|0x100,ref sa,out key,out disposition);if(result!=0)Fail();try{if(disposition!=1)Fail();}finally{RegCloseKey(key);}}finally{LocalFree(sd);}}
 static void Acl(RawSecurityDescriptor sd,bool registry){if(sd.Owner==null||sd.Owner.Value!=Sid||(sd.ControlFlags&ControlFlags.DiscretionaryAclProtected)==0||sd.DiscretionaryAcl==null||sd.DiscretionaryAcl.Count!=2)Fail();bool user=false,system=false;int required=registry?0xF003F:0x1F01FF;foreach(GenericAce item in sd.DiscretionaryAcl){CommonAce a=item as CommonAce;if(a==null||a.AceQualifier!=AceQualifier.AccessAllowed||a.IsCallback||(a.AceFlags&AceFlags.Inherited)!=0||a.AccessMask!=required)Fail();if(a.SecurityIdentifier.Value==Sid&&!user)user=true;else if(a.SecurityIdentifier.Value=="S-1-5-18"&&!system)system=true;else Fail();}if(!user||!system)Fail();}
 public static void RegistryPrivate(RegistryKey key){RegistrySecurity a=key.GetAccessControl(AccessControlSections.Owner|AccessControlSections.Access);Acl(new RawSecurityDescriptor(a.GetSecurityDescriptorBinaryForm(),0),true);}
 public static string[] Inspect(string path,bool directory,bool privacy){using(SafeFileHandle h=OpenFile(path,0x20000,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero)){if(h.IsInvalid)Fail();INFO info;if(!GetFileInformationByHandle(h,out info)||(info.attributes&0x400)!=0||((info.attributes&0x10)!=0)!=directory||(!directory&&info.links!=1))Fail();StringBuilder final=new StringBuilder(32768);uint n=GetFinalPathNameByHandle(h,final,32768,0);if(n==0||n>=32768)Fail();string canonical=final.ToString();if(!canonical.StartsWith(@"\\?\")||canonical.StartsWith(@"\\?\UNC\"))Fail();canonical=canonical.Substring(4);if(canonical.Length<3||canonical[1]!=':'||canonical[2]!='\\')Fail();if(privacy){IntPtr owner,group,dacl,sacl,sd;uint result=GetSecurityInfo(h,1,5,out owner,out group,out dacl,out sacl,out sd);if(result!=0)Fail();try{uint length=GetSecurityDescriptorLength(sd);byte[] raw=new byte[length];Marshal.Copy(sd,raw,0,(int)length);Acl(new RawSecurityDescriptor(raw,0),false);}finally{LocalFree(sd);}}return new[]{canonical,info.volume.ToString("X8")+":"+info.indexHigh.ToString("X8")+info.indexLow.ToString("X8")};}}
 public static void Directory(string path){IntPtr sd;SA sa=Security(true,false,out sd);try{if(!CreateDirectory(path,ref sa))throw new Win32Exception(Marshal.GetLastWin32Error());}finally{LocalFree(sd);}}
 public static void Write(string path,byte[] data){IntPtr sd;SA sa=Security(false,false,out sd);try{using(SafeFileHandle h=CreateFile(path,0x40000000|0x20000,0,ref sa,1,0x00200000,IntPtr.Zero)){if(h.IsInvalid)Fail();using(FileStream f=new FileStream(h,FileAccess.Write)){f.Write(data,0,data.Length);f.Flush(true);}}}finally{LocalFree(sd);}}
}
'@
$r=[Console]::In.ReadToEnd()|ConvertFrom-Json
function Canonical([string]$p,[bool]$directory,[bool]$private) {
 if(!$p -or $p -notmatch '^[A-Za-z]:\\' -or $p -match '[\x00-\x1f\x7f]' -or $p.Split('\') -contains '..'){throw 'path'}
 $v=[CastLinkPrivate]::Inspect($p,$directory,$private)
 $parent=[IO.Path]::GetDirectoryName($v[0])
 while($parent -and $parent.Length -gt 3){[void][CastLinkPrivate]::Inspect($parent,$true,$false);$parent=[IO.Path]::GetDirectoryName($parent)}
 return @{path=$v[0];identity=$v[1]}
}
$registryName='Software\CastLink\TargetOperations'
$protocol='castlink-windows-target-locator-v1'
function Locator {
 $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64)
 try {$key=$base.OpenSubKey($registryName,$false);if(!$key){throw 'locator missing'}
 try {[CastLinkPrivate]::RegistryPrivate($key);if($key.ValueCount -ne 3 -or (($key.GetValueNames()|Sort-Object) -join ',') -cne 'protocol,scope,sid' -or $key.SubKeyCount -ne 0){throw 'locator partial'}
 foreach($name in @('protocol','scope','sid')){if($key.GetValueKind($name) -ne [Microsoft.Win32.RegistryValueKind]::String){throw 'locator kind'}}
 if([CastLinkPrivate]::Value($key,'protocol') -cne $protocol -or [CastLinkPrivate]::Value($key,'sid') -cne [CastLinkPrivate]::Sid){throw 'locator authority'}
 $scope=[CastLinkPrivate]::Value($key,'scope');$actual=Canonical $scope $true $true;if($actual.path -cne $scope -or [IO.Path]::GetFileName($scope) -cne '.castlink-target-operations'){throw 'locator scope'}
 return @{principal=[CastLinkPrivate]::Sid;scope=$scope;scopeIdentity=$actual.identity}
 }finally{$key.Dispose()}}finally{$base.Dispose()}
}
if($r.action -ceq 'initialize') {
 # Reserve first. A crash or invalid first-use configuration leaves a partial
 # key that blocks all subsequent initializers; no repair/repoint operation.
 [CastLinkPrivate]::ReserveRegistry($registryName)
 $configured=$r.profileRoot
 if(!$configured){$configured=[IO.Path]::Combine([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData),'CastLink','profiles')}
 $basePath=Canonical $configured $true $true
 $scope=[IO.Path]::Combine($basePath.path,'.castlink-target-operations')
 [CastLinkPrivate]::Directory($scope);$scope=(Canonical $scope $true $true).path
 $base=[Microsoft.Win32.RegistryKey]::OpenBaseKey([Microsoft.Win32.RegistryHive]::CurrentUser,[Microsoft.Win32.RegistryView]::Registry64)
 try{$key=$base.OpenSubKey($registryName,$true);try{[CastLinkPrivate]::RegistryPrivate($key);$key.SetValue('protocol',$protocol,[Microsoft.Win32.RegistryValueKind]::String);$key.SetValue('sid',[CastLinkPrivate]::Sid,[Microsoft.Win32.RegistryValueKind]::String);$key.SetValue('scope',$scope,[Microsoft.Win32.RegistryValueKind]::String);$key.Flush()}finally{$key.Dispose()}}finally{$base.Dispose()}
 $result=Locator
} elseif($r.action -ceq 'identity') {$result=Locator
} else {
 $locator=Locator;if($r.principal -cne $locator.principal -or $r.scope -cne $locator.scope){throw 'binding'}
 if($r.action -ceq 'inspect') {$result=Canonical $r.path ([bool]$r.directory) $true
 } elseif($r.action -ceq 'mkdir') { $parent=Canonical ([IO.Path]::GetDirectoryName([string]$r.path)) $true $true;[CastLinkPrivate]::Directory($r.path);$result=Canonical $r.path $true $true
 } elseif($r.action -ceq 'write') { $parent=Canonical ([IO.Path]::GetDirectoryName([string]$r.path)) $true $true;[CastLinkPrivate]::Write($r.path,[Convert]::FromBase64String($r.bytes));$result=Canonical $r.path $false $true
 } else {throw 'action'}
 $after=Locator;if($after.principal -cne $locator.principal -or $after.scope -cne $locator.scope -or $after.scopeIdentity -cne $locator.scopeIdentity){throw 'locator changed'}
}
$result|ConvertTo-Json -Compress
} catch {exit 4}
`;

export const windowsTargetBridgePowerShell=windowsBridge;

export const nativeWindowsTargetLease=String.raw`
const winFs=require('node:fs'),winPath=require('node:path'),winCrypto=require('node:crypto');

function winFail(){throw Error('native-target-private-unverified')}
function winBridge(request){
 if(process.platform!=='win32')winFail();const input=JSON.stringify(request);if(Buffer.byteLength(input)>(request?.action==='write'?131072:16384))winFail();
 if(typeof globalThis.__castlinkWindowsNativeBridge!=='function')winFail();
 const r=globalThis.__castlinkWindowsNativeBridge(request);
 if(!r||Object.keys(r).sort().join(',')!=='status,stdout'||r.status!=='ok'||typeof r.stdout!=='string'||!r.stdout||Buffer.byteLength(r.stdout)>8192)winFail();return JSON.parse(r.stdout);
}
function winIdentity(){const r=winBridge({action:'identity'});if(Object.keys(r).sort().join(',')!=='principal,scope,scopeIdentity'||typeof r.principal!=='string'||!/^S-1-\d+(?:-\d+){1,15}$/.test(r.principal)||typeof r.scope!=='string'||!/^\w:\\/.test(r.scope)||winPath.basename(r.scope)!=='.castlink-target-operations'||typeof r.scopeIdentity!=='string'||!/^[A-F0-9]{8}:[A-F0-9]{16}$/.test(r.scopeIdentity))winFail();return r;}
function winInspect(path,directory,identity=winIdentity()){const r=winBridge({action:'inspect',principal:identity.principal,scope:identity.scope,path,directory});if(Object.keys(r).sort().join(',')!=='identity,path'||typeof r.path!=='string'||typeof r.identity!=='string')winFail();return r;}
function winSame(a,b){return require('node:util').isDeepStrictEqual(a,b)}
function winRecord(path,identity=winIdentity()){
 const before=winInspect(path,false,identity),named=winFs.lstatSync(path);if(named.isSymbolicLink()||!named.isFile()||named.nlink!==1||named.size>8192)winFail();const fd=winFs.openSync(path,winFs.constants.O_RDONLY);
 try{const held=winFs.fstatSync(fd);if(held.dev!==named.dev||held.ino!==named.ino||held.nlink!==1||held.size!==named.size)winFail();const b=Buffer.alloc(8193);let size=0;while(size<b.length){const n=winFs.readSync(fd,b,size,b.length-size,size);if(!n)break;size+=n}const after=winFs.fstatSync(fd),current=winFs.lstatSync(path);if(size>8192||size!==held.size||held.size!==after.size||held.mtimeMs!==after.mtimeMs||held.ctimeMs!==after.ctimeMs||current.dev!==held.dev||current.ino!==held.ino||!winSame(winInspect(path,false,identity),before))winFail();const text=b.subarray(0,size).toString('utf8'),record=JSON.parse(text);if(text!==JSON.stringify(record)+'\n')winFail();return record;}finally{winFs.closeSync(fd)}
}
function winEpoch(identity){const file=winPath.join(identity.scope,'epoch.json');try{winFs.lstatSync(file)}catch(e){if(e.code==='ENOENT')return 0;throw e}const r=winRecord(file,identity);if(Object.keys(r).join(',')!=='epoch'||!Number.isSafeInteger(r.epoch)||r.epoch<0)winFail();return r.epoch;}
function winWrite(path,value,identity){const bytes=Buffer.from(JSON.stringify(value)+'\n');if(bytes.length>8192)winFail();return winBridge({action:'write',path,bytes:bytes.toString('base64'),principal:identity.principal,scope:identity.scope});}
function winEngine(){try{
 if(typeof globalThis.__castlinkWindowsNativeEngine!=='function')winFail();
 const answer=globalThis.__castlinkWindowsNativeEngine({action:'observe'});
 if(!answer||Object.keys(answer).sort().join(',')!=='status,stdout'||answer.status!=='ok'||typeof answer.stdout!=='string'||Buffer.byteLength(answer.stdout)>1024)winFail();
 const r=JSON.parse(answer.stdout);if(answer.stdout!==JSON.stringify(r)||Object.keys(r).sort().join(',')!=='endpoint,engine'||typeof r.engine!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(r.engine)||r.endpoint!=='npipe:////./pipe/dockerDesktopLinuxEngine')winFail();return r;
}catch{winFail()}}
function acquireWindowsTargetOperation(a){
 if(!a||Object.keys(a).sort().join(',')!=='engine,epoch,installationId,kind,principal,root,schemaVersion,scope'||a.schemaVersion!==1||!Number.isSafeInteger(a.epoch)||a.epoch<0||a.epoch===Number.MAX_SAFE_INTEGER||!['config','images','services','database','owner','completion','start','stop','backup'].includes(a.kind)||typeof a.root!=='string'||!winPath.isAbsolute(a.root)||typeof a.installationId!=='string'||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(a.installationId))winFail();
 const identity=winIdentity();if(a.principal!==identity.principal||a.scope!==identity.scope)winFail();const root=winInspect(a.root,true,identity);if(root.path!==a.root||!winSame(winIdentity(),identity)||winEpoch(identity)!==a.epoch)winFail();
 const active=winPath.join(identity.scope,'active');winBridge({action:'mkdir',path:active,principal:identity.principal,scope:identity.scope});const reservation=winInspect(active,true,identity);
 if(winEpoch(identity)!==a.epoch||!winSame(winIdentity(),identity))winFail();const actual=winEngine();if(actual.engine!==a.engine)winFail();
 const owner={...a,protocol:'castlink-windows-target-operation-v1',nonce:winCrypto.randomBytes(32).toString('hex'),pid:process.pid,endpoint:actual.endpoint,scopeIdentity:identity.scopeIdentity,rootIdentity:root.identity};const ownerRecord=winWrite(winPath.join(active,'owner.json'),owner,identity);
 return{identity,active,reservation,owner,ownerRecord,dispatched:false};
}
function checkWindowsTargetOperation(l){
 if(!winSame(winIdentity(),l.identity)||winEpoch(l.identity)!==l.owner.epoch||!winSame(winInspect(l.active,true,l.identity),l.reservation)||!winSame(winInspect(winPath.join(l.active,'owner.json'),false,l.identity),l.ownerRecord)||!winSame(winRecord(winPath.join(l.active,'owner.json'),l.identity),l.owner)||winInspect(l.owner.root,true,l.identity).identity!==l.owner.rootIdentity||!winSame(winEngine(),{engine:l.owner.engine,endpoint:l.owner.endpoint}))winFail();
}
function dispatchWindowsTargetOperation(l){checkWindowsTargetOperation(l);l.dispatched=true;}
function releaseWindowsTargetOperation(l,terminalEvidence){
 if(terminalEvidence!==true||l.dispatched!==true)winFail();checkWindowsTargetOperation(l);if(winFs.readdirSync(l.active).sort().join(',')!=='owner.json')winFail();
 const temporary=winPath.join(l.identity.scope,'epoch-'+l.owner.nonce);winWrite(temporary,{epoch:l.owner.epoch+1},l.identity);checkWindowsTargetOperation(l);winFs.renameSync(temporary,winPath.join(l.identity.scope,'epoch.json'));
 if(winEpoch(l.identity)!==l.owner.epoch+1||!winSame(winIdentity(),l.identity)||!winSame(winInspect(l.active,true,l.identity),l.reservation)||!winSame(winInspect(winPath.join(l.active,'owner.json'),false,l.identity),l.ownerRecord)||!winSame(winRecord(winPath.join(l.active,'owner.json'),l.identity),l.owner))winFail();
 const retired=winPath.join(l.identity.scope,'retired-'+l.owner.nonce);winFs.renameSync(l.active,retired);if(winInspect(retired,true,l.identity).identity!==l.reservation.identity)winFail();
 // Never touch the canonical active name after retirement. Windows does not
 // expose directory metadata fsync here: terminal success is process-level
 // evidence, not a promise of crash/power-loss durable directory renames.
 winFs.unlinkSync(winPath.join(retired,'owner.json'));winFs.rmdirSync(retired);
}
`;
export const windowsTargetScopeInitializer=nativeWindowsTargetLease+String.raw`
try {const r=winBridge({action:'initialize'});console.log(JSON.stringify({schemaVersion:1,...r}));}catch{process.exitCode=4}
`;
export const windowsTargetLeaseObservation=nativeWindowsTargetLease+String.raw`
try {const identity=winIdentity();const active=winPath.join(identity.scope,'active');let exists=false;try{winFs.lstatSync(active);exists=true;}catch(e){if(e.code!=='ENOENT')throw e}console.log(JSON.stringify({schemaVersion:1,principal:identity.principal,scope:identity.scope,epoch:winEpoch(identity),active:exists,...winEngine()}));}catch{process.exitCode=4}
`;
