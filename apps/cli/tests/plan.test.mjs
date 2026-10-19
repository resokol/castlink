import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPlan } from '../dist/plan.js';

const steps = ['preflight','runtime','release','config','services','migrations','seed','owner','verify'];
const local = { profile:'office', target:{kind:'local'}, network:'loopback', root:'C:\\CastLink тест', release:'1.0.0-rc.2' };
const windows = { platform:'win32', arch:'x64', runtimeReady:false };
const remote = { ...local, target:{kind:'remote',host:'vps.example.org',user:'operator',port:22}, network:'internet', domain:'studio.example.org', internet:{domain:'studio.example.org',publicIPv4:'8.8.4.4'}, root:'/opt/castlink/office' };
const ubuntu = { platform:'linux', arch:'arm64', runtimeReady:true, osVersion:'24.04' };

test('plans local Windows and macOS installations using the same verified steps', () => {
  for (const facts of [windows, {platform:'darwin',arch:'arm64',runtimeReady:true}, {platform:'darwin',arch:'x64',runtimeReady:true}]) {
    const request = facts.platform === 'darwin' ? {...local,root:'/Users/owner/Library/Application Support/CastLink/office'} : local;
    const plan = createPlan(request, facts);
    assert.deepEqual(plan.steps, steps);
    assert.deepEqual(plan.blockers, []);
    assert.equal(plan.request.profile, 'office');
  }
});
test('plans remote Ubuntu independently of creator infrastructure', () => {
  const plan = createPlan(remote, ubuntu);
  assert.deepEqual(plan.steps, steps);
  assert.deepEqual(plan.blockers, []);
  assert.deepEqual(createPlan({...remote,domain:undefined},ubuntu).request.internet,remote.internet);
  assert.throws(()=>createPlan({...remote,domain:'other.example.org'},ubuntu),/domain/i);
  assert.doesNotMatch(JSON.stringify(plan), /castlink\.ru|license\.castlink|api\.castlink/);
});
test('invalid profile, network and release fail before any action', () => {
  for (const patch of [{profile:'../other'},{network:'tunnel'},{release:'latest'},{release:''},{root:'/'},{root:'relative'}]) {
    assert.throws(() => createPlan({...remote,...patch},ubuntu), /profile|network|release|root/i);
  }
});
test('invalid SSH host, username and port cannot become shell commands', () => {
  for (const patch of [{host:'vps;whoami'},{host:'-oProxyCommand=x'},{user:'root;echo hi'},{port:0},{port:65536}]) {
    assert.throws(() => createPlan({...remote,target:{...remote.target,...patch}},ubuntu), /host|user|port/i);
  }
});
test('internet needs a plain own domain; public IP alone does not satisfy TLS', () => {
  for (const domain of [undefined, 'https://studio.example.org','1.2.3.4','localhost','studio.example.org/path']) {
    assert.throws(() => createPlan({...remote,domain,internet:{...remote.internet,domain}},ubuntu), /domain/i);
  }
});
test('unsupported platforms, architectures and VPS OS versions are blockers', () => {
  for (const facts of [{...windows,arch:'arm64'},{...windows,platform:'linux'},{...windows,arch:'ia32'}]) {
    assert.ok(createPlan(local,facts).blockers.length > 0);
  }
  assert.ok(createPlan(remote,{...ubuntu,osVersion:'20.04'}).blockers.length > 0);
});
test('existing installation is a blocker; dry-run must not overwrite it', () => {
  assert.match(createPlan(local,{...windows,existingInstallationId:'foreign'}).blockers.join(' '), /existing/i);
});

test('optional domain cannot store objects or unused network configuration',()=>{
 for(const domain of [{unexpected:'fixture'},'studio.example.org'])assert.throws(()=>createPlan({...local,domain},windows),/domain/i);
});
