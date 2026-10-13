// Source metadata only. This does not establish engine refs, runtime or import authority.
import {isDeepStrictEqual} from 'node:util';
const volumeCapability=Object.freeze({kind:'castlink-idleseal-private-volume-v1',version:'1.13.7+castlink-idleseal-private.3',storageProtocol:'castlink-private-volume-v1',uid:1000,gid:1000,reserveUid:0,reserveGid:0});
export function validateOfflineRelease(release,provenance,sidecarVersion){
 const version=release?.schemaVersion,keys=['schemaVersion','release','nodeVersion','architectures','images',...(version===2?['privateControl']:[])];
 if(!release||typeof release!=='object'||Array.isArray(release)||Object.keys(release).sort().join(',')!==keys.sort().join(',')||![1,2].includes(version)||typeof release.release!=='string'||release.release.length>128||!/^\d+\.\d+\.\d+(?:-[a-zA-Z0-9.-]+)?$/.test(release.release)||release.nodeVersion!=='22.23.3'||JSON.stringify(release.architectures)!=='["amd64"]')throw Error('Invalid actual amd64 release manifest.');
 if(version===2&&(sidecarVersion!==2||!isDeepStrictEqual(release.privateControl,volumeCapability)||provenance?.livekit?.controlVersion!==volumeCapability.version))throw Error('Invalid fixed private volume capability/provenance association.');
 return release;
}
export function validateOfflinePrivateConfig(release,config,source){
 if(release.schemaVersion!==2)return;
 const c=config.config,labels=c?.Labels;
 if(!c||c.User!=='1000:1000'||!isDeepStrictEqual(c.Entrypoint,['/usr/local/bin/livekit-server-private'])||c.Volumes!==undefined&&c.Volumes!==null||!labels||labels['org.opencontainers.image.revision']!==source.commit||labels['com.castlink.source-tree']!==source.tree||labels['org.opencontainers.image.version']!==release.privateControl.version)throw Error('Private LiveKit config source/capability association mismatch.');
}
