import {test} from 'node:test';
import assert from 'node:assert/strict';
import {fixtureDockerSelector,fixtureCapacityPaths,fixtureDockerEnvironment} from './restore-schema3-fixture.mjs';

test('PG fixture fixes Windows desktop-linux and Linux cloud socket independently of inherited endpoints',()=>{
 assert.deepEqual(fixtureDockerSelector('win32'),['--context','desktop-linux']);
 assert.deepEqual(fixtureDockerSelector('linux'),['--host=unix:///var/run/docker.sock']);
 assert.throws(()=>fixtureDockerSelector('darwin'),/unsupported/);
 const inherited={PATH:'retained',DOCKER_HOST:'tcp://foreign',DOCKER_CONTEXT:'foreign',DOCKER_TLS:'1',DOCKER_TLS_VERIFY:'1',DOCKER_CERT_PATH:'foreign'};
 assert.deepEqual(fixtureDockerEnvironment(inherited),{PATH:'retained'});assert.equal(inherited.DOCKER_HOST,'tcp://foreign');
});
test('PG capacity observes its exact D workspace on Windows and refuses other drives or relative paths',()=>{
 const workspace='D:\\CastLink proof\\repo';assert.deepEqual(fixtureCapacityPaths('win32',workspace),[workspace,workspace]);
 for(const p of ['C:\\repo','D:relative','\\\\server\\share\\repo','/tmp/repo'])assert.throws(()=>fixtureCapacityPaths('win32',p),/D drive/);
 assert.deepEqual(fixtureCapacityPaths('linux','/workspace/repo'),['/workspace/repo','/tmp']);
 assert.throws(()=>fixtureCapacityPaths('linux','relative'),/absolute/);
});
