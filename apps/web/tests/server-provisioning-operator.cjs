const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
const {randomUUID}=require('node:crypto'),{NextRequest}=require('next/server');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
test('operator registration rejects browser Origin, wrong token/installation, and scope broadening',async()=>{
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'castlink-operator-'));
 const token='x'.repeat(64),installationId=randomUUID(),peer={id:randomUUID(),installationId:randomUUID(),label:'Reserve',origin:'https://reserve.example.com',secret:'a'.repeat(64),scope:{kind:'room',roomId:randomUUID()}};
 process.env.STUDIOLINK_DATA_DIR=directory;process.env.STUDIOLINK_INSTALLATION_ID=installationId;process.env.CASTLINK_SETUP_TOKEN=token;
 const {POST}=require('../app/api/server-provisioning/operator/route.ts');
 const req=(changes={},headerChanges={})=>new NextRequest('http://127.0.0.1:3000/api/server-provisioning/operator',{method:'POST',headers:{'content-type':'application/json','x-castlink-profile-operator':token,...headerChanges},body:JSON.stringify({expectedInstallationId:installationId,peer,...changes})});
 try{
  assert.equal((await POST(req({}, {'x-castlink-profile-operator':'wrong-token'}))).status,401);
  assert.equal((await POST(req({}, {origin:'http://127.0.0.1:3000'}))).status,401);
  assert.equal((await POST(req({expectedInstallationId:randomUUID()}))).status,400);
  const response=await POST(req());assert.equal(response.status,200);assert.deepEqual(await response.json(),{ok:true});
  assert.equal((await POST(req({peer:{...peer,scope:{kind:'installation'}}}))).status,400);
  const saved=JSON.parse(await fsp.readFile(path.join(directory,'server-profiles.json'),'utf8'));
  assert.deepEqual(saved.peers[0].scope,peer.scope);
 }finally{await fsp.rm(directory,{recursive:true,force:true});}
});
test('trusted recovery operator replaces only the expected idle peer and can issue a recovery code',async()=>{
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'castlink-recovery-operator-'));
 process.env.STUDIOLINK_DATA_DIR=directory;process.env.STUDIOLINK_INSTALLATION_ID=randomUUID();process.env.STUDIOLINK_TRANSFER_ORIGIN='https://local.example';process.env.CASTLINK_SETUP_TOKEN='z'.repeat(64);
 const core=require('../../../scripts/server-profile-store.mjs'),recovery=require('../../../scripts/server-recovery-store.mjs');
 const roomId=randomUUID(),peer={id:randomUUID(),installationId:randomUUID(),label:'Reserve',origin:'https://reserve.example',secret:'a'.repeat(64),scope:{kind:'room',roomId}};
 const {POST}=require('../app/api/server-provisioning/operator/route.ts');
 const req=changes=>new NextRequest('http://127.0.0.1:3000/api/server-provisioning/operator',{method:'POST',headers:{'content-type':'application/json','x-castlink-profile-operator':process.env.CASTLINK_SETUP_TOKEN},body:JSON.stringify({expectedInstallationId:process.env.STUDIOLINK_INSTALLATION_ID,...changes})});
 try{
  await core.putServerPeer(peer);const expectedBinding=core.serverPeerBinding(peer),next={...peer,secret:'b'.repeat(64)};
  const issue=await POST(req({action:'recovery-code',peerId:peer.id}));assert.equal(issue.status,200);const issued=await issue.json();assert.equal(issued.ok,true);assert.equal(recovery.parseServerRecoveryCode(issued.code).installationId,process.env.STUDIOLINK_INSTALLATION_ID);
  const replacement=()=>POST(req({action:'replace',peer:next,expectedBinding}));
  const reserve=require('../lib/server-reserve.ts');await reserve.reserveTransaction(s=>{s.cohorts.c={peerId:peer.id,roomId,status:'activating',readyUntil:Date.now()-1};});
  assert.equal((await replacement()).status,409);assert.equal((await core.getIncomingServerPeer(peer.id)).secret,peer.secret);
  await reserve.reserveTransaction(s=>{s.cohorts.c.status='disarmed';});
  assert.equal((await replacement()).status,200);assert.equal((await core.getIncomingServerPeer(peer.id)).secret,next.secret);
  assert.equal((await replacement()).status,400,'a stale expected binding must not overwrite a subsequent change');
 }finally{await fsp.rm(directory,{recursive:true,force:true});}
});
