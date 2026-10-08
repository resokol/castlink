import type {ServerProvisioningSshClient as Client} from '../apps/web/lib/server-provisioning-ssh';
export type SshEndpoint={host:string;port:number};
export type SshTools={
 probeSshFingerprint(endpoint:SshEndpoint):Promise<string>;
 openVerifiedSsh(endpoint:SshEndpoint&{fingerprint:string;password:string}):Promise<Client>;
 executeFixedSsh(client:Client,command:string,input:string,timeoutMs?:number,onLine?:(line:string)=>void):Promise<string>;
};
export function makeSshTools(client:new()=>Client):SshTools;
