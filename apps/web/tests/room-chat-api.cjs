const assert = require('node:assert/strict');
const { load } = require('./load-typescript.cjs');
const { NextRequest } = require('next/server');
process.env.LIVEKIT_API_KEY='test'; process.env.LIVEKIT_API_SECRET='test-secret';
const scope={studioId:'studio-default',roomAssociation:'assoc-one'};
let rows=[], staff=false, connected=true, roomAssociation='assoc-one';
let claims={sub:'guest-one',name:'Untrusted old name',video:{room:'Test',canPublishData:true},metadata:JSON.stringify({role:'guest',studioId:'studio-default',roomDisplayName:'Test',roomChatAssociation:'assoc-one'})};
const api=load('../app/api/room-chat/route.ts',{
 '@/lib/guest-admission-store':{managedGuestIdentity:async()=>null},
 'livekit-server-sdk':{TokenVerifier:class{async verify(token){if(token!=='good')throw Error('invalid');return claims;}},RoomServiceClient:class{async getParticipant(){if(!connected)throw Error('offline');return {identity:claims.sub,sid:'PA_live',name:'Current name',metadata:claims.metadata,permission:{canPublishData:true}};}}},
 '@/lib/room-store':{readRooms:async()=>[{name:'Test',slotAssociationId:roomAssociation}]},
 '@/lib/room-studio-access':{canHostNamedRoom:async()=>staff},
 '@/lib/room-admin':{isRoomAdmin:async()=>false},
 '@/lib/moderator-access':{isModerator:async()=>false},
 '@/lib/room-chat-store':{ROOM_CHAT_RETENTION_MS:86400000,readRoomChat:async s=>{assert.equal(s.roomAssociation,roomAssociation);return rows;},appendRoomChat:async(s,data)=>{assert.deepEqual(s,scope);const result={...data,timestamp:Date.now()};rows.push(result);return result;}},
});
const req=(method,body,token='good',query='')=>new NextRequest('http://localhost/api/room-chat?room=Test&studioId=studio-default'+query,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),host:'localhost','content-type':'application/json',origin:'http://localhost'},...(body?{body:JSON.stringify(body)}:{})});
(async()=>{
 assert.equal((await api.GET(req('GET',null,''))).status,403);
 assert.equal((await api.POST(req('POST',{id:'7d046a83-3f98-4e63-aa19-12960dab8965',message:'hello'},'bad'))).status,401);
 const posted=await api.POST(req('POST',{id:'7d046a83-3f98-4e63-aa19-12960dab8965',message:'hello',identity:'victim',name:'Fake',timestamp:1}));
 assert.equal(posted.status,200);const data=await posted.json();assert.equal(data.message.identity,'guest-one');assert.equal(data.message.name,'Current name');assert.ok(data.message.timestamp>1);
 assert.equal((await api.GET(req('GET'))).status,200);
 assert.equal((await api.GET(req('GET',null,'good','&format=txt'))).status,403,'caster cannot export staff history');
 connected=false;assert.equal((await api.GET(req('GET'))).status,403,'disconnected participant cannot use old JWT');connected=true;
 const original=claims;claims={...original,metadata:JSON.stringify({...JSON.parse(original.metadata),role:'output'})};assert.equal((await api.GET(req('GET'))).status,403);claims=original;
 claims={...original,metadata:JSON.stringify({...JSON.parse(original.metadata),role:'studio-moderator'})};assert.equal((await api.GET(req('GET'))).status,403,'revoked staff cookie denied even if LiveKit participant remains');assert.equal((await api.POST(req('POST',{id:'7d046a83-3f98-4e63-aa19-12960dab8965',message:'forbidden'}))).status,401);claims=original;
 roomAssociation='assoc-recreated';assert.equal((await api.GET(req('GET'))).status,403,'old room token cannot read recreated room');roomAssociation='assoc-one';
 staff=true;const download=await api.GET(req('GET',null,'','&format=txt'));assert.equal(download.status,200);assert.match(download.headers.get('content-type'),/text\/plain/);assert.match(download.headers.get('content-disposition'),/attachment/);assert.match(await download.text(),/Current name.*hello/);
 assert.equal((await api.POST(req('POST',{id:'bad',message:'text'}))).status,400);
 assert.equal((await api.POST(req('POST',{id:'7d046a83-3f98-4e63-aa19-12960dab8965',message:'x'.repeat(4001)}))).status,400);
 const cross=req('POST',{id:'7d046a83-3f98-4e63-aa19-12960dab8965',message:'text'});cross.headers.set('origin','http://other');assert.equal((await api.POST(cross)).status,403);
 console.log('PASS: room chat token/current participant/scope/author/body/export authorization');
})().catch(error=>{console.error(error);process.exitCode=1;});
