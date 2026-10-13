import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {runWindowsServiceWorker} from './windows-service-worker.js';
export {nodePrivateVolumeObservation} from './private-volume-observer-program.js';
import {observeTargetGeneration} from './target-operation-observer.js';
import {parseStrictJson} from './strict-json.js';
import {privateVolumeArtifact,isPrivateVolumeCapability} from './private-volume-capability.js';
import {validateGuestMetadata,volumeKeys,type GuestMetadata} from './private-volume-protocol.js';
import {renderBundle,type BundleInput} from './bundle.js';
import type {Executor} from './types.js';
import type {Inventory,ServiceContract} from './services.js';
type Container=Inventory['containers'][number];
export async function observeWindowsVolumeTarget(kind:'bind'|'storage',input:BundleInput,contract:ServiceContract,container:Container,executor:Executor):Promise<{byteProof:'running-sha256'|'deferred-stopped';metadata?:GuestMetadata}>{
 if(process.platform!=='win32'||input.release.schemaVersion!==2||!isPrivateVolumeCapability(input.release.privateControl)||privateVolumeArtifact===null)throw Error('private-volume-artifact-unverified');
 const generation=await observeTargetGeneration(executor,false);if(typeof generation.principal==='number'||generation.scope!==input.controlScope)throw Error('private-volume-unverified');const root=path.win32.dirname(contract.composePath),rendered=renderBundle(input),model=rendered.composeModel;
 const capture=await runWindowsServiceWorker(Buffer.from(JSON.stringify({root,installationId:input.installationId})),'capture');if(capture.code!==0||capture.stderr)throw Error('private-volume-unverified');const snapshot=parseStrictJson(capture.stdout,4096) as {files:Record<string,string>}&typeof generation;const {files:capturedFiles,...capturedGeneration}=snapshot;if(!isDeepStrictEqual(capturedGeneration,generation))throw Error('private-volume-unverified');const files={...capturedFiles};delete files['receipt.json'];delete files['owner.json'];
 const actualSource=container.Mounts.find(m=>m.Destination==='/etc/livekit.yaml')?.Source,expectedSource=input.secretFiles.livekitConfig;const payload={...generation,kind,root,installationId:input.installationId,files,model,contract,caddySHA256:createHash('sha256').update(rendered.caddyText).digest('hex'),containerId:container.Id,actualSource,expectedSource};delete (payload as {active?:unknown}).active;
 const response=await runWindowsServiceWorker(Buffer.from(JSON.stringify(payload)),'private-observation');if(response.code!==0||response.stderr)throw Error('private-volume-unverified');const value=parseStrictJson(response.stdout,8192) as {schemaVersion:number;kind:string;containerId:string;actualSource:string;expectedSource:string;byteProof:'running-sha256'|'deferred-stopped';sha256:string|null;metadata?:GuestMetadata;status?:unknown};if(value.schemaVersion!==1||value.kind!==kind||value.containerId!==container.Id||value.actualSource!==actualSource||value.expectedSource!==expectedSource||value.byteProof!==(container.Running?'running-sha256':'deferred-stopped')||value.sha256!==(container.Running?files['livekit.yaml']:null)||!isDeepStrictEqual(await observeTargetGeneration(executor,false),generation))throw Error('private-volume-unverified');volumeKeys(value,'schemaVersion,kind,containerId,actualSource,expectedSource,byteProof,sha256'+(kind==='storage'?',metadata,status':''));if(kind==='storage'){if(!value.metadata)throw Error('private-volume-unverified');validateGuestMetadata(JSON.stringify(value.metadata),{schemaVersion:1,protocol:'castlink-private-volume-v1',installationId:input.installationId,engine:generation.engine,volume:'castlink-'+input.installationId.replaceAll('-','')+'_private_control',imageId:privateVolumeArtifact.imageId,version:'1.13.7+castlink-idleseal-private.3'});}return{byteProof:value.byteProof,...(value.metadata?{metadata:value.metadata}:{})};
}
