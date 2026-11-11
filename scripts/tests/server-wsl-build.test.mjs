import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {execFileSync} from 'node:child_process';
import {verifyBuildSource} from '../build-server-wsl.mjs';

test('release builds refuse a claimed commit that differs from code or has dirty inputs',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-build-source-'));
 const git=args=>execFileSync('git',['-C',root,...args],{encoding:'utf8'}).trim();
 try{
  git(['init','-q']);git(['config','user.name','Fixture']);git(['config','user.email','fixture@example.invalid']);
  await fs.writeFile(path.join(root,'source.txt'),'original');git(['add','.']);git(['commit','-qm','fixture']);
  const commit=git(['rev-parse','HEAD']);
  assert.doesNotThrow(()=>verifyBuildSource(root,commit));
  assert.throws(()=>verifyBuildSource(root,'f'.repeat(40)),/commit|HEAD/i);
  await fs.appendFile(path.join(root,'source.txt'),'changed');
  assert.throws(()=>verifyBuildSource(root,commit),/clean|dirty|input/i);
  git(['checkout','--','source.txt']);await fs.writeFile(path.join(root,'untracked.txt'),'new build input');
  assert.throws(()=>verifyBuildSource(root,commit),/clean|dirty|input/i);
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
