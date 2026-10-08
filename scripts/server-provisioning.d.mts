import type {SshTools} from './server-provisioning-ssh.mjs';
import type {requestServerPeer} from './server-peer-request.mjs';
import type {ServerPeer,ServerScope} from './server-profile-store.mjs';
export type ProvisioningInput={host:string;port:number;fingerprint:string;password:string;mode:'deploy'|'connect';label:string;installationId?:string};
export type ProvisioningJob={id:string;state:'running'|'complete'|'failed';stage:string;bytes?:number;total?:number;bytesPerSecond?:number;error?:string;peerId?:string;createdAt:number};
export type ProvisioningOptions={scope:ServerScope;assertAuthorized:()=>Promise<void>;onProgress?:(value:Record<string,any>)=>void;persistPeer?:(peer:ServerPeer)=>Promise<unknown>};
export function makeProvisioning(transport:SshTools&{requestServerPeer:typeof requestServerPeer}):{
 validateProvisioningInput(input:ProvisioningInput):void;
 getServerProvisioningJob(id:string,roomId:string):ProvisioningJob|null;
 startServerProvisioning(input:ProvisioningInput,authorization:{roomId:string;assertAuthorized:()=>Promise<void>}):ProvisioningJob;
 provisionServer(input:ProvisioningInput,options:ProvisioningOptions):Promise<ServerPeer>;
 currentProvisioningRelease():Promise<{releaseUrl:string;releaseSha256:string;releaseCommitPrefix:string;releaseCommit:string}>;
};
