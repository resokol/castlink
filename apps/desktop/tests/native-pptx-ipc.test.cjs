'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('client preload exposes capability-gated PPTX preparation and command steps without node access',async()=>{
 let bridge;const calls=[];const ipcRenderer={invoke:async(...args)=>{calls.push(args);return null},on(){},removeListener(){},send(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:n=>{assert.equal(n,'electron');return{contextBridge:{exposeInMainWorld:(name,value)=>{if(name==='castlinkDesktop')bridge=value},executeInMainWorld(){}},ipcRenderer}},process:{argv:['--castlink-role=client']},console});
 assert.equal(bridge.powerPoint.version,2);
 assert.equal(typeof bridge.powerPoint.prepare,'function');assert.equal(typeof bridge.powerPoint.start,'function');assert.equal(typeof bridge.powerPoint.step,'function');
 await bridge.powerPoint.prepare();await bridge.powerPoint.start({preparedId:'opaque'});await bridge.powerPoint.step({id:'grant',commandId:'command',direction:'next'});
 assert.equal(calls[0][0],'castlink:powerpoint-prepare');assert.equal(calls[1][0],'castlink:powerpoint-start');assert.equal(calls[2][0],'castlink:powerpoint-step');
 for(const name of ['connect','status','goTo','disconnect'])assert.equal(typeof bridge.powerPoint[name],'function');
});