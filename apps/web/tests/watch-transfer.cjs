require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs'), Module = require('node:module'), ts = require('typescript');
Module._extensions['.ts'] = Module._extensions['.tsx'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, f);
const originalLoad = Module._load, originalSetTimeout = global.setTimeout, originalClearTimeout = global.clearTimeout;
let slots = [], cursor = 0, pending = [], queued = false, tree, transfer, clears = 0, timers = [], rooms = [], sourceUp = true, revoked = false, blockAudio = false;
const snapshot = {role:'studio-viewer',studioId:'studio-default',room:'a',settings:{sound:false,videoEnabled:false}};
const rerender = () => { cursor = 0; tree = WatchPage(); for (const element of all(tree)) if (element.props?.ref && !element.props.ref.current) element.props.ref.current = {srcObject:null,muted:false,play:async()=>{if(blockAudio)throw Error("browser blocks autoplay");},pause:()=>{}}; for (const run of pending.splice(0)) run(); };
const schedule = () => { if (!queued) { queued = true; queueMicrotask(() => { queued = false; rerender(); }); } };
class Room {
 constructor() { this.remoteParticipants = new Map(); this.disconnected = 0; this.handlers = new Map(); rooms.push(this); }
 on(event, callback) { this.handlers.set(event,callback); }
 async connect(url, token, options) { this.connected = {url,token,options}; }
 async disconnect() { this.disconnected++; }
 async startAudio() { this.audioStarted = true; }
}
const mocks = {
 'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 'react': {
  useRef(value) { const n = cursor++; return slots[n] ||= {current:value}; },
  useState(value) { const n = cursor++; if (!slots[n]) slots[n] = {value:typeof value === 'function' ? value() : value}; return [slots[n].value,next => { const v = typeof next === 'function' ? next(slots[n].value) : next; if (v !== slots[n].value) { slots[n].value = v; schedule(); } }]; },
  useEffect(callback,deps) { const n = cursor++, old = slots[n]; if (!old || deps.some((x,i) => x !== old.deps[i])) { slots[n] = {deps}; pending.push(() => { old?.cleanup?.(); slots[n].cleanup = callback(); }); } },
 },
 'livekit-client': {Room,RoomEvent:{TrackSubscribed:'subscribed',TrackUnsubscribed:'unsubscribed',TrackPublished:'published',ParticipantConnected:'participant',Reconnected:'reconnected',Reconnecting:'reconnecting',Disconnected:'disconnected'},Track:{Kind:{Audio:'audio',Video:'video'}}},
 '@/lib/livekit-url': {getLiveKitUrl:()=>'wss://source.example'},
 '@/lib/use-session-transfer': {useSessionTransfer:options=>{transfer=options;return {view:{phase:'ready',busy:false}};},guestReserveStatusText:()=>null},
 '@/lib/client-transfer': {readTransferSnapshot:()=>clears?undefined:snapshot,clearTransferSnapshot:()=>{clears++;}},
};
Module._load = function(id, ...args) {
 if(id === '@/components/I18nProvider') return require('./i18n-fixture.cjs');
 if(id === '@/components/LanguageSwitcher') return { InlineLanguageSwitcher: () => null };
 if (Object.hasOwn(mocks,id)) return mocks[id]; if (id.startsWith('@/')) return originalLoad.call(this,require('node:path').join(__dirname,'..',id.slice(2))+'.ts',...args); return originalLoad.call(this,id,...args); };
global.setTimeout = (callback, delay) => {const timer={callback,delay};timers.push(timer);return timer;};
global.clearTimeout = timer => {timers=timers.filter(t=>t!==timer);};
global.sessionStorage={getItem:()=>'',setItem:()=>{}};
global.window={location:{href:'https://source.example/watch?room=a#invite=secret',assign:()=>{}},history:{replaceState:()=>{}}};
let subscribeCount=0, subscribeFailure;
global.fetch=async(_url,options)=>{
 const body=JSON.parse(options.body);
 if (!sourceUp) throw Error('source completely down');
 if (revoked) return new Response(JSON.stringify({error:'revoked'}),{status:403});
 if (body.action==='subscribe' && subscribeFailure) {
  if (subscribeFailure==='network') throw new TypeError('network interrupted');
  return new Response(subscribeFailure===502?'<html>temporary upstream failure</html>':JSON.stringify({error:'temporary control failure'}),{status:subscribeFailure});
 }
 const data=body.action==='join'?{token:'initial-viewer-token'}:{online:true,tracks:0,...(++subscribeCount===1?{token:'renewed-viewer-token'}:{})};
 return new Response(JSON.stringify(data),{status:200});
};
const WatchPage=require('../app/watch/page.tsx').default;
const flush=async()=>{for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve));};
const poll=async()=>{const timer=timers.findLast(t=>t.delay===2500);assert.ok(timer,'watch keeps its scheduled control poll');global.clearTimeout(timer);await timer.callback();await flush();};
const all = node => !node || typeof node !== 'object' ? [] : [node,...[node.props?.children].flat(Infinity).flatMap(all)];
(async()=>{
 rerender();await flush();
 assert.ok(transfer,'watch installs passive transfer following');
 assert.equal(transfer.canActivate,false,'watch cannot activate emergency reserve');
 assert.equal(transfer.token,'renewed-viewer-token','passive transfer uses renewed JWT');
 assert.equal(transfer.room,'a');
 assert.deepEqual((await transfer.snapshot()).settings,{sound:false,videoEnabled:false},'verified handoff restores muted/video-off preferences');
 assert.equal(clears,1);
 assert.equal(rooms[0].connected.options.autoSubscribe,false);
 const buttons=all(tree).filter(x=>x.type==='button');
 assert.equal(buttons.find(b=>b.props['aria-label']==='Включить звук').props['aria-pressed'],false);
 assert.equal(buttons.find(b=>b.props['aria-label']==='Включить видео').props['aria-pressed'],false);
 sourceUp=false;await poll();
 assert.equal(transfer.token,'renewed-viewer-token','source outage retains prepared direct reserve following');
 assert.equal(rooms[0].disconnected,0,'a network poll failure never tears down the healthy RTC connection');
 all(tree).find(x=>x.type==='button'&&x.props.children==='Повторить подключение').props.onClick();await flush();
 assert.equal(transfer.token,'renewed-viewer-token','retry while source is down retains the prepared viewer credential');

 const handoffRoom=rooms.at(-1),handoffDisconnects=handoffRoom.disconnected;
 await transfer.beforeHandoff();assert.equal(handoffRoom.disconnected,handoffDisconnects+1,'handoff disconnects the current source room');
 // Retry obtains a fresh isolated connection; an authoritative denial cancels transfer credentials.
 sourceUp=true;revoked=true;
 all(tree).find(x=>x.type==='button'&&x.props.children==='Повторить подключение').props.onClick();await flush();
 assert.equal(transfer.token,undefined,'revoked viewer cannot retain transfer credential');
 for(const slot of slots)slot?.cleanup?.();
 slots=[];cursor=0;pending=[];timers=[];rooms=[];clears=0;sourceUp=true;revoked=false;subscribeCount=0;
 snapshot.settings={sound:true,videoEnabled:true};rerender();await flush();
 assert.deepEqual((await transfer.snapshot()).settings,{sound:true,videoEnabled:true},'enabled playback preferences also follow handoff');
 const subscriptions=[];
 const participant={identity:'studio-panel-main',trackPublications:new Map([['audio',{kind:'audio',setSubscribed:async on=>subscriptions.push(on)}],['video',{kind:'video',setSubscribed:async on=>subscriptions.push(on)}]])};
 rooms[0].remoteParticipants.set(participant.identity,participant);
 let attaches=0,detaches=0;
 const liveTrack=kind=>({kind,stream:{kind,source:'existing-live-rtc'},attach(element){attaches++;element.srcObject=this.stream;},detach(element){detaches++;element.srcObject=null;}});
 const videoTrack=liveTrack('video'),audioTrack=liveTrack('audio');
 rooms[0].handlers.get('subscribed')(videoTrack,{},participant);
 rooms[0].handlers.get('subscribed')(audioTrack,{},participant);await flush();
 const originalRoom=rooms[0],videoElement=all(tree).find(x=>x.type==='video').props.ref.current,audioElement=all(tree).find(x=>x.type==='audio').props.ref.current;
 assert.equal(attaches,2);assert.equal(videoElement.srcObject,videoTrack.stream);assert.equal(audioElement.srcObject,audioTrack.stream);
 for(const failure of ['network',502,429,408]){
  subscribeFailure=failure;await poll();
  assert.equal(originalRoom.disconnected,0,`${failure} poll failure preserves the RTC session`);
  assert.equal(rooms.length,1,'poll failure creates no replacement room');
  assert.equal(videoElement.srcObject,videoTrack.stream);assert.equal(audioElement.srcObject,audioTrack.stream);
  assert.equal(attaches,2);assert.equal(detaches,0,'temporary control failures never detach received tracks');
  assert.equal(transfer.token,'renewed-viewer-token','temporary failure preserves prepared transfer credentials');
  assert.equal(all(tree).find(x=>x.type==='main').props['data-playback-failed'],true,'temporary failure remains visible');
  subscribeFailure=undefined;await poll();
  assert.equal(all(tree).find(x=>x.type==='main').props['data-playback-failed'],false,'next successful poll recovers in place');
  assert.equal(originalRoom.disconnected,0);assert.equal(videoElement.srcObject,videoTrack.stream);assert.equal(audioElement.srcObject,audioTrack.stream);
 }
 originalRoom.handlers.get('reconnecting')();originalRoom.handlers.get('reconnected')();await flush();
 assert.equal(originalRoom.disconnected,0,'SDK reconnect is not replaced with an application disconnect');
 assert.equal(attaches,2);assert.equal(detaches,0);
 blockAudio=true;
 const track={kind:'audio',attach:element=>{element.srcObject={};},detach:element=>{element.srcObject=null;}};
 rooms[0].handlers.get('subscribed')(track,{},participant);await flush();
 assert.equal((await transfer.snapshot()).settings.sound,false,'autoplay denial leaves sound off and requires another user click');
 assert.equal(all(tree).find(x=>x.type==='button'&&x.props['aria-label']==='Включить звук').props['aria-pressed'],false);
 assert.ok(subscriptions.includes(false),'browser denial unsubscribes audio');
 revoked=true;await poll();
 assert.equal(originalRoom.disconnected,1,'403 authoritatively disconnects the established RTC session');
 assert.equal(transfer.token,undefined,'403 clears prepared transfer credentials');
 assert.equal(timers.filter(timer=>timer.delay===2500).length,0,'authoritative rejection stops polling');
 const attachedBeforeCleanup=attaches;
 all(tree).find(x=>x.type==='button'&&x.props.children==='Повторить подключение').props.onClick();await flush();
 assert.equal(videoElement.srcObject,null,'explicit retry detaches the old video');assert.equal(audioElement.srcObject,null,'explicit retry detaches the old audio');
 assert.equal(attaches,attachedBeforeCleanup,'denied retry cannot reattach old tracks');
 assert.equal(rooms.length,2,'only explicit retry creates a replacement room');
 for(const slot of slots)slot?.cleanup?.();
 console.log('PASS: actual watch hook preserves RTC/media attachments through network/502/429/408 and SDK reconnect, recovers polling in place, closes/clears 403, retains handoff/retry cleanup and playback intent');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;global.setTimeout=originalSetTimeout;global.clearTimeout=originalClearTimeout;});
