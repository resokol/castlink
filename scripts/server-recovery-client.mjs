import {createHmac} from 'node:crypto';
import {request} from 'node:http';
import {pathToFileURL} from 'node:url';
import * as profiles from './server-profile-store.mjs';
import {requestServerPeer} from './server-peer-request.mjs';

const refusal='Server recovery refused. Check the code and retry while it is valid.';
const publicProfile=peer=>({id:peer.id,label:peer.label,origin:peer.origin,installationId:peer.installationId});

// The token and newly derived key travel only in verified HTTPS bodies or the
// trusted local operator request. Neither is included in returned profiles.
export async function recoverServerConnection(code,{env=process.env,requestPeer=requestServerPeer,replacePeer=profiles.replacePeerViaOperator}={}){
 try{
  const {parseServerRecoveryCode,serverPeerBinding}=await import('./server-recovery-store.mjs');
  const grant=parseServerRecoveryCode(code),identity=await profiles.serverProfileIdentity(env);
  const expiresAt=typeof grant.expiresAt==='number'?grant.expiresAt:Date.parse(grant.expiresAt);
  if(!Number.isFinite(expiresAt)||expiresAt<=Date.now()||identity.installationId===grant.installationId)throw Error(refusal);
  const secret=createHmac('sha256',grant.token).update('castlink-server-recovery-v1\0'+grant.installationId+'\0'+identity.installationId+'\0'+grant.grantId).digest('hex');
  const target={origin:grant.origin,...(grant.ca?{ca:grant.ca}:{})};
  const exchange=async action=>{
   const response=await requestPeer(target,'/api/server-recovery/bridge',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action,grantId:grant.grantId,token:grant.token,identity,secret}),timeoutMs:15000});
   if(response.status!==200)throw Error(refusal);
   const result=await response.json();if(result?.ok!==true)throw Error(refusal);return result;
  };
  const prepared=await exchange('prepare'),source=prepared.source;
  if(source?.installationId!==grant.installationId||source?.origin!==grant.origin||source?.ca!==grant.ca)throw Error(refusal);
  const reverse=profiles.validatePeer({id:prepared.peerId,label:source.label,installationId:source.installationId,origin:source.origin,secret,scope:prepared.scope,...(source.ca?{ca:source.ca}:{})});
  const existing=await profiles.getIncomingServerPeer(reverse.id,env);
  if(existing&&(existing.origin!==reverse.origin||existing.installationId!==reverse.installationId||JSON.stringify(existing.scope)!==JSON.stringify(reverse.scope)))throw Error(refusal);
  if(existing)reverse.label=existing.label;
  const previousBinding=existing?serverPeerBinding(existing):null;
  if(previousBinding!==serverPeerBinding(reverse))await replacePeer(reverse,previousBinding,env);
  const completed=await exchange('commit'),profile=publicProfile(reverse);
  if(completed.profile?.id!==reverse.id||completed.profile.installationId!==identity.installationId||completed.profile.origin!==identity.origin)throw Error(refusal);
  return {ok:true,profile};
 }catch{throw Error(refusal);}
}

export async function issueServerRecoveryCode(peerId,env=process.env){
 try{
  profiles.requireUuid(peerId);profiles.requireUuid(env.STUDIOLINK_INSTALLATION_ID);
  if(typeof env.CASTLINK_SETUP_TOKEN!=='string'||env.CASTLINK_SETUP_TOKEN.length<32)throw Error(refusal);
  const body=JSON.stringify({action:'recovery-code',peerId,expectedInstallationId:env.STUDIOLINK_INSTALLATION_ID});
  return await new Promise((resolve,reject)=>{
   const req=request({hostname:'127.0.0.1',port:3000,path:'/api/server-provisioning/operator',method:'POST',timeout:15000,headers:{'content-type':'application/json','x-castlink-profile-operator':env.CASTLINK_SETUP_TOKEN}},res=>{
    let bytes=0;const chunks=[];
    res.on('data',chunk=>{bytes+=chunk.length;if(bytes>65536){req.destroy();reject(Error(refusal));return;}chunks.push(chunk);});
    res.on('error',()=>reject(Error(refusal)));
    res.on('end',()=>{try{const value=JSON.parse(Buffer.concat(chunks));if(res.statusCode!==200||value.ok!==true||typeof value.code!=='string'||!value.expiresAt)throw Error(refusal);resolve({ok:true,code:value.code,expiresAt:value.expiresAt});}catch{reject(Error(refusal));}});
   });
   req.on('error',()=>reject(Error(refusal)));req.on('timeout',()=>req.destroy());req.end(body);
  });
 }catch{throw Error(refusal);}
}

async function cli(){
 try{
  if(process.argv.length!==2)throw Error(refusal);
  let bytes=0;const chunks=[];
  for await(const chunk of process.stdin){bytes+=chunk.length;if(bytes>81920)throw Error(refusal);chunks.push(chunk);}
  const input=JSON.parse(Buffer.concat(chunks));
  const result=input?.action==='recover'?await recoverServerConnection(input.code):input?.action==='recovery-code'?await issueServerRecoveryCode(input.peerId):null;
  if(!result)throw Error(refusal);console.log(JSON.stringify(result));
 }catch{console.error(refusal);process.exitCode=1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void cli();
