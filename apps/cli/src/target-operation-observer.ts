import {fixedNodeArguments} from './fixed-node-program.js';
import {nodeTargetLeaseObservation,pythonTargetLeaseObservation} from './target-operation.js';
import path from 'node:path';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
export class TargetOperationObservationError extends CliError {}
export const nativeWindowsLeaseDiagnosis='Native private target operation locking is unavailable on this Windows runtime; no target mutation ran. A verified native Windows lease implementation is required.';
export const blockedTargetGenerationDiagnosis='Target operation generation is unverified or blocked; retain private state and diagnose before retry.';
export type TargetPrincipal=number|{kind:'windows-sid';sid:string};
export type TargetGeneration={schemaVersion:1;engine:string;endpoint:string;epoch:number;active:false;principal:TargetPrincipal;scope:string};
// Read-only stage admission hint. Every fixed target effect validates this
// generation again after acquisition; callers advance only their own success.
export async function observeTargetGeneration(executor:Executor,remote:boolean):Promise<TargetGeneration>{
 try{const result=!remote&&process.platform==='win32'?await(await import('./windows-database-worker.js')).runWindowsGenerationTarget():await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonTargetLeaseObservation]:fixedNodeArguments(nodeTargetLeaseObservation),sensitive:true});if(result.code!==0||result.stderr)throw Error();const v=parseStrictJson(result.stdout,1024) as TargetGeneration;if(Object.keys(v).sort().join(',')!=='active,endpoint,engine,epoch,principal,schemaVersion,scope'||v.schemaVersion!==1||v.active!==false||!Number.isSafeInteger(v.epoch)||v.epoch<0||typeof v.engine!=='string'||typeof v.endpoint!=='string'||!validTargetPrincipal(v.principal,v.scope,v.endpoint,remote))throw Error();return v;}catch{throw new TargetOperationObservationError(!remote&&process.platform==='win32'?nativeWindowsLeaseDiagnosis:blockedTargetGenerationDiagnosis,4);}
}

export function validTargetPrincipal(principal:unknown,scope:unknown,endpoint:unknown,remote:boolean):boolean{
 if(typeof scope!=='string'||typeof endpoint!=='string'||/[\x00-\x1f\x7f]/.test(scope))return false;
 if(!remote&&process.platform==='win32'){const p=principal as {kind?:unknown;sid?:unknown};return !!p&&Object.keys(p).sort().join(',')==='kind,sid'&&p.kind==='windows-sid'&&typeof p.sid==='string'&&/^S-1-\d+(?:-\d+){1,15}$/.test(p.sid)&&/^[A-Z]:\\/.test(scope)&&path.win32.normalize(scope)===scope&&path.win32.basename(scope)==='.castlink-target-operations'&&/^npipe:\/\/\/\/\.\/pipe\/[A-Za-z0-9_.-]+$/.test(endpoint)}
 return typeof principal==='number'&&Number.isSafeInteger(principal)&&principal>=0&&scope.startsWith('/')&&path.posix.normalize(scope)===scope&&scope.endsWith('/.castlink-target-operations')&&/^unix:\/\/\/[^/]/.test(endpoint);
}
