const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
const dataDir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-private-talkback-'));process.env.STUDIOLINK_DATA_DIR=dataDir;
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
let role='guest',origin=true,online=true,now=Date.now();const realNow=Date.now;Date.now=()=>now;
const removed=[],updates=[],issued=[],muted=[],sent=[];
const participant={identity:'guest-one',sid:'PA-one',metadata:JSON.stringify({role:'guest',studioId:'tenant-one'}),tracks:[{sid:'TR-mic',source:2,muted:false}],permission:{canPublish:true,canSubscribe:true,canPublishData:true,canPublishSources:[]}};
class NextResponse extends Response{static json(body,init){return new Response(JSON.stringify(body),init);}}
class RoomServiceClient{async getParticipant(room,identity){if(!online||room!=='tenant-one/main'||identity!=='guest-one')throw Object.assign(Error('missing'),{code:'not_found'});return participant;}async sendData(room,bytes,_kind,options){sent.push({room,body:JSON.parse(new TextDecoder().decode(bytes)),options});}async createRoom(){} async deleteRoom(room){removed.push(room);}async updateParticipant(room,identity,options){updates.push({room,identity,options});}async mutePublishedTrack(room,identity,sid,mute){muted.push({room,identity,sid,mute});}}
class AccessToken{constructor(key,secret,opts){this.opts=opts;}addGrant(grant){this.grant=grant;}async toJwt(){issued.push({opts:this.opts,grant:this.grant});return 'private-token-'+issued.length;}}
class TokenVerifier{async verify(token){if(token!=='guest-main')throw Error('bad token');return{sub:'guest-one',video:{room:'tenant-one/main'},metadata:participant.metadata};}}
const imports={
'next/server':{NextResponse},'livekit-server-sdk':{RoomServiceClient,AccessToken,TokenVerifier,DataPacket_Kind:{RELIABLE:1},TrackSource:{MICROPHONE:2,CAMERA:1,SCREEN_SHARE:3,SCREEN_SHARE_AUDIO:4}},
'@/lib/access':{sameOrigin:()=>origin},'@/lib/room-studio-access':{canHostNamedRoom:async(_,room,studio)=>role==='owner'&&room==='main'&&studio==='tenant-one'},
'@/lib/room-admin':{isRoomAdmin:async()=>false},'@/lib/moderator-access':{isModerator:async()=>false},'@/lib/room-store':{readRooms:async()=>[{name:'main'}]},
'@/lib/studio-scope':{defaultStudioId:()=> 'tenant-one',validateStudioId:value=>value,mediaRoomName:(studio,room)=>`${studio}/${room}`},
'@/lib/studio-control':{validStudioClient:v=>typeof v==='string'&&v.length>=12},'@/lib/rate-limit':{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})},
};
for(const name of ['studio-scope','rate-limit','room-studio-access'])imports['../../../lib/'+name]=imports['@/lib/'+name];
const original=Module._load;Module._load=function(name,...rest){return name in imports?imports[name]:original.call(this,name,...rest);};
const file=require('node:path').resolve(__dirname,'../app/api/talkback/route.ts');assert.ok(fs.existsSync(file),'private talkback server route must exist');const api=require(file);const participantsApi=require('../app/api/participants/route.ts');Module._load=original;
const body=extra=>({studioId:'tenant-one',room:'main',clientId:'staff-client-one',...extra});
const request=(extra={},token='')=>({headers:new Headers(token?{authorization:`Bearer ${token}`}:{ }),json:async()=>body(extra),nextUrl:{searchParams:new URLSearchParams(body(extra))}});
(async()=>{try{
assert.equal((await api.POST(request({target:'guest-one'}))).status,401,'guest cannot open staff private session');role='owner';origin=false;assert.equal((await api.POST(request({target:'guest-one'}))).status,403);origin=true;
assert.equal((await api.POST(request({target:'guest-one',room:'other'}))).status,401);assert.equal((await api.POST(request({target:'studio-panel-main'}))).status,400);
let result=await api.POST(request({target:'guest-one'}));assert.equal(result.status,200);const session=await result.json();assert.equal(session.active,true);assert.equal(session.restoreMicrophone,true);assert.notEqual(session.roomName,'tenant-one/main');
assert.equal(muted.length,1);assert.ok(!updates[0].options.permission.canPublishSources.includes(2),'server denies main-room microphone publication during private speech');
assert.deepEqual(issued[0].grant.canPublishSources,[2]);assert.equal(issued[0].grant.room,session.roomName);assert.equal(issued[0].grant.canPublishData,false);
assert.equal((await api.GET(request({},'forged'))).status,401);let offer=await(await api.GET(request({},'guest-main'))).json();assert.equal(offer.sessionId,session.sessionId);assert.equal(offer.restoreMicrophone,true);assert.equal(issued.at(-1).grant.room,session.roomName);
assert.equal((await api.GET(request({room:'other'},'guest-main'))).status,403);assert.equal((await api.DELETE(request({sessionId:session.sessionId,clientId:'another-client'}))).status,403,'staff client cannot close another client session');
assert.equal((await api.DELETE(request({sessionId:session.sessionId}))).status,200);assert.ok(removed.includes(session.roomName));assert.deepEqual(updates.at(-1).options.permission,participant.permission);assert.equal((await(await api.GET(request({},'guest-main'))).json()).active,false);
const ended=await api.DELETE(request({sessionId:session.sessionId},'guest-main'));assert.equal((await ended.json()).restoreMicrophone,true,'guest receives authoritative original restore policy after staff ended session');
result=await api.POST(request({target:'guest-one'}));const mutedSession=await result.json();participant.tracks=[];
const remoteMute=await participantsApi.POST(request({action:'media',identity:'guest-one',kind:'audio',enabled:false}));assert.equal(remoteMute.status,200);assert.equal((await remoteMute.json()).tracks,0);
const mutedEnd=await api.DELETE(request({sessionId:mutedSession.sessionId},'guest-main'));assert.equal((await mutedEnd.json()).restoreMicrophone,false,'later explicit mute must override original private restore even with no published mic');
assert.ok(sent.some(packet=>packet.body.kind==='audio'&&packet.body.enabled===false),'mute intent reaches guest even when no publication exists');
assert.equal((await(await api.DELETE(request({sessionId:mutedSession.sessionId},'guest-main'))).json()).restoreMicrophone,false,'idempotent ended-session result retains later mute policy');
participant.tracks=[{sid:'TR-mic',source:2,muted:false}];
result=await api.POST(request({target:'guest-one'}));const closedThenMuted=await result.json();await api.DELETE(request({sessionId:closedThenMuted.sessionId}));participant.tracks=[];
assert.equal((await participantsApi.POST(request({action:'mute',identity:'guest-one'}))).status,200);
assert.equal((await(await api.DELETE(request({sessionId:closedThenMuted.sessionId},'guest-main'))).json()).restoreMicrophone,false,'mute after staff close still cancels the pending guest restore');
participant.tracks=[{sid:'TR-mic',source:2,muted:false}];
const count=issued.length;assert.equal((await api.POST(request({action:'heartbeat',sessionId:session.sessionId}))).status,409);assert.equal(issued.length,count,'closed session cannot obtain more credentials');
result=await api.POST(request({target:'guest-one'}));const expiring=await result.json();now+=60001;assert.equal((await(await api.GET(request({},'guest-main'))).json()).active,false);assert.ok(removed.includes(expiring.roomName),'expired lease closes isolated media room');
result=await api.POST(request({target:'guest-one'}));const gone=await result.json();online=false;assert.equal((await api.POST(request({action:'heartbeat',sessionId:gone.sessionId}))).status,409);assert.ok(removed.includes(gone.roomName),'guest disconnect ends session');
console.log('PASS: private talkback staff/guest room authorization, isolated microphone grants, server main-mic gate, close/expiry/disconnect cleanup');
}finally{Date.now=realNow;fs.rmSync(dataDir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
