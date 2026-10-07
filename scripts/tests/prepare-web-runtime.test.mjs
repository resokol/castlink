import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {prepareRuntime,operatorScripts} from '../prepare-web-runtime.mjs';

test('runtime keeps traced vendor notices and byte-identical operator programs, never app source',async()=>{
 const runtime=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-runtime-files-'));
 try {
  await fs.mkdir(path.join(runtime,'apps/web'),{recursive:true});await fs.writeFile(path.join(runtime,'apps/web/server.js'),'// compiled server');
  await fs.mkdir(path.join(runtime,'apps/web/node_modules/pg'),{recursive:true});
  await fs.writeFile(path.join(runtime,'apps/web/node_modules/pg/package.json'),'{"name":"pg"}');
  await fs.mkdir(path.join(runtime,'node_modules/.pnpm/typescript@fixture'),{recursive:true});
  await fs.writeFile(path.join(runtime,'node_modules/.pnpm/typescript@fixture/compiler.js'),'build tool');
  await prepareRuntime(runtime,process.cwd());
  assert.equal(await fs.readFile(path.join(runtime,'LICENSE'),'utf8'),await fs.readFile('LICENSE','utf8'));
  assert.deepEqual(await fs.readFile(path.join(runtime,'apps/web/node_modules/pg/LICENSE')),await fs.readFile('apps/web/node_modules/pg/LICENSE'));
  for(const name of operatorScripts)assert.deepEqual(await fs.readFile(path.join(runtime,'scripts',name)),await fs.readFile(path.join('scripts',name)));
  await assert.rejects(fs.access(path.join(runtime,'node_modules/.pnpm/typescript@fixture')));
  await assert.rejects(fs.access(path.join(runtime,'apps/web/app')));
  assert.deepEqual(await fs.readFile(path.join(runtime,'infrastructure/postgres/004_room_creator_access.sql')),await fs.readFile('infrastructure/postgres/004_room_creator_access.sql'));
 } finally {await fs.rm(runtime,{recursive:true,force:true});}
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
