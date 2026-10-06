import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual as equal} from 'node:util';
import {nodeServiceTarget} from './service-target.js';
import {nodeObserver} from './setup-verification-target.js';
import {parseStrictJson} from './strict-json.js';
import {validateControllerAssociation,controllerAssociationDigest,PRIVATE_CONTROL_VERSION,type ControllerAssociation} from './lifecycle-controller.js';
import {PRIVATE_CONTROL_IMAGE_ID,PRIVATE_CONTROL_BINARY_SHA256,loadHostControllerDescriptor,type HostControllerDescriptor} from './host-startup-target.js';
import {readDesiredState,writeDesiredState} from './host-startup-state.js';
import type {SetupVerificationRequest} from './setup-verification.js';
export type HostProducerGeneration={engine:string;endpoint:string;epoch:number;principal:number;scope:string};
export type HostProducerRequest={schemaVersion:1;generation:HostProducerGeneration;completion:SetupVerificationRequest};
// PRIVATE integration response. Neither paths nor associations are CLI output.
export type HostProducerResult={schemaVersion:1;contract:'castlink-host-producer-v1';generation:HostProducerGeneration;descriptorFile:string;associationDigest:string;closedProcessNonce:string};
const require=createRequire(import.meta.url);
const native=new Function('require',nodeServiceTarget.slice(0,nodeServiceTarget.indexOf("let serviceInput='';"))+`return {acquireTargetOperation,dispatchTargetOperation,releaseTargetOperation,leasePrivate,imageRead,imageFiles,leaseEngine,serviceConfig,serviceOwned,serviceInventory,serviceIdentity,serviceReady};`)(require) as any;
const observer=new Function('require',nodeObserver.slice(0,nodeObserver.indexOf("let input='';process.stdin"))+`const originalHttp=http;http=(r,c,m,...a)=>{if(m!=='GET')fail();return originalHttp(r,c,m,...a)};return {validate,local,server,observe};`)(require) as any;
const binary='/usr/local/bin/livekit-server-private';
const names=['postgres','web','livekit','caddy'] as const;
const hash=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
function fail():never{throw Error('host-producer-unverified')}
function keys(v:unknown,wanted:string):asserts v is Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==wanted.split(',').sort().join(','))fail()}
function query(args:string[],input?:string,cap=65536):string{const p=spawnSync('docker',args,{input,timeout:120000,maxBuffer:cap,shell:false,windowsHide:true});if(p.error||p.signal||p.status!==0||p.stderr.length)fail();return p.stdout.toString('utf8')}
function undouble(v:any):any{return typeof v==='string'?v.replaceAll('$$','$'):Array.isArray(v)?v.map(undouble):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,undouble(x)])):v}
function publish(file:string,value:unknown){const bytes=JSON.stringify(value)+'\n',fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,0o600);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}const directory=fs.openSync(path.dirname(file),fs.constants.O_RDONLY|fs.constants.O_DIRECTORY);try{fs.fsyncSync(directory)}finally{fs.closeSync(directory)}}

// Target-side one-owner PRE/normal-completion/publication/POST. Every uncertain
// outcome leaves the persistent lease; no completion journal authorizes RUN.
export async function produceHostController(input:HostProducerRequest):Promise<HostProducerResult>{
 try{
  const request=structuredClone(input);keys(request,'schemaVersion,generation,completion');keys(request.generation,'engine,endpoint,epoch,principal,scope');
  if(request.schemaVersion!==1||!['linux','darwin'].includes(process.platform)||!process.getuid)fail();
  const g=request.generation,r=observer.validate(request.completion),principal=os.userInfo();
  if(!r.complete||!r.attempt||r.attempt.path!==path.join(path.dirname(r.ownerFile),'setup-completion.json')||g.principal!==process.getuid()||g.principal!==principal.uid||g.scope!==path.join(principal.homedir,'.castlink-target-operations')||typeof g.endpoint!=='string')fail();
  const lease=native.acquireTargetOperation({schemaVersion:1,kind:'completion',root:r.root,installationId:r.installationId,engine:g.engine,epoch:g.epoch,principal:g.principal,scope:g.scope});
  const assertOwned=()=>{native.dispatchTargetOperation(lease);if(lease.owner.endpoint!==g.endpoint||!equal(native.leaseEngine(),{engine:g.engine,endpoint:g.endpoint}))fail()};
  assertOwned();
  const serviceFile=path.join(g.scope,'services-'+r.installationId+'.json'),resourceFile=path.join(g.scope,'resources-'+r.installationId+'.json');
  const serviceBytes=native.imageRead(serviceFile) as Buffer,resourceBytes=native.imageRead(resourceFile) as Buffer;
  const receipt=parseStrictJson(serviceBytes.toString(),1048576),resources=parseStrictJson(resourceBytes.toString(),1048576);keys(receipt,'schemaVersion,root,installationId,engine,endpoint,files,contract');keys(resources,'schemaVersion,resources');
  if(receipt.schemaVersion!==1||resources.schemaVersion!==1||receipt.root!==r.root||receipt.installationId!==r.installationId||receipt.engine!==g.engine||receipt.endpoint!==g.endpoint||!equal(receipt.files,native.imageFiles(r.root,r.installationId)))fail();
  const model=undouble(parseStrictJson(native.imageRead(path.join(r.root,'compose.yaml')).toString(),1048576));
  const service={...receipt,model,project:receipt.contract.project,caddySHA256:hash(model.configs.caddy.content)};
  const inventory=()=>{assertOwned();if(!native.imageRead(serviceFile).equals(serviceBytes)||!native.imageRead(resourceFile).equals(resourceBytes))fail();native.serviceConfig(service);const owned=native.serviceOwned(service,native.serviceInventory());if(!equal(native.serviceIdentity(owned),resources.resources)||!native.serviceReady(owned))fail();return owned};
  const owned=inventory();
  if(owned.containers.find((c:any)=>c.Labels['com.docker.compose.service']==='web')?.Id!==r.webContainerId||owned.containers.find((c:any)=>c.Labels['com.docker.compose.service']==='caddy')?.Id!==r.caddyContainerId||receipt.contract.images.web.Id!==r.webImageId||receipt.contract.images.caddy.Id!==r.caddyImageId)fail();
  for(const name of ['compose.yaml','livekit.yaml','postgres.env','web.env'])if(receipt.files[name]!==r.files[name]?.sha256)fail();
  const controlRoot=path.join(g.scope,'livekit-control-'+r.installationId),control={configFile:path.join(controlRoot,'config.json'),stateDir:path.join(controlRoot,'state')};
  const association:ControllerAssociation=validateControllerAssociation({schemaVersion:1,installationId:r.installationId,platform:process.platform==='darwin'?'macos':'ubuntu',architecture:'amd64',principal:'uid:'+g.principal,scope:g.scope,root:r.root,engine:g.engine,endpoint:g.endpoint,config:Object.fromEntries(['compose.yaml','livekit.yaml','postgres.env','web.env'].map(n=>[n,receipt.files[n]])),images:Object.fromEntries(names.map(n=>[n,{imageId:receipt.contract.images[n].Id,reference:model.services[n].image}])) as ControllerAssociation['images'],containers:Object.fromEntries(owned.containers.map((c:any)=>[c.Labels['com.docker.compose.service'],c.Id])) as ControllerAssociation['containers'],volumes:resources.resources.volumes,network:{name:owned.networks[0].Name,id:owned.networks[0].Id},controlVersion:PRIVATE_CONTROL_VERSION,controlBinarySHA256:PRIVATE_CONTROL_BINARY_SHA256});
  if(association.images.livekit.imageId!==PRIVATE_CONTROL_IMAGE_ID)fail();
  const binding={installationId:r.installationId,containerId:association.containers.livekit,digest:PRIVATE_CONTROL_IMAGE_ID,version:PRIVATE_CONTROL_VERSION};
  const controlStatus=()=>{
   assertOwned();native.leasePrivate(controlRoot,true);native.leasePrivate(control.stateDir,true);native.leasePrivate(control.stateDir+'.initialized',false);native.leasePrivate(path.join(control.stateDir,'state.json'),false);
   const config=parseStrictJson(native.imageRead(control.configFile).toString(),8192);keys(config,'binding,stateDir,secret');if(!equal(config.binding,binding)||config.stateDir!=='/run/castlink-idleseal/state'||typeof config.secret!=='string'||Buffer.byteLength(config.secret)<32||Buffer.byteLength(config.secret)>4096)fail();
   const inspected=parseStrictJson(query(['inspect',binding.containerId],undefined,1048576),1048576) as any;if(!Array.isArray(inspected)||inspected.length!==1)fail();const c=inspected[0];
   if(c.Id!==binding.containerId||c.Image!==binding.digest||c.State.Running!==true||![''+process.getuid!(),process.getuid!()+':'+process.getgid!()].includes(c.Config.User)||!equal(c.Config.Entrypoint,[binary])||c.Config.Env.filter((s:string)=>s.startsWith('CASTLINK_IDLE_SEAL_CONFIG=')).join(',')!=='CASTLINK_IDLE_SEAL_CONFIG=/run/castlink-idleseal/config.json')fail();
   for(const [source,target,rw] of [[control.configFile,'/run/castlink-idleseal/config.json',false],[controlRoot,'/run/castlink-idleseal',true]])if(c.Mounts.filter((m:any)=>m.Type==='bind'&&m.Source===source&&m.Destination===target&&m.RW===rw).length!==1)fail();
   if(query(['exec',binding.containerId,binary,'--version']).trim()!=='livekit-server version '+PRIVATE_CONTROL_VERSION||query(['exec',binding.containerId,'/usr/bin/sha256sum',binary]).trim()!==PRIVATE_CONTROL_BINARY_SHA256+'  '+binary)fail();
   const status=parseStrictJson(query(['exec','-i',binding.containerId,binary,'castlink-idle-control'],JSON.stringify({operation:'status',binding}),8192),8192);keys(status,'result,processNonce,snapshot');keys(status.snapshot,'Pending,Live,Unknown,Sealed,processNonce');if(status.result!=='OK'||typeof status.processNonce!=='string'||!/^[a-f0-9]{64}$/.test(status.processNonce)||status.snapshot.processNonce!==status.processNonce||status.snapshot.Sealed!==true||['Pending','Live','Unknown'].some(k=>!Number.isSafeInteger(status.snapshot[k])||status.snapshot[k]<0))fail();return status.processNonce;
  };
  const nonce=controlStatus();observer.local(r);if(observer.server(r).setup!=='complete')fail();const observed=await observer.observe(r);if(observed.setup!=='complete'||observed.sql!=='verified'||!['invite','session'].includes(observed.ownerAccess))fail();observer.local(r);inventory();if(controlStatus()!==nonce)fail();
  const descriptor:HostControllerDescriptor={schemaVersion:1,association,service:{root:r.root,installationId:r.installationId,files:receipt.files,project:receipt.contract.project,model,contract:receipt.contract,resources:resources.resources,caddySHA256:service.caddySHA256},control,completion:r};
  const descriptorFile=path.join(g.scope,'host-controller-'+r.installationId+'.json');
  // Any existing or partial publication blocks; no overwrite/adopt/repair. A lost
  // successful response is diagnosed through protected target state, never replay.
  try{fs.lstatSync(descriptorFile);fail()}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e}
  const guard={assertOwned:(scope:string,id:string)=>{if(scope!==g.scope||id!==r.installationId)fail();assertOwned()}};
  if(readDesiredState(g.scope,r.installationId,guard)!==null)fail();
  assertOwned();publish(descriptorFile,descriptor);if(!equal(loadHostControllerDescriptor(descriptorFile),descriptor))fail();
  const digest=controllerAssociationDigest(association);writeDesiredState(g.scope,r.installationId,null,{schemaVersion:1,associationDigest:digest,desired:'RUN',revision:1,source:'verified-setup',operationNonce:lease.owner.nonce,evidenceSHA256:hash(JSON.stringify(r))},guard);
  observer.local(r);inventory();if(controlStatus()!==nonce||!equal(loadHostControllerDescriptor(descriptorFile),descriptor))fail();assertOwned();native.releaseTargetOperation(lease,true);
  return{schemaVersion:1,contract:'castlink-host-producer-v1',generation:{...g,epoch:g.epoch+1},descriptorFile,associationDigest:digest,closedProcessNonce:nonce};
 }catch{fail()}
}
