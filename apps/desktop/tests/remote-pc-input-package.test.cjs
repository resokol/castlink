'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm');
test('the standard Windows pipeline compiles and includes the persistent input executable',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-input-package-'));let config,resourcePresentAtBuild=false,builds=[];const runtime={platform:'win32',env:{}};
 const native=(_root,output)=>{builds.push(output);fs.mkdirSync(path.dirname(output),{recursive:true});fs.writeFileSync(output,'inert fixture');return output;};
 const modules={'node:fs':fs,'node:path':path,'node:os':os,'node:crypto':require('node:crypto'),'node:child_process':{execFileSync:(_exe,args)=>args[0]==='rev-parse'?'a'.repeat(40):''},
  './setup-resources.cjs':{stageSetupResources:(_r,r)=>{fs.mkdirSync(path.join(r,'setup'),{recursive:true});return{directory:path.join(r,'setup')};}},
  './build-process-audio.cjs':{buildProcessAudio:native},'./build-window-slides.cjs':{buildWindowSlides:native},'./build-remote-pc-input.cjs':{buildRemotePcInput:native},
  './package-files.cjs':{stagePackage:()=>({version:'1',electron:'44.9.0'}),artifactNames:()=>({})},'electron-builder':{build:async options=>{config=options.config;resourcePresentAtBuild=config.extraResources.some(r=>r.to==='remote-input/CastLink.RemoteInput.exe'&&fs.existsSync(r.from));fs.mkdirSync(config.directories.output,{recursive:true});return[];},Platform:{WINDOWS:{createTarget:()=>({})}},Arch:{x64:'x64'}}};
 try{vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../scripts/package.cjs'),'utf8'),{require:n=>{assert.ok(modules[n],n);return modules[n];},__dirname:path.join(root,'apps/desktop/scripts'),process:runtime,console:{log(){},error(){}}});await new Promise(r=>setImmediate(r));
  assert.equal(runtime.exitCode,undefined);assert.ok(builds.some(p=>p.endsWith(path.join('remote-input','CastLink.RemoteInput.exe'))),'compile persistent agent');assert.ok(resourcePresentAtBuild,'include compiled input resource');
 }finally{fs.rmSync(root,{recursive:true,force:true});}
});
test('input build uses the existing csc without NuGet, shell, or runtime authority arguments',()=>{
 const file=path.join(__dirname,'../scripts/build-remote-pc-input.cjs');let invocation;const output=path.join(os.tmpdir(),'CastLink.RemoteInput.exe'),candidate=path.resolve(os.tmpdir(),'castlink-input-candidate');const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,'utf8'),{module,require:Object.assign(n=>n==='node:fs'?{existsSync:()=>true,mkdirSync(){}}:n==='node:path'?path:n==='node:child_process'?{execFileSync:(...a)=>{invocation=a;}}:null,{main:null}),process:{platform:'win32',env:{}},__dirname:path.dirname(file)});
 assert.equal(module.exports.buildRemotePcInput(candidate,output),output);assert.match(invocation[0],/csc\.exe$/);assert.ok(invocation[1].includes('/platform:x64'));assert.ok(invocation[1].includes('/reference:System.Web.Extensions.dll'));assert.ok(invocation[1].includes(path.join(candidate,'native/windows-remote-input/RemoteInput.cs')));assert.equal(invocation[2].windowsHide,true);assert.equal(invocation[2].shell,undefined);
});
