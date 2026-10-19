'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function preload(role){
 const exposed={},sent=[],invoked=[],events=new Map();
 const electron={contextBridge:{exposeInMainWorld:(name,value)=>exposed[name]=value,executeInMainWorld(){}},ipcRenderer:{invoke:(...args)=>{invoked.push(args);return Promise.resolve({visible:true});},send:(...args)=>sent.push(args),on:(name,fn)=>events.set(name,fn),removeListener:(name,fn)=>{if(events.get(name)===fn)events.delete(name);}}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{require:name=>{assert.equal(name,'electron');return electron;},process:{argv:['--castlink-role='+role]}});
 return{exposed,sent,invoked,events};
}
test('client exposes version2 slide operations and exact stop acknowledgement through bounded bridge',async()=>{
 const f=preload('client'),slides=f.exposed.castlinkDesktop.slides;assert.equal(slides.version,2);
 const state={id:'current'},ack={id:'current',failed:true};await slides.update(state);await slides.show(state);await slides.hide('current');await slides.stopSettled(ack);
 assert.deepEqual(f.invoked.map(value=>value[0]),['castlink:slides-update','castlink:slides-show','castlink:slides-hide','castlink:slides-stop-settled']);assert.equal(f.invoked[3][1],ack);
 let action;const remove=slides.onAction(value=>action=value);f.events.get('castlink:slides-action')({},ack);assert.equal(action,ack);remove();assert.equal(f.events.size,0);
});
test('slides renderer has only local hide/menu/action; it cannot invoke trusted-client state API',()=>{
 const f=preload('slides'),slides=f.exposed.castlinkSlides;assert.equal(f.exposed.castlinkDesktop,undefined);assert.equal(slides.stopSettled,undefined);
 slides.hide();slides.menu(true);slides.ready();slides.action({id:'current',action:'stop'});
 assert.deepEqual(f.sent.map(value=>value[0]),['castlink:slides-local-hide','castlink:slides-menu','castlink:slides-ready','castlink:slides-action']);assert.equal(f.invoked.length,0);
});
