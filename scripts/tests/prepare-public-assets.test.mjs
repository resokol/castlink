import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../../',import.meta.url));

test('fresh dev and build stage complete local themes and replace stale generated files',async()=>{
 const source=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-public-assets-'));
 try {
  const web=path.join(source,'apps/web'),publicDirectory=path.join(web,'public');
  await fs.cp(path.join(root,'apps/web/scripts'),path.join(web,'scripts'),{recursive:true});
  await fs.cp(path.join(root,'design-preview/new'),path.join(source,'design-preview/new'),{recursive:true});
  // Model the installed PDF dependency so preparation runs without a package manager or network.
  const vendor=path.join(web,'node_modules/pdfjs-dist');
  await fs.mkdir(path.join(vendor,'build'),{recursive:true});
  await fs.writeFile(path.join(vendor,'package.json'),JSON.stringify({name:'pdfjs-dist',version:'6.4.299'}));
  await fs.writeFile(path.join(vendor,'build/pdf.worker.min.mjs'),'// fixture PDF worker');
  await fs.writeFile(path.join(vendor,'LICENSE'),'fixture PDF license');
  await fs.mkdir(publicDirectory,{recursive:true});
  await fs.writeFile(path.join(publicDirectory,'keep.txt'),'unrelated public file');
  const {scripts}=JSON.parse(await fs.readFile(path.join(root,'apps/web/package.json'),'utf8'));
  for(const name of ['dev','build']) {
   const preparation=scripts[name].split('&&')[0].trim();
   const match=/^node\s+(\S+)$/.exec(preparation);
   assert.ok(match,`${name} prepares public assets before starting Next`);
   const result=spawnSync(process.execPath,[match[1]],{cwd:web,encoding:'utf8'});
   assert.equal(result.status,0,result.stderr||result.stdout);
   const pending=['/new/live-theme.css'],checked=new Set();
   while(pending.length) {
    const url=pending.pop();if(checked.has(url))continue;checked.add(url);
    const file=path.join(publicDirectory,url.slice(1));
    assert.ok((await fs.stat(file)).isFile(),`${name}: ${url} is served from public`);
    if(!url.endsWith('.css'))continue;
    const css=await fs.readFile(file,'utf8');
    for(const [,reference] of css.matchAll(/url\(\s*['"]?([^'"\s)]+)['"]?\s*\)/g)) {
     const resolved=new URL(reference,'http://fixture'+url);
     assert.equal(resolved.origin,'http://fixture','theme assets remain local');
     pending.push(resolved.pathname);
    }
   }
   assert.ok(checked.has('/new/special-theme.css'),'live theme imports its surface styles');
   assert.ok(checked.has('/new/assets/font-4.woff2'),'local font imports are complete');
   for(const relative of checked)assert.deepEqual(await fs.readFile(path.join(publicDirectory,relative.slice(1))),await fs.readFile(path.join(root,'design-preview',relative.slice(1))));
   await fs.access(path.join(publicDirectory,'new/features.html'));
   await fs.access(path.join(publicDirectory,'new/assets/Manrope-OFL.txt'));
   assert.equal(await fs.readFile(path.join(publicDirectory,'pdfjs/pdf.worker.min.mjs'),'utf8'),'// fixture PDF worker');
   assert.equal(await fs.readFile(path.join(publicDirectory,'keep.txt'),'utf8'),'unrelated public file');
   if(name==='dev') {
    await fs.writeFile(path.join(publicDirectory,'new/stale.css'),'orphaned asset');
    await fs.writeFile(path.join(publicDirectory,'new/live-theme.css'),'stale theme');
   } else await assert.rejects(fs.access(path.join(publicDirectory,'new/stale.css')));
  }
 } finally {await fs.rm(source,{recursive:true,force:true});}
});
