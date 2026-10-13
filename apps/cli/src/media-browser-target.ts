import {spawn,type ChildProcess} from 'node:child_process';
import type {Readable,Writable} from 'node:stream';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {nodeMediaAdmissionTarget} from './media-http-target.js';
import {nodeMediaCommon,nodeMediaEntry} from './media-target-common.js';
import {assertMediaBrowserAuthorityTarget,mediaBrowserAuthoritySnapshot,verifyOriginalMediaBrowserAuthority,type MediaBrowserAuthority,type GuardedMediaTargetOptions} from './media-target-transport.js';
import type {MediaPrivateArtifact} from './media-target-common.js';
import type {GuidedBrowserProbe} from './media-check.js';
import {nativeWindowsLeaseDiagnosis} from './target-operation-observer.js';
export const diagnosticBrowserRuntimeDiagnosis='The diagnostic browser runtime is not available for this target. Its Linux amd64 pin was verified only in the owned cloud proof environment; availability on other hosts and full guided media acceptance remain unverified.';
type RuntimePin={contract:'castlink-diagnostic-browser-runtime-v1';image:string;imageId:string;nodeSHA:string;chromiumSHA:string;chromiumVersion:string};
// A reviewed immutable runtime pin belongs in compiled package integrity. No
// caller image/manifest/JSON/argv can populate it. The loopback repository is
// owned cloud proof infrastructure, not a public or portable release artifact.
const diagnosticBrowserRuntimePin:Readonly<RuntimePin>=Object.freeze({contract:'castlink-diagnostic-browser-runtime-v1',image:'127.0.0.1:32771/castlink-guided-helper-d1f3503@sha256:8d5e98b8eb41ade547e586c9bfe89b0b22f2afc60f9825732ec513ed98db31a1',imageId:'sha256:4f14be4b1256263ed68609d599b98c9bb7d55b80672f6893487dd79d510daa49',nodeSHA:'fde6a4bf8d0562f7751d1a2d6cb9b417c4cfe107bbcb0aa3e9a24e125e348f48',chromiumSHA:'9cdd0829d2986f5163458879053e53bba0192cd0fdc588253bfa1ace55a9f34a',chromiumVersion:'Chromium 154.0.8037.92'});
function compiledRuntimePin():RuntimePin{return{...diagnosticBrowserRuntimePin};}
const refused=()=>new Error('Guarded diagnostic browser scope or cleanup is unverified; retain the original container acknowledgement and private target cursor. No automatic recreation or name-based adoption is authorized.');
export type GuardedBrowserProcess={readonly child:ChildProcess;readonly origin:string;readonly studioId:string;readonly runId:string;verifyInput:(input:Parameters<GuidedBrowserProbe['run']>[0])=>Promise<MediaPrivateArtifact>;assertScope:()=>Promise<void>;closeTarget:()=>Promise<void>};
const verified=new WeakSet<object>();
const retainedAuthority=new WeakMap<Error,{containerId:string;runId:string;installationId:string;caddyContainerId:string;caddyImageId:string;cursorBinding:unknown}>();
export function retainedBrowserTargetAuthority(error:unknown):unknown {return error instanceof Error&&retainedAuthority.has(error)?structuredClone(retainedAuthority.get(error)):null;}
export function isGuardedBrowserProcess(value:unknown):value is GuardedBrowserProcess{return typeof value==='object'&&value!==null&&verified.has(value);}
// No browser bytes pass through Executor. It handles only bounded redacted
// effect metadata; the fixed private bridge is attached after guarded prepare.
const nodeBrowserChecks=String.raw`
const diagnosticRuntime=${JSON.stringify(compiledRuntimePin())};
function browserRuntime(){const p=diagnosticRuntime;if(!p||p.contract!=='castlink-diagnostic-browser-runtime-v1'||!/^.+@sha256:[a-f0-9]{64}$/.test(p.image)||!/^sha256:[a-f0-9]{64}$/.test(p.imageId)||!['nodeSHA','chromiumSHA'].every(k=>/^[a-f0-9]{64}$/.test(p[k])))fail();return p}
function browserInspect(e,id){if(!/^[a-f0-9]{64}$/.test(id))fail();const out=JSON.parse(run(['inspect',id]).toString());if(!Array.isArray(out)||out.length!==1)fail();const c=out[0],b=e.binding,g=e.guard,p=browserRuntime(),labels=c.Config.Labels;
 if(c.Id!==id||c.Image!==p.imageId||labels['castlink.diagnostic-browser.run']!==b.runId||labels['castlink.diagnostic-browser.installation']!==b.installationId||labels['castlink.diagnostic-browser.root']!==g.operation.root||labels['castlink.diagnostic-browser.contract']!==p.contract||c.HostConfig.NetworkMode!=='container:'+b.caddyContainerId||c.HostConfig.Privileged!==false||c.HostConfig.ReadonlyRootfs!==true||!eq(c.HostConfig.CapDrop,['ALL'])||!eq(c.HostConfig.CapAdd,null)||!eq(c.HostConfig.SecurityOpt,['no-new-privileges'])||c.HostConfig.PortBindings!==null||c.Mounts.some(x=>x.Type==='bind'||x.Type==='volume')||!eq(c.HostConfig.Tmpfs,{'/tmp':'rw,noexec,nosuid,nodev,mode=1777','/root':'rw,nosuid,nodev,mode=0700'}))fail();return c}
`;
export const nodeDiagnosticBrowserTarget=nodeMediaCommon+nodeBrowserChecks+nodeMediaEntry(String.raw`
mediaValidate(e,'action,containerId,authority');mediaAuthority(e);const p=browserRuntime();if(!['create','prepare','inspect','remove'].includes(e.action)||e.action==='create'&&e.containerId!==null||e.action!=='create'&&typeof e.containerId!=='string')fail();
const l=sqlGuard(e.guard,e.binding.installationId,e.binding.nodeId);const {cert}=mediaCheck(e,l);mediaRun(e);mediaReceipt(e);mediaArtifactCheck(e,'guest-entry.txt');let id=e.containerId;
if(e.action==='create'){
 const images=JSON.parse(run(['image','inspect',p.image]).toString());if(!Array.isArray(images)||images.length!==1||images[0].Id!==p.imageId||images[0].Os!=='linux'||images[0].Architecture!=='amd64')fail();
 mediaCheck(e,l);const out=run(['create','--name','castlink-media-browser-'+e.binding.runId,'--label','castlink.diagnostic-browser.run='+e.binding.runId,'--label','castlink.diagnostic-browser.installation='+e.binding.installationId,'--label','castlink.diagnostic-browser.root='+e.guard.operation.root,'--label','castlink.diagnostic-browser.contract='+p.contract,'--network','container:'+e.binding.caddyContainerId,'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','256','--memory','1g','--cpus','2','--shm-size','256m','--tmpfs','/tmp:rw,noexec,nosuid,nodev,mode=1777','--tmpfs','/root:rw,nosuid,nodev,mode=0700','--env','HTTP_PROXY=','--env','HTTPS_PROXY=','--env','ALL_PROXY=','--env','NO_PROXY=','--env','http_proxy=','--env','https_proxy=','--env','all_proxy=','--env','no_proxy=',p.image,'--idle']).toString().trim();if(!/^[a-f0-9]{64}$/.test(out))fail();id=out;browserInspect(e,id);mediaCheck(e,l);run(['start',id]);if(browserInspect(e,id).State.Running!==true)fail();mediaCheck(e,l);
}else{
 const current=browserInspect(e,id);if(current.State.Running!==true)fail();mediaCheck(e,l);
 if(e.action==='prepare'){
  const metadata=parse(run(['exec','--interactive',id,'/opt/castlink/node','/opt/castlink/runtime.mjs','--prepare'],Buffer.from(JSON.stringify({contract:p.contract,ca:cert.toString(),caSHA:e.binding.caSHA}))).toString().trim());if(!eq(metadata,{contract:p.contract,prepared:true,caSHA:e.binding.caSHA}))fail();mediaCheck(e,l);
  const actual=parse(run(['exec',id,'/opt/castlink/node','/opt/castlink/runtime.mjs','--inspect']).toString().trim());if(!eq(actual,{contract:p.contract,node:'v22.23.3',nodeSHA:p.nodeSHA,chromium:p.chromiumVersion,chromiumSHA:p.chromiumSHA,architecture:'linux/x64'}))fail();browserInspect(e,id);mediaCheck(e,l);
 }else if(e.action==='remove'){
  run(['rm','--force',id]);mediaCheck(e,l);
  // A bounded exact-ID absence check, never lookup/adopt/delete by room or name.
  const check=spawnSync('docker',['inspect',id],{encoding:'utf8',timeout:10000,maxBuffer:16384});if(check.error||check.status!==1||check.stdout.trim()!=='[]'||!check.stderr.includes(id))fail();
 }
}
mediaCheck(e,l);mediaRun(e);mediaReceipt(e);mediaArtifactCheck(e,'guest-entry.txt');mediaDone(l,{schemaVersion:1,contract:'castlink-media-browser-target-v1',action:e.action,runId:e.binding.runId,containerId:id});
`);
export const nodeDiagnosticBrowserObservation=nodeMediaAdmissionTarget.slice(0,nodeMediaAdmissionTarget.lastIndexOf("let input='';process.stdin"))+nodeBrowserChecks+nodeMediaEntry(String.raw`
mediaValidate(e,'containerId');browserRuntime();mediaAdmissionCheck(e);if(browserInspect(e,e.containerId).State.Running!==true)fail();mediaAdmissionCheck(e);console.log(JSON.stringify({schemaVersion:1,contract:'castlink-media-browser-observation-v1',runId:e.binding.runId,containerId:e.containerId}));
`);
// Chromium and all private profile writes are ONE bounded target operation.
// Control metadata uses fd5/6; fd3/4 carry private CDP only. Ready is not an ACK.
export const nodeDiagnosticBrowserLifetime=nodeMediaCommon+nodeBrowserChecks+String.raw`
const net=require('node:net'),control=fs.createWriteStream(null,{fd:5}),cdpIn=new net.Socket({fd:3}),cdpOut=fs.createWriteStream(null,{fd:4}),requests=new net.Socket({fd:6});
let input='',e,l,browser,ready=false,failed=false,closing=false,deadline,startup,buffer=Buffer.alloc(0),commands=Buffer.alloc(0);
function signal(value){control.write(JSON.stringify({schemaVersion:1,contract:'castlink-media-browser-lifetime-v1',runId:e.binding.runId,containerId:e.containerId,...value})+'\0')}
function original(){mediaRun(e);mediaReceipt(e);mediaArtifactCheck(e,'guest-entry.txt')}
function owned(){mediaCheck(e,l);original();if(browserInspect(e,e.containerId).State.Running!==true)fail()}
function unknown(){if(failed)return;failed=true;clearTimeout(deadline);clearTimeout(startup);if(browser)browser.kill('SIGTERM');if(e)signal({type:'unknown'});cdpIn.destroy();requests.destroy();cdpOut.end();control.end();process.exitCode=4}
process.on('SIGTERM',unknown);process.on('uncaughtException',unknown);
process.stdin.setEncoding('utf8');process.stdin.on('data',part=>{input+=part;if(Buffer.byteLength(input)>131072)unknown()});
process.stdin.on('end',()=>{try{
 e=parse(input);input='';mediaValidate(e,'containerId,authority');mediaAuthority(e);const pin=browserRuntime();if(!/^[a-f0-9]{64}$/.test(e.containerId))fail();
 l=sqlGuard(e.guard,e.binding.installationId,e.binding.nodeId);owned();
 // Fresh actual bound PRE and held canonical owner precede Docker exec, Chrome
 // startup and every profile/cookie write through final own-container reap.
 browser=require('node:child_process').spawn('docker',['exec','--interactive',e.containerId,'/opt/castlink/node','/opt/castlink/runtime.mjs','--browser'],{stdio:['pipe','pipe','pipe'],shell:false});
 browser.stderr.on('data',unknown);browser.on('error',unknown);browser.stdin.on('error',unknown);cdpIn.on('error',unknown);cdpOut.on('error',unknown);requests.on('error',unknown);
 deadline=setTimeout(unknown,120000);startup=setTimeout(unknown,10000);
 browser.stdin.write(JSON.stringify({id:0,method:'Browser.getVersion'})+'\0');
 browser.stdout.on('data',part=>{try{
  if(failed)return;buffer=Buffer.concat([buffer,part]);if(buffer.length>1048576)fail();
  for(let i=buffer.indexOf(0);i>=0;i=buffer.indexOf(0)){
   const frame=buffer.subarray(0,i);buffer=buffer.subarray(i+1);const message=JSON.parse(frame.toString('utf8'));
   if(!ready){if(message.id!==0)continue;const version=pin.chromiumVersion.match(/([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/);if(!version||message.error||typeof message.result?.product!=='string'||!message.result.product.endsWith('/'+version[1]))fail();owned();ready=true;clearTimeout(startup);signal({type:'ready',epoch:e.guard.operation.epoch});cdpIn.pipe(browser.stdin);}
   else{if(message.id===0)fail();cdpOut.write(Buffer.concat([frame,Buffer.from([0])]));}
  }
 }catch{unknown()}});
 requests.on('data',part=>{try{if(failed)return;commands=Buffer.concat([commands,part]);if(commands.length>8192)fail();for(let i=commands.indexOf(0);i>=0;i=commands.indexOf(0)){const raw=commands.subarray(0,i);commands=commands.subarray(i+1);const q=JSON.parse(raw.toString());if(!keys(q,'id,type')||q.type!=='assert'||!Number.isSafeInteger(q.id)||q.id<1||!ready||closing)fail();owned();signal({type:'scope',id:q.id,epoch:e.guard.operation.epoch});}}catch{unknown()}});
 browser.on('close',code=>{try{
  if(failed)return;if(code!==0||!ready||buffer.length)fail();closing=true;clearTimeout(deadline);clearTimeout(startup);cdpIn.unpipe(browser.stdin);cdpIn.destroy();requests.destroy();
  owned();run(['rm','--force',e.containerId]);mediaCheck(e,l);original();
  const absent=spawnSync('docker',['inspect',e.containerId],{encoding:'utf8',timeout:10000,maxBuffer:16384});if(absent.error||absent.status!==1||absent.stdout.trim()!=='[]'||!absent.stderr.includes(e.containerId))fail();
  mediaCheck(e,l);original();releaseTargetOperation(l,true);
  signal({type:'terminal',epoch:e.guard.operation.epoch+1});cdpOut.end();control.end();process.exitCode=0;
 }catch{unknown()}});
 }catch{unknown()}});
`;
class BrowserLifetime {
 readonly ready:Promise<void>;readonly terminal:Promise<void>;
 private readyResolve!:()=>void;private readyReject!:(e:Error)=>void;private terminalResolve!:()=>void;private terminalReject!:(e:Error)=>void;
 private readySeen=false;private terminalSeen=false;private failed=false;private buffer=Buffer.alloc(0);private next=0;
 private deadline?:NodeJS.Timeout;
 private pending=new Map<number,{resolve:()=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>();private input:Writable;
 constructor(readonly child:ChildProcess,private runId:string,private id:string,private epoch:number){
  this.ready=new Promise((resolve,reject)=>{this.readyResolve=resolve;this.readyReject=reject;});this.terminal=new Promise((resolve,reject)=>{this.terminalResolve=resolve;this.terminalReject=reject;});this.ready.catch(()=>{});this.terminal.catch(()=>{});
  const streams=child.stdio as Array<Readable|Writable|null>;this.deadline=setTimeout(()=>{this.fail();child.kill('SIGKILL');},150000);const output=streams[5] as Readable;this.input=streams[6] as Writable;if(!output?.on||!this.input?.write)throw refused();
  child.stdout?.on('data',()=>this.fail());child.stderr?.on('data',()=>this.fail());child.on('error',()=>this.fail());this.input.on('error',()=>this.fail());output.on('error',()=>this.fail());
  output.on('data',(part:Buffer)=>{try{this.buffer=Buffer.concat([this.buffer,part]);if(this.buffer.length>16384)throw refused();for(let i=this.buffer.indexOf(0);i>=0;i=this.buffer.indexOf(0)){
   const raw=this.buffer.subarray(0,i);this.buffer=this.buffer.subarray(i+1);const v=parseStrictJson(raw.toString('utf8'),16384) as {type:string;id:number;epoch:number};
   const base={schemaVersion:1,contract:'castlink-media-browser-lifetime-v1',runId:this.runId,containerId:this.id};
   if(v?.type==='ready'&&!this.readySeen){if(!isDeepStrictEqual(v,{...base,type:'ready',epoch:this.epoch}))throw refused();this.readySeen=true;this.readyResolve();}
   else if(v?.type==='terminal'&&this.readySeen&&!this.terminalSeen){if(!isDeepStrictEqual(v,{...base,type:'terminal',epoch:this.epoch+1}))throw refused();this.terminalSeen=true;}
   else if(v?.type==='scope'&&this.readySeen&&!this.terminalSeen){const p=this.pending.get(v.id);if(!p||!isDeepStrictEqual(v,{...base,type:'scope',id:v.id,epoch:this.epoch}))throw refused();this.pending.delete(v.id);clearTimeout(p.timer);p.resolve();}else throw refused();
  }}catch{this.fail();}});
  child.on('close',code=>{clearTimeout(this.deadline);if(this.failed||code!==0||!this.readySeen||!this.terminalSeen||this.buffer.length){this.fail();return;}this.input.destroy();for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(refused());}this.pending.clear();this.terminalResolve();});
 }
 private fail(){if(this.failed)return;this.failed=true;this.readyReject(refused());this.terminalReject(refused());for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(refused());}this.pending.clear();}
 async assertScope(){if(this.failed||!this.readySeen||this.terminalSeen)throw refused();const id=++this.next;return new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>{this.fail();},30000);this.pending.set(id,{resolve,reject,timer});this.input.write(JSON.stringify({type:'assert',id})+'\0',e=>{if(e)this.fail();});});}
}
export async function createGuardedMediaBrowserTarget(options:GuardedMediaTargetOptions&{syntheticContainerPreview:true;authority:MediaBrowserAuthority}):Promise<GuardedBrowserProcess>{
 const pin=compiledRuntimePin();if(!pin)throw new Error(diagnosticBrowserRuntimeDiagnosis);
 if(options.cursor.remote)throw new Error('Remote private browser transport/export is unavailable; no credentials were exported.');
 if(process.platform==='win32')throw new Error(nativeWindowsLeaseDiagnosis);
 if(options.syntheticContainerPreview!==true||Object.keys(options).sort().join(',')!=='authority,binding,contract,cursor,executor,fileHashes,resources,syntheticContainerPreview')throw refused();
 assertMediaBrowserAuthorityTarget(options.authority,options);const snapshot=mediaBrowserAuthoritySnapshot(options.authority);await verifyOriginalMediaBrowserAuthority(options.authority);
 const {executor,cursor}=options,binding=structuredClone(options.binding),contract=structuredClone(options.contract),resources=structuredClone(options.resources),fileHashes=structuredClone(options.fileHashes);let id:string|null=null,busy=false;
 async function fixed(action:'create'|'prepare'){
  if(busy)throw refused();busy=true;
  try{return await cursor.effect(async()=>{const guard=cursor.sqlGuard('owner',contract,resources,fileHashes),result=await executor.run({executable:process.execPath,args:['-e',nodeDiagnosticBrowserTarget],input:Buffer.from(JSON.stringify({binding,guard,authority:snapshot.authority,action,containerId:id})),sensitive:true});if(result.code!==0||result.stderr)throw refused();const v=parseStrictJson(result.stdout,1024) as {containerId:string};if(!v||!/^[a-f0-9]{64}$/.test(v.containerId)||id!==null&&v.containerId!==id||!isDeepStrictEqual(v,{schemaVersion:1,contract:'castlink-media-browser-target-v1',action,runId:binding.runId,containerId:v.containerId}))throw refused();return v.containerId;});}finally{busy=false;}
 }
 id=await fixed('create');const ownId=id,original=Object.freeze({containerId:id,runId:binding.runId,installationId:binding.installationId,caddyContainerId:binding.caddyContainerId,caddyImageId:binding.caddyImageId,cursorBinding:cursor.binding});
 let live:BrowserLifetime|undefined,readyResolve!:(value:BrowserLifetime)=>void,readyReject!:(error:unknown)=>void;
 const ready=new Promise<BrowserLifetime>((resolve,reject)=>{readyResolve=resolve;readyReject=reject;});ready.catch(()=>{});
 try{await fixed('prepare');}catch{const e=refused();retainedAuthority.set(e,original);throw e;}
 const operation=cursor.effect(async()=>{
  await verifyOriginalMediaBrowserAuthority(options.authority);const guard=cursor.sqlGuard('owner',contract,resources,fileHashes);
  const child=spawn(process.execPath,['-e',nodeDiagnosticBrowserLifetime],{stdio:['pipe','pipe','pipe','pipe','pipe','pipe','pipe'],shell:false});
  live=new BrowserLifetime(child,binding.runId,ownId,guard.operation.epoch);child.stdin!.end(JSON.stringify({binding,guard,authority:snapshot.authority,containerId:ownId}));
  await live.ready;readyResolve(live);await live.terminal;
 });operation.catch(error=>readyReject(error));
 try{live=await ready;}catch{const e=refused();retainedAuthority.set(e,original);throw e;}
 const result:GuardedBrowserProcess={child:live.child,origin:binding.origin,studioId:binding.studioId,runId:binding.runId,
  async verifyInput(input){const expected={origin:binding.origin,studioId:binding.studioId,room:snapshot.receipt.name,inviteArtifact:snapshot.artifact,runId:binding.runId};if(!isDeepStrictEqual(input,expected))throw refused();await live!.assertScope();return verifyOriginalMediaBrowserAuthority(options.authority);},
  async assertScope(){await live!.assertScope();await verifyOriginalMediaBrowserAuthority(options.authority);},
  async closeTarget(){try{await operation;await verifyOriginalMediaBrowserAuthority(options.authority);verified.delete(result);}catch{const e=refused();retainedAuthority.set(e,original);throw e;}},
 };
 Object.freeze(result);verified.add(result);return result;
}
