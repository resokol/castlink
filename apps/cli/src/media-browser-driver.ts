import type {ChildProcess} from 'node:child_process';
import type {Readable,Writable} from 'node:stream';
import {constants} from 'node:fs';
import {open,lstat} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {verifyProtectedPath} from './setup.js';
import type {GuidedBrowserProbe} from './media-check.js';
import {isGuardedBrowserProcess,type GuardedBrowserProcess} from './media-browser-target.js';
const refused=()=>new Error('Private browser measurement is unverified. Retain its owned scope; inspect sandbox, isolated NSS trust, guest entry and private browser cleanup. No secret or browser response is included.');
// Responses and Chrome stderr can contain fragment URLs. They never become
// public errors, logs or generic Executor results.
export class PrivateCdpPipe {
 private next=0;private ended=false;private buffer=Buffer.alloc(0);private closing?:Promise<void>;
 private pending=new Map<number,{resolve:(v:unknown)=>void;reject:(e:Error)=>void;timer:NodeJS.Timeout}>();
 private input:Writable;private output:Readable;private readonly timeout:number;
 constructor(private readonly child:ChildProcess,options:{timeoutMs?:number}={}){
  this.timeout=options.timeoutMs??10000;if(!Number.isInteger(this.timeout)||this.timeout<50||this.timeout>30000)throw refused();
  this.input=child.stdio[3] as Writable;this.output=child.stdio[4] as Readable;
  if(!this.input?.write||!this.output?.on)throw refused();
  child.stderr?.resume();child.stdout?.resume();
  this.input.on('error',()=>this.abort());this.output.on('error',()=>this.abort());this.output.on('end',()=>this.abort());child.on('error',()=>this.abort());child.on('exit',()=>this.abort());
  this.output.on('data',(part:Buffer)=>{try{
   if(this.ended)return;this.buffer=Buffer.concat([this.buffer,part]);if(this.buffer.length>1048576)throw refused();
   for(let i=this.buffer.indexOf(0);i>=0;i=this.buffer.indexOf(0)){
    const raw=this.buffer.subarray(0,i);this.buffer=this.buffer.subarray(i+1);if(!raw.length)throw refused();
    const message=parseStrictJson(raw.toString('utf8'),1048576) as {id?:number;result?:unknown;error?:unknown;method?:unknown};
    if(!message||typeof message!=='object'||Array.isArray(message))throw refused();
    if(message.id===undefined){if(typeof message.method!=='string')throw refused();continue;}
    if(!Number.isSafeInteger(message.id))throw refused();const p=this.pending.get(message.id);if(!p)throw refused();this.pending.delete(message.id);clearTimeout(p.timer);
    if(message.error!==undefined)p.reject(refused());else if(Object.hasOwn(message,'result'))p.resolve(message.result);else{p.reject(refused());throw refused();}
   }
  }catch{this.abort();}});
 }
 private abort(){this.ended=true;this.buffer=Buffer.alloc(0);for(const p of this.pending.values()){clearTimeout(p.timer);p.reject(refused());}this.pending.clear();}
 async send(method:string,params:Record<string,unknown>={},sessionId?:string):Promise<unknown>{
  if(this.ended||!/^[A-Za-z]+\.[A-Za-z]+$/.test(method)||sessionId!==undefined&&!/^[A-Za-z0-9._:-]{1,128}$/.test(sessionId)||this.pending.size>=64)throw refused();
  const id=++this.next,bytes=Buffer.from(JSON.stringify({id,method,params,...(sessionId?{sessionId}:{})})+'\0');if(bytes.length>131072)throw refused();
  return new Promise((resolve,reject)=>{const timer=setTimeout(()=>{this.abort();},this.timeout);this.pending.set(id,{resolve,reject,timer});this.input.write(bytes,e=>{if(e)this.abort();});});
 }
 close():Promise<void>{return this.closing??=this.closeOnce();}
 private async closeOnce(){
  if(!this.ended)try{await this.send('Browser.close');}catch{/* bounded forced reap follows */}
  this.abort();if(this.child.exitCode!==null||this.child.signalCode!==null)return;
  await new Promise<void>((resolve,reject)=>{let force:NodeJS.Timeout,deadline:NodeJS.Timeout;const done=()=>{clearTimeout(force);clearTimeout(deadline);resolve();};this.child.once('exit',done);this.child.kill('SIGTERM');force=setTimeout(()=>{this.child.kill('SIGKILL');},500);deadline=setTimeout(()=>{this.child.removeListener('exit',done);reject(refused());},2000);});
 }
}
async function entry(input:Parameters<GuidedBrowserProbe['run']>[0]):Promise<string>{
 const {inviteArtifact:a}=input,u=new URL(input.origin);
 if(u.protocol!=='https:'||u.origin!==input.origin||a.target!=='local'||a.runId!==input.runId||a.studioId!==input.studioId||a.room!==input.room||a.contract!=='castlink-media-private-v1'||a.schemaVersion!==1||!a.path.endsWith('/.castlink-media/'+input.runId+'/guest-entry.txt')||!/^[a-f0-9-]{36}$/.test(input.runId)||input.room!=='cli-media-'+input.runId)throw refused();
 await verifyProtectedPath(a.path,false,false,true);await verifyProtectedPath(a.path.slice(0,a.path.lastIndexOf('/')),true,false,true);
 const fd=await open(a.path,constants.O_RDONLY|constants.O_NOFOLLOW|constants.O_NONBLOCK);
 try{const s=await fd.stat();if(!s.isFile()||s.nlink!==1||s.size<1||s.size>4096||!isDeepStrictEqual({dev:s.dev,ino:s.ino,mode:s.mode&511,sha256:a.association.sha256},a.association))throw refused();
  const bytes=Buffer.alloc(4097),n=await fd.read(bytes,0,bytes.length,0);const after=await fd.stat(),named=await lstat(a.path);
  if(n.bytesRead!==s.size||after.ctimeMs!==s.ctimeMs||after.mtimeMs!==s.mtimeMs||named.dev!==s.dev||named.ino!==s.ino||createHash('sha256').update(bytes.subarray(0,n.bytesRead)).digest('hex')!==a.association.sha256)throw refused();
  const raw=bytes.subarray(0,n.bytesRead).toString('utf8'),url=new URL(raw,input.origin);if(url.origin!==input.origin||url.pathname!=='/room'||url.searchParams.get('studioId')!==input.studioId||url.searchParams.get('name')!==input.room||url.username||url.password||[...url.searchParams.keys()].sort().join(',')!=='name,studioId'||!/^#invite=[A-Za-z0-9._~-]{1,4000}$/.test(url.hash))throw refused();
  return url.href;
 }finally{await fd.close();}
}
// Fixed observer runs before application scripts. It records only genuine PCs
// and the identity returned by the real guest token flow, never token bytes.
const observer=String.raw`(()=>{const pcs=[];const P=window.RTCPeerConnection;window.RTCPeerConnection=new Proxy(P,{construct(t,a){const pc=Reflect.construct(t,a);pcs.push(pc);return pc;}});const f=window.fetch;let identity=null;window.fetch=async function(...a){const r=await f.apply(this,a);try{const u=new URL(typeof a[0]==='string'?a[0]:a[0].url,location.href);if(u.origin===location.origin&&u.pathname==='/api/token'&&u.searchParams.get('role')==='guest'){const j=await r.clone().json();if(typeof j.identity==='string'&&j.identity.startsWith('guest-'))identity=j.identity;}}catch{}return r;};Object.defineProperty(window,'__castlinkMediaSample',{value:async()=>{const inbound=[],outbound=[],candidates=[];for(const pc of pcs){const report=await pc.getStats();for(const s of report.values()){if(s.type==='inbound-rtp'&&!s.isRemote){const receiver=pc.getTransceivers().find(t=>t.mid===s.mid)?.receiver;const track=receiver?.track;const video=[...document.querySelectorAll('video[data-lk-source]')].find(v=>v.srcObject instanceof MediaStream&&v.srcObject.getTracks().some(t=>t.id===track?.id));inbound.push({id:s.id,kind:s.kind,source:s.kind==='audio'?'microphone':video?.dataset.lkSource??null,bytes:s.bytesReceived??0,packets:s.packetsReceived??0,frames:s.framesDecoded??0,at:s.timestamp,mid:s.mid??null});}if(s.type==='outbound-rtp'&&!s.isRemote){const sender=pc.getSenders().find(x=>x.track?.id===report.get(s.mediaSourceId)?.trackIdentifier);outbound.push({id:s.id,kind:s.kind,source:s.kind==='audio'?'microphone':sender?.track?.getSettings().displaySurface?'screen_share':sender?.track?'camera':null,bytes:s.bytesSent??0,packets:s.packetsSent??0,frames:s.framesEncoded??0,at:s.timestamp,trackId:sender?.track?.id??report.get(s.mediaSourceId)?.trackIdentifier??null});}if(s.type==='transport'&&s.selectedCandidatePairId){const p=report.get(s.selectedCandidatePairId),l=report.get(p?.localCandidateId),r=report.get(p?.remoteCandidateId);if(p&&l&&r)candidates.push({selected:true,state:p.state,localType:l.candidateType,remoteType:r.candidateType,protocol:l.protocol});}}}return{identity,inbound,outbound,candidates,videos:[...document.querySelectorAll('video[data-lk-source]')].map(v=>({source:v.dataset.lkSource,width:v.videoWidth,height:v.videoHeight,frames:v.getVideoPlaybackQuality().totalVideoFrames}))};}});})();`;
export type BrowserDriverMeasurements={schemaVersion:1;contract:'castlink-browser-observations-v1';runId:string;studioId:string;room:string;page:'/room';source:'unverified-pipe'|'builtin-pipe';syntheticDevices:boolean;clients:unknown[];screenShare:unknown};
function freezeEvidence(value:unknown){if(value&&typeof value==='object'){for(const v of Object.values(value))freezeEvidence(v);Object.freeze(value);}}
const evidenceAuthority=new WeakMap<GuidedBrowserProbe,unknown>();
function createDriver(child:ChildProcess,options:{timeoutMs?:number;sampleMs?:number;syntheticDevices?:boolean},target?:GuardedBrowserProcess):GuidedBrowserProbe {
 const pipe=new PrivateCdpPipe(child,options),sampleMs=options.sampleMs??3000;let ran=false,pendingEvidence:BrowserDriverMeasurements|undefined,closing:Promise<void>|undefined;
 if(!Number.isInteger(sampleMs)||sampleMs<100||sampleMs>10000)throw refused();
 async function evaluate(session:string,expression:string){const result=await pipe.send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true},session) as {exceptionDetails?:unknown;result?:{value?:unknown}};if(result.exceptionDetails||!result.result||!Object.hasOwn(result.result,'value'))throw refused();return result.result.value;}
 async function wait(session:string,expression:string){const deadline=Date.now()+15000;while(Date.now()<deadline){if(await evaluate(session,expression)===true)return;await new Promise(r=>setTimeout(r,100));}throw refused();}
 const driver:GuidedBrowserProbe={async run(input){input=structuredClone(input);if(target){if(!isGuardedBrowserProcess(target)||input.origin!==target.origin||input.studioId!==target.studioId||input.runId!==target.runId)throw refused();input.inviteArtifact=await target.verifyInput(input);}if(ran)throw refused();ran=true;const url=await entry(input),sessions:string[]=[];
  for(let i=0;i<2;i++){
   const context=await pipe.send('Target.createBrowserContext',{disposeOnDetach:true}) as {browserContextId:string};if(typeof context.browserContextId!=='string')throw refused();
   await pipe.send('Browser.grantPermissions',{browserContextId:context.browserContextId,origin:input.origin,permissions:['audioCapture','videoCapture']});
   const pageTarget=await pipe.send('Target.createTarget',{url:'about:blank',browserContextId:context.browserContextId}) as {targetId:string};
   const attached=await pipe.send('Target.attachToTarget',{targetId:pageTarget.targetId,flatten:true}) as {sessionId:string};sessions.push(attached.sessionId);
   await pipe.send('Page.enable',{},attached.sessionId);await pipe.send('Runtime.enable',{},attached.sessionId);await pipe.send('Page.addScriptToEvaluateOnNewDocument',{source:observer},attached.sessionId);
   if(target)await target.assertScope();
   await pipe.send('Page.navigate',{url},attached.sessionId);
   await wait(attached.sessionId,`location.origin===${JSON.stringify(input.origin)}&&location.pathname==='/room'&&new URL(location.href).searchParams.get('studioId')===${JSON.stringify(input.studioId)}&&new URL(location.href).searchParams.get('name')===${JSON.stringify(input.room)}`);
   await wait(attached.sessionId,`!!document.querySelector('input[placeholder="Например: Алексей"]')`);
   await evaluate(attached.sessionId,`(()=>{const e=document.querySelector('input[placeholder="Например: Алексей"]');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(e,'CLI media guest ${i+1}');e.dispatchEvent(new Event('input',{bubbles:true}));return true;})()`);
   await evaluate(attached.sessionId,`(()=>{const b=[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Продолжить');if(!b||b.disabled)return false;b.click();return true;})()`);
   await wait(attached.sessionId,`[...document.querySelectorAll('button')].some(x=>x.textContent.trim()==='Войти в конференцию'&&!x.disabled)`);
   await evaluate(attached.sessionId,`(()=>{[...document.querySelectorAll('button')].find(x=>x.textContent.trim()==='Войти в конференцию').click();return true;})()`);
   await wait(attached.sessionId,`!!document.querySelector('.guest-screen-share-button:not([disabled])')`);
  }
  const sample=async()=>{for(const s of sessions){if(await evaluate(s,`location.origin===${JSON.stringify(input.origin)}&&location.pathname==='/room'&&new URL(location.href).searchParams.get('studioId')===${JSON.stringify(input.studioId)}&&new URL(location.href).searchParams.get('name')===${JSON.stringify(input.room)}`)!==true)throw refused();}return Promise.all(sessions.map(s=>evaluate(s,'window.__castlinkMediaSample()')));},before=await sample();await new Promise(r=>setTimeout(r,sampleMs));const after=await sample();
  await evaluate(sessions[0]!,`(()=>{document.querySelector('.guest-screen-share-button:not([disabled])').click();return true;})()`);
  await wait(sessions[0]!,`document.querySelector('.guest-screen-share-button')?.getAttribute('aria-pressed')==='true'`);
  await wait(sessions[1]!,`[...document.querySelectorAll('video[data-lk-source="screen_share"]')].some(x=>x.videoWidth>0&&x.videoHeight>0)`);
  const screenBefore=await sample();await new Promise(r=>setTimeout(r,sampleMs));const screenAfter=await sample();
  await evaluate(sessions[0]!,`(()=>{document.querySelector('.guest-screen-share-button').click();return true;})()`);
  const evidence={schemaVersion:1,contract:'castlink-browser-observations-v1',runId:input.runId,studioId:input.studioId,room:input.room,page:'/room',source:target?'builtin-pipe':'unverified-pipe',syntheticDevices:options.syntheticDevices===true,clients:before.map((b,i)=>({before:b,after:after[i]})),screenShare:{before:screenBefore,after:screenAfter}} satisfies BrowserDriverMeasurements;
  if(Buffer.byteLength(JSON.stringify(evidence))>65536)throw refused();freezeEvidence(evidence);
  if(target){await target.assertScope();if(validateCollectedBrowserObservations(evidence,input))pendingEvidence=evidence;}
  return evidence;
 },close(){return closing??=finish();}};
 async function finish(){if(!target){await pipe.close();return;}try{await pipe.send('Browser.close');}catch{/* definitive helper reap/POST decides close */}await target.closeTarget();await pipe.close();if(pendingEvidence)evidenceAuthority.set(driver,pendingEvidence);}
 return driver;
}
// This seam exists for protocol/process tests and future remote access. An
// arbitrary process cannot obtain builtin provenance, even with valid stats.
export function createUnverifiedPipeBrowserDriver(child:ChildProcess,options:{timeoutMs?:number;sampleMs?:number;syntheticDevices?:boolean}={}):GuidedBrowserProbe{return createDriver(child,{...options});}
export function createBuiltinMediaBrowserDriver(target:GuardedBrowserProcess):GuidedBrowserProbe {if(!isGuardedBrowserProcess(target))throw refused();return createDriver(target.child,{syntheticDevices:true},target);}
export function isBuiltinBrowserEvidence(driver:GuidedBrowserProbe,evidence:unknown):boolean{return evidence!==undefined&&evidenceAuthority.get(driver)===evidence;}
type Rtp={id:string;kind:string;source:string;bytes:number;packets:number;frames:number;at:number};
type Sample={identity:string;inbound:Rtp[];outbound:Rtp[];candidates:{selected:boolean;state:string;localType:string;remoteType:string;protocol:string}[];videos:{source:string;width:number;height:number;frames:number}[]};
// This is a structure/delta check only. Caller-supplied objects never gain
// provenance by passing it; only a verified fixed launcher may certify origin.
export function validateCollectedBrowserObservations(value:unknown,scope:{runId:string;studioId:string;room:string}):boolean {
 try{
  const v=value as BrowserDriverMeasurements;
  if(!v||v.schemaVersion!==1||v.contract!=='castlink-browser-observations-v1'||v.page!=='/room'||!['unverified-pipe','builtin-pipe'].includes(v.source)||typeof v.syntheticDevices!=='boolean'||v.runId!==scope.runId||v.studioId!==scope.studioId||v.room!==scope.room||!Array.isArray(v.clients)||v.clients.length!==2)return false;
  function sample(s:Sample){return s&&/^guest-[A-Za-z0-9-]{1,90}$/.test(s.identity)&&['inbound','outbound'].every(k=>Array.isArray(s[k as 'inbound'])&&s[k as 'inbound'].length<=100&&s[k as 'inbound'].every(t=>t&&typeof t.id==='string'&&['audio','video'].includes(t.kind)&&[null,'microphone','camera','screen_share'].includes(t.source)&&[t.bytes,t.packets,t.frames,t.at].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0)))&&Array.isArray(s.candidates)&&s.candidates.length>0&&s.candidates.length<=8&&s.candidates.every(p=>p.selected===true&&p.state==='succeeded'&&['host','srflx','prflx','relay'].includes(p.localType)&&['host','srflx','prflx','relay'].includes(p.remoteType)&&p.protocol==='udp')&&Array.isArray(s.videos)&&s.videos.every(x=>x&&[x.width,x.height,x.frames].every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0));}
  function delta(b:Sample,a:Sample,direction:'inbound'|'outbound',source:'microphone'|'camera'|'screen_share'){
   return b[direction].filter(t=>t.source===source&&t.kind===(source==='microphone'?'audio':'video')).some(t=>{const matches=a[direction].filter(x=>x.id===t.id&&x.kind===t.kind&&x.source===t.source);if(matches.length!==1)return false;const z=matches[0]!;return z.at>t.at&&z.at-t.at<=60000&&z.bytes>t.bytes&&z.packets>t.packets&&(t.kind!=='video'||z.frames>t.frames);});
  }
  function video(b:Sample,a:Sample,source:string){return b.videos.some(x=>x.source===source&&x.width>0&&x.height>0&&a.videos.some(y=>y.source===source&&y.width>0&&y.height>0&&y.frames>x.frames));}
  const clients=v.clients as {before:Sample;after:Sample}[];
  if(!clients.every(c=>sample(c.before)&&sample(c.after)&&c.before.identity===c.after.identity&&['inbound','outbound'].every(d=>['camera','microphone'].every(s=>delta(c.before,c.after,d as 'inbound',s as 'camera')))&&video(c.before,c.after,'camera'))||clients[0]!.before.identity===clients[1]!.before.identity)return false;
  const screen=v.screenShare as {before:Sample[];after:Sample[]};if(!screen||!Array.isArray(screen.before)||!Array.isArray(screen.after)||screen.before.length!==2||screen.after.length!==2)return false;
  for(let i=0;i<2;i++){const b=screen.before[i]!,a=screen.after[i]!;if(!sample(b)||!sample(a)||b.identity!==clients[i]!.before.identity||a.identity!==b.identity||!delta(b,a,i===0?'outbound':'inbound','screen_share'))return false;}
  return video(screen.before[1]!,screen.after[1]!,'screen_share');
 }catch{return false;}
}
