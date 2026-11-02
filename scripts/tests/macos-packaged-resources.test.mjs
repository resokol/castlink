import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {verifyMacPackagedResources} from '../macos-packaged-resources.mjs';
const require=createRequire(import.meta.url);
const {MAC_PYTHON_RUNTIMES,PYTHON_RELEASE}=require('../../apps/desktop/scripts/macos-python-runtime.cjs');
const {MAC_SETUP_SOURCE_FILES}=require('../../apps/desktop/scripts/macos-setup-resources.cjs');
const {ICNS_ENTRIES,CASTLINK_ICON_SOURCE}=require('../../apps/desktop/scripts/macos-icon.cjs');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
function iconBytes(){
 const chunks=[];
 for(const [type,size]of Object.entries(ICNS_ENTRIES)){
  const png=Buffer.alloc(58);Buffer.from('89504e470d0a1a0a','hex').copy(png);png.writeUInt32BE(13,8);png.write('IHDR',12);png.writeUInt32BE(size,16);png.writeUInt32BE(size,20);png[24]=8;png[25]=6;png.writeUInt32BE(1,33);png.write('IDAT',37);png.write('IEND',50);
  const header=Buffer.alloc(8);header.write(type);header.writeUInt32BE(8+png.length,4);chunks.push(header,png);
 }
 const body=Buffer.concat(chunks),header=Buffer.alloc(8);header.write('icns');header.writeUInt32BE(body.length+8,4);return Buffer.concat([header,body]);
}
function fixture(t,arch='arm64'){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-packaged-resources-'));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bundle=path.join(root,'CastLink.app'),resources=path.join(bundle,'Contents/Resources'),calls=[],commit='a'.repeat(40),pin=MAC_PYTHON_RUNTIMES[arch];
 function put(relative,body='fixture',mode=0o644){const target=path.join(bundle,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,body,{mode});fs.chmodSync(target,mode);return target;}
 const executable=put('Contents/MacOS/CastLink Client Development','executable',0o755);
 put('Contents/Info.plist','plist');
 const icns=iconBytes(),sourceSvg=fs.readFileSync(fileURLToPath(new URL('../../apps/desktop/assets/castlink-icon.svg',import.meta.url)));
 put('Contents/Resources/icon.icns',icns);
 put('Contents/Resources/castlink-icon.json',JSON.stringify({schemaVersion:1,source:CASTLINK_ICON_SOURCE,sourceSha256:hash(sourceSvg),sha256:hash(icns),format:'icns',converter:'electron-builder@26.15.3/icons@1.1.0',sizes:[16,32,64,128,256,512,1024]}));
 put('Contents/Resources/app.asar');
 for(const file of ['process-audio/CastLink.ProcessAudio','remote-input/CastLink.RemoteInput','window-slides/CastLink.WindowSlides','powerpoint/CastLink.PowerPointIdentity','registration/CastLink.ProtocolRegistration'])put('Contents/Resources/'+file,'helper',0o755);
 put('Contents/Resources/powerpoint/PowerPoint.js','JXA script');
 const files={};
 for(const relative of [...MAC_SETUP_SOURCE_FILES,'node_modules/ssh2/package.json']){
  const body=relative==='node_modules/ssh2/package.json'?JSON.stringify({name:'ssh2',version:'1.17.0'}):'source '+relative;
  put('Contents/Resources/setup/'+relative,body);files[relative]={sha256:hash(body),size:Buffer.byteLength(body)};
 }
 const source={schemaVersion:1,platform:'darwin',sourceCommit:commit,files,packages:{ssh2:'1.17.0'}};
 const python={schemaVersion:1,provider:'astral-sh/python-build-standalone',release:PYTHON_RELEASE,version:pin.version,platform:'darwin',arch,url:pin.url,sha256:pin.sha256,executable:'setup/python/bin/python3',license:'setup/python/lib/python3.12/LICENSE.txt',runtimeValidated:true};
 put('Contents/Resources/setup/manifest.json',JSON.stringify(source));
 put('Contents/Resources/setup/python/runtime-manifest.json',JSON.stringify(python));
 put('Contents/Resources/setup/python/bin/python3.12','python executable',0o755);
 fs.symlinkSync('python3.12',path.join(resources,'setup/python/bin/python3'));
 put('Contents/Resources/setup/python/lib/python3.12/LICENSE.txt','Python Software Foundation license '.repeat(10));
 const closure={platform:'darwin',arch,sourceCommit:commit,pythonRuntime:python,packages:source.packages,sshLoaded:true,transportLoaded:true};
 const f={bundle,resources,executable,arch,calls,source,python,closure,override:null,put};
 f.run=(file,args,options)=>{
  calls.push({file,args,options});const overridden=f.override?.(file,args,options);if(overridden!==undefined)return overridden;
  if(file==='/usr/bin/codesign')return '';
  if(file==='/usr/libexec/PlistBuddy')return 'icon.icns\n';
  if(file==='/usr/bin/lipo')return (arch==='x64'?'x86_64':'arm64')+'\n';
  if(file.endsWith('CastLink.ProcessAudio'))return JSON.stringify({protocol:'CLPA0001',sampleRate:48000,channels:2,maxPacketFrames:4800});
  if(file.endsWith('CastLink.WindowSlides')||file.endsWith('CastLink.PowerPointIdentity'))return JSON.stringify({protocol:1,selfTest:'passed',osOperationVerified:false});
  if(file.endsWith('CastLink.ProtocolRegistration'))return JSON.stringify({protocol:1,selfTest:'passed',schemes:['castlink','castlink-remote','castlink-presenter','castlink-share'],registrationPerformed:false,osOperationVerified:false});
  if(file.endsWith('CastLink.RemoteInput'))return JSON.stringify({id:1,ok:true,state:{resourceVersion:'CastLink.RemoteInput/full-input-pause/2',captureId:null,active:false,ready:false,pointerReady:false,stopped:true,needsEmptyReset:true,geometry:{width:1,height:1,revision:1}}})+'\n';
  if(file.endsWith('/python3'))return JSON.stringify({version:pin.version,machine:arch==='x64'?'x86_64':'arm64',system:'Darwin'});
  if(file===executable)return JSON.stringify(closure);
  assert.fail('Unexpected command: '+file);
 };
 return f;
}
for(const arch of ['arm64','x64'])test(`verifies the signed final ${arch} resources using bounded passive commands`,async t=>{
 const f=fixture(t,arch),result=await verifyMacPackagedResources({bundle:f.bundle,arch,run:f.run});
 assert.equal(result.status,'PASS');assert.equal(result.arch,arch);assert.equal(result.sourceCommit,'a'.repeat(40));assert.equal(result.osOperationVerified,false);assert.equal(result.branding,'PASS');
 assert.deepEqual(f.calls[0].args,['--verify','--deep','--strict',f.bundle]);assert.equal(f.calls[0].file,'/usr/bin/codesign');
 assert.equal(f.calls.filter(call=>call.file==='/usr/bin/lipo').length,7);
 assert.equal(f.calls.filter(call=>call.args[0]==='--self-test').length,4);
 const input=f.calls.find(call=>call.file.endsWith('CastLink.RemoteInput'));
 assert.deepEqual(input.args,[]);assert.deepEqual(JSON.parse(input.options.input),{id:1,op:'stop'});
 assert.ok(f.calls.every(call=>call.options.shell===false&&call.options.timeout>0&&call.options.timeout<=30000&&call.options.maxBuffer<=1048576&&call.options.killSignal==='SIGKILL'));
 const python=f.calls.find(call=>call.file.endsWith('/python3'));assert.deepEqual(python.args.slice(0,3),['-I','-B','-c']);assert.match(python.args[3],/ssl,sqlite3,subprocess,urllib.request,pathlib/);
 const electron=f.calls.find(call=>call.file===f.executable);assert.equal(electron.options.env.ELECTRON_RUN_AS_NODE,'1');assert.match(electron.args[1],/app\.asar/);assert.match(electron.args[1],/node_modules\/ssh2/);
});
test('rejects code signature failures before executing resource programs',async t=>{
 const f=fixture(t);f.override=file=>{if(file==='/usr/bin/codesign')throw Error('invalid nested signature');};
 await assert.rejects(verifyMacPackagedResources({bundle:f.bundle,arch:f.arch,run:f.run}),/invalid nested signature/);assert.equal(f.calls.length,1);
});
test('rejects fallback icons and changed CastLink provenance in the final bundle',async t=>{
 for(const corruption of ['reference','source','artifact']){
  const f=fixture(t);
  if(corruption==='reference')f.override=file=>file==='/usr/libexec/PlistBuddy'?'electron.icns':undefined;
  else{
   const manifest=JSON.parse(fs.readFileSync(path.join(f.resources,'castlink-icon.json')));
   manifest[corruption==='source'?'sourceSha256':'sha256']='b'.repeat(64);
   f.put('Contents/Resources/castlink-icon.json',JSON.stringify(manifest));
  }
  await assert.rejects(verifyMacPackagedResources({bundle:f.bundle,arch:f.arch,run:f.run}),/icon.*configured|icon.*provenance/i,corruption);
 }
});
test('rejects any helper architecture and protocol mismatch',async t=>{
 for(const target of ['lipo','audio','slides','powerpoint','input','registration']){
  const f=fixture(t);f.override=(file,args)=>{
   if(target==='lipo'&&file==='/usr/bin/lipo'&&args[1].endsWith('CastLink.RemoteInput'))return 'x86_64';
   if(target==='audio'&&file.endsWith('CastLink.ProcessAudio'))return JSON.stringify({protocol:'CLPA0002',sampleRate:48000,channels:2,maxPacketFrames:4800});
   if(target==='slides'&&file.endsWith('CastLink.WindowSlides')||target==='powerpoint'&&file.endsWith('CastLink.PowerPointIdentity'))return JSON.stringify({protocol:2,selfTest:'passed',osOperationVerified:false});
   if(target==='input'&&file.endsWith('CastLink.RemoteInput'))return JSON.stringify({id:1,ok:true,state:{resourceVersion:'old',active:true,stopped:false}});
   if(target==='registration'&&file.endsWith('CastLink.ProtocolRegistration'))return JSON.stringify({protocol:1,selfTest:'passed',schemes:['castlink','castlink-remote','castlink-presenter','castlink-share'],registrationPerformed:true,osOperationVerified:false});
  };
  await assert.rejects(verifyMacPackagedResources({bundle:f.bundle,arch:f.arch,run:f.run}),/architecture|protocol/i,target);
 }
});
test('rejects modified setup sources, unexpected files and unsafe manifest paths',async t=>{
 for(const corruption of ['hash','extra','traversal']){
  const f=fixture(t);
  if(corruption==='hash')f.put('Contents/Resources/setup/scripts/macos-compose-setup.py','modified');
  if(corruption==='extra')f.put('Contents/Resources/setup/node_modules/unlisted.js','extra');
  if(corruption==='traversal'){f.source.files['../escape']={sha256:'a'.repeat(64),size:1};f.put('Contents/Resources/setup/manifest.json',JSON.stringify(f.source));}
  await assert.rejects(verifyMacPackagedResources({bundle:f.bundle,arch:f.arch,run:f.run}),/manifest|integrity|unlisted|Unsafe/i,corruption);
 }
});
test('rejects runtime pin changes and a Python symlink escaping the bundled runtime',async t=>{
 for(const corruption of ['pin','link','stdlib-link']){
  const f=fixture(t);
  if(corruption==='pin'){f.python.sha256='b'.repeat(64);f.put('Contents/Resources/setup/python/runtime-manifest.json',JSON.stringify(f.python));}
  else if(corruption==='link'){fs.unlinkSync(path.join(f.resources,'setup/python/bin/python3'));fs.symlinkSync(f.executable,path.join(f.resources,'setup/python/bin/python3'));}
  else fs.symlinkSync(f.executable,path.join(f.resources,'setup/python/lib/external'));
  await assert.rejects(verifyMacPackagedResources({bundle:f.bundle,arch:f.arch,run:f.run}),/Python.*manifest|escape/i,corruption);
 }
});
test('rejects final Python identity and packaged Electron closure mismatches',async t=>{
 for(const corruption of ['python','source','arch','closure','runtime']){
  const f=fixture(t);
  if(corruption==='python')f.override=file=>file.endsWith('/python3')?JSON.stringify({version:'3.11.0',machine:'arm64',system:'Darwin'}):undefined;
  if(corruption==='source')f.closure.sourceCommit='b'.repeat(40);
  if(corruption==='arch')f.closure.arch='x64';
  if(corruption==='closure')f.closure.sshLoaded=false;
  if(corruption==='runtime')f.closure.pythonRuntime={...f.python,version:'3.11.0'};
  await assert.rejects(verifyMacPackagedResources({bundle:f.bundle,arch:f.arch,run:f.run}),/version|source|architecture|closure|runtime/i,corruption);
 }
});
