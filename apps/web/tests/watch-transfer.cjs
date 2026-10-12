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
Module._load = function(id, ...args) { if (Object.hasOwn(mocks,id)) return mocks[id]; if (id.startsWith('@/')) return originalLoad.call(this,require('node:path').join(__dirname,'..',id.slice(2))+'.ts',...args); return originalLoad.call(this,id,...args); };
global.setTimeout = (callback, delay) => {const timer={callback,delay};timers.push(timer);return timer;};
global.clearTimeout = timer => {timers=timers.filter(t=>t!==timer);};
global.sessionStorage={getItem:()=>'',setItem:()=>{}};
global.window={location:{href:'https://source.example/watch?room=a#invite=secret',assign:()=>{}},history:{replaceState:()=>{}}};
let subscribeCount=0;
global.fetch=async(_url,options)=>{
 const body=JSON.parse(options.body);
 if (!sourceUp) throw Error('source completely down');
 if (revoked) return new Response(JSON.stringify({error:'revoked'}),{status:403});
 const data=body.action==='join'?{token:'initial-viewer-token'}:{online:true,tracks:0,...(++subscribeCount===1?{token:'renewed-viewer-token'}:{})};
 return new Response(JSON.stringify(data),{status:200});
};
const WatchPage=require('../app/watch/page.tsx').default;
const flush=async()=>{for(let i=0;i<15;i++)await new Promise(resolve=>setImmediate(resolve));};
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
 sourceUp=false;await timers.find(t=>t.delay===2500).callback();await flush();
 assert.equal(transfer.token,'renewed-viewer-token','source outage retains prepared direct reserve following');
 all(tree).find(x=>x.type==='button'&&x.props.children==='Повторить подключение').props.onClick();await flush();
 assert.equal(transfer.token,'renewed-viewer-token','retry while source is down retains the prepared viewer credential');

 await transfer.beforeHandoff();assert.ok(rooms[0].disconnected>0,'handoff cleans up source media');
 // Retry obtains a fresh isolated connection; an authoritative denial cancels transfer credentials.
 sourceUp=true;revoked=true;
 all(tree).find(x=>x.type==='button'&&x.props.children==='Повторить подключение').props.onClick();await flush();
 assert.equal(transfer.token,undefined,'revoked viewer cannot retain transfer credential');
 for(const slot of slots)slot?.cleanup?.();
 slots=[];cursor=0;pending=[];timers=[];rooms=[];clears=0;sourceUp=true;revoked=false;subscribeCount=0;
 snapshot.settings={sound:true,videoEnabled:true};rerender();await flush();
 assert.deepEqual((await transfer.snapshot()).settings,{sound:true,videoEnabled:true},'enabled playback preferences also follow handoff');
 const subscriptions=[];
 const participant={identity:'studio-panel-main',trackPublications:new Map([['audio',{kind:'audio',setSubscribed:async on=>subscriptions.push(on)}]])};
 rooms[0].remoteParticipants.set(participant.identity,participant);
 blockAudio=true;
 const track={kind:'audio',attach:element=>{element.srcObject={};},detach:element=>{element.srcObject=null;}};
 rooms[0].handlers.get('subscribed')(track,{},participant);await flush();
 assert.equal((await transfer.snapshot()).settings.sound,false,'autoplay denial leaves sound off and requires another user click');
 assert.equal(all(tree).find(x=>x.type==='button'&&x.props['aria-label']==='Включить звук').props['aria-pressed'],false);
 assert.ok(subscriptions.includes(false),'browser denial unsubscribes audio');
 for(const slot of slots)slot?.cleanup?.();
 console.log('PASS: watch follows passively with renewed token, preserves muted/video-off choices, survives source outage and clears denied access');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>{Module._load=originalLoad;global.setTimeout=originalSetTimeout;global.clearTimeout=originalClearTimeout;});
