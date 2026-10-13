import type {ServerProvisioningSshClient as Client} from '../apps/web/lib/server-provisioning-ssh';
export type SshEndpoint={host:string;port:number};
export type SshAuthentication={authType?:'password';password:string;privateKey?:string;passphrase?:string}|{authType:'private-key';privateKey:string;passphrase?:string;password?:string};
export const SSH_PRIVATE_KEY_MAX_BYTES:number;
export function validateSshAuthentication(input:SshAuthentication):'password'|'private-key';
export function clearSshCredentials(input:{password?:string;privateKey?:string;passphrase?:string}):void;
export type SshTools={
 generateSshKeyPair():Promise<{privateKey:string;publicKey:string}>;
 validateSshKeyPair(publicKey:string,privateKey:string):void;
 probeSshFingerprint(endpoint:SshEndpoint):Promise<string>;
 openVerifiedSsh(endpoint:SshEndpoint&{fingerprint:string}&SshAuthentication):Promise<Client>;
 executeFixedSsh(client:Client,command:string,input:string,timeoutMs?:number,onLine?:(line:string)=>void):Promise<string>;
};
export function makeSshTools(client:new()=>Client,parseKey?:typeof import('ssh2').utils.parseKey):SshTools;
