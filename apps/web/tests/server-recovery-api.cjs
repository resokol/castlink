const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),Module=require('node:module'),ts=require('typescript');
const {randomUUID}=require('node:crypto'),{NextRequest}=require('next/server');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
process.env.CASTLINK_SESSION_SECRET='recovery-api-test-secret';
const {signAccess,roomVersion}=require('../lib/access.ts');
const roomId=randomUUID(),other=randomUUID(),studioId='studio-default',id=randomUUID();
let superAdmin=false,issued=0,revoked=0,bridgeCalls=0;
let rooms=[{name:'mine',creatorAccessId:roomId,studioPasswordHash:'hash-mine'}];
let peer={id,label:'Reserve',origin:'https://reserve.example',installationId:randomUUID(),secret:'NEVER-RETURN-THIS-SECRET',ca:'PRIVATE-CA',scope:{kind:'room',roomId}};
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(name.endsWith('/super-admin-access'))return {isSuperAdmin:async()=>superAdmin};
 if(name.endsWith('/room-store'))return {readRooms:async()=>rooms};
 if(name.endsWith('/server-profiles'))return {getIncomingServerPeer:async value=>value===peer.id?peer:null};
 if(name.endsWith('/server-recovery'))return {
  ...original.call(this,name,parent,isMain),
  recoveryRoomVersion:(room,studio)=>roomVersion(JSON.stringify([studio,room.creatorAccessId,room.studioPasswordHash||''])),
  issueServerRecovery:async input=>{await input.assertAuthorized();issued++;return {code:'TEST-RECOVERY-CODE',expiresAt:Date.now()+600000};},
  revokeServerRecovery:async input=>{await input.assertAuthorized();revoked++;return {revoked:true};},
  listRecoveryProfiles:async()=>[peer],
  prepareRecovery:async()=>{bridgeCalls++;return {ok:true,source:{installationId:randomUUID(),origin:'https://source.example',label:'Source'},peerId:peer.id,scope:peer.scope};},
  completeRecovery:async()=>{bridgeCalls++;return {ok:true,profile:{id:peer.id,label:peer.label,origin:peer.origin,installationId:peer.installationId}};}
 };
 return original.call(this,name,parent,isMain);
};
const management=require('../app/api/server-recovery/route.ts'),bridge=require('../app/api/server-recovery/bridge/route.ts');Module._load=original;
function req(body,authorized=true){
 const token=signAccess({kind:'room-studio',studio:studioId,id:roomId,version:roomVersion('hash-mine')},300),cookie=`castlink-room-studio-${roomVersion(roomId).slice(0,24)}=${token}`;
 return new NextRequest('https://source.example/api/server-recovery',{method:body?'POST':'GET',headers:{host:'source.example',origin:'https://source.example','content-type':'application/json',...(authorized?{cookie}:{})},...(body?{body:JSON.stringify(body)}:{})});
}
test('room creator issues/revokes only their own room peer with no-store and same-origin checks',async()=>{
 const body={action:'issue',peerId:id,room:'mine',studioId};
 assert.equal((await management.POST(req(body,false))).status,401);assert.equal(issued,0);
 const foreign=req(body);foreign.headers.set('origin','https://other.example');assert.equal((await management.POST(foreign)).status,403);
 peer={...peer,scope:{kind:'installation'}};assert.equal((await management.POST(req(body))).status,403);assert.equal(issued,0);
 peer={...peer,scope:{kind:'room',roomId:other}};assert.equal((await management.POST(req(body))).status,403);
 peer={...peer,scope:{kind:'room',roomId}};
 const response=await management.POST(req(body));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal((await response.json()).code,'TEST-RECOVERY-CODE');assert.equal(issued,1);
 assert.equal((await management.POST(req({...body,action:'revoke'}))).status,200);assert.equal(revoked,1);
});
test('global listing and code issuance require Super Admin and never expose peer credentials',async()=>{
 assert.equal((await management.GET(req())).status,403);
 superAdmin=true;peer={...peer,scope:{kind:'installation'}};
 const response=await management.GET(req());assert.equal(response.status,200);const text=await response.text();assert.doesNotMatch(text,/NEVER-RETURN|PRIVATE-CA|secret|connectAddress/);
 assert.equal((await management.POST(req({action:'issue',peerId:id}))).status,200);
 superAdmin=false;assert.equal((await management.POST(req({action:'issue',peerId:id}))).status,403);
});
test('public recovery bridge rejects browser requests, unrecognized actions and oversized bodies before work',async()=>{
 const browser=req({action:'prepare'});assert.equal((await bridge.POST(browser)).status,403);assert.equal(bridgeCalls,0);
 const server=body=>new NextRequest('https://source.example/api/server-recovery/bridge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await bridge.POST(server({action:'unknown'}))).status,400);assert.equal(bridgeCalls,0);
 assert.equal((await bridge.POST(server({action:'prepare',token:'x'.repeat(90000)}))).status,400);assert.equal(bridgeCalls,0);
 const response=await bridge.POST(server({action:'prepare',grantId:randomUUID(),token:'a'.repeat(64),identity:{},secret:'b'.repeat(64)}));assert.equal(response.status,200);assert.equal(response.headers.get('Cache-Control'),'no-store');assert.equal(bridgeCalls,1);
});
