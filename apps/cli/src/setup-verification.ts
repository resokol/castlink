import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
import {nodeObserver,pythonObserver,nodeAssociationCapture,pythonAssociationCapture} from './setup-verification-target.js';

export type FileAssociation={dev:number;ino:number;mode:number;sha256:string};
export type SetupVerificationRequest={schemaVersion:1;installationId:string;nodeId:string;origin:string;serverName:string;release:string;root:string;files:Record<string,FileAssociation>;ownerFile:string;ownerAssociation:FileAssociation;webContainerId:string;caddyContainerId:string;webImageId:string;caddyImageId:string;complete:boolean;attempt:({path:string}&FileAssociation)|null};
export type SetupObservation={schemaVersion:1;contract:'castlink-setup-target-v1';installationId:string;nodeId:string;origin:string;serverName:string;release:string;productVersion:string;tls:'verified';version:'verified';sql:'verified';ownerAccess:'invite'|'session';setup:'pending'|'complete'};
export class SetupVerificationError extends CliError {}
export type SetupAssociationRequest={schemaVersion:1;installationId:string;nodeId:string;origin:string;root:string;fileHashes:Record<string,string>;ownerFile:string;ownerSHA:string|null};
// These fingerprints are private orchestration metadata, never CLI output.
export type SetupAssociations={schemaVersion:1;contract:'castlink-setup-associations-v1';installationId:string;nodeId:string;origin:string;root:string;ownerFile:string;files:Record<string,FileAssociation>;ownerAssociation:FileAssociation};
export async function captureSetupAssociations(request:SetupAssociationRequest,executor:Executor,remote:boolean):Promise<SetupAssociations>{
 try{
  const r=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonAssociationCapture]:['-e',nodeAssociationCapture],input:Buffer.from(JSON.stringify(request)),sensitive:true}),o=parseStrictJson(r.stdout,8192) as SetupAssociations;
  const valid=(a:FileAssociation)=>a&&Number.isSafeInteger(a.dev)&&a.dev>=0&&Number.isSafeInteger(a.ino)&&a.ino>=0&&a.mode===0o600&&typeof a.sha256==='string'&&/^[a-f0-9]{64}$/.test(a.sha256)&&isDeepStrictEqual(a,{dev:a.dev,ino:a.ino,mode:0o600,sha256:a.sha256});
  const names=['compose.yaml','livekit.yaml','postgres.env','web.env'];
  if(r.code!==0||r.stderr!==''||!o?.files||!isDeepStrictEqual(Object.keys(o.files).sort(),names)||!isDeepStrictEqual(Object.keys(request.fileHashes).sort(),names)||names.some(name=>!valid(o.files[name]!)||o.files[name]!.sha256!==request.fileHashes[name])||!valid(o.ownerAssociation)||request.ownerSHA!==null&&request.ownerSHA!==o.ownerAssociation.sha256||!isDeepStrictEqual(o,{schemaVersion:1,contract:'castlink-setup-associations-v1',installationId:request.installationId,nodeId:request.nodeId,origin:request.origin,root:request.root,ownerFile:request.ownerFile,files:o.files,ownerAssociation:o.ownerAssociation}))throw Error();
  return o;
 }catch{throw new SetupVerificationError('Protected bundle hashes, owner file or private filesystem associations refused capture; retain the existing files and diagnose drift before recording completion.',3);}
}
// The caller must retain and verify resource/bundle metadata and durably record
// the completion attempt before opting into a POST. No readiness/journal writes.
export async function observeSetupTarget(request:SetupVerificationRequest,executor:Executor,remote:boolean):Promise<SetupObservation>{
 try{
  const result=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonObserver]:['-e',nodeObserver],input:Buffer.from(JSON.stringify(request)),sensitive:true});
  const o=parseStrictJson(result.stdout,2048) as SetupObservation;
  if(result.code!==0||result.stderr!==''||!o||!/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(o.productVersion)||!['invite','session'].includes(o.ownerAccess)||!['pending','complete'].includes(o.setup)||request.complete&&o.setup!=='complete'||!isDeepStrictEqual(o,{schemaVersion:1,contract:'castlink-setup-target-v1',installationId:request.installationId,nodeId:request.nodeId,origin:request.origin,serverName:request.serverName,release:request.release,productVersion:o.productVersion,tls:'verified',version:'verified',sql:'verified',ownerAccess:o.ownerAccess,setup:o.setup}))throw Error();
  return o;
 }catch{throw new SetupVerificationError('Protected HTTPS, release, SQL, owner access or setup association refused observation. Retain the completion attempt and diagnose actual state before retry; installation readiness remains pending.',3);}
}
