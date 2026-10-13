import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {isDeepStrictEqual} from 'node:util';
import {nodeServiceTarget} from './service-target.js';
import {nodeObserver} from './setup-verification-target.js';
import {parseStrictJson} from './strict-json.js';
import {readDesiredState,writeDesiredState} from './host-startup-state.js';
import {createLifecycleControllerRunner,validateControllerAssociation,PRIVATE_CONTROL_VERSION,type ControllerAssociation,type ControllerRequest,type FixedLifecycleRunner,type ControlRequest,type ControlResponse} from './lifecycle-controller.js';

// Fixed target-side Node runner. No caller script/argv or alternate lease domain.
// Packaged POSIX Node only; remote controllers run this on their own target.
export const PRIVATE_CONTROL_BINARY_SHA256='7fc823d552d9438914eba9c8878714a56038a3f324bdb6e763bc0998783d7d41';
export const PRIVATE_CONTROL_IMAGE_ID='sha256:b3ddff3a9605095a8da4b45e55b1d238cc1db51f4e3e896ff45e1815fc64c90f';
const require=createRequire(import.meta.url);
const servicePrefix=nodeServiceTarget.slice(0,nodeServiceTarget.indexOf("let serviceInput='';"));
const native=new Function('require',servicePrefix+`return {acquireTargetOperation,dispatchTargetOperation,releaseTargetOperation,targetOperationEpoch,leasePrivate,leaseRecord,imageRead,imageFiles,leaseEngine,serviceConfig,serviceOwned,serviceInventory,serviceIdentity,serviceReady};`)(require) as Native;
const observePrefix=nodeObserver.slice(0,nodeObserver.indexOf("let input='';process.stdin"));
// Completion provisioning is observation-only. The existing observer's optional
// completion POST is forbidden here even when SQL changes during observation.
const completion=new Function('require',observePrefix+`const originalHttp=http;http=(r,c,m,...a)=>{if(m!=='GET')fail();return originalHttp(r,c,m,...a)};return {validate,observe,server,local};`)(require) as {validate:(r:unknown)=>any;observe:(r:unknown)=>Promise<any>;server:(r:unknown)=>any;local:(r:unknown)=>any};
type Native={acquireTargetOperation:(a:unknown)=>any;dispatchTargetOperation:(l:any)=>void;releaseTargetOperation:(l:any,t:boolean)=>void;targetOperationEpoch:(s:string)=>number;leasePrivate:(s:string,d:boolean)=>fs.Stats;leaseRecord:(p:string)=>any;imageRead:(p:string)=>Buffer;imageFiles:(p:string,id:string)=>Record<string,string>;leaseEngine:()=>{engine:string;endpoint:string};serviceConfig:(r:any)=>void;serviceOwned:(r:any,v:any)=>any;serviceInventory:()=>any;serviceIdentity:(v:any)=>any;serviceReady:(v:any)=>boolean};
export type HostControllerDescriptor={schemaVersion:1;association:ControllerAssociation;service:{root:string;installationId:string;files:Record<string,string>;project:string;model:any;contract:any;resources:any;caddySHA256:string};control:{configFile:string;stateDir:string};completion:unknown};
function fail():never{throw Error('host-controller-unverified')}
function keys(v:unknown,wanted:string):asserts v is Record<string,any>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==wanted.split(',').sort().join(','))fail()}
const sha=(b:Buffer|string)=>createHash('sha256').update(b).digest('hex');
export function loadHostControllerDescriptor(file:string):HostControllerDescriptor{
 try{
  if(!['linux','darwin'].includes(process.platform)||!process.getuid)throw Error('native-host-controller-unavailable');
  const principal=os.userInfo(),scope=path.join(principal.homedir,'.castlink-target-operations');
  if(principal.uid!==process.getuid()||fs.realpathSync(principal.homedir)!==principal.homedir||fs.lstatSync(principal.homedir).uid!==principal.uid||path.dirname(file)!==scope)fail();
  native.leasePrivate(scope,true);const v=parseStrictJson(native.imageRead(file).toString('utf8'),1048576) as HostControllerDescriptor;
  keys(v,'schemaVersion,association,service,control,completion');const a=validateControllerAssociation(v.association);
  if(a.architecture!=='amd64'||a.controlBinarySHA256!==PRIVATE_CONTROL_BINARY_SHA256||a.images.livekit.imageId!==PRIVATE_CONTROL_IMAGE_ID)fail();
  if(v.schemaVersion!==1||a.principal!=='uid:'+principal.uid||a.scope!==scope||a.platform!== (process.platform==='darwin'?'macos':'ubuntu')||path.basename(file)!=='host-controller-'+a.installationId+'.json')fail();
  keys(v.service,'root,installationId,files,project,model,contract,resources,caddySHA256');keys(v.control,'configFile,stateDir');
  const r=v.service;if(r.root!==a.root||r.installationId!==a.installationId||r.project!=='castlink-'+a.installationId.replaceAll('-','')||r.contract.installationId!==a.installationId||r.contract.project!==r.project||r.contract.composePath!==path.join(a.root,'compose.yaml')||r.contract.composeSHA256!==a.config['compose.yaml']||Object.keys(r.model.services).sort().join(',')!=='caddy,livekit,postgres,web'||r.model.name!==r.project)fail();
  if(!/^[a-f0-9]{64}$/.test(r.caddySHA256)||!['compose.yaml,livekit.yaml,postgres.env,receipt.json,web.env','compose.yaml,livekit.yaml,owner.json,postgres.env,receipt.json,web.env'].includes(Object.keys(r.files).sort().join(','))||Object.values(r.files).some(h=>typeof h!=='string'||!/^[a-f0-9]{64}$/.test(h)))fail();
  for(const name of ['postgres','web','livekit','caddy'])if(r.model.services[name].image!==a.images[name as keyof typeof a.images].reference||r.contract.images[name]?.Id!==a.images[name as keyof typeof a.images].imageId)fail();
  for(const [name,digest] of Object.entries(a.config))if(r.files[name]!==digest)fail();
  const controlRoot=path.join(scope,'livekit-control-'+a.installationId);
  if(v.control.configFile!==path.join(controlRoot,'config.json')||v.control.stateDir!==path.join(controlRoot,'state'))fail();
  return {...structuredClone(v),association:a};
 }catch(e){if((e as Error).message==='native-host-controller-unavailable')throw e;fail()}
}
function command(args:string[],input?:string,cap=65536):{code:number;out:string;err:string}{
 const p=spawnSync('docker',args,{input,stdio:['pipe','pipe','pipe'],maxBuffer:cap,timeout:120000,shell:false,windowsHide:true});
 if(p.error||p.signal||p.status===null)fail();return{code:p.status,out:p.stdout.toString('utf8'),err:p.stderr.toString('utf8')};
}
function query(args:string[],cap=65536):string{const p=command(args,undefined,cap);if(p.code!==0||p.err)fail();return p.out}
export function createNativeHostControllerRunner(file:string):FixedLifecycleRunner{
 return createLifecycleControllerRunner({withLease:async(request,body)=>{
  const descriptor=loadHostControllerDescriptor(file),a=descriptor.association;
  if(!isDeepStrictEqual(request.association,a))fail();
  const captured=sha(native.imageRead(file));
  const lease=native.acquireTargetOperation({schemaVersion:1,kind:request.action==='stop'?'stop':request.action==='record-run'?'completion':'start',root:a.root,installationId:a.installationId,engine:a.engine,epoch:request.expectedEpoch,principal:Number(a.principal.slice(4)),scope:a.scope});
  const service={...descriptor.service,engine:a.engine,endpoint:a.endpoint};
  const assertOwned=async()=>{native.dispatchTargetOperation(lease);if(lease.owner.endpoint!==a.endpoint||sha(native.imageRead(file))!==captured||!isDeepStrictEqual(loadHostControllerDescriptor(file),descriptor))fail()};
  const inventory=()=>{
   const resourceReceipt=parseStrictJson(native.imageRead(path.join(a.scope,'resources-'+a.installationId+'.json')).toString(),1048576),serviceReceipt=parseStrictJson(native.imageRead(path.join(a.scope,'services-'+a.installationId+'.json')).toString(),1048576);
   if(!isDeepStrictEqual(resourceReceipt,{schemaVersion:1,resources:descriptor.service.resources})||!isDeepStrictEqual(serviceReceipt,{schemaVersion:1,root:a.root,installationId:a.installationId,engine:a.engine,endpoint:a.endpoint,files:descriptor.service.files,contract:descriptor.service.contract}))fail();
   native.serviceConfig(service);const owned=native.serviceOwned(service,native.serviceInventory());
   if(!isDeepStrictEqual(native.serviceIdentity(owned),descriptor.service.resources)||owned.containers.length!==4||owned.volumes.length!==4||owned.networks.length!==1)fail();
   for(const c of owned.containers)if(c.Id!==a.containers[c.Labels['com.docker.compose.service'] as keyof typeof a.containers])fail();
   if(!isDeepStrictEqual(owned.volumes.map((v:any)=>({name:v.Name,createdAt:v.CreatedAt})).sort((x:any,y:any)=>x.name.localeCompare(y.name)),a.volumes)||owned.networks[0].Id!==a.network.id||owned.networks[0].Name!==a.network.name)fail();
   return owned;
  };
  const guard={assertOwned:(scope:string,id:string)=>{if(scope!==a.scope||id!==a.installationId)fail();native.dispatchTargetOperation(lease)}};
  const assertControl=(running=true)=>{
   const directory=path.dirname(descriptor.control.configFile);native.leasePrivate(directory,true);native.leasePrivate(descriptor.control.stateDir,true);native.leasePrivate(descriptor.control.stateDir+'.initialized',false);native.leasePrivate(path.join(descriptor.control.stateDir,'state.json'),false);
   const config=parseStrictJson(native.imageRead(descriptor.control.configFile).toString(),8192);keys(config,'binding,stateDir,secret');
   const binding={installationId:a.installationId,containerId:a.containers.livekit,digest:a.images.livekit.imageId,version:PRIVATE_CONTROL_VERSION};
   if(!isDeepStrictEqual(config.binding,binding)||config.stateDir!=='/run/castlink-idleseal/state'||typeof config.secret!=='string'||Buffer.byteLength(config.secret)<32||Buffer.byteLength(config.secret)>4096)fail();
   const raw=parseStrictJson(query(['inspect',a.containers.livekit],1048576),1048576) as any;
   if(!Array.isArray(raw)||raw.length!==1)fail();const c=raw[0];
   if(c.Id!==a.containers.livekit||c.Image!==a.images.livekit.imageId||c.State.Running!==running||![''+process.getuid!(),process.getuid!()+':'+process.getgid!()].includes(c.Config.User)||!isDeepStrictEqual(c.Config.Entrypoint,['/usr/local/bin/livekit-server-private'])||!Array.isArray(c.Config.Env)||c.Config.Env.filter((s:string)=>s.startsWith('CASTLINK_IDLE_SEAL_CONFIG=')).join(',')!=='CASTLINK_IDLE_SEAL_CONFIG=/run/castlink-idleseal/config.json')fail();
   for(const [source,destination,rw] of [[descriptor.control.configFile,'/run/castlink-idleseal/config.json',false],[path.dirname(descriptor.control.configFile),'/run/castlink-idleseal',true]])if(c.Mounts.filter((m:any)=>m.Type==='bind'&&m.Source===source&&m.Destination===destination&&m.RW===rw).length!==1)fail();
   if(running&&(query(['exec',a.containers.livekit,'/usr/local/bin/livekit-server-private','--version']).trim()!=='livekit-server version '+PRIVATE_CONTROL_VERSION||query(['exec',a.containers.livekit,'/usr/bin/sha256sum','/usr/local/bin/livekit-server-private']).trim()!==a.controlBinarySHA256+'  /usr/local/bin/livekit-server-private'))fail();
  };
  const verifiedCompletionLocal=()=>{
   const r=completion.validate(structuredClone(descriptor.completion));
   if(!r.complete||r.attempt.path!==path.join(path.dirname(r.ownerFile),'setup-completion.json')||r.installationId!==a.installationId||r.root!==a.root||r.webContainerId!==a.containers.web||r.caddyContainerId!==a.containers.caddy||r.webImageId!==a.images.web.imageId||r.caddyImageId!==a.images.caddy.imageId)fail();
   for(const [name,digest] of Object.entries(a.config))if(r.files[name]?.sha256!==digest)fail();
   completion.local(r);return r;
  };
  let retainedRun:ReturnType<typeof readDesiredState>|undefined;
  const verifyRuntimeAuthority=async()=>{
   // Runtime startup is not browser access. A stopped web cannot be queried:
   // exact retained START is permitted CLOSED, then SQL must verify before any
   // admission observation/mutation or successful terminal release.
   await assertOwned();const r=verifiedCompletionLocal();
   if(!retainedRun||!isDeepStrictEqual(readDesiredState(a.scope,a.installationId,guard),retainedRun)||retainedRun.evidenceSHA256!==sha(JSON.stringify(r)))fail();
   const input={schemaVersion:1,installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName};
   const p=command(['exec','-i',a.containers.web,'node','/app/scripts/runtime-startup-observe-v1.mjs'],JSON.stringify(input),2048);
   if(p.code!==0||p.err||!isDeepStrictEqual(parseStrictJson(p.out,2048),{...input,contract:'castlink-runtime-authority-v1',sql:'verified',setup:'complete',authority:'verified'}))fail();
   await assertOwned();if(!native.serviceReady(inventory())||!isDeepStrictEqual(readDesiredState(a.scope,a.installationId,guard),retainedRun))fail();verifiedCompletionLocal();
  };
  let stoppedTerminal=false,observed:{nonce:string;sealed:boolean}|undefined;
  const privateControl=async(input:ControlRequest):Promise<ControlResponse>=>{
    await assertOwned();inventory();assertControl();
    if(request.action==='reconcile'&&retainedRun)await verifyRuntimeAuthority();
    if(!isDeepStrictEqual(input.binding,{installationId:a.installationId,containerId:a.containers.livekit,digest:a.images.livekit.imageId,version:PRIVATE_CONTROL_VERSION}))fail();
    const p=command(['exec','-i',a.containers.livekit,'/usr/local/bin/livekit-server-private','castlink-idle-control'],JSON.stringify(input),8192);
    if(input.operation==='seal'&&p.code===1&&p.out===''&&/^BUSY\n?$/.test(p.err))return{result:'BUSY'};
    if(p.code!==0||p.err)fail();const result=parseStrictJson(p.out,8192);
    if(input.operation==='status'){keys(result,'result,processNonce,snapshot');keys(result.snapshot,'Pending,Live,Unknown,Sealed,processNonce');if(result.result!=='OK'||typeof result.processNonce!=='string'||!/^[a-f0-9]{64}$/.test(result.processNonce)||result.snapshot.processNonce!==result.processNonce||typeof result.snapshot.Sealed!=='boolean'||['Pending','Live','Unknown'].some(k=>!Number.isSafeInteger(result.snapshot[k])||result.snapshot[k]<0))fail();observed={nonce:result.processNonce,sealed:result.snapshot.Sealed}}
    return result as ControlResponse;
  };
  return body({
   assertOwned,
   inspectAssociation:async()=>{await assertOwned();inventory();if(!isDeepStrictEqual(native.leaseEngine(),{engine:a.engine,endpoint:a.endpoint}))fail();return{association:structuredClone(a),epoch:native.targetOperationEpoch(a.scope)}},
   readDesired:async()=>{const desired=readDesiredState(a.scope,a.installationId,guard);if(desired?.desired==='RUN'&&desired.evidenceSHA256!==sha(JSON.stringify(verifiedCompletionLocal())))fail();if(request.action==='reconcile'&&desired?.desired==='RUN')retainedRun=structuredClone(desired);return desired},
   verifyNormalSetupCompletion:async()=>{
    await assertOwned();const r=verifiedCompletionLocal();if(completion.server(r).setup!=='complete')fail();
    const observation=await completion.observe(r);if(observation.setup!=='complete'||observation.sql!=='verified'||observation.ownerAccess!=='invite'&&observation.ownerAccess!=='session')fail();await assertOwned();inventory();return sha(JSON.stringify(r));
   },
   observeServiceState:async()=>{const owned=inventory();return native.serviceReady(owned)?'running':owned.containers.every((c:any)=>c.Running===false)?'stopped':'unknown'},
   startOwnedContainers:async ids=>{await assertOwned();if(!isDeepStrictEqual(ids,['postgres','web','livekit','caddy'].map(n=>a.containers[n as keyof typeof a.containers])))fail();assertControl(false);const p=command(['start',...ids]);if(p.code!==0)fail();inventory()},
   writeDesired:async(previous,next)=>{await assertOwned();writeDesiredState(a.scope,a.installationId,previous,next,guard)},
   control:privateControl,
   stopOwnedContainers:async ids=>{
    await assertOwned();if(!isDeepStrictEqual(ids,['postgres','web','livekit','caddy'].map(n=>a.containers[n as keyof typeof a.containers])))fail();
    const p=command(['stop',...ids]);if(p.code!==0)fail();const owned=inventory();if(!owned.containers.every((c:any)=>c.Running===false))fail();stoppedTerminal=true;
   },
   verifyTerminalStop:async()=>{await assertOwned();return inventory().containers.every((c:any)=>c.Running===false)&&(stoppedTerminal||request.action==='reconcile')},
   releaseTerminal:async()=>{
    await assertOwned();const owned=inventory(),witness=observed;
    if(stoppedTerminal||!witness){if(!owned.containers.every((c:any)=>c.Running===false))fail()}else{if(!native.serviceReady(owned))fail();await privateControl({operation:'status',binding:{installationId:a.installationId,containerId:a.containers.livekit,digest:a.images.livekit.imageId,version:PRIVATE_CONTROL_VERSION}});if(!isDeepStrictEqual(observed,witness))fail()}
    native.dispatchTargetOperation(lease);native.releaseTargetOperation(lease,true)
   },
   retainUnknown:async()=>{ /* Persistent current lease is deliberately untouched. */ },
  });
 }});
}
