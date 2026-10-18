const assert=require('node:assert/strict');
const {load}=require('./load-typescript.cjs');
const sdk=require('livekit-server-sdk');const {NextRequest}=require('next/server');
const key='chat-test',secret='synthetic-local-only-secret-at-least32';process.env.LIVEKIT_API_KEY=key;process.env.LIVEKIT_API_SECRET=secret;
const metadata={role:'guest',studioId:'studio-default',roomDisplayName:'Test',roomChatAssociation:'assoc-one',transferSessionId:'nonce-one'};
let connected=true,nonce='nonce-one',managed=null;
const api=load('../app/api/room-chat/route.ts',{
 'livekit-server-sdk':{...sdk,RoomServiceClient:class{async getParticipant(){if(!connected)throw Error('offline');return{identity:'guest-one',name:'Live caster',sid:'PA_live',metadata:JSON.stringify({...metadata,transferSessionId:nonce}),permission:{canPublishData:true}};}}},
 '@/lib/room-store':{readRooms:async()=>[{name:'Test',slotAssociationId:'assoc-one'}]},
 '@/lib/room-studio-access':{canHostNamedRoom:async()=>false},'@/lib/room-admin':{isRoomAdmin:async()=>false},'@/lib/moderator-access':{isModerator:async()=>false},
 '@/lib/guest-admission-store':{managedGuestIdentity:async()=>managed},
 '@/lib/room-chat-store':{ROOM_CHAT_RETENTION_MS:86400000,readRoomChat:async()=>[],appendRoomChat:async(_scope,data)=>({...data,timestamp:Date.now()})},
});
async function mint(ttl,chat=false){const token=new sdk.AccessToken(chat?key+':room-chat':key,secret,{identity:'guest-one',ttl,metadata:JSON.stringify({...metadata,...(chat?{roomChatOnly:true}:{})})});token.addGrant({room:'Test',roomJoin:!chat,canPublish:!chat,canSubscribe:!chat,canPublishData:!chat});return token.toJwt();}
const req=(token,credential=false)=>new NextRequest('http://localhost/api/room-chat?room=Test&studioId=studio-default'+(credential?'&credential=1':''),{headers:{host:'localhost',origin:'http://localhost',authorization:'Bearer '+token}});
(async()=>{
 const expired=await mint(-30);
 await assert.rejects(new sdk.TokenVerifier(key,secret).verify(expired,0),'real SDK refuses expired media credential');
 assert.equal((await api.GET(req(expired))).status,403,'expired media JWT cannot read chat directly');
 const recovered=await api.GET(req(expired,true));assert.equal(recovered.status,200,'current live guest recovers HTTP-only chat after network gap');
 const data=await recovered.json();assert.equal(data.identity,'guest-one');
 await assert.rejects(new sdk.TokenVerifier(key,secret).verify(data.token),'chat token cannot authorize LiveKit or ordinary APIs');
 const claims=await new sdk.TokenVerifier(key+':room-chat',secret).verify(data.token);assert.equal(claims.video.roomJoin,false);assert.equal(claims.video.canPublish,false);assert.equal(claims.video.canPublishData,false);
 assert.equal((await api.GET(req(data.token))).status,200);
 assert.equal((await api.GET(req(await mint(-20,true),true))).status,200,'expired narrow chat token can recover same live guest session');
 connected=false;assert.equal((await api.GET(req(expired,true))).status,401);connected=true;
 nonce='another-session';assert.equal((await api.GET(req(expired,true))).status,401);nonce='nonce-one';
 managed={state:'closed'};assert.equal((await api.GET(req(expired,true))).status,401,'kicked sessions cannot renew despite a remaining participant');managed=null;
 assert.equal((await api.GET(req(await mint(-90000),true))).status,401,'expiration recovery is bounded');
 console.log('PASS: real expired JWT recovery, distinct chat issuer/no media grants, current live nonce/kick/offline checks and bounded grace');
})().catch(e=>{console.error(e);process.exitCode=1;});
