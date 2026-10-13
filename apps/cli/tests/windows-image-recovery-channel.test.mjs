import test from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {runWindowsServiceWorker,parseImageRecoveryFailure} from '../dist/windows-service-worker.js';
import {nodeWindowsImageRecoveryWorker} from '../dist/windows-image-worker-catalog.js';
import {encodeWindowsRootRequest} from '../dist/windows-native-root.js';
const iid='12345678-1234-1234-1234-123456789abc',guard={operation:{schemaVersion:1,kind:'images',root:'D:\\private\\bundle',installationId:iid,engine:'engine',epoch:1,principal:{kind:'windows-sid',sid:'S-1-5-21-1'},scope:'D:\\private\\.castlink-target-operations'},endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine',project:'castlink-'+iid.replaceAll('-',''),fileHashes:Object.fromEntries(['compose.yaml','livekit.yaml','postgres.env','web.env'].map(n=>[n,'d'.repeat(64)]))},lease={nonce:'e'.repeat(64),activeIdentity:'33333333:0000000000000033',ownerIdentity:'44444444:0000000000000044',rootIdentity:'22222222:0000000000000022',scopeIdentity:'11111111:0000000000000011'};
async function execute(message,code=0,stdout='{}\n'){
 let hookCalls=0,brokerCalls=0,sharedState;
 class Worker extends EventEmitter{constructor(source,options){super();assert(source.endsWith(nodeWindowsImageRecoveryWorker));this.stdout=new EventEmitter();this.stderr=new EventEmitter();sharedState=new Int32Array(options.workerData.reply,0,4);queueMicrotask(()=>{this.emit('message',{id:1,...message});this.stdout.emit('data',Buffer.from(stdout));this.emit('exit',code)})}async terminate(){}}
 const bindings={Worker,parseImageRecoveryFailure,bootstrap:'fixture bootstrap\n',nodeWindowsImageRecoveryWorker,encodeWindowsRootRequest,windowsNativeBroker:{executeSync(){brokerCalls++;return{stdout:'{}'}}},nodeWindowsServiceCaptureWorker:'',nodeWindowsPrivateServicesWorker:'',nodeWindowsPrivateObservationWorker:'',nodeWindowsImageWorker:'',nodeWindowsServicesWorker:'',globalThis:{__castlinkWindowsNativeRoot:()=>{hookCalls++;return{status:'ok',bytes:Buffer.from('{}')}}}};
 const fn=new Function('process','Buffer',...Object.keys(bindings),'return ('+runWindowsServiceWorker.toString()+')')({platform:'win32',env:{}},Buffer,...Object.values(bindings));
 const result=await fn(Buffer.from('{}'),'image-recovery');return{result,hookCalls,brokerCalls,state:sharedState[0]};
}
test('actual recovery family permits only lease-bound read opcodes29/30/35; pull/start/compose effects and readonly snapshots never reach native hook',async()=>{
 for(const input of [{operation:'resource-list-v1',guard,lease,kind:'container'},{operation:'service-image-inspect-v1',guard,lease,service:'caddy'},{operation:'service-image-raw-inspect-v1',guard,lease,service:'web'}]){const t=await execute({operation:'root',input});assert.equal(t.hookCalls,1);assert.equal(t.state,1);assert.equal(t.result.code,0);}
 for(const input of [{operation:'service-image-pull-v1',guard,lease,service:'caddy'},{operation:'compose-up-v1',guard,lease},{operation:'compose-create-v1',guard,lease},{operation:'service-image-inspect-v1',guard,snapshot:{rootIdentity:lease.rootIdentity,scopeIdentity:lease.scopeIdentity},service:'caddy'}]){const t=await execute({operation:'root',input});assert.equal(t.hookCalls,0);assert.equal(t.state,2);assert.equal(t.result.code,4);}
});
test('actual recovery family grants only identity/inspect/exclusive-write lease primitives and propagates only finite1..15 failure stage',async()=>{
 for(const action of ['identity','inspect','write']){const t=await execute({operation:'lease',input:{action}});assert.equal(t.brokerCalls,1);assert.equal(t.result.code,0)}
 for(const action of ['mkdir','initialize','force-release']){const t=await execute({operation:'lease',input:{action}});assert.equal(t.brokerCalls,0);assert.equal(t.result.code,4)}
 for(const stage of [1,15]){const text=JSON.stringify({schemaVersion:1,status:'refused',stage})+'\n',t=await execute({operation:'lease',input:{action:'identity'}},4,text);assert.deepEqual(t.result,{code:4,stdout:text,stderr:''})}
 for(const text of ['{"schemaVersion":1,"status":"refused","stage":16}\n','{"schemaVersion":1,"status":"refused","stage":1,"body":"PRIVATE"}\n','PRIVATE']){const t=await execute({operation:'lease',input:{action:'identity'}},4,text);assert.deepEqual(t.result,{code:4,stdout:'',stderr:''})}
});

test('actual recovery channel preserves only canonical bounded root call provenance',async()=>{
 const text=JSON.stringify({schemaVersion:1,status:'refused',stage:9,operation:29,phase:6,boundary:1})+'\n';const t=await execute({operation:'lease',input:{action:'identity'}},4,text);assert.deepEqual(t.result,{code:4,stdout:text,stderr:''});
 for(const patch of [{operation:26},{operation:45},{phase:7},{boundary:0},{boundary:4},{body:'private'}]){const raw=JSON.stringify({schemaVersion:1,status:'refused',stage:9,operation:30,phase:4,boundary:3,...patch})+'\n';const t=await execute({operation:'lease',input:{action:'identity'}},4,raw);assert.deepEqual(t.result,{code:4,stdout:'',stderr:''});}
});
