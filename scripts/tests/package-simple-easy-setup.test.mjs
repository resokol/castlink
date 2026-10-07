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
  const image=path.join(tmp,'image.gz');await fs.writeFile(image,'fixture image');
  const output=path.join(tmp,'out');const release=await assemble({output,image,commit:'a'.repeat(40),imageId:'sha256:'+'b'.repeat(64)});
  assert.equal(release.commit,'a'.repeat(40));
  const sums=await fs.readFile(path.join(output,'SHA256SUMS'),'utf8');
  for(const name of ['CastLink-Windows.zip','CastLink-Linux.tar.gz'])assert.ok(sums.includes(createHash('sha256').update(await fs.readFile(path.join(output,name))).digest('hex')+'  '+name));
  const fromTar=execFileSync('tar',['-xOzf',path.join(output,'CastLink-Linux.tar.gz'),'payload/release.json'],{encoding:'utf8'});assert.deepEqual(JSON.parse(fromTar),release);
  const ps=execFileSync('unzip',['-p',path.join(output,'CastLink-Windows.zip'),'scripts/windows-simple-easy-setup.ps1']);assert.equal(ps.subarray(0,3).toString('hex'),'efbbbf');
  const cmd=execFileSync('unzip',['-p',path.join(output,'CastLink-Windows.zip'),'EasySetup.cmd'],{encoding:'utf8'});assert.match(cmd,/windows-simple-easy-setup\.ps1/);assert.doesNotMatch(cmd,/Prepare-VPS|Owner-access|castlink\.exe/);
  await assert.rejects(assemble({output:path.join(tmp,'wrong'),image,commit:'latest',imageId:'fake'}));
 }finally{await fs.rm(tmp,{recursive:true,force:true});}
});
