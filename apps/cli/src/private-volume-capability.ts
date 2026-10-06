import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {CliError} from './types.js';
export const privateVolumeCapability=Object.freeze({kind:'castlink-idleseal-private-volume-v1' as const,version:'1.13.7+castlink-idleseal-private.3',storageProtocol:'castlink-private-volume-v1',uid:1000,gid:1000,reserveUid:0,reserveGid:0});
export type PrivateVolumeCapability=typeof privateVolumeCapability;
// Coordinator-authored artifact authority, populated only from reviewed build
// provenance. Manifest/caller data cannot populate or override this constant.
export const privateVolumeArtifact:Readonly<{imageId:string;binarySHA256:string}>|null=null;
export function isPrivateVolumeCapability(value:unknown):value is PrivateVolumeCapability{return isDeepStrictEqual(value,privateVolumeCapability);}
export function privateVolumeReferences(scope:string,id:string){
 if(typeof scope!=='string'||!/^[A-Z]:\\/.test(scope)||path.win32.normalize(scope)!==scope||path.win32.basename(scope)!=='.castlink-target-operations'||/[\x00-\x1f\x7f]/.test(scope)||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))throw new CliError('Windows private volume scope is unverified.',2);
 return{volumeKey:'private_control',volumeName:'castlink-'+id.replaceAll('-','')+'_private_control',configFile:'/run/castlink-idleseal/control/config.json',stateDir:'/run/castlink-idleseal/control/state',reservation:path.win32.join(scope,'private-volume-config-'+id+'.json'),bootstrap:path.win32.join(scope,'private-volume-bootstrap-'+id+'.json')};
}
