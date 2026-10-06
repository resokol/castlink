export const primaryImports={
 'advapi32.dll':['AddAccessAllowedAce','InitializeAcl','InitializeSecurityDescriptor','SetSecurityDescriptorControl','SetSecurityDescriptorDacl','SetSecurityDescriptorOwner','CreateWellKnownSid','EqualSid','GetAce','GetAclInformation','GetSecurityInfo','GetTokenInformation','IsValidSid','OpenProcessToken'],
 'kernel32.dll':['AssignProcessToJobObject','CancelSynchronousIo','CloseHandle','CompareStringOrdinal','CreateFileW','CreateJobObjectW','CreatePipe','CreateProcessW','CreateThread','DeleteCriticalSection','DeleteProcThreadAttributeList','DuplicateHandle','EnterCriticalSection','ExitProcess','FindClose','FindFirstFileW','FindNextFileW','GetCommandLineW','GetCurrentProcess','GetCurrentThread','GetEnvironmentVariableW','GetExitCodeProcess','GetFileInformationByHandle','GetFileType','GetFinalPathNameByHandleW','GetLastError','GetModuleFileNameW','GetStdHandle','GetSystemDirectoryW','GetTickCount64','InitializeCriticalSection','InitializeProcThreadAttributeList','LeaveCriticalSection','LocalFree','MultiByteToWideChar','PeekNamedPipe','QueryInformationJobObject','ReadFile','ResumeThread','SetFilePointerEx','SetHandleInformation','SetInformationJobObject','Sleep','TerminateJobObject','TerminateProcess','UpdateProcThreadAttribute','WaitForSingleObject','WriteFile']
};
for(const names of Object.values(primaryImports))names.sort();
export function auditPrimaryPE(bytes){
 const fail=()=>{throw Error('primary-pe-unverified')};
 try{
  if(!Buffer.isBuffer(bytes)||bytes.length<512||bytes.length>1024*1024)fail();
  const range=(at,n)=>{if(!Number.isSafeInteger(at)||at<0||n<0||at+n>bytes.length)fail();return at};
  const u16=at=>bytes.readUInt16LE(range(at,2)),u32=at=>bytes.readUInt32LE(range(at,4));
  if(bytes.toString('ascii',0,2)!=='MZ')fail();const pe=u32(0x3c);
  if(pe<64||bytes.toString('ascii',range(pe,24),pe+4)!=='PE\0\0'||u16(pe+4)!==0x8664)fail();
  const count=u16(pe+6),optionalBytes=u16(pe+20),characteristics=u16(pe+22),o=pe+24;
  if(count<1||count>8||optionalBytes!==240||(characteristics&2)===0||(characteristics&0x2000)!==0||u16(o)!==0x20b)fail();
  range(o,optionalBytes);if(u16(o+68)!==3||(u16(o+70)&0x160)!==0x160||u32(o+108)!==16)fail();
  const headers=u32(o+60),sections=[],sectionTable=o+optionalBytes;
  if(headers<sectionTable+40*count||headers>bytes.length)fail();
  for(let i=0;i<count;i++){
   const s=sectionTable+i*40;range(s,40);const raw=u32(s+20),size=u32(s+16),virtual=u32(s+12),virtualSize=Math.max(size,u32(s+8)),flags=u32(s+36);
   if(virtual===0||virtualSize===0||virtual+virtualSize>0xffffffff||size&&(raw<headers||raw+size>bytes.length))fail();
   for(const previous of sections)if(virtual<previous.virtual+previous.virtualSize&&previous.virtual<virtual+virtualSize||size&&previous.size&&raw<previous.raw+previous.size&&previous.raw<raw+size)fail();
   sections.push({raw,size,virtual,virtualSize,flags});
  }
  const rva=(value,size)=>{const hits=sections.filter(s=>value>=s.virtual&&value+size<=s.virtual+s.size);if(hits.length!==1)fail();return range(hits[0].raw+value-hits[0].virtual,size)};
  const entry=u32(o+16),entrySection=sections.find(s=>entry>=s.virtual&&entry<s.virtual+s.size);
  if(!entrySection||(entrySection.flags&0x20000000)===0||(entrySection.flags&0x80000000)!==0)fail();
  // No export/resource/manifest/security/TLS/load-config/delay-import/CLR dependency mechanism.
  for(const index of [0,2,4,9,10,13,14])if(u32(o+112+index*8)!==0||u32(o+116+index*8)!==0)fail();
  const importRva=u32(o+120),importSize=u32(o+124);if(importSize<60||importSize>1024)fail();const at=rva(importRva,importSize);
  const text=(value,max)=>{let out='';for(let i=0;i<max;i++){const c=bytes[rva(value+i,1)];if(c===0)return out;if(c<33||c>126)fail();out+=String.fromCharCode(c)}fail()};
  const imports={};let descriptors=0,terminated=false;
  for(let offset=0;offset+20<=importSize;offset+=20){const descriptor=at+offset;if(bytes.subarray(descriptor,descriptor+20).every(x=>x===0)){if(bytes.subarray(descriptor,at+importSize).some(x=>x!==0))fail();terminated=true;break;}
   if(++descriptors>2||u32(descriptor+4)!==0||u32(descriptor+8)!==0)fail();
   const dll=text(u32(descriptor+12),32).toLowerCase(),expected=primaryImports[dll];if(!expected||imports[dll])fail();
   const thunk=u32(descriptor)||u32(descriptor+16),iat=u32(descriptor+16);if(!thunk||!iat)fail();const names=[];let ended=false;
   for(let i=0;i<=expected.length;i++){const value=bytes.readBigUInt64LE(rva(thunk+i*8,8));rva(iat+i*8,8);if(value===0n){ended=true;break;}if(value>0xffffffffn||names.length===expected.length)fail();const name=text(Number(value)+2,128);if(!expected.includes(name)||names.includes(name))fail();names.push(name);}
   if(!ended||JSON.stringify(names.sort())!==JSON.stringify(expected.toSorted()))fail();imports[dll]=names;
  }
  if(!terminated||descriptors!==2)fail();const ordered={};for(const dll of Object.keys(primaryImports))ordered[dll]=imports[dll];
  return{architecture:'x64',format:'PE32+',subsystem:'console',imports:ordered,crt:'none',signing:'unverified'};
 }catch{fail()}
}
