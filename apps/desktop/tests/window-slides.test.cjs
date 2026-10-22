'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createWindowSlidesController}=require('../src/window-slides.cjs');
const target={windowHandle:'1234',binding:'a'.repeat(64),name:'Report Q4.pdf'};
function fixture(){
 const calls=[];let selected=0,approved=true,error;
 const controller=createWindowSlidesController({helperPath:'C:/test/WindowSlides.exe',
  execFile(_file,args,_options,callback){calls.push(args);queueMicrotask(()=>error?callback({code:2},JSON.stringify({error})):callback(null,JSON.stringify(args[0]==='list'?[target]:target)));return{kill(){}};},
  chooseWindow:async windows=>{assert.equal(windows[0].windowHandle,undefined);assert.equal(windows[0].binding,undefined);return selected===null?null:windows[selected].id;},
  confirm:async()=>approved});
 return{controller,calls,setSelected:v=>selected=v,setApproved:v=>approved=v,setError:v=>error=v};
}
test('PDF prepare chooses locally without activation, cancel preserves opaque prepared target and start activates only after local consent',async()=>{
 const f=fixture(),prepared=await f.controller.prepare();assert.deepEqual(Object.keys(prepared).sort(),['kind','name','preparedId']);
 assert.equal(prepared.kind,'window');assert.equal(JSON.stringify(prepared).includes('1234'),false);
 assert.deepEqual(f.calls.map(a=>a[0]),['list']);f.setSelected(null);assert.equal(await f.controller.prepare(),null);
 f.setApproved(false);await assert.rejects(f.controller.start(prepared),e=>e.code==='WINDOW_SLIDES_DECLINED');
 assert.equal(f.calls.some(a=>a[0]==='activate'),false);f.setApproved(true);
 const status=await f.controller.start(prepared);assert.deepEqual(Object.keys(status).sort(),['id','kind','name']);
 assert.equal(status.kind,'window');assert.equal(f.calls.filter(a=>a[0]==='activate').length,1);
 await f.controller.start(prepared);assert.equal(f.calls.filter(a=>a[0]==='activate').length,1,'repeat start never changes focus again');
});
test('PDF navigation is only bounded next/previous with consumed command IDs, expiry before native and no page claims',async()=>{
 const f=fixture(),p=await f.controller.prepare(),s=await f.controller.start(p);
 const request={id:s.id,commandId:'once',direction:'next',expiresAt:Date.now()+3000};
 const a=f.controller.step(request),b=f.controller.step(request);assert.deepEqual(await a,await b);
 assert.equal(f.calls.filter(a=>a[0]==='step').length,1);
 assert.equal((await a).status.page,undefined);assert.equal((await a).status.pages,undefined);
 await assert.rejects(f.controller.step({...request,direction:'previous'}));
 await assert.rejects(f.controller.step({...request,commandId:'expired',expiresAt:Date.now()-1}));
 await assert.rejects(f.controller.step({...request,commandId:'bad',direction:'delete'}));
 assert.equal(f.calls.filter(a=>a[0]==='step').length,1);
});
test('foreground refusal is actionable, never retried, and a later explicit command can work after local focus is restored',async()=>{
 const f=fixture(),s=await f.controller.start(await f.controller.prepare());
 f.setError('WINDOW_SLIDES_FOREGROUND');
 const request={id:s.id,commandId:'background',direction:'next'};
 await assert.rejects(f.controller.step(request),e=>e.code==='WINDOW_SLIDES_FOREGROUND');
 f.setError(undefined);await assert.rejects(f.controller.step(request),e=>e.code==='WINDOW_SLIDES_FOREGROUND');
 assert.equal(f.calls.filter(a=>a[0]==='step').length,1);
 await f.controller.step({...request,commandId:'new-explicit-click'});assert.equal(f.calls.filter(a=>a[0]==='step').length,2);
});
test('ambiguous native effect revokes target and disconnect/dispose prevent delayed navigation',async()=>{
 const f=fixture(),s=await f.controller.start(await f.controller.prepare());f.setError('WINDOW_SLIDES_AMBIGUOUS');
 await assert.rejects(f.controller.step({id:s.id,commandId:'uncertain',direction:'previous'}));
 f.setError(undefined);await assert.rejects(f.controller.status(s.id));
 f.controller.dispose();await assert.rejects(f.controller.prepare());
 const g=fixture(),t=await g.controller.start(await g.controller.prepare());await g.controller.disconnect(t.id);
 await assert.rejects(g.controller.step({id:t.id,commandId:'late',direction:'next'}));assert.equal(g.calls.some(a=>a[0]==='step'),false);
});
