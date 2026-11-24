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
 for(const name of ['usr/lib/systemd/systemd','usr/lib/x86_64-linux-gnu/security/pam_systemd.so','usr/lib/systemd/user/dbus.socket','usr/local/bin/node','usr/local/bin/caddy','usr/local/bin/livekit-server','usr/local/bin/castlink-server','usr/local/bin/castlink-server-maintenance','opt/castlink/app/apps/web/server.js']){
  await fs.mkdir(path.dirname(path.join(tree,name)),{recursive:true});await fs.writeFile(path.join(tree,name),'fixture executable');
 }
 await fs.mkdir(path.join(tree,'etc'),{recursive:true});
 await fs.writeFile(path.join(tree,'etc/wsl.conf'),'[boot]\nsystemd=true\n[automount]\nenabled=false\n[interop]\nenabled=false\n');
 await fs.writeFile(path.join(tree,'etc/machine-id'),'');
 // Use the actual rootfs metadata printf format so Docker/package contract drift fails packaging.
 const dockerfile=await fs.readFile(new URL('../../infrastructure/server-wsl/Dockerfile',import.meta.url),'utf8');
 const releaseFormat=dockerfile.match(/&& printf '(\{"schemaVersion":1,"version"[^']+)' \\/)?.[1];
 assert.ok(releaseFormat,'Rootfs release metadata format is required');
 const releaseValues=[version,commit,version,commit.slice(0,12)];
 await fs.writeFile(path.join(tree,'opt/castlink/release.json'),releaseFormat.replace(/%s/g,()=>releaseValues.shift()).replace(/\\n/g,'\n'));
 await fs.mkdir(path.join(tree,'usr/local/lib'),{recursive:true});
 const rootfs=path.join(dir,'rootfs.tar.gz');
 const pack=()=>execFileSync('tar',['-czf',rootfs,'-C',tree,'.']);pack();
 const sources=path.join(dir,'sources.tar.gz');
 await fs.writeFile(sources,'corresponding source archive fixture');
 const panelInventory={schemaVersion:1,host:'CastLinkServer.exe',binding:'server-native-binding.json',buildFiles:['server-native-panel-host.cs','build-server-native-panel-host.ps1'],files:['server-native-control.ps1','server-native-monitor.ps1','simple-easy-setup-control.ps1','simple-easy-setup-language.ps1','simple-easy-setup-network.ps1','simple-easy-setup-control.ico','server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','castlink-updater.ps1']};
 await fs.writeFile(path.join(root,'scripts/server-native-panel-files.json'),JSON.stringify(panelInventory));
 await fs.mkdir(path.join(root,'scripts/updater'),{recursive:true});
 for(const name of [...panelInventory.files,...panelInventory.buildFiles])await fs.writeFile(path.join(root,'scripts',name==='castlink-updater.ps1'?'updater/castlink-updater.ps1':name),'panel fixture '+name);
 for(const name of ['server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','server-wsl-maintenance.py','server-wsl-runtime.py'])await fs.writeFile(path.join(root,'scripts',name),'lifecycle fixture '+name);
 await fs.writeFile(path.join(tree,'usr/local/bin/castlink-server'),'lifecycle fixture server-wsl-runtime.py');await fs.writeFile(path.join(tree,'usr/local/bin/castlink-server-maintenance'),'lifecycle fixture server-wsl-maintenance.py');
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
 const upstreamData='upstream fixture source',upstreamManifest={schemaVersion:1,files:[{url:'https://example.com/component.txt',path:'component.txt',sha256:hash(upstreamData),size:Buffer.byteLength(upstreamData),component:'fixture'}]};
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
  assert.equal(m.requirements.hostAddressLoopback,true);
  assert.equal(m.nativePanel.host,'CastLinkServer.exe');
  assert.equal(m.nativePanel.files.length,12);
  for(const entry of m.nativePanel.files){const original=await fs.readFile(path.join(f.root,'scripts',entry.file==='castlink-updater.ps1'?'updater/castlink-updater.ps1':entry.file));assert.equal(entry.sha256,hash(original));assert.equal(entry.size,original.length);assert.deepEqual(await fs.readFile(path.join(f.output,entry.file)),original);}
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

test('native panel inventory rejects traversal, duplicate or missing helpers before output',async()=>{
 for(const change of ['traversal','duplicate','missing']){const f=await fixture();try{
  const manifestPath=path.join(f.root,'scripts/server-native-panel-files.json'),m=JSON.parse(await fs.readFile(manifestPath,'utf8'));
  if(change==='traversal')m.files[0]='../LICENSE';
  else if(change==='duplicate')m.files.push(m.files[0]);
  else await fs.rm(path.join(f.root,'scripts',m.files[0]));
  await fs.writeFile(manifestPath,JSON.stringify(m));
  await assert.rejects(assembleWslPackage(f),/panel|helper|inventory|ENOENT/i);
  await assert.rejects(fs.stat(f.output),{code:'ENOENT'});
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}}
});

test('lifecycle package contract and standalone ZIP pin helpers without circular bootstrap inventory',async()=>{
 const f=await fixture();try{const m=await assembleWslPackage(f);
 assert.equal(m.lifecycle.runtimeContract,'castlink-wsl-pg16-v1');assert.equal(m.lifecycle.postgresMajor,16);assert.deepEqual(m.lifecycle.supportedSources,['server-wsl-v1.0.5-rc.1-085b087a2458','server-wsl-v1.0.5-rc.2-af3e309d0926','server-wsl-v1.0.5-rc.3-95ec46463c82','server-wsl-v1.0.6-rc.1-dad063393b53','server-wsl-v1.0.7-0d16de2e782c']);assert.ok(m.rootfs.expandedBytes>0);
 assert.ok(m.inventory.size>0);for(const name of ['server-wsl-maintenance.py','server-wsl-runtime.py','server-wsl-maintenance.ps1','server-wsl-maintenance-ui.ps1','install-server-windows.template.ps1'])assert.ok(m.lifecycle.helpers.some(e=>e.file===name));
 assert.ok(!m.lifecycle.helpers.some(e=>e.file==='maintenance-bootstrap.ps1'));
 const zip=path.join(f.output,'CastLink-Server-WSL-Maintenance.zip');const names=execFileSync(process.env.CASTLINK_PYTHON||'python3',['-c','import zipfile,sys;print(chr(10).join(zipfile.ZipFile(sys.argv[1]).namelist()))',zip],{encoding:'utf8'});assert.ok(names.includes('CastLink-Maintenance.cmd'));assert.ok(names.includes('maintenance-bootstrap.ps1'));assert.ok(!names.includes(m.rootfs.file));
 const bootstrap=await fs.readFile(path.join(f.output,'maintenance-bootstrap.ps1'),'utf8');assert.ok(bootstrap.includes(hash(await fs.readFile(path.join(f.output,'manifest.json')))));assert.ok(!bootstrap.includes('/latest'));assert.ok((await fs.readFile(path.join(f.output,'SHA256SUMS'),'utf8')).includes('CastLink-Server-WSL-Maintenance.zip'));
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
test('embedded lifecycle contract mismatch is refused before output',async()=>{
 for(const lifecycle of [null,{schemaVersion:1,runtimeContract:'wrong',postgresMajor:16,supportedSources:[]},{schemaVersion:1,runtimeContract:'castlink-wsl-pg16-v1',postgresMajor:17,supportedSources:['server-wsl-v1.0.5-rc.1-085b087a2458','server-wsl-v1.0.5-rc.2-af3e309d0926','server-wsl-v1.0.5-rc.3-95ec46463c82','server-wsl-v1.0.6-rc.1-dad063393b53','server-wsl-v1.0.7-0d16de2e782c']}]){const f=await fixture();try{await fs.writeFile(path.join(f.tree,'opt/castlink/release.json'),JSON.stringify({schemaVersion:1,version,commit,buildId:version+'-'+commit.slice(0,12),lifecycle}));f.pack();await assert.rejects(assembleWslPackage(f),/lifecycle|contract|major/i);await assert.rejects(fs.stat(f.output),{code:'ENOENT'});}finally{await fs.rm(f.dir,{recursive:true,force:true});}}
});

test('embedded lifecycle refuses missing published 1.0.6 RC1 or an unknown same-version build',async()=>{
 for(const change of ['missing','unknown']){const f=await fixture();try{
  const file=path.join(f.tree,'opt/castlink/release.json'),release=JSON.parse(await fs.readFile(file,'utf8'));
  release.lifecycle.supportedSources=release.lifecycle.supportedSources.filter(tag=>tag!=='server-wsl-v1.0.6-rc.1-dad063393b53');
  if(change==='unknown')release.lifecycle.supportedSources.push('server-wsl-v1.0.6-rc.1-dddddddddddd');
  await fs.writeFile(file,JSON.stringify(release));f.pack();
  await assert.rejects(assembleWslPackage(f),/lifecycle|contract/i);
  await assert.rejects(fs.stat(f.output),{code:'ENOENT'});
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}}
});

// The packaged launcher runs the UI in a child script scope. GetNewClosure
// callbacks must still resolve UI helpers, as they do in a direct -File launch.
test('maintenance bootstrap launches scoped UI callbacks in Windows PowerShell', {skip:process.platform!=='win32'}, async()=>{
 const f=await fixture();try{
  await fs.writeFile(path.join(f.root,'scripts/server-wsl-maintenance-ui.ps1'), `param([string]$TargetDirectory,[string]$ExpectedManifestSha256)
$ErrorActionPreference='Stop'
function Get-CLMText { 'callback resolved' }
$callback={ Get-CLMText }.GetNewClosure()
if((& $callback) -cne 'callback resolved'){throw 'UI callback failed'}
if(-not (Test-Path (Join-Path $TargetDirectory 'manifest.json'))){throw 'Lost target directory'}
if($ExpectedManifestSha256 -cne (Get-FileHash (Join-Path $TargetDirectory 'manifest.json') -Algorithm SHA256).Hash.ToLowerInvariant()){throw 'Lost manifest pin'}
`);
  await assembleWslPackage(f);
  execFileSync('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(f.output,'maintenance-bootstrap.ps1')],{encoding:'utf8',timeout:20000});
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});

test('maintenance bootstrap VerifyOnly skips UI and propagates child failure', {skip:process.platform!=='win32'}, async()=>{
 const f=await fixture();try{
  await fs.writeFile(path.join(f.root,'scripts/server-wsl-maintenance-ui.ps1'), 'exit 7');
  await assembleWslPackage(f);
  const args=['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',path.join(f.output,'maintenance-bootstrap.ps1')];
  execFileSync('powershell.exe',[...args,'-VerifyOnly'],{encoding:'utf8',timeout:20000});
  assert.throws(()=>execFileSync('powershell.exe',args,{encoding:'utf8',timeout:20000,stdio:'pipe'}), e=>e.status!==0 && /Maintenance window failed \(exit 7\)/.test(e.stderr));
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});

test('future WSL packages pin the exact persistent Windows updater source in the native panel',async()=>{
 const f=await fixture();try{
  const inventoryFile=path.join(f.root,'scripts/server-native-panel-files.json'),inventory=JSON.parse(await fs.readFile(inventoryFile,'utf8'));
  if(!inventory.files.includes('castlink-updater.ps1'))inventory.files.push('castlink-updater.ps1');
  await fs.writeFile(inventoryFile,JSON.stringify(inventory));await fs.mkdir(path.join(f.root,'scripts/updater'),{recursive:true});
  const bytes=await fs.readFile(new URL('../updater/castlink-updater.ps1',import.meta.url));
  await fs.writeFile(path.join(f.root,'scripts/updater/castlink-updater.ps1'),bytes);
  const m=await assembleWslPackage(f),entry=m.nativePanel.files.find(e=>e.file==='castlink-updater.ps1');
  assert.equal(entry.sha256,hash(bytes));assert.equal(entry.size,bytes.length);
  assert.deepEqual(await fs.readFile(path.join(f.output,'castlink-updater.ps1')),bytes);
  assert.deepEqual(bytes.subarray(0,3),Buffer.from([0xef,0xbb,0xbf]));
 }finally{await fs.rm(f.dir,{recursive:true,force:true});}
});
