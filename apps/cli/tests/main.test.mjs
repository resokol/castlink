import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runCli} from '../dist/main.js';

function fixtures(answers=[]) {
  const output=[]; let writes=0; let executions=0;
  return {output, counts:()=>({writes,executions}), dependencies:{
    readLine:async()=>answers.shift()??'', write:text=>output.push(text),
    detect:async target=>target.kind==='local'?{platform:'win32',arch:'x64',runtimeReady:false}:{platform:'linux',arch:'x64',runtimeReady:false,osVersion:'24.04'},
    executor:{run:async()=>{executions++; throw new Error('Unexpected process execution');}},
    store:{load:async()=>null,save:async()=>{writes++;},lock:async()=>{writes++;return async()=>{};}},
  }};
}
test('local dry-run returns a complete preview without writing or executing',async()=>{
  const f=fixtures();
  assert.equal(await runCli(['setup','--target','local','--network','loopback','--root','C:\\CastLink','--dry-run','--json'],f.dependencies),0);
  const plan=JSON.parse(f.output.join(''));
  assert.equal(plan.request.target.kind,'local'); assert.equal(plan.steps.length,9);
  assert.deepEqual(f.counts(),{writes:0,executions:0});
});
test('remote dry-run plans own server and TLS domain without side effects',async()=>{
  const f=fixtures();
  assert.equal(await runCli(['setup','--target','remote','--host','203.0.113.8','--user','operator','--domain','studio.example.org','--network','internet','--dry-run','--json'],f.dependencies),0);
  const plan=JSON.parse(f.output.join(''));
  assert.equal(plan.request.root,'/opt/castlink/main');assert.equal(plan.request.target.host,'203.0.113.8');
  assert.deepEqual(f.counts(),{writes:0,executions:0});
});
test('wizard can select either target without a desktop interface',async()=>{
  for(const answers of [['local','office','loopback','C:\\CastLink'],['remote','office','203.0.113.8','operator','internet','studio.example.org','/opt/castlink/office']]){
    const f=fixtures(answers); assert.equal(await runCli(['setup','--dry-run','--json'],f.dependencies),0);
    assert.deepEqual(f.counts(),{writes:0,executions:0});
  }
});
test('invalid arguments return usage error without exposing option values',async()=>{
  const f=fixtures();assert.equal(await runCli(['setup','--password','private-fixture'],f.dependencies),2);
  assert.doesNotMatch(f.output.join(''),/private-fixture/);assert.deepEqual(f.counts(),{writes:0,executions:0});
});
test('help never needs Docker, SSH or credentials',async()=>{
  const f=fixtures();assert.equal(await runCli(['--help'],f.dependencies),0);assert.match(f.output.join(''),/setup/);
  assert.deepEqual(f.counts(),{writes:0,executions:0});
});
test('installation is not reported successful before the engine exists',async()=>{
  const f=fixtures();assert.equal(await runCli(['setup','--target','local','--network','loopback','--root','C:\\CastLink'],f.dependencies),3);
  assert.doesNotMatch(f.output.join(''),/installation complete|сервер установлен/i);
});
test('doctor returns machine-readable failed prerequisites without writing configuration',async()=>{
 const f=fixtures();assert.equal(await runCli(['doctor','--json'],f.dependencies),3);const checks=JSON.parse(f.output.join(''));assert.equal(checks.find(x=>x.id==='docker').state,'fail');assert.equal(f.counts().writes,0);
});

test('doctor refuses an unknown named installation without executing processes',async()=>{
 const f=fixtures();assert.equal(await runCli(['doctor','--profile','office'],f.dependencies),2);
 assert.match(f.output.join(''),/профил/i);assert.deepEqual(f.counts(),{writes:0,executions:0});
});
