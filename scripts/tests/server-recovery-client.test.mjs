import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {createServer} from 'node:http';

const sourceId=randomUUID(), destinationId=randomUUID(), peerId=randomUUID(), roomId=randomUUID(), grantId=randomUUID();
const token='b'.repeat(64), ca='-----BEGIN CERTIFICATE-----\nsource-fixture\n-----END CERTIFICATE-----';
const source={installationId:sourceId,id:'srv-source',label:'Surviving server',origin:'https://source.example.com',ca};
const grant={version:1,origin:source.origin,installationId:sourceId,ca,grantId,token,expiresAt:Date.now()+600000};
const encode=value=>'CASTLINK-RECOVERY-1.'+Buffer.from(JSON.stringify(value)).toString('base64url');
const code=encode(grant);
async function fixture(t){
 const folder=await mkdtemp(path.join(os.tmpdir(),'castlink-recovery-client-'));t.after(()=>rm(folder,{recursive:true,force:true}));
 return {folder,env:{STUDIOLINK_DATA_DIR:folder,STUDIOLINK_INSTALLATION_ID:destinationId,CASTLINK_PUBLIC_ORIGIN:'https://replacement.example.com'}};
}

test('fresh destination recovers both directions and identical retry retains its key after a lost commit response',async t=>{
 const {recoverServerConnection}=await import('../server-recovery-client.mjs');
 const core=await import('../server-profile-store.mjs');
 const {serverPeerBinding}=await import('../server-recovery-store.mjs');
 const {env}=await fixture(t);const unrelated={id:randomUUID(),installationId:randomUUID(),label:'Other',origin:'https://other.example.com',secret:'a'.repeat(64),scope:{kind:'installation'}};
 await core.putServerPeer(unrelated,env);
 let committed=null, loseResponse=true;
 const requestPeer=async(peer,pathname,options)=>{
  assert.equal(pathname,'/api/server-recovery/bridge');assert.equal(peer.origin,source.origin);assert.equal(peer.ca,ca);assert.equal(peer.connectAddress,undefined);
  assert.equal(options.method,'POST');assert.equal(options.headers['content-type'],'application/json');assert.equal(options.headers.origin,undefined);
  const input=JSON.parse(options.body);assert.equal(input.token,token);assert.equal(input.grantId,grantId);assert.equal(input.identity.installationId,destinationId);
  const expected=createHmac('sha256',token).update('castlink-server-recovery-v1\0'+sourceId+'\0'+destinationId+'\0'+grantId).digest('hex');assert.equal(input.secret,expected);
  if(input.action==='prepare')return Response.json({ok:true,source,peerId,scope:{kind:'room',roomId}});
  committed={id:peerId,installationId:input.identity.installationId,secret:input.secret,scope:{kind:'room',roomId}};
  if(loseResponse){loseResponse=false;throw Error('lost response '+code);}
  return Response.json({ok:true,profile:{id:peerId,label:'Replacement',origin:input.identity.origin,installationId:destinationId,scope:'room'}});
 };
 const replacePeer=async(peer,binding,environment)=>{
  if(committed)throw Error('new pair is now busy; identical reverse must not be rewritten');
  const existing=await core.getIncomingServerPeer(peerId,environment);assert.equal(binding,existing?serverPeerBinding(existing):null);
  return core.replaceServerPeer({peer,expectedBinding:binding,assertAuthorized:async()=>{}},environment);
 };
 await assert.rejects(recoverServerConnection(code,{env,requestPeer,replacePeer}),error=>!error.message.includes(token)&&!error.message.includes(code));
 const result=await recoverServerConnection(code,{env,requestPeer,replacePeer});
 assert.deepEqual(result,{ok:true,profile:{id:peerId,label:source.label,origin:source.origin,installationId:sourceId}});
 const reverse=await core.getIncomingServerPeer(peerId,env);assert.equal(reverse.secret,committed.secret);assert.equal(committed.installationId,destinationId);assert.equal(reverse.ca,ca);assert.deepEqual(reverse.scope,{kind:'room',roomId});
 assert.deepEqual(await core.getIncomingServerPeer(unrelated.id,env),unrelated);
 assert.equal(JSON.stringify(result).includes(reverse.secret),false);assert.equal(JSON.stringify(result).includes(token),false);
});

test('recovery refuses source identity substitution and invalid scope before changing local profiles',async t=>{
 const {recoverServerConnection}=await import('../server-recovery-client.mjs');const {env}=await fixture(t);
 for(const changed of [{source:{...source,installationId:randomUUID()}},{source:{...source,origin:'https://other.example.com'}},{source:{...source,ca:undefined}},{scope:{kind:'room',roomId:'invalid'}},{scope:{kind:'all'}}]){
  let replaced=false;await assert.rejects(recoverServerConnection(code,{env,requestPeer:async()=>Response.json({ok:true,source,peerId,scope:{kind:'installation'},...changed}),replacePeer:async()=>{replaced=true;}}));assert.equal(replaced,false);
 }
});

test('a refused local replacement never commits and remote error text is redacted',async t=>{
 const {recoverServerConnection}=await import('../server-recovery-client.mjs');const {env}=await fixture(t);let commits=0;
 await assert.rejects(recoverServerConnection(code,{env,requestPeer:async(_peer,_path,options)=>{if(JSON.parse(options.body).action==='commit')commits++;return Response.json({ok:true,source,peerId,scope:{kind:'installation'}});},replacePeer:async()=>{throw Error('stale binding '+token);}}),error=>!error.message.includes(token));assert.equal(commits,0);
 await assert.rejects(recoverServerConnection(code,{env,requestPeer:async()=>new Response(token,{status:403})}),error=>!error.message.includes(token));
});

test('an existing reverse must identify the same source and scope, preserving its local label',async t=>{
 const {recoverServerConnection}=await import('../server-recovery-client.mjs'),core=await import('../server-profile-store.mjs');const {env}=await fixture(t);
 const reverse={id:peerId,label:'My source label',installationId:sourceId,origin:source.origin,secret:'a'.repeat(64),scope:{kind:'room',roomId},ca};
 await core.putServerPeer(reverse,env);
 const requestPeer=async(_peer,_path,options)=>Response.json(JSON.parse(options.body).action==='prepare'?{ok:true,source,peerId,scope:{kind:'room',roomId}}:{ok:true,profile:{id:peerId,installationId:destinationId,origin:env.CASTLINK_PUBLIC_ORIGIN,label:'Replacement'}});
 const replacePeer=(peer,expectedBinding,environment)=>core.replaceServerPeer({peer,expectedBinding,assertAuthorized:async()=>{}},environment);
 const result=await recoverServerConnection(code,{env,requestPeer,replacePeer});assert.equal(result.profile.label,reverse.label);assert.equal((await core.getIncomingServerPeer(peerId,env)).label,reverse.label);
 for(const changed of [{installationId:randomUUID()},{origin:'https://other.example.com'},{scope:{kind:'installation'}}]){
  const other=await fixture(t);await core.putServerPeer({...reverse,...changed},other.env);let replaced=false;
  await assert.rejects(recoverServerConnection(code,{env:other.env,requestPeer,replacePeer:async()=>{replaced=true;}}));assert.equal(replaced,false);
 }
});

test('malformed/expired code and self recovery fail before contacting a source',async t=>{
 const {recoverServerConnection}=await import('../server-recovery-client.mjs');const {env}=await fixture(t);
 for(const value of ['bad',encode({...grant,expiresAt:Date.now()-1}),encode({...grant,installationId:destinationId})])await assert.rejects(recoverServerConnection(value,{env,requestPeer:async()=>{throw Error('unexpected network call');}}),error=>!error.message.includes('unexpected network call'));
});

test('maximum CA recovery codes retain the CA through verified transport',async t=>{
 const {recoverServerConnection}=await import('../server-recovery-client.mjs');const {env}=await fixture(t);
 const header='-----BEGIN CERTIFICATE-----\n',footer='\n-----END CERTIFICATE-----';const largeCa=header+'x'.repeat(32768-header.length-footer.length)+footer;
 const largeCode=encode({...grant,ca:largeCa});assert.ok(largeCode.length>32768);
 const result=await recoverServerConnection(largeCode,{env,replacePeer:async()=>{},requestPeer:async(peer,_path,options)=>{
  assert.equal(peer.ca,largeCa);
  return Response.json(JSON.parse(options.body).action==='prepare'?{ok:true,source:{...source,ca:largeCa},peerId,scope:{kind:'installation'}}:{ok:true,profile:{id:peerId,installationId:destinationId,origin:env.CASTLINK_PUBLIC_ORIGIN}});
 }});assert.equal(result.profile.installationId,sourceId);
});

test('trusted local issuance authenticates on loopback and returns only the new code and deadline',async t=>{
 const {issueServerRecoveryCode}=await import('../server-recovery-client.mjs');const setupToken='operator-fixture-'.repeat(4);let failed=false;
 const server=createServer(async(req,res)=>{
  assert.equal(req.url,'/api/server-provisioning/operator');assert.equal(req.method,'POST');assert.equal(req.headers['x-castlink-profile-operator'],setupToken);assert.equal(req.headers.origin,undefined);
  const chunks=[];for await(const c of req)chunks.push(c);assert.deepEqual(JSON.parse(Buffer.concat(chunks)),{action:'recovery-code',peerId,expectedInstallationId:sourceId});
  res.statusCode=failed?403:200;res.end(JSON.stringify(failed?{error:setupToken}:{ok:true,code,expiresAt:grant.expiresAt,secret:'must-not-escape'}));
 });
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(3000,'127.0.0.1',resolve);});
 t.after(()=>new Promise(resolve=>{server.closeAllConnections();server.close(resolve);}));
 const env={STUDIOLINK_INSTALLATION_ID:sourceId,CASTLINK_SETUP_TOKEN:setupToken};
 assert.deepEqual(await issueServerRecoveryCode(peerId,env),{ok:true,code,expiresAt:grant.expiresAt});failed=true;
 await assert.rejects(issueServerRecoveryCode(peerId,env),error=>!error.message.includes(setupToken));
});

test('stdin CLI refuses oversized or secret-bearing failures without echoing input or accepting argv code',()=>{
 for(const input of [JSON.stringify({action:'recover',code:'SECRET-RECOVERY'}),'x'.repeat(90000)]){
  const p=spawnSync(process.execPath,['scripts/server-recovery-client.mjs'],{input,encoding:'utf8'});assert.equal(p.status,1);assert.equal(p.stdout,'');assert.match(p.stderr,/Server recovery refused/);assert.equal(p.stderr.includes('SECRET-RECOVERY'),false);
 }
 const p=spawnSync(process.execPath,['scripts/server-recovery-client.mjs','SECRET-RECOVERY'],{input:'{}',encoding:'utf8'});assert.equal(p.status,1);assert.equal(p.stderr.includes('SECRET-RECOVERY'),false);
});
