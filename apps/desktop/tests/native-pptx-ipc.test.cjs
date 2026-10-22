'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('client preload exposes capability-gated PPTX preparation and command steps without node access',async()=>{
 let bridge;const calls=[];const ipcRenderer={invoke:async(...args)=>{calls.push(args);return null},on(){},removeListener(){},send(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:n=>{assert.equal(n,'electron');return{contextBridge:{exposeInMainWorld:(name,value)=>{if(name==='castlinkDesktop')bridge=value},executeInMainWorld(){}},ipcRenderer}},process:{argv:['--castlink-role=client']},console});
 assert.equal(bridge.powerPoint.version,3);
 assert.equal(typeof bridge.powerPoint.prepare,'function');assert.equal(typeof bridge.powerPoint.start,'function');assert.equal(typeof bridge.powerPoint.step,'function');
 assert.equal(bridge.slides.version,4);await bridge.powerPoint.prepare({kind:'window'});await bridge.powerPoint.start({preparedId:'opaque'});await bridge.powerPoint.step({id:'grant',commandId:'command',direction:'next'});
 assert.deepEqual(JSON.parse(JSON.stringify(calls[0])),['castlink:powerpoint-prepare',{kind:'window'}]);assert.equal(calls[1][0],'castlink:powerpoint-start');assert.equal(calls[2][0],'castlink:powerpoint-step');
 for(const name of ['connect','status','goTo','disconnect'])assert.equal(typeof bridge.powerPoint[name],'function');
});
test('fixed foreground error survives Electron serialized IPC without exposing a generic error channel',async()=>{
 let bridge;vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:()=>({contextBridge:{exposeInMainWorld:(_n,v)=>bridge=v,executeInMainWorld(){}},ipcRenderer:{invoke:async()=>({error:'WINDOW_SLIDES_FOREGROUND'}),on(){},removeListener(){},send(){}}}),process:{argv:['--castlink-role=client']}});
 await assert.rejects(bridge.powerPoint.step({id:'pdf',commandId:'one',direction:'next'}),error=>error.code==='WINDOW_SLIDES_FOREGROUND');
});
