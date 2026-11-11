import {randomUUID,randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {serverPeerBinding,requireUuid,exactHttpsOrigin,validatePeer,serverProfileIdentity,serverProfileTransaction,invalidateServerRecoveries} from './server-profile-store.mjs';

export {serverPeerBinding};
const PREFIX='CASTLINK-RECOVERY-1.',TTL=600000,CLOCK_SKEW=120000;
const hash=value=>createHash('sha256').update(value).digest('hex');
const fail=()=>{throw Error('Invalid, expired, revoked or changed server recovery');};
function tokenValue(value){if(typeof value!=='string'||!/^[a-f0-9]{64}$/.test(value))fail();return value;}
function publicIdentity(value){
 if(!value||typeof value!=='object')fail();
 const installationId=requireUuid(value.installationId),origin=exactHttpsOrigin(value.origin);
 if(typeof value.id!=='string'||!value.id||value.id.length>200||/[\x00-\x1f]/.test(value.id)||typeof value.label!=='string'||!value.label.trim()||value.label.length>100||/[\x00-\x1f]/.test(value.label))fail();
 if(value.connectAddress!==undefined)fail();
 if(value.ca!==undefined&&(typeof value.ca!=='string'||value.ca.length>32768||!value.ca.includes('-----BEGIN CERTIFICATE-----')))fail();
 return {installationId,id:value.id,label:value.label,origin,...(value.ca?{ca:value.ca}:{})};
}
function authorityValue(value,peer){
 if(value?.kind==='installation')return {kind:'installation'};
 if(value?.kind!=='room'||peer.scope.kind!=='room'||value.roomId!==peer.scope.roomId||typeof value.studioId!=='string'||!value.studioId||value.studioId.length>200||typeof value.version!=='string'||!/^[a-f0-9]{64}$/.test(value.version))throw Error('Invalid recovery authority or peer scope');
 requireUuid(value.roomId);return {kind:'room',studioId:value.studioId,roomId:value.roomId,version:value.version};
}
export function parseServerRecoveryCode(code){
 try{
  if(typeof code!=='string'||code.length>65536||!code.startsWith(PREFIX))fail();
  const encoded=code.slice(PREFIX.length);if(!/^[A-Za-z0-9_-]+$/.test(encoded))fail();
  const bytes=Buffer.from(encoded,'base64url');if(bytes.toString('base64url')!==encoded)fail();
  const value=JSON.parse(bytes.toString('utf8'));
  // The source's persisted deadline remains authoritative during redemption.
  if(value.version!==1||!Number.isSafeInteger(value.expiresAt)||value.expiresAt<=Date.now()||value.expiresAt>Date.now()+TTL+CLOCK_SKEW)fail();
  const origin=exactHttpsOrigin(value.origin),installationId=requireUuid(value.installationId),grantId=requireUuid(value.grantId),token=tokenValue(value.token);
  if(value.ca!==undefined&&(typeof value.ca!=='string'||value.ca.length>32768||!value.ca.includes('-----BEGIN CERTIFICATE-----')))fail();
  return {version:1,origin,installationId,...(value.ca?{ca:value.ca}:{}),grantId,token,expiresAt:value.expiresAt};
 }catch{fail();}
}
export async function issueServerRecovery({peerId,authority,assertAuthorized},env=process.env){
 requireUuid(peerId);const source=await serverProfileIdentity(env),token=randomBytes(32).toString('hex'),grantId=randomUUID();
 return serverProfileTransaction(async state=>{
  const peer=state.peers.find(p=>p.id===peerId);if(!peer)fail();
  const access=authorityValue(authority,peer);await assertAuthorized(access,peer);
  state.recoveryGrants??={};
  for(const [id,g] of Object.entries(state.recoveryGrants))if(g.expiresAt<=Date.now()||g.peerId===peerId)delete state.recoveryGrants[id];
  const expiresAt=Date.now()+TTL;
  state.recoveryGrants[grantId]={peerId,tokenHash:hash(token),expiresAt,binding:serverPeerBinding(peer),previous:peer,source,authority:access};
  const value={version:1,origin:source.origin,installationId:source.installationId,...(source.ca?{ca:source.ca}:{}),grantId,token,expiresAt};
  return {code:PREFIX+Buffer.from(JSON.stringify(value)).toString('base64url'),expiresAt};
 },env);
}
export async function revokeServerRecovery({peerId,assertAuthorized},env=process.env){
 requireUuid(peerId);
 return serverProfileTransaction(async state=>{
  const peer=state.peers.find(p=>p.id===peerId);if(!peer)fail();
  await assertAuthorized(undefined,peer);invalidateServerRecoveries(state,peerId);return {revoked:true};
 },env);
}
async function assertSourceCurrent(source,env){
 const current=await serverProfileIdentity(env);
 if(current.installationId!==source.installationId||current.origin!==source.origin||(current.ca||null)!==(source.ca||null))fail();
}
async function context(state,input,env){
 requireUuid(input.grantId);tokenValue(input.token);tokenValue(input.secret);
 const grant=state.recoveryGrants?.[input.grantId];
 if(!grant||grant.expiresAt<=Date.now()||!timingSafeEqual(Buffer.from(hash(input.token)),Buffer.from(grant.tokenHash)))fail();
 await assertSourceCurrent(grant.source,env);
 const identity=publicIdentity(input.identity),old=validatePeer(grant.previous);
 if(identity.origin!==old.origin||identity.installationId===env.STUDIOLINK_INSTALLATION_ID)fail();
 const expected=createHmac('sha256',input.token).update('castlink-server-recovery-v1\0'+state.installationId+'\0'+identity.installationId+'\0'+input.grantId).digest('hex');
 if(!timingSafeEqual(Buffer.from(expected),Buffer.from(input.secret)))fail();
 const peer=validatePeer({id:old.id,label:old.label,installationId:identity.installationId,origin:identity.origin,secret:input.secret,scope:old.scope,...(identity.ca?{ca:identity.ca}:{})});
 const candidateBinding=hash(JSON.stringify({identity,peer}));
 if(grant.candidateBinding&&grant.candidateBinding!==candidateBinding)fail();
 const current=state.peers.find(p=>p.id===old.id);if(!current)fail();
 if(grant.committed){if(serverPeerBinding(current)!==serverPeerBinding(peer))fail();}
 else if(serverPeerBinding(current)!==grant.binding)fail();
 return {grant,candidateBinding,peer,previous:old,source:grant.source,authority:grant.authority,committed:grant.committed===true};
}
export async function prepareServerRecovery(input,env=process.env){
 return serverProfileTransaction(async state=>{
  const {grant,candidateBinding,...result}=await context(state,input,env);
  grant.candidateBinding=candidateBinding;return result;
 },env);
}
export async function commitServerRecovery(input,env=process.env){
 return serverProfileTransaction(async state=>{
  const {grant,candidateBinding,peer,previous,authority,committed}=await context(state,input,env);
  if(!grant.candidateBinding||grant.candidateBinding!==candidateBinding)fail();
  await input.assertAuthorized(authority,previous);
  await assertSourceCurrent(grant.source,env);
  // Authorization may await storage; expiry is checked again before the write.
  if(grant.expiresAt<=Date.now())fail();
  if(!committed){
   state.peers=state.peers.map(p=>p.id===peer.id?peer:p);
   for(const [id,g] of Object.entries(state.recoveryGrants))if(g.peerId===peer.id&&id!==input.grantId)delete state.recoveryGrants[id];
   grant.committed=true;
  }
  return {ok:true,peer};
 },env);
}
