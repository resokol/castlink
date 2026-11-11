const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {randomUUID,createHmac}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
let destination,rooms=[],tlsAccepted=true,signedRequests=0;
const profiles=require('../../../scripts/server-profile-store.mjs'),store=require('../../../scripts/server-recovery-store.mjs'),client=require('../../../scripts/server-recovery-client.mjs');
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(name==='./room-store'&&parent.filename.endsWith('/lib/server-recovery.ts'))return {readRooms:async()=>rooms};
 if(name==='./server-peer-request'&&parent.filename.endsWith('/lib/server-recovery.ts'))return {requestServerPeer:async(peer,pathname,options)=>{
  if(!tlsAccepted)throw Error('Peer HTTPS verification or connection failed');
  const identity=await profiles.serverProfileIdentity(destination);assert.equal(peer.installationId,identity.installationId);assert.equal(peer.origin,identity.origin);assert.equal(peer.ca,identity.ca);assert.equal(peer.connectAddress,undefined);
  if(pathname.includes('server-transfer'))return Response.json({...identity,enabled:true,liveKitReady:true,nodeAdmissionReady:true});
  signedRequests++;const body=JSON.parse(options.body),reverse=await profiles.getIncomingServerPeer(body.peerId,destination),h=options.headers;
  const valid=reverse&&reverse.installationId===body.sourceInstallationId&&reverse.origin===body.sourceOrigin&&createHmac('sha256',reverse.secret).update(h['x-studiolink-transfer-time']+'.'+h['x-studiolink-transfer-nonce']+'.'+options.body).digest('hex')===h['x-studiolink-transfer-signature'];
  return Response.json({error:valid?'Комната проверки изменилась':'Пара серверов не подтверждена'},{status:valid?404:401});
 }};
 return original.call(this,name,parent,isMain);
};
const recovery=require('../lib/server-recovery.ts');Module._load=original;
const {NextRequest}=require('next/server'),operator=require('../app/api/server-provisioning/operator/route.ts');
test('fresh computer restores old pairing through real source, destination and client stores; retry survives a lost commit reply',async()=>{
 const dir=await fsp.mkdtemp(path.join(os.tmpdir(),'castlink-recovery-roundtrip-')),sourceDir=path.join(dir,'source'),destDir=path.join(dir,'new-pc');
 const sourceId=randomUUID(),oldId=randomUUID(),newId=randomUUID(),roomId=randomUUID(),peerId=randomUUID();
 process.env.STUDIOLINK_DATA_DIR=sourceDir;process.env.STUDIOLINK_INSTALLATION_ID=sourceId;process.env.STUDIOLINK_TRANSFER_ORIGIN='https://source.example';
 destination={STUDIOLINK_DATA_DIR:destDir,STUDIOLINK_INSTALLATION_ID:newId,STUDIOLINK_TRANSFER_ORIGIN:'https://reserve.example',CASTLINK_SETUP_TOKEN:'fixture-token-'.repeat(5)};
 rooms=[{name:'owned',creatorAccessId:roomId,studioPasswordHash:'initial-credential'}];
 const old={id:peerId,label:'Home reserve',installationId:oldId,origin:destination.STUDIOLINK_TRANSFER_ORIGIN,secret:'a'.repeat(64),scope:{kind:'room',roomId}};
 let loseCommitReply=true;
 const requestPeer=async(_peer,_pathname,options)=>{
  const input=JSON.parse(options.body),result=await (input.action==='prepare'?recovery.prepareRecovery(input):recovery.completeRecovery(input));
  if(input.action==='commit'&&loseCommitReply){loseCommitReply=false;throw Error('reply lost');}return Response.json(result);
 };
 const replacePeer=async(peer,expectedBinding,env)=>{
  const saved=Object.fromEntries(Object.keys(env).map(key=>[key,process.env[key]]));Object.assign(process.env,env);
  try{
   const response=await operator.POST(new NextRequest('http://127.0.0.1:3000/api/server-provisioning/operator',{method:'POST',headers:{'content-type':'application/json','x-castlink-profile-operator':env.CASTLINK_SETUP_TOKEN},body:JSON.stringify({action:'replace',expectedInstallationId:env.STUDIOLINK_INSTALLATION_ID,peer,expectedBinding})}));
   if(response.status!==200)throw Error('Destination operator refused replacement');
  }finally{for(const [key,value]of Object.entries(saved))if(value===undefined)delete process.env[key];else process.env[key]=value;}
 };
 try{
  await fsp.mkdir(destDir,{recursive:true});await fsp.writeFile(path.join(destDir,'server-origin-ca.pem'),'-----BEGIN CERTIFICATE-----\nNEW-PC-CA\n-----END CERTIFICATE-----');
  await profiles.putServerPeer(old);
  const other={...old,id:randomUUID(),label:'Unrelated',origin:'https://other.example'};await profiles.putServerPeer(other);
  const grant=await store.issueServerRecovery({peerId,authority:{kind:'room',studioId:'studio-default',roomId,version:recovery.recoveryRoomVersion(rooms[0],'studio-default')},assertAuthorized:async()=>{}});
  tlsAccepted=false;await assert.rejects(client.recoverServerConnection(grant.code,{env:destination,requestPeer,replacePeer}));assert.deepEqual(await profiles.getIncomingServerPeer(peerId),old);assert.equal(await profiles.getIncomingServerPeer(peerId,destination),null);
  tlsAccepted=true;await assert.rejects(client.recoverServerConnection(grant.code,{env:destination,requestPeer,replacePeer}));
  const migrated=await profiles.getIncomingServerPeer(peerId);assert.equal(migrated.installationId,newId);assert.notEqual(migrated.secret,old.secret);assert.equal(migrated.label,old.label);assert.deepEqual(migrated.scope,old.scope);assert.match(migrated.ca,/NEW-PC-CA/);
  const reserve=require('../lib/server-reserve.ts');await reserve.reserveTransaction(s=>{s.sources.live={peerId,roomId,status:'armed',readyUntil:Date.now()+300000};});
  await fsp.mkdir(path.join(destDir,'runtime'),{recursive:true});await fsp.writeFile(path.join(destDir,'runtime','studiolink-server-reserve.json'),JSON.stringify({cohorts:{live:{peerId,roomId,status:'armed',readyUntil:Date.now()+300000}}}));
  const retry=await client.recoverServerConnection(grant.code,{env:destination,requestPeer,replacePeer});assert.equal(retry.ok,true,'an already committed exact retry succeeds even after reserve preparation');
  const reverse=await profiles.getIncomingServerPeer(peerId,destination);assert.equal(reverse.installationId,sourceId);assert.equal(reverse.secret,migrated.secret);assert.deepEqual(await profiles.getIncomingServerPeer(other.id),other);assert.ok(signedRequests>=2);
  assert.doesNotMatch(JSON.stringify(retry),new RegExp(migrated.secret));
  rooms[0].studioPasswordHash='rotated-credential';await assert.rejects(client.recoverServerConnection(grant.code,{env:destination,requestPeer,replacePeer}));assert.deepEqual(await profiles.getIncomingServerPeer(peerId),migrated);
 }finally{await fsp.rm(dir,{recursive:true,force:true});}
});
