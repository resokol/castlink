import test from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {nodeServiceTarget} from '../dist/service-target.js';
const api=await import('../dist/fixed-node-program.js').catch(()=>({}));
test('Windows fixed launcher fits quoted CreateProcess executable and the real service helper',()=>{
 assert.equal(typeof api.fixedNodeArguments,'function');
 const args=api.fixedNodeArguments(nodeServiceTarget,true,'C:\\Program Files\\CastLink\\node.exe');
 assert.ok(api.windowsCommandLineLength('C:\\Program Files\\CastLink\\node.exe',args)<32767);
 assert.deepEqual(args,api.fixedNodeArguments(nodeServiceTarget,true,'C:\\Program Files\\CastLink\\node.exe'));
 assert.deepEqual(api.fixedNodeArguments('console.log(1)',false),['-e','console.log(1)']);
});
test('fixed compressed program preserves benign subprocess semantics and JSON stdin',()=>{
 assert.equal(typeof api.fixedNodeArguments,'function');
 const source="let input='';process.stdin.on('data',b=>input+=b);process.stdin.on('end',()=>console.log(JSON.stringify({value:JSON.parse(input).value+1})));";
 const result=spawnSync(process.execPath,api.fixedNodeArguments(source,true),{input:'{"value":4}',encoding:'utf8'});
 assert.equal(result.error,undefined);assert.equal(result.status,0);assert.equal(result.stderr,'');assert.deepEqual(JSON.parse(result.stdout),{value:5});
});
test('corrupt compressed literal or digest has a fixed diagnosis and executes no body',()=>{
 assert.equal(typeof api.fixedNodeArguments,'function');
 const args=api.fixedNodeArguments("console.log('PRIVATE_FIXTURE_MUST_NOT_RUN')",true);
 for(const source of [args[1].replace(/Buffer.from\('[^']+'/,'Buffer.from(\'bad\''),args[1].replace(/!==\'[a-f0-9]{64}\'/,"!=='"+'0'.repeat(64)+"'")]){
  const result=spawnSync(process.execPath,['-e',source],{encoding:'utf8'});assert.equal(result.error,undefined);assert.equal(result.status,4);assert.equal(result.stdout,'');assert.equal(result.stderr,'Fixed bundled Node program verification failed.\n');
 }
});
