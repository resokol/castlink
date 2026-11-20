import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';

const source = new URL('../package-updater.mjs', import.meta.url);
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const inputs = {
 'castlink-updater.py':'scripts/updater/castlink-updater.py',
 'castlink-updater.ps1':'scripts/updater/castlink-updater.ps1',
 'linux-compose-setup.py':'scripts/linux-compose-setup.py',
 'install-updater-linux.sh':'scripts/updater/install-updater-linux.sh',
 'install-updater-windows.cmd':'scripts/updater/install-updater-windows.cmd',
 'LICENSE':'LICENSE',
};
async function fixture(t) {
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-updater-package-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 for(const [name,file] of Object.entries(inputs)){
  await fs.mkdir(path.dirname(path.join(root,file)),{recursive:true});
  await fs.writeFile(path.join(root,file),`fixture ${name}\n`);
 }
 return {root,output:path.join(root,'output'),commit:'a'.repeat(40),version:'1.0.0'};
}
async function builder() {
 assert.ok(await fs.access(source).then(()=>true,()=>false),'updater packaging must be implemented');
 return (await import(source)).assembleUpdaterPackage;
}
test('package contains exact versioned tools, two platforms and checksums of all assets',async t=>{
 const f=await fixture(t), build=await builder();await build(f);
 const files=await fs.readdir(f.output);
 assert.deepEqual(files.sort(),[...Object.keys(inputs),'manifest.json','SHA256SUMS'].sort());
 const m=JSON.parse(await fs.readFile(path.join(f.output,'manifest.json'),'utf8'));
 assert.equal(m.schemaVersion,1);assert.equal(m.protocolVersion,1);
 assert.equal(m.channel,'updater');assert.equal(m.repository,'resokol/castlink');
 assert.equal(m.sourceCommit,f.commit);assert.equal(m.version,'1.0.0');
 assert.equal(m.releaseTag,'updater-v1.0.0-aaaaaaaaaaaa');
 assert.deepEqual(Object.keys(m.platforms).sort(),['linux','windows']);
 assert.equal(m.platforms.linux.entry,'castlink-updater.py');
 assert.equal(m.platforms.windows.entry,'castlink-updater.ps1');
 assert.deepEqual(m.platforms.linux.files.map(x=>x.file).sort(),['castlink-updater.py','linux-compose-setup.py']);
 assert.deepEqual(m.platforms.windows.files.map(x=>x.file),['castlink-updater.ps1']);
 for(const p of Object.values(m.platforms))for(const e of p.files){
  const b=await fs.readFile(path.join(f.output,e.file));
  assert.equal(e.sha256,hash(b));assert.equal(e.size,b.length);
 }
 const sums=(await fs.readFile(path.join(f.output,'SHA256SUMS'),'utf8')).trimEnd().split('\n');
 assert.equal(sums.length,files.length-1);
 for(const line of sums){const [h,name]=line.split('  ');assert.equal(h,hash(await fs.readFile(path.join(f.output,name))));}
 for(const [name,file] of Object.entries(inputs))assert.deepEqual(await fs.readFile(path.join(f.output,name)),await fs.readFile(path.join(f.root,file)));
 await assert.rejects(build(f),/exist/i);
});
test('missing, linked, empty and excessive tool files cannot produce a release',async t=>{
 const build=await builder();
 for(const kind of ['missing','link','empty','large']){
  const f=await fixture(t),p=path.join(f.root,inputs['castlink-updater.py']);await fs.unlink(p);
  if(kind==='link')await fs.symlink(path.join(f.root,'LICENSE'),p);
  if(kind==='empty')await fs.writeFile(p,'');
  if(kind==='large')await fs.writeFile(p,Buffer.alloc(4*1024*1024+1,65));
  await assert.rejects(build(f));
  assert.equal(await fs.access(f.output).then(()=>true,()=>false),false);
 }
});
test('only stable canonical versions and full source SHAs are packaged',async t=>{
 const build=await builder();
 for(const patch of [{version:'1.0.0-rc.1'},{version:'01.0.0'},{commit:'a'.repeat(12)},{commit:'main'}]){
  const f=await fixture(t);await assert.rejects(build({...f,...patch}));
  assert.equal(await fs.access(f.output).then(()=>true,()=>false),false);
 }
});
test('release verifier rejects corrupted bytes and rewritten provenance even with fresh checksums',async t=>{
 const f=await fixture(t),build=await builder();await build(f);
 const {verifyUpdaterPackage}=await import(source);
 const options={directory:f.output,commit:f.commit,version:f.version};
 assert.equal((await verifyUpdaterPackage(options)).assets.length,8);
 const tool=path.join(f.output,'castlink-updater.py'),original=await fs.readFile(tool);
 await fs.appendFile(tool,'changed');await assert.rejects(verifyUpdaterPackage(options),/hash|checksums/i);
 await fs.writeFile(tool,original);
 const manifest=path.join(f.output,'manifest.json'),m=JSON.parse(await fs.readFile(manifest,'utf8'));m.sourceCommit='b'.repeat(40);await fs.writeFile(manifest,JSON.stringify(m));
 await assert.rejects(verifyUpdaterPackage(options),/identity/i);
});
