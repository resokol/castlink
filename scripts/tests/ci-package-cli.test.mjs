import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source = new URL('../ci-package-cli.mjs', import.meta.url);
async function api() { assert.ok(existsSync(source), 'developer CI driver is missing'); return import(source); }
test('Windows SystemRoot copied environment lookup preserves casing-independent absolute root', async () => {
 const {invokeLauncher}=await api();
 for (const key of ['SYSTEMROOT','SystemRoot','systemroot','SyStEmRoOt']) {
  const env={[key]:'E:\\Windows',PATH:'E:\\Windows\\System32'};
  let called;
  invokeLauncher('win32-x64','D:\\Пакет с пробелами 日本\\bin\\castlink.cmd','D:\\cwd',env,(...args)=>{called=args;return {status:0};});
  assert.equal(called[0],'E:\\Windows\\System32\\cmd.exe');
  assert.equal(called[2].env,env);
  assert.equal(called[2].windowsVerbatimArguments,true);
  assert.equal(called[2].shell,false);
 }
});
test('Windows SystemRoot missing relative malformed and ambiguous roots fail before spawn', async () => {
 const {invokeLauncher}=await api();
 for (const env of [{},{SYSTEMROOT:''},{SYSTEMROOT:'Windows'},{SYSTEMROOT:'E:Windows'},{SYSTEMROOT:'\\Windows'},{SYSTEMROOT:'E:\\Windows\n'},{SYSTEMROOT:42},{SYSTEMROOT:'E:\\Windows',SystemRoot:'C:\\Windows'}]) {
  let calls=0;
  assert.throws(()=>invokeLauncher('win32-x64','D:\\package\\bin\\castlink.cmd','D:\\cwd',env,()=>{calls++;return {status:0};}),/Windows SystemRoot must be one unambiguous fully qualified absolute path/);
  assert.equal(calls,0);
 }
});
test('Windows launcher invocation preserves prequoted cmd command without CRT escaping', async () => {
 const {invokeLauncher}=await api();
 assert.equal(typeof invokeLauncher,'function');
 const launcher='D:\\Пакет с пробелами 日本\\castlink-0.1.0-dev-win32-x64\\bin\\castlink.cmd';
 const cwd='D:\\Внешний cwd 日本',env={SystemRoot:'C:\\Windows',PATH:'C:\\Windows\\System32'};
 let call;
 const result={status:4,stderr:'integrity',stdout:''};
 assert.equal(invokeLauncher('win32-x64',launcher,cwd,env,(...args)=>{call=args;return result;}),result);
 assert.equal(call[0],'C:\\Windows\\System32\\cmd.exe');
 assert.deepEqual(call[1],['/d','/s','/c',`""${launcher}" --help"`]);
 assert.deepEqual(call[2],{cwd,env,shell:false,windowsVerbatimArguments:true,encoding:'utf8',timeout:30000});
});
test('Darwin launcher invocation keeps direct argv and default Unix escaping', async () => {
 const {invokeLauncher}=await api();
 assert.equal(typeof invokeLauncher,'function');
 const launcher='/tmp/Пакет с пробелами 日本/bin/castlink',cwd='/tmp/Внешний cwd 日本',env={PATH:'/usr/bin:/bin'};
 let call;
 invokeLauncher('darwin-arm64',launcher,cwd,env,(...args)=>{call=args;return {status:0};});
 assert.equal(call[0],launcher);assert.deepEqual(call[1],['--help']);
 assert.deepEqual(call[2],{cwd,env,shell:false,encoding:'utf8',timeout:30000});
});
test('CI driver rejects a mismatched native runner and non-pinned build Node', async () => {
 const {assertNative} = await api();
 for (const [target, platform, arch] of [['win32-x64','win32','x64'],['darwin-arm64','darwin','arm64'],['darwin-x64','darwin','x64']]) {
  assert.doesNotThrow(() => assertNative(target,{platform,arch,version:'v22.23.3'}));
  assert.throws(() => assertNative(target,{platform:'linux',arch,version:'v22.23.3'}), /matching native runner/);
  assert.throws(() => assertNative(target,{platform,arch,version:'v24.0.0'}), /22.23.3/);
 }
 assert.throws(() => assertNative('darwin-arm64',{platform:'darwin',arch:'x64',version:'v22.23.3'}), /matching native runner/);
 assert.throws(() => assertNative('linux-x64'), /Unsupported target/);
});
test('upstream checksum listing must match the checked runtime pin, uniquely', async () => {
 const {verifyUpstreamChecksum} = await api();
 const {RUNTIMES} = await import('../package-cli.mjs');
 for (const [target,r] of Object.entries(RUNTIMES)) {
  const line=`${r.sha256}  ${r.artifact}\n`;
  assert.doesNotThrow(() => verifyUpstreamChecksum(line,target));
  assert.throws(() => verifyUpstreamChecksum(`${'0'.repeat(64)}  ${r.artifact}\n`,target), /upstream checksum/);
  assert.throws(() => verifyUpstreamChecksum(line+line,target), /upstream checksum/);
  assert.throws(() => verifyUpstreamChecksum('',target), /upstream checksum/);
 }
});
test('archive smoke verifies companion checksum before extracting any payload', async () => {
 const {verifyArchiveChecksum} = await api();
 const base=await mkdtemp(path.join(tmpdir(),'castlink-ci-checksum-')),archive=path.join(base,'package.zip');
 await writeFile(archive,'archive fixture');
 const digest=createHash('sha256').update('archive fixture').digest('hex');
 await writeFile(archive+'.sha256',`${digest}  package.zip\n`);
 assert.equal(await verifyArchiveChecksum(archive),digest);
 await writeFile(archive,'tamper');
 await assert.rejects(verifyArchiveChecksum(archive), /archive checksum/);
 await writeFile(archive+'.sha256',`${digest}  other.zip\n`);
 await assert.rejects(verifyArchiveChecksum(archive), /archive checksum/);
});
test('CI fixture is conspicuously non-installable, versioned and credential-free', async () => {
 const fixture=JSON.parse(await readFile(new URL('../fixtures/ci-server-manifest.json',import.meta.url),'utf8'));
 assert.equal(fixture.release,'0.0.0-dev-ci-fixture-NOT-INSTALLABLE');
 assert.equal(fixture.nodeVersion,'22.23.3');
 assert.deepEqual(fixture.architectures,['amd64','arm64']);
 for (const [name,image] of Object.entries(fixture.images)) {
  assert.equal(image.reference,`example.invalid/development-not-installable/${name}@sha256:${'0'.repeat(64)}`);
  assert.deepEqual(image.architectures,fixture.architectures);
 }
});
test('packaging CI fixture keeps non-installable release visible and original Node notices', async () => {
 const {packageCli,RUNTIMES,verifyPackage}=await import('../package-cli.mjs');
 const base=await mkdtemp(path.join(tmpdir(),'castlink-ci-layout-'));
 const {mkdir}=await import('node:fs/promises');
 const dist=path.join(base,'dist');await mkdir(dist);
 await writeFile(path.join(dist,'main.js'),"console.log('CastLink help fixture');\n");
 const result=await packageCli({development:true,target:'win32-x64',dist,serverManifest:fileURLToPath(new URL('../fixtures/ci-server-manifest.json',import.meta.url)),runtimeArchive:`/tmp/castlink-${RUNTIMES['win32-x64'].artifact}`,output:path.join(base,'output')});
 const metadata=JSON.parse(await readFile(path.join(result.root,'cli-release.json'),'utf8'));
 assert.equal(metadata.server.release,'0.0.0-dev-ci-fixture-NOT-INSTALLABLE');
 assert.equal(metadata.distribution,'development-only');
 assert.equal(metadata.platformAcceptance,'unverified');
 assert.equal(metadata.projectLicense,'MIT');
 assert.equal(await readFile(path.join(result.root,'LICENSE'),'utf8'),await readFile(new URL('../../LICENSE',import.meta.url),'utf8'));
 assert.equal(JSON.parse(await readFile(path.join(result.root,'cli/package.json'),'utf8')).license,'MIT');
 const development=await readFile(path.join(result.root,'DEVELOPMENT.txt'),'utf8');
 assert.match(development,/0.0.0-dev-ci-fixture-NOT-INSTALLABLE/);
 assert.match(development,/Manifest-only; image availability and installability are unverified/);
 const notices=await readFile(path.join(result.root,'THIRD_PARTY_NOTICES'),'utf8');
 assert.match(notices,/runtime\/LICENSE/);
 assert.match(notices,/Docker Desktop is not included/);
 assert.equal(createHash('sha256').update(await readFile(path.join(result.root,'runtime/LICENSE'))).digest('hex'),'8cc9bb466b19fc7e7cc99d03e9df1132021fda8b01eea2624c58bb372dbef576');
 assert.equal(await verifyPackage(result.root),true);
});
test('workflow is read-only, private-artifact-only with exact native runner matrix', async () => {
 const workflow=new URL('../../.github/workflows/build-cli.yml',import.meta.url);
 assert.ok(existsSync(workflow),'manual developer workflow is missing');
 const result=spawnSync('python3',['-c',"import json,sys,yaml; print(json.dumps(yaml.load(open(sys.argv[1]),Loader=yaml.BaseLoader)))",workflow.pathname],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const value=JSON.parse(result.stdout);
 assert.deepEqual(Object.keys(value.on),['workflow_dispatch','push']);
 assert.deepEqual(value.permissions,{contents:'read'});
 const job=value.jobs['development-package'];
 assert.equal(job.if,"${{ github.event.repository.private }}");
 assert.deepEqual(job.strategy.matrix.include,[{target:'win32-x64',runner:'windows-2025'},{target:'darwin-arm64',runner:'macos-15'},{target:'darwin-x64',runner:'macos-15-intel'}]);
 const node=job.steps.find(step=>step.uses?.startsWith('actions/setup-node@'));
 assert.equal(node.with['node-version'],'22.23.3');
 const text=await readFile(workflow,'utf8');
 assert.doesNotMatch(text,/secrets\.|gh release|packages: write|contents: write|pull_request|persist-credentials: true/);
 assert.match(text,/persist-credentials: false/);
 assert.match(text,/if-no-files-found: error/);
 assert.match(text,/ci-package-cli.mjs/);
});
test('packaging push trigger bounds native CI by branch paths privacy and concurrency', async () => {
 const workflow=new URL('../../.github/workflows/build-cli.yml',import.meta.url);
 const result=spawnSync('python3',['-c',"import json,sys,yaml; print(json.dumps(yaml.load(open(sys.argv[1]),Loader=yaml.BaseLoader)))",fileURLToPath(workflow)],{encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);
 const value=JSON.parse(result.stdout);
 assert.deepEqual(Object.keys(value.on),['workflow_dispatch','push']);
 assert.deepEqual(value.on.push.branches,['feat/self-hosted-cli-github']);
 assert.deepEqual(value.on.push.paths,[
  '.github/workflows/build-cli.yml',
  'scripts/package-cli.mjs',
  'scripts/package-cli-archive.py',
  'scripts/ci-package-cli.mjs',
  'scripts/tests/package-cli.test.mjs',
  'scripts/tests/ci-package-cli.test.mjs',
  'scripts/fixtures/ci-server-manifest.json',
  'infrastructure/self-hosted/cli-release.schema.json',
  'infrastructure/self-hosted/release.schema.json',
 ]);
 assert.deepEqual(value.concurrency,{group:'${{ github.workflow }}-${{ github.ref }}','cancel-in-progress':'true'});
 assert.deepEqual(value.permissions,{contents:'read'});
 const job=value.jobs['development-package'];
 assert.equal(job.if,'${{ github.event.repository.private }}');
 assert.equal(job['timeout-minutes'],'25');
 const upload=job.steps.find(step=>step.uses?.startsWith('actions/upload-artifact@'));
 assert.equal(upload.with['retention-days'],'7');
 assert.equal(upload.with['if-no-files-found'],'error');
});
