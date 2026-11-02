const assert=require('node:assert/strict'),{EventEmitter}=require('node:events'),{load}=require('./load-typescript.cjs');
const bearer=load('../lib/session-http-bearer.ts'),sdk=require('livekit-client');
const {startRoomTelemetry}=load(process.argv[2]||'../lib/rtc-telemetry.ts',{'./session-http-bearer':bearer});
const original={fetch:global.fetch,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
const timers=new Set();global.setTimeout=(callback,ms)=>{const timer={callback,ms};timers.add(timer);return timer;};global.clearTimeout=timer=>timers.delete(timer);
const jwt=(id,exp,metadata={studioId:'tenant-one',roomDisplayName:'one',role:'guest'})=>'header.'+Buffer.from(JSON.stringify({iss:'test',sub:id,exp,video:{room:'tenant-one/one'},metadata:JSON.stringify(metadata)})).toString('base64url')+'.signature';
const now=Math.floor(Date.now()/1000),source=jwt('guest-one',now+110),fresh=jwt('guest-one',now+7200),foreign=jwt('guest-foreign',now+8000);
const room=()=>Object.assign(new EventEmitter(),{state:'connected',localParticipant:{identity:'guest-one',name:'Guest',trackPublications:new Map()},remoteParticipants:new Map()});
const settle=async()=>{for(let i=0;i<20;i++)await Promise.resolve();};
(async()=>{let stop;try{
 let requests=[];global.fetch=async(url,options)=>{requests.push({url,options});return{ok:true,json:async()=>({token:fresh})};};
 const active=room();stop=startRoomTelemetry(active,'one',source);await settle();
 assert.equal(bearer.sessionHttpBearer(source),fresh,'existing telemetry renewal must publish fresh HTTP control bearer');
 assert.equal(requests.filter(r=>r.url.startsWith('/api/token')).length,1,'sharing a renewal adds no token requests');
 assert.equal(requests.filter(r=>r.url==='/api/stats').length,1,'one original stats cycle is preserved');
 assert.equal(timers.size,1,'only the existing telemetry timer is scheduled');
 assert.equal(active.state,'connected');assert.equal(active.listenerCount(sdk.RoomEvent.Reconnecting),1);
 active.state='disconnected';active.emit(sdk.RoomEvent.Disconnected);
 assert.equal(bearer.sessionHttpBearer(source),fresh,'terminal consumers retain fresh auth until telemetry lifecycle cleanup');
 stop();stop=undefined;assert.equal(bearer.sessionHttpBearer(source),source,'cleanup releases retained credential');
 let finish;requests=[];global.fetch=async(url,options)=>{requests.push({url,options});return url.startsWith('/api/token')?new Promise(resolve=>finish=resolve):{ok:true};};
 stop=startRoomTelemetry(room(),'one',source);await settle();stop();stop=undefined;finish({ok:true,json:async()=>({token:fresh})});await settle();
 assert.equal(bearer.sessionHttpBearer(source),source,'late renewal after cleanup cannot revive session');
 assert.equal(requests.filter(r=>r.url==='/api/stats').length,1,'late renewal adds no connected stats write after final disconnected sample');
 for(const failed of [()=>Promise.reject(Error('offline')),()=>Promise.resolve({ok:false}),()=>Promise.resolve({ok:true,json:async()=>({token:foreign})})]){
  global.fetch=async(url)=>url.startsWith('/api/token')?failed():{ok:true};
  stop=startRoomTelemetry(room(),'one',source);await settle();assert.equal(bearer.sessionHttpBearer(source),source,'failed or mismatched renewal preserves original auth');stop();stop=undefined;
 }
 console.log('PASS telemetry HTTP renewal propagation, unchanged requests/timers/media identity, terminal cleanup, late and invalid response guards');
}finally{stop?.();Object.assign(global,original);}})().catch(e=>{console.error(e);process.exitCode=1;});
