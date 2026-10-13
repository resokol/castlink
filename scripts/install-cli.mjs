// Explicit developer placement. Standalone with bundled Node; no network, program launch or global Node.
import {createHash} from 'node:crypto';
import {lstat,mkdir,readdir,open,chmod} from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {spawnSync} from 'node:child_process';
const MAX_FILE=256*1024**2,MAX_TOTAL=512*1024**2,MAX_FILES=4096;
const hash=b=>createHash('sha256').update(b).digest('hex');
const fail=m=>{throw Error(m);};
const identity=(a,b)=>['dev','ino','uid','gid','mode'].every(k=>a[k]===b[k]);
const fileIdentity=(a,b)=>identity(a,b)&&['size','mtimeMs','ctimeMs','nlink'].every(k=>a[k]===b[k]);
async function absent(p){try{await lstat(p);fail('Destination or install receipt exists; refusing overwrite.');}catch(e){if(e.code!=='ENOENT')throw e;}}
function absolute(p){if(typeof p!=='string'||!path.isAbsolute(p)||path.resolve(p)!==p||p===path.parse(p).root)fail('An absolute canonical path is required.');return p;}
async function bindPath(p,{owned=false,privateParent=false}={}){
 absolute(p);const entries=[];let at=path.parse(p).root;const systemOwner=(await lstat(at)).uid;
 for(const part of ['',...p.slice(at.length).split(path.sep).filter(Boolean)]){if(part)at=path.join(at,part);const s=await lstat(at);if(s.isSymbolicLink()||!s.isDirectory())fail('Refusing linked or non-directory path.');
  if(process.platform!=='win32'){if(s.uid!==0&&s.uid!==systemOwner&&s.uid!==process.getuid())fail('Ancestor owner is not trusted.');if(s.mode&0o022&&!(s.mode&0o1000))fail('Ancestor is writable by other principals.');}
  entries.push({path:at,stat:s});
 }
 const s=entries.at(-1).stat;if(process.platform!=='win32'&&(owned&&s.uid!==process.getuid()||privateParent&&s.mode&0o022))fail('Install parent must be owned and not writable by other principals.');
 if(process.platform==='win32')windowsOp({op:'ancestors',path:p});
 return {entries,async check(){for(const e of entries){const n=await lstat(e.path);if(n.isSymbolicLink()||!n.isDirectory()||!identity(n,e.stat))fail('Ancestor binding changed; refusing redirected output.');}}};
}
async function checkedBytes(file,limit,binding){await binding.check();const b=await lstat(file);if(!b.isFile()||b.isSymbolicLink()||b.nlink!==1||b.size>limit)fail('Refusing linked or oversized package file / aggregate bound.');const h=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);
 try{const s=await h.stat();if(!fileIdentity(s,b))fail('Package file changed.');const data=Buffer.alloc(b.size+1);let count=0;while(count<data.length){const r=await h.read(data,count,data.length-count,count);if(!r.bytesRead)break;count+=r.bytesRead;}const after=await h.stat(),named=await lstat(file);await binding.check();if(count!==b.size||!fileIdentity(after,b)||!fileIdentity(named,b))fail('Package file changed or grew beyond bound.');return {data:data.subarray(0,count),mode:b.mode&0o111?0o755:0o644};}finally{await h.close();}
}
async function inventory(root,binding,prefix='',budget={count:0}){await binding.check();const result=[];for(const n of (await readdir(path.join(root,prefix))).sort()){if(++budget.count>MAX_FILES*2)fail('Package inventory bound.');const relative=prefix?prefix+'/'+n:n;if(!/^([a-zA-Z0-9_-]+\/)*[a-zA-Z0-9_-]+(?:\.[a-zA-Z0-9_-]+)*$/.test(relative))fail('Invalid package path.');const p=path.join(root,relative),s=await lstat(p);if(s.isSymbolicLink())fail('Refusing linked package path.');if(s.isDirectory()){const nested=await bindPath(p);result.push(...await inventory(root,{check:async()=>{await binding.check();await nested.check();}},relative,budget));}else if(s.isFile()&&s.nlink===1)result.push(relative);else fail('Refusing linked package file.');if(result.length>MAX_FILES)fail('Package file bound.');}return result;}
function validateCapture(captured,pin){const sums=captured.get('SHA256SUMS');if(!sums||hash(sums.data)!==pin)fail('Package inventory integrity mismatch.');const text=sums.data.toString('utf8');if(!text.endsWith('\n')||text.includes('\uFFFD'))fail('Invalid package checksum inventory.');const listed=new Set();for(const line of text.slice(0,-1).split('\n')){const m=/^([a-f0-9]{64})  ([a-zA-Z0-9_./-]+)$/.exec(line);if(!m||m[2]==='SHA256SUMS'||listed.has(m[2])||!captured.has(m[2])||hash(captured.get(m[2]).data)!==m[1])fail('Package checksum integrity mismatch.');listed.add(m[2]);}if(listed.size!==captured.size-1)fail('Package integrity inventory mismatch.');
 const meta=captured.get('cli-release.json');if(!meta||meta.data.length>65536)fail('Unsupported package metadata.');const metadata=JSON.parse(meta.data.toString('utf8'));if(metadata.schemaVersion!==1||metadata.distribution!=='development-only'||typeof metadata.cliVersion!=='string'||metadata.cliVersion.length>128||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(metadata.cliVersion)||!['win32-x64','darwin-arm64','darwin-x64'].includes(metadata.target))fail('Unsupported development package metadata.');return metadata;
}
async function capture(root,pin,binding){const names=await inventory(root,binding);if(!names.includes('SHA256SUMS'))fail('Missing package inventory.');const captured=new Map();let total=0;const sums=await checkedBytes(path.join(root,'SHA256SUMS'),1024**2,binding);if(hash(sums.data)!==pin)fail('Package inventory integrity mismatch.');captured.set('SHA256SUMS',sums);total+=sums.data.length;
 for(const n of names){if(n==='SHA256SUMS')continue;const parent=await bindPath(path.dirname(path.join(root,n)));const composite={check:async()=>{await binding.check();await parent.check();}};const limit=Math.min(n==='cli-release.json'?65536:MAX_FILE,MAX_TOTAL-total);if(limit<0)fail('Package aggregate bound.');const b=await checkedBytes(path.join(root,n),limit,composite);total+=b.data.length;captured.set(n,b);}await binding.check();if(JSON.stringify(names)!==JSON.stringify(await inventory(root,binding)))fail('Package inventory changed.');return {captured,metadata:validateCapture(captured,pin)};
}
export const windowsPrivateCreateScript=String.raw`$ErrorActionPreference='Stop';try{
 $r=[Console]::In.ReadToEnd()|ConvertFrom-Json;$p=$r.path;$sid=[Security.Principal.WindowsIdentity]::GetCurrent().User;$system=New-Object Security.Principal.SecurityIdentifier('S-1-5-18');
 function CheckPrivate($p,$directory){
 $i=Get-Item -LiteralPath $p -Force;if(($i.Attributes-band[IO.FileAttributes]::ReparsePoint)-or$i.PSIsContainer-ne$directory){throw 'refused'};
 $sections=[Security.AccessControl.AccessControlSections]::Access-bor[Security.AccessControl.AccessControlSections]::Owner;
 $a=if($directory){[IO.Directory]::GetAccessControl($p,$sections)}else{[IO.File]::GetAccessControl($p,$sections)};
 if(-not$a.AreAccessRulesProtected-or$a.GetOwner([Security.Principal.SecurityIdentifier]).Value-ne$sid.Value){throw 'refused'};
 $rules=$a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier]);$own=$false;
 foreach($x in $rules){if($x.IsInherited-or$x.AccessControlType-ne[Security.AccessControl.AccessControlType]::Allow-or$x.IdentityReference.Value-notin@($sid.Value,$system.Value)-or$x.FileSystemRights-ne[Security.AccessControl.FileSystemRights]::FullControl){throw 'refused'};
 $flags=if($directory){[Security.AccessControl.InheritanceFlags]::ContainerInherit-bor[Security.AccessControl.InheritanceFlags]::ObjectInherit}else{[Security.AccessControl.InheritanceFlags]::None};if($x.InheritanceFlags-ne$flags-or$x.PropagationFlags-ne[Security.AccessControl.PropagationFlags]::None){throw 'refused'};if($x.IdentityReference.Value-eq$sid.Value){$own=$true}}
 if(-not$own){throw 'refused'}
 }
 if($r.op-eq'ancestors'){
 $at=$p;while($at){$i=Get-Item -LiteralPath $at -Force;if(-not$i.PSIsContainer-or($i.Attributes-band[IO.FileAttributes]::ReparsePoint)){throw 'refused'};$a=[IO.Directory]::GetAccessControl($at,[Security.AccessControl.AccessControlSections]::Access-bor[Security.AccessControl.AccessControlSections]::Owner);$owner=$a.GetOwner([Security.Principal.SecurityIdentifier]).Value;if($owner-notin@($sid.Value,'S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')){throw 'refused'};
 $danger=[Security.AccessControl.FileSystemRights]::Delete-bor[Security.AccessControl.FileSystemRights]::DeleteSubdirectoriesAndFiles-bor[Security.AccessControl.FileSystemRights]::ChangePermissions-bor[Security.AccessControl.FileSystemRights]::TakeOwnership-bor[Security.AccessControl.FileSystemRights]::WriteData;
 foreach($x in $a.GetAccessRules($true,$true,[Security.Principal.SecurityIdentifier])){if($x.AccessControlType-eq[Security.AccessControl.AccessControlType]::Allow-and$x.IdentityReference.Value-notin@($sid.Value,'S-1-5-18','S-1-5-32-544','S-1-5-80-956008885-3418522649-1831038044-1853292631-2271478464')-and($x.FileSystemRights-band$danger)-and-not($x.PropagationFlags-band[Security.AccessControl.PropagationFlags]::InheritOnly)){throw 'refused'}};$parent=[IO.Directory]::GetParent($at);$at=if($parent){$parent.FullName}else{$null}}
 }elseif($r.op-eq'check'){CheckPrivate $p ([bool]$r.directory)}elseif($r.op-in@('directory','file')){
 CheckPrivate ([IO.Path]::GetDirectoryName($p)) $true;if([IO.File]::Exists($p)-or[IO.Directory]::Exists($p)){throw 'exists'};
 $directory=$r.op-eq'directory';$security=if($directory){New-Object Security.AccessControl.DirectorySecurity}else{New-Object Security.AccessControl.FileSecurity};$security.SetOwner($sid);$security.SetAccessRuleProtection($true,$false);
 $flags=if($directory){[Security.AccessControl.InheritanceFlags]::ContainerInherit-bor[Security.AccessControl.InheritanceFlags]::ObjectInherit}else{[Security.AccessControl.InheritanceFlags]::None};foreach($who in @($sid,$system)){$rule=New-Object Security.AccessControl.FileSystemAccessRule($who,[Security.AccessControl.FileSystemRights]::FullControl,$flags,[Security.AccessControl.PropagationFlags]::None,[Security.AccessControl.AccessControlType]::Allow);$security.AddAccessRule($rule)}
 if($directory){
 Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class CastLinkPrivateCreate {
 [StructLayout(LayoutKind.Sequential)] public struct Attributes { public int Length; public IntPtr Descriptor; [MarshalAs(UnmanagedType.Bool)] public bool Inherit; }
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] public static extern bool CreateDirectory(string path, ref Attributes security);
}
'@
 $bytes=$security.GetSecurityDescriptorBinaryForm();$memory=[Runtime.InteropServices.Marshal]::AllocHGlobal($bytes.Length);
 try{[Runtime.InteropServices.Marshal]::Copy($bytes,0,$memory,$bytes.Length);$attributes=New-Object CastLinkPrivateCreate+Attributes;$attributes.Length=[Runtime.InteropServices.Marshal]::SizeOf($attributes);$attributes.Descriptor=$memory;$attributes.Inherit=$false;if(-not[CastLinkPrivateCreate]::CreateDirectory($p,[ref]$attributes)){throw 'exclusive private directory create refused'}}finally{[Runtime.InteropServices.Marshal]::FreeHGlobal($memory)}
 }else{$file=New-Object IO.FileStream($p,[IO.FileMode]::CreateNew,[Security.AccessControl.FileSystemRights]::Write,[IO.FileShare]::None,4096,[IO.FileOptions]::None,$security);$file.Dispose()};CheckPrivate $p $directory
 }else{throw 'refused'};[Console]::Out.Write('private');exit 0
}catch{exit 4}`;
function windowsOp(request){const entry=Object.entries(process.env).find(([k])=>k.toUpperCase()==='SYSTEMROOT'),root=entry?.[1];if(!root||!path.win32.isAbsolute(root)||path.win32.parse(root).root===root)fail('Cannot verify native Windows privacy.');const r=spawnSync(path.win32.join(root,'System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoLogo','-NoProfile','-NonInteractive','-Command',windowsPrivateCreateScript],{input:JSON.stringify(request),encoding:'utf8',timeout:15000,maxBuffer:4096,windowsHide:true});if(r.error||r.status!==0||r.stdout!=='private')fail('Windows private owner/DACL or ancestor contract refused.');}
async function directory(p,parentBinding){await parentBinding.check();await absent(p);if(process.platform==='win32')windowsOp({op:'directory',path:p});else await mkdir(p,{mode:0o700});await parentBinding.check();return bindPath(p,{owned:true,privateParent:true});}
async function put(file,bytes,mode,parentBinding){await parentBinding.check();let before;if(process.platform==='win32'){windowsOp({op:'file',path:file});before=await lstat(file);}const flags=constants.O_WRONLY|constants.O_NOFOLLOW|(process.platform==='win32'?0:constants.O_CREAT|constants.O_EXCL);const h=await open(file,flags,mode);
 try{const s=await h.stat();if(!s.isFile()||s.nlink!==1||before&&!fileIdentity(before,s))fail('New private file binding changed.');await parentBinding.check();if(process.platform==='win32')windowsOp({op:'check',path:file,directory:false});let at=0;while(at<bytes.length){const r=await h.write(bytes,at,bytes.length-at);if(!r.bytesWritten)fail('Private write failed.');at+=r.bytesWritten;}await h.sync();const after=await lstat(file),held=await h.stat();if(after.dev!==s.dev||after.ino!==s.ino||!fileIdentity(after,held))fail('New file binding changed.');}finally{await h.close();}if(process.platform!=='win32')await chmod(file,mode);await parentBinding.check();if(process.platform==='win32')windowsOp({op:'check',path:file,directory:false});}
export async function installPackage({source,destination,expectedInventorySha256,development}){
 if(development!==true)fail('Explicit development mode required; signed release installation not implemented.');if(!/^[a-f0-9]{64}$/.test(expectedInventorySha256))fail('Trusted package inventory integrity fingerprint required.');absolute(source);absolute(destination);if(source===destination||destination.startsWith(source+path.sep)||source.startsWith(destination+path.sep))fail('Source and destination paths overlap.');const sourceBinding=await bindPath(source,{owned:true}),parentBinding=await bindPath(path.dirname(destination),{owned:true,privateParent:true});if(process.platform==='win32')windowsOp({op:'check',path:path.dirname(destination),directory:true});const receiptPath=destination+'.castlink-install.json';await absent(destination);await absent(receiptPath);const {captured,metadata}=await capture(source,expectedInventorySha256,sourceBinding);
 await sourceBinding.check();await parentBinding.check();await absent(receiptPath);const destinationBinding=await directory(destination,parentBinding);const directories=new Map([['',destinationBinding]]);
 try{for(const [name,b] of captured){const parts=name.split('/');parts.pop();let prefix='';for(const p of parts){const previous=prefix;prefix=prefix?prefix+'/'+p:p;if(!directories.has(prefix))directories.set(prefix,await directory(path.join(destination,prefix),directories.get(previous)));}await put(path.join(destination,name),b.data,b.mode,directories.get(parts.join('/')));}
  const final=await capture(destination,expectedInventorySha256,destinationBinding);if(final.metadata.cliVersion!==metadata.cliVersion||final.metadata.target!==metadata.target)fail('Installed metadata snapshot mismatch.');const receipt={schemaVersion:1,contract:'castlink-cli-install-v1',distribution:'development-only',destination,cliVersion:metadata.cliVersion,target:metadata.target,inventorySha256:expectedInventorySha256};await put(receiptPath,Buffer.from(JSON.stringify(receipt)+'\n'),0o600,parentBinding);return {destination,receiptPath,distribution:'development-only',pathRegistered:false};
 }catch(error){fail('Installation refused; private partial output retained. Use a new destination after diagnosis. '+error.message);}
}
// INACTIVE investigation artifact: native UUID proof demonstrated an accepted writer's lost update. Never dispatch from installation/PATH APIs.
export const windowsUserPathScript=String.raw`$ErrorActionPreference='Stop';try{
Add-Type -TypeDefinition @'
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Text;
public static class CastLinkUserPathTransaction {
 // Production destination is fixed. Native proof may substitute only this constant with its owned UUID key.
 private const string EnvironmentKey = "Environment";
 private static readonly IntPtr HKCU = new IntPtr(unchecked((int)0x80000001));
 private const uint MaximumBytes = 65536;
 [DllImport("ktmw32.dll",CharSet=CharSet.Unicode,SetLastError=true)] private static extern IntPtr CreateTransaction(IntPtr attributes,IntPtr uow,uint options,uint isolation,uint flags,uint timeout,string description);
 [DllImport("ktmw32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool CommitTransaction(IntPtr transaction);
 [DllImport("ktmw32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool RollbackTransaction(IntPtr transaction);
 [DllImport("kernel32.dll",SetLastError=true)] [return:MarshalAs(UnmanagedType.Bool)] private static extern bool CloseHandle(IntPtr handle);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,EntryPoint="RegOpenKeyExW")] private static extern int RegOpenKeyEx(IntPtr hive,string subkey,uint options,uint access,out IntPtr key);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,EntryPoint="RegOpenKeyTransactedW")] private static extern int RegOpenKeyTransacted(IntPtr hive,string subkey,uint options,uint access,out IntPtr key,IntPtr transaction,IntPtr extended);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,EntryPoint="RegQueryValueExW")] private static extern int RegQueryValueEx(IntPtr key,string name,IntPtr reserved,out uint type,byte[] data,ref uint size);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,EntryPoint="RegSetValueExW")] private static extern int RegSetValueEx(IntPtr key,string name,uint reserved,uint type,byte[] data,uint size);
 [DllImport("advapi32.dll")] private static extern int RegCloseKey(IntPtr key);
 public sealed class Snapshot { public bool exists; public uint type; public string rawBase64; public string path; public string expandedPath; }
 private static void Check(int code) { if(code!=0)throw new Win32Exception(code,"Registry transaction unavailable or conflicted; no conditional PATH commit authorized"); }
 private static Snapshot Query(IntPtr key) {
  uint type,size=0;int code=RegQueryValueEx(key,"Path",IntPtr.Zero,out type,null,ref size);
  if(code==2)return new Snapshot { exists=false,type=0,rawBase64="",path="",expandedPath="" };
  Check(code);if(size>MaximumBytes)throw new InvalidOperationException("Raw user PATH exceeds bound");
  byte[] raw=new byte[size];uint actual=size;Check(RegQueryValueEx(key,"Path",IntPtr.Zero,out type,raw,ref actual));if(actual!=size)throw new InvalidOperationException("User PATH snapshot changed");
  if((type!=1&&type!=2)||raw.Length<2||raw.Length%2!=0)throw new InvalidOperationException("Unsupported raw user PATH type/encoding");
  string text=new UnicodeEncoding(false,false,true).GetString(raw);if(!text.EndsWith("\0")||text.Substring(0,text.Length-1).IndexOf('\0')>=0)throw new InvalidOperationException("Unsupported raw user PATH terminator");
  text=text.Substring(0,text.Length-1);return new Snapshot { exists=true,type=type,rawBase64=Convert.ToBase64String(raw),path=text,expandedPath=type==2?Environment.ExpandEnvironmentVariables(text):text };
 }
 public static Snapshot Read() { IntPtr key=IntPtr.Zero;try{Check(RegOpenKeyEx(HKCU,EnvironmentKey,0,1,out key));return Query(key);}finally{if(key!=IntPtr.Zero)RegCloseKey(key);} }
 public static string Append(bool exists,uint expectedType,string expectedRaw,string directory) {
  if(String.IsNullOrEmpty(directory)||directory.IndexOfAny(new char[] {';','\0','%','\r','\n'})>=0)throw new InvalidOperationException("Unsupported owned PATH entry");
  byte[] expected=Convert.FromBase64String(expectedRaw);if(expected.Length>MaximumBytes)throw new InvalidOperationException("Expected PATH size bound");
  IntPtr transaction=IntPtr.Zero,key=IntPtr.Zero;bool committed=false;
  try {
   transaction=CreateTransaction(IntPtr.Zero,IntPtr.Zero,0,0,0,10000,"CastLink conditional User PATH append");
   if(transaction==IntPtr.Zero||transaction==new IntPtr(-1))throw new Win32Exception(Marshal.GetLastWin32Error(),"Registry transactions unavailable; use explicit installed launcher without PATH registration");
   Check(RegOpenKeyTransacted(HKCU,EnvironmentKey,0,3,out key,transaction,IntPtr.Zero));Snapshot current=Query(key);
   if(current.exists!=exists||current.type!=expectedType||current.rawBase64!=expectedRaw)throw new InvalidOperationException("Registry transaction conflict: original typed raw User PATH changed");
   foreach(string entry in current.path.Split(';'))if(String.Equals(entry.TrimEnd('\\'),directory.TrimEnd('\\'),StringComparison.OrdinalIgnoreCase))throw new InvalidOperationException("Owned PATH entry already registered");
   uint type=current.exists?current.type:2;string next=current.path+(current.path.Length>0&&!current.path.EndsWith(";")?";":"")+directory;
   byte[] bytes=new UnicodeEncoding(false,false,true).GetBytes(next+"\0");if(bytes.Length>MaximumBytes)throw new InvalidOperationException("Updated raw PATH exceeds bound");
   Check(RegSetValueEx(key,"Path",0,type,bytes,(uint)bytes.Length));
   // The key remains held under this transaction through commit. Independent conflicting registry writers cannot be silently overwritten.
   if(!CommitTransaction(transaction))throw new Win32Exception(Marshal.GetLastWin32Error(),"Registry transaction conflict/unavailable; no PATH success claim");
   committed=true;return "registered";
  } finally { if(key!=IntPtr.Zero)RegCloseKey(key);if(transaction!=IntPtr.Zero&&transaction!=new IntPtr(-1)){if(!committed)RollbackTransaction(transaction);CloseHandle(transaction);} }
 }
}
'@
$r=[Console]::In.ReadToEnd()|ConvertFrom-Json;
if($r.op-eq'read'){[Console]::Out.Write(([CastLinkUserPathTransaction]::Read()|ConvertTo-Json -Compress));exit 0}
if($r.op-ne'append'-or$r.expected-isnot[psobject]-or$r.directory-isnot[string]){throw 'Invalid transaction request'};
$result=[CastLinkUserPathTransaction]::Append([bool]$r.expected.exists,[uint32]$r.expected.type,[string]$r.expected.rawBase64,[string]$r.directory);[Console]::Out.Write($result);exit 0
}catch{[Console]::Error.Write('Atomic User PATH unavailable/conflicted. Placement remains usable via its explicit launcher; do not retry or overwrite the retained PATH intent.');exit 4}
`;
function userPathNative(){fail('Automatic persistent Windows PATH disabled: native lost-update counterexample. Use the installed launcher by its explicit path.');}
function validatePathSnapshot(snapshot){if(!snapshot||typeof snapshot.exists!=='boolean'||!Number.isInteger(snapshot.type)||typeof snapshot.rawBase64!=='string'||typeof snapshot.path!=='string'||typeof snapshot.expandedPath!=='string'||snapshot.rawBase64.length>87384||snapshot.path.length>32767||snapshot.expandedPath.length>65536)fail('Invalid bounded raw typed user PATH snapshot.');const bytes=Buffer.from(snapshot.rawBase64,'base64');if(bytes.toString('base64')!==snapshot.rawBase64||bytes.length>65536||snapshot.exists&&![1,2].includes(snapshot.type)||!snapshot.exists&&(snapshot.type!==0||bytes.length||snapshot.path!==''))fail('Invalid raw typed user PATH snapshot.');if(snapshot.exists&&(bytes.length<2||bytes.length%2||bytes.toString('utf16le')!==snapshot.path+'\0'||snapshot.path.includes('\0')))fail('User PATH snapshot byte association failed.');if(snapshot.exists&&snapshot.type===1&&snapshot.expandedPath!==snapshot.path)fail('REG_SZ collision view must remain literal.');}
export async function commitWindowsPathTransaction(){fail('Automatic persistent Windows PATH disabled: native lost-update counterexample. No adapter was dispatched; use the explicit installed launcher.');}
async function commandCollision(searchPath,bin){if(typeof searchPath!=='string'||searchPath.length>65536)fail('Invalid PATH collision inventory.');const windows=process.platform==='win32',names=windows?['castlink','castlink.com','castlink.exe','castlink.bat','castlink.cmd','castlink.ps1']:['castlink'];for(const directory of searchPath.split(path.delimiter)){const absoluteDirectory=path.resolve(directory||'.');for(const name of names){const candidate=path.join(absoluteDirectory,name);try{await lstat(candidate);if(path.resolve(absoluteDirectory)!==path.resolve(bin))fail('Existing castlink command collision; unrelated command retained.');}catch(error){if(error.code!=='ENOENT'&&error.code!=='ENOTDIR')throw error;}}}}
export async function registerUserPath({installation,expectedInventorySha256,profile,searchPath=process.env.PATH??''}){
 if(process.platform==='win32')fail('Automatic persistent Windows PATH disabled after native lost-update counterexample. Placement remains usable by explicit launcher; no user settings or PATH intent changed.');
 absolute(installation);if(path.join(installation,'bin').includes(path.delimiter))fail('Owned bin contains the POSIX PATH separator colon; use the explicit launcher instead of PATH registration.');if(!/^[a-f0-9]{64}$/.test(expectedInventorySha256))fail('Trusted inventory required for PATH registration.');const binding=await bindPath(installation,{owned:true}),parent=await bindPath(path.dirname(installation),{owned:true,privateParent:true});const receipt=jsonReceipt((await checkedBytes(installation+'.castlink-install.json',65536,parent)).data);const {metadata}=await capture(installation,expectedInventorySha256,binding);if(receipt.contract!=='castlink-cli-install-v1'||receipt.destination!==installation||receipt.inventorySha256!==expectedInventorySha256||receipt.cliVersion!==metadata.cliVersion||receipt.target!==metadata.target)fail('Install receipt does not authorize PATH entry.');
 const bin=path.join(installation,'bin'),command=path.join(bin,process.platform==='win32'?'castlink.cmd':'castlink'),commandStat=await lstat(command);if(!commandStat.isFile()||commandStat.isSymbolicLink()||commandStat.nlink!==1)fail('Installed command is not a regular verified launcher.');const registrationReceipt=installation+'.castlink-path.json';await absent(registrationReceipt);let current;if(process.platform==='win32'){if(profile!==undefined)fail('Windows user PATH uses user scope; shell profile is unsupported.');current=JSON.parse(userPathNative({op:'read'}));validatePathSnapshot(current);await commandCollision(searchPath+path.delimiter+current.expandedPath,bin);}else{absolute(profile);if(profile===installation+'.castlink-install.json'||profile===registrationReceipt||profile===installation||profile.startsWith(installation+path.sep))fail('PATH profile overlaps installation or receipts.');await commandCollision(searchPath,bin);}
 let profileBytes,profileBinding,profileBefore;const marker='# CastLink owned PATH '+hash(Buffer.from(installation));
 if(process.platform!=='win32'){profileBinding=await bindPath(path.dirname(profile),{owned:true,privateParent:true});try{profileBefore=await lstat(profile);if(profileBefore.uid!==process.getuid()||profileBefore.mode&0o022)fail('User PATH profile is writable by other principals.');profileBytes=(await checkedBytes(profile,1024**2,profileBinding)).data;if(profileBytes.includes(Buffer.from(marker)))fail('PATH entry already registered.');}catch(error){if(error.code!=='ENOENT')throw error;profileBytes=Buffer.alloc(0);}}
 await binding.check();await parent.check();await absent(registrationReceipt);
 // Exclusive intent receipt is a reservation, not a success claim; never rewrites an existing receipt.
 await put(registrationReceipt,Buffer.from(JSON.stringify({schemaVersion:1,contract:'castlink-user-path-intent-v1',installation,bin,profile:profile??null,inventorySha256:expectedInventorySha256})+'\n'),0o600,parent);
 if(process.platform==='win32'){await commitWindowsPathTransaction({snapshot:current,directory:bin});}
 else{await profileBinding.check();const quoted="'"+bin.replaceAll("'", "'\\''")+"'",append=Buffer.from((profileBytes.length&&!profileBytes.toString().endsWith('\n')?'\n':'')+marker+'\nexport PATH='+quoted+':"$PATH"\n');if(profileBytes.length+append.length>1024**2)fail('User PATH profile size bound.');if(!profileBefore)await put(profile,append,0o600,profileBinding);else{const h=await open(profile,constants.O_WRONLY|constants.O_APPEND|constants.O_NOFOLLOW);try{if(!fileIdentity(await h.stat(),profileBefore))fail('User PATH profile changed.');await profileBinding.check();let offset=0;while(offset<append.length){const r=await h.write(append,offset,append.length-offset);if(!r.bytesWritten)fail('User profile append failed.');offset+=r.bytesWritten;}await h.sync();}finally{await h.close();}const result=(await checkedBytes(profile,1024**2,profileBinding)).data;if(!result.equals(Buffer.concat([profileBytes,append])))fail('Concurrent user profile change; completed append retained.');}}
 return {installation,pathRegistered:true,scope:'user',registrationReceipt,...(profile?{profile}:{})};
}
function jsonReceipt(buffer){const value=JSON.parse(buffer.toString('utf8'));if(value.schemaVersion!==1||value.distribution!=='development-only')fail('Unsupported installation receipt.');return value;}
async function main(args){if(args.length===1&&args[0]==='--help'){console.log('Developer-only: bundled Node install-cli.mjs --development --source EXTRACTED_PACKAGE --destination NEW_ABSOLUTE_DIRECTORY --inventory-sha256 TRUSTED_SHA256SUMS_HASH. Optional --register-path with --path-profile ABSOLUTE_USER_SHELL_PROFILE on POSIX; Windows automatic persistent PATH is disabled; use the explicit installed launcher.');return;}const values={};for(let i=0;i<args.length;i++){const a=args[i];if(a==='--development'||a==='--register-path'){if(values[a])fail('Invalid arguments.');values[a]=true;values.development=values['--development'];}else if(['--source','--destination','--inventory-sha256','--path-profile'].includes(a)&&!values[a]&&args[i+1]&&!args[i+1].startsWith('--'))values[a]=args[++i];else fail('Invalid arguments.');}if(values['--path-profile']&&!values['--register-path']||values['--register-path']&&process.platform!=='win32'&&!values['--path-profile'])fail('Explicit user PATH profile required.');const result=await installPackage({development:values.development,source:values['--source'],destination:values['--destination'],expectedInventorySha256:values['--inventory-sha256']});if(values['--register-path'])Object.assign(result,await registerUserPath({installation:result.destination,expectedInventorySha256:values['--inventory-sha256'],profile:values['--path-profile']}));console.log(JSON.stringify(result));}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)try{await main(process.argv.slice(2));}catch(error){console.error('CastLink CLI installation refused. Existing installations were not adopted; any private new partial output is retained. '+error.message);process.exitCode=4;}
