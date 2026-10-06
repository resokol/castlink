import {randomBytes,createHash} from 'node:crypto';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';

export const PRIVATE_CONTROL_VERSION='1.13.7+castlink-idleseal-private.2';
const names=['postgres','web','livekit','caddy'] as const;
const hex=/^[a-f0-9]{64}$/;
export type ControllerAction='reconcile'|'stop'|'record-run';
export type ControllerAssociation={schemaVersion:1;installationId:string;platform:'windows'|'macos'|'ubuntu';architecture:'amd64'|'arm64';principal:string;scope:string;root:string;engine:string;endpoint:string;config:Record<string,string>;images:Record<typeof names[number],{imageId:string;reference:string}>;containers:Record<typeof names[number],string>;volumes:{name:string;createdAt:string}[];network:{name:string;id:string};controlVersion:string;controlBinarySHA256:string};
export type DesiredRecord={schemaVersion:1;associationDigest:string;desired:'RUN'|'STOP';revision:number;source:'verified-setup'|'sealed-stop';operationNonce:string;evidenceSHA256:string};
export type ControlBinding={installationId:string;containerId:string;digest:string;version:string};
export type ControlRequest={operation:'status';binding:ControlBinding}|{operation:'seal'|'unseal';binding:ControlBinding;epoch:string;processNonce:string};
export type ControlStatus={result:'OK';processNonce:string;snapshot:{Pending:number;Live:number;Unknown:number;Sealed:boolean;processNonce:string}};
export type ControlProof={binding:ControlBinding;epoch:string;processNonce:string};
export type ControlResponse=ControlStatus|{result:'OK';proof:ControlProof}|{result:'OK'}|{result:'BUSY'};
export type ControllerRequest={schemaVersion:1;action:ControllerAction;association:ControllerAssociation;expectedEpoch:number;operationNonce:string};
type Outcome='open'|'closed'|'stopped'|'busy'|'unknown';
export type ControllerEvidence={schemaVersion:1;action:ControllerAction;operationNonce:string;epoch:number;associationDigest:string;outcome:Outcome;admission:'open'|'closed'|'unknown';lease:'released'|'retained'|'unknown'};
export type ControllerResult={outcome:Outcome;admission:'open'|'closed'|'unknown';assurance:'protocol-model-only';releaseBlocked:true};
export interface FixedLifecycleRunner {run(request:ControllerRequest):Promise<ControllerEvidence>}
// Integration contract, not an implemented native lease or control transport.
// One fixed target handler must acquire the established shared lease before
// invoking body, verify actual UID/SID/scope/root/config/images/resources, and
// never release in finally. Every method below runs under that SAME owner.
export interface HeldControllerTarget {
 assertOwned():Promise<void>;
 inspectAssociation():Promise<{association:ControllerAssociation;epoch:number}>;
 readDesired():Promise<DesiredRecord|null>;
 verifyNormalSetupCompletion():Promise<string>;
 observeServiceState():Promise<'running'|'stopped'|'unknown'>;
 startOwnedContainers(ids:string[]):Promise<void>;
 writeDesired(previous:DesiredRecord|null,next:DesiredRecord):Promise<void>;
 // Adapter must use the verified private binary (stdin, no extra argv) through
 // exact-container exec. No public HTTP, Web socket or sampled-count shortcut.
 control(request:ControlRequest):Promise<ControlResponse>;
 stopOwnedContainers(ids:string[]):Promise<void>;
 // Authoritative same-ID terminal POST, not PID/age/two snapshots or code 0.
 verifyTerminalStop():Promise<boolean>;
 releaseTerminal():Promise<void>;
 retainUnknown():Promise<void>;
}
export interface FixedControllerTarget {withLease(request:ControllerRequest,body:(held:HeldControllerTarget)=>Promise<ControllerEvidence>):Promise<ControllerEvidence>}
function reject():never {throw Error('controller-unverified')}
function fields(v:unknown,keys:string[]):asserts v is Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==keys.sort().join(','))reject()}
function safe(v:unknown):v is string{return typeof v==='string'&&v.length>0&&v.length<=4096&&!/[\x00-\x1f\x7f]/.test(v)}
function canonical(v:unknown):unknown{if(Array.isArray(v))return v.map(canonical);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,x])=>[k,canonical(x)]));return v}
export function validateControllerAssociation(value:ControllerAssociation):ControllerAssociation{
 const a=structuredClone(value);fields(a,['schemaVersion','installationId','platform','architecture','principal','scope','root','engine','endpoint','config','images','containers','volumes','network','controlVersion','controlBinarySHA256']);
 if(a.schemaVersion!==1||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(a.installationId)||!['windows','macos','ubuntu'].includes(a.platform)||!['amd64','arm64'].includes(a.architecture)||!safe(a.principal)||!safe(a.engine)||!safe(a.endpoint)||a.controlVersion!==PRIVATE_CONTROL_VERSION||!hex.test(a.controlBinarySHA256))reject();
 const p=a.platform==='windows'?path.win32:path.posix;
 for(const root of [a.root,a.scope])if(!safe(root)||!p.isAbsolute(root)||p.normalize(root)!==root||root===p.parse(root).root||a.platform==='windows'&&!/^D:\\/i.test(root))reject();
 if(a.platform==='windows'?!/^sid:S-1-[0-9-]+$/.test(a.principal):!/^uid:[0-9]+$/.test(a.principal))reject();
 fields(a.config,['compose.yaml','web.env','postgres.env','livekit.yaml']);if(Object.values(a.config).some(v=>typeof v!=='string'||!hex.test(v)))reject();
 fields(a.images,[...names]);fields(a.containers,[...names]);
 for(const name of names){const image=a.images[name];fields(image,['imageId','reference']);if(!/^sha256:[a-f0-9]{64}$/.test(image.imageId)||!safe(image.reference)||!/^\S+@sha256:[a-f0-9]{64}$/.test(image.reference)||!hex.test(a.containers[name]))reject()}
 if(new Set(Object.values(a.containers)).size!==4)reject();
 const project='castlink-'+a.installationId.replaceAll('-',''),expectedVolumes=['postgres-data','web-data','caddy-data','caddy-config'].map(n=>project+'_'+n);
 if(!Array.isArray(a.volumes)||a.volumes.length!==4)reject();for(const volume of a.volumes){fields(volume,['name','createdAt']);if(!expectedVolumes.includes(volume.name)||!safe(volume.createdAt)||!/^\d{4}-\d\d-\d\dT/.test(volume.createdAt))reject()}
 if(new Set(a.volumes.map(v=>v.name)).size!==4)reject();a.volumes.sort((x,y)=>x.name.localeCompare(y.name));
 fields(a.network,['name','id']);if(a.network.name!==project+'_castlink'||!hex.test(a.network.id))reject();return a;
}
export function controllerAssociationDigest(a:ControllerAssociation):string{return createHash('sha256').update(JSON.stringify(canonical(validateControllerAssociation(a)))).digest('hex')}
export function validateDesiredRecord(v:DesiredRecord):DesiredRecord{const r=structuredClone(v);fields(r,['schemaVersion','associationDigest','desired','revision','source','operationNonce','evidenceSHA256']);if(r.schemaVersion!==1||!hex.test(r.associationDigest)||!['RUN','STOP'].includes(r.desired)||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>=Number.MAX_SAFE_INTEGER||r.source!==(r.desired==='RUN'?'verified-setup':'sealed-stop')||!hex.test(r.operationNonce)||!hex.test(r.evidenceSHA256))reject();return r}
function status(v:unknown):ControlStatus{fields(v,['result','processNonce','snapshot']);if(v.result!=='OK'||typeof v.processNonce!=='string'||!hex.test(v.processNonce))reject();fields(v.snapshot,['Pending','Live','Unknown','Sealed','processNonce']);const snapshot=v.snapshot;if(snapshot.processNonce!==v.processNonce||typeof snapshot.Sealed!=='boolean'||['Pending','Live','Unknown'].some(k=>!Number.isSafeInteger(snapshot[k])||(snapshot[k] as number)<0))reject();return v as unknown as ControlStatus}
function proof(v:unknown,binding:ControlBinding,epoch:string,processNonce:string):ControlProof{fields(v,['result','proof']);if(v.result!=='OK')reject();fields(v.proof,['binding','epoch','processNonce']);if(!isDeepStrictEqual(v.proof.binding,binding)||v.proof.epoch!==epoch||v.proof.processNonce!==processNonce)reject();return v.proof as unknown as ControlProof}
function unknown():ControllerResult{return{outcome:'unknown',admission:'unknown',assurance:'protocol-model-only',releaseBlocked:true}}
export async function runHostStartupController(action:ControllerAction,association:ControllerAssociation,expectedEpoch:number,runner?:FixedLifecycleRunner):Promise<ControllerResult>{
 try{const a=validateControllerAssociation(association);if(!runner||!['reconcile','stop','record-run'].includes(action)||!Number.isSafeInteger(expectedEpoch)||expectedEpoch<0)reject();const request:ControllerRequest={schemaVersion:1,action,association:a,expectedEpoch,operationNonce:randomBytes(32).toString('hex')},reply=await runner.run(structuredClone(request));fields(reply,['schemaVersion','action','operationNonce','epoch','associationDigest','outcome','admission','lease']);if(reply.schemaVersion!==1||reply.action!==action||reply.operationNonce!==request.operationNonce||reply.epoch!==expectedEpoch||reply.associationDigest!==controllerAssociationDigest(a)||!['open','closed','stopped','busy','unknown'].includes(reply.outcome)||!['open','closed','unknown'].includes(reply.admission)||!['released','retained','unknown'].includes(reply.lease)||reply.outcome!=='unknown'&&reply.lease!=='released'||reply.outcome==='open'&&reply.admission!=='open'||['closed','stopped'].includes(reply.outcome)&&reply.admission!=='closed')reject();return{outcome:reply.outcome,admission:reply.admission,assurance:'protocol-model-only',releaseBlocked:true};}catch{return unknown()}
}
// Executable transition model using an injected fixed target runner. No native
// registration, lease implementation, backend authentication or Docker effects
// are supplied here; model evidence never establishes platform readiness.
export function createLifecycleControllerRunner(target:FixedControllerTarget):FixedLifecycleRunner{return{run:async incoming=>{
 const request=structuredClone(incoming),a=validateControllerAssociation(request.association),digest=controllerAssociationDigest(a);
 const evidence=(outcome:Outcome,admission:ControllerEvidence['admission'],lease:ControllerEvidence['lease']):ControllerEvidence=>({schemaVersion:1,action:request.action,operationNonce:request.operationNonce,epoch:request.expectedEpoch,associationDigest:digest,outcome,admission,lease});
 if(request.schemaVersion!==1||!hex.test(request.operationNonce)||!Number.isSafeInteger(request.expectedEpoch)||request.expectedEpoch<0||!['reconcile','stop','record-run'].includes(request.action))return evidence('unknown','unknown','unknown');
 try{return await target.withLease(request,async held=>{
 let releaseStarted=false;
 const assertActual=async()=>{await held.assertOwned();const actual=await held.inspectAssociation();if(actual.epoch!==request.expectedEpoch||!isDeepStrictEqual(validateControllerAssociation(actual.association),a))reject()};
 const binding:ControlBinding={installationId:a.installationId,containerId:a.containers.livekit,digest:a.images.livekit.imageId,version:a.controlVersion};
 // Point-in-time current-process observation, not a promise about future restarts.
 const assertAdmission=async(processNonce:string,sealed:boolean)=>{const actual=status(await held.control({operation:'status',binding}));if(actual.processNonce!==processNonce||actual.snapshot.Sealed!==sealed)reject()};
 const terminal=async(outcome:Outcome,admission:ControllerEvidence['admission'],processNonce?:string)=>{await assertActual();if(outcome!=='stopped'){if(!processNonce)reject();await assertAdmission(processNonce,admission==='closed')}releaseStarted=true;await held.releaseTerminal();return evidence(outcome,admission,'released')};
 try{
  await assertActual();const read=await held.readDesired(),desired=read===null?null:validateDesiredRecord(read);if(desired&&desired.associationDigest!==digest)reject();
  if(request.action==='reconcile'){
   const services=await held.observeServiceState();if(services==='unknown')reject();
   if(services==='stopped'){
    if(desired?.desired!=='RUN'){if(await held.verifyTerminalStop()!==true)reject();return await terminal('stopped','closed')}
    await assertActual();await held.startOwnedContainers(names.map(n=>a.containers[n]));await assertActual();if(await held.observeServiceState()!=='running')reject();
   }
  }
  const before=status(await held.control({operation:'status',binding}));
  if(request.action==='record-run'){
   if(!before.snapshot.Sealed)reject();const completion=await held.verifyNormalSetupCompletion();if(!hex.test(completion))reject();await assertActual();await assertAdmission(before.processNonce,true);await held.writeDesired(desired,{schemaVersion:1,associationDigest:digest,desired:'RUN',revision:(desired?.revision??0)+1,source:'verified-setup',operationNonce:request.operationNonce,evidenceSHA256:completion});return await terminal('closed','closed',before.processNonce);
  }
  if(request.action==='reconcile'&&desired?.desired!=='RUN'){if(!before.snapshot.Sealed)reject();return await terminal('closed','closed',before.processNonce)}
  if(request.action==='reconcile'&&!before.snapshot.Sealed)return await terminal('open','open',before.processNonce);
  // Fresh nonce epoch is never taken from retained RUN, an old proof or a PID.
  const epoch='host-'+request.operationNonce;await assertActual();const sealed=await held.control({operation:'seal',binding,epoch,processNonce:before.processNonce});
  if(sealed.result==='BUSY'){fields(sealed,['result']);const after=status(await held.control({operation:'status',binding}));if(after.processNonce!==before.processNonce||after.snapshot.Sealed!==before.snapshot.Sealed)reject();return await terminal('busy',before.snapshot.Sealed?'closed':'open',before.processNonce)}
  const boundProof=proof(sealed,binding,epoch,before.processNonce);await assertActual();await assertAdmission(before.processNonce,true);
  if(request.action==='stop'){
   const evidenceSHA256=createHash('sha256').update(JSON.stringify(canonical(boundProof))).digest('hex');await held.writeDesired(desired,{schemaVersion:1,associationDigest:digest,desired:'STOP',revision:(desired?.revision??0)+1,source:'sealed-stop',operationNonce:request.operationNonce,evidenceSHA256});await assertActual();await assertAdmission(before.processNonce,true);await held.stopOwnedContainers(names.map(n=>a.containers[n]));if(await held.verifyTerminalStop()!==true)reject();return await terminal('stopped','closed');
  }
  // Activation changes no desired state; it is authorized only by private RUN.
  const reopened=await held.control({operation:'unseal',binding,epoch,processNonce:before.processNonce});fields(reopened,['result']);if(reopened.result!=='OK')reject();const after=status(await held.control({operation:'status',binding}));if(after.processNonce!==before.processNonce||after.snapshot.Sealed)reject();return await terminal('open','open',before.processNonce);
 }catch{if(!releaseStarted)try{await held.retainUnknown()}catch{};return evidence('unknown','unknown',releaseStarted?'unknown':'retained')}
 });}catch{return evidence('unknown','unknown','unknown')}
}}}
