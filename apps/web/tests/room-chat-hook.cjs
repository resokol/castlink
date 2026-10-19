const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
let slots=[],cursor=0,effects=[],dirty=false;
const same=(a,b)=>a&&b&&a.length===b.length&&a.every((v,i)=>v===b[i]);
const react={useState(initial){const i=cursor++;if(!(i in slots))slots[i]=typeof initial==='function'?initial():initial;return[slots[i],v=>{const n=typeof v==='function'?v(slots[i]):v;if(n!==slots[i]){slots[i]=n;dirty=true;}}];},useRef(v){return slots[cursor++]??={current:v};},useMemo(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps))slots[i]={deps,value:fn()};return slots[i].value;},useEffect(fn,deps){const i=cursor++;if(!same(slots[i]?.deps,deps)){const old=slots[i];slots[i]={deps};effects.push(()=>{old?.cleanup?.();slots[i].cleanup=fn();});}}};
const listeners=new Map();
let live=[], sdkOptions=[],sdkSends=[],requests=[],queued=[],timers=[];
global.fetch=async(url,options)=>{requests.push({url,options});const next=queued.shift();if(!next)throw Error('Unplanned fetch');return typeof next==='function'?next():next;};
global.setTimeout=fn=>{timers.push(fn);return timers.length;};global.clearTimeout=()=>{};
const {usePersistentRoomChat}=load('../lib/use-persistent-room-chat.ts',{react,'@livekit/components-react':{useChat(options){sdkOptions.push(options);return{chatMessages:live,isSending:false,send:async(text,options)=>{sdkSends.push({text,options});throw Error('Transient media channel down');}};},useConnectionState:room=>room.state},'livekit-client':{RoomEvent:{DataReceived:'data'},ConnectionState:{Connected:'connected'}}});
const dto=(id,text)=>({id,message:text,timestamp:Date.now(),identity:'guest',name:'Caster'});
let props={room:{on(event,handler){listeners.set(event,handler);},off(event){listeners.delete(event);},state:'connected',localParticipant:{identity:'staff',publishData:async()=>{}}},scope:'one',session:{token:'token',studioId:'studio-default',roomName:'One'}};
let hook;function render(){let n=0;do{assert.ok(++n<20,'stable hook effects');dirty=false;cursor=0;effects=[];hook=usePersistentRoomChat(props.room,props.scope,props.session);const batch=effects;effects=[];batch.forEach(fn=>fn());}while(dirty);return hook;}
async function settle(){for(let i=0;i<8;i++)await Promise.resolve();render();}
const ok=body=>({ok:true,json:async()=>body});
(async()=>{
 queued.push(ok({messages:[dto('saved','Before reload')]}));render();assert.equal(hook.historyReady,false);await settle();assert.equal(hook.historyReady,true);assert.equal(hook.chatMessages[0].message,'Before reload');assert.ok(hook.initialIds.has('saved'));
 const stable=sdkOptions[0];render();assert.ok(sdkOptions.every(v=>v===stable),'stable useChat options');
 queued.push({ok:false});await assert.rejects(hook.send('Retry this'));render();assert.equal(hook.isSending,false);const failed=JSON.parse(requests.at(-1).options.body);
 queued.push(ok({message:dto(failed.id,'Retry this')}));await hook.send('Retry this');render();assert.equal(JSON.parse(requests.at(-1).options.body).id,failed.id,'retry uses same idempotency key');assert.equal(sdkSends.at(-1).options.attributes['castlink.chatId'],failed.id);assert.equal(hook.chatMessages.filter(v=>v.id===failed.id).length,1,'saved text survives data channel failure');
 let complete;queued.push(()=>new Promise(resolve=>complete=resolve));const late=hook.send('Old scope');render();assert.equal(hook.isSending,true);
 props={...props,scope:'two',session:{...props.session,roomName:'Two'}};queued.push(ok({messages:[]}));render();await settle();assert.equal(hook.chatMessages.length,0);assert.equal(hook.isSending,false,'old scope send cannot disable next room');
 const sent=sdkSends.length;complete(ok({message:dto('old','Old scope')}));await late;render();assert.equal(hook.chatMessages.length,0);assert.equal(sdkSends.length,sent,'late save never publishes into new room');
 // A clear removes retained SDK messages, unread baselines, and old in-flight snapshots.
 live=[{id:'old-sdk',message:'Old SDK text',timestamp:Date.now(),attributes:{'castlink.chatGeneration':'0'},from:{identity:'guest'}}];render();assert.equal(hook.chatMessages.length,1);
 let finishOld;queued.push(()=>new Promise(resolve=>finishOld=resolve));const oldSend=hook.send('Saved before clear');render();
 queued.push(ok({messages:[],generation:1}));await hook.clear();
 queued.push(ok({messages:[],generation:1}));render();await settle();
 assert.equal(hook.generation,1);assert.equal(hook.chatMessages.length,0,'SDK retained messages disappear for this generation');
 const beforeLate=sdkSends.length;finishOld(ok({message:dto('late-old','Saved before clear'),generation:0}));await oldSend;render();
 assert.equal(hook.chatMessages.length,0);assert.equal(sdkSends.length,beforeLate,'late pre-clear send cannot resurrect or broadcast');
 queued.push(ok({message:dto('new-generation','After clear'),generation:1}));await hook.send('After clear');render();
 assert.equal(JSON.parse(requests.at(-1).options.body).generation,1);assert.equal(hook.chatMessages.length,1);assert.equal(sdkSends.at(-1).options.attributes['castlink.chatGeneration'],'1');
 const beforeHint=requests.length;listeners.get('data')(new Uint8Array(),undefined,undefined,'unrelated');render();assert.equal(requests.length,beforeHint);
 queued.push(ok({messages:[dto('new-generation','After clear')],generation:1}));listeners.get('data')(new Uint8Array(),undefined,undefined,'castlink.chat.cleared');render();await settle();assert.equal(requests.length,beforeHint+1,'clear hint fetches authoritative snapshot immediately');
 // Another participant clears while this client remains connected; polling removes messages.
 queued.push(ok({messages:[],generation:2}));await timers.at(-1)();await settle();
 assert.equal(hook.generation,2);assert.equal(hook.chatMessages.length,0,'remote clear removes history and transient SDK text');
 // A stale snapshot and a delayed data-stream delivery cannot repopulate the list.
 queued.push(ok({messages:[dto('stale','Old history')],generation:1}));await timers.at(-1)();await settle();
 live=[...live,{id:'late-sdk',message:'Delayed',timestamp:Date.now(),attributes:{'castlink.chatGeneration':'1'},from:{identity:'guest'}}];render();assert.equal(hook.chatMessages.length,0);
 let acknowledgeClear;queued.push(()=>new Promise(resolve=>acknowledgeClear=resolve));const delayedClear=hook.clear();render();
 queued.push(ok({messages:[dto('post-clear','Already sent after clear')],generation:3}));await timers.at(-1)();await settle();assert.equal(hook.chatMessages.length,1);
 acknowledgeClear(ok({messages:[],generation:3}));await delayedClear;
 queued.push(ok({messages:[dto('post-clear','Already sent after clear')],generation:3}));render();assert.equal(hook.chatMessages.length,1,'late clear acknowledgement preserves messages from its new generation');await settle();
 queued.push({ok:false,status:403});await assert.rejects(hook.clear());render();assert.equal(hook.isClearing,false);
 console.log('PASS: persistent room chat restore/read baseline/stable SDK/idempotent retry/durable fallback/scope race');
})().catch(error=>{console.error(error);process.exitCode=1;});
