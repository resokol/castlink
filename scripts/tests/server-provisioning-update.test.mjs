import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {makeProvisioning} from '../server-provisioning.mjs';
test('peer removal reserves room and installation until completion and releases on failure',async()=>{
 const p=makeProvisioning({}),roomId=randomUUID(),installationId=randomUUID(),otherRoom=randomUUID();
 let release;const wait=new Promise(resolve=>{release=resolve;});
 const pending=p.withServerPeerRemoval(roomId,installationId,async()=>{await wait;return 'removed';});
 await assert.rejects(p.withServerPeerRemoval(roomId,randomUUID(),async()=>{}),/уже выполняется/);
 await assert.rejects(p.withServerPeerRemoval(otherRoom,installationId,async()=>{}),/уже выполняется/);
 const peer={id:randomUUID(),label:'Reserve',installationId,origin:'https://8.8.8.8',connectAddress:'8.8.8.8',secret:'f'.repeat(64),scope:{kind:'room',roomId:otherRoom}};
 const input={host:'8.8.8.8',port:22,fingerprint:'SHA256:'+'A'.repeat(43),password:'memory-password'};
 assert.throws(()=>p.startServerUpdate(input,{roomId:otherRoom,peer,assertAuthorized:async()=>{}}),/уже выполняется/);
 assert.throws(()=>p.startServerProvisioning({...input,mode:'connect',label:'Reserve'},{roomId,assertAuthorized:async()=>{}}),/уже выполняется/);
 assert.throws(()=>p.startServerProvisioning({...input,mode:'connect',label:'Reserve',installationId},{roomId:otherRoom,assertAuthorized:async()=>{}}),/уже выполняется/);
 release();assert.equal(await pending,'removed');
 await assert.rejects(p.withServerPeerRemoval(roomId,installationId,async()=>{throw Error('refused');}),/refused/);
 assert.equal(await p.withServerPeerRemoval(roomId,installationId,async()=>true),true);
});
test('update job binds the existing room peer, never re-pairs, checks auth and clears ephemeral SSH credentials',async()=>{
 const fetchSaved=globalThis.fetch,commit='b'.repeat(40),metadata=JSON.stringify({schemaVersion:1,commit,capabilities:['peer-profile-v1','root-ssh-v1','vps-update-maintenance-v1']}),roomId=randomUUID();
 const peer={id:randomUUID(),label:'Reserve',installationId:randomUUID(),origin:'https://8.8.8.8',connectAddress:'8.8.8.8',secret:'f'.repeat(64),scope:{kind:'room',roomId}};
 process.env.STUDIOLINK_INSTALLATION_ID=randomUUID();process.env.STUDIOLINK_TRANSFER_ORIGIN='https://primary.example.com';
 let checks=0,closed=0,calls=[],opened=[];
 globalThis.fetch=async url=>new Response(url.endsWith('/latest')?JSON.stringify({tag_name:'easy-setup-'+commit.slice(0,12)}):url.endsWith('SHA256SUMS')?'a'.repeat(64)+'  CastLink-Linux.tar.gz\n'+createHash('sha256').update(metadata).digest('hex')+'  CastLink-Provisioning.json\n':metadata);
 const p=makeProvisioning({openVerifiedSsh:async input=>{opened.push({...input});return {end(){closed++;}};},executeFixedSsh:async(client,command,program,timeout,onLine)=>{
  if(command==='bash -s'){assert.doesNotMatch(program,/\ninstall_runtime\n/);return '';}
  const payload=JSON.parse(Buffer.from(program.match(/b64decode\('([^']+)'\)/)[1],'base64').toString());calls.push(payload);assert.equal(payload.action,'update');assert.equal(payload.installationId,peer.installationId);assert.equal(payload.origin,peer.origin);assert.doesNotMatch(JSON.stringify(payload),/f{64}|memory-password/);
  onLine?.(JSON.stringify({stage:'backup',previousBuildId:'1.0.0-rc.2-aaaaaaaaaaaa',targetBuildId:'1.0.0-rc.2-bbbbbbbbbbbb'}));
  return JSON.stringify({result:{installationId:peer.installationId,origin:peer.origin,outcome:'updated',buildId:'1.0.0-rc.2-bbbbbbbbbbbb',previousBuildId:'1.0.0-rc.2-aaaaaaaaaaaa',targetBuildId:'1.0.0-rc.2-bbbbbbbbbbbb',backup:'/opt/castlink-easy-'+peer.installationId.replaceAll('-','')+'/backups/web-bbbbbbbbbbbb-12345678',infrastructurePreserved:true}});
 }});
 try{
  const input={host:'8.8.8.8',port:22,fingerprint:'SHA256:'+'A'.repeat(43),password:'memory-password'};
  const job=p.startServerUpdate(input,{roomId,peer,assertAuthorized:async()=>{checks++;}});
  assert.equal(job.updatedAt,job.createdAt);
  assert.equal(p.getServerProvisioningJob(job.id,randomUUID()),null);
  assert.throws(()=>p.startServerUpdate({...input},{roomId,peer,assertAuthorized:async()=>{}}),/уже выполняется/);
  let status;for(let i=0;i<100;i++){status=p.getServerProvisioningJob(job.id,roomId);if(status.state!=='running')break;await new Promise(r=>setTimeout(r,10));}
  assert.equal(status.state,'complete');assert.equal(status.outcome,'updated');assert.equal(status.peerId,peer.id);assert.equal(status.buildId,'1.0.0-rc.2-bbbbbbbbbbbb');assert.ok(checks>=3);assert.equal(calls.length,1);assert.equal(closed,1);assert.equal(input.password,'');assert.equal(opened[0].password,'memory-password');assert.doesNotMatch(JSON.stringify(status),/memory-password|f{64}|fingerprint/);assert.equal(peer.secret,'f'.repeat(64));
  assert.ok(status.updatedAt>=status.createdAt);
  const bad={host:'8.8.4.4',port:22,fingerprint:input.fingerprint,password:'memory-only'};
  await assert.rejects(p.updateServer(bad,{peer,roomId,assertAuthorized:async()=>{}}),/подключённого сервера/);assert.equal(bad.password,'');
  const revoked={host:'8.8.8.8',port:22,fingerprint:input.fingerprint,password:'revoked-password'};
  await assert.rejects(p.updateServer(revoked,{peer,roomId,assertAuthorized:async()=>{throw Error('revoked');}}),/revoked/);assert.equal(revoked.password,'');assert.equal(opened.length,1);
 }finally{globalThis.fetch=fetchSaved;}
});
