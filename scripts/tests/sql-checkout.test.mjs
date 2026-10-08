import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';

test('Windows Git checkout preserves exact pinned SQL bytes under autocrlf=true',async()=>{
 const source=process.cwd(),checkout=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-sql-checkout-'));
 const git=(...args)=>execFileSync('git',['-C',checkout,...args],{stdio:'pipe'});
 try {
  for(const name of ['postgres','control-plane'])await fs.cp(path.join(source,'infrastructure',name),path.join(checkout,'infrastructure',name),{recursive:true});
  try{await fs.copyFile(path.join(source,'.gitattributes'),path.join(checkout,'.gitattributes'));}catch(error){if(error.code!=='ENOENT')throw error;}
  git('init');git('-c','core.autocrlf=false','add','.');git('config','core.autocrlf','true');
  await fs.rm(path.join(checkout,'infrastructure'),{recursive:true});git('checkout-index','--force','--all');
  for(const directory of ['postgres','control-plane'])for(const name of await fs.readdir(path.join(checkout,'infrastructure',directory))){
   if(!/^\d.*\.sql$/.test(name))continue;
   assert.deepEqual(await fs.readFile(path.join(checkout,'infrastructure',directory,name)),await fs.readFile(path.join(source,'infrastructure',directory,name)),`${directory}/${name} must keep pinned LF bytes`);
  }
  const helper=await fs.readFile(path.join(source,'scripts/setup-database-v1.mjs'),'utf8');
  const pins=[...helper.matchAll(/^\s*'([^']+)':'([a-f0-9]{64})',?$/gm)];assert.equal(pins.length,9);
  for(const [,name,pin] of pins)assert.equal(createHash('sha256').update(await fs.readFile(path.join(checkout,'infrastructure',name))).digest('hex'),pin);
 } finally {process.chdir(source);await fs.rm(checkout,{recursive:true,force:true});}
});
