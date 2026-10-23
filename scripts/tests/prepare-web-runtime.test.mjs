import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {prepareRuntime,operatorScripts,cameraEffectAssets} from '../prepare-web-runtime.mjs';
import {removePresentationAssets,preparePdfAssets} from '../../apps/web/scripts/prepare-pdf-assets.mjs';

test('runtime serves allowlisted PDF assets and excludes disabled native helper assets while keeping other public files, vendor notices and operator programs',async()=>{
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
   ...Object.fromEntries(cameraEffectAssets.map(name=>['camera-effects/'+name,'camera effect '+name])),
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
  // Next standalone tracing omits public artwork. Stage the actual approved
  // smileys only in the source tree so this catches missing runtime copies.
  const emoticons=await fs.readdir('apps/web/public/emoticons');
  assert.equal(emoticons.filter(name=>name.endsWith('.svg')).length,24);
  await fs.cp('apps/web/public/emoticons',path.join(source,'apps/web/public/emoticons'),{recursive:true});
  for(const [name,bytes] of Object.entries(publicFiles)){const file=path.join(source,'apps/web/public',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
  for(const name of ['private.ts','worker.mjs.map','original.js','wasm/original-app.js','wasm/source.ts','cmaps/.env','helpers/arbitrary.ps1']){
   const file=path.join(source,'apps/web/public/pdfjs',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'must not enter runtime');
  }
  await fs.writeFile(path.join(source,'apps/web/public/helpers/other.ps1'),'not allowlisted');
  const pdfVendor=path.join(source,'apps/web/node_modules/pdfjs-dist');await fs.mkdir(path.join(pdfVendor,'standard_fonts'),{recursive:true});await fs.mkdir(path.join(pdfVendor,'wasm'),{recursive:true});
  for(const [name,bytes] of Object.entries(publicFiles)){if(!name.startsWith('pdfjs/')||name==='pdfjs/.version')continue;const relative=name==='pdfjs/pdf.worker.min.mjs'?'build/pdf.worker.min.mjs':name.slice(6);const file=path.join(pdfVendor,relative);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
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
  // Remove stale presentation downloads from an earlier prepared tree too.
  for(const [name,bytes] of Object.entries(publicFiles)){const file=path.join(runtime,'apps/web/public',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,bytes);}
  for(const name of ['icons/keep.svg','helpers/unrelated.txt']){const file=path.join(runtime,'apps/web/public',name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'unrelated public asset');}
  await prepareRuntime(runtime,source);
  for(const name of emoticons)assert.deepEqual(await fs.readFile(path.join(runtime,'apps/web/public/emoticons',name)),await fs.readFile(path.join(source,'apps/web/public/emoticons',name)),name+' preserves original runtime artwork');
  if(process.env.CASTLINK_RUNTIME_QA_PUBLIC)await fs.cp(path.join(runtime,'apps/web/public'),process.env.CASTLINK_RUNTIME_QA_PUBLIC,{recursive:true});
  assert.equal(await fs.readFile(path.join(runtime,'LICENSE'),'utf8'),await fs.readFile('LICENSE','utf8'));
  assert.equal(await fs.readFile(path.join(runtime,'apps/web/node_modules/pg/LICENSE'),'utf8'),vendorNotice);
  assert.equal(await fs.readFile(path.join(runtime,'apps/web/node_modules/ssh2/LICENSE'),'utf8'),'SSH dependency license notice\n');
  for(const name of operatorScripts)assert.deepEqual(await fs.readFile(path.join(runtime,'scripts',name)),await fs.readFile(path.join('scripts',name)));
  await assert.rejects(fs.access(path.join(runtime,'node_modules/.pnpm/typescript@fixture')));
  await assert.rejects(fs.access(path.join(runtime,'apps/web/app')));
  await assert.rejects(fs.access(path.join(runtime,'scripts/optional/presentation')));
  assert.deepEqual(await fs.readFile(path.join(runtime,'infrastructure/postgres/004_room_creator_access.sql')),await fs.readFile('infrastructure/postgres/004_room_creator_access.sql'));
  await assert.rejects(fs.access(path.join(runtime,'infrastructure/control-plane/control-plane.env.example')));
  assert.equal(await fs.readFile(path.join(runtime,'third_party/npm/livekit-client@1.0.0/LICENSE'),'utf8'),'Browser-only Apache notice\n');
  assert.equal(await fs.readFile(path.join(runtime,'THIRD_PARTY_NOTICES'),'utf8'),'Fixture third-party index\n');
  assert.equal(await fs.readFile(path.join(runtime,'distribution/README.md'),'utf8'),'Fixture distribution guide\n');
  for(const name of Object.keys(publicFiles)){if(name.startsWith('pdfjs/')||name.startsWith('camera-effects/'))assert.equal(await fs.readFile(path.join(runtime,'apps/web/public',name),'utf8'),publicFiles[name]);else await assert.rejects(fs.access(path.join(runtime,'apps/web/public',name)));}
  for(const name of ['icons/keep.svg','helpers/unrelated.txt'])assert.equal(await fs.readFile(path.join(runtime,'apps/web/public',name),'utf8'),'unrelated public asset');
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


test('disabled build preparation removes source public presentation downloads and PDF cache only',async()=>{
 const publicDirectory=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-disabled-public-'));
 try{
  const disabled=['helpers/CastLink-PowerPoint-Windows.ps1','helpers/CastLink-PowerPoint-macOS.js','pdfjs/pdf.worker.min.mjs','pdfjs/cmaps/legacy.bcmap'];
  const retained=['icons/logo.svg','helpers/unrelated.txt'];
  for(const name of [...disabled,...retained]){const file=path.join(publicDirectory,name);await fs.mkdir(path.dirname(file),{recursive:true});await fs.writeFile(file,'fixture');}
  await removePresentationAssets(publicDirectory);
  for(const name of disabled)await assert.rejects(fs.access(path.join(publicDirectory,name)));
  for(const name of retained)assert.equal(await fs.readFile(path.join(publicDirectory,name),'utf8'),'fixture');
  await removePresentationAssets(publicDirectory); // Safe on clean/repeated builds.
  await preparePdfAssets(publicDirectory);
  assert.ok((await fs.stat(path.join(publicDirectory,'pdfjs/pdf.worker.min.mjs'))).size>1000);
  for(const name of ['helpers/CastLink-PowerPoint-Windows.ps1','helpers/CastLink-PowerPoint-macOS.js'])await assert.rejects(fs.access(path.join(publicDirectory,name)));
 }finally{await fs.rm(publicDirectory,{recursive:true,force:true});}
});
