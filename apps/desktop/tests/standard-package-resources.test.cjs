'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
test('the standard package builds and ships its existing PDF navigation helper alongside PowerPoint and audio',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-standard-package-test-')),commit='a'.repeat(40),calls=[],runtimeProcess={platform:'win32',env:{}};
 let configuration;
 const native=(kind,output)=>{calls.push(kind);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,kind);return output;};
 const modules={
  'node:fs':fs,'node:path':path,'node:os':os,'node:crypto':require('node:crypto'),
  'node:child_process':{execFileSync:(_exe,args)=>args[0]==='rev-parse'?commit:''},
  './setup-resources.cjs':{stageSetupResources:(_root,resources)=>{const directory=path.join(resources,'setup');fs.mkdirSync(directory,{recursive:true});return{directory};}},
  './build-process-audio.cjs':{buildProcessAudio:(_root,output)=>native('audio',output)},
  './build-window-slides.cjs':{buildWindowSlides:(_root,output)=>native('window-slides',output)},
  './package-files.cjs':{stagePackage:()=>({version:'1.0.0',electron:'44.9.0'}),artifactNames:()=>({unified:'portable.exe',portable:'client.zip',installer:'setup.exe'})},
  'electron-builder':{Platform:{WINDOWS:{createTarget:()=>({})}},Arch:{x64:'x64'},build:async value=>{configuration=value.config;fs.mkdirSync(configuration.directories.output,{recursive:true});return[];}},
 };
 try{
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/package.cjs'),'utf8'),{require:name=>{assert.ok(Object.hasOwn(modules,name),name);return modules[name];},__dirname:path.join(root,'apps/desktop/scripts'),process:runtimeProcess,console:{log(){},error(){}}});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(runtimeProcess.exitCode,undefined,'the normal packaging entry point completed');
  assert.deepEqual(calls,['audio','window-slides']);
  assert.ok(configuration.extraResources.some(resource=>resource.to==='window-slides/CastLink.WindowSlides.exe'&&resource.from.endsWith(path.join('window-slides','CastLink.WindowSlides.exe'))),'the compiled helper is part of standard extraResources');
  assert.ok(configuration.extraResources.some(resource=>resource.to==='powerpoint/Control.ps1'));
  assert.ok(configuration.extraResources.some(resource=>resource.to==='process-audio/CastLink.ProcessAudio.exe'));
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
