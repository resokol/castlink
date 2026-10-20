import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
function readZip(file,entry){return process.platform==='win32'?execFileSync(process.env.CASTLINK_PYTHON??'python',['-c','import sys,zipfile;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read(sys.argv[2]))',file,entry]):execFileSync('unzip',['-p',file,entry]);}
import {assemble} from '../package-simple-easy-setup.mjs';
import releaseTracks from '../release-track.cjs';
test('two release assets carry one current image/version; PS5 UTF8 and checksums are real',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-simple-package-'));
 try{
  const image=path.join(tmp,'image.gz');const carrier=path.join(tmp,'carrier');await fs.mkdir(carrier);
  const tags=Object.fromEntries(['web','postgres','livekit','caddy','turntls'].map(name=>[name,'castlink-easy-'+name+':'+'a'.repeat(40)]));
  await fs.writeFile(path.join(carrier,'manifest.json'),JSON.stringify(Object.values(tags).map(tag=>({Config:'fixture.json',RepoTags:[tag],Layers:[]}))));
  execFileSync('tar',['-czf',image,'-C',carrier,'manifest.json']);
  await fs.mkdir(path.join(tmp,'third_party/npm/fixture'),{recursive:true});await fs.writeFile(path.join(tmp,'third_party/npm/fixture/LICENSE'),'Fixture third-party license\n');await fs.writeFile(path.join(tmp,'third_party/npm/packages.json'),'{"schemaVersion":1,"packages":[]}\n');
  await fs.writeFile(path.join(tmp,'CastLink-ThirdParty-Sources.tar.gz'),'fixture source sidecar');
  await fs.writeFile(path.join(tmp,'CastLink-ThirdParty-Office-Sources.tar.gz'),'fixture Office source sidecar');
  const launcher=path.join(tmp,'EasySetup.exe');await fs.writeFile(launcher,'MZ fixture only; real CI compiles Framework host');
  const output=path.join(tmp,'out');const release=await assemble({output,image,launcher,commit:'a'.repeat(40),imageId:'sha256:'+'b'.repeat(64),officialImageIds:{postgres:'sha256:'+'c'.repeat(64),livekit:'sha256:'+'d'.repeat(64),caddy:'sha256:'+'e'.repeat(64),turntls:'sha256:'+'f'.repeat(64)}});
  assert.equal(release.thirdPartySources.asset,'CastLink-ThirdParty-Sources.tar.gz');
  assert.equal(release.thirdPartySources.sha256,createHash('sha256').update('fixture source sidecar').digest('hex'));
  assert.deepEqual(release.thirdPartySources.supplements,[{asset:'CastLink-ThirdParty-Office-Sources.tar.gz',sha256:createHash('sha256').update('fixture Office source sidecar').digest('hex')}]);
  assert.equal(release.commit,'a'.repeat(40));
  const product=releaseTracks.resolveTrack('server-setup','a'.repeat(40));
  assert.equal(release.version,product.version);
  assert.equal(release.buildNumber,product.buildNumber);
  assert.deepEqual(release.images,tags);
  for(const value of Object.values(release.imageIdentities)) assert.match(value,/^sha256:[a-f0-9]{64}$/);
  assert.match(release.sourceReferences.postgres,/@sha256:721873/);
  assert.equal(release.imageArchive,'images.tar.gz');
  assert.equal(release.imageArchiveSha256,createHash('sha256').update(await fs.readFile(image)).digest('hex'));
  assert.ok(release.bundleFiles['scripts/windows-simple-easy-setup.ps1']);
  for(const name of ['linux-compose-setup.py','simple-easy-setup-network.ps1']){
   const member='scripts/'+name;
   assert.ok(release.bundleFiles[member],member+' is hashed');
   const bytes=execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),member]);
   assert.equal(release.bundleFiles[member],createHash('sha256').update(bytes).digest('hex'));
   assert.deepEqual(readZip(path.join(output,'CastLink-Windows.zip'),member),bytes);
  }
  for(const [name,expected] of Object.entries(release.bundleFiles)){
   const bytes=execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),name]);
   assert.equal(createHash('sha256').update(bytes).digest('hex'),expected,name+' Linux membership/hash');
  }
  for(const name of ['distribution/INSTALL.md','distribution/docs/en/INSTALL.md','distribution/docs/zh-CN/INSTALL.md','distribution/LINUX_MANUAL.md','distribution/docs/en/LINUX_MANUAL.md','distribution/docs/zh-CN/LINUX_MANUAL.md','distribution/PRODUCTS.md','distribution/docs/en/PRODUCTS.md','distribution/docs/zh-CN/PRODUCTS.md']){
   const bytes=execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),name]);
   assert.equal(release.documentationFiles[name],createHash('sha256').update(bytes).digest('hex'));
   assert.deepEqual(bytes,await fs.readFile(name),name+' exact source documentation');
   assert.deepEqual(readZip(path.join(output,'CastLink-Windows.zip'),name),bytes,name+' same documentation in both archives');
  }
  assert.equal(release.distributionRepository,'resokol/castlink-releases');
  assert.equal(readZip(path.join(output,'CastLink-Windows.zip'),'scripts/simple-easy-setup-release.json').toString('utf8').trim(),(await fs.readFile('scripts/simple-easy-setup-release.json','utf8')).trim());
  assert.equal(readZip(path.join(output,'CastLink-Windows.zip'),'LICENSE').toString('utf8'),await fs.readFile('LICENSE','utf8'));
  assert.equal(execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),'LICENSE'],{encoding:'utf8'}),await fs.readFile('LICENSE','utf8'));
  for(const name of ['THIRD_PARTY_NOTICES','distribution/README.md','third_party/npm/fixture/LICENSE']){
   const bytes=readZip(path.join(output,'CastLink-Windows.zip'),name);assert.ok(bytes.length);assert.equal(execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),name],{encoding:'utf8'}),bytes.toString('utf8'));assert.equal(release.documentationFiles[name],createHash('sha256').update(bytes).digest('hex'));
  }
  const sums=await fs.readFile(path.join(output,'SHA256SUMS'),'utf8');
  for(const name of ['CastLink-Windows.zip','CastLink-Linux.tar.gz','CastLink-Provisioning.json','CastLink-ThirdParty-Sources.tar.gz','CastLink-ThirdParty-Office-Sources.tar.gz'])assert.ok(sums.includes(createHash('sha256').update(await fs.readFile(path.join(output,name))).digest('hex')+'  '+name));
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(output,'CastLink-Provisioning.json'),'utf8')),{schemaVersion:1,commit:release.commit,capabilities:['peer-profile-v1','root-ssh-v1','vps-update-maintenance-v1','network-modes-v1','linux-compose-v1']});
  assert.ok(release.bundleFiles['scripts/simple-easy-setup-reserves.ps1']);
  const control=readZip(path.join(output,'CastLink-Windows.zip'),'scripts/simple-easy-setup-control.ps1');
  assert.equal(control.subarray(0,3).toString('hex'),'efbbbf');
  assert.equal(release.bundleFiles['scripts/simple-easy-setup-control.ps1'],createHash('sha256').update(control).digest('hex'));
  const icon=readZip(path.join(output,'CastLink-Windows.zip'),'scripts/simple-easy-setup-control.ico');
  assert.deepEqual(icon,await fs.readFile('scripts/simple-easy-setup-control.ico'));
  assert.equal(release.bundleFiles['scripts/simple-easy-setup-control.ico'],createHash('sha256').update(icon).digest('hex'));
  assert.equal(icon.readUInt16LE(4),7);
  assert.deepEqual(Array.from({length:7},(_,i)=>icon[6+i*16]||256),[16,24,32,48,64,128,256]);
  const fromTar=execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),'payload/release.json'],{encoding:'utf8'});assert.deepEqual(JSON.parse(fromTar),release);
  const ps=readZip(path.join(output,'CastLink-Windows.zip'),'scripts/windows-simple-easy-setup.ps1');assert.equal(ps.subarray(0,3).toString('hex'),'efbbbf');
  const cmd=readZip(path.join(output,'CastLink-Windows.zip'),'EasySetup.cmd').toString('utf8');assert.match(cmd,/EasySetup\.exe/);
  assert.equal(readZip(path.join(output,'CastLink-Windows.zip'),'EasySetup.exe').toString(),await fs.readFile(launcher,'utf8'));
  const console=readZip(path.join(output,'CastLink-Windows.zip'),'EasySetup-Console.cmd').toString('utf8');assert.match(console,/windows-simple-easy-setup\.ps1/);
  for(const name of ['simple-easy-setup-gui.ps1','simple-easy-setup-download.ps1'])assert.equal(readZip(path.join(output,'CastLink-Windows.zip'),'scripts/'+name).subarray(0,3).toString('hex'),'efbbbf');assert.doesNotMatch(cmd,/Prepare-VPS|Owner-access|castlink\.exe/);
  const linuxOutput=path.join(tmp,'linux-only');
  const linux=await assemble({output:linuxOutput,image,track:'linux',commit:'a'.repeat(40),imageId:'sha256:'+'b'.repeat(64),officialImageIds:{postgres:'sha256:'+'c'.repeat(64),livekit:'sha256:'+'d'.repeat(64),caddy:'sha256:'+'e'.repeat(64),turntls:'sha256:'+'f'.repeat(64)}});
  assert.equal(linux.track,'linux');assert.equal(linux.tag,'linux-v1.0.0-rc.8-aaaaaaaaaaaa');assert.equal(linux.sourceCommit,'a'.repeat(40));
  await assert.rejects(fs.stat(path.join(linuxOutput,'CastLink-Windows.zip')),/ENOENT/);
  assert.ok((await fs.stat(path.join(linuxOutput,'CastLink-Linux.tar.gz'))).size>0);
  for(const name of ['distribution/LINUX_MANUAL.md','distribution/docs/en/LINUX_MANUAL.md','distribution/docs/zh-CN/LINUX_MANUAL.md','distribution/PRODUCTS.md','distribution/docs/en/PRODUCTS.md','distribution/docs/zh-CN/PRODUCTS.md']){
   const bytes=execFileSync('tar',['-xOzf',path.join(linuxOutput,'CastLink-Linux.tar.gz'),name]);
   assert.deepEqual(bytes,await fs.readFile(name),name+' standalone Linux source bytes');
   assert.equal(linux.documentationFiles[name],createHash('sha256').update(bytes).digest('hex'),name+' standalone manifest hash');
  }
  assert.deepEqual(JSON.parse(await fs.readFile(path.join(linuxOutput,'manifest.json'),'utf8')),releaseTracks.resolveTrack('linux','a'.repeat(40)));

  const linuxSums=await fs.readFile(path.join(linuxOutput,'SHA256SUMS'),'utf8');assert.doesNotMatch(linuxSums,/CastLink-Windows/);assert.match(linuxSums,/manifest.json/);
  await assert.rejects(assemble({output:path.join(tmp,'wrong'),image,commit:'latest',imageId:'fake'}));
  await fs.writeFile(path.join(carrier,'manifest.json'),JSON.stringify([{Config:'fixture.json',RepoTags:[tags.web],Layers:[]}]));
  execFileSync('tar',['-czf',image,'-C',carrier,'manifest.json']);
  await assert.rejects(assemble({output:path.join(tmp,'missing-tag'),image,launcher,commit:'a'.repeat(40),imageId:'sha256:'+'b'.repeat(64),officialImageIds:{postgres:'sha256:'+'c'.repeat(64),livekit:'sha256:'+'d'.repeat(64),caddy:'sha256:'+'e'.repeat(64),turntls:'sha256:'+'f'.repeat(64)}}),/archive.*tags/i);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});

