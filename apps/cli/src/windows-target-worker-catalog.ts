import {nodeAssociationCapture,nodeObserver,nodeCompletionTarget} from './setup-verification-target.js';
import {nativeWindowsTargetLease} from './windows-target-lease.js';
import {nodeOwnerTarget} from './owner.js';
import {nodeSqlGuard} from './target-sql-guard.js';
import {nodeDatabaseTarget} from './database.js';
// Installed only in checked fixed Worker programs. The trusted primary parent
// validates/encodes requests; no worker inherits the primary fd3/fd4 queue.
export const windowsTargetWorkerBridge=String.raw`
function winTargetPrivate(operation,guard,lease,fields,cap){
 try{const hook=globalThis.__castlinkWindowsNativeTarget;if(typeof hook!=='function')throw Error();const binding={nonce:lease.owner.nonce,activeIdentity:lease.reservation.identity,ownerIdentity:lease.ownerRecord.identity,rootIdentity:lease.owner.rootIdentity,scopeIdentity:lease.owner.scopeIdentity},request={operation,guard,lease:binding,...fields},r=hook(request);if(!r||Object.keys(r).sort().join(',')!=='bytes,status'||r.status!=='ok'||!Buffer.isBuffer(r.bytes)||r.bytes.length<1||r.bytes.length>cap)throw Error();return{status:0,stdout:r.bytes,stderr:''}}catch{leaseFail()}
}
function winTargetOwner(g,input,l){try{const r=JSON.parse(input);if(input!==JSON.stringify(r)||Object.keys(r).sort().join(',')!=='installationId,nodeId,origin,phase,schemaVersion'||r.schemaVersion!==1||r.installationId!==g.operation.installationId||r.nodeId!=='srv-'+r.installationId.replaceAll('-','')||!['initial','retained'].includes(r.phase))throw Error();return winTargetPrivate('owner-helper-v1',g,l,{phase:r.phase,origin:r.origin},2048)}catch{leaseFail()}}
function winTargetOwnerArchive(g,l){return winTargetPrivate('owner-invite-capture-v1',g,l,{},262144).stdout}
function winTargetInspect(g,l){return winTargetPrivate('container-inspect-v1',g,l,{},262144)}
function winTargetDatabase(g,input,l){try{const r=JSON.parse(input);if(input!==JSON.stringify(r)||Object.keys(r).sort().join(',')!=='installationId,nodeId,phase,schemaVersion'||r.schemaVersion!==1||r.installationId!==g.operation.installationId||r.nodeId!=='srv-'+r.installationId.replaceAll('-','')||!['migrations','seed'].includes(r.phase))throw Error();return winTargetPrivate('database-helper-v1',g,l,{phase:r.phase},2048)}catch{leaseFail()}}
`;
const inspect="leaseChild.spawnSync('docker',['inspect',g.containerId],{encoding:'utf8',timeout:10000,maxBuffer:262144,stdio:['ignore','pipe','pipe'],shell:false})";
function replaceOne(source:string,before:string,after:string):string{if(source.split(before).length!==2)throw Error('Fixed Windows target source association changed.');return source.replace(before,after);}
export const nodeWindowsSqlGuard=windowsTargetWorkerBridge+replaceOne(nodeSqlGuard,inspect,'winTargetInspect(g,l)');
const database="leaseChild.spawnSync('docker',['exec','-i',g.containerId,'node','/app/scripts/setup-database-v1.mjs'],{input:JSON.stringify(r),maxBuffer:2048,timeout:120000,shell:false})";
export const nodeWindowsDatabaseTarget=replaceOne(replaceOne(nodeDatabaseTarget,nodeSqlGuard,nodeWindowsSqlGuard),database,'winTargetDatabase(g,JSON.stringify(r),l)');
const databaseInput="let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>16384)process.exit(3)});process.stdin.on('end',()=>{try{";
export const nodeWindowsDatabaseWorkerTarget=replaceOne(nodeWindowsDatabaseTarget,databaseInput,"(()=>{const input=winTargetInput();try{").replace(/}\}\);\n$/, '}})();\n');

const ownerHelper="run('docker',['exec','-i',r.containerId,'node','/app/scripts/super-admin-owner.mjs','--installer-v1'],input,2048)";
const ownerArchive="run('docker',['cp',r.containerId+':'+o.filePath,'-'])";
export const nodeWindowsOwnerTarget=replaceOne(replaceOne(replaceOne(replaceOne(replaceOne(replaceOne(nodeOwnerTarget,nodeSqlGuard,nodeWindowsSqlGuard),ownerHelper,'winTargetOwner(g,input,lease).stdout'),ownerArchive,'winTargetOwnerArchive(g,lease)'), 'function server(r,initial=false)', 'function server(r,initial=false,g,lease)'), "server(r,r.allowInitial&&r.phase==='prepare')", "server(r,r.allowInitial&&r.phase==='prepare',g,lease)"), 'JSON.stringify(server(r))', 'JSON.stringify(server(r,false,g,lease))');
const ownerInput="let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>8192)process.exit(4)});\nprocess.stdin.on('end',()=>{try{";
export const nodeWindowsOwnerWorkerTarget=replaceOne(nodeWindowsOwnerTarget,ownerInput,"(()=>{const input=winTargetInput();try{").replace(/}\}\);\n$/, '}})();\n');

// Read-only cursor hint. Never creates/adopts an active lease or advances epoch.
export const windowsGenerationSnapshot=String.raw`
function winGenerationSnapshot(){const identity=winIdentity(),epoch=winEpoch(identity),active=winPath.join(identity.scope,'active');try{winFs.lstatSync(active);winFail()}catch(e){if(e.code!=='ENOENT')throw e}return{identity,epoch,engine:winEngine()}}
try{const a=winGenerationSnapshot(),b=winGenerationSnapshot();if(!winSame(a,b))winFail();console.log(JSON.stringify({schemaVersion:1,principal:{kind:'windows-sid',sid:a.identity.principal},scope:a.identity.scope,epoch:a.epoch,active:false,...a.engine}));}catch{process.exitCode=4}
`;
export const nodeWindowsGenerationWorkerTarget=nativeWindowsTargetLease+windowsGenerationSnapshot;

const privacyStart=nodeAssociationCapture.indexOf('function privacy('),privacyEnd=nodeAssociationCapture.indexOf('const hash=',privacyStart);
if(privacyStart<0||privacyEnd<privacyStart)throw Error('Fixed association privacy source changed.');
const associationPrivacy="function privacy(p,directory){const s=fs.lstatSync(p);if(win){const r=winInspect(p,directory);if(r.path!==p||!/^[A-F0-9]{8}:[A-F0-9]{16}$/.test(r.identity))fail()}else if(s.uid!==process.getuid()||(s.mode&511)!==(directory?448:384))fail();return s}\n";
export const nodeWindowsAssociationCapture=nativeWindowsTargetLease+replaceOne(nodeAssociationCapture,nodeAssociationCapture.slice(privacyStart,privacyEnd),associationPrivacy);
const associationInput="let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>8192)process.exit(3)});process.stdin.on('end',()=>{try{";
export const nodeWindowsAssociationWorkerTarget=replaceOne(nodeWindowsAssociationCapture,associationInput,"(()=>{const input=winTargetInput();try{").replace(/}\}\);\n$/, '}})();\n');



export const windowsSetupObservationBridge=String.raw`
let winSetupContext,winSetupLease;
function winSetupBind(r,c){if(!c||Object.keys(c).sort().join(',')!=='caddy,web')winFail();const hashes=Object.fromEntries(Object.entries(r.files).map(([n,a])=>[n,a.sha256]));for(const role of ['web','caddy']){const g=c[role],o=g?.operation;if(!g||!o||o.kind!=='completion'||o.root!==r.root||o.installationId!==r.installationId||g.containerId!==r[role+'ContainerId']||g.containerImage!==r[role+'ImageId']||g.project!=='castlink-'+r.installationId.replaceAll('-','')||!winSame(g.fileHashes,hashes))winFail()}if(!winSame(c.web.operation,c.caddy.operation)||c.web.endpoint!==c.caddy.endpoint)winFail();winSetupContext=c;}
function winSetupSnapshot(g){const i=winIdentity(),root=winInspect(g.operation.root,true,i),epoch=winEpoch(i),engine=winEngine();try{winFs.lstatSync(winPath.join(i.scope,'active'));winFail()}catch(e){if(e.code!=='ENOENT')throw e}if(!winSame(i,winIdentity())||epoch!==g.operation.epoch||i.principal!==g.operation.principal.sid||i.scope!==g.operation.scope||engine.engine!==g.operation.engine||engine.endpoint!==g.endpoint||root.path!==g.operation.root||!/^[A-F0-9]{8}:[A-F0-9]{16}$/.test(root.identity))winFail();return{rootIdentity:root.identity,scopeIdentity:i.scopeIdentity};}
function winSetupPrivate(kind,r,role='web'){const g=winSetupContext?.[role];if(!g)winFail();let operation,fields={},cap=262144;if(kind==='inspect')operation=winSetupLease?'container-inspect-v1':'readonly-container-inspect-v1';else if(kind==='sql'){operation=winSetupLease?'setup-observe-helper-v1':'readonly-setup-observe-v1';fields={origin:r.origin,serverName:r.serverName};cap=2048}else if(kind==='ca')operation=winSetupLease?'caddy-ca-capture-v1':'readonly-caddy-ca-v1';else if(kind==='invite')operation=winSetupLease?'owner-invite-capture-v1':'readonly-owner-invite-v1';else winFail();if(winSetupLease)return winTargetPrivate(operation,g,winSetupLease,fields,cap).stdout;const hook=globalThis.__castlinkWindowsNativeTarget;if(typeof hook!=='function')winFail();const answer=hook({operation,guard:g,snapshot:winSetupSnapshot(g),...fields});if(!answer||Object.keys(answer).sort().join(',')!=='bytes,status'||answer.status!=='ok'||!Buffer.isBuffer(answer.bytes)||!answer.bytes.length||answer.bytes.length>cap)winFail();return answer.bytes;}
`;
const observerInspectStart=nodeObserver.indexOf('function identity('),observerInspectEnd=nodeObserver.indexOf('function local(',observerInspectStart);
const observerIdentity="function identity(r){for(const service of ['web','caddy']){const a=JSON.parse(winSetupPrivate('inspect',r,service).toString('utf8'));if(!Array.isArray(a)||a.length!==1||a[0].Id!==r[service+'ContainerId']||a[0].Image!==r[service+'ImageId']||a[0].State?.Running!==true)fail()}}\n";
const observerSql="run(['exec','-i',r.webContainerId,'node','/app/scripts/setup-observe-v1.mjs'],JSON.stringify(request),2048)";
const observerCa="run(['cp',r.caddyContainerId+':/data/caddy/pki/authorities/local/root.crt','-'])";
const observerInvite="run(['cp',r.webContainerId+':/data/.castlink-owner/'+r.installationId+'/owner-invite.txt','-'])";
function protectedObserver(source:string){return replaceOne(replaceOne(replaceOne(replaceOne(replaceOne(source,nodeAssociationCapture.slice(privacyStart,privacyEnd),associationPrivacy),nodeObserver.slice(observerInspectStart,observerInspectEnd),observerIdentity),observerSql,"winSetupPrivate('sql',r)"),observerCa,"winSetupPrivate('ca',r,'caddy')"),observerInvite,"winSetupPrivate('invite',r)");}
export const nodeWindowsObserver=nativeWindowsTargetLease+windowsSetupObservationBridge+protectedObserver(nodeObserver);
const observerEntry=nodeWindowsObserver.indexOf("let input='';process.stdin");
export const nodeWindowsObserverWorkerTarget=nodeWindowsObserver.slice(0,observerEntry)+String.raw`
(async()=>{try{const e=parse(winTargetInput());if(!keys(e,'request,context'))fail();const r=validate(e.request);if(r.complete||r.attempt!==null)fail();winSetupBind(r,e.context);const before=winSetupSnapshot(winSetupContext.web),result=await observe(r);if(!winSame(before,winSetupSnapshot(winSetupContext.web)))fail();console.log(JSON.stringify(result));}catch{console.log(JSON.stringify({schemaVersion:1,contract:'castlink-setup-target-v1',ok:false,diagnosis:'setup-observation-refused'}));process.exitCode=3}})();
`;
const completionEntry="let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>32768)process.exit(3)});process.stdin.on('end',async()=>{try{";
const completionKeys="keys(e,'request,targetGuard,attemptPath,allowCreate')";
const completionPrepare='const r=validate(e.request),g=e.targetGuard;';
const completionAcquire='const l=sqlGuard(g,r.installationId,r.nodeId);';
const completionWrite='const f=fs.openSync(e.attemptPath,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,384);try{fs.writeFileSync(f,b);fs.fsyncSync(f)}finally{fs.closeSync(f)}';
const protectedCompletion=replaceOne(replaceOne(replaceOne(replaceOne(replaceOne(protectedObserver(replaceOne(nodeCompletionTarget,nodeSqlGuard,nodeWindowsSqlGuard)),completionKeys,"keys(e,'request,targetGuard,attemptPath,allowCreate,context')"),completionPrepare,completionPrepare+'winSetupBind(r,e.context);if(!winSame(winSetupContext.web,g))fail();'),completionAcquire,completionAcquire+'winSetupLease=l;'),completionWrite,'if(win)leaseWriteProtected(e.attemptPath,b);else{'+completionWrite+'}'),completionEntry,'(async()=>{const input=winTargetInput();try{');
export const nodeWindowsCompletionWorkerTarget=replaceOne(protectedCompletion,nodeWindowsSqlGuard,nodeWindowsSqlGuard+windowsSetupObservationBridge).replace(/}\}\);\n$/, '}})();\n');
