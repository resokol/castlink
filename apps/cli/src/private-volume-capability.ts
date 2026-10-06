import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {CliError} from './types.js';
export const privateVolumeCapability=Object.freeze({kind:'castlink-idleseal-private-volume-v1' as const,version:'1.13.7+castlink-idleseal-private.3',storageProtocol:'castlink-private-volume-v1',uid:1000,gid:1000,reserveUid:0,reserveGid:0});
export type PrivateVolumeCapability=typeof privateVolumeCapability;
// Coordinator-authored artifact authority, populated only from reviewed build
// provenance. Manifest/caller data cannot populate or override this constant.
// Private Windows producer53c; corrected traversal-only image observed as UID1000.
// This local immutable image pin is not a portable OCI import or config-graph proof.
export const privateVolumeArtifact:Readonly<{imageId:string;binarySHA256:string}>|null=Object.freeze({imageId:'sha256:318c32d381ddcc8bbb2c23c30f82f898502bb59cae9d0f9c765f25a149b46fd9',binarySHA256:'7d006ab62e1f02354076abd15b08dc7be745ffd2a1cb2d96d11b0bf3d6f2b718'});
export function isPrivateVolumeCapability(value:unknown):value is PrivateVolumeCapability{return isDeepStrictEqual(value,privateVolumeCapability);}
export function privateVolumeReferences(scope:string,id:string){
 if(typeof scope!=='string'||!/^[A-Z]:\\/.test(scope)||path.win32.normalize(scope)!==scope||path.win32.basename(scope)!=='.castlink-target-operations'||/[\x00-\x1f\x7f]/.test(scope)||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(id))throw new CliError('Windows private volume scope is unverified.',2);
 return{volumeKey:'private_control',volumeName:'castlink-'+id.replaceAll('-','')+'_private_control',configFile:'/run/castlink-idleseal/control/config.json',stateDir:'/run/castlink-idleseal/control/state',reservation:path.win32.join(scope,'private-volume-config-'+id+'.json'),bootstrap:path.win32.join(scope,'private-volume-bootstrap-'+id+'.json')};
}
