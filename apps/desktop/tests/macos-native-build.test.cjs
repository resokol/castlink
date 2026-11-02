const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildMacNative}=require('../scripts/build-macos-native.cjs');
test('native helper build rejects cross architecture and unsupported host before compiler',()=>{
 const run=()=>assert.fail('compiler must not run');
 for(const pair of [['linux','arm64','arm64'],['darwin','arm64','x64'],['darwin','x64','arm64']])assert.throws(()=>buildMacNative({root:'/source',resourcesPath:'/output',platform:pair[0],hostArch:pair[1],arch:pair[2],run}));
});
test('builds five fixed helpers with literal paths and native target; no shell',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink native build ')),out=path.join(root,'resources'),calls=[];
 try{
  for(const name of ['macos-common/ProcessBirth.swift','macos-process-audio/ProcessAudio.swift','macos-remote-input/Core.swift','macos-remote-input/RemoteInput.swift','macos-presentation/WindowSlides.swift','macos-presentation/PowerPointIdentity.swift','macos-registration/ProtocolRegistration.m']){const file=path.join(root,'native',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'//fixture');}
  const result=buildMacNative({root,resourcesPath:out,platform:'darwin',hostArch:'x64',arch:'x64',run:(bin,args,options)=>{calls.push({bin,args,options});fs.writeFileSync(args[args.indexOf('-o')+1],'Mach-O fixture');}});
  assert.equal(calls.length,5);assert.equal(Object.keys(result).length,5);
  for(const call of calls){assert.equal(call.bin,'/usr/bin/xcrun');assert.ok(call.args.includes('x86_64-apple-macos13.0'));assert.equal(call.options.shell,false);if(call.args[0]==='swiftc')assert.ok(call.args.includes(path.join(root,'native/macos-common/ProcessBirth.swift')),'effectful Swift helpers share the kernel process birth implementation');else{assert.equal(call.args[0],'clang');assert.ok(call.args.includes('AppKit'));assert.ok(call.args.includes('CoreServices'));assert.ok(call.args.includes('-fobjc-arc'));}}
  for(const file of Object.values(result))assert.ok(fs.statSync(file).mode&0o100);
  const attempted=[];
  assert.throws(()=>buildMacNative({root,resourcesPath:out,platform:'darwin',hostArch:'x64',arch:'x64',run:(_bin,args)=>{attempted.push(args);throw Error('compiler fixture failure');}}),/audio.*input.*slides.*powerpoint.*registration/s);
  assert.equal(attempted.length,5,'one compile failure must not hide errors in independent helpers');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
