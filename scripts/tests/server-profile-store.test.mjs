import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID} from 'node:crypto';

test('peer profiles persist, isolate room UUIDs, and reject conflicting pairing replay',async()=>{
 const core=await import('../server-profile-store.mjs');
 const directory=await mkdtemp(path.join(os.tmpdir(),'castlink-peers-'));
 const env={STUDIOLINK_DATA_DIR:directory,STUDIOLINK_INSTALLATION_ID:randomUUID(),CASTLINK_NODE_ID:'srv-local',STUDIOLINK_TRANSFER_ORIGIN:'https://example.com'};
 const roomId=randomUUID(), otherRoom=randomUUID();
 const peer={id:randomUUID(),label:'Reserve',installationId:randomUUID(),origin:'https://reserve.example.com',secret:'a'.repeat(64),scope:{kind:'room',roomId}};
 try {
  await core.putServerPeer(peer,env);
  assert.deepEqual(await core.listRoomServerProfiles(roomId,env),[peer]);
  assert.deepEqual(await core.listRoomServerProfiles(otherRoom,env),[]);
  assert.equal(await core.getServerPeer({peerId:peer.id,roomId:otherRoom},env),null);
  assert.deepEqual(await core.getIncomingServerPeer(peer.id,env),peer);
  await assert.rejects(core.putServerPeer({...peer,secret:'b'.repeat(64)},env),/conflict/i);
  assert.equal((await stat(path.join(directory,'server-profiles.json'))).mode&0o777,0o600);
  assert.equal((await core.serverProfileIdentity(env)).installationId,env.STUDIOLINK_INSTALLATION_ID);
  await core.putServerPeer({...peer,id:randomUUID(),scope:{kind:'installation'}},env);
  assert.equal((await core.listRoomServerProfiles(otherRoom,env)).length,1);
  const saved=JSON.parse(await readFile(path.join(directory,'server-profiles.json'),'utf8'));
  assert.equal(saved.installationId,env.STUDIOLINK_INSTALLATION_ID);
  await assert.rejects(core.listRoomServerProfiles(roomId,{...env,STUDIOLINK_INSTALLATION_ID:randomUUID()}),/installation/i);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('SSH destinations accept public literal IPv4 and explicit operator private policy only',async()=>{
 const {validateProvisioningHost,validatePeer}=await import('../server-profile-store.mjs');
 assert.equal(validateProvisioningHost('8.8.8.8'),'8.8.8.8');
 for(const value of ['localhost','127.0.0.1','10.0.0.1','172.16.0.2','192.168.1.1','100.64.0.1','169.254.169.254','0.0.0.0','224.1.1.1','192.0.2.1','198.51.100.2','203.0.113.1','::1','2130706433','8.8.8.8;id'])assert.throws(()=>validateProvisioningHost(value),/public/i);
 assert.equal(validateProvisioningHost('192.168.1.5',{CASTLINK_PROVISIONING_PRIVATE_IPS_JSON:'["192.168.1.5"]'}),'192.168.1.5');
 const peer={id:randomUUID(),label:'VPS',installationId:randomUUID(),origin:'https://reserve.example.com',secret:'a'.repeat(64),scope:{kind:'room',roomId:randomUUID()}};
 for(const origin of ['http://reserve.example.com','https://user:pass@reserve.example.com','https://reserve.example.com/path','https://reserve.example.com/?x=1','https://reserve.example.com/#x'])assert.throws(()=>validatePeer({...peer,origin}));
 assert.throws(()=>validatePeer({...peer,scope:{kind:'room',roomId:'same-name'}}));
});

test('concurrent route module writers share a queue and old crashed directory locks do not strand writes',async()=>{
 const a=await import('../server-profile-store.mjs'),b=await import('../server-profile-store.mjs?independent-route');
 const directory=await mkdtemp(path.join(os.tmpdir(),'castlink-peer-race-'));
 const {mkdir}=await import('node:fs/promises');await mkdir(path.join(directory,'.server-profiles.lock'));
 const env={STUDIOLINK_DATA_DIR:directory,STUDIOLINK_INSTALLATION_ID:randomUUID()},roomId=randomUUID();
 try{
  await Promise.all(Array.from({length:24},(_,index)=>(index%2?a:b).putServerPeer({id:randomUUID(),installationId:randomUUID(),label:'Reserve '+index,origin:'https://reserve.example.com',secret:'a'.repeat(64),scope:{kind:'room',roomId}},env)));
  assert.equal((await a.listRoomServerProfiles(roomId,env)).length,24);
 }finally{await rm(directory,{recursive:true,force:true});}
});
