import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {assemble} from '../package-simple-easy-setup.mjs';
test('two release assets carry one current image/version; PS5 UTF8 and checksums are real',async()=>{
 const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-simple-package-'));
 try{
  const image=path.join(tmp,'image.gz');const carrier=path.join(tmp,'carrier');await fs.mkdir(carrier);
  const tags=Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,'castlink-easy-'+name+':'+'a'.repeat(40)]));
  await fs.writeFile(path.join(carrier,'manifest.json'),JSON.stringify(Object.values(tags).map(tag=>({Config:'fixture.json',RepoTags:[tag],Layers:[]}))));
  execFileSync('tar',['-czf',image,'-C',carrier,'manifest.json']);
  const output=path.join(tmp,'out');const release=await assemble({output,image,commit:'a'.repeat(40),imageId:'sha256:'+'b'.repeat(64),officialImageIds:{postgres:'sha256:'+'c'.repeat(64),livekit:'sha256:'+'d'.repeat(64),caddy:'sha256:'+'e'.repeat(64)}});
  assert.equal(release.commit,'a'.repeat(40));
  assert.deepEqual(release.images,tags);
  for(const value of Object.values(release.imageIdentities)) assert.match(value,/^sha256:[a-f0-9]{64}$/);
  assert.match(release.sourceReferences.postgres,/@sha256:721873/);
  assert.equal(release.imageArchive,'images.tar.gz');
  const sums=await fs.readFile(path.join(output,'SHA256SUMS'),'utf8');
  for(const name of ['CastLink-Windows.zip','CastLink-Linux.tar.gz'])assert.ok(sums.includes(createHash('sha256').update(await fs.readFile(path.join(output,name))).digest('hex')+'  '+name));
  const fromTar=execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),'payload/release.json'],{encoding:'utf8'});assert.deepEqual(JSON.parse(fromTar),release);
  const ps=execFileSync('unzip',['-p',path.join(output,'CastLink-Windows.zip'),'scripts/windows-simple-easy-setup.ps1']);assert.equal(ps.subarray(0,3).toString('hex'),'efbbbf');
  const cmd=execFileSync('unzip',['-p',path.join(output,'CastLink-Windows.zip'),'EasySetup.cmd'],{encoding:'utf8'});assert.match(cmd,/windows-simple-easy-setup\.ps1/);assert.doesNotMatch(cmd,/Prepare-VPS|Owner-access|castlink\.exe/);
  await assert.rejects(assemble({output:path.join(tmp,'wrong'),image,commit:'latest',imageId:'fake'}));
  await fs.writeFile(path.join(carrier,'manifest.json'),JSON.stringify([{Config:'fixture.json',RepoTags:[tags.web],Layers:[]}]));
  execFileSync('tar',['-czf',image,'-C',carrier,'manifest.json']);
  await assert.rejects(assemble({output:path.join(tmp,'missing-tag'),image,commit:'a'.repeat(40),imageId:'sha256:'+'b'.repeat(64),officialImageIds:{postgres:'sha256:'+'c'.repeat(64),livekit:'sha256:'+'d'.repeat(64),caddy:'sha256:'+'e'.repeat(64)}}),/archive.*tags/i);
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
