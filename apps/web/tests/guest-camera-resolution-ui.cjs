const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const {load}=require('./load-typescript.cjs');
assert.ok(fs.existsSync(path.join(__dirname,'../components/GuestCameraResolutionControl.tsx')),'staff must have a camera resolution control');
let cursor=0;const hooks=[],effects=[],requests=[];
const react={
 useState(initial){const i=cursor++;hooks[i]??={value:typeof initial==='function'?initial():initial};return[hooks[i].value,next=>hooks[i].value=typeof next==='function'?next(hooks[i].value):next];},
 useRef(initial){return hooks[cursor++]??={current:initial};},
 useEffect(fn,deps){const i=cursor++,old=hooks[i];if(old&&deps.every((x,j)=>Object.is(x,old.deps[j])))return;effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}
};
const events=Object.fromEntries(['ParticipantMetadataChanged','ParticipantConnected','ParticipantDisconnected','Connected','Reconnected','Disconnected'].map(x=>[x,x]));
const room=new EventEmitter();room.state='connected';room.remoteParticipants=new Map([['guest-a',{sid:'SID-A',metadata:'{"role":"guest","videoHeight":720}'}]]);
const savedFetch=global.fetch;
global.fetch=(url,options)=>new Promise(resolve=>requests.push({url,body:JSON.parse(options.body),signal:options.signal,resolve}));
const {GuestCameraResolutionControl}=load('../components/GuestCameraResolutionControl.tsx',{react,'livekit-client':{RoomEvent:events},'./I18nProvider':{useI18n:()=>({locale:'en'})}});
function render(){cursor=0;const tree=GuestCameraResolutionControl({room,studioId:'studio',roomName:'room',identity:'guest-a'});while(effects.length)effects.shift()();return tree;}
function find(node,predicate){if(!node||typeof node!=='object')return null;if(predicate(node))return node;for(const child of [node.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}return null;}
const select=()=>find(render(),n=>n.type==='select');
const tick=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{let firstChange;try{
 render();assert.equal(select().props.value,720);
 firstChange=select().props.onChange; firstChange({target:{value:'1080'}}); firstChange({target:{value:'720'}}); await tick();
 assert.equal(requests.length,1);assert.equal(requests[0].url,'/api/participants');
 assert.deepEqual(requests[0].body,{action:'video-resolution',studioId:'studio',room:'room',identity:'guest-a',participantSid:'SID-A',height:1080});
 assert.equal(select().props.disabled,true,'request prevents overlapping changes');
 requests[0].resolve({ok:false,status:403,json:async()=>({error:'Denied'})});await tick();
 assert.equal(select().props.value,720,'failed request does not claim new resolution');assert.ok(find(render(),n=>n.props?.role==='alert'));
 firstChange=select().props.onChange; firstChange({target:{value:'1080'}}); firstChange({target:{value:'720'}}); await tick();
 room.remoteParticipants.set('guest-a',{sid:'SID-B',metadata:'{"videoHeight":720}'});room.emit(events.ParticipantConnected);render();
 assert.equal(requests[1].signal.aborted,true,'replacement cancels previous request');
 requests[1].resolve({ok:true,json:async()=>({height:1080})});await tick();
 assert.equal(select().props.value,720,'late old response cannot modify replacement camera');
 room.remoteParticipants.get('guest-a').metadata='{"videoHeight":1080}';room.emit(events.ParticipantMetadataChanged);assert.equal(select().props.value,1080);
 room.remoteParticipants.delete('guest-a');room.emit(events.ParticipantDisconnected);assert.equal(select().props.disabled,true);
 for(const file of ['StudioWorkspace.tsx','RoomControlConsole.tsx'])assert.ok(fs.readFileSync(path.join(__dirname,'../components',file),'utf8').includes('<GuestCameraResolutionControl'),'staff panels mount resolution control: '+file);
 assert.equal(fs.readFileSync(path.join(__dirname,'../components/GuestAvCheck.tsx'),'utf8').includes('GuestCameraResolutionControl'),false,'caster cannot change studio resolution');
 console.log('PASS staff camera resolution: request/SID, metadata, failure, busy state, replacement, offline and staff-only mounting');
}finally{for(const hook of hooks)hook?.cleanup?.();global.fetch=savedFetch;}})().catch(error=>{console.error(error);process.exitCode=1;});
