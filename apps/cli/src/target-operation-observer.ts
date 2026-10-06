import {nodeTargetLeaseObservation,pythonTargetLeaseObservation} from './target-operation.js';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
export class TargetOperationObservationError extends CliError {}
export const nativeWindowsLeaseDiagnosis='Native private target operation locking is unavailable on this Windows runtime; no target mutation ran. A verified native Windows lease implementation is required.';
export const blockedTargetGenerationDiagnosis='Target operation generation is unverified or blocked; retain private state and diagnose before retry.';
export type TargetGeneration={schemaVersion:1;engine:string;endpoint:string;epoch:number;active:false;principal:number;scope:string};
// Read-only stage admission hint. Every fixed target effect validates this
// generation again after acquisition; callers advance only their own success.
export async function observeTargetGeneration(executor:Executor,remote:boolean):Promise<TargetGeneration>{
 try{const result=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonTargetLeaseObservation]:['-e',nodeTargetLeaseObservation],sensitive:true});if(result.code!==0||result.stderr)throw Error();const v=parseStrictJson(result.stdout,1024) as TargetGeneration;if(Object.keys(v).sort().join(',')!=='active,endpoint,engine,epoch,principal,schemaVersion,scope'||v.schemaVersion!==1||v.active!==false||!Number.isSafeInteger(v.epoch)||v.epoch<0||typeof v.engine!=='string'||typeof v.endpoint!=='string'||!Number.isSafeInteger(v.principal)||v.principal<0||typeof v.scope!=='string'||!v.scope.startsWith('/')||!v.scope.endsWith('/.castlink-target-operations')||v.scope.split('/').includes('..')||/[\x00-\x1f\x7f]/.test(v.scope))throw Error();return v;}catch{throw new TargetOperationObservationError(!remote&&process.platform==='win32'?nativeWindowsLeaseDiagnosis:blockedTargetGenerationDiagnosis,4);}
}
