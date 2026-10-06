import {fixedNodeArguments} from './fixed-node-program.js';
import type {TargetPrincipal} from './target-operation-observer.js';
import {isDeepStrictEqual} from 'node:util';
import {nodeImageObservation,pythonImageObservation,nodeImageTarget,pythonImageTarget} from './image-target.js';
import {createHash} from 'node:crypto';
import {parseStrictJson} from './strict-json.js';
import {renderBundle,type BundleInput} from './bundle.js';
import {imagePullRequest,ImagesPhaseError,type ImageIdentity} from './image-provision.js';
import type {Executor} from './types.js';
// Caller-local receipts record the result. Actual target authority belongs to the
// fixed helper's held PRE/effect/POST, never to the journal or this capture.
export async function pullPinnedImageTarget(input:BundleInput,root:string,reference:string,targets:string[],remote:boolean,executor:Executor,expectedEngine:string,expectedFiles:Record<string,string>,expectedEpoch:number,expectedEndpoint:string,expectedPrincipal:TargetPrincipal,expectedScope:string):Promise<ImageIdentity>{
 const principal=typeof expectedPrincipal==='number'?expectedPrincipal:{...expectedPrincipal};
 try{
  imagePullRequest(reference,input.architecture);
  const command=(source:string,data:unknown)=>executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',source]:fixedNodeArguments(source),input:Buffer.from(JSON.stringify(data)),sensitive:true});
  const captured=await command(remote?pythonImageObservation:nodeImageObservation,{root,installationId:input.installationId});
  if(captured.code!==0||captured.stderr)throw Error();
  const snapshot=parseStrictJson(captured.stdout,4096) as {schemaVersion:number;engine:string;endpoint:string;epoch:number;active:boolean;principal:TargetPrincipal;scope:string;files:Record<string,string>};
  if(Object.keys(snapshot).sort().join(',')!=='active,endpoint,engine,epoch,files,principal,schemaVersion,scope'||snapshot.schemaVersion!==1||snapshot.active!==false||snapshot.engine!==expectedEngine||snapshot.epoch!==expectedEpoch||snapshot.endpoint!==expectedEndpoint||!isDeepStrictEqual(snapshot.principal,principal)||snapshot.scope!==expectedScope||!Number.isSafeInteger(snapshot.epoch)||snapshot.epoch<0||typeof snapshot.endpoint!=='string')throw Error();
  if(Object.keys(expectedFiles).sort().join(',')!=='compose.yaml,livekit.yaml,postgres.env,web.env'||Object.entries(expectedFiles).some(([n,h])=>snapshot.files[n]!==h)||snapshot.files['compose.yaml']!==createHash('sha256').update(renderBundle(input).composeText).digest('hex'))throw Error();
  const result=await command(remote?pythonImageTarget:nodeImageTarget,{schemaVersion:1,root,installationId:input.installationId,engine:expectedEngine,endpoint:snapshot.endpoint,epoch:snapshot.epoch,principal,scope:expectedScope,files:snapshot.files,project:renderBundle(input).projectName,reference,architecture:input.architecture,targets});
  if(result.code!==0||result.stderr)throw Error();
  const reply=parseStrictJson(result.stdout,65536) as {schemaVersion:number;pulled:boolean;image:ImageIdentity};
  if(Object.keys(reply).sort().join(',')!=='image,pulled,schemaVersion'||reply.schemaVersion!==1||typeof reply.pulled!=='boolean'||!reply.image)throw Error();
  return reply.image;
 }catch{throw new ImagesPhaseError(!remote&&process.platform==='win32'?'Windows image target identity, private file association or named-pipe engine is unverified; retain its lease and inspect the frozen target binding.':'Pinned image target operation is unverified or blocked; retain private artifacts and diagnose the target operation lease before retry.',4);}
}
