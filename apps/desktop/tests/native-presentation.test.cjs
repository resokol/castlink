'use strict';
const{test}=require('node:test'),assert=require('node:assert/strict');
const{createNativePresentationController}=require('../src/native-presentation.cjs');
function adapter(kind){let n=0;const calls=[];return{calls,async prepare(){return{preparedId:kind+'-prepared',name:kind,...(kind==='window'?{kind}:{})};},async start(){calls.push('start');return{id:kind+'-id',name:kind,...(kind==='window'?{kind}:{page:1,pages:3})};},async connect(){return this.start();},async status(id){return{id,name:kind,...(kind==='window'?{kind}:{page:1,pages:3})};},async step(v){calls.push(v.direction);return{commandId:v.commandId,status:await this.status(v.id)};},async goTo(v){calls.push(v.page);return this.status(v.id);},async disconnect(){calls.push('disconnect');return{ok:true};},dispose(){calls.push('dispose');}};}
test('composite preserves PPTX defaults and routes explicit window target without fake page numbers',async()=>{
 const pptx=adapter('pptx'),window=adapter('window'),c=createNativePresentationController({powerPoint:pptx,windowSlides:window});
 const p=await c.prepare();assert.equal(c.preparedKind(p.preparedId),undefined);
 let s=await c.start(p);assert.equal(s.pages,3);await c.goTo({id:s.id,page:2});
 const w=await c.prepare({kind:'window'});assert.equal(c.preparedKind(w.preparedId),'window');
 s=await c.start(w);assert.equal(s.kind,'window');assert.equal(s.pages,undefined);assert.ok(pptx.calls.includes('disconnect'));
 await assert.rejects(c.status('pptx-id'));await assert.rejects(c.goTo({id:s.id,page:1}));
 assert.equal((await c.step({id:s.id,commandId:'one',direction:'next'})).status.kind,'window');
 await c.disconnect(s.id);await assert.rejects(c.status(s.id));c.dispose();assert.ok(window.calls.includes('dispose'));
});
test('untrusted preparation kind and opaque ids cannot reach either native adapter',async()=>{
 const p=adapter('pptx'),w=adapter('window'),c=createNativePresentationController({powerPoint:p,windowSlides:w});
 await assert.rejects(c.prepare({kind:'shell'}));await assert.rejects(c.prepare({kind:'window',path:'C:/other'}));
 await assert.rejects(c.start({preparedId:'foreign'}));await assert.rejects(c.step({id:'foreign',direction:'next'}));
 assert.deepEqual(p.calls,[]);assert.deepEqual(w.calls,[]);
});

test('dispose during a deferred start cannot bind late result or accept concurrent setup',async()=>{
 const p=adapter('pptx'),w=adapter('window');let resolve;p.start=()=>new Promise(r=>resolve=r);
 const c=createNativePresentationController({powerPoint:p,windowSlides:w}),prepared=await c.prepare();
 const pending=c.start(prepared);await assert.rejects(c.prepare({kind:'window'}),/busy/);c.dispose();resolve({id:'late',name:'pptx',page:1,pages:3});await assert.rejects(pending,/ended/);await assert.rejects(c.status('late'));
 assert.ok(p.calls.includes('disconnect'),'late native grant is detached without closing Office');
});
