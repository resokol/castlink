const assert = require('node:assert/strict');
const fs = require('node:fs'), Module = require('node:module'), ts = require('typescript');
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, file);

let owner=false, admin=false;
const grants=[], subscriptions=[];
let records=[{name:'a',viewerAccessVersion:'viewer-v1',outputAccessVersion:'output-v1',guestInviteVersion:'guest-v1'},{name:'b',viewerAccessVersion:'viewer-b'}];

class NextResponse extends Response { static json(value,init={}) {return new NextResponse(JSON.stringify(value),init);} }
class AccessToken {
  constructor(k,s,options){this.options=options;}
  addGrant(grant){this.grant=grant;grants.push(grant);}
  async toJwt(){return JSON.stringify({sub:this.options.identity,video:this.grant,metadata:this.options.metadata,exp:Math.floor(Date.now()/1000)+300});}
}
class TokenVerifier { async verify(value){return JSON.parse(value);} }
class RoomServiceClient {
  async listParticipants(){return [{identity:'studio-panel-main',tracks:[{sid:'main-video'},{sid:'main-audio'},{sid:'muted',muted:true}]},{identity:'stream-viewer-test',tracks:[]}];}
  async updateSubscriptions(room,id,tracks,on){subscriptions.push({room,id,tracks,on});}
}
const mocks={
  'next/server':{NextResponse},
  'livekit-server-sdk':{AccessToken,TokenVerifier,RoomServiceClient,TrackSource:{CAMERA:2,MICROPHONE:1}},
  '@/lib/access':{
    isStudio:()=>owner,
    sameOrigin:()=>true,
    roomVersion:value=>'legacy-'+String(value||''),
    signAccess:data=>JSON.stringify(data),
    readAccess:value=>{try{return JSON.parse(value);}catch{return null;}},
    accessStudioMatches:(claims,studioId)=>!!claims&&(claims.studio===studioId||(studioId==='studio-default'&&claims.studio===undefined)),
  },
  '@/lib/room-admin':{isRoomAdmin:async(req,room)=>admin&&room==='a'},
  '@/lib/studio-control':{validStudioClient:id=>id==='primary',readStudioState:async()=>({primaryClientId:'primary',epoch:1,leaseUntil:Date.now()+10000})},
  '../../../lib/studio-owner-access':{isStudioOwner:async()=>owner},
  '@/lib/room-store':{
    readRooms:async()=>records,
    ensureRoomAccessVersions:async name=>records.find(r=>r.name===name),
    updateRooms:async change=>(records=change(records)),
  },
};
const load=Module._load;
Module._load=function(name,parent,main){return Object.hasOwn(mocks,name)?mocks[name]:load.call(this,name,parent,main);};
process.env.LIVEKIT_API_KEY='test';process.env.LIVEKIT_API_SECRET='test';
const {POST}=require('../app/api/studio-viewer/route.ts');
async function call(data,token){
  const res=await POST({text:async()=>JSON.stringify(data),headers:{get:name=>name==='authorization'&&token?'Bearer '+token:null}});
  return {status:res.status,data:await res.json()};
}

(async()=>{
  assert.equal((await call({action:'create',room:'a'})).status,403);
  admin=true;
  const result=await call({action:'create',room:'a'});
  assert.equal(result.status,200);
  assert.equal((await call({action:'create',room:'b'})).status,403);
  const invite=new URLSearchParams(new URL(result.data.path,'https://test').hash.slice(1)).get('invite');
  admin=false;

  const first=await call({action:'join',room:'a',invite}), second=await call({action:'join',room:'a',invite});
  assert.equal(first.status,200);
  assert.notEqual(first.data.identity,second.data.identity,'reused invite gives unique viewer identities');
  assert.equal(grants[0].canPublish,false);
  assert.equal(grants[0].canPublishData,false);
  assert.equal(grants[0].canSubscribe,true);
  assert.notEqual(grants[0].room,'a','viewer is confined to isolated studio-only room');
  assert.equal((await call({action:'subscribe',room:'a',invite},first.data.token)).status,200);
  assert.equal(subscriptions.length,0,'isolated room needs no privileged override');
  assert.equal((await call({action:'publisher',room:'a',clientId:'primary',epoch:1})).status,403);

  owner=true;
  assert.equal((await call({action:'publisher',room:'a',clientId:'intruder',epoch:1})).status,403);
  const publisher=await call({action:'publisher',room:'a',clientId:'primary',epoch:1});
  assert.equal(publisher.status,200);
  assert.equal(publisher.data.viewerCount,1);
  const pubClaims=JSON.parse(publisher.data.token);
  assert.equal(pubClaims.video.room,grants[0].room);
  assert.equal(pubClaims.video.canSubscribe,false);
  assert.equal(pubClaims.video.canPublish,true);

  const revoke=await call({action:'revoke',room:'a'});
  assert.equal(revoke.status,200);
  owner=false;
  assert.equal((await call({action:'join',room:'a',invite})).status,403,'explicit revoke invalidates old viewer links');
  assert.equal((await call({action:'join',room:'b',invite})).status,403);
  assert.equal((await call({action:'subscribe',room:'a',invite},JSON.stringify({sub:'guest-a',video:{room:'a'},metadata:'{}'}))).status,403);

  console.log('PASS: studio viewer scope, isolated subscriptions and explicit link revocation');
})().catch(error=>{console.error(error);process.exitCode=1;});
