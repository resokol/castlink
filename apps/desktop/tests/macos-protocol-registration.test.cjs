'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {SCHEMES,registerMacProtocols}=require('../src/macos-protocol-registration.cjs');
function fixture(t){
 const root=fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(),'castlink-registration-test-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const bundle=path.join(root,'CastLink Client Development.app'),resourcesPath=path.join(bundle,'Contents/Resources'),executable=path.join(bundle,'Contents/MacOS/CastLink Client Development'),helper=path.join(resourcesPath,'registration/CastLink.ProtocolRegistration');
 for(const file of [executable,helper]){fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'native fixture');fs.chmodSync(file,0o755);}
 return {root,bundle,resourcesPath,executable,helper,platform:'darwin'};
}
const reply=(changes={})=>JSON.stringify({protocol:1,ok:true,code:'REGISTERED',schemes:SCHEMES,selectedPathMatches:true,registrationPerformed:true,...changes});
test('normal client invokes only its own fixed helper and main executable with bounded literal arguments',async t=>{
 const f=fixture(t),calls=[],result=await registerMacProtocols({...f,run:async(file,args,options)=>{calls.push({file,args,options});return {stdout:reply()};}});
 assert.deepEqual(result,{ok:true,code:'REGISTERED',schemes:[...SCHEMES],selectedPathMatches:true});
 assert.equal(calls[0].file,f.helper);assert.deepEqual(calls[0].args,['--register',f.executable]);assert.equal(calls[0].options.shell,false);assert.equal(calls[0].options.timeout,15000);assert.equal(calls[0].options.maxBuffer,16384);assert.equal(calls[0].options.killSignal,'SIGKILL');
});
test('untrusted resource/main locations and escaping helper symlinks never invoke a registrar',async t=>{
 const f=fixture(t),run=()=>assert.fail('untrusted bundle must not execute helper');
 assert.equal((await registerMacProtocols({...f,platform:'linux',run})).code,'UNSUPPORTED_PLATFORM');
 assert.equal((await registerMacProtocols({...f,resourcesPath:f.root,run})).code,'BUNDLE_LOCATION');
 const outside=path.join(f.root,'OtherMain');fs.writeFileSync(outside,'outside');fs.chmodSync(outside,0o755);
 assert.equal((await registerMacProtocols({...f,executable:outside,run})).code,'MAIN_EXECUTABLE');
 fs.unlinkSync(f.helper);fs.symlinkSync(outside,f.helper);assert.equal((await registerMacProtocols({...f,run})).code,'BUNDLE_LOCATION');
});
test('helper status, scheme set and exact-path readback are all necessary for success',async t=>{
 const f=fixture(t);
 for(const changes of [{protocol:2},{schemes:['castlink']},{selectedPathMatches:false},{registrationPerformed:false},{ok:false},{code:'OTHER'}]){
  const result=await registerMacProtocols({...f,run:async()=>({stdout:reply(changes)})});assert.equal(result.ok,false);assert.equal(result.code,'REGISTRATION_PROTOCOL');
 }
 assert.equal((await registerMacProtocols({...f,run:async()=>({stdout:'invalid'})})).code,'REGISTRATION_PROTOCOL');
});
test('typed native failures and killed/unavailable children remain controlled failures without raw process output',async t=>{
 const f=fixture(t);
 for(const code of ['BUNDLE_IDENTITY','REGISTRATION_FAILED','REGISTRATION_TIMEOUT','SELECTION_MISMATCH']){
  const output=reply({ok:false,code,selectedPathMatches:false,registrationPerformed:code!=='BUNDLE_IDENTITY'});
  const result=await registerMacProtocols({...f,run:async()=>{throw Object.assign(Error('PRIVATE PATH MUST NOT ESCAPE'),{stdout:output,stderr:'PRIVATE DETAILS'});}});
  assert.equal(result.ok,false);assert.equal(result.code,code);assert.doesNotMatch(JSON.stringify(result),/PRIVATE/);
 }
 assert.equal((await registerMacProtocols({...f,run:async()=>{throw {killed:true,stderr:'PRIVATE'};}})).code,'REGISTRATION_TIMEOUT');
 assert.equal((await registerMacProtocols({...f,run:async()=>{throw {code:'ENOENT',stderr:'PRIVATE'};}})).code,'REGISTRATION_UNAVAILABLE');
 const native=await registerMacProtocols({...f,run:async()=>{throw {stdout:reply({ok:false,code:'REGISTRATION_FAILED',selectedPathMatches:false,nativeStatus:-10814,nativeDomain:'NSOSStatusErrorDomain'})};}});assert.equal(native.nativeStatus,-10814);assert.equal(native.nativeDomain,'NSOSStatusErrorDomain');
 const invalid=await registerMacProtocols({...f,run:async()=>{throw {stdout:reply({ok:false,code:'REGISTRATION_FAILED',selectedPathMatches:false,nativeStatus:'PRIVATE'})};}});assert.equal(invalid.nativeStatus,undefined);
 const unknown=await registerMacProtocols({...f,run:async()=>{throw {stdout:reply({ok:false,code:'REGISTRATION_FAILED',selectedPathMatches:false,nativeStatus:42,nativeDomain:'PRIVATE PATH'})};}});assert.equal(unknown.nativeDomain,'OTHER');
});
