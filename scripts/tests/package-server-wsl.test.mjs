import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assembleWslPackage} from '../package-server-wsl.mjs';

const commit='a'.repeat(40),version='1.0.0-rc.8';
const hash=b=>createHash('sha256').update(b).digest('hex');
async function fixture(){
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-wsl-package-'));
 const root=path.join(dir,'source'),tree=path.join(dir,'tree');
 for(const name of ['scripts','distribution'])await fs.mkdir(path.join(root,name),{recursive:true});
 await fs.writeFile(path.join(root,'scripts/install-server-windows.ps1'),[
  "# template fixture", "'@CASTLINK_WSL_RELEASE_TAG@'", "'@CASTLINK_WSL_ROOTFS_SHA256@'",
  "'@CASTLINK_WSL_MANIFEST_SHA256@'", "'@CASTLINK_WSL_REPOSITORY@'"
 ].join('\n'));
 for(const name of ['LICENSE','THIRD_PARTY_NOTICES'])await fs.writeFile(path.join(root,name),'fixture legal notice');
 for(const name of ['usr/lib/systemd/systemd','usr/lib/x86_64-linux-gnu/security/pam_systemd.so','usr/lib/systemd/user/dbus.socket','usr/local/bin/node','usr/local/bin/caddy','usr/local/bin/livekit-server','usr/local/bin/castlink-server','opt/castlink/app/apps/web/server.js']){
  await fs.mkdir(path.dirname(path.join(tree,name)),{recursive:true});await fs.writeFile(path.join(tree,name),'fixture executable');
 }
 await fs.mkdir(path.join(tree,'etc'),{recursive:true});
 await fs.writeFile(path.join(tree,'etc/wsl.conf'),'[boot]\nsystemd=true\n[automount]\nenabled=false\n[interop]\nenabled=false\n');
 await fs.writeFile(path.join(tree,'etc/machine-id'),'');
 await fs.writeFile(path.join(tree,'opt/castlink/release.json'),JSON.stringify({schemaVersion:1,version,commit,buildId:version+'-'+commit.slice(0,12)}));
 const rootfs=path.join(dir,'rootfs.tar.gz');
 const pack=()=>execFileSync('tar',['-czf',rootfs,'-C',tree,'.']);pack();
 const sources=path.join(dir,'sources.tar.gz');
 await fs.writeFile(sources,'corresponding source archive fixture');
 const inventory=path.join(dir,'packages.tsv');await fs.writeFile(inventory,'base-files\t13ubuntu10.3\n');
 await fs.writeFile(path.join(tree,'opt/castlink/packages.tsv'),await fs.readFile(inventory));pack();
 const sourceDir=path.join(dir,'source-archive');await fs.mkdir(sourceDir);
 const sourceBytes=Buffer.from('corresponding source fixture');
 const dsc='Source: base-files\nVersion: 13ubuntu10.3\nChecksums-Sha256:\n '+hash(sourceBytes)+' '+sourceBytes.length+' base-files.tar.gz\n';
 await fs.writeFile(path.join(sourceDir,'base-files.tar.gz'),sourceBytes);
 await fs.writeFile(path.join(sourceDir,'base-files.dsc'),dsc);
 await fs.writeFile(path.join(sourceDir,'sources.json'),JSON.stringify({schemaVersion:1,packages:[{name:'base-files',version:'13ubuntu10.3'}],files:{'base-files.dsc':{sha256:hash(dsc),size:Buffer.byteLength(dsc)},'base-files.tar.gz':{sha256:hash(sourceBytes),size:sourceBytes.length}}}));
 execFileSync('tar',['-czf',sources,'-C',sourceDir,'.']);
 const upstreamDir=path.join(dir,'upstream');await fs.mkdir(upstreamDir);
 const upstreamData='upstream fixture source',upstreamManifest={schemaVersion:1,files:[{path:'component.txt',sha256:hash(upstreamData),size:Buffer.byteLength(upstreamData),component:'fixture'}]};
 await fs.writeFile(path.join(root,'distribution/third-party-sources.json'),JSON.stringify(upstreamManifest));
 await fs.writeFile(path.join(upstreamDir,'source-manifest.json'),JSON.stringify(upstreamManifest));await fs.writeFile(path.join(upstreamDir,'component.txt'),upstreamData);
 const upstreamSources=path.join(dir,'upstream.tar.gz');execFileSync('tar',['-czf',upstreamSources,'-C',upstreamDir,'.']);
 return {dir,root,tree,rootfs,sources,upstreamSources,inventory,pack,output:path.join(dir,'output'),commit,version};
}
test('WSL artifacts pin one release, source and actual bytes without publishing',async()=>{
 const f=await fixture();try{
  const m=await assembleWslPackage(f);
  assert.equal(m.channel,'server-wsl');assert.equal(m.releaseTag,'server-wsl-v'+version+'-'+commit.slice(0,12));
  assert.equal(m.sourceCommit,commit);assert.equal(m.architecture,'amd64');
  const rootfsBytes=await fs.readFile(f.rootfs);
  assert.equal(m.rootfs.sha256,hash(rootfsBytes));assert.equal(m.rootfs.size,rootfsBytes.length);
  assert.deepEqual(await fs.readFile(path.join(f.output,m.rootfs.file)),rootfsBytes);
  const manifestBytes=await fs.readFile(path.join(f.output,'manifest.json'));
  const ps=(await fs.readFile(path.join(f.output,'install-server-windows.ps1'))).toString('utf8');
  assert.ok(ps.startsWith('\ufeff'));assert.ok(ps.includes(m.releaseTag));assert.ok(ps.includes(hash(manifestBytes)));
  assert.ok(ps.includes(m.rootfs.sha256));assert.ok(ps.includes(m.repository));assert.ok(!ps.includes('@CASTLINK_'));
  assert.equal(m.sources.sha256,hash(await fs.readFile(f.sources)));
  assert.equal(m.upstreamSources.sha256,hash(await fs.readFile(f.upstreamSources)));
  assert.deepEqual(await fs.readFile(path.join(f.output,m.upstreamSources.file)),await fs.readFile(f.upstreamSources));
  const sums=(await fs.readFile(path.join(f.output,'SHA256SUMS'),'utf8')).trim().split('\n');
  for(const row of sums){const [digest,name]=row.split('  ');assert.equal(hash(await fs.readFile(path.join(f.output,name))),digest,name);}
  assert.ok(sums.some(x=>x.endsWith('  install-server-windows.ps1')));
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
test('refuses a source archive or package inventory unrelated to the rootfs',async()=>{
 const f=await fixture();try{
  await fs.writeFile(f.inventory,'unrelated\t1.0\n');
  await assert.rejects(assembleWslPackage(f),/inventory|source/i);
  await fs.writeFile(f.inventory,'base-files\t13ubuntu10.3\n');
  await fs.writeFile(f.sources,'invalid source tar');
  await assert.rejects(assembleWslPackage(f),/source|archive|gzip/i);
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
test('refuses descriptors without their referenced corresponding sources',async()=>{
 const f=await fixture();try{
  const sourceDir=path.join(f.dir,'source-archive');
  await fs.rm(path.join(sourceDir,'base-files.tar.gz'));
  const file=path.join(sourceDir,'sources.json'),m=JSON.parse(await fs.readFile(file,'utf8'));
  delete m.files['base-files.tar.gz'];await fs.writeFile(file,JSON.stringify(m));
  execFileSync('tar',['-czf',f.sources,'-C',sourceDir,'.']);
  await assert.rejects(assembleWslPackage(f),/source|descriptor|checksum/i);
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
test('refuses missing corresponding sources and wrong embedded version before output',async()=>{
 const f=await fixture();try{
  await assert.rejects(assembleWslPackage({...f,sources:undefined}),/source/i);
  await assert.rejects(assembleWslPackage({...f,upstreamSources:undefined}),/source/i);
  await fs.writeFile(path.join(f.tree,'opt/castlink/release.json'),JSON.stringify({version,commit:'b'.repeat(40)}));f.pack();
  await assert.rejects(assembleWslPackage(f),/release|version|commit/i);
  await assert.rejects(fs.stat(f.output),{code:'ENOENT'});
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
test('refuses runtime with Docker, prepared installation secrets or missing systemd',async()=>{
 const f=await fixture();try{
  for(const forbidden of ['usr/bin/docker','var/lib/castlink-server/state.json','etc/ssh/ssh_host_rsa_key']){
   await fs.mkdir(path.dirname(path.join(f.tree,forbidden)),{recursive:true});await fs.writeFile(path.join(f.tree,forbidden),'forbidden');f.pack();
   await assert.rejects(assembleWslPackage(f),/Docker|private|secret|installation/i);
   await fs.rm(path.join(f.tree,forbidden));
  }
  await fs.rm(path.join(f.tree,'usr/lib/systemd/systemd'));f.pack();
  await assert.rejects(assembleWslPackage(f),/systemd|runtime/i);
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
test('refuses a WSL rootfs missing systemd user-session prerequisites',async()=>{
 for(const missing of ['usr/lib/x86_64-linux-gnu/security/pam_systemd.so','usr/lib/systemd/user/dbus.socket']){
  const f=await fixture();try{
   await fs.rm(path.join(f.tree,missing));f.pack();
   await assert.rejects(assembleWslPackage(f),/runtime|systemd|session/i);
   await assert.rejects(fs.stat(f.output),{code:'ENOENT'});
  }finally{await fs.rm(f.dir,{recursive:true,force:true});}
 }
});
test('refuses unknown template tokens, invalid metadata and existing destination',async()=>{
 const f=await fixture();try{
  await assert.rejects(assembleWslPackage({...f,commit:'not-a-commit'}),/commit/i);
  await assert.rejects(assembleWslPackage({...f,repository:'../other'}),/repository/i);
  await fs.appendFile(path.join(f.root,'scripts/install-server-windows.ps1'),'\n@CASTLINK_UNKNOWN@');
  await assert.rejects(assembleWslPackage(f),/template|token/i);
  await fs.mkdir(f.output);await fs.writeFile(path.join(f.output,'keep.txt'),'original');
  await assert.rejects(assembleWslPackage(f),/exist|destination/i);
  assert.equal(await fs.readFile(path.join(f.output,'keep.txt'),'utf8'),'original');
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
