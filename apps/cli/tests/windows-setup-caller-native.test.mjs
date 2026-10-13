import test from 'node:test';
import assert from 'node:assert/strict';
import {spawn,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID} from 'node:crypto';
import {gunzipSync} from 'node:zlib';
import {Script} from 'node:vm';
import path from 'node:path';
import {rm,readdir,lstat,mkdir} from 'node:fs/promises';
import {initializeWindowsSetupTarget,executeSetup,prepareConfig} from '../dist/setup.js';
import {FileStateStore} from '../dist/state.js';
import {windowsConfigurationScopeNode} from '../dist/config-target.js';
import {nodeTargetLeaseObservation} from '../dist/target-operation.js';
import {fixedNodeArguments} from '../dist/fixed-node-program.js';
const native=process.platform==='win32'&&/^D:\\/i.test(process.env.CASTLINK_WINDOWS_PROOF_ROOT??'');
const execute=promisify(execFile),productionKey='Software\\CastLink\\TargetOperations';
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

const release={schemaVersion:1,release:'1.0.0',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(n=>[n,{reference:`example.org/${n}@sha256:${'a'.repeat(64)}`,architectures:['amd64']}]))};
function unpack(r){const m=r.args[1].match(/Buffer.from\('([^']+)','base64'\)/);assert.ok(m);const source=gunzipSync(Buffer.from(m[1],'base64')).toString();assert.deepEqual(r.args,fixedNodeArguments(source,true));return source}
async function fixture(fn){
 const home=path.join(process.env.CASTLINK_WINDOWS_PROOF_ROOT,'caller-'+randomUUID());
 const key='Software\\CastLink\\NativeCallerTests\\'+randomUUID();
 assert.match(key,/^Software\\CastLink\\NativeCallerTests\\[a-f0-9-]{36}$/);
 const profiles=path.join(home,'profiles'),env={...process.env,CASTLINK_PROFILE_ROOT:profiles},prior=process.env.CASTLINK_PROFILE_ROOT;
 async function ps(script,extra={}){const r=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...env,CASTLINK_NATIVE_TEST_KEY:key,...extra},windowsHide:true});assert.equal(r.stderr,'');return r.stdout}
 async function privatePath(p){await ps(createPrivateTestDirectory,{CASTLINK_NATIVE_TEST_PATH:p})}
 function isolated(source){
  if(source.includes('const script=')){
   const m=source.match(/const script=("(?:[^"\\]|\\.)*");/);assert.ok(m);const script=JSON.parse(m[1]);assert.equal(script.split(productionKey).length-1,1);
   source=source.replace(m[0],'const script='+JSON.stringify(script.replace(productionKey,key))+';');
  }else{
   assert.ok(source===windowsConfigurationScopeNode||source===nodeTargetLeaseObservation);
   source=source.replace('const winBridgeSource=','let winBridgeSource=');
   const at=source.indexOf('const leaseFs=');assert.ok(at>=0);
   source=source.slice(0,at)+`if(winBridgeSource.split(${JSON.stringify(productionKey)}).length!==2)throw Error();winBridgeSource=winBridgeSource.replace(${JSON.stringify(productionKey)},${JSON.stringify(key)});\n`+source.slice(at);
   if(source.includes('const configRegistryPresence=')){
    source=source.replace('const configRegistryPresence=','let configRegistryPresence=');
    const at=source.lastIndexOf("try{if(process.platform");assert.ok(at>=0);
    source=source.slice(0,at)+`if(configRegistryPresence.split(${JSON.stringify(productionKey)}).length!==2)throw Error();configRegistryPresence=configRegistryPresence.replace(${JSON.stringify(productionKey)},${JSON.stringify(key)});winEngine=()=>({engine:'fixture-engine',endpoint:'npipe:////./pipe/docker_engine'});\n`+source.slice(at);
   }else{const at=source.lastIndexOf('try{\n if(process.platform');assert.ok(at>=0);source=source.slice(0,at)+"winEngine=()=>({engine:'fixture-engine',endpoint:'npipe:////./pipe/docker_engine'});\n"+source.slice(at)}
  }
  // Both embedded bridges and every registry presence check are redirected.
  // The literal production path remains only as the exact replacement operand.
  assert.ok(source.includes(key)||source.includes(JSON.stringify(key).slice(1,-1)));
  new Script(source,{filename:'isolated-caller-native.cjs'});return source;
 }
 async function run(source,input){return new Promise((resolve,reject)=>{const p=spawn(process.execPath,fixedNodeArguments(source,true),{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr}));p.stdin.end(input)})}
 const calls=[];let stopAfter=Infinity;
 const executor={run:async r=>{assert.equal(r.sensitive,true);const source=unpack(r),kind=source.includes('CASTLINK_SETUP_PROFILE_ROOT')?'profile-root':source===windowsConfigurationScopeNode?'initialize':'observe';calls.push(kind);if(calls.length>stopAfter)return{code:4,stdout:'',stderr:''};return run(isolated(source),r.input)}};
 const store=new FileStateStore(profiles);
 async function acl(p){return JSON.parse(await ps("$i=Get-Item -Force -LiteralPath $env:CASTLINK_NATIVE_TEST_PATH;$a=$i.GetAccessControl();@{owner=$a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value;protected=$a.AreAccessRulesProtected;sddl=$a.GetSecurityDescriptorSddlForm([System.Security.AccessControl.AccessControlSections]'Owner,Access');rules=@($a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])|ForEach-Object{@{sid=$_.IdentityReference.Value;rights=$_.FileSystemRights.ToString();inherited=$_.IsInherited;type=$_.AccessControlType.ToString()}})}|ConvertTo-Json -Depth 4 -Compress",{CASTLINK_NATIVE_TEST_PATH:p}))}
 async function registry(){return ps("$b=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64');try{$k=$b.OpenSubKey($env:CASTLINK_NATIVE_TEST_KEY,$false);try{if(!$k){[Console]::Write('absent')}else{[Console]::Write($k.ValueCount)}}finally{if($k){$k.Dispose()}}}finally{$b.Dispose()}")}
 try{
  process.env.CASTLINK_PROFILE_ROOT=profiles;
  const identity=JSON.parse(await ps("$i=[System.Security.Principal.WindowsIdentity]::GetCurrent();@{sid=$i.User.Value;admin=([System.Security.Principal.WindowsPrincipal]::new($i)).IsInRole([System.Security.Principal.WindowsBuiltInRole]::Administrator)}|ConvertTo-Json -Compress"));assert.equal(identity.admin,false,'Run native caller proof as the non-admin user; no SACL/privilege elevation');
  await privatePath(home);
  await fn({home,profiles,key,store,executor,calls,identity,privatePath,ps,acl,registry,isolated,run,stop:n=>stopAfter=n});
 }finally{
  if(prior===undefined)delete process.env.CASTLINK_PROFILE_ROOT;else process.env.CASTLINK_PROFILE_ROOT=prior;
  await ps("$k=$env:CASTLINK_NATIVE_TEST_KEY;if($k -notmatch '^Software\\\\CastLink\\\\NativeCallerTests\\\\[a-f0-9-]{36}$'){exit 4};$b=[Microsoft.Win32.RegistryKey]::OpenBaseKey('CurrentUser','Registry64');try{$b.DeleteSubKeyTree($k,$false)}finally{$b.Dispose()}");
  await rm(home,{recursive:true,force:true});
 }
}
test('native caller helper creates absent profile root atomically private then initializes isolated HKCU',{skip:!native},()=>fixture(async f=>{
 await initializeWindowsSetupTarget(f.executor,f.store);assert.deepEqual(f.calls,['profile-root','initialize']);
 const acl=await f.acl(f.profiles);assert.equal(acl.protected,true);assert.equal(acl.owner,f.identity.sid);assert.deepEqual(acl.rules.map(r=>r.sid).sort(),[f.identity.sid,'S-1-5-18'].sort());assert.ok(acl.rules.every(r=>r.rights==='FullControl'&&!r.inherited&&r.type==='Allow'));
 assert.deepEqual(await readdir(f.profiles),['.castlink-target-operations']);assert.equal(await f.registry(),'3');
}));
test('native caller refuses existing unsafe profile DACL without repair or HKCU reservation',{skip:!native},()=>fixture(async f=>{
 await mkdir(f.profiles);const before=await f.acl(f.profiles);assert.equal(before.protected,false);
 await assert.rejects(initializeWindowsSetupTarget(f.executor,f.store),e=>e.code===4&&/HKCU/.test(e.message));assert.deepEqual(await f.acl(f.profiles),before);assert.equal(await f.registry(),'absent');assert.deepEqual(f.calls,['profile-root']);assert.deepEqual(await readdir(f.profiles),[]);
}));
test('native caller retains partial HKCU and does not recreate removed profile root',{skip:!native},()=>fixture(async f=>{
 await f.privatePath(f.profiles);let source=f.isolated(windowsConfigurationScopeNode);const at=source.lastIndexOf("try{if(process.platform");assert.ok(at>=0);source=source.slice(0,at)+"winBridgeSource=winBridgeSource.replace('[CastLinkPrivate]::ReserveRegistry($registryName)',\"[CastLinkPrivate]::ReserveRegistry($registryName);throw 'caller-partial-fixture'\");\n"+source.slice(at);
 const partial=await f.run(source);assert.equal(partial.code,4);assert.equal(partial.stdout+partial.stderr,'');assert.equal(await f.registry(),'0');await rm(f.profiles,{recursive:true});
 await assert.rejects(initializeWindowsSetupTarget(f.executor,f.store),e=>e.code===4);assert.equal(await f.registry(),'0');assert.equal(await lstat(f.profiles).then(()=>true,()=>false),false);assert.deepEqual(f.calls,['profile-root','initialize']);
}));
for(const caller of ['default','standalone'])test(`native ${caller} setup runs actual root helper, initializer and cursor in order before controlled refusal`,{skip:!native},()=>fixture(async f=>{
 const plan={schemaVersion:1,request:{profile:'studio',target:{kind:'local'},network:'loopback',root:path.join(f.home,'bundle'),release:'1.0.0'},steps:['preflight','runtime','release','config','services','migrations','seed','owner','verify'],blockers:[]},options={release,architecture:'amd64',bindIPv4:'127.0.0.1',journalDirectory:path.join(f.home,'journal')};
 f.stop(3);await assert.rejects(caller==='default'?executeSetup(plan,f.executor,f.store,options):prepareConfig(plan,options,f.executor,f.store),e=>e.code===4);
 assert.deepEqual(f.calls.slice(0,3),['profile-root','initialize','observe']);assert.equal(await f.registry(),'3');assert.deepEqual(await readdir(f.profiles),['.castlink-target-operations']);assert.equal(await lstat(plan.request.root).then(()=>true,()=>false),false);assert.equal(await lstat(options.journalDirectory).then(()=>true,()=>false),false);
}));
test('native caller private root compile gate refuses before directory or registry mutation',{skip:!native},()=>fixture(async f=>{
 const executor={run:async r=>{const source=f.isolated(unpack(r));assert.match(source,/public static class CastLinkSetupDirectory/);return f.run(source.replace('public static class CastLinkSetupDirectory','public static class !CastLinkSetupDirectory'),r.input)}};
 await assert.rejects(initializeWindowsSetupTarget(executor,f.store),e=>e.code===4);assert.equal(await f.registry(),'absent');assert.equal(await lstat(f.profiles).then(()=>true,()=>false),false);
}));
