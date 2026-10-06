import {Worker} from 'node:worker_threads';
import {windowsNativeBroker} from './windows-native-broker.js';
import {configTargetNode,windowsConfigurationScopeNode} from './config-target.js';
import {windowsProfileRootNode} from './windows-setup-root.js';
import type {CommandResult} from './types.js';
export type WindowsConfigProgram='config'|'scope'|'root';
export const windowsConfigWorkerBootstrap=String.raw`
const configThread=require('node:worker_threads'),configShared=configThread.workerData.reply,configState=new Int32Array(configShared,0,2),configReply=new Uint8Array(configShared,8);let configRequestId=0,configRead=false;
function configRoute(operation,input){if(!configThread.parentPort||++configRequestId>10000)throw Error('native-provider-unknown');Atomics.store(configState,0,0);configThread.parentPort.postMessage({id:configRequestId,operation,input});if(Atomics.wait(configState,0,0,120000)==='timed-out'||Atomics.load(configState,0)!==1)throw Error('native-provider-unknown');const n=Atomics.load(configState,1);if(n<1||n>configReply.length)throw Error('native-provider-unknown');const raw=Buffer.from(configReply.subarray(0,n)),text=raw.toString('utf8');if(!Buffer.from(text).equals(raw))throw Error('native-provider-unknown');const r=JSON.parse(text);if(!r||Object.keys(r).sort().join(',')!=='id,result,status'||r.id!==configRequestId||r.status!=='ok')throw Error('native-provider-unknown');return r.result;}
Object.defineProperties(globalThis,{
 __castlinkWindowsNativeBridge:{value:request=>configRoute('lease',request)},
 __castlinkWindowsNativeEngine:{value:request=>configRoute('engine',request)},
 __castlinkWindowsNativeSetupRoot:{value:request=>configRoute('root',request)},
 __castlinkWindowsNativeConfigRead:{value:()=>{if(configRead||!(configThread.workerData.input instanceof Uint8Array)||configThread.workerData.input.byteLength>131072)throw Error('native-provider-unknown');configRead=true;const result=Buffer.from(configThread.workerData.input);configThread.workerData.input.fill(0);return result;}}
});
if(process.platform!=='win32')process.exit(4);
`;
// Only these immutable bundled programs can be selected. Caller input is data.
// The Worker never receives primary pipe addresses or reads process fd0.
export async function runWindowsConfigTarget(mode:WindowsConfigProgram,input:Buffer,broker=windowsNativeBroker):Promise<CommandResult>{
 if(!['config','scope','root'].includes(mode)||!Buffer.isBuffer(input)||input.length>(mode==='config'?131072:4096))return{code:4,stdout:'',stderr:''};
 const programs={config:configTargetNode,scope:windowsConfigurationScopeNode,root:windowsProfileRootNode};
 const reply=new SharedArrayBuffer(32768),state=new Int32Array(reply,0,2),output=new Uint8Array(reply,8),env={...process.env};delete env.CASTLINK_NATIVE_REQUEST_FD;delete env.CASTLINK_NATIVE_REPLY_FD;
 const worker=new Worker(windowsConfigWorkerBootstrap+programs[mode],{eval:true,workerData:{reply,input:Buffer.from(input)},env,stdout:true,stderr:true});
 let id=0,bad=false,stdout='',stderr='';
 function answer(requestId:number,result:unknown,status:'ok'|'unknown'){
  const bytes=Buffer.from(JSON.stringify({id:requestId,result,status}));if(bytes.length>output.length){bad=true;output.fill(0);Atomics.store(state,0,2);Atomics.notify(state,0);return;}output.fill(0);output.set(bytes);Atomics.store(state,1,bytes.length);Atomics.store(state,0,1);Atomics.notify(state,0);
 }
 worker.on('message',request=>{
  try{
   if(bad||!request||Object.keys(request).sort().join(',')!=='id,input,operation'||request.id!==++id||id>10000)throw Error();let result;
   if(request.operation==='lease'){
    const allowed=mode==='root'?['registry-status']:mode==='scope'?['registry-status','initialize','identity','inspect']:['identity','inspect','mkdir','write'];
    if(!allowed.includes(request.input?.action))throw Error();result=broker.executeSync('target-lease-v1',request.input);
   }else if(request.operation==='engine'&&mode!=='root')result=broker.executeSync('docker-engine-v1',request.input);
   else if(request.operation==='root'&&mode==='root')result=broker.executeSync('setup-root-v1',request.input);
   else throw Error();answer(request.id,result,'ok');
  }catch{bad=true;answer(typeof request?.id==='number'?request.id:id,null,'unknown');}
 });
 return new Promise(resolve=>{
  const timer=setTimeout(()=>{bad=true;void worker.terminate()},300000);
  worker.stdout!.on('data',chunk=>{stdout+=chunk.toString('utf8');if(Buffer.byteLength(stdout)>8192){bad=true;void worker.terminate()}});
  worker.stderr!.on('data',chunk=>{stderr+=chunk.toString('utf8');if(Buffer.byteLength(stderr)>1024){bad=true;void worker.terminate()}});
  worker.on('error',()=>{bad=true});
  worker.on('exit',code=>{clearTimeout(timer);output.fill(0);resolve({code:bad||code!==0?4:0,stdout:bad||code!==0?'':stdout,stderr:bad||code!==0?'':stderr});});
 });
}
