import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,stat,writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {randomUUID,createHmac} from 'node:crypto';
import * as profiles from '../server-profile-store.mjs';

const noop=async()=>{};
const key=(code,f,identity=f.identity)=>createHmac('sha256',code.token).update('castlink-server-recovery-v1\0'+f.env.STUDIOLINK_INSTALLATION_ID+'\0'+identity.installationId+'\0'+code.grantId).digest('hex');
async function fixture(){
 const directory=await mkdtemp(path.join(os.tmpdir(),'castlink-recovery-'));
 const env={STUDIOLINK_DATA_DIR:directory,STUDIOLINK_INSTALLATION_ID:randomUUID(),STUDIOLINK_TRANSFER_ORIGIN:'https://source.example.com'};
 const peer={id:randomUUID(),label:'Home reserve',installationId:randomUUID(),origin:'https://reserve.example.com',secret:'a'.repeat(64),ca:'-----BEGIN CERTIFICATE-----\nold\n-----END CERTIFICATE-----',connectAddress:'8.8.8.8',scope:{kind:'room',roomId:randomUUID()}};
 const other={...peer,id:randomUUID(),label:'Unrelated',origin:'https://other.example.com',scope:{kind:'installation'}};
 await profiles.putServerPeer(peer,env);await profiles.putServerPeer(other,env);
 const identity={id:'srv-new',label:'New PC',installationId:randomUUID(),origin:peer.origin,ca:'-----BEGIN CERTIFICATE-----\nnew\n-----END CERTIFICATE-----'};
 const authority={kind:'room',studioId:'studio-default',roomId:peer.scope.roomId,version:'f'.repeat(64)};
 const file=path.join(directory,'server-profiles.json');
 return {env,peer,other,identity,authority,file,clean:()=>rm(directory,{recursive:true,force:true})};
}
async function core(){
 const value=await import('../server-recovery-store.mjs').catch(()=>null);
 assert.ok(value,'Durable recovery protocol must be implemented');return value;
}
test('a freshly issued code tolerates a destination clock one minute behind the source',async t=>{
 const recovery=await core(),f=await fixture();
 try{
  const now=Date.now(),issued=await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env);
  t.mock.timers.enable({apis:['Date'],now:now-60000});
  assert.equal(recovery.parseServerRecoveryCode(issued.code).expiresAt,issued.expiresAt);
 }finally{t.mock.timers.reset();await f.clean();}
});
test('a fresh PC recovers a durable peer and identical retries retain pair identity and unrelated peers',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const now=Date.now(),issued=await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env);
  assert.ok(issued.expiresAt>=now+600000&&issued.expiresAt<=Date.now()+600000);
  const code=recovery.parseServerRecoveryCode(issued.code);
  assert.equal(code.installationId,f.env.STUDIOLINK_INSTALLATION_ID);assert.equal(code.origin,f.env.STUDIOLINK_TRANSFER_ORIGIN);
  assert.match(code.token,/^[a-f0-9]{64}$/);
  const input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  const raw=await readFile(f.file,'utf8');assert.ok(!raw.includes(code.token));assert.ok(!raw.includes(issued.code));
  const prepared=await recovery.prepareServerRecovery(input,f.env);
  assert.equal(prepared.committed,false);assert.deepEqual(prepared.previous,f.peer);assert.deepEqual(prepared.authority,f.authority);
  assert.deepEqual(prepared.peer,{id:f.peer.id,label:f.peer.label,installationId:f.identity.installationId,origin:f.peer.origin,secret:input.secret,scope:f.peer.scope,ca:f.identity.ca});
  assert.deepEqual(await recovery.prepareServerRecovery(input,f.env),prepared);
  const result=await recovery.commitServerRecovery({...input,assertAuthorized:noop},f.env);assert.equal(result.ok,true);
  assert.deepEqual(result.peer,prepared.peer);
  const reload=await import('../server-recovery-store.mjs?reloaded');
  assert.deepEqual(await reload.commitServerRecovery({...input,assertAuthorized:noop},f.env),result);
  assert.equal((await reload.prepareServerRecovery(input,f.env)).committed,true);
  assert.deepEqual(await profiles.getIncomingServerPeer(f.other.id,f.env),f.other);
  assert.deepEqual(await profiles.getIncomingServerPeer(f.peer.id,f.env),prepared.peer);
  assert.equal((await stat(f.file)).mode&0o777,0o600);
 }finally{await f.clean()}
});

test('expiry, revocation, malformed tokens and newer codes cannot authorize recovery',async t=>{
 const recovery=await core(),f=await fixture();t.mock.timers.enable({apis:['Date'],now:1700000000000});
 try{
  const issue=()=>recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env);
  const issued=await issue(),code=recovery.parseServerRecoveryCode(issued.code);
  const input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  for(const value of ['',issued.code+'!', 'https://source.example.com/?code='+issued.code])assert.throws(()=>recovery.parseServerRecoveryCode(value));
  await assert.rejects(recovery.prepareServerRecovery({...input,token:'c'.repeat(64)},f.env));
  t.mock.timers.tick(600000);await assert.rejects(recovery.prepareServerRecovery(input,f.env),/expired|invalid/i);
  const second=recovery.parseServerRecoveryCode((await issue()).code);
  const secondInput={...input,grantId:second.grantId,token:second.token};
  await recovery.revokeServerRecovery({peerId:f.peer.id,assertAuthorized:noop},f.env);
  await assert.rejects(recovery.prepareServerRecovery(secondInput,f.env),/revoked|invalid/i);
  const third=recovery.parseServerRecoveryCode((await issue()).code);await issue();
  await assert.rejects(recovery.prepareServerRecovery({...input,grantId:third.grantId,token:third.token},f.env),/revoked|invalid/i);
 }finally{await f.clean()}
});

test('claim and commit races allow one candidate and preserve concurrent profile additions',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const code=recovery.parseServerRecoveryCode((await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env)).code);
  const input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  const rivalIdentity={...f.identity,installationId:randomUUID()};
  const rival={...input,identity:rivalIdentity,secret:key(code,f,rivalIdentity)};
  const claims=await Promise.allSettled([recovery.prepareServerRecovery(input,f.env),recovery.prepareServerRecovery(rival,f.env)]);
  assert.equal(claims.filter(x=>x.status==='fulfilled').length,1);assert.equal(claims[0].status,'fulfilled');
  await assert.rejects(recovery.commitServerRecovery({...rival,assertAuthorized:noop},f.env));
  const extra={...f.other,id:randomUUID()};
  const results=await Promise.all([recovery.commitServerRecovery({...input,assertAuthorized:noop},f.env),recovery.commitServerRecovery({...input,assertAuthorized:noop},f.env),profiles.putServerPeer(extra,f.env)]);
  assert.deepEqual(results[0],results[1]);assert.deepEqual(await profiles.getIncomingServerPeer(extra.id,f.env),extra);
  await assert.rejects(recovery.prepareServerRecovery(rival,f.env));
 }finally{await f.clean()}
});

test('changed binding, creator authorization, origin and authority reject without touching peers',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const issue=()=>recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env);
  await assert.rejects(recovery.issueServerRecovery({peerId:f.peer.id,authority:{...f.authority,roomId:randomUUID()},assertAuthorized:noop},f.env),/scope|authority/i);
  const code=recovery.parseServerRecoveryCode((await issue()).code),input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  for(const identity of [{...f.identity,origin:'https://wrong.example.com'},{...f.identity,installationId:f.env.STUDIOLINK_INSTALLATION_ID}])await assert.rejects(recovery.prepareServerRecovery({...input,identity},f.env));
  await recovery.prepareServerRecovery(input,f.env);
  const before=await readFile(f.file,'utf8');
  await assert.rejects(recovery.commitServerRecovery({...input,assertAuthorized:async()=>{throw Error('creator changed')}},f.env),/creator changed/);
  assert.equal(await readFile(f.file,'utf8'),before);
  const changed={...f.peer,secret:'d'.repeat(64)};
  await profiles.replaceServerPeer({peer:changed,expectedBinding:recovery.serverPeerBinding(f.peer),assertAuthorized:noop},f.env);
  await assert.rejects(recovery.prepareServerRecovery(input,f.env),/stale|changed|invalid/i);
  await assert.rejects(recovery.commitServerRecovery({...input,assertAuthorized:noop},f.env),/stale|changed|invalid/i);
 }finally{await f.clean()}
});

test('profile replacement compares bindings inside the shared queue and keeps recovery grants',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const issued=await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env);
  const next={...f.peer,installationId:randomUUID(),secret:'e'.repeat(64)};
  await assert.rejects(profiles.replaceServerPeer({peer:next,expectedBinding:null,assertAuthorized:noop},f.env),/binding|conflict/i);
  for(const altered of [{...next,label:'Changed'},{...next,scope:{kind:'installation'}},{...next,origin:'https://wrong.example.com'}])await assert.rejects(profiles.replaceServerPeer({peer:altered,expectedBinding:recovery.serverPeerBinding(f.peer),assertAuthorized:noop},f.env));
  const before=await readFile(f.file,'utf8');
  await assert.rejects(profiles.replaceServerPeer({peer:next,expectedBinding:recovery.serverPeerBinding(f.peer),assertAuthorized:async()=>{throw Error('not authorized')}},f.env));
  assert.equal(await readFile(f.file,'utf8'),before);
  await profiles.replaceServerPeer({peer:next,expectedBinding:recovery.serverPeerBinding(f.peer),assertAuthorized:noop},f.env);
  await assert.rejects(profiles.replaceServerPeer({peer:f.peer,expectedBinding:recovery.serverPeerBinding(f.peer),assertAuthorized:noop},f.env));
  const extra={...f.other,id:randomUUID()};
  await profiles.replaceServerPeer({peer:extra,expectedBinding:null,assertAuthorized:noop},f.env);
  assert.deepEqual(await profiles.getIncomingServerPeer(extra.id,f.env),extra);
  const state=JSON.parse(await readFile(f.file,'utf8'));assert.ok(state.recoveryGrants);
  assert.ok(!JSON.stringify(state).includes(recovery.parseServerRecoveryCode(issued.code).token));
 }finally{await f.clean()}
});

test('removal then identical re-addition does not revive a recovery code',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const code=recovery.parseServerRecoveryCode((await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env)).code);
  const input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  await profiles.removeRoomServerPeer({peerId:f.peer.id,roomId:f.peer.scope.roomId,assertAuthorized:noop},f.env);
  await profiles.putServerPeer(f.peer,f.env);
  await assert.rejects(recovery.prepareServerRecovery(input,f.env));
  assert.deepEqual(await profiles.getIncomingServerPeer(f.peer.id,f.env),f.peer);
 }finally{await f.clean()}
});

test('claim freezes CA and public identity, rejects wrong derived key and cannot pin a redemption address',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const code=recovery.parseServerRecoveryCode((await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env)).code);
  const input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  await assert.rejects(recovery.prepareServerRecovery({...input,secret:'0'.repeat(64)},f.env));
  await assert.rejects(recovery.prepareServerRecovery({...input,identity:{...f.identity,connectAddress:'8.8.8.8'}},f.env));
  await recovery.prepareServerRecovery(input,f.env);
  for(const identity of [{...f.identity,ca:f.peer.ca},{...f.identity,label:'Another node'},{...f.identity,id:'another-server'}])await assert.rejects(recovery.prepareServerRecovery({...input,identity},f.env));
  await assert.rejects(recovery.commitServerRecovery({...input,identity:{...f.identity,ca:f.peer.ca},assertAuthorized:noop},f.env));
  assert.equal((await recovery.prepareServerRecovery(input,f.env)).committed,false);
 }finally{await f.clean()}
});

test('queued authorization changes and expiry at completion prevent commit atomically',async t=>{
 const recovery=await core(),f=await fixture();t.mock.timers.enable({apis:['Date'],now:1700000000000});
 try{
  const code=recovery.parseServerRecoveryCode((await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env)).code);
  const input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  await recovery.prepareServerRecovery(input,f.env);
  const before=await readFile(f.file,'utf8');
  await assert.rejects(recovery.commitServerRecovery({...input,assertAuthorized:async(authority,previous)=>{
   assert.deepEqual(authority,f.authority);assert.deepEqual(previous,f.peer);t.mock.timers.tick(600000);
  }},f.env));
  assert.equal(await readFile(f.file,'utf8'),before);
 }finally{await f.clean()}
});

test('recovery allows the same destination UUID with a new CA and derived key',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const code=recovery.parseServerRecoveryCode((await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env)).code);
  const identity={...f.identity,installationId:f.peer.installationId};
  const input={grantId:code.grantId,token:code.token,identity,secret:key(code,f,identity)};
  await recovery.prepareServerRecovery(input,f.env);
  const result=await recovery.commitServerRecovery({...input,assertAuthorized:noop},f.env);
  assert.equal(result.peer.installationId,f.peer.installationId);assert.equal(result.peer.ca,f.identity.ca);assert.notEqual(result.peer.secret,f.peer.secret);
 }finally{await f.clean()}
});

test('source origin or CA rotation invalidates a minted recovery grant',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const code=recovery.parseServerRecoveryCode((await recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env)).code);
  const input={grantId:code.grantId,token:code.token,identity:f.identity,secret:key(code,f)};
  await assert.rejects(recovery.prepareServerRecovery(input,{...f.env,STUDIOLINK_TRANSFER_ORIGIN:'https://new-source.example.com'}));
  await recovery.prepareServerRecovery(input,f.env);
  const before=await readFile(f.file,'utf8');
  await assert.rejects(recovery.commitServerRecovery({...input,assertAuthorized:async()=>{
   await writeFile(path.join(f.env.STUDIOLINK_DATA_DIR,'server-origin-ca.pem'),f.identity.ca);
  }},f.env));
  assert.equal(await readFile(f.file,'utf8'),before);
  await assert.rejects(recovery.prepareServerRecovery(input,f.env));
 }finally{await f.clean()}
});

test('an oversized grant leaves a near-limit profile document unchanged and readable',async()=>{
 const recovery=await core(),f=await fixture();
 try{
  const limit=4*1024*1024,target=limit-128;
  const begin='-----BEGIN CERTIFICATE-----\n',end='\n-----END CERTIFICATE-----';
  const characters=32768-begin.length-end.length,largeCa=begin+'界'.repeat(characters)+end;
  const state={schemaVersion:1,installationId:f.env.STUDIOLINK_INSTALLATION_ID,peers:[{...f.peer,ca:largeCa}]};
  while(Buffer.byteLength(JSON.stringify(state),'utf8')<target)state.peers.push({...f.other,id:randomUUID(),ca:largeCa});
  let excess=Buffer.byteLength(JSON.stringify(state),'utf8')-target;
  for(let i=state.peers.length-1;excess>0;i--){
   const amount=Math.min(excess,characters*3),whole=Math.floor(amount/3),remainder=amount%3;
   state.peers[i].ca=begin+'界'.repeat(characters-whole-(remainder?1:0))+'a'.repeat(remainder?3-remainder:0)+end;excess-=amount;
  }
  const before=JSON.stringify(state);assert.equal(Buffer.byteLength(before,'utf8'),target);
  assert.ok(before.length<target/2,'The limit must count UTF-8 bytes, not JavaScript characters');
  await writeFile(f.file,before,{mode:0o600});
  assert.equal((await profiles.readServerProfileState(f.env)).peers.length,state.peers.length);
  await assert.rejects(recovery.issueServerRecovery({peerId:f.peer.id,authority:f.authority,assertAuthorized:noop},f.env),/size|large|limit/i);
  assert.equal(await readFile(f.file,'utf8'),before);
  assert.equal((await profiles.readServerProfileState(f.env)).peers.length,state.peers.length);
 }finally{await f.clean()}
});
