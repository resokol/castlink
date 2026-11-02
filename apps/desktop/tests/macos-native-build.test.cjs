const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {buildMacNative}=require('../scripts/build-macos-native.cjs');
test('native helper build rejects cross architecture and unsupported host before compiler',()=>{
 const run=()=>assert.fail('compiler must not run');
 for(const pair of [['linux','arm64','arm64'],['darwin','arm64','x64'],['darwin','x64','arm64']])assert.throws(()=>buildMacNative({root:'/source',resourcesPath:'/output',platform:pair[0],hostArch:pair[1],arch:pair[2],run}));
});
test('builds exact four helpers with literal paths and native target; no shell',()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink native build ')),out=path.join(root,'resources'),calls=[];
 try{
  for(const name of ['macos-process-audio/ProcessAudio.swift','macos-remote-input/Core.swift','macos-remote-input/RemoteInput.swift','macos-presentation/WindowSlides.swift','macos-presentation/PowerPointIdentity.swift']){const file=path.join(root,'native',name);fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,'//fixture');}
  const result=buildMacNative({root,resourcesPath:out,platform:'darwin',hostArch:'x64',arch:'x64',run:(bin,args,options)=>{calls.push({bin,args,options});fs.writeFileSync(args[args.indexOf('-o')+1],'Mach-O fixture');}});
  assert.equal(calls.length,4);assert.equal(Object.keys(result).length,4);
  for(const call of calls){assert.equal(call.bin,'/usr/bin/xcrun');assert.ok(call.args.includes('x86_64-apple-macos13.0'));assert.equal(call.options.shell,false);}
  for(const file of Object.values(result))assert.ok(fs.statSync(file).mode&0o100);
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
