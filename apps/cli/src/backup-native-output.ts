import path from 'node:path';
import {parseStrictJson} from './strict-json.js';

// Component only: the fixed backup handler must dispatch its real shared lease,
// keep it held, perform source/resource POST and reap this worker before release.
// No public platform enablement, target lease initialization or lease release.
export const backupOutputNames=['postgres.dump','web-data.tar','caddy-data.tar','caddy-config.tar','compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json','manifest.json'] as const;
const fields=['directory','root','scope','principal','installationId','engine','endpoint','nonce','scopeIdentity','activeIdentity','ownerIdentity','rootIdentity','ownerSHA256','epoch'] as const;
export type BackupOutputAssociation={directory:string;root:string;scope:string;principal:string;installationId:string;engine:string;endpoint:string;nonce:string;scopeIdentity:string;activeIdentity:string;ownerIdentity:string;rootIdentity:string;ownerSHA256:string;epoch:number};
const fail=()=>{throw Error('Native backup output is unverified; retain the private partial output and target owner.');};
function canonical(p:unknown):p is string{return typeof p==='string'&&p.length<=4096&&/^[A-Z]:\\/.test(p)&&path.win32.normalize(p)===p&&p!==path.win32.parse(p).root&&!/[\x00-\x1f\x7f<>"|?*:]/.test(p.slice(2))&&p.slice(3).split('\\').every(s=>s.length>0&&!/[. ]$/.test(s));}
export function backupOutputHeader(value:BackupOutputAssociation):Buffer{
 const a=structuredClone(value);if(!a||Object.keys(a).sort().join(',')!==[...fields].sort().join(',')||![a.directory,a.root,a.scope].every(canonical)||path.win32.basename(a.scope)!=='.castlink-target-operations'||typeof a.principal!=='string'||!/^S-1-\d+(?:-\d+){1,15}$/.test(a.principal)||typeof a.installationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(a.installationId)||typeof a.engine!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(a.engine)||typeof a.endpoint!=='string'||!/^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/.test(a.endpoint)||!Number.isSafeInteger(a.epoch)||a.epoch<0||a.epoch===Number.MAX_SAFE_INTEGER||![a.nonce,a.ownerSHA256].every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s))||![a.scopeIdentity,a.activeIdentity,a.ownerIdentity,a.rootIdentity].every(s=>typeof s==='string'&&/^[A-F0-9]{8}:[A-F0-9]{16}$/.test(s)))return fail();
 const overlap=(x:string,y:string)=>{x=x.toLowerCase();y=y.toLowerCase();return x===y||x.startsWith(y+'\\')||y.startsWith(x+'\\');};if(overlap(a.directory,a.root)||overlap(a.directory,a.scope))return fail();
 const parts=[Buffer.from('CLBKOUT1')];for(const key of fields){const b=Buffer.from(String(a[key]),'utf8'),n=Buffer.alloc(4);n.writeUInt32BE(b.length);parts.push(n,b);}const header=Buffer.concat(parts);if(header.length>16384)return fail();return header;
}
export function backupOutputFrame(name:typeof backupOutputNames[number],bytes:Buffer):Buffer{const index=backupOutputNames.indexOf(name),cap=index<4?64*1024*1024:index===9?65536:1048576;if(index<0||!Buffer.isBuffer(bytes)||bytes.length>cap)return fail();const h=Buffer.alloc(6);h[0]=1;h[1]=index;h.writeUInt32BE(bytes.length,2);return Buffer.concat([h,bytes]);}
export const backupOutputTerminal=()=>Buffer.from([2]);
export type BackupOutputAck={schemaVersion:1;status:'private-output-closed';files:{name:string;bytes:number;sha256:string;identity:string}[]};
export function parseBackupOutputAck(raw:string):BackupOutputAck{const a=parseStrictJson(raw,16384) as BackupOutputAck;if(!a||Object.keys(a).sort().join(',')!=='files,schemaVersion,status'||a.schemaVersion!==1||a.status!=='private-output-closed'||!Array.isArray(a.files)||a.files.length!==10||a.files.some((v,i)=>!v||Object.keys(v).sort().join(',')!=='bytes,identity,name,sha256'||v.name!==backupOutputNames[i]||!Number.isSafeInteger(v.bytes)||v.bytes<0||v.bytes>(i<4?67108864:i===9?65536:1048576)||typeof v.sha256!=='string'||!/^[a-f0-9]{64}$/.test(v.sha256)||typeof v.identity!=='string'||!/^[A-F0-9]{8}:[A-F0-9]{16}$/.test(v.identity)))return fail();return a;}

// Binary stdin: fixed magic + 14 bounded length-prefixed authority fields,
// followed by (1, fixed-name-index, uint32 length, raw bytes), then terminal 2.
// stdout is fixed status/hash/identity JSON only. All failures are silent code 4.
export const nativeBackupOutputPowerShell=String.raw`$ErrorActionPreference='Stop'
try {
Add-Type -ReferencedAssemblies 'System','System.Core','System.Web.Extensions' -TypeDefinition @'
using System;
using System.IO;
using System.Text;
using System.Linq;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Security.AccessControl;
using System.Security.Principal;
using System.Security.Cryptography;
using System.Web.Script.Serialization;
using Microsoft.Win32.SafeHandles;
public static class CastLinkBackupOutput {
 [StructLayout(LayoutKind.Sequential)] struct SA {public int length;public IntPtr descriptor;public int inherit;}
 [StructLayout(LayoutKind.Sequential)] struct INFO {public uint attributes;public System.Runtime.InteropServices.ComTypes.FILETIME creation,access,write;public uint volume,sizeHigh,sizeLow,links,indexHigh,indexLow;}
 [StructLayout(LayoutKind.Sequential)] struct BASIC {public long creation,access,write,change;public uint attributes;}
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateFileW")] static extern SafeFileHandle Open(string p,uint access,uint share,IntPtr security,uint create,uint flags,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateFileW")] static extern SafeFileHandle Create(string p,uint access,uint share,ref SA security,uint create,uint flags,IntPtr template);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true,EntryPoint="CreateDirectoryW")] static extern bool Mkdir(string p,ref SA security);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandle(SafeFileHandle h,out INFO i);
 [DllImport("kernel32.dll",SetLastError=true)] static extern bool GetFileInformationByHandleEx(SafeFileHandle h,int cls,out BASIC b,uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern uint GetFinalPathNameByHandle(SafeFileHandle h,StringBuilder p,uint size,uint flags);
 [DllImport("advapi32.dll")] static extern uint GetSecurityInfo(SafeFileHandle h,int type,uint flags,out IntPtr owner,out IntPtr group,out IntPtr dacl,out IntPtr sacl,out IntPtr sd);
 [DllImport("advapi32.dll")] static extern uint GetSecurityDescriptorLength(IntPtr p);
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint rev,out IntPtr sd,out uint size);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr p);
 static readonly string[] Names={"postgres.dump","web-data.tar","caddy-data.tar","caddy-config.tar","compose.yaml","web.env","postgres.env","livekit.yaml","receipt.json","manifest.json"};
 static readonly UTF8Encoding Utf8=new UTF8Encoding(false,true);
 static readonly JavaScriptSerializer Json=new JavaScriptSerializer {MaxJsonLength=16384};
 static string[] A; static string Sid=WindowsIdentity.GetCurrent().User.Value; static readonly List<IDisposable> Held=new List<IDisposable>();
 static void Fail(){throw new InvalidOperationException("native-backup-output-unverified");}
 static byte[] Exact(Stream s,int size){byte[] b=new byte[size];int pos=0;while(pos<size){int n=s.Read(b,pos,size-pos);if(n<=0)Fail();pos+=n;}return b;}
 static uint U32(Stream s){byte[] b=Exact(s,4);return ((uint)b[0]<<24)|((uint)b[1]<<16)|((uint)b[2]<<8)|b[3];}
 static string Text(Stream s,ref int total){uint n=U32(s);if(n>4096)Fail();total+=4+(int)n;if(total>16384)Fail();string t=Utf8.GetString(Exact(s,(int)n));if(t.IndexOf('\0')>=0)Fail();return t;}
 static string Digest(byte[] b){using(SHA256 h=SHA256.Create())return BitConverter.ToString(h.ComputeHash(b)).Replace("-","").ToLowerInvariant();}
 static string Identity(INFO i){return i.volume.ToString("X8")+":"+i.indexHigh.ToString("X8")+i.indexLow.ToString("X8");}
 static long Size(INFO i){return ((long)i.sizeHigh<<32)|i.sizeLow;}
 static void Private(SafeFileHandle h){IntPtr owner,group,dacl,sacl,sd;if(GetSecurityInfo(h,1,5,out owner,out group,out dacl,out sacl,out sd)!=0)Fail();try{uint n=GetSecurityDescriptorLength(sd);if(n>65536)Fail();byte[] b=new byte[n];Marshal.Copy(sd,b,0,(int)n);RawSecurityDescriptor r=new RawSecurityDescriptor(b,0);if(r.Owner==null||r.Owner.Value!=Sid||(r.ControlFlags&ControlFlags.DiscretionaryAclProtected)==0||r.DiscretionaryAcl==null||r.DiscretionaryAcl.Count!=2)Fail();bool user=false,system=false;foreach(GenericAce item in r.DiscretionaryAcl){CommonAce c=item as CommonAce;if(c==null||c.AceQualifier!=AceQualifier.AccessAllowed||c.IsCallback||(c.AceFlags&AceFlags.Inherited)!=0||c.AccessMask!=0x1F01FF)Fail();if(c.SecurityIdentifier.Value==Sid&&!user)user=true;else if(c.SecurityIdentifier.Value=="S-1-5-18"&&!system)system=true;else Fail();}if(!user||!system)Fail();}finally{LocalFree(sd);}}
 static INFO Inspect(SafeFileHandle h,string p,bool directory){INFO i=new INFO();if(h.IsInvalid||!GetFileInformationByHandle(h,out i)||(i.attributes&0x400)!=0||((i.attributes&0x10)!=0)!=directory||(!directory&&i.links!=1))Fail();StringBuilder b=new StringBuilder(32768);uint n=GetFinalPathNameByHandle(h,b,32768,0);if(n==0||n>=32768||b.ToString()!=@"\\?\"+p)Fail();Private(h);return i;}
 static SafeFileHandle Handle(string p,bool directory){SafeFileHandle h=Open(p,0x20000,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero);Held.Add(h);Inspect(h,p,directory);return h;}
 static INFO Named(string p,bool directory){using(SafeFileHandle h=Open(p,0x20000,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero))return Inspect(h,p,directory);}
 static SA Security(bool directory,out IntPtr sd){uint n;string text="O:"+Sid+"D:P(A;"+(directory?"OICI":"")+";FA;;;"+Sid+")(A;"+(directory?"OICI":"")+";FA;;;SY)";if(!ConvertStringSecurityDescriptorToSecurityDescriptor(text,1,out sd,out n))Fail();return new SA{length=Marshal.SizeOf(typeof(SA)),descriptor=sd,inherit=0};}
 static void Lexical(string p){if(p.Length<4||p.Length>4096||p[0]<'A'||p[0]>'Z'||p[1]!=':'||p[2]!='\\'||Path.GetFullPath(p)!=p)Fail();foreach(string part in p.Substring(3).Split('\\'))if(part.Length==0||part.EndsWith(".")||part.EndsWith(" ")||part.IndexOfAny(Path.GetInvalidFileNameChars())>=0)Fail();}
 static void Canonical(string p){Lexical(p);for(string at=p;at!=null;at=Path.GetDirectoryName(at)){using(SafeFileHandle h=Open(at,0x20000,7,IntPtr.Zero,3,0x02200000,IntPtr.Zero)){INFO i;if(h.IsInvalid||!GetFileInformationByHandle(h,out i)||(i.attributes&0x400)!=0)Fail();}}}
 static bool Overlap(string x,string y){return x.Equals(y,StringComparison.OrdinalIgnoreCase)||x.StartsWith(y+"\\",StringComparison.OrdinalIgnoreCase)||y.StartsWith(x+"\\",StringComparison.OrdinalIgnoreCase);}
 static byte[] ReadPrivate(string p,int cap){using(SafeFileHandle h=Open(p,0x80000000|0x20000,1,IntPtr.Zero,3,0x00200000,IntPtr.Zero)){INFO before=Inspect(h,p,false);if(Size(before)>cap)Fail();using(FileStream f=new FileStream(h,FileAccess.Read)){byte[] b=new byte[(int)Size(before)+1];int size=0,n;while(size<b.Length&&(n=f.Read(b,size,b.Length-size))>0)size+=n;INFO after=Inspect(h,p,false);if(size!=Size(before)||Identity(before)!=Identity(after)||Size(before)!=Size(after)||before.write.dwHighDateTime!=after.write.dwHighDateTime||before.write.dwLowDateTime!=after.write.dwLowDateTime||Identity(Named(p,false))!=Identity(before))Fail();Array.Resize(ref b,size);return b;}}}
 static bool EpochPresent(string p){using(SafeFileHandle h=Open(p,0x20000,7,IntPtr.Zero,3,0x00200000,IntPtr.Zero)){if(h.IsInvalid){if(Marshal.GetLastWin32Error()==2)return false;Fail();}Inspect(h,p,false);return true;}}
 static void CheckLease(){if(Identity(Named(A[2],true))!=A[8]||Identity(Named(Path.Combine(A[2],"active"),true))!=A[9]||Identity(Named(A[1],true))!=A[11]||Identity(Named(Path.Combine(A[2],"active","owner.json"),false))!=A[10])Fail();byte[] owner=ReadPrivate(Path.Combine(A[2],"active","owner.json"),8192);if(Digest(owner)!=A[12])Fail();Dictionary<string,object> o=Json.Deserialize<Dictionary<string,object>>(Utf8.GetString(owner));string[] keys={"root","scope","principal","installationId","engine","endpoint","nonce","protocol","kind","scopeIdentity","rootIdentity"};string[] values={A[1],A[2],A[3],A[4],A[5],A[6],A[7],"castlink-windows-target-operation-v1","backup",A[8],A[11]};for(int i=0;i<keys.Length;i++)if(!o.ContainsKey(keys[i])||!(o[keys[i]] is string)||(string)o[keys[i]]!=values[i])Fail();if(!o.ContainsKey("epoch")||Convert.ToString(o["epoch"],System.Globalization.CultureInfo.InvariantCulture)!=A[13])Fail();string epoch=Path.Combine(A[2],"epoch.json");if(EpochPresent(epoch)){Dictionary<string,object> e=Json.Deserialize<Dictionary<string,object>>(Utf8.GetString(ReadPrivate(epoch,8192)));if(e.Count!=1||!e.ContainsKey("epoch")||Convert.ToString(e["epoch"],System.Globalization.CultureInfo.InvariantCulture)!=A[13])Fail();}else if(A[13]!="0")Fail();}
 static long Cap(int i){return i<4?67108864:i==9?65536:1048576;}
 public static int Run(Stream input,TextWriter output){try{
  if(Utf8.GetString(Exact(input,8))!="CLBKOUT1")Fail();A=new string[14];int total=8;for(int i=0;i<A.Length;i++)A[i]=Text(input,ref total);if(A[3]!=Sid)Fail();long epoch;if(!Int64.TryParse(A[13],out epoch)||epoch<0||epoch>=9007199254740991L)Fail();
  Lexical(A[0]);Canonical(A[1]);Canonical(A[2]);Canonical(Path.GetDirectoryName(A[0]));if(Path.GetFileName(A[2])!=".castlink-target-operations"||Overlap(A[0],A[1])||Overlap(A[0],A[2]))Fail();
  Handle(A[1],true);Handle(A[2],true);Handle(Path.Combine(A[2],"active"),true);CheckLease();string parent=Path.GetDirectoryName(A[0]),parentId=Identity(Named(parent,true));Handle(parent,true);
  IntPtr sd;SA security=Security(true,out sd);try{if(!Mkdir(A[0],ref security))Fail();}finally{LocalFree(sd);}Canonical(A[0]);SafeFileHandle directory=Handle(A[0],true);string directoryId=Identity(Inspect(directory,A[0],true));if(Identity(Named(parent,true))!=parentId)Fail();CheckLease();
  output.WriteLine("{\"schemaVersion\":1,\"status\":\"private-output-open\"}");output.Flush();
  FileStream[] streams=new FileStream[10];INFO[] identities=new INFO[10];BASIC[] basics=new BASIC[10];string[] hashes=new string[10];long[] sizes=new long[10];long aggregate=0;
  for(int expected=0;expected<10;expected++){
   if(input.ReadByte()!=1||input.ReadByte()!=expected)Fail();uint length=U32(input);if(length>Cap(expected)||(aggregate+=length)>273743872L)Fail();CheckLease();if(Identity(Named(A[0],true))!=directoryId)Fail();string file=Path.Combine(A[0],Names[expected]);SA sa=Security(false,out sd);SafeFileHandle h;try{h=Create(file,0xC0000000|0x20000,1,ref sa,1,0x00200000,IntPtr.Zero);}finally{LocalFree(sd);}if(h.IsInvalid)Fail();Held.Add(h);FileStream stream=new FileStream(h,FileAccess.ReadWrite);Held.Add(stream);streams[expected]=stream;byte[] chunk=new byte[65536];uint remaining=length;using(SHA256 hash=SHA256.Create()){while(remaining>0){int n=(int)Math.Min((uint)chunk.Length,remaining);byte[] b=Exact(input,n);stream.Write(b,0,n);hash.TransformBlock(b,0,n,b,0);remaining-=(uint)n;}hash.TransformFinalBlock(new byte[0],0,0);hashes[expected]=BitConverter.ToString(hash.Hash).Replace("-","").ToLowerInvariant();}stream.Flush(true);identities[expected]=Inspect(h,file,false);sizes[expected]=length;if(Size(identities[expected])!=length||Identity(Named(file,false))!=Identity(identities[expected])||!GetFileInformationByHandleEx(h,0,out basics[expected],(uint)Marshal.SizeOf(typeof(BASIC))))Fail();output.WriteLine("{\"schemaVersion\":1,\"status\":\"private-output-held\",\"name\":\""+Names[expected]+"\"}");output.Flush();
  }
  if(input.ReadByte()!=2||input.ReadByte()!=-1)Fail();CheckLease();if(Identity(Named(A[0],true))!=directoryId||!Directory.GetFiles(A[0]).Select(Path.GetFileName).OrderBy(x=>x).SequenceEqual(Names.OrderBy(x=>x))||Directory.GetDirectories(A[0]).Length!=0)Fail();
  List<object> result=new List<object>();for(int i=0;i<10;i++){string file=Path.Combine(A[0],Names[i]);FileStream stream=streams[i];SafeFileHandle h=stream.SafeFileHandle;INFO before=Inspect(h,file,false);BASIC basic=new BASIC();if(Identity(before)!=Identity(identities[i])||Identity(Named(file,false))!=Identity(before)||Size(before)!=sizes[i]||!GetFileInformationByHandleEx(h,0,out basic,(uint)Marshal.SizeOf(typeof(BASIC)))||basic.write!=basics[i].write||basic.change!=basics[i].change)Fail();stream.Position=0;using(SHA256 hash=SHA256.Create()){byte[] b=new byte[65536];long count=0;int n;while((n=stream.Read(b,0,(int)Math.Min(b.Length,sizes[i]+1-count)))>0){count+=n;hash.TransformBlock(b,0,n,b,0);}hash.TransformFinalBlock(new byte[0],0,0);if(count!=sizes[i]||BitConverter.ToString(hash.Hash).Replace("-","").ToLowerInvariant()!=hashes[i])Fail();}INFO after=Inspect(h,file,false);BASIC final;if(Size(after)!=sizes[i]||Identity(Named(file,false))!=Identity(after)||!GetFileInformationByHandleEx(h,0,out final,(uint)Marshal.SizeOf(typeof(BASIC)))||final.write!=basic.write||final.change!=basic.change)Fail();result.Add(new{name=Names[i],bytes=sizes[i],sha256=hashes[i],identity=Identity(after)});}
  CheckLease();if(Identity(Named(parent,true))!=parentId||Identity(Named(A[0],true))!=directoryId||!Directory.GetFiles(A[0]).Select(Path.GetFileName).OrderBy(x=>x).SequenceEqual(Names.OrderBy(x=>x))||Directory.GetDirectories(A[0]).Length!=0)Fail();for(int i=Held.Count-1;i>=0;i--)Held[i].Dispose();Held.Clear();output.WriteLine(Json.Serialize(new{schemaVersion=1,status="private-output-closed",files=result}));output.Flush();return 0;
 }catch{return 4;}finally{for(int i=Held.Count-1;i>=0;i--)try{Held[i].Dispose();}catch{}Held.Clear();}}
}
'@
$code=[CastLinkBackupOutput]::Run([Console]::OpenStandardInput(),[Console]::Out)
exit $code
}catch{exit 4}`;
