// Actual SDK Room events + owner authenticated client. Only HTTP/SFU transport is replaced.
const assert=require('node:assert/strict'),{Room,RoomEvent,RemoteParticipant}=require('livekit-client'),{load}=require('./load-typescript.cjs');
const topic='castlink.remote-pc.controls.v1',encode=value=>new TextEncoder().encode(JSON.stringify(value)),decode=value=>JSON.parse(new TextDecoder().decode(value));
const owner={identity:'guest-owner',sid:'PA_owner'},helper={identity:'remote-pc-helper',sid:'PA_helper'},caster={identity:'guest-controller',sid:'PA_controller'};
const source={sessionId:'session',generation:'generation',captureId:'capture',studioId:'studio',room:'room',owner,helper,sourceKind:'window',name:'Owned window',videoTrackSid:'TR_video',geometry:{width:800,height:600,revision:1}};
const session={purpose:'remote-pc-v1',id:'session',generation:'generation',revision:3,owner,phase:'sharing',source};
const settle=async()=>{for(let i=0;i<6;i++)await new Promise(setImmediate);};
function sdkRoom(principal){const room=new Room();room.state='connected';Object.assign(room.localParticipant,principal);return room;}
function participant(room,principal,name){const p=new RemoteParticipant({},principal.sid,principal.identity,name);room.remoteParticipants.set(p.identity,p);return p;}
(async()=>{
 const room=sdkRoom(owner),helperParticipant=participant(room,helper,'Technical helper');participant(room,caster,'Caster');
 const requests=[],sent=[];let rejectRead=false,holdAction,finishAction,current=structuredClone(session);
 const savedFetch=global.fetch;global.fetch=async(_url,options)=>{const body=JSON.parse(options.body);requests.push(body);assert.equal(options.headers.Authorization,'Bearer owner-browser-only');if(body.action==='read'&&rejectRead)throw Error('API unavailable');if(body.action==='delegate'&&holdAction)await new Promise(resolve=>finishAction=resolve);return{ok:true,json:async()=>({serverTime:Date.now(),...(body.action==='read'?{sessions:[current],sources:[current.source]}:{session:current})})};};
 room.localParticipant.publishData=async(bytes,options)=>sent.push({frame:decode(bytes),options});
 const client=load('../lib/remote-pc-client.ts'),close=client.connectRemotePc(room,{token:'owner-browser-only',studioId:'studio',room:'room'});
 try{
  await settle();const state=sent.find(value=>value.options.topic===topic)?.frame;
  assert.ok(state,'fresh authenticated owner read must advertise controls to its exact paired helper');
  assert.deepEqual(sent[0].options,{reliable:true,topic,destinationIdentities:['remote-pc-helper']});
  assert.equal(state.type,'state');assert.equal(state.captureId,'capture');assert.equal(state.revision,3);assert.equal(state.source.kind,'window');assert.equal(state.casters[0].sid,'PA_controller');assert.equal(state.casters.length,1,'technical helper excluded');
  assert.equal(JSON.stringify(sent).includes('owner-browser-only'),false,'owner bearer never enters UI transport');
  const intent=(seq,patch={})=>({v:1,type:'action',sessionId:'session',generation:'generation',captureId:'capture',revision:3,stateSeq:state.seq,expiresAt:state.expiresAt,seq,action:'delegate',controller:caster,...patch});
  const emit=(frame,sender=helperParticipant,wireTopic=topic)=>room.emit(RoomEvent.DataReceived,encode(frame),sender,undefined,wireTopic);
  const mutations=()=>requests.filter(body=>body.action!=='read');
  for(const patch of [{captureId:'old'},{generation:'old'},{revision:2},{controller:{...caster,sid:'PA_old'}},{extra:'forbidden'},{expiresAt:Date.now()-1}])emit(intent(1,patch));
  emit(intent(1),{...helperParticipant,sid:'PA_replaced'});emit(intent(1),{...helperParticipant,identity:'remote-pc-foreign'});emit(intent(1),participant(room,{identity:'guest-attacker',sid:'PA_attacker'},'Attacker'));emit(intent(1),helperParticipant,'castlink.remote-pc.input.v1');
  room.emit(RoomEvent.DataReceived,new Uint8Array(4097),helperParticipant,undefined,topic);await settle();assert.equal(mutations().length,0,'foreign/stale/malformed intents cannot create authority');
  holdAction=true;emit(intent(1));await settle();assert.equal(mutations().length,1,'actual helper UI delegates through owner authenticated API');assert.deepEqual(mutations()[0],{purpose:'remote-pc-v1',studioId:'studio',room:'room',action:'delegate',sessionId:'session',generation:'generation',revision:3,controllerIdentity:'guest-controller',controllerSid:'PA_controller'});
  emit(intent(1));emit(intent(2));await settle();assert.equal(mutations().length,1,'duplicate and parallel UI clicks cannot create multiple grants');finishAction();await settle();
  emit(intent(2));await settle();assert.equal(mutations().length,1,'a rejected busy intent cannot replay later');
  rejectRead=true;await new Promise(resolve=>setTimeout(resolve,290));emit(intent(3));await settle();assert.equal(mutations().length,1,'API loss disables authority relay immediately');rejectRead=false;
  room.state='disconnected';room.emit(RoomEvent.Disconnected);emit(intent(4));await settle();assert.equal(mutations().length,1,'disconnect disables relay');
 }finally{close();global.fetch=savedFetch;}
 assert.equal(room.listenerCount(RoomEvent.DataReceived),0,'owner relay handler is cleaned up');
 const relay=load('../lib/remote-pc-controls-relay.ts');
 const crowded=sdkRoom(owner),crowdedFrames=[];participant(crowded,helper,'Helper');for(let i=0;i<70;i++)participant(crowded,{identity:'guest-'+String(i).padStart(3,'0'),sid:'PA_caster'+i},'Имя участника '.repeat(9));crowded.localParticipant.publishData=async(bytes)=>crowdedFrames.push(bytes);
 const crowdedRelay=relay.createRemotePcOwnerControlsRelay({room:crowded,read:()=>({sessions:[session],ready:true,updatedAt:Date.now()}),request:async()=>{throw Error('No user click');}});
 try{crowdedRelay.sync();assert.equal(crowdedFrames.length,1,'large roster must keep a usable bounded controls state');assert.ok(crowdedFrames[0].byteLength<=4096);const bounded=decode(crowdedFrames[0]);assert.equal(bounded.moreCasters,true,'omitted casters must be disclosed');assert.ok(bounded.casters.length>0&&bounded.casters.length<70);assert.equal(bounded.source.name,'Owned window');}finally{crowdedRelay.dispose();}
 const restarted=relay.createRemotePcOwnerControlsRelay({room:crowded,read:()=>({sessions:[session],ready:true,updatedAt:Date.now()}),request:async()=>{}});try{restarted.sync();assert.ok(decode(crowdedFrames.at(-1)).seq>decode(crowdedFrames[0]).seq,'reauthenticating the same SDK Room must not reset the state stream and permanently disable the existing native panel');}finally{restarted.dispose();}
 const clock={now:1000},publisherRoom=sdkRoom(helper),ownerParticipant=participant(publisherRoom,owner,'Owner'),outgoing=[],views=[],baselineDisconnected=publisherRoom.listenerCount(RoomEvent.Disconnected);
 publisherRoom.localParticipant.publishData=async(bytes,options)=>outgoing.push({frame:decode(bytes),options});
 const publisher=relay.createRemotePcPublisherControlsRelay({room:publisherRoom,binding:{sessionId:'session',generation:'generation',owner},captureId:'capture',now:()=>clock.now,onState:value=>views.push(value)});
 const good={v:1,type:'state',sessionId:'session',generation:'generation',captureId:'capture',revision:3,owner,helper,seq:1,expiresAt:1800,source:{name:'Owned window',kind:'window',inputState:'ready',pointerReady:true},status:'local',controller:null,casters:[{...caster,name:'Caster'}],moreCasters:false,busy:false,error:false,locale:'ru'};
 const stateEvent=(value,sender=ownerParticipant)=>publisherRoom.emit(RoomEvent.DataReceived,encode(value),sender,undefined,topic);
 try{
  stateEvent(good,{...ownerParticipant,sid:'PA_old'});stateEvent({...good,captureId:'old'});stateEvent({...good,inputKey:'forbidden'});assert.equal(views.filter(Boolean).length,0,'publisher rejects spoofed owner and unknown/private state fields');
  stateEvent(good);assert.equal(views.at(-1).controller,null);assert.equal(publisher.action('delegate',caster),true);await settle();assert.equal(outgoing.length,1);assert.deepEqual(outgoing[0].options,{reliable:true,topic,destinationIdentities:['guest-owner']});assert.equal(outgoing[0].frame.controller.sid,'PA_controller');assert.equal(publisher.action('delegate',caster),false,'single pending click');
  stateEvent({...good,seq:2,revision:4,status:'activating',controller:{...caster,name:'Caster'}});assert.equal(views.at(-1).status,'activating','owner API response is not an active-control claim');
  stateEvent({...good,seq:1});assert.equal(views.at(-1).revision,4,'delayed previous state cannot restore old grant');
  clock.now=1801;assert.equal(publisher.action('revoke'),false,'expired owner state cannot authorize a native menu action');
  publisherRoom.emit(RoomEvent.Disconnected);assert.equal(views.at(-1),undefined);assert.equal(outgoing.length,1,'no queued action replay on disconnect');
 }finally{publisher.dispose();}
 assert.equal(publisherRoom.listenerCount(RoomEvent.DataReceived),0);assert.equal(publisherRoom.listenerCount(RoomEvent.Disconnected),baselineDisconnected);
 // Exercise both actual relay ends together through SDK DataReceived events.
 // Replacing only network delivery proves the published state/action schemas agree.
 const ownerPeer=sdkRoom(owner),helperPeer=sdkRoom(helper),helperInOwner=participant(ownerPeer,helper,'Helper'),ownerInHelper=participant(helperPeer,owner,'Owner'),controllerInOwner=participant(ownerPeer,caster,'Caster'),roundtrip=[];let ui,ready=true,time=2000,authoritative=structuredClone(session);
 ownerPeer.localParticipant.publishData=async(bytes,options)=>{assert.ok(bytes.byteLength<=4096);assert.deepEqual(options.destinationIdentities,[helper.identity]);helperPeer.emit(RoomEvent.DataReceived,bytes,ownerInHelper,undefined,topic);};
 helperPeer.localParticipant.publishData=async(bytes,options)=>{assert.deepEqual(options.destinationIdentities,[owner.identity]);ownerPeer.emit(RoomEvent.DataReceived,bytes,helperInOwner,undefined,topic);};
 const nativeRelay=relay.createRemotePcPublisherControlsRelay({room:helperPeer,binding:{sessionId:'session',generation:'generation',owner},captureId:'capture',now:()=>time,onState:value=>ui=value});
 const ownerRelay=relay.createRemotePcOwnerControlsRelay({room:ownerPeer,read:()=>({sessions:[authoritative],ready,updatedAt:2000}),now:()=>time,request:async body=>{roundtrip.push(body);authoritative={...authoritative,revision:4,grant:{id:'grant',revision:4,phase:'activating',controller:caster}};}});
 try{
  ownerRelay.sync();assert.equal(ui.status,'local');assert.equal(nativeRelay.action('delegate',caster),true);await settle();assert.equal(roundtrip.length,1);assert.equal(roundtrip[0].controllerSid,'PA_controller');assert.equal(ui.status,'activating','full path waits for actual native ACK');
  authoritative={...authoritative,grant:{...authoritative.grant,phase:'active'}};ownerRelay.sync();assert.equal(ui.status,'active');
  ready=false;assert.equal(nativeRelay.action('revoke'),true,'a fresh-looking native menu can race API loss');await settle();assert.equal(roundtrip.length,1,'owner refuses the race without an authenticated current read');time=3001;assert.equal(nativeRelay.action('revoke'),false,'public native state expires within one second');
  ready=true;time=2001;authoritative={...authoritative,source:{...authoritative.source,sourceKind:'screen'}};ownerRelay.sync();assert.equal(ui.source.kind,'screen','same controls support monitor and window');
  controllerInOwner.sid='PA_replacement';assert.equal(nativeRelay.action('delegate',caster),true);await settle();assert.equal(roundtrip.length,1,'participant SID replacement between menu render and click cannot transfer');
  nativeRelay.dispose();ownerRelay.dispose();
 }finally{nativeRelay.dispose();ownerRelay.dispose();}
 // A new capture must not inherit an unresolved HTTP flight from the old one.
 const swapRoom=sdkRoom(owner),oldSender=participant(swapRoom,helper,'Old helper'),newHelper={identity:'remote-pc-new',sid:'PA_new'},newSender=participant(swapRoom,newHelper,'New helper');participant(swapRoom,caster,'Caster');
 let activeSession=structuredClone(session);const swapFrames=[],flights=[];
 swapRoom.localParticipant.publishData=async bytes=>swapFrames.push(decode(bytes));
 const swap=relay.createRemotePcOwnerControlsRelay({room:swapRoom,read:()=>({sessions:[activeSession],ready:true,updatedAt:Date.now()}),request:body=>new Promise((resolve,reject)=>flights.push({body,resolve,reject}))});
 const click=(state,sender)=>swapRoom.emit(RoomEvent.DataReceived,encode({v:1,type:'action',sessionId:state.sessionId,generation:state.generation,captureId:state.captureId,revision:state.revision,seq:1,stateSeq:state.seq,expiresAt:state.expiresAt,action:'delegate',controller:caster}),sender,undefined,topic);
 try{
  swap.sync();click(swapFrames.at(-1),oldSender);await settle();assert.equal(flights.length,1);
  activeSession={...session,id:'new-session',generation:'new-generation',source:{...source,sessionId:'new-session',generation:'new-generation',captureId:'new-capture',helper:newHelper}};
  swap.sync();assert.equal(swapFrames.at(-1).busy,false,'replacement capture must not inherit old HTTP busy');
  click(swapFrames.at(-1),newSender);await settle();assert.equal(flights.length,2,'new capture remains usable while old request is pending');
  flights[0].reject(Error('Old capture failed'));await settle();assert.equal(swapFrames.at(-1).busy,true,'old finally cannot unlock current capture flight');assert.equal(swapFrames.at(-1).error,false,'old failure cannot taint new capture');
  flights[1].resolve({});await settle();assert.equal(swapFrames.at(-1).busy,false);
 }finally{for(const flight of flights)flight.resolve({});swap.dispose();}
 console.log('PASS actual SDK owner/client and publisher controls relay: authenticated exact authority, secret-free bounded reliable UI, sender/scope/SID validation, replay/busy/API-loss/disconnect gates and cleanup');
})().catch(error=>{console.error(error);process.exitCode=1});
