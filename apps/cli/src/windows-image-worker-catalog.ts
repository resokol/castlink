import {nodeImageTarget} from './image-target.js';
import {windowsServiceRootBridge} from './windows-service-worker-catalog.js';
function once(s:string,a:string,b:string){if(s.split(a).length!==2)throw Error('Fixed Windows image source association changed.');return s.replace(a,b)}
let source=nodeImageTarget;
source=once(source,"function imageRun(a){const p=leaseChild.spawnSync('docker',a,{stdio:['ignore','pipe','pipe'],maxBuffer:1048576,timeout:120000,windowsHide:true,shell:false});if(p.error||p.signal)leaseFail();return p}","function imageRun(a){leaseFail()}");
source=once(source,"if(lease.owner.endpoint!==r.endpoint||!equal(imageFiles(r.root,r.installationId),r.files))leaseFail();", "winServiceRequest={...r,action:'images'};winServiceLease=lease;if(lease.owner.endpoint!==r.endpoint||!equal(imageFiles(r.root,r.installationId),r.files))leaseFail();");
source=once(source,"const p=imageRun(['image','inspect','--format',imageFormat,r.reference]);", "const p={status:0,stdout:winServicePrivate('service-image-inspect-v1',{service:r.service},65536),stderr:Buffer.alloc(0)};");
source=once(source,"imageEffect(['image','pull','--platform','linux/'+r.architecture,r.reference]);", "winServicePrivate('service-image-pull-v1',{service:r.service},65536);");
source=once(source,"imageDocker([kind,'ls',...(kind==='container'?['--all']:[]),'--quiet',...(kind==='volume'?[]:['--no-trunc'])])", "winServicePrivate('resource-list-v1',{kind}).toString('utf8')");
source=once(source,"imageDocker([kind,'inspect','--format',imageResourceFormats[kind],n])", "winServicePrivate('resource-inspect-v1',{kind,name:n}).toString('utf8')");
// Windows cached observation is authoritative or uncertain; the native process
// intentionally does not manufacture a cache-miss from arbitrary CLI stderr.
// Fixed pull is therefore performed once under the actual image lease, before
// observing identity; other public cached-read paths avoid this mutation.
source=once(source,"let identity=imageIdentity(r),pulled=false;if(!identity){dispatchTargetOperation(lease);", "let identity=null,pulled=false;if(!identity){dispatchTargetOperation(lease);");
source=once(source,"architecture,endpoint,engine,epoch,files,installationId,principal,project,reference,root,schemaVersion,scope,targets", "architecture,endpoint,engine,epoch,files,installationId,principal,project,reference,release,root,schemaVersion,scope,service,targets");
source=once(source,"r.schemaVersion!==1||!['amd64','arm64'].includes(r.architecture)", "r.schemaVersion!==1||r.architecture!=='amd64'||!['web','postgres','livekit','caddy'].includes(r.service)");
source=once(source,"!v.RepoDigests.includes(r.reference)", "!(require('node:util').isDeepStrictEqual(r.release,windowsLocalPreviewRelease)?winLocalOfficialAliases(r.reference,v.RepoDigests):v.RepoDigests.includes(r.reference))");
source=once(source,"return {...v,RepoDigests:[r.reference]}", "if(require('node:util').isDeepStrictEqual(r.release,windowsLocalPreviewRelease)&&v.Volumes===null)leaseFail();return {...v,RepoDigests:require('node:util').isDeepStrictEqual(r.release,windowsLocalPreviewRelease)?v.RepoDigests:[r.reference]}");
const entry="let imageInput='';process.stdin.setEncoding('utf8');process.stdin.on('data',b=>{imageInput+=b;if(Buffer.byteLength(imageInput)>1048576)process.exit(4)});process.stdin.on('end',()=>{try{";
source=once(source,entry,"(()=>{const imageInput=winTargetInput();try{").replace(/}}\);\n$/, '}})();\n');
export const nodeWindowsImageWorker=windowsServiceRootBridge+source;
