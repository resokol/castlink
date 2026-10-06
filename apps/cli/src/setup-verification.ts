import {fixedNodeArguments} from './fixed-node-program.js';
import path from 'node:path';
import {createHash} from 'node:crypto';
import type {TargetSqlGuard} from './target-sql-guard.js';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
import {nodeObserver,pythonObserver,nodeAssociationCapture,pythonAssociationCapture,nodeCompletionTarget,pythonCompletionTarget} from './setup-verification-target.js';

const semanticVersion=/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/;
export type FileAssociation={dev:number;ino:number;mode:number;sha256:string};
export type SetupVerificationRequest={schemaVersion:1;installationId:string;nodeId:string;origin:string;serverName:string;release:string;root:string;files:Record<string,FileAssociation>;ownerFile:string;ownerAssociation:FileAssociation;webContainerId:string;caddyContainerId:string;webImageId:string;caddyImageId:string;complete:boolean;attempt:({path:string}&FileAssociation)|null};
export type SetupObservation={schemaVersion:1;contract:'castlink-setup-target-v1';installationId:string;nodeId:string;origin:string;serverName:string;release:string;productVersion:string;tls:'verified';version:'verified';sql:'verified';ownerAccess:'invite'|'session';setup:'pending'|'complete'};
export class SetupVerificationError extends CliError {}
export type SetupAssociationRequest={schemaVersion:1;installationId:string;nodeId:string;origin:string;root:string;fileHashes:Record<string,string>;ownerFile:string;ownerSHA:string|null};
// These fingerprints are private orchestration metadata, never CLI output.
export type SetupAssociations={schemaVersion:1;contract:'castlink-setup-associations-v1';installationId:string;nodeId:string;origin:string;root:string;ownerFile:string;files:Record<string,FileAssociation>;ownerAssociation:FileAssociation};
export async function captureSetupAssociations(request:SetupAssociationRequest,executor:Executor,remote:boolean):Promise<SetupAssociations>{
 try{
  const r=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonAssociationCapture]:fixedNodeArguments(nodeAssociationCapture),input:Buffer.from(JSON.stringify(request)),sensitive:true}),o=parseStrictJson(r.stdout,8192) as SetupAssociations;
  const valid=(a:FileAssociation)=>a&&Number.isSafeInteger(a.dev)&&a.dev>=0&&Number.isSafeInteger(a.ino)&&a.ino>=0&&a.mode===0o600&&typeof a.sha256==='string'&&/^[a-f0-9]{64}$/.test(a.sha256)&&isDeepStrictEqual(a,{dev:a.dev,ino:a.ino,mode:0o600,sha256:a.sha256});
  const names=['compose.yaml','livekit.yaml','postgres.env','web.env'];
  if(r.code!==0||r.stderr!==''||!o?.files||!isDeepStrictEqual(Object.keys(o.files).sort(),names)||!isDeepStrictEqual(Object.keys(request.fileHashes).sort(),names)||names.some(name=>!valid(o.files[name]!)||o.files[name]!.sha256!==request.fileHashes[name])||!valid(o.ownerAssociation)||request.ownerSHA!==null&&request.ownerSHA!==o.ownerAssociation.sha256||!isDeepStrictEqual(o,{schemaVersion:1,contract:'castlink-setup-associations-v1',installationId:request.installationId,nodeId:request.nodeId,origin:request.origin,root:request.root,ownerFile:request.ownerFile,files:o.files,ownerAssociation:o.ownerAssociation}))throw Error();
  return o;
 }catch{throw new SetupVerificationError('Protected bundle hashes, owner file or private filesystem associations refused capture; retain the existing files and diagnose drift before recording completion.',3);}
}
// The caller must retain and verify resource/bundle metadata and durably record
// the completion attempt before opting into a POST. No readiness/journal writes.
export async function observeSetupTarget(request:SetupVerificationRequest,executor:Executor,remote:boolean):Promise<SetupObservation>{
 if(request.complete||request.attempt!==null)throw new SetupVerificationError('Setup observation is read-only; completion requires the fixed shared target batch.',3);
 try{
  const result=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonObserver]:fixedNodeArguments(nodeObserver),input:Buffer.from(JSON.stringify(request)),sensitive:true});
  const o=parseStrictJson(result.stdout,2048) as SetupObservation;
  if(result.code!==0||result.stderr!==''||!o||!semanticVersion.test(o.productVersion)||!['invite','session'].includes(o.ownerAccess)||!['pending','complete'].includes(o.setup)||request.complete&&o.setup!=='complete'||!isDeepStrictEqual(o,{schemaVersion:1,contract:'castlink-setup-target-v1',installationId:request.installationId,nodeId:request.nodeId,origin:request.origin,serverName:request.serverName,release:request.release,productVersion:o.productVersion,tls:'verified',version:'verified',sql:'verified',ownerAccess:o.ownerAccess,setup:o.setup}))throw Error();
  return o;
 }catch{throw new SetupVerificationError('Protected HTTPS, release, SQL, owner access or setup association refused observation. Retain the completion attempt and diagnose actual state before retry; installation readiness remains pending.',3);}
}

export async function completeSetupTarget(request:SetupVerificationRequest,targetGuard:TargetSqlGuard,attemptPath:string,allowCreate:boolean,executor:Executor,remote:boolean):Promise<{observation:SetupObservation;attempt:{path:string}&FileAssociation}>{
 const r=structuredClone(request),g=structuredClone(targetGuard);
 try{
  if(r.complete||r.attempt!==null||g.operation.kind!=='completion'||g.operation.root!==r.root||g.operation.installationId!==r.installationId||g.containerId!==r.webContainerId||g.containerImage!==r.webImageId||attemptPath!==(remote?path.posix:path).join((remote?path.posix:path).dirname(r.ownerFile),'setup-completion.json')||typeof allowCreate!=='boolean')throw Error();
  const result=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonCompletionTarget]:fixedNodeArguments(nodeCompletionTarget),input:Buffer.from(JSON.stringify({request:r,targetGuard:g,attemptPath,allowCreate})),sensitive:true});
  const value=parseStrictJson(result.stdout,8192) as {schemaVersion:number;contract:string;observation:SetupObservation;attempt:{path:string}&FileAssociation},o=value.observation,a=value.attempt;
  const intent={schemaVersion:1,installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,release:r.release,webContainerId:r.webContainerId,caddyContainerId:r.caddyContainerId,files:r.files,ownerAssociation:r.ownerAssociation};
  if(result.code!==0||result.stderr!==''||!o||!a||value.schemaVersion!==1||value.contract!=='castlink-setup-completion-v1'||!isDeepStrictEqual(Object.keys(value).sort(),['attempt','contract','observation','schemaVersion'])||!Number.isSafeInteger(a.dev)||a.dev<0||!Number.isSafeInteger(a.ino)||a.ino<0||!isDeepStrictEqual(a,{path:attemptPath,dev:a.dev,ino:a.ino,mode:0o600,sha256:createHash('sha256').update(JSON.stringify(intent,null,2)+'\n').digest('hex')})||!['invite','session'].includes(o.ownerAccess)||!semanticVersion.test(o.productVersion)||!isDeepStrictEqual(o,{schemaVersion:1,contract:'castlink-setup-target-v1',installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,release:r.release,productVersion:o.productVersion,tls:'verified',version:'verified',sql:'verified',ownerAccess:o.ownerAccess,setup:'complete'}))throw Error();
  return{observation:o,attempt:a};
 }catch{throw new SetupVerificationError('Shared target completion batch is unverified or blocked; retain the private cursor and attempt, and inspect actual SQL/setup state read-only before retry.',4);}
}
