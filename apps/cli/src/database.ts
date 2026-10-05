import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
import type {ServiceContract} from './services.js';

export class DatabasePhaseError extends CliError {}
export async function observeDatabase(contract:ServiceContract,nodeId:string,phase:'migrations'|'seed',executor:Executor):Promise<void>{
 const image=()=>new DatabasePhaseError('Pinned web image database-v1 contract is missing or unsupported; select a release image containing /app/scripts/setup-database-v1.mjs and its matching migration contract before retry.',3);
 let result;
 try{result=await executor.run({executable:'docker',args:['compose','--project-name',contract.project,'--project-directory',contract.composePath.slice(0,-'/compose.yaml'.length),'-f',contract.composePath,'exec','-T','web','node','/app/scripts/setup-database-v1.mjs'],input:Buffer.from(JSON.stringify({schemaVersion:1,phase,installationId:contract.installationId,nodeId})),sensitive:true});}catch{throw new DatabasePhaseError('Guarded database response was lost; retry observes SQL under the retained installation and resource identity before advancing.',3);}
 let observed:unknown;try{observed=parseStrictJson(result.stdout,2048);}catch{throw image();}
 if(isDeepStrictEqual(observed,{schemaVersion:1,contract:'castlink-database-v1',ok:false,diagnosis:'database-contract-refused'}))throw new DatabasePhaseError('Database schema, migration content or local seed identity refused verification; diagnose the protected database before retry. Owner and readiness remain pending.',3);
 const expected={schemaVersion:1,contract:'castlink-database-v1',phase,installationId:contract.installationId,nodeId,migrations:{roomVersions:[1,2],controlVersions:[1,2,3,4,5],schema:true,hashes:true},seed:phase==='seed'?{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0}:null};
 if(result.code!==0||!isDeepStrictEqual(observed,expected))throw image();
}
