'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {spawnSync}=require('node:child_process');
const {runNativeSmoke,runCommand}=require('../macos-native-smoke.cjs');
const root=path.resolve(__dirname,'../..'),entry=path.join(root,'scripts/macos-native-smoke.cjs');
function directory(t){const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-native-smoke-test-'));t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));return dir;}
test('CLI without arguments reports missing evidence directory without a ReferenceError',()=>{
  const result=spawnSync(process.execPath,[entry],{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:32768});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.match(result.stderr,/Explicit evidence directory required/);assert.doesNotMatch(result.stderr,/ReferenceError/);
});
test('Linux CLI invocation writes bounded FAILED platform evidence and exits nonzero',{skip:process.platform!=='linux'},t=>{
  const evidenceDir=directory(t);
  const result=spawnSync(process.execPath,[entry,evidenceDir],{cwd:root,encoding:'utf8',timeout:5000,maxBuffer:32768});
  assert.equal(result.error,undefined);assert.equal(result.status,1);assert.doesNotMatch(result.stderr,/ReferenceError/);
  const summary=JSON.parse(result.stdout),artifact=JSON.parse(fs.readFileSync(path.join(evidenceDir,'native-smoke.json'),'utf8'));
  assert.deepEqual(artifact,summary);assert.equal(summary.status,'FAILED');assert.equal(summary.platform,'linux');assert.equal(summary.expectedArch,process.arch);
  assert.equal(summary.checks[0].name,'native-build');assert.equal(summary.checks[0].status,'FAILED');assert.match(summary.checks[0].reason,/Native macOS host matching target architecture required/);
  assert.ok(Buffer.byteLength(result.stdout)<32768);assert.equal(summary.checks.at(-1).status,'NOT VERIFIED');
});
function injectedRunner(t,{failedCommand}={}){
  const evidenceDir=directory(t),commands=[],builds=[];
  const helpers={audio:path.join(evidenceDir,'resources/process-audio/CastLink.ProcessAudio'),input:path.join(evidenceDir,'resources/remote-input/CastLink.RemoteInput'),slides:path.join(evidenceDir,'resources/window-slides/CastLink.WindowSlides'),powerpoint:path.join(evidenceDir,'resources/powerpoint/CastLink.PowerPointIdentity')};
  const dependencies={platform:'darwin',hostArch:'arm64',buildNative:options=>{builds.push(options);return helpers;},execute:async(executable,args,options)=>{
    commands.push({executable,args,options});
    if(executable===failedCommand)return {code:2,signal:null,stdout:'',stderr:'compiler refusal'};
    if(args[0]===path.join(root,'native/macos-remote-input/native-fixture.cjs')){
      fs.writeFileSync(args[3],JSON.stringify({status:'NOT VERIFIED',reason:'Accessibility permission unavailable',checks:[]}));
    }
    if(args[0]===path.join(root,'native/macos-presentation/preview-fixture.cjs')){
      fs.writeFileSync(args[3],JSON.stringify({fixture:'owned-preview-pdf',status:'NOT VERIFIED',reason:'Accessibility permission unavailable',checks:[]}));
    }
    if(args[0]==='--browser-fixture')return {code:0,signal:null,stdout:JSON.stringify({protocol:1,fixture:'isolated-browser-pdf',status:'NOT VERIFIED',browsers:[{browser:'com.google.Chrome',installed:true,status:'NOT VERIFIED',reason:'Accessibility permission unavailable',osOperationVerified:false},{browser:'com.microsoft.edgemac',installed:false,status:'NOT VERIFIED',reason:'Browser not installed',osOperationVerified:false}]}),stderr:''};
    if(args[0]==='-e')return {code:3,signal:null,stdout:JSON.stringify({status:'NOT VERIFIED',reason:'Screen Recording permission unavailable'}),stderr:''};
    const stdout=args[0]==='--self-test'?JSON.stringify(executable===helpers.audio?{protocol:'CLPA0001',sampleRate:48000,channels:2,maxPacketFrames:4800,processBirthVerified:true}:{protocol:1,selfTest:'passed',osOperationVerified:false}):'fixture-command-completed\n';
    return {code:0,signal:null,stdout,stderr:''};
  }};
  return {evidenceDir,helpers,commands,builds,dependencies};
}
test('injected native runner coordinates every proof and preserves unavailable OS checks',async t=>{
  const f=injectedRunner(t);
  const summary=await runNativeSmoke({arch:'arm64',root,evidenceDir:f.evidenceDir},f.dependencies);
  assert.equal(summary.status,'NOT VERIFIED');assert.equal(summary.platform,'darwin');assert.equal(summary.arch,'arm64');
  assert.equal(f.builds.length,1);assert.equal(f.builds[0].arch,'arm64');assert.equal(f.builds[0].resourcesPath,path.join(f.evidenceDir,'resources'));
  assert.deepEqual(summary.checks.map(check=>[check.name,check.status]),[['native-build','VERIFIED'],['audio-protocol','VERIFIED'],['input-core','VERIFIED'],['input-native','NOT VERIFIED'],['powerpoint-identity','VERIFIED'],['window-slides','VERIFIED'],['powerpoint-jxa','VERIFIED'],['browser-pdf','NOT VERIFIED'],['preview-pdf','NOT VERIFIED'],['audio-native','NOT VERIFIED'],['interactive-acceptance','NOT VERIFIED']]);
  const compiles=f.commands.filter(command=>command.executable==='/usr/bin/xcrun');assert.equal(compiles.length,3);
  assert.ok(compiles.every(command=>command.args.includes('arm64-apple-macos15.0')));
  assert.ok(f.commands.some(command=>command.executable==='/usr/bin/osacompile'&&command.args.includes(path.join(root,'native/macos-presentation/PowerPoint.js'))));
  assert.equal(f.commands.length,12);assert.ok(f.commands.every(command=>command.options.timeoutMs>0&&command.options.timeoutMs<=180000));
  assert.equal(summary.checks.find(check=>check.name==='powerpoint-jxa').officeLaunched,false);
  assert.equal(JSON.parse(fs.readFileSync(path.join(f.evidenceDir,'native-audio.json'),'utf8')).status,'NOT VERIFIED');
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(f.evidenceDir,'native-smoke.json'),'utf8')),summary);
});
test('injected compiler failure remains FAILED while independent proofs still run',async t=>{
  const f=injectedRunner(t,{failedCommand:'/usr/bin/xcrun'});
  const summary=await runNativeSmoke({arch:'arm64',root,evidenceDir:f.evidenceDir},f.dependencies);
  assert.equal(summary.status,'FAILED');assert.equal(summary.checks.find(check=>check.name==='input-core').status,'FAILED');
  assert.equal(summary.checks.find(check=>check.name==='input-native').status,'FAILED');assert.equal(summary.checks.find(check=>check.name==='powerpoint-jxa').status,'VERIFIED');
  assert.equal(summary.checks.find(check=>check.name==='preview-pdf').status,'FAILED');
  assert.equal(fs.readFileSync(path.join(f.evidenceDir,'input-core-compile.stderr.log'),'utf8'),'compiler refusal');
  assert.equal(summary.checks.find(check=>check.name==='audio-native').status,'NOT VERIFIED');
});
test('command runner bounds an unresponsive child and excessive output',async()=>{
  await assert.rejects(runCommand(process.execPath,['-e','setTimeout(()=>{},10000)'],{timeoutMs:50}),/timed out/);
  await assert.rejects(runCommand(process.execPath,['-e','process.stdout.write(Buffer.alloc(2097153))'],{timeoutMs:5000}),/output exceeded bound/);
});
test('browser fixture command is bounded and unavailable browser evidence is preserved',async t=>{const f=injectedRunner(t);const summary=await runNativeSmoke({arch:'arm64',root,evidenceDir:f.evidenceDir},f.dependencies);const evidence=summary.checks.find(check=>check.name==='browser-pdf');assert.ok(evidence,'browser PDF fixture must be orchestrated');assert.equal(evidence.status,'NOT VERIFIED');const command=f.commands.find(command=>command.args[0]==='--browser-fixture');assert.equal(command.executable,f.helpers.slides);assert.ok(command.options.timeoutMs<=60000);});
