import {privateVolumeArtifact} from './private-volume-capability.js';
export type PublisherVolumeImage={Id:string;Os:'linux';Architecture:'amd64';Variant?:never;RepoDigests:string[];Volumes:'absent'|null;Authority:'publisher-local-image-id'};
// Immutable publisher source pin supplies authority. Runtime facts come from
// the protected selected daemon; this is not an OCI config-graph proof.
export function publisherVolumeImage(raw:unknown):PublisherVolumeImage{
 const fail=():never=>{throw Error('private-volume-unverified')};if(!privateVolumeArtifact||!Array.isArray(raw)||raw.length!==1)return fail();const i=raw[0];if(!i||typeof i!=='object'||Array.isArray(i)||i.Id!==privateVolumeArtifact.imageId||i.Os!=='linux'||i.Architecture!=='amd64'||!i.Config||typeof i.Config!=='object'||Array.isArray(i.Config)||i.Config.User!=='1000:1000'||JSON.stringify(i.Config.Entrypoint)!=='["/usr/local/bin/livekit-server-private"]'||!Array.isArray(i.RepoDigests)||i.RepoDigests.length>128||i.RepoDigests.some((v:unknown)=>typeof v!=='string'||!/^[-a-z0-9._:/]+@sha256:[a-f0-9]{64}$/.test(v))||new Set(i.RepoDigests).size!==i.RepoDigests.length)fail();
 const declared=Object.prototype.hasOwnProperty.call(i.Config,'Volumes');if(declared&&i.Config.Volumes!==null)fail();return{Id:i.Id,Os:'linux',Architecture:'amd64',RepoDigests:[...i.RepoDigests],Volumes:declared?null:'absent',Authority:'publisher-local-image-id'};
}
