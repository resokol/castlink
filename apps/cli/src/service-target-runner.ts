import {fixedNodeArguments} from './fixed-node-program.js';
import type {TargetPrincipal} from './target-operation-observer.js';
import {isDeepStrictEqual} from 'node:util';
import {createHash} from 'node:crypto';
import {renderBundle,type BundleInput} from './bundle.js';
import {nodeImageObservation,pythonImageObservation} from './image-target.js';
import {nodeServiceTarget,pythonServiceTarget} from './service-target.js';
import {parseStrictJson} from './strict-json.js';
import {resourceIdentity,ServicesPhaseError,type ServiceContract,type Inventory} from './services.js';
import type {Executor} from './types.js';
export async function runServiceTarget(action:'services'|'start',input:BundleInput,contract:ServiceContract,resources:Inventory,expectedFiles:Record<string,string>,expectedEngine:string,remote:boolean,executor:Executor,expectedEpoch:number,expectedEndpoint:string,expectedPrincipal:TargetPrincipal,expectedScope:string):Promise<void>{
 const principal=typeof expectedPrincipal==='number'?expectedPrincipal:{...expectedPrincipal};
 try{
  const root=contract.composePath.slice(0,-'/compose.yaml'.length),rendered=renderBundle(input);
  const command=(source:string,payload:unknown)=>executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',source]:fixedNodeArguments(source),input:Buffer.from(JSON.stringify(payload)),sensitive:true});
  const capture=await command(remote?pythonImageObservation:nodeImageObservation,{root,installationId:input.installationId});if(capture.code!==0||capture.stderr)throw Error();
  const snapshot=parseStrictJson(capture.stdout,4096) as {schemaVersion:number;engine:string;endpoint:string;epoch:number;active:boolean;principal:TargetPrincipal;scope:string;files:Record<string,string>};
  if(Object.keys(snapshot).sort().join(',')!=='active,endpoint,engine,epoch,files,principal,schemaVersion,scope'||snapshot.schemaVersion!==1||snapshot.active!==false||snapshot.engine!==expectedEngine||snapshot.epoch!==expectedEpoch||snapshot.endpoint!==expectedEndpoint||!isDeepStrictEqual(snapshot.principal,principal)||snapshot.scope!==expectedScope||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||typeof snapshot.endpoint!=='string'||Object.keys(expectedFiles).sort().join(',')!=='compose.yaml,livekit.yaml,postgres.env,web.env'||Object.entries(expectedFiles).some(([n,h])=>snapshot.files[n]!==h)||snapshot.files['compose.yaml']!==contract.composeSHA256)throw Error();
  const result=await command(remote?pythonServiceTarget:nodeServiceTarget,{schemaVersion:1,action,root,installationId:input.installationId,engine:expectedEngine,endpoint:snapshot.endpoint,epoch:snapshot.epoch,principal,scope:expectedScope,files:snapshot.files,project:contract.project,model:rendered.composeModel,contract,resources:resourceIdentity(resources),caddySHA256:createHash('sha256').update(rendered.caddyText).digest('hex')});if(result.code!==0||result.stderr)throw Error();
  const reply=parseStrictJson(result.stdout,65536) as {schemaVersion:number;running:boolean;alreadyRunning:boolean;resources:unknown};if(Object.keys(reply).sort().join(',')!=='alreadyRunning,resources,running,schemaVersion'||reply.schemaVersion!==1||reply.running!==true||typeof reply.alreadyRunning!=='boolean')throw Error();
 }catch{throw new ServicesPhaseError(!remote&&process.platform==='win32'?'Windows service target or Docker Desktop bind mapping is unverified; retain its lease and verify exact drive/path, read mode and file-content association before retry.':'Fixed target service operation is unverified or blocked; retain protected artifacts and diagnose the target lease before retry.',4);}
}
