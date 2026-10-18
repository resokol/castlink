const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const store=require('../lib/guest-session-settings.ts');const realNow=Date.now;let now=realNow(),online=false,privateSession,closedPrivate=0;Date.now=()=>now;
const record={name:'room',creatorAccessId:'immutable-room'},issued=[];
const liveMetadata={role:'guest',studioId:'tenant',studioImageTransform:{zoom:2},videoMaxBitrateKbps:1500,videoRotation:90};
const oldMetadata={role:'guest',studioId:'tenant',admissionId:'admitted-session',admissionGeneration:1,studioImageTransform:{zoom:5},videoMaxBitrateKbps:12000,entrySettings:{audioOnly:false,startMuted:false,noGuestAudio:false}};
class NextResponse extends Response{static json(body,init){return new Response(JSON.stringify(body),init);}}
class TokenVerifier{async verify(){return{sub:'guest-one',name:'Caster',metadata:JSON.stringify(oldMetadata),video:{room:'tenant/room'}};}}
class AccessToken{constructor(_k,_s,opts){this.opts=opts;}addGrant(grant){this.grant=grant;}async toJwt(){issued.push(this);return 'new-token';}}
class RoomServiceClient{async getParticipant(){if(!online)throw Error('offline');return{sid:'PA-new',metadata:JSON.stringify(liveMetadata)};}}
const imports={
'../../../lib/guest-admission-store':{managedGuestIdentity:async()=>null},'../../../lib/slot-room-scope':{slotRoomAssociation:()=> 'immutable-room',slotRoomVersion:()=> 'version'},
'node:crypto':require('node:crypto'),'next/server':{NextResponse},'livekit-server-sdk':{AccessToken,TokenVerifier,RoomServiceClient,TrackSource:{MICROPHONE:1,CAMERA:2,SCREEN_SHARE:3,SCREEN_SHARE_AUDIO:4}},
'../../../lib/guest-session-settings':store,'../../../lib/talkback-session':{loadPrivateTalkbackSessions:async()=>{},privateTalkbackForGuest:()=>privateSession,serializeTalkback:fn=>fn(),closePrivateTalkbackSession:async()=>{closedPrivate++;privateSession=undefined;}},
'../../../lib/guest-entry-settings':require('../lib/guest-entry-settings.ts'),'../../../lib/reserve-source':{sourceSessionMoved:async()=>false},
'../../../lib/staff-display-name':{},'../../../lib/node-admission':{},'../../../lib/transfer-authority':{verifiedTransferAuthority:async()=>null},
'../../../lib/connection-route-config':{guestConnectionRoutes:()=>({})},'../../../lib/rate-limit':{consumeRateLimit:()=>({ok:true})},
'../../../lib/room-studio-access':{verifiedRoomStudioSession:()=>null},'../../../lib/studio-owner-access':{isStudioOwner:async()=>false},
'../../../lib/studio-scope':{defaultStudioId:()=> 'tenant',validateStudioId:v=>v,mediaRoomName:(s,r)=>s+'/'+r},
'../../../lib/server-log':{requestId:()=>'',requestHeaders:(_,extra)=>extra,serverLog(){}},
'@/lib/access':{canJoin:()=>true,readAccess:()=>null,accessStudioMatches:()=>false,roomVersion:()=>'',guestEntryFromAccess:()=>({})},
'@/lib/room-store':{readRooms:async()=>[record]},'@/lib/room-admin':{},'@/lib/moderator-access':{},'@/lib/studio-control':{},
};
const mod={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/api/token/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:n=>{assert.ok(n in imports,n);return imports[n];},process:{env:{LIVEKIT_API_KEY:'key',LIVEKIT_API_SECRET:'secret'}},Date,Response});
const request=()=>mod.exports.GET({nextUrl:new URL('https://app.test/api/token?studioId=tenant&room=room&role=guest&identity=guest-one'),headers:new Headers({authorization:'Bearer old-token'})});
(async()=>{try{
const media={audioProfile:'raw',connectionRoute:'relay',videoCodec:'av1',micGain:85,listenGain:40};store.rememberGuestSessionSettings('tenant',record,'guest-one',liveMetadata,media);store.markGuestSessionDisconnected('tenant',record,'guest-one');
let response=await request();assert.equal(response.status,200);assert.deepEqual((await response.json()).guestSettings.media,media);let metadata=JSON.parse(issued.at(-1).opts.metadata);assert.deepEqual(metadata.studioImageTransform,{zoom:2});assert.equal(metadata.videoMaxBitrateKbps,1500,'latest server setting wins over stale bearer metadata');
now+=15*60_000;response=await request();assert.equal((await response.json()).guestSettings,undefined);metadata=JSON.parse(issued.at(-1).opts.metadata);assert.equal(metadata.studioImageTransform,undefined);assert.equal(metadata.videoMaxBitrateKbps,undefined,'expired server snapshot cannot be revived by old bearer');
online=true;response=await request();metadata=JSON.parse(issued.at(-1).opts.metadata);assert.equal(metadata.videoRotation,90,'live server metadata restored even without cached entry');
privateSession={targetSid:'PA-new',expiresAt:now+60000,originalPermission:{canPublish:true,canPublishSources:[]}};await request();assert.deepEqual(Array.from(issued.at(-1).grant.canPublishSources),[2,3,4],'renewal cannot bypass private main microphone gate');
privateSession={targetSid:'PA-new',expiresAt:now+60000,originalPermission:{canPublish:true,canPublishSources:[1]}};await request();assert.equal(issued.at(-1).grant.canPublish,false,'empty allowed-source list must disable publication instead of granting every source');
privateSession={targetSid:'PA-old',expiresAt:now+60000,originalPermission:{canPublish:true,canPublishSources:[]}};await request();assert.equal(closedPrivate,1,'SID change closes private room before issuing unrestricted replacement main token');assert.equal(issued.at(-1).grant.canPublishSources,undefined);
console.log('PASS: guest renewal restores authoritative settings, expires offline data and preserves private microphone gate');
}finally{Date.now=realNow;}})().catch(e=>{console.error(e);process.exitCode=1;});
