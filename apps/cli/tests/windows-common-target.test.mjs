import test from 'node:test';
import assert from 'node:assert/strict';
import {observeTargetGeneration} from '../dist/target-operation-observer.js';
import {nodeTargetLease,nodeTargetLeaseObservation} from '../dist/target-operation.js';
import {nativeWindowsTargetLease} from '../dist/windows-target-lease.js';
const sid={kind:'windows-sid',sid:'S-1-5-21-123-456-789-1001'};
const generation={schemaVersion:1,principal:sid,scope:'D:\\CastLink\\profiles\\.castlink-target-operations',engine:'fixture-engine',endpoint:'npipe:////./pipe/docker_engine',epoch:0,active:false};
import {execFileSync} from 'node:child_process';
function observe(value,remote=false){
 const source=`import {observeTargetGeneration} from ${JSON.stringify(new URL('../dist/target-operation-observer.js',import.meta.url).href)};const before=Object.getOwnPropertyDescriptor(process,'platform');Object.defineProperty(process,'platform',{value:'win32'});let output;try{output={ok:true,value:await observeTargetGeneration({run:async()=>({code:0,stdout:JSON.stringify(${JSON.stringify(value)}),stderr:''})},${remote})}}catch{output={ok:false}}finally{Object.defineProperty(process,'platform',before)}console.log(JSON.stringify(output));`;
 return JSON.parse(execFileSync(process.execPath,['--input-type=module','-e',source],{encoding:'utf8'}));
}
test('common observation accepts tagged native SID and canonical locator scope',()=>{
 assert.deepEqual(observe(generation),{ok:true,value:generation});
});
test('common observation rejects raw SID, malformed scope, Unix endpoint and remote SID',()=>{
 for(const value of [{...generation,principal:sid.sid},{...generation,scope:'D:\\CastLink\\..\\.castlink-target-operations'},{...generation,endpoint:'unix:///var/run/docker.sock'}])assert.equal(observe(value).ok,false);
 assert.equal(observe(generation,true).ok,false);
});
test('fixed common program embeds the approved native lease directly',()=>{
 assert.ok(nodeTargetLease.startsWith(nativeWindowsTargetLease));
 assert.match(nodeTargetLeaseObservation,/kind:'windows-sid'/);
});
