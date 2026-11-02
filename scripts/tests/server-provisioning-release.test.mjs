import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {makeProvisioning} from '../server-provisioning.mjs';

test('new VPS creation credential comes only from server configuration and never enters public progress or peer results',async()=>{
 const originalFetch=globalThis.fetch;
 const names=['STUDIOLINK_INSTALLATION_ID','STUDIOLINK_TRANSFER_ORIGIN','ROOM_CREATION_PASSWORD','ROOM_CREATION_PASSWORD_SHA256'];
 const saved=Object.fromEntries(names.map(name=>[name,process.env[name]]));
 const commit='c'.repeat(40),manifest=JSON.stringify({schemaVersion:1,commit,capabilities:['peer-profile-v1','root-ssh-v1']});
 const remoteId=randomUUID(),remote={installationId:remoteId,id:'srv-'+remoteId.replaceAll('-',''),label:'Reserve',origin:'https://8.8.8.8'};
 process.env.STUDIOLINK_INSTALLATION_ID=randomUUID();process.env.STUDIOLINK_TRANSFER_ORIGIN='https://primary.example.com';
 globalThis.fetch=async url=>new Response(url.endsWith('/latest')?JSON.stringify({tag_name:'easy-setup-'+commit.slice(0,12)}):url.endsWith('SHA256SUMS')?'b'.repeat(64)+'  CastLink-Linux.tar.gz\n'+createHash('sha256').update(manifest).digest('hex')+'  CastLink-Provisioning.json\n':manifest);
 let deployed,progress=[],persisted,effectiveHash, useEffectiveHash=false;
 const p=makeProvisioning({getRoomCreationPasswordHash:async()=>{if(useEffectiveHash)return effectiveHash;const h=process.env.ROOM_CREATION_PASSWORD_SHA256;if(h)return /^[a-f0-9]{64}$/i.test(h)?h.toLowerCase():undefined;const p=process.env.ROOM_CREATION_PASSWORD;return typeof p==='string'&&p.trim()&&p.length<=256?createHash('sha256').update(p).digest('hex'):undefined;},openVerifiedSsh:async()=>({end(){}}),executeFixedSsh:async(_client,command,program)=>{
  if(command==='bash -s')return '';
  const payload=JSON.parse(Buffer.from(program.match(/b64decode\('([^']+)'\)/)[1],'base64').toString());
  assert.ok(!JSON.stringify(payload).includes('source plaintext $ 密码'), 'plaintext creation credential never travels to the target');
  if(payload.action==='deploy'){deployed=payload;return JSON.stringify({result:remote});}
  assert.equal(payload.action,'register');assert.equal(payload.roomCreationPasswordHash,undefined,'pairing does not carry creation authority');
  return JSON.stringify({result:{ok:true,...remote}});
 },requestServerPeer:async()=>new Response(JSON.stringify({buildId:'1.0.0-'+commit.slice(0,12)}))});
 const digest=createHash('sha256').update('source plaintext $ 密码').digest('hex');
 try{
  for(const [hash,plaintext,expected] of [['A'.repeat(64),'source plaintext $ 密码','a'.repeat(64)],[undefined,'source plaintext $ 密码',digest],['','source plaintext $ 密码',digest],[undefined,undefined,undefined],['invalid','source plaintext $ 密码',undefined],[undefined,' '.repeat(8),undefined],[undefined,'x'.repeat(257),undefined]]){
   for(const [name,value] of [['ROOM_CREATION_PASSWORD_SHA256',hash],['ROOM_CREATION_PASSWORD',plaintext]]){if(value===undefined)delete process.env[name];else process.env[name]=value;}
   progress=[];deployed=undefined;
   const result=await p.provisionServer({host:'8.8.8.8',port:22,password:'ephemeral-ssh',fingerprint:'SHA256:'+'A'.repeat(43),mode:'deploy',label:'Reserve',roomCreationPasswordHash:'f'.repeat(64)},{scope:{kind:'room',roomId:randomUUID()},assertAuthorized:async()=>{},onProgress:value=>progress.push(value),persistPeer:async peer=>{persisted=peer;}});
   assert.equal(deployed.roomCreationPasswordHash,expected,'new target inherits only the configured server hash');
   assert.deepEqual(Object.keys(deployed).filter(key=>/password/i.test(key)),expected?['roomCreationPasswordHash']:[]);
   const exposed=JSON.stringify({result,progress,persisted});assert.ok(!exposed.includes('source plaintext $ 密码'));
   if(expected)assert.ok(!exposed.includes(expected),'creation digest never enters client-visible peer/progress data');
  }
  useEffectiveHash=true;effectiveHash='e'.repeat(64);process.env.ROOM_CREATION_PASSWORD_SHA256='a'.repeat(64);
  await p.provisionServer({host:'8.8.8.8',port:22,password:'ephemeral-ssh',fingerprint:'SHA256:'+'A'.repeat(43),mode:'deploy',label:'Reserve'},{scope:{kind:'room',roomId:randomUUID()},assertAuthorized:async()=>{},persistPeer:async()=>{}});
  assert.equal(deployed.roomCreationPasswordHash,effectiveHash,'UI-rotated persisted password wins over stale installer env on new deploy');
  effectiveHash=undefined;
  await p.provisionServer({host:'8.8.8.8',port:22,password:'ephemeral-ssh',fingerprint:'SHA256:'+'A'.repeat(43),mode:'deploy',label:'Reserve'},{scope:{kind:'room',roomId:randomUUID()},assertAuthorized:async()=>{},persistPeer:async()=>{}});
  assert.equal(deployed.roomCreationPasswordHash,undefined,'unset effective credential never falls back to stale env');
 }finally{globalThis.fetch=originalFetch;for(const name of names){if(saved[name]===undefined)delete process.env[name];else process.env[name]=saved[name];}}
});
test('old public releases and checksum/commit mismatches refuse before SSH or VPS preparation',async()=>{
 const original=globalThis.fetch;let sshCalls=0;
 const p=makeProvisioning({openVerifiedSsh:async()=>{sshCalls++;throw Error('Must not connect');},executeFixedSsh:async()=>{},requestServerPeer:async()=>{}});
 process.env.STUDIOLINK_INSTALLATION_ID=randomUUID();process.env.STUDIOLINK_TRANSFER_ORIGIN='https://primary.example.com';
 const commit='a'.repeat(40),manifest=JSON.stringify({schemaVersion:1,commit,capabilities:['peer-profile-v1','root-ssh-v1']})+'\n';
 const hash=createHash('sha256').update(manifest).digest('hex');let variant='missing';
 globalThis.fetch=async url=>{
  if(url.endsWith('/latest'))return new Response(JSON.stringify({tag_name:'easy-setup-'+commit.slice(0,12)}));
  if(url.endsWith('SHA256SUMS'))return new Response('b'.repeat(64)+'  CastLink-Linux.tar.gz\n'+(variant==='missing'?'':(variant==='bad-hash'?'c'.repeat(64):variant==='bad-commit'?createHash('sha256').update(manifest.replace(commit,'d'.repeat(40))).digest('hex'):hash)+'  CastLink-Provisioning.json\n'));
  return new Response(variant==='bad-commit'?manifest.replace(commit,'d'.repeat(40)):manifest);
 };
 try{
  for(variant of ['missing','bad-hash','bad-commit']){
   await assert.rejects(p.provisionServer({host:'8.8.8.8',port:22,fingerprint:'SHA256:'+'A'.repeat(43),password:'memory-only',mode:'deploy',label:'Reserve'},{scope:{kind:'room',roomId:randomUUID()},assertAuthorized:async()=>{}}),/публичный выпуск/);
   assert.equal(sshCalls,0);
  }
  variant='valid';const requests=[],fetchFixture=globalThis.fetch;globalThis.fetch=async url=>{requests.push(url);return fetchFixture(url);};
  const release=await p.currentProvisioningRelease();assert.equal(release.releaseCommit,commit);assert.equal(release.releaseSha256,'b'.repeat(64));
  assert.equal(requests[0],'https://api.github.com/repos/resokol/castlink/releases/latest');
  assert.equal(release.releaseUrl,'https://github.com/resokol/castlink/releases/download/easy-setup-'+commit.slice(0,12)+'/CastLink-Linux.tar.gz');
  assert.ok(requests.slice(1).every(url=>url.startsWith('https://github.com/resokol/castlink/releases/download/')));
 }finally{globalThis.fetch=original;}
});
