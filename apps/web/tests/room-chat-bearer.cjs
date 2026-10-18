const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
let slots=[],cursor=0,effects=[],dirty=false,timers=new Map(),timerId=0,now=1800000000000,calls=[];
const original={setTimeout:global.setTimeout,clearTimeout:global.clearTimeout,fetch:global.fetch,now:Date.now};
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const react={
 useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],value=>{slots[i]=typeof value==='function'?value(slots[i]):value;dirty=true;}];},
 useEffect(callback,deps){const i=cursor++;if(!same(slots[i]?.deps,deps)){const previous=slots[i];slots[i]={deps,callback};effects.push(()=>{previous?.cleanup?.();slots[i].cleanup=callback();});}},
};
global.setTimeout=(callback,ms)=>{const id=++timerId;timers.set(id,{callback,at:now+ms});return id;};
global.clearTimeout=id=>timers.delete(id);Date.now=()=>now;
const jwt=(ttl,id='same-guest')=>'eyJhbGciOiJIUzI1NiJ9.'+Buffer.from(JSON.stringify({exp:(now+ttl)/1000,sub:id})).toString('base64url')+'.signed';
let respond=async()=>({ok:true,json:async()=>({token:jwt(300000)})});
global.fetch=async(url,options)=>{calls.push({url,options});return respond(url,options);};
const {useRoomChatBearer}=load('../lib/use-room-chat-bearer.ts',{react});
let props={token:jwt(120000),refreshUrl:'/api/token?role=guest&room=A&identity=same-guest',scope:'A',enabled:true},value;
function render(){let cycles=0;do{assert.ok(++cycles<10);dirty=false;cursor=0;effects=[];value=useRoomChatBearer(props);effects.forEach(effect=>effect());}while(dirty);return value;}
async function settle(){for(let i=0;i<12;i++)await Promise.resolve();if(dirty)render();}
async function advance(ms){const target=now+ms;let runs=0;while(true){const next=[...timers].filter(([,t])=>t.at<=target).sort((a,b)=>a[1].at-b[1].at)[0];if(!next)break;assert.ok(++runs<30,'refresh timers stay bounded');now=next[1].at;timers.delete(next[0]);next[1].callback();await settle();}now=target;await settle();}
function unmount(){for(const s of slots)s?.cleanup?.();slots=[];effects=[];timers.clear();}
(async()=>{try{
 const initial=props.token;assert.equal(render(),initial);await advance(59999);assert.equal(calls.length,0);
 await advance(1);assert.equal(calls.length,1,'renewal starts 60s before expiration');
 assert.equal(calls[0].url,props.refreshUrl);assert.equal(calls[0].options.headers.Authorization,'Bearer '+initial,'guest renewal retains authenticated session identity');
 assert.notEqual(value,initial);const renewed=value;
 await advance(60000);assert.equal(calls.length,1,'fresh staff token is not requested every minute');
 assert.equal(value,renewed);
 await advance(180000);assert.equal(calls.length,2,'5-minute staff credential renews after 4 minutes');
 assert.equal(calls.at(-1).options.headers.Authorization,'Bearer '+renewed,'later renewals use the fresh HTTP credential');
 assert.equal(props.token,initial,'renewal never mutates the media input token');
 let finish;respond=()=>new Promise(resolve=>finish=resolve);props={...props,token:jwt(-1),scope:'expired'};render();await settle();
 const stale=calls.at(-1);assert.equal(stale.options.headers.Authorization,'Bearer '+props.token,'expired tokens renew using their own identity, never anonymous minting');
 const nextInput=jwt(300000,'other');props={...props,token:nextInput};assert.equal(render(),nextInput,'changed input immediately hides previous bearer');
 assert.equal(stale.options.signal.aborted,true);finish({ok:true,json:async()=>({token:jwt(300000,'stale')})});await settle();assert.equal(value,nextInput,'late old-scope response is ignored');
 props={...props,scope:'scope-old',token:jwt(-1)};render();await settle();const finishOldScope=finish,oldScopeRequest=calls.at(-1);
 props={...props,scope:'scope-new'};render();await settle();const finishNewScope=finish;
 assert.equal(oldScopeRequest.options.signal.aborted,true,'scope-only change aborts old request');
 finishOldScope({ok:true,json:async()=>({token:jwt(300000,'wrong-scope')})});await settle();assert.equal(value,props.token,'scope-only late response is ignored');
 const scopedToken=jwt(300000,'new-scope');finishNewScope({ok:true,json:async()=>({token:scopedToken})});await settle();assert.equal(value,scopedToken);
 respond=async()=>{throw Error('network unavailable');};props={...props,token:jwt(1000),scope:'retry'};render();await settle();const beforeRetry=calls.length;const failing=value;
 await advance(29999);assert.equal(calls.length,beforeRetry);assert.equal(value,failing,'failed renewal keeps bearer');
 await advance(1);assert.equal(calls.length,beforeRetry+1,'failure retries after 30s');
 respond=()=>new Promise(()=>{});props={...props,token:jwt(-1),scope:'timeout'};render();await settle();const hanging=calls.at(-1),hangingCount=calls.length;
 await advance(9999);assert.equal(calls.length,hangingCount,'pending renewal never overlaps another request');
 await advance(1);assert.equal(hanging.options.signal.aborted,true,'request timeout aborts stalled fetch');
 await advance(29999);assert.equal(calls.length,hangingCount);
 await advance(1);assert.equal(calls.length,hangingCount+1,'timed-out renewal retries only after 30 seconds');
 props={...props,token:jwt(-1),scope:'disabled',enabled:false};render();await settle();const disabledCount=calls.length;await advance(120000);assert.equal(calls.length,disabledCount,'disabled hook makes no renewals');
 props={...props,token:'opaque-fixture',scope:'opaque',enabled:true};render();await advance(300000);assert.equal(value,'opaque-fixture');assert.equal(calls.length,disabledCount,'opaque token has no invented expiry');
 props={...props,token:jwt(-1),scope:'unmount'};render();await settle();const pending=calls.at(-1);unmount();assert.equal(pending.options.signal.aborted,true,'unmount aborts pending renewal');
 console.log('PASS chat bearer: pre-expiry renewal, identity URL/header, independent token, stale scope/input guard, bounded retries, timeout/unmount abort, disabled/opaque behavior');
 }finally{unmount();Object.assign(global,{setTimeout:original.setTimeout,clearTimeout:original.clearTimeout,fetch:original.fetch});Date.now=original.now;}
})().catch(error=>{console.error(error);process.exitCode=1;});
