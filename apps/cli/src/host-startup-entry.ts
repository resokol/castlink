import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {randomBytes} from 'node:crypto';
import {createRequire} from 'node:module';
import {nodeTargetLease} from './target-operation.js';
import {createNativeHostControllerRunner,loadHostControllerDescriptor} from './host-startup-target.js';
import {controllerAssociationDigest,type ControllerAction,type ControllerEvidence} from './lifecycle-controller.js';
const require=createRequire(import.meta.url);
const observe=new Function('require',nodeTargetLease+'return {targetOperationEpoch,leaseEngine,leasePrivate};')(require) as {targetOperationEpoch:(s:string)=>number;leaseEngine:()=>{engine:string;endpoint:string};leasePrivate:(s:string,d:boolean)=>unknown};
// Protected provision API: no caller boolean/completion receipt or fresh journal
// authorizes RUN. The fixed target runner verifies actual normal completion.
export async function provisionHostControllerRun(file:string):Promise<ControllerEvidence>{return invoke('record-run',file)}
export async function invoke(action:ControllerAction,file:string):Promise<ControllerEvidence>{
 const descriptor=loadHostControllerDescriptor(file),a=descriptor.association;
 // Freeze generation before resource/SQL/control observations. Acquire verifies
 // it again; no retry/new generation after an uncertain response.
 observe.leasePrivate(a.scope,true);const epoch=observe.targetOperationEpoch(a.scope);
 const selected=observe.leaseEngine();if(selected.engine!==a.engine||selected.endpoint!==a.endpoint)throw Error('host-controller-unverified');
 return createNativeHostControllerRunner(file).run({schemaVersion:1,action,association:a,expectedEpoch:epoch,operationNonce:randomBytes(32).toString('hex')});
}
export async function hostStartupEntry(argv:string[]):Promise<number>{
 try{
  if(argv.length!==2||argv[0]!=='--profile-file'||!argv[1]||!path.isAbsolute(argv[1]))throw Error();
  const r=await invoke('reconcile',argv[1]);
  // No private paths/CIDs/digests/nonces or diagnostic bytes cross stdout.
  const accepted=r.schemaVersion===1&&r.associationDigest===controllerAssociationDigest(loadHostControllerDescriptor(argv[1]).association)&&r.outcome!=='unknown'&&r.lease==='released';
  process.stdout.write(JSON.stringify({schemaVersion:1,outcome:accepted?r.outcome:'unknown',admission:accepted?r.admission:'unknown',releaseBlocked:true,registration:'unverified'})+'\n');return accepted?0:4;
 }catch{process.stdout.write('{"schemaVersion":1,"outcome":"unknown","admission":"unknown","releaseBlocked":true,"registration":"unverified"}\n');return 4}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)hostStartupEntry(process.argv.slice(2)).then(code=>{process.exitCode=code});
