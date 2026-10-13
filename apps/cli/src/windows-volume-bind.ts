import path from 'node:path';
import {nodeServiceCaddyArchive} from './services-archive.js';
export function windowsLivekitBindCandidates(expected:string):string[]{
 if(typeof expected!=='string'||!/^[A-Z]:\\/.test(expected)||path.win32.normalize(expected)!==expected||path.win32.basename(expected)!=='livekit.yaml'||/[\x00-\x1f\x7f]/.test(expected))throw Error('windows-volume-bind-unverified');
 const suffix=expected.slice(3).replaceAll('\\','/'),drive=expected[0]!.toLowerCase();return[expected,'/run/desktop/mnt/host/'+drive+'/'+suffix,'/host_mnt/'+drive+'/'+suffix];
}
export const nodeWindowsLivekitBind=nodeServiceCaddyArchive.replaceAll('startCaddyDigest','wvLivekitDigest').replaceAll('Caddyfile','livekit.yaml').replace('oct(h,100,8)!==292','oct(h,100,8)>511')+String.raw`
function wvBindSource(actual,expected,c,r){
 if(!/^[A-Z]:\\/.test(expected))wvFail();
 if(leasePath.win32.normalize(expected)!==expected||leasePath.win32.basename(expected)!=='livekit.yaml'||/[\x00-\x1f\x7f]/.test(expected))wvFail();const tail=expected.slice(3).replaceAll('\\','/'),drive=expected[0].toLowerCase(),candidates=[expected,'/run/desktop/mnt/host/'+drive+'/'+tail,'/host_mnt/'+drive+'/'+tail];if(!candidates.includes(actual)||!/^[a-f0-9]{64}$/.test(c.Id)||c.Image!==wvArtifact?.imageId)wvFail();
 // A stopped definition is only a deferred mount check. It cannot authorize
 // terminal success; the fixed bootstrap starts CLOSED-LK and repeats this read.
 if(!c.Running){if(r.action!=='services'&&r.action!=='start'&&!(r.action==='status'&&r._retainedStoppedMapping===true))wvFail();return true}
 const identity=winInspect(expected,false),bytes=leaseReadProtected(expected,65536),hash=pcHash(bytes);if(hash!==r.files['livekit.yaml'])wvFail();const p=leaseChild.spawnSync('docker',['cp',c.Id+':/etc/livekit.yaml','-'],{maxBuffer:1048576,timeout:10000,windowsHide:true,shell:false});if(p.error||p.signal||p.status!==0||p.stderr.length||wvLivekitDigest(p.stdout)!==hash||!winSame(winInspect(expected,false),identity)||pcHash(leaseReadProtected(expected,65536))!==hash)wvFail();return true;
}
`;
