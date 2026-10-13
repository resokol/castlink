import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, mkdir, writeFile, readFile, readdir, copyFile, chmod, symlink, access, unlink} from 'node:fs/promises';
import {existsSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
const source = new URL('../package-cli.mjs', import.meta.url);
const runtimeHash = target => ({'win32-x64':'2b0ff57b049cda1bbcea2240eec20467018713c1efe1f7360c2681859b90ed71','darwin-arm64':'23b25245dcfb9af7262f8ff142e9e2e0af025368117329e7a7458a51e5922f53','darwin-x64':'8a677b0219178efd6eb0e475457c4afb452b521a92f6e67845a73bd85727f2a8'})[target];
const hash = b => createHash('sha256').update(b).digest('hex');
async function api() { assert.ok(existsSync(source), 'offline package implementation is missing'); return import(source); }
async function fixture() {
 const base=await mkdtemp(path.join(tmpdir(),'castlink-package-test-'));
 const dist=path.join(base,'dist');await mkdir(dist);
 await writeFile(path.join(dist,'main.js'),"import './other.js'; console.log('help');\n");
 await writeFile(path.join(dist,'other.js'),'export const value=1;\n');
 const cliPackage=path.join(base,'package.json');await writeFile(cliPackage,JSON.stringify({version:'0.1.0-dev',type:'module',private:true}));
 const serverManifest=path.join(base,'release.json');
 const server={schemaVersion:1,release:'1.2.3',nodeVersion:'22.23.3',architectures:['amd64','arm64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(x=>[x,{reference:`example/${x}@sha256:${'a'.repeat(64)}`,architectures:['amd64','arm64']}]))};
 await writeFile(serverManifest,JSON.stringify(server));
 return {base,dist,cliPackage,serverManifest,server,output:path.join(base,'output'),development:true};
}
test('development mode is explicit and a bad runtime checksum writes no output',async()=>{
 const {packageCli}=await api(), f=await fixture(); const runtimeArchive=path.join(f.base,'bad.zip'); await writeFile(runtimeArchive,'bad');
 await assert.rejects(packageCli({...f,target:'win32-x64',runtimeArchive,development:false}),/development/i);
 await assert.rejects(packageCli({...f,target:'win32-x64',runtimeArchive}),/checksum/i);
 assert.equal(existsSync(f.output),false);
});
test('all pinned upstream targets produce versioned development archives and complete ESM inventories',async()=>{
 const {packageCli,verifyPackage,RUNTIMES}=await api();
 for(const target of Object.keys(RUNTIMES)){
  const f=await fixture(), runtimeArchive=`/tmp/castlink-${RUNTIMES[target].artifact}`;
  assert.ok(existsSync(runtimeArchive),'cached checksum-verified archive required for this layout proof');
  const r=await packageCli({...f,target,runtimeArchive});
  const metadata=JSON.parse(await readFile(path.join(r.root,'cli-release.json'),'utf8'));
  assert.equal(metadata.distribution,'development-only');assert.equal(metadata.projectLicense,'missing');assert.equal(metadata.signing,'unverified');
  assert.equal(metadata.runtime.sha256,RUNTIMES[target].sha256);assert.equal(metadata.server.release,'1.2.3');
  assert.equal(JSON.parse(await readFile(path.join(r.root,'cli/package.json'),'utf8')).type,'module');
  assert.equal(await readFile(path.join(r.root,'cli/other.js'),'utf8'),'export const value=1;\n');
  const license=await readFile(path.join(r.root,'runtime/LICENSE'));assert.ok(license.length>140000);assert.equal(hash(license),target==='win32-x64'?'8cc9bb466b19fc7e7cc99d03e9df1132021fda8b01eea2624c58bb372dbef576':'c738ae413cf561f174e34f6961f8ca458aae2369a73640dda6234c629b98bcc4');
  await verifyPackage(r.root);assert.equal(hash(await readFile(r.archive)),r.archiveSha256);
  const schema=JSON.parse(await readFile(new URL('../../infrastructure/self-hosted/cli-release.schema.json',import.meta.url),'utf8'));assert.deepEqual(Object.keys(metadata).sort(),schema.required.slice().sort());assert.equal(schema.allOf.find(rule=>rule.if.properties.target.const===target).then.properties.runtime.properties.sha256.const,runtimeHash(target));
  const inventory=spawnSync('python3',['-c',`import sys,zipfile,tarfile,json; p=sys.argv[1]; print(json.dumps(zipfile.ZipFile(p).namelist() if p.endswith('.zip') else tarfile.open(p).getnames()))`,r.archive],{encoding:'utf8'});
  assert.equal(inventory.status,0,inventory.stderr);const names=JSON.parse(inventory.stdout);
  assert.ok(names.includes(`${path.basename(r.root)}/cli/main.js`));assert.ok(names.every(n=>n.startsWith(path.basename(r.root)+'/')));
  assert.ok(!names.some(n=>/node_modules|\.env|\.git|\/npm/.test(n)));
  await assert.rejects(packageCli({...f,target,runtimeArchive}),/exists|overwrite/i);
  if(target==='win32-x64'){const again=await packageCli({...f,target,runtimeArchive,output:path.join(f.base,'second-output')});assert.equal(again.archiveSha256,r.archiveSha256,'identical inputs produce deterministic archive bytes');const cmd=await readFile(path.join(r.root,'bin/castlink.cmd'),'utf8');assert.match(cmd,/setlocal DisableDelayedExpansion/);for(const name of ['NODE_OPTIONS','NODE_PATH','NODE_REPL_EXTERNAL_MODULE','NODE_EXTRA_CA_CERTS','NODE_ICU_DATA','NODE_COMPILE_CACHE','NODE_V8_COVERAGE','NODE_REDIRECT_WARNINGS','OPENSSL_CONF','OPENSSL_MODULES','LD_PRELOAD','LD_LIBRARY_PATH','DYLD_INSERT_LIBRARIES','DYLD_LIBRARY_PATH','DYLD_FRAMEWORK_PATH']){assert.ok(cmd.indexOf(`set "${name}="`)>0);assert.ok(cmd.indexOf(`set "${name}="`)<cmd.indexOf('certutil.exe'));}assert.match(cmd,/%~dp0\.\.\\runtime\\node.exe/);assert.ok(cmd.indexOf('certutil.exe')<cmd.indexOf('integrity.mjs" %*'));}
  for(const entry of ['cli/main.js','server/release.json','cli-release.json','integrity.mjs',target==='win32-x64'?'runtime/node.exe':'runtime/bin/node']){
   const p=path.join(r.root,entry),before=await readFile(p);await writeFile(p,'tamper');await assert.rejects(verifyPackage(r.root),/integrity|checksum/i);await writeFile(p,before);
  }
 }
});
test('unsafe dist content, server fields and output ancestors fail before output',async()=>{
 const {packageCli}=await api(), f=await fixture(); const runtimeArchive='/tmp/castlink-node-v22.23.3-darwin-arm64.tar.gz';
 await writeFile(path.join(f.dist,'.env'),'secret');await assert.rejects(packageCli({...f,target:'darwin-arm64',runtimeArchive}),/dist|unsupported/i);assert.equal(existsSync(f.output),false);
 const g=await fixture();g.server.extra=true;await writeFile(g.serverManifest,JSON.stringify(g.server));await assert.rejects(packageCli({...g,target:'darwin-arm64',runtimeArchive}),/schema|fields/i);
 const h=await fixture();await symlink(h.dist,path.join(h.base,'link'));await assert.rejects(packageCli({...h,dist:path.join(h.base,'link'),target:'darwin-arm64',runtimeArchive}),/symlink/i);
 const i=await fixture();await symlink(i.base,path.join(i.base,'parent'));await assert.rejects(packageCli({...i,output:path.join(i.base,'parent','new'),target:'darwin-arm64',runtimeArchive}),/symlink/i);
});
test('Linux fixture launcher uses bundled runtime outside cwd without global Node, forwards argv/stdin/exit and blocks tampering',async()=>{
 const {writeLaunchers,buildBootstrap}=await api(),f=await fixture(); const root=path.join(f.base,'Spaces Кириллица 日本');
 await mkdir(path.join(root,'runtime/bin'),{recursive:true});await mkdir(path.join(root,'cli'));await mkdir(path.join(root,'bin'));
 await copyFile(process.execPath,path.join(root,'runtime/bin/node'));await chmod(path.join(root,'runtime/bin/node'),0o755);
 await writeFile(path.join(root,'cli/package.json'),' {"type":"module"}');
 await writeFile(path.join(root,'cli/main.js'),`import fs from 'node:fs'; console.log(JSON.stringify({args:process.argv.slice(2),input:fs.readFileSync(0,'utf8'),cwd:process.cwd(),startup:{options:process.env.NODE_OPTIONS??null,path:process.env.NODE_PATH??null}}));process.exit(7);`);
 const records={};for(const n of ['cli/main.js','cli/package.json'])records[n]=hash(await readFile(path.join(root,n)));
 const bootstrap=buildBootstrap(records);await writeFile(path.join(root,'integrity.mjs'),bootstrap);
 await writeLaunchers(root,'darwin-arm64',{runtime:hash(await readFile(path.join(root,'runtime/bin/node'))),bootstrap:hash(await readFile(path.join(root,'integrity.mjs')))});
 const launcher=path.join(root,'bin/castlink'),run=()=>spawnSync(launcher,['arg with spaces','!$&日本'],{cwd:f.base,env:{PATH:'/usr/bin:/bin',NODE_OPTIONS:'--castlink-benign-invalid-startup-option',NODE_PATH:'/nonexistent/castlink-benign-node-path'},input:'stdin test',encoding:'utf8'});
 const r=run();assert.equal(r.status,7,r.stderr);assert.deepEqual(JSON.parse(r.stdout),{args:['arg with spaces','!$&日本'],input:'stdin test',cwd:f.base,startup:{options:null,path:null}});
 await writeFile(path.join(root,'cli/main.js'),"console.log('BAD PAYLOAD')");const bad=run();assert.notEqual(bad.status,0);assert.ok(!bad.stdout.includes('BAD PAYLOAD'));assert.match(bad.stderr,/integrity/i);
 await writeFile(path.join(root,'integrity.mjs'),"console.log('BAD BOOTSTRAP')");const bootstrapBad=run();assert.notEqual(bootstrapBad.status,0);assert.ok(!bootstrapBad.stdout.includes('BAD BOOTSTRAP'));await writeFile(path.join(root,'integrity.mjs'),bootstrap);
 await unlink(path.join(root,'runtime/bin/node'));await writeFile(path.join(root,'runtime/bin/node'),'#!/bin/sh\necho BAD RUNTIME\n');await chmod(path.join(root,'runtime/bin/node'),0o755);const runtimeBad=run();assert.notEqual(runtimeBad.status,0);assert.ok(!runtimeBad.stdout.includes('BAD RUNTIME'));
});
test('duplicate escaped schema keys are refused before archive/output work',async()=>{
 const {packageCli}=await api(),f=await fixture();
 await writeFile(f.serverManifest,JSON.stringify(f.server).replace('"schemaVersion":1','"schemaVersion":0,"schema\\u0056ersion":1'));
 await assert.rejects(packageCli({...f,target:'darwin-arm64',runtimeArchive:'/tmp/castlink-node-v22.23.3-darwin-arm64.tar.gz'}),/duplicate/i);
 assert.equal(existsSync(f.output),false);
});
test('developer archive interpreter uses Windows py -3 and Unix python3 with fixed argv prefixes',async()=>{
 const {archiveInterpreter}=await api();assert.equal(typeof archiveInterpreter,'function','platform-specific developer interpreter selector is missing');
 assert.deepEqual(archiveInterpreter('win32'),{command:'py',args:['-3']});
 for(const platform of ['linux','darwin'])assert.deepEqual(archiveInterpreter(platform),{command:'python3',args:[]});
});
