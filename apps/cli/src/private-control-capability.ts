import {isPrivateVolumeCapability,type PrivateVolumeCapability} from './private-volume-capability.js';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {CliError} from './types.js';
export const privateControlCapability=Object.freeze({kind:'castlink-idleseal-private-v2' as const,version:'1.13.7+castlink-idleseal-private.2',imageId:'sha256:b3ddff3a9605095a8da4b45e55b1d238cc1db51f4e3e896ff45e1815fc64c90f',binarySHA256:'7fc823d552d9438914eba9c8878714a56038a3f324bdb6e763bc0998783d7d41',uid:1000,gid:1000});
export type PrivateControlCapability=typeof privateControlCapability|PrivateVolumeCapability;
export function validatePrivateControlCapability(value:unknown):PrivateControlCapability {
 if(!isDeepStrictEqual(value,privateControlCapability)&&!isPrivateVolumeCapability(value))throw new CliError('Private control capability is unsupported or unverified.',2);
 return structuredClone(value) as PrivateControlCapability;
}
export function privateControlReferences(scope:string,installationId:string){
 if(typeof scope!=='string'||!path.posix.isAbsolute(scope)||path.posix.normalize(scope)!==scope||path.posix.basename(scope)!=='.castlink-target-operations'||/[,\x00-\x1f\x7f]/.test(scope)||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(installationId))throw new CliError('Private control target scope is unverified.',2);
 const controlRoot=path.posix.join(scope,'livekit-control-'+installationId);return{controlRoot,configFile:path.posix.join(controlRoot,'config.json')};
}

export function assertPrivateControlPlatform(capability:PrivateControlCapability,remote:boolean):void{
 validatePrivateControlCapability(capability);
 if(remote||(isPrivateVolumeCapability(capability)?process.platform!=='win32'||process.arch!=='x64':process.platform!=='linux'||process.arch!=='x64'||process.getuid?.()!==1000||process.getgid?.()!==1000))throw new CliError('Private control platform adapter is unverified for this selected target.',3);
}
