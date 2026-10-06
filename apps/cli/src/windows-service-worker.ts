import {encodeWindowsRootRequest} from './windows-native-root.js';
import {nodeWindowsImageWorker} from './windows-image-worker-catalog.js';
import {Worker} from 'node:worker_threads';
import {windowsDatabaseWorkerBootstrap} from './windows-database-worker.js';
import {windowsNativeBroker} from './windows-native-broker.js';
import {nodeWindowsServicesWorker,nodeWindowsPrivateServicesWorker,nodeWindowsServiceCaptureWorker,nodeWindowsPrivateObservationWorker} from './windows-service-worker-catalog.js';
import type {CommandResult} from './types.js';
const bootstrap=windowsDatabaseWorkerBootstrap.replace('input.length>32768','input.length>1048576').replace("if(operation==='target')", "if(operation==='root')").replace("__castlinkWindowsNativeTarget:{value:r=>targetRoute('target',r)}", "__castlinkWindowsNativeRoot:{value:r=>targetRoute('root',r)}").replace('0,0,150000','0,0,200000');
export async function runWindowsServiceWorker(input:Buffer,family:'capture'|'services'|'private-services'|'images'|'private-observation'):Promise<CommandResult>{
 const refused:CommandResult={code:4,stdout:'',stderr:''},hook=(globalThis as typeof globalThis&{__castlinkWindowsNativeRoot?:(r:unknown)=>{status:'ok';bytes:Buffer}}).__castlinkWindowsNativeRoot;
 if(process.platform!=='win32'||typeof hook!=='function'||!Buffer.isBuffer(input)||!input.length||input.length>(family==='capture'?4096:1048576))return refused;
 const reply=new SharedArrayBuffer(1048576+16),state=new Int32Array(reply,0,4),bytes=new Uint8Array(reply,16),env={...process.env};delete env.CASTLINK_NATIVE_REQUEST_FD;delete env.CASTLINK_NATIVE_REPLY_FD;
 const worker=new Worker(bootstrap+(family==='capture'?nodeWindowsServiceCaptureWorker:family==='private-services'?nodeWindowsPrivateServicesWorker:family==='private-observation'?nodeWindowsPrivateObservationWorker:family==='images'?nodeWindowsImageWorker:nodeWindowsServicesWorker),{eval:true,workerData:{reply,input:Buffer.from(input)},env,stdout:true,stderr:true});let id=0,bad=false,stdout='';
 worker.on('message',r=>{try{if(bad||!r||Object.keys(r).sort().join(',')!=='id,input,operation'||r.id!==++id||id>10000)throw Error();let value:Buffer;
 if(r.operation==='root'&&family!=='capture'){if(family==='private-observation'){const b=encodeWindowsRootRequest(r.input);try{if(!('snapshot'in r.input)||[31,32,33,36,38,40,42].includes(b[8]!))throw Error();}finally{b.fill(0)}}const a=hook(r.input);if(!a||Object.keys(a).sort().join(',')!=='bytes,status'||a.status!=='ok'||!Buffer.isBuffer(a.bytes))throw Error();value=a.bytes;}
 else if(r.operation==='lease'&&(['capture','private-observation'].includes(family)?['identity','inspect']:['identity','inspect','mkdir','write']).includes(r.input?.action))value=Buffer.from(windowsNativeBroker.executeSync('target-lease-v1',r.input).stdout);
 else if(r.operation==='engine')value=Buffer.from(windowsNativeBroker.executeSync('docker-engine-v1',r.input).stdout);else throw Error();
 if(!value.length||value.length>bytes.length)throw Error();bytes.fill(0);bytes.set(value);Atomics.store(state,1,id);Atomics.store(state,2,value.length);Atomics.store(state,0,1);Atomics.notify(state,0);
 }catch{bad=true;bytes.fill(0);Atomics.store(state,0,2);Atomics.notify(state,0);}});
 return new Promise(resolve=>{const timer=setTimeout(()=>{bad=true;void worker.terminate()},600000);worker.stdout!.on('data',chunk=>{stdout+=chunk.toString('utf8');if(Buffer.byteLength(stdout)>(family==='capture'?4096:65536)){bad=true;void worker.terminate()}});worker.stderr!.on('data',()=>{bad=true;void worker.terminate()});worker.on('error',()=>{bad=true});worker.on('exit',code=>{clearTimeout(timer);bytes.fill(0);resolve(bad||code!==0?refused:{code:0,stdout,stderr:''})});});
}
