const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const {createCoPresentationControls,validSlideControlsState}=load('../lib/co-presentation-controls.ts');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const toolbar={canDelegate:true,canStop:true,sharing:true,controllerIdentity:null,participants:[{identity:'guest-2',name:'Caster <b>2</b>'},{identity:'guest-3',name:'Caster 3'}]};
const state={id:'deck:gen:1',title:'Deck.pdf',controller:'You control',page:2,pages:8,canNavigate:true,canReclaim:false,busy:false,locale:'en',toolbar};
(async()=>{
 assert.equal(validSlideControlsState(state),true,'v2 accepts the exact bounded toolbar contract');
 for(const value of [{...toolbar,url:'bad'},{...toolbar,participants:[...toolbar.participants,toolbar.participants[0]]},{...toolbar,participants:[{identity:'bad\nidentity',name:'Caster'}]},{...toolbar,participants:Array.from({length:101},(_,n)=>({identity:'g'+n,name:'Caster'}))},{...toolbar,canStop:true,sharing:false},{...toolbar,participants:[{identity:'guest',name:'Caster',url:'bad'}]}])assert.equal(validSlideControlsState({...state,toolbar:value}),false);
 assert.equal(validSlideControlsState({...state,toolbar:{...toolbar,controllerIdentity:'temporarily-absent-controller'}}),true,'current controller may have left the fresh list');
 for(const version of [undefined,1,2]){
  const calls=[],actions=[],acks=[];let listen,release,rejectStop;
  const bridge={version,update:async value=>{calls.push(value);return{visible:true};},show:async value=>{calls.push(value);return{visible:true};},hide:async()=>{},onAction:handler=>(listen=handler,()=>{}),stopSettled:async value=>acks.push(value)};
  const adapter=createCoPresentationControls({host:{},bridge,action:event=>{actions.push(event);if(event.action==='next')return new Promise(resolve=>release=resolve);if(event.action==='stop')return new Promise((resolve,reject)=>{rejectStop=reject;});}});
  await adapter.update(state);await adapter.show();assert.equal(Object.keys(calls[0]).length,version===2?10:9,'old EXE must receive exactly nine original fields');
  listen({id:state.id,action:'delegate',controllerIdentity:'guest-2',extra:'bad'});listen({id:state.id,action:'delegate',controllerIdentity:'not-present'});listen({id:state.id,action:'stop',controllerIdentity:'guest-2'});await tick();assert.equal(actions.length,0,'strict action shapes and current candidate membership');
  listen({id:state.id,action:'delegate',controllerIdentity:'guest-2'});await tick();assert.equal(actions.at(-1).action,'delegate');
  listen({id:state.id,action:'next'});await tick();listen({id:state.id,action:'stop'});listen({id:state.id,action:'stop'});await tick();assert.equal(actions.filter(event=>event.action==='stop').length,1,'STOP is single flight and remains available during navigation');
  rejectStop(Error('media stop failed'));await tick();assert.equal(acks.length,version===2?1:0);if(version===2)assert.deepEqual(acks[0],{id:state.id,failed:true});
  release();await tick();
  await adapter.update({...state,busy:true});listen({id:state.id,action:'stop'});await tick();assert.equal(actions.filter(event=>event.action==='stop').length,2,'pending render does not disable owner STOP');
  adapter.clear();rejectStop(Error('old stop'));await tick();assert.equal(acks.length,version===2?1:0,'cleared epoch cannot acknowledge a replacement window');
  await adapter.update({...state,toolbar:{...toolbar,canDelegate:false,canStop:false,sharing:false}});listen({id:state.id,action:'delegate',controllerIdentity:'guest-2'});listen({id:state.id,action:'stop'});await tick();assert.equal(actions.filter(event=>event.action==='stop').length,2,'controller/viewer cannot stop or grant');
  adapter.dispose();
 }
 console.log('PASS toolbar v2 strict state/actions, nine-key compatibility, one delegate, independent STOP flight and matching explicit failure acknowledgement');
})().catch(error=>{console.error(error);process.exitCode=1;});
