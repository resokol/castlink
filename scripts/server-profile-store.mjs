import {randomUUID} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm,lstat} from 'node:fs/promises';
import {request} from 'node:http';
import {isIP} from 'node:net';
import path from 'node:path';
import {pathToFileURL} from 'node:url';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export function requireUuid(value){if(typeof value!=='string'||!uuid.test(value))throw Error('Invalid immutable UUID');return value;}
export function exactHttpsOrigin(value){
 const url=new URL(value);
 if(url.protocol!=='https:'||url.username||url.password||url.pathname!=='/'||url.search||url.hash||url.origin!==value)throw Error('An exact HTTPS origin is required');
 return url.origin;
}
export function validateProvisioningHost(value,env=process.env){
 if(typeof value!=='string'||isIP(value)!==4)throw Error('SSH requires a public literal IPv4');
 const p=value.split('.').map(Number);
 const privateAddress=p[0]===10||(p[0]===172&&p[1]>=16&&p[1]<=31)||(p[0]===192&&p[1]===168);
 const prohibited=p[0]===0||p[0]===127||p[0]>=224||(p[0]===169&&p[1]===254)||(p[0]===100&&p[1]>=64&&p[1]<=127)||(p[0]===192&&p[1]===0)||(p[0]===198&&(p[1]===18||p[1]===19||p[1]===51&&p[2]===100))||(p[0]===203&&p[1]===0&&p[2]===113);
 let approved=[];try{approved=JSON.parse(env.CASTLINK_PROVISIONING_PRIVATE_IPS_JSON||'[]');}catch{throw Error('Invalid operator network policy');}
 if(prohibited||privateAddress&&(!Array.isArray(approved)||!approved.includes(value)))throw Error('SSH requires a public IPv4; private networks require an installation policy');
 return value;
}
export function validatePeer(value){
 if(!value||typeof value!=='object')throw Error('Invalid server peer');
 requireUuid(value.id);requireUuid(value.installationId);exactHttpsOrigin(value.origin);
 if(typeof value.label!=='string'||!value.label.trim()||value.label.length>100||/[\x00-\x1f]/.test(value.label)||typeof value.secret!=='string'||!/^[a-f0-9]{64}$/.test(value.secret))throw Error('Invalid server peer');
 if(value.scope?.kind==='room')requireUuid(value.scope.roomId);else if(value.scope?.kind!=='installation')throw Error('Invalid peer scope');
 if(value.ca!==undefined&&(typeof value.ca!=='string'||value.ca.length>32768||!value.ca.includes('-----BEGIN CERTIFICATE-----')))throw Error('Invalid peer CA');
 if(value.connectAddress!==undefined&&isIP(value.connectAddress)!==4)throw Error('Invalid pinned peer address');
 return {id:value.id,label:value.label,installationId:value.installationId,origin:value.origin,secret:value.secret,scope:value.scope.kind==='room'?{kind:'room',roomId:value.scope.roomId}:{kind:'installation'},...(value.ca?{ca:value.ca}:{}),...(value.connectAddress?{connectAddress:value.connectAddress}:{})};
}
const directory=(env)=>env.STUDIOLINK_DATA_DIR||'/data';
async function readState(env){
 const installationId=requireUuid(env.STUDIOLINK_INSTALLATION_ID);
 try{
  const location=path.join(directory(env),'server-profiles.json');
  const info=await lstat(location);if(!info.isFile()||info.isSymbolicLink()||info.size>4*1024*1024)throw Error('Invalid server profile file');
  const state=JSON.parse(await readFile(location,'utf8'));
  if(state.schemaVersion!==1||state.installationId!==installationId||!Array.isArray(state.peers))throw Error('Server profile installation mismatch');
  state.peers=state.peers.map(validatePeer);return state;
 }catch(error){if(error.code==='ENOENT')return {schemaVersion:1,installationId,peers:[]};throw error;}
}
export async function serverProfileIdentity(env=process.env){
 const installationId=requireUuid(env.STUDIOLINK_INSTALLATION_ID);
 const id=env.CASTLINK_SERVER_ID||env.CASTLINK_NODE_ID||'srv-'+installationId.replaceAll('-','');
 const origin=exactHttpsOrigin(env.STUDIOLINK_TRANSFER_ORIGIN||env.CASTLINK_PUBLIC_ORIGIN||'');
 let ca;try{ca=await readFile(path.join(directory(env),'server-origin-ca.pem'),'utf8');}catch(error){if(error.code!=='ENOENT')throw error;}
 return {installationId,id,label:env.STUDIOLINK_TRANSFER_SERVER_LABEL||'CastLink',origin,...(ca?{ca}:{})};
}
export async function listRoomServerProfiles(roomId,env=process.env){requireUuid(roomId);return (await readState(env)).peers.filter(p=>p.scope.kind==='installation'||p.scope.roomId===roomId);}
export async function getServerPeer({peerId,roomId},env=process.env){requireUuid(peerId);return (await listRoomServerProfiles(roomId,env)).find(p=>p.id===peerId)||null;}
export async function getIncomingServerPeer(peerId,env=process.env){requireUuid(peerId);return (await readState(env)).peers.find(p=>p.id===peerId)||null;}
export async function putServerPeer(value,env=process.env){
 const peer=validatePeer(value),folder=path.resolve(directory(env));
 const key=Symbol.for('castlink.server-profile-write-queue');
 const queues=globalThis[key]||(globalThis[key]=new Map());
 const operation=(queues.get(folder)||Promise.resolve()).catch(()=>undefined).then(async()=>{
  await mkdir(folder,{recursive:true,mode:0o700});
  const temporary=path.join(folder,'.server-profiles-'+randomUUID()+'.json');
  try{
  const state=await readState(env),existing=state.peers.find(p=>p.id===peer.id);
  if(existing&&JSON.stringify(existing)!==JSON.stringify(peer))throw Error('Server pairing conflict');
  if(!existing){if(state.peers.length>=256)throw Error('Server profile limit reached');state.peers.push(peer);}
  await writeFile(temporary,JSON.stringify(state),{mode:0o600,flag:'wx'});await rename(temporary,path.join(folder,'server-profiles.json'));
  return peer;
  }finally{await rm(temporary,{force:true});}
 });
 queues.set(folder,operation);
 const done=()=>{if(queues.get(folder)===operation)queues.delete(folder);};
 void operation.then(done,done);return operation;
}
export async function registerPeerViaOperator(peer,env=process.env){
 requireUuid(env.STUDIOLINK_INSTALLATION_ID);validatePeer(peer);
 const token=env.CASTLINK_SETUP_TOKEN;
 if(typeof token!=='string'||token.length<32)throw Error('Installation operator token is unavailable');
 const body=JSON.stringify({expectedInstallationId:env.STUDIOLINK_INSTALLATION_ID,peer});
 return new Promise((resolve,reject)=>{
  const req=request({hostname:'127.0.0.1',port:3000,path:'/api/server-provisioning/operator',method:'POST',timeout:15000,headers:{'content-type':'application/json','x-castlink-profile-operator':token}},res=>{
   let count=0,text='';res.on('data',chunk=>{count+=chunk.length;if(count>65536){req.destroy();reject(Error('Operator response is invalid'));return;}text+=chunk;});
   res.on('error',()=>reject(Error('Operator registration failed')));
   res.on('end',()=>{try{const value=JSON.parse(text);if(res.statusCode!==200||value.ok!==true)throw Error('Operator registration refused');resolve(value);}catch{reject(Error('Operator registration refused'));}});
  });
  req.on('error',()=>reject(Error('Operator registration failed')));req.on('timeout',()=>req.destroy());req.end(body);
 });
}
// Trusted installation operator entry: JSON secrets travel only through stdin.
export async function operator(input,env=process.env){
 if(input?.action==='identity')return serverProfileIdentity(env);
 if(input?.action==='register'){await registerPeerViaOperator(input.peer,env);return {ok:true,...await serverProfileIdentity(env)};}
 throw Error('Invalid server profile operation');
}
async function runOperator(){
 let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>65536)throw Error('Input too large');}
 try{console.log(JSON.stringify(await operator(JSON.parse(input))));}catch{console.error('Server profile operation refused');process.exitCode=1;}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)void runOperator();
