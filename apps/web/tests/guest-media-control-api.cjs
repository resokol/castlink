const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const protocol=require('../lib/guest-media-control.ts');
const transpile=file=>ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let now=Date.now(),role='guest',origin=true,online=true,relayEnabled=true,sequence=0;
const clock={now:()=>now};
const storeModule={exports:{}};
vm.runInNewContext(transpile(require.resolve('../lib/guest-media-control-state.ts')),{module:storeModule,exports:storeModule.exports,require:()=>({}),Date:clock,Map});
const store=storeModule.exports;
let participant={sid:'PA-1',metadata:JSON.stringify({role:'guest',studioId:'tenant-one'}),tracks:[]};
const sent=[];
class NextResponse extends Response{static json(body,init){return new Response(JSON.stringify(body),init);}}
class RoomServiceClient{
  async getParticipant(room,identity){if(!online)throw new Error('private SFU failure');assert.equal(room,'tenant-one/one');assert.equal(identity,'guest-one');return participant;}
  async updateParticipant(room,identity,patch){assert.equal(room,"tenant-one/one");assert.equal(identity,"guest-one");participant={...participant,...patch};}
  async sendData(room,bytes,kind,options){sent.push({room,command:JSON.parse(new TextDecoder().decode(bytes)),kind,options});}
}
class TokenVerifier{async verify(token){if(token!=='guest-token')throw new Error('bad token');return{sub:'guest-one',video:{room:'tenant-one/one'},metadata:JSON.stringify({role:'guest',studioId:'tenant-one'})};}}
const imports={
  'node:crypto':{randomUUID:()=>`command-${++sequence}`},'next/server':{NextResponse},'livekit-server-sdk':{RoomServiceClient,TokenVerifier,DataPacket_Kind:{RELIABLE:1}},
  '@/lib/access':{sameOrigin:()=>origin},'@/lib/room-studio-access':{canHostNamedRoom:async(_,room,studio)=>role==='owner'&&room==='one'&&studio==='tenant-one'},
  '@/lib/room-admin':{isRoomAdmin:async(_,room,studio)=>role==='admin'&&room==='one'&&studio==='tenant-one'},
  '@/lib/moderator-access':{isModerator:async(_,room,studio)=>role==='moderator'&&room==='one'&&studio==='tenant-one'},
  '@/lib/room-store':{readRooms:async()=>[{name:'one'},{name:'two'}]},
  '@/lib/studio-scope':{defaultStudioId:()=> 'tenant-one',validateStudioId:value=>value,mediaRoomName:(studio,room)=>`${studio}/${room}`},
  '@/lib/rate-limit':{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})},
  '@/lib/connection-route-config':{guestConnectionRoutes:()=>({relay:{configured:relayEnabled,transport:'udp'}})},
  '../../../lib/guest-session-settings':{rememberGuestSessionSettings(){},markGuestSessionDisconnected(){}},
  '@/lib/guest-media-control-state':store,'@/lib/guest-media-control':protocol,
};
const apiModule={exports:{}};
vm.runInNewContext(transpile(require.resolve('../app/api/guest-media-control/route.ts')),{module:apiModule,exports:apiModule.exports,require:name=>{assert.ok(name in imports,name);return imports[name];},process:{env:{}},Response,TextEncoder,Date:clock});
const api=apiModule.exports;
const body=(extra={})=>({studioId:'tenant-one',room:'one',identity:'guest-one',...extra});
const post=(data,token='')=>api.POST({headers:new Headers(token?{authorization:`Bearer ${token}`}:{ }),json:async()=>body(data)});
const get=(extra={})=>api.GET({headers:new Headers(),nextUrl:{searchParams:new URLSearchParams(body(extra))}});
const state={audioProfile:'speech',connectionRoute:'normal',activeRoute:'normal',noiseSuppressionState:'on',videoCodec:'vp8',actualVideoCodec:'vp8',videoEnabled:true,supportedVideoCodecs:['vp8','h264','av1']};
const report=(extra={})=>post({action:'report',participantSid:participant.sid,state,...extra},'guest-token');

(async()=>{
  assert.equal((await get()).status,401,'guest cannot read studio control state');
  assert.equal((await post({action:'command',participantSid:'PA-1',patch:{audioProfile:'raw'}})).status,401,'guest cannot issue settings commands');
  role='owner';origin=false;assert.equal((await get()).status,403);assert.equal((await report()).status,403);origin=true;
  assert.equal((await get({room:'two'})).status,401);assert.equal((await get({studioId:'tenant-two'})).status,401);
  assert.equal((await post({action:'command',room:'two',participantSid:'PA-1',patch:{audioProfile:'raw'}})).status,401);
  assert.equal((await report({identity:'guest-other'})).status,403);assert.equal((await report({room:'two'})).status,403);assert.equal((await report({studioId:'tenant-two'})).status,403);
  assert.equal((await post({action:'report',participantSid:'PA-1',state},'forged')).status,401);
  assert.equal((await report()).status,200);
  let response=await get();assert.equal(response.headers.get('cache-control'),'no-store');assert.deepEqual((await response.json()).state,state);
  for(const patch of [{videoCodec:'vp9'},{videoCodec:123},{audioProfile:'unknown'},{connectionRoute:'bad'},{audioProfile:'raw',enabled:true},{enabled:true},{}])assert.equal((await post({action:'command',participantSid:'PA-1',patch})).status,400);
  assert.equal((await post({action:'command',participantSid:'PA-old',patch:{audioProfile:'raw'}})).status,409);
  let commandResponse=await post({action:'command',participantSid:'PA-1',patch:{audioProfile:'raw'}});
  assert.equal(commandResponse.status,200);const command=(await commandResponse.json()).command;
  assert.equal(sent.length,1);assert.deepEqual(JSON.parse(JSON.stringify(sent[0].options)),{destinationIdentities:['guest-one'],topic:protocol.GUEST_MEDIA_SETTINGS_TOPIC});assert.equal(sent[0].kind,1);
  assert.equal(sent[0].command.patch.audioProfile,'raw');assert.equal(sent[0].command.patch.enabled,undefined,'settings command never enables mic');
  response=await get();let view=await response.json();assert.equal(view.state.audioProfile,'speech','request acceptance does not spoof confirmed state');assert.equal(view.state.noiseSuppressionState,'on','actual browser processing state survives authenticated report');assert.equal(view.command.id,command.id);
  assert.equal((await post({action:'command',participantSid:'PA-1',patch:{connectionRoute:'normal'}})).status,409,'only one in-flight command per guest');
  assert.equal((await report({commandId:'stale-command'})).status,409);
  assert.equal((await report({commandId:command.id,state:{...state,audioProfile:'raw'}})).status,200);
  view=await(await get()).json();assert.equal(view.state.audioProfile,'raw');assert.equal(view.command,undefined);assert.equal(view.result.ok,true);
  assert.equal((await report({commandId:command.id})).status,409,'an old ACK cannot overwrite a later confirmed state');
  assert.equal((await post({action:'command',participantSid:'PA-1',patch:{videoCodec:'av1'}})).status,200);
  const fallbackCommand=sent.at(-1).command;
  assert.equal((await report({commandId:fallbackCommand.id,state:{...state,videoCodec:'av1',actualVideoCodec:'vp8'}})).status,200);
  view=await(await get()).json();assert.equal(view.result.ok,false,'server must not accept fallback as successful codec confirmation');
  assert.equal((await post({action:'command',participantSid:'PA-1',patch:{videoCodec:'h264'}})).status,200);
  const codecCommand=sent.at(-1).command;
  assert.equal((await report({commandId:codecCommand.id,state:{...state,videoCodec:'h264',actualVideoCodec:'h264'}})).status,200);
  view=await(await get()).json();assert.equal(view.result.ok,true);assert.equal(view.state.actualVideoCodec,'h264');
  assert.equal((await post({action:'command',participantSid:'PA-1',patch:{videoCodec:'av1'}})).status,200);
  const offCodecCommand=sent.at(-1).command;
  assert.equal((await report({commandId:offCodecCommand.id,state:{...state,videoCodec:'av1',videoEnabled:false,actualVideoCodec:undefined}})).status,200);
  view=await(await get()).json();assert.equal(view.result.ok,true,'camera-off saved codec is acknowledged without pretending an active publication');assert.equal(view.state.actualVideoCodec,undefined);
  participant={...participant,sid:'PA-2'};assert.equal((await post({action:'command',participantSid:'PA-1',patch:{audioProfile:'speech'}})).status,409);
  assert.equal((await report({participantSid:'PA-1'})).status,409);assert.equal((await report()).status,200);
  relayEnabled=false;assert.equal((await post({action:'command',participantSid:'PA-2',patch:{connectionRoute:'relay'}})).status,409);relayEnabled=true;
  role='moderator';assert.equal((await post({action:'command',participantSid:'PA-2',patch:{audioProfile:'speech'}})).status,200,'existing same-room moderation permission retained');
  const moderatorCommand=sent.at(-1).command;assert.equal((await report({commandId:moderatorCommand.id,state})).status,200);
  role='admin';assert.equal((await post({action:'command',participantSid:'PA-2',patch:{connectionRoute:'relay'}})).status,200);
  const routeCommand=sent.at(-1).command;online=false;
  assert.equal((await report({commandId:routeCommand.id,error:'TURN join failed',participantSid:'PA-2'})).status,200,'authenticated failed route reports after SFU disconnect');
  response=await get();assert.equal(response.headers.get('cache-control'),'no-store');view=await response.json();assert.equal(view.offline,true);assert.equal(view.result.ok,false);assert.equal(view.result.error,'TURN join failed');assert.equal(view.state.connectionRoute,'normal');
  assert.equal((await report({commandId:routeCommand.id,error:'stale'})).status,409);
  online=true;participant={...participant,sid:'PA-3'};assert.equal((await report()).status,200);
  assert.equal((await post({action:'command',participantSid:'PA-3',patch:{audioProfile:'raw'}})).status,200);
  const expired=sent.at(-1).command;now+=60001;assert.equal((await report({commandId:expired.id})).status,409);
  assert.equal((await post({action:'command',participantSid:'PA-3',patch:{connectionRoute:'relay'}})).status,200);
  const rollbackCommand=sent.at(-1).command;participant={...participant,sid:'PA-4'};
  assert.equal((await report({commandId:rollbackCommand.id,participantSid:'PA-3',error:'Original TURN request failed'})).status,200,'negative ACK stays bound to the exact pending old-session command when rollback already rejoined');
  view=await(await get()).json();assert.equal(view.result.ok,false);assert.equal(view.state,undefined,'old-session result does not spoof the new participant state');

  assert.deepEqual(protocol.parseGuestMediaSettingsPatch({micGain:0,listenGain:100,screenShareEnabled:false}),{micGain:0,listenGain:100,screenShareEnabled:false});
  for(const patch of [{micGain:-1},{micGain:201},{listenGain:101},{listenGain:NaN},{listenGain:'100'},{screenShareEnabled:true}]) assert.equal(protocol.parseGuestMediaSettingsPatch(patch),undefined,'reject invalid gain and unsolicited screen start');
  assert.equal((await report({state:{...state,micGain:75,listenGain:75,screenShareEnabled:true}})).status,200);
  // Clear the preceding old-session failure before testing a new command.
  const gainResponse=await post({action:'command',participantSid:participant.sid,patch:{micGain:85,listenGain:90,screenShareEnabled:false}});
  assert.equal(gainResponse.status,200);const gainCommand=(await gainResponse.json()).command;
  assert.equal((await report({commandId:gainCommand.id,state:{...state,micGain:75,listenGain:90,screenShareEnabled:true}})).status,200);
  view=await(await get()).json();assert.equal(view.result.ok,false,'ACK must confirm requested gain and stopped screen');

  const cameraCapture={mode:'custom',resolution:'1920x1080',frameRate:'29.97'};
  for (const [cameraState,ok] of [[{},false],[{cameraCapture,cameraCaptureSupported:false},false],[{cameraCapture,cameraCaptureSupported:true},false],[{cameraCapture,cameraCaptureSupported:true,actualCameraCapture:{width:1280,height:720,frameRate:30}},true],[{cameraCapture,cameraCaptureSupported:true,videoEnabled:false},true]]) {
    assert.equal((await post({action:'command',participantSid:participant.sid,patch:{cameraCapture}})).status,200);
    assert.deepEqual(JSON.parse(participant.metadata).cameraCapture,cameraCapture,'staff capture intent persists in authoritative participant metadata');
    const cameraCommand=sent.at(-1).command;
    assert.equal((await report({commandId:cameraCommand.id,state:{...state,...cameraState}})).status,200);
    view=await(await get()).json();assert.equal(view.result.ok,ok,'capture ACK confirms settings and active actual values, or saved camera-off choice');
  }
  const bytes=value=>new TextEncoder().encode(JSON.stringify(value));const valid={id:'control-id',participantSid:'PA-3',issuedAt:now,expiresAt:now+60000,patch:{audioProfile:'raw'}};
  assert.ok(protocol.parseGuestMediaSettingsCommand(bytes(valid),undefined,protocol.GUEST_MEDIA_SETTINGS_TOPIC,'PA-3',now));
  for(const [packet,sender,topic,sid] of [[valid,{identity:'guest-one'},protocol.GUEST_MEDIA_SETTINGS_TOPIC,'PA-3'],[valid,undefined,'wrong','PA-3'],[valid,undefined,protocol.GUEST_MEDIA_SETTINGS_TOPIC,'PA-4'],[{...valid,expiresAt:now-1},undefined,protocol.GUEST_MEDIA_SETTINGS_TOPIC,'PA-3'],[{...valid,patch:{audioProfile:'raw',enabled:true}},undefined,protocol.GUEST_MEDIA_SETTINGS_TOPIC,'PA-3']])assert.equal(protocol.parseGuestMediaSettingsCommand(bytes(packet),sender,topic,sid,now),undefined);
  const old=store.guestMediaControlEntry('ttl-test');old.state=state;now+=900000;assert.equal(store.guestMediaControlEntry('ttl-test').state,undefined,'inactive status records expire');
  store.guestMediaControlEntry('lru-first').state=state;for(let i=0;i<2048;i++){now++;store.guestMediaControlEntry(`lru-${i}`);}assert.equal(store.guestMediaControlEntry('lru-first').state,undefined,'hard cap evicts oldest records even before TTL');
  console.log('PASS: authenticated room-scoped guest settings, exact session/nonce/expiry checks, truthful ACK/offline errors, server-only transport, bounded status cache');
})().catch(error=>{console.error(error);process.exitCode=1;});
