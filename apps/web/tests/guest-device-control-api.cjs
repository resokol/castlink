const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const protocol=require('../lib/guest-device-control.ts');
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let now=Date.now(),role='guest',origin=true,online=true,relayEnabled=true,sequence=0;
const clock={now:()=>now};
const storeModule={exports:{}};
vm.runInNewContext(transpile(require.resolve('../lib/guest-device-control-state.ts')),{module:storeModule,exports:storeModule.exports,require:()=>({}),Date:clock,Map});
const store=storeModule.exports;
let participant={sid:'PA-1',metadata:JSON.stringify({role:'guest',studioId:'tenant-one'}),tracks:[]};
const sent=[];
class NextResponse extends Response{static json(body,init){return new Response(JSON.stringify(body),init);}}
class RoomServiceClient{
  async getParticipant(room,identity){if(!online)throw new Error('private SFU failure');assert.equal(room,'tenant-one/one');assert.equal(identity,'guest-one');return participant;}
  async sendData(room,bytes,kind,options){sent.push({room,command:JSON.parse(new TextDecoder().decode(bytes)),kind,options});}
}
class TokenVerifier{async verify(token){if(token!=='guest-token')throw new Error('bad token');return{sub:'guest-one',video:{room:'tenant-one/one'},metadata:JSON.stringify({role:'guest',studioId:'tenant-one'})};}}
const imports={
  '@/lib/camera-transform':require('../lib/camera-transform.ts'),
  'node:crypto':{randomUUID:()=>`command-${++sequence}`},'next/server':{NextResponse},'livekit-server-sdk':{RoomServiceClient,TokenVerifier,DataPacket_Kind:{RELIABLE:1}},
  '@/lib/access':{sameOrigin:()=>origin},'@/lib/room-studio-access':{canHostNamedRoom:async(_,room,studio)=>role==='owner'&&room==='one'&&studio==='tenant-one'},
  '@/lib/room-admin':{isRoomAdmin:async(_,room,studio)=>role==='admin'&&room==='one'&&studio==='tenant-one'},
  '@/lib/moderator-access':{isModerator:async(_,room,studio)=>role==='moderator'&&room==='one'&&studio==='tenant-one'},
  '@/lib/room-store':{readRooms:async()=>[{name:'one'},{name:'two'}]},
  '@/lib/studio-scope':{defaultStudioId:()=> 'tenant-one',validateStudioId:value=>value,mediaRoomName:(studio,room)=>`${studio}/${room}`},
  '@/lib/rate-limit':{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})},
  '@/lib/connection-route-config':{guestConnectionRoutes:()=>({relay:{configured:relayEnabled,transport:'udp'}})},
  '@/lib/guest-device-control-state':store,'@/lib/guest-device-control':protocol,
};
const apiModule={exports:{}};
vm.runInNewContext(transpile(require.resolve('../app/api/guest-device-control/route.ts')),{module:apiModule,exports:apiModule.exports,require:name=>{assert.ok(name in imports,name);return imports[name];},process:{env:{}},Response,TextEncoder,Date:clock});
const api=apiModule.exports;
const body=(extra={})=>({studioId:'tenant-one',room:'one',identity:'guest-one',...extra});
const post=(data,token='')=>api.POST({headers:new Headers(token?{authorization:`Bearer ${token}`}:{ }),json:async()=>body(data)});
const get=(extra={})=>api.GET({headers:new Headers(),nextUrl:{searchParams:new URLSearchParams(body(extra))}});
const state={devices:[{kind:'audioinput',deviceId:'mic-old',label:'Old mic'},{kind:'audioinput',deviceId:'mic-new',label:'New mic'},{kind:'videoinput',deviceId:'cam-new',label:'New camera'},{kind:'audiooutput',deviceId:'speaker-new',label:'Headphones'}],selected:{audioinput:'mic-old'},actual:{audioinput:'mic-old'},microphoneEnabled:true,cameraEnabled:false,outputSupported:true};
const report=(extra={})=>post({action:'report',participantSid:participant.sid,state,...extra},'guest-token');

(async()=>{
  const target=state.devices[1],request=extra=>post({action:'request',participantSid:participant.sid,target,...extra});
  assert.equal((await get()).status,401);assert.equal((await request()).status,401);
  role='moderator';assert.equal((await get()).status,401,'restricted moderator must not access device list');assert.equal((await request()).status,401);
  role='owner';origin=false;assert.equal((await report()).status,403);origin=true;
  assert.equal((await get({room:'two'})).status,401);assert.equal((await report({room:'two'})).status,403);assert.equal((await report({identity:'guest-other'})).status,403);assert.equal((await report({studioId:'tenant-two'})).status,403);
  assert.equal((await post({action:'report',participantSid:'PA-1',state},'forged')).status,401);
  assert.equal((await request()).status,409,'no unauthenticated device inventory');assert.equal((await report()).status,200);
  let view=await(await get()).json();assert.deepEqual(view.state,state);
  assert.equal((await request({participantSid:'PA-old'})).status,409);
  assert.equal((await request({target:{...target,deviceId:'unreported'}})).status,409);
  let response=await request({target:{...target,label:'forged label'}});assert.equal(response.status,200);let command=(await response.json()).request;
  assert.equal(command.target.label,'New mic','server takes canonical label from authenticated caster report');assert.deepEqual(JSON.parse(JSON.stringify(sent.at(-1).options)),{destinationIdentities:['guest-one'],topic:protocol.GUEST_DEVICE_REQUEST_TOPIC});
  view=await(await get()).json();assert.equal(view.state.selected.audioinput,'mic-old','request never spoofs selected device');
  assert.equal((await request()).status,409);assert.equal((await report({requestId:'wrong',outcome:'declined'})).status,409);
  assert.equal((await report({requestId:command.id,outcome:'applied'})).status,409,'success requires verified actual selection');
  assert.equal((await report({requestId:command.id,outcome:'saved',state:{...state,selected:{audioinput:'mic-new'}}})).status,409,'live mic cannot claim deferred save');
  assert.equal((await report({requestId:command.id,outcome:'declined'})).status,200);
  assert.equal((await report({requestId:command.id,outcome:'declined'})).status,409,'replayed result rejected');
  response=await request();command=(await response.json()).request;
  assert.equal((await report({requestId:command.id,outcome:'applied',state:{...state,selected:{audioinput:'mic-new'},actual:{audioinput:'mic-new'}}})).status,200);
  assert.equal((await(await get()).json()).result.outcome,'applied');
  response=await request({target:state.devices[2]});command=(await response.json()).request;
  assert.equal((await report({requestId:command.id,outcome:'saved',state:{...state,selected:{videoinput:'cam-new'}}})).status,200,'off camera saves choice without claiming live capture');
  response=await request();command=(await response.json()).request;participant={...participant,sid:'PA-2'};
  assert.equal((await report({requestId:command.id,participantSid:'PA-1',outcome:'applied'})).status,409);assert.equal((await(await get()).json()).state,undefined,'rejoined session cannot expose old inventory');
  assert.equal((await report()).status,200);response=await request();command=(await response.json()).request;now+=60001;
  assert.equal((await report({requestId:command.id,outcome:'declined'})).status,409);assert.equal((await request()).status,409,'stale device inventory blocks request');
  assert.equal((await report({state:{...state,outputSupported:false}})).status,200);assert.equal((await request({target:state.devices[3]})).status,409,'unsupported audio output cannot be requested');
  online=false;assert.equal((await report()).status,409);assert.equal((await(await get()).json()).state,undefined,'offline inventory is not actionable');online=true;
  const transform = {...require('../lib/camera-transform.ts').DEFAULT_CAMERA_TRANSFORM, zoom: 2};
  assert.equal((await report({state:{...state,cameraTransform:transform,cameraTransformSupported:false}})).status,200);
  assert.equal((await request({target:{kind:'camera-transform',transform}})).status,409,'unsupported transform rejected');
  assert.equal((await report({state:{...state,cameraTransform:transform,cameraTransformSupported:true}})).status,200);
  assert.equal((await request({target:{kind:'camera-transform',transform:{...transform,zoom:NaN}}})).status,400);
  role='guest'; assert.equal((await request({target:{kind:'camera-transform',transform}})).status,401,'caster cannot request another caster transform'); role='owner';
  response=await request({target:{kind:'camera-transform',transform}}); assert.equal(response.status,200);command=(await response.json()).request;
  assert.equal((await report({requestId:command.id,outcome:'applied',state:{...state,cameraTransform:transform,cameraTransformSupported:true}})).status,409,'off camera cannot claim applied');
  assert.equal((await report({requestId:command.id,outcome:'saved',state:{...state,cameraTransform:{...transform,zoom:1},cameraTransformSupported:true}})).status,409,'transform ACK must match requested values');
  assert.equal((await report({requestId:command.id,outcome:'saved',state:{...state,cameraTransform:transform,cameraTransformSupported:true}})).status,200,'off camera saves transform without capture');
  const bytes=value=>new TextEncoder().encode(JSON.stringify(value)),valid={id:'one',participantSid:'PA-2',issuedAt:now,expiresAt:now+60000,target};
  assert.ok(protocol.parseGuestDeviceRequest(bytes(valid),undefined,protocol.GUEST_DEVICE_REQUEST_TOPIC,'PA-2',now));
  for(const [packet,sender,topic,sid] of [[valid,{identity:'studio-panel-main'},protocol.GUEST_DEVICE_REQUEST_TOPIC,'PA-2'],[valid,undefined,'wrong','PA-2'],[valid,undefined,protocol.GUEST_DEVICE_REQUEST_TOPIC,'PA-1'],[{...valid,expiresAt:now-1},undefined,protocol.GUEST_DEVICE_REQUEST_TOPIC,'PA-2'],[{...valid,expiresAt:now+60001},undefined,protocol.GUEST_DEVICE_REQUEST_TOPIC,'PA-2'],[{...valid,issuedAt:now-60001},undefined,protocol.GUEST_DEVICE_REQUEST_TOPIC,'PA-2'],[{...valid,target:{...target,enabled:true}},undefined,protocol.GUEST_DEVICE_REQUEST_TOPIC,'PA-2']])assert.equal(protocol.parseGuestDeviceRequest(bytes(packet),sender,topic,sid,now),undefined);
  assert.equal(protocol.parseGuestDeviceState({...state,devices:[target,target]}),undefined);
  store.guestDeviceEntry('ttl').state=state;now+=600001;assert.equal(store.guestDeviceEntry('ttl').state,undefined);
  console.log('PASS: caster-device inventory privacy, room/token/SID authorization, canonical device labels, capability/freshness guards, verified applied/deferred ACK, decline/replay/expiry and server-only packets');
})().catch(error=>{console.error(error);process.exitCode=1;});
