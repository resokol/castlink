import {fixedNodeArguments} from './fixed-node-program.js';
import {nodeSqlGuard,pythonSqlGuard,type TargetSqlGuard} from './target-sql-guard.js';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
import type {ServiceContract} from './services.js';

export class DatabasePhaseError extends CliError {}
export async function observeDatabase(contract:ServiceContract,nodeId:string,phase:'migrations'|'seed',executor:Executor,targetGuard?:TargetSqlGuard,remote=false):Promise<void>{
 if(!targetGuard)throw new DatabasePhaseError('Protected database mutation requires current target root, engine, endpoint and operation epoch association; SQL was not dispatched.',3);
 const image=()=>new DatabasePhaseError('Pinned web image database-v1 contract is missing or unsupported; select a release image containing /app/scripts/setup-database-v1.mjs and its matching migration contract before retry.',3);
 let result;
 try{const input=Buffer.from(JSON.stringify({schemaVersion:1,phase,installationId:contract.installationId,nodeId,targetGuard}));result=!remote&&process.platform==='win32'?await (await import('./windows-database-worker.js')).runWindowsDatabaseTarget(input):await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonDatabaseTarget]:fixedNodeArguments(nodeDatabaseTarget),input,sensitive:true});}catch{throw new DatabasePhaseError('Guarded database response was lost; retry observes SQL under the retained installation and resource identity before advancing.',3);}
 if(!remote&&process.platform==='win32'&&result.code===4)throw new DatabasePhaseError('Protected Windows database provider is unavailable or uncertain; retain the current target lease and private evidence.',4);
 let observed:unknown;try{observed=parseStrictJson(result.stdout,2048);}catch{throw image();}
 if(isDeepStrictEqual(observed,{schemaVersion:1,contract:'castlink-database-v1',ok:false,diagnosis:'database-contract-refused'}))throw new DatabasePhaseError('Database schema, migration content or local seed identity refused verification; diagnose the protected database before retry. Owner and readiness remain pending.',3);
 const expected={schemaVersion:1,contract:'castlink-database-v1',phase,installationId:contract.installationId,nodeId,migrations:{roomVersions:[1,2,3],controlVersions:[1,2,3,4,5],schema:true,hashes:true},seed:phase==='seed'?{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0}:null};
 if(result.code!==0||!isDeepStrictEqual(observed,expected))throw image();
}

export const nodeDatabaseTarget=nodeSqlGuard+String.raw`
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>16384)process.exit(3)});process.stdin.on('end',()=>{try{const r=JSON.parse(input);if(input!==JSON.stringify(r)||Object.keys(r).sort().join(',')!=='installationId,nodeId,phase,schemaVersion,targetGuard'||r.schemaVersion!==1||!['migrations','seed'].includes(r.phase)||r.nodeId!=='srv-'+r.installationId.replaceAll('-','')||r.targetGuard.operation.kind!=='database')leaseFail();const g=r.targetGuard,l=sqlGuard(g,r.installationId,r.nodeId);delete r.targetGuard;dispatchTargetOperation(l);function effect(){const c=leaseChild.spawnSync('docker',['exec','-i',g.containerId,'node','/app/scripts/setup-database-v1.mjs'],{input:JSON.stringify(r),maxBuffer:2048,timeout:120000,shell:false});if(c.error||c.status!==0||c.stderr.length)leaseFail();const o=JSON.parse(c.stdout.toString());const expected={schemaVersion:1,contract:'castlink-database-v1',phase:r.phase,installationId:r.installationId,nodeId:r.nodeId,migrations:{roomVersions:[1,2,3],controlVersions:[1,2,3,4,5],schema:true,hashes:true},seed:r.phase==='seed'?{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0}:null};if(!require('node:util').isDeepStrictEqual(o,expected))leaseFail();return o}const o=effect();sqlGuardCheck(g,l,r.installationId,r.nodeId);if(!require('node:util').isDeepStrictEqual(effect(),o))leaseFail();sqlGuardCheck(g,l,r.installationId,r.nodeId);releaseTargetOperation(l,true);console.log(JSON.stringify(o))}catch{console.log(JSON.stringify({schemaVersion:1,contract:'castlink-database-v1',ok:false,diagnosis:'database-contract-refused'}));process.exitCode=3}});
`;
export const pythonDatabaseTarget=pythonSqlGuard+String.raw`
import sys
try:
 raw=sys.stdin.buffer.read(16385);r=lease_json.loads(raw)
 if len(raw)>16384 or lease_json.dumps(r,separators=(',',':')).encode()!=raw or set(r)!={'schemaVersion','phase','installationId','nodeId','targetGuard'} or r['schemaVersion']!=1 or r['phase'] not in ('migrations','seed') or r['nodeId']!='srv-'+r['installationId'].replace('-','') or r['targetGuard']['operation']['kind']!='database': lease_fail()
 g=r.pop('targetGuard');l=sql_guard(g,r['installationId'],r['nodeId']);dispatch_target_operation(l)
 def effect():
  raw=sql_guard_capture(['docker','exec','-i',g['containerId'],'node','/app/scripts/setup-database-v1.mjs'],input=lease_json.dumps(r,separators=(',',':')).encode(),cap=2048,timeout=120)
  o=lease_json.loads(raw);expected={**r,'contract':'castlink-database-v1','migrations':{'roomVersions':[1,2,3],'controlVersions':[1,2,3,4,5],'schema':True,'hashes':True},'seed':{'installations':1,'accounts':1,'organizations':1,'memberships':1,'nodes':1,'studios':1,'rooms':0} if r['phase']=='seed' else None}
  if o!=expected: lease_fail()
  return o
 o=effect();sql_guard_check(g,l,r['installationId'],r['nodeId'])
 if effect()!=o: lease_fail()
 sql_guard_check(g,l,r['installationId'],r['nodeId']);release_target_operation(l,True);print(lease_json.dumps(o,separators=(',',':')))
except BaseException:
 print(lease_json.dumps({'schemaVersion':1,'contract':'castlink-database-v1','ok':False,'diagnosis':'database-contract-refused'}));sys.exit(3)
`;
