import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {prepareRuntime,operatorScripts} from '../prepare-web-runtime.mjs';

test('runtime keeps traced vendor notices and byte-identical operator programs, never app source',async()=>{
 const runtime=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-runtime-files-'));
 const source=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-runtime-source-'));
 try {
  // A clean CI checkout has no installed dependencies. Model the traced
  // dependency notice explicitly rather than relying on the developer machine.
  const vendorNotice='Fixture dependency license notice\n';
  await fs.mkdir(path.join(source,'apps/web/node_modules/pg'),{recursive:true});
  await fs.writeFile(path.join(source,'apps/web/node_modules/pg/LICENSE'),vendorNotice);
  await fs.mkdir(path.join(source,'scripts'),{recursive:true});
  for(const name of operatorScripts)await fs.copyFile(path.join('scripts',name),path.join(source,'scripts',name));
  for(const name of ['control-plane','postgres'])await fs.cp(path.join('infrastructure',name),path.join(source,'infrastructure',name),{recursive:true});
  await fs.copyFile('LICENSE',path.join(source,'LICENSE'));
  await fs.mkdir(path.join(runtime,'apps/web'),{recursive:true});await fs.writeFile(path.join(runtime,'apps/web/server.js'),'// compiled server');
  await fs.mkdir(path.join(runtime,'apps/web/node_modules/pg'),{recursive:true});
  await fs.writeFile(path.join(runtime,'apps/web/node_modules/pg/package.json'),'{"name":"pg"}');
  await fs.mkdir(path.join(runtime,'node_modules/.pnpm/typescript@fixture'),{recursive:true});
  await fs.writeFile(path.join(runtime,'node_modules/.pnpm/typescript@fixture/compiler.js'),'build tool');
  await prepareRuntime(runtime,source);
  assert.equal(await fs.readFile(path.join(runtime,'LICENSE'),'utf8'),await fs.readFile('LICENSE','utf8'));
  assert.equal(await fs.readFile(path.join(runtime,'apps/web/node_modules/pg/LICENSE'),'utf8'),vendorNotice);
  for(const name of operatorScripts)assert.deepEqual(await fs.readFile(path.join(runtime,'scripts',name)),await fs.readFile(path.join('scripts',name)));
  await assert.rejects(fs.access(path.join(runtime,'node_modules/.pnpm/typescript@fixture')));
  await assert.rejects(fs.access(path.join(runtime,'apps/web/app')));
  assert.deepEqual(await fs.readFile(path.join(runtime,'infrastructure/postgres/004_room_creator_access.sql')),await fs.readFile('infrastructure/postgres/004_room_creator_access.sql'));
 } finally {await fs.rm(runtime,{recursive:true,force:true});await fs.rm(source,{recursive:true,force:true});}
});

test('unexpected original source/private runtime data refuses the image preparation',async()=>{
 for(const name of ['app','.studiolink-data']) {
  const runtime=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-runtime-refusal-'));
  try {
   await fs.mkdir(path.join(runtime,'apps/web',name),{recursive:true});await fs.writeFile(path.join(runtime,'apps/web/server.js'),'// compiled server');
   await assert.rejects(prepareRuntime(runtime,process.cwd()),/Original application source or local data/);
   await assert.rejects(fs.access(path.join(runtime,'scripts')));
  }finally{await fs.rm(runtime,{recursive:true,force:true});}
 }
});
