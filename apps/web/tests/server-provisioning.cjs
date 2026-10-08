const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),fsp=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const {randomUUID}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
test('connect job is room-bound, rechecks authorization before pairing, and stores no password in job/catalog',async()=>{
 const directory=await fsp.mkdtemp(path.join(os.tmpdir(),'castlink-provision-'));
 process.env.STUDIOLINK_DATA_DIR=directory;process.env.STUDIOLINK_INSTALLATION_ID=randomUUID();process.env.STUDIOLINK_TRANSFER_ORIGIN='https://primary.example.com';
 const roomId=randomUUID(),remoteInstallation=randomUUID(),remote={installationId:remoteInstallation,id:'srv-'+remoteInstallation.replaceAll('-',''),label:'CastLink',origin:'https://8.8.8.8'};
 const original=Module._load;let registrations=0,checks=0;
 const fakeClient={end(){}};
 Module._load=function(name,parent,isMain){
  if(name==='./server-provisioning-ssh')return {openVerifiedSsh:async()=>fakeClient,executeFixedSsh:async(client,command,input)=>{
   if(command==='bash -s')return '';
   // Payload is base64 encoded inside the fixed python stdin program.
   const match=input.match(/b64decode\('([A-Za-z0-9+/=]+)'\)/);const payload=JSON.parse(Buffer.from(match[1],'base64').toString());
   if(payload.action==='inspect')return JSON.stringify({result:{installations:[remote]}})+'\n';
   registrations++;return JSON.stringify({result:{ok:true,...remote}})+'\n';
  }};
  if(name==='./server-peer-request')return {requestServerPeer:async()=>new Response(JSON.stringify({buildId:'fixture'}),{status:200})};
  return original.call(this,name,parent,isMain);
 };
 try{
  const p=require('../lib/server-provisioning.ts');
  const input={host:'8.8.8.8',port:22,password:'memory-only-password',fingerprint:'SHA256:'+'A'.repeat(43),mode:'connect',label:'My reserve',installationId:remote.installationId};
  const job=p.startServerProvisioning(input,{roomId,assertAuthorized:async()=>{checks++;}});
  assert.throws(()=>p.startServerProvisioning({...input},{roomId,assertAuthorized:async()=>{}}),/уже выполняется/);
  assert.equal(p.getServerProvisioningJob(job.id,randomUUID()),null);
  let status;for(let i=0;i<100;i++){status=p.getServerProvisioningJob(job.id,roomId);if(status.state!=='running')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(status.state,'complete');assert.equal(registrations,1);assert.ok(checks>=2);
  assert.doesNotMatch(JSON.stringify(status),/memory-only-password|secret|fingerprint/);
  const peers=await require('../lib/server-profiles.ts').listRoomServerProfiles(roomId);
  assert.equal(peers[0].installationId,remote.installationId);assert.equal(peers[0].connectAddress,'8.8.8.8');
  assert.deepEqual(peers[0].scope,{kind:'room',roomId});
 }finally{Module._load=original;await fsp.rm(directory,{recursive:true,force:true});}
});
