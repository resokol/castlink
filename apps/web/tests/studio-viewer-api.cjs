const assert = require('node:assert/strict');
const fs = require('node:fs'), Module = require('node:module'), ts = require('typescript');
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText, file);

let owner=false, admin=false;
const grants=[], subscriptions=[], invalidatedDiagnosticRooms=[];
let records=[{name:'a',transferRoomId:'immutable-room-a',viewerAccessVersion:'viewer-v1',outputAccessVersion:'output-v1',guestInviteVersion:'guest-v1'},{name:'b',transferRoomId:'immutable-room-b',viewerAccessVersion:'viewer-b'}];

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
    signAccess:(data,lifetime=86400,cap=Infinity)=>JSON.stringify({...data,exp:Math.min(Date.now()+lifetime*1000,cap)}),
    readAccess:value=>{try{return JSON.parse(value);}catch{return null;}},
    accessStudioMatches:(claims,studioId)=>!!claims&&(claims.studio===studioId||(studioId==='studio-default'&&claims.studio===undefined)),
  },
  '@/lib/room-admin':{isRoomAdmin:async(req,room)=>admin&&room==='a'},
  '@/lib/studio-control':{validStudioClient:id=>id==='primary',readStudioState:async()=>({primaryClientId:'primary',epoch:1,leaseUntil:Date.now()+10000})},
  '../../../lib/studio-owner-access':{isStudioOwner:async()=>owner},
  './studio-owner-access':{isStudioOwner:async()=>owner},
  '../../../lib/room-studio-access':{canHostNamedRoom:async()=>owner,verifiedRoomStudioSession:()=>null,requireRoomCreatorUnchanged:()=>{}},
  '@/lib/room-store':{
    invalidateDiagnosticReceipts:async(studioId,room)=>{invalidatedDiagnosticRooms.push({studioId,room});},
    readRooms:async()=>records,
    ensureRoomAccessVersions:async name=>records.find(r=>r.name===name),
    updateRooms:async change=>(records=change(records)),
  },
};
mocks['./access']=mocks['@/lib/access'];
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
  assert.deepEqual(invalidatedDiagnosticRooms,[{studioId:'studio-default',room:'a'}],'ordinary viewer invite invalidates only its studio/room diagnostic receipts');
  assert.equal((await call({action:'create',room:'b'})).status,403);
  const invite=new URLSearchParams(new URL(result.data.path,'https://test').hash.slice(1)).get('invite');
  admin=false;

  const first=await call({action:'join',room:'a',invite}), second=await call({action:'join',room:'a',invite});
  assert.equal(first.status,200);
  assert.notEqual(first.data.identity,second.data.identity,'reused invite gives unique viewer identities');
  const viewerClaims=JSON.parse(first.data.token), viewerMetadata=JSON.parse(viewerClaims.metadata);
  assert.equal(viewerMetadata.transferAuthorization?.kind,'studio-viewer','viewers have a distinct transfer authorization');
  assert.equal(viewerMetadata.transferAuthorization.roomId,'immutable-room-a');
  assert.equal(viewerMetadata.transferAuthorization.credentialVersion,'viewer-v1');
  assert.equal(viewerMetadata.transferAuthorization.expiresAt,JSON.parse(invite).exp,'transfer authorization retains original invite expiry');
  assert.equal(viewerMetadata.transferSessionId,first.data.identity.slice('stream-viewer-'.length));
  assert.equal(grants[0].canUpdateOwnMetadata,false,'roster authorization cannot be replaced by the viewer');
  const expiring={...viewerClaims,exp:Math.floor(Date.now()/1000)+30};
  const renewal=await call({action:'subscribe',room:'a',invite},JSON.stringify(expiring));
  assert.equal(renewal.status,200);
  assert.equal(JSON.parse(renewal.data.token).sub,first.data.identity);
  assert.deepEqual(JSON.parse(JSON.parse(renewal.data.token).metadata),viewerMetadata,'renewal preserves signed transfer session and authorization');
  const {issueTransferredViewerInvite}=require('../lib/studio-viewer-access.ts');
  const movedInvite=issueTransferredViewerInvite('studio-default',records[0],first.data.identity,Date.now()+60000);
  const moved=await call({action:'join',room:'a',invite:movedInvite});
  assert.equal(moved.status,200);
  assert.equal(moved.data.identity,first.data.identity,'verified handoff preserves each individual viewer identity');
  assert.ok(JSON.parse(movedInvite).exp<=Date.now()+60000);
  assert.equal((await call({action:'join',room:'b',invite:movedInvite})).status,403);
  const wrongSession={...viewerClaims,metadata:JSON.stringify({...viewerMetadata,transferSessionId:'another'})};
  assert.equal((await call({action:'subscribe',room:'a',invite},JSON.stringify(wrongSession))).status,403);
  const staleAuthority={...viewerClaims,metadata:JSON.stringify({...viewerMetadata,transferAuthorization:{...viewerMetadata.transferAuthorization,credentialVersion:'stale'}})};
  assert.equal((await call({action:'subscribe',room:'a',invite},JSON.stringify(staleAuthority))).status,403);

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

  records.push({name:'legacy',viewerAccessVersion:'legacy-viewer'});
  assert.equal((await call({action:'join',room:'legacy',invite:'bad'})).status,403);
  assert.equal(records.find(r=>r.name==='legacy').transferRoomId,undefined,'unauthorized request does not allocate room transfer association');
  const legacyInvite=mocks['./access'].signAccess({kind:'studio-viewer',room:'legacy',version:'legacy-viewer'});
  const legacyViewer=await call({action:'join',room:'legacy',invite:legacyInvite});
  assert.equal(legacyViewer.status,200);
  const legacyId=records.find(r=>r.name==='legacy').transferRoomId;
  assert.ok(legacyId);
  assert.equal(JSON.parse(JSON.parse(legacyViewer.data.token).metadata).transferAuthorization.roomId,legacyId);
  assert.equal((await call({action:'join',room:'legacy',invite:legacyInvite})).status,200);
  assert.equal(records.find(r=>r.name==='legacy').transferRoomId,legacyId,'immutable legacy association survives another viewer');
  console.log('PASS: studio viewer scope, isolated subscriptions and explicit link revocation');
})().catch(error=>{console.error(error);process.exitCode=1;});
