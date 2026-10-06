import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';
const api=await import('../dist/windows-target-lease.js').catch(()=>({}));
function run(source,input){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,['-e',source],{stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr}));p.stdin.end(input);});}
test('native Windows fixed initialization refuses a non-Windows runtime without effects or secret output',{skip:process.platform==='win32'},async()=>{assert.equal(typeof api.windowsTargetScopeInitializer,'string');const r=await run(api.windowsTargetScopeInitializer);assert.equal(r.code,4);assert.equal(r.stdout+r.stderr,'');});
test('native Windows lease does not replace or relax installed Unix/Windows fixed-guard admission',async()=>{const old=await import('../dist/target-operation.js');assert.match(old.nodeTargetLease,/process\.platform==='win32'/);assert.equal(typeof api.windowsTargetLeaseObservation,'string');});

// Native proof uses an isolated test-only source namespace, never the production
// locator. The test path must be an explicitly supplied D: private proof root.
import {readFile,lstat,rm} from 'node:fs/promises';import path from 'node:path';import {randomUUID} from 'node:crypto';import {promisify} from 'node:util';import {execFile} from 'node:child_process';
const execute=promisify(execFile),native=process.platform==='win32'&&/^D:\\/i.test(process.env.CASTLINK_WINDOWS_PROOF_ROOT??'');
function launch(source,env=process.env){const p=spawn(process.execPath,['-e',source],{env,stdio:['ignore','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);const done=new Promise((resolve,reject)=>{p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr}));});return{p,done};}
// Test-only atomic creation. Never read/reapply an existing full descriptor:
// copying its audit section would request SeSecurityPrivilege on ordinary users.
const createPrivateTestDirectory=String.raw`
$ErrorActionPreference='Stop'
Add-Type -TypeDefinition @'
using System;using System.Runtime.InteropServices;using System.ComponentModel;
public static class CastLinkTestDirectory {
 [StructLayout(LayoutKind.Sequential)] struct SA {public int length;public IntPtr descriptor;public int inherit;}
 [DllImport("advapi32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool ConvertStringSecurityDescriptorToSecurityDescriptor(string text,uint revision,out IntPtr descriptor,out uint size);
 [DllImport("kernel32.dll",CharSet=CharSet.Unicode,SetLastError=true)] static extern bool CreateDirectory(string path,ref SA security);
 [DllImport("kernel32.dll")] static extern IntPtr LocalFree(IntPtr descriptor);
 public static void Create(string path,string sid){IntPtr descriptor;uint size;string sddl="O:"+sid+"D:P(A;OICI;FA;;;"+sid+")(A;OICI;FA;;;SY)";if(!ConvertStringSecurityDescriptorToSecurityDescriptor(sddl,1,out descriptor,out size))throw new Win32Exception(Marshal.GetLastWin32Error());try{SA security=new SA{length=Marshal.SizeOf(typeof(SA)),descriptor=descriptor,inherit=0};if(!CreateDirectory(path,ref security))throw new Win32Exception(Marshal.GetLastWin32Error());}finally{LocalFree(descriptor);}}
}
'@
[CastLinkTestDirectory]::Create($env:CASTLINK_NATIVE_TEST_PATH,[System.Security.Principal.WindowsIdentity]::GetCurrent().User.Value)
`;
async function privatePath(p){await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',createPrivateTestDirectory],{env:{...process.env,CASTLINK_NATIVE_TEST_PATH:p},windowsHide:true});}
async function fixture(fn){
 const home=path.join(process.env.CASTLINK_WINDOWS_PROOF_ROOT,'native-lease-'+randomUUID()),key='Software\\CastLink\\NativeLeaseTests\\'+randomUUID();
 try{await privatePath(home);const base=path.join(home,'profiles'),root=path.join(home,'installation');for(const p of [base,root]){await privatePath(p)}
 const env={...process.env,CASTLINK_PROFILE_ROOT:base};
 const prefix=api.nativeWindowsTargetLease.replace('const winBridgeSource=','let winBridgeSource=')+`\nconst productionLocator=${JSON.stringify('Software\\CastLink\\TargetOperations')};if(!winBridgeSource.includes(productionLocator))throw Error('fixture namespace missing');winBridgeSource=winBridgeSource.replace(productionLocator,${JSON.stringify(key)});if(winBridgeSource.includes(productionLocator))throw Error('fixture namespace not isolated');\n`;
 const source=body=>prefix+`try{${body}}catch{process.exitCode=4}`;
 const invoke=async(body,selected=env)=>launch(source(body),selected).done;
 const init=await invoke(`console.log(JSON.stringify(winBridge({action:'initialize'})));`);assert.equal(init.code,0,init.stderr);const identity=JSON.parse(init.stdout);assert.match(identity.principal,/^S-1-/);assert.match(identity.scope,/^D:\\/i);
 const observed=await invoke(`console.log(JSON.stringify(winInspect(${JSON.stringify(root)},true)));`);assert.equal(observed.code,0);const canonical=JSON.parse(observed.stdout).path;
 const a={schemaVersion:1,root:canonical,installationId:'12345678-1234-4123-8123-123456789abc',engine:'fixture-engine',kind:'start',epoch:0,principal:identity.principal,scope:identity.scope};
 const program=body=>source(`winEngine=()=>({engine:'fixture-engine',endpoint:'npipe:////./pipe/docker_engine'});const a=${JSON.stringify(a)};${body}`);
 await fn({home,key,base,root,env,identity,a,source,invoke,program});
 }finally{await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$ErrorActionPreference='Stop';$k=$env:CASTLINK_NATIVE_TEST_KEY;if($k -notmatch '^Software\\\\CastLink\\\\NativeLeaseTests\\\\[a-f0-9-]{36}$'){exit 4};$b=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64');try{$b.DeleteSubKeyTree($k,$false)}finally{$b.Dispose()}"],{env:{...process.env,CASTLINK_NATIVE_TEST_KEY:key},windowsHide:true});await rm(home,{recursive:true,force:true})}
}
test('Windows native private SID scope ignores later profile/env aliases and reinitialization refuses',{skip:!native},()=>fixture(async f=>{
 const other=path.join(f.home,'other');await privatePath(other);const r=await f.invoke(`console.log(JSON.stringify(winIdentity()));`,{...f.env,CASTLINK_PROFILE_ROOT:other});assert.equal(r.code,0);assert.deepEqual(JSON.parse(r.stdout),f.identity);assert.equal((await f.invoke(`winBridge({action:'initialize'});`)).code,4);
}));
test('Windows native terminal proof advances exact private epoch and stale generation refuses',{skip:!native},()=>fixture(async f=>{
 const r=await launch(f.program(`const l=acquireWindowsTargetOperation(a);dispatchWindowsTargetOperation(l);releaseWindowsTargetOperation(l,true);`),f.env).done;assert.equal(r.code,0,r.stderr);assert.equal(r.stdout+r.stderr,'');assert.equal(JSON.parse(await readFile(path.join(f.identity.scope,'epoch.json'))).epoch,1);await assert.rejects(lstat(path.join(f.identity.scope,'active')),e=>e.code==='ENOENT');assert.equal((await launch(f.program(`acquireWindowsTargetOperation(a);`),f.env).done).code,4);
}));
test('Windows native competing profile/process and lost owner block further mutation',{skip:!native},()=>fixture(async f=>{
 const first=launch(f.program(`const l=acquireWindowsTargetOperation(a);dispatchWindowsTargetOperation(l);console.log('HELD');setInterval(()=>{},1000);`),f.env);await new Promise((resolve,reject)=>{first.p.stdout.once('data',resolve);first.p.once('exit',()=>reject(Error('owner failed before admission')))});
 try{assert.equal((await launch(f.program(`acquireWindowsTargetOperation({...a,installationId:'99999999-9999-4999-8999-999999999999'});winFs.writeFileSync(${JSON.stringify(path.join(f.home,'unsafe'))},'unsafe');`),f.env).done).code,4);}finally{first.p.kill();await first.done}
 assert.equal((await launch(f.program(`acquireWindowsTargetOperation(a);`),f.env).done).code,4);await assert.rejects(lstat(path.join(f.home,'unsafe')),e=>e.code==='ENOENT');assert.ok(await lstat(path.join(f.identity.scope,'active','owner.json')));
}));
for(const tamper of ['partial','replacement','hardlink'])test(`Windows native ${tamper} private owner refuses POST and retains active reservation`,{skip:!native},()=>fixture(async f=>{
 const owner=path.join(f.identity.scope,'active','owner.json');let mutation;
 if(tamper==='partial')mutation=`winFs.writeFileSync(${JSON.stringify(owner)},'{');if(winFs.readFileSync(${JSON.stringify(owner)},'utf8')!=='{')throw Error('tamper absent');`;
 if(tamper==='replacement')mutation=`const b=winFs.readFileSync(${JSON.stringify(owner)});winFs.unlinkSync(${JSON.stringify(owner)});winBridge({action:'write',principal:a.principal,scope:a.scope,path:${JSON.stringify(owner)},bytes:b.toString('base64')});if(winInspect(${JSON.stringify(owner)},false,l.identity).identity===l.ownerRecord.identity)throw Error('replacement absent');if(!winSame(winRecord(${JSON.stringify(owner)},l.identity),l.owner))throw Error('replacement contents changed');`;
 if(tamper==='hardlink')mutation=`winFs.linkSync(${JSON.stringify(owner)},${JSON.stringify(path.join(f.identity.scope,'owner-link'))});const o=winFs.lstatSync(${JSON.stringify(owner)}),h=winFs.lstatSync(${JSON.stringify(path.join(f.identity.scope,'owner-link'))});if(o.nlink!==2||h.nlink!==2||o.ino!==h.ino||o.dev!==h.dev)throw Error('hardlink absent');`;
 const r=await launch(f.program(`const l=acquireWindowsTargetOperation(a);dispatchWindowsTargetOperation(l);${mutation}console.log('TAMPERED');releaseWindowsTargetOperation(l,true);`),f.env).done;assert.equal(r.code,4);assert.equal(r.stdout.trim(),'TAMPERED');assert.equal(r.stderr,'');assert.ok(await lstat(path.join(f.identity.scope,'active')));await assert.rejects(lstat(path.join(f.identity.scope,'epoch.json')),e=>e.code==='ENOENT');
}));
for(const field of ['principal','scope'])test(`Windows native frozen ${field} mismatch refuses before reservation`,{skip:!native},()=>fixture(async f=>{
 const mutation=field==='principal'?`a.principal='S-1-5-21-1-2-3-999';`:`a.scope=${JSON.stringify(path.join(f.home,'foreign','.castlink-target-operations'))};`;
 const r=await launch(f.program(`${mutation}acquireWindowsTargetOperation(a);`),f.env).done;assert.equal(r.code,4);assert.equal(r.stdout+r.stderr,'');await assert.rejects(lstat(path.join(f.identity.scope,'active')),e=>e.code==='ENOENT');
}));
test('Windows partial immutable locator refuses observation and reinitialization without repair',{skip:!native},()=>fixture(async f=>{
 await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$b=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64');try{$k=$b.OpenSubKey($env:CASTLINK_NATIVE_TEST_KEY,$true);try{$k.DeleteValue('scope');$k.Flush()}finally{$k.Dispose()}}finally{$b.Dispose()}"],{env:{...f.env,CASTLINK_NATIVE_TEST_KEY:f.key},windowsHide:true});
 assert.equal((await f.invoke(`winIdentity();`)).code,4);assert.equal((await f.invoke(`winBridge({action:'initialize'});`)).code,4);assert.ok(await lstat(f.identity.scope));
}));
test('Windows native foreign DACL entry refuses held POST without removing reservation',{skip:!native},()=>fixture(async f=>{
 const active=path.join(f.identity.scope,'active'),tamper=String.raw`$ErrorActionPreference='Stop';$item=[IO.DirectoryInfo]::new($env:CASTLINK_NATIVE_TEST_PATH);$a=$item.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access);$rule=[System.Security.AccessControl.FileSystemAccessRule]::new([System.Security.Principal.SecurityIdentifier]::new('S-1-1-0'),'Read','Allow');$a.AddAccessRule($rule);$item.SetAccessControl($a);$after=$item.GetAccessControl([System.Security.AccessControl.AccessControlSections]::Access);$seen=@($after.GetAccessRules($true,$false,[System.Security.Principal.SecurityIdentifier])|Where-Object {$_.IdentityReference.Value -eq 'S-1-1-0' -and !$_.IsInherited -and $_.AccessControlType -eq 'Allow' -and $_.FileSystemRights -eq $rule.FileSystemRights});if(!$after.AreAccessRulesProtected -or $seen.Count -ne 1){throw 'tamper not observed'}`;
 const r=await launch(f.program(`const l=acquireWindowsTargetOperation(a);dispatchWindowsTargetOperation(l);winChild.execFileSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',${JSON.stringify(tamper)}],{env:{...process.env,CASTLINK_NATIVE_TEST_PATH:${JSON.stringify(active)}},windowsHide:true,stdio:['ignore','pipe','pipe']});console.log('TAMPERED');releaseWindowsTargetOperation(l,true);`),f.env).done;
 assert.equal(r.code,4);assert.equal(r.stdout.trim(),'TAMPERED');assert.equal(r.stderr,'');assert.ok(await lstat(active));await assert.rejects(lstat(path.join(f.identity.scope,'epoch.json')),e=>e.code==='ENOENT');
}));
test('Windows simultaneous first-use reservation chooses one immutable domain',{skip:!native},()=>fixture(async f=>{
 await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',"$b=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64');try{$b.DeleteSubKeyTree($env:CASTLINK_NATIVE_TEST_KEY,$false)}finally{$b.Dispose()}"],{env:{...f.env,CASTLINK_NATIVE_TEST_KEY:f.key},windowsHide:true});await rm(f.identity.scope,{recursive:true});const other=path.join(f.home,'second-profiles');await privatePath(other);
 const results=await Promise.all([f.invoke(`console.log(JSON.stringify(winBridge({action:'initialize'})));`),f.invoke(`console.log(JSON.stringify(winBridge({action:'initialize'})));`,{...f.env,CASTLINK_PROFILE_ROOT:other})]);assert.deepEqual(results.map(r=>r.code).sort(),[0,4]);const winner=JSON.parse(results.find(r=>r.code===0).stdout),observation=await f.invoke(`console.log(JSON.stringify(winIdentity()));`,{...f.env,CASTLINK_PROFILE_ROOT:other});assert.equal(observation.code,0);assert.deepEqual(JSON.parse(observation.stdout),winner);const absent=winner.scope===f.identity.scope?path.join(other,'.castlink-target-operations'):f.identity.scope;await assert.rejects(lstat(absent),e=>e.code==='ENOENT');
}));
test('Windows native reparse reservation replacement refuses POST and preserves uncertainty',{skip:!native},()=>fixture(async f=>{
 const active=path.join(f.identity.scope,'active'),moved=path.join(f.identity.scope,'replaced');const r=await launch(f.program(`const l=acquireWindowsTargetOperation(a);dispatchWindowsTargetOperation(l);winFs.renameSync(${JSON.stringify(active)},${JSON.stringify(moved)});winFs.symlinkSync(${JSON.stringify(moved)},${JSON.stringify(active)},'junction');releaseWindowsTargetOperation(l,true);`),f.env).done;assert.equal(r.code,4);assert.equal(r.stdout+r.stderr,'');assert.equal((await lstat(active)).isSymbolicLink(),true);assert.ok(await lstat(path.join(moved,'owner.json')));await assert.rejects(lstat(path.join(f.identity.scope,'epoch.json')),e=>e.code==='ENOENT');
}));
test('native authority comparison accepts reordered bridge metadata but rejects extra or changed authority',async()=>{
 assert.equal(typeof api.nativeWindowsTargetLease,'string');const source=api.nativeWindowsTargetLease+`const a={principal:'S-1-5-21-1-2-3-4',scope:'D:\\private',scopeIdentity:'00000001:0000000000000002'},same={scopeIdentity:a.scopeIdentity,scope:a.scope,principal:a.principal};console.log(JSON.stringify({same:winSame(a,same),extra:winSame(a,{...same,unknown:true}),changed:winSame(a,{...same,principal:'S-1-5-21-1-2-3-5'})}));`;
 const result=await run(source);assert.equal(result.code,0);assert.deepEqual(JSON.parse(result.stdout),{same:true,extra:false,changed:false});
});
import os from 'node:os';import {mkdtemp,writeFile} from 'node:fs/promises';
for(const mode of ['engine-exit','engine-json','endpoint-exit','endpoint-json'])test(`native engine ${mode} normalizes actual child secret bytes at handler seam`,async()=>{
 const parent=process.platform==='win32'?(process.env.CASTLINK_WINDOWS_PROOF_ROOT??os.tmpdir()):os.tmpdir(),dir=await mkdtemp(path.join(parent,'native-engine-')),file=path.join(dir,'docker.cjs');try{
 await writeFile(file,`const mode=process.argv[2],phase=process.argv[3];if(mode===phase+'-exit'){process.stdout.write('PRIVATE_ENGINE_SENTINEL');process.stderr.write('PRIVATE_ENGINE_SENTINEL');process.exit(13)}if(mode===phase+'-json'){process.stdout.write('PRIVATE_ENGINE_SENTINEL');process.exit(0)}console.log(JSON.stringify(phase==='engine'?{ID:'fixture-engine'}:'npipe:////./pipe/docker_engine'));`);
 const source=api.nativeWindowsTargetLease+`const actual=winChild.execFileSync;winChild.execFileSync=(exe,args,options)=>actual(process.execPath,[${JSON.stringify(file)},${JSON.stringify(mode)},args[0]==='info'?'engine':'endpoint'],options);try{winEngine();console.log(JSON.stringify({unexpectedSuccess:true}));}catch(e){console.log(JSON.stringify({diagnosis:e.message}));}`;
 const result=await run(source);assert.equal(result.code,0);assert.equal(result.stderr,'');assert.deepEqual(JSON.parse(result.stdout),{diagnosis:'native-target-private-unverified'});assert.equal((result.stdout+result.stderr).includes('PRIVATE_ENGINE_SENTINEL'),false);
 }finally{await rm(dir,{recursive:true,force:true})}
});
