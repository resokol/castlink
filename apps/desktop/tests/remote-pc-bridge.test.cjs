'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('client preload exposes only frozen safe remote-control methods',async()=>{
 let exposed;const calls=[];const ipc={invoke:async(...v)=>calls.push(v),on(){},removeListener(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(n,v)=>{if(n==='castlinkDesktop')exposed=v;},executeInMainWorld(){}},ipcRenderer:ipc}),process:{argv:['--castlink-role=client']}});
 const bridge=exposed.remoteControl;assert.ok(bridge,'versioned remoteControl missing');assert.equal(bridge.version,1);assert.deepEqual(Object.keys(bridge).sort(),['version','capabilities','attach','geometry','receive','stop','updateToolbar','onState','onIntent'].sort());
 await bridge.attach({ticket:'secret-ticket',captureId:'capture'});assert.equal(calls[0][0],'castlink:remote-control-attach');assert.equal(bridge.renew,undefined);assert.equal(bridge.target,undefined);
});
test('standard package manifest advertises matching native policy and bridge versions',()=>{
 const {stagePackage}=require('../scripts/package-files.cjs'),os=require('node:os');const dir=fs.mkdtempSync(path.join(os.tmpdir(),'remote-manifest-'));try{const info=stagePackage(path.resolve(__dirname,'../../..'),dir,'a'.repeat(40));assert.equal(info.remoteControlBridge,1);assert.equal(info.remoteControlInputPolicy,2);assert.ok(fs.existsSync(path.join(dir,'src/remote-pc-desktop.cjs')));}finally{fs.rmSync(dir,{recursive:true,force:true});}
});
