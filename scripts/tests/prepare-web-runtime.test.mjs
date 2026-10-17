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
  await fs.mkdir(path.join(source,'apps/web/node_modules/ssh2'),{recursive:true});
  await fs.writeFile(path.join(source,'apps/web/node_modules/ssh2/LICENSE'),'SSH dependency license notice\n');
  await fs.mkdir(path.join(source,'scripts'),{recursive:true});
  await fs.writeFile(path.join(source,'apps/web/package.json'),JSON.stringify({dependencies:{pg:'*',ssh2:'*','livekit-client':'*','pdfjs-dist':'6.4.299'}}));
  await fs.mkdir(path.join(source,'apps/web/node_modules/livekit-client'),{recursive:true});
  await fs.writeFile(path.join(source,'apps/web/node_modules/livekit-client/package.json'),JSON.stringify({name:'livekit-client',version:'1.0.0',license:'Apache-2.0'}));
  await fs.writeFile(path.join(source,'apps/web/node_modules/livekit-client/LICENSE'),'Browser-only Apache notice\n');
  const publicFiles={
   'helpers/CastLink-PowerPoint-Windows.ps1':'# fixed Windows helper',
   'helpers/CastLink-PowerPoint-macOS.js':'// fixed macOS helper',
   'pdfjs/pdf.worker.min.mjs':'// compiled PDF worker',
   'pdfjs/.version':'6.4.299',
   'pdfjs/LICENSE':'Apache PDF.js license',
   'pdfjs/cmaps/Adobe-Japan1-UCS2.bcmap':'binary CMap fixture',
   'pdfjs/cmaps/LICENSE':'CMap license',
   'pdfjs/standard_fonts/FoxitSerif.pfb':'binary font fixture',
   'pdfjs/standard_fonts/LICENSE_FOXIT':'Foxit font notice',
   'pdfjs/wasm/qcms_bg.wasm':'binary wasm fixture',
   'pdfjs/wasm/quickjs-eval.js':'// bundled vendor wasm wrapper',
   'pdfjs/wasm/LICENSE_QCMS':'QCMS notice',
  };
  for(const [name,bytes] of Object.entries(publicFiles)){const file=path.join(source,'apps/web/public',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
  for(const name of ['private.ts','worker.mjs.map','original.js','wasm/original-app.js','wasm/source.ts','cmaps/.env','helpers/arbitrary.ps1']){
   const file=path.join(source,'apps/web/public/pdfjs',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'must not enter runtime');
  }
  await fs.writeFile(path.join(source,'apps/web/public/helpers/other.ps1'),'not allowlisted');
  const pdfVendor=path.join(source,'apps/web/node_modules/pdfjs-dist');await fs.mkdir(path.join(pdfVendor,'standard_fonts'),{recursive:true});await fs.mkdir(path.join(pdfVendor,'wasm'),{recursive:true});
  await fs.writeFile(path.join(pdfVendor,'package.json'),JSON.stringify({name:'pdfjs-dist',version:'6.4.299',license:'Apache-2.0'}));
  await fs.writeFile(path.join(pdfVendor,'LICENSE'),publicFiles['pdfjs/LICENSE']);
  await fs.writeFile(path.join(pdfVendor,'standard_fonts/LICENSE_FOXIT'),publicFiles['pdfjs/standard_fonts/LICENSE_FOXIT']);
  await fs.writeFile(path.join(pdfVendor,'wasm/LICENSE_QCMS'),publicFiles['pdfjs/wasm/LICENSE_QCMS']);
  for(const name of ['pg','ssh2'])await fs.writeFile(path.join(source,'apps/web/node_modules',name,'package.json'),JSON.stringify({name,version:'1.0.0',license:'MIT'}));
  await fs.writeFile(path.join(source,'THIRD_PARTY_NOTICES'),'Fixture third-party index\n');
  await fs.mkdir(path.join(source,'distribution'),{recursive:true});await fs.writeFile(path.join(source,'distribution/README.md'),'Fixture distribution guide\n');
  for(const name of operatorScripts)await fs.copyFile(path.join('scripts',name),path.join(source,'scripts',name));
  for(const name of ['control-plane','postgres'])await fs.cp(path.join('infrastructure',name),path.join(source,'infrastructure',name),{recursive:true});
  await fs.copyFile('LICENSE',path.join(source,'LICENSE'));
  await fs.mkdir(path.join(runtime,'apps/web'),{recursive:true});await fs.writeFile(path.join(runtime,'apps/web/server.js'),'// compiled server');
  await fs.mkdir(path.join(runtime,'apps/web/node_modules/pg'),{recursive:true});
  await fs.writeFile(path.join(runtime,'apps/web/node_modules/pg/package.json'),'{"name":"pg"}');
  await fs.mkdir(path.join(runtime,'apps/web/node_modules/ssh2'),{recursive:true});
  await fs.writeFile(path.join(runtime,'apps/web/node_modules/ssh2/package.json'),'{"name":"ssh2"}');
  await fs.mkdir(path.join(runtime,'node_modules/.pnpm/typescript@fixture'),{recursive:true});
  await fs.writeFile(path.join(runtime,'node_modules/.pnpm/typescript@fixture/compiler.js'),'build tool');
  await prepareRuntime(runtime,source);
  assert.equal(await fs.readFile(path.join(runtime,'LICENSE'),'utf8'),await fs.readFile('LICENSE','utf8'));
  assert.equal(await fs.readFile(path.join(runtime,'apps/web/node_modules/pg/LICENSE'),'utf8'),vendorNotice);
  assert.equal(await fs.readFile(path.join(runtime,'apps/web/node_modules/ssh2/LICENSE'),'utf8'),'SSH dependency license notice\n');
  for(const name of operatorScripts)assert.deepEqual(await fs.readFile(path.join(runtime,'scripts',name)),await fs.readFile(path.join('scripts',name)));
  await assert.rejects(fs.access(path.join(runtime,'node_modules/.pnpm/typescript@fixture')));
  await assert.rejects(fs.access(path.join(runtime,'apps/web/app')));
  assert.deepEqual(await fs.readFile(path.join(runtime,'infrastructure/postgres/004_room_creator_access.sql')),await fs.readFile('infrastructure/postgres/004_room_creator_access.sql'));
  await assert.rejects(fs.access(path.join(runtime,'infrastructure/control-plane/control-plane.env.example')));
  assert.equal(await fs.readFile(path.join(runtime,'third_party/npm/livekit-client@1.0.0/LICENSE'),'utf8'),'Browser-only Apache notice\n');
  assert.equal(await fs.readFile(path.join(runtime,'THIRD_PARTY_NOTICES'),'utf8'),'Fixture third-party index\n');
  assert.equal(await fs.readFile(path.join(runtime,'distribution/README.md'),'utf8'),'Fixture distribution guide\n');
  for(const [name,bytes] of Object.entries(publicFiles))assert.equal(await fs.readFile(path.join(runtime,'apps/web/public',name),'utf8'),bytes);
  for(const name of ['pdfjs/private.ts','pdfjs/worker.mjs.map','pdfjs/original.js','pdfjs/wasm/original-app.js','pdfjs/wasm/source.ts','pdfjs/cmaps/.env','pdfjs/helpers/arbitrary.ps1','helpers/other.ps1'])await assert.rejects(fs.access(path.join(runtime,'apps/web/public',name)));
  const inventory=JSON.parse(await fs.readFile(path.join(runtime,'third_party/npm/packages.json'),'utf8'));
  const pdf=inventory.packages.find(p=>p.name==='pdfjs-dist');assert.equal(pdf.version,'6.4.299');assert.equal(pdf.license,'Apache-2.0');
  for(const name of ['LICENSE','standard_fonts/LICENSE_FOXIT','wasm/LICENSE_QCMS'])assert.equal(await fs.readFile(path.join(runtime,'third_party/npm/pdfjs-dist@6.4.299',name),'utf8'),await fs.readFile(path.join(pdfVendor,name),'utf8'));

 } finally {await fs.rm(runtime,{recursive:true,force:true});await fs.rm(source,{recursive:true,force:true});}
});

test('recursive runtime checks reject source maps, stray source and environment files before adding operator programs',async()=>{
 for(const name of ['nested/original.ts','apps/web/.next/server/chunks/source.js.map','nested/.env.local','nested/control.env.example','nested/.git/config']){
  const runtime=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-runtime-deep-refusal-'));
  try{
   await fs.mkdir(path.join(runtime,'apps/web'),{recursive:true});await fs.mkdir(path.join(runtime,'node_modules/.pnpm'),{recursive:true});await fs.writeFile(path.join(runtime,'apps/web/server.js'),'compiled');await fs.mkdir(path.dirname(path.join(runtime,name)),{recursive:true});await fs.writeFile(path.join(runtime,name),'fixture data');
   await assert.rejects(prepareRuntime(runtime,process.cwd()),/Original application source|private runtime|environment/i);await assert.rejects(fs.access(path.join(runtime,'scripts')));
  }finally{await fs.rm(runtime,{recursive:true,force:true});}
 }
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
