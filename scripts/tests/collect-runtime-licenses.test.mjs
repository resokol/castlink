import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {collectRuntimeLicenses} from '../collect-runtime-licenses.mjs';

test('collects installed browser packages whose names match Node builtins',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-licenses-'));
 try{
  const web=path.join(root,'apps/web');
  const vendor=path.join(web,'node_modules/events');
  await fs.mkdir(vendor,{recursive:true});
  await fs.writeFile(path.join(web,'package.json'),JSON.stringify({dependencies:{events:'3.3.0'}}));
  await fs.writeFile(path.join(vendor,'package.json'),JSON.stringify({name:'events',version:'3.3.0',license:'MIT',exports:{'.':'./index.js'}}));
  await fs.writeFile(path.join(vendor,'LICENSE'),'Browser events license\n');
  const output=path.join(root,'notices');
  const packages=await collectRuntimeLicenses(root,output);
  assert.deepEqual(packages.map(p=>p.name),['events']);
  assert.equal(await fs.readFile(path.join(output,'events@3.3.0/LICENSE'),'utf8'),'Browser events license\n');
 }finally{await fs.rm(root,{recursive:true,force:true});}
});
