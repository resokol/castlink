import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
const python=process.env.CASTLINK_PYTHON||(process.platform==='win32'?'python':'python3');
const auditor=path.resolve('scripts/audit-release-artifacts.py');
function refused(archive){assert.throws(()=>execFileSync(python,[auditor,'--image',archive],{stdio:'pipe'}),error=>error.status===1&&/Refused artifact/.test(error.stderr?.toString()||''));}
async function imageArchive(root,files,removed=false){
 const content=path.join(root,'content');await fs.mkdir(content,{recursive:true});
 for(const name of files){await fs.mkdir(path.dirname(path.join(content,name)),{recursive:true});await fs.writeFile(path.join(content,name),'fixture file, not real credentials');}
 execFileSync('tar',['-cf',path.join(root,'first.tar'),'-C',content,'.']);
 const layers=['first.tar'];
 if(removed){await fs.rm(content,{recursive:true});await fs.mkdir(path.join(content,'app'),{recursive:true});await fs.writeFile(path.join(content,'app/.wh.original.ts'),'');execFileSync('tar',['-cf',path.join(root,'second.tar'),'-C',content,'.']);layers.push('second.tar');}
 await fs.writeFile(path.join(root,'manifest.json'),JSON.stringify([{RepoTags:['castlink-easy-web:fixture'],Config:'config.json',Layers:layers}]));
 const archive=path.join(root,'images.tar.gz');execFileSync('tar',['-czf',archive,'-C',root,'manifest.json',...layers]);return archive;
}
test('every image layer is checked even if a later whiteout removes leaked source',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-layer-audit-'));
 try{const archive=await imageArchive(root,['app/original.ts'],true);refused(archive);}finally{await fs.rm(root,{recursive:true,force:true});}
});
test('owned source, env, private directories and maps refuse distribution; vendor types and maps remain allowed',async()=>{
 for(const name of ['app/apps/web/app/page.js','app/apps/web/.next/server/app.js.map','app/nested/.env.local','app/nested/control.env.example','app/nested/.git/config','docs/private-notes.md']){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-artifact-refusal-'));
  try{const archive=await imageArchive(root,[name]);refused(archive);}finally{await fs.rm(root,{recursive:true,force:true});}
 }
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-artifact-vendor-'));
 try{const archive=await imageArchive(root,['app/apps/web/.next/server/app/page.js','app/node_modules/vendor/index.d.ts','app/node_modules/vendor/index.js.map','app/scripts/operator.mjs']);const result=JSON.parse(execFileSync(python,[auditor,'--image',archive],{encoding:'utf8'}));assert.equal(result.passed,true);assert.equal(result.layers,1);assert.equal(result.vendorSources,2);}finally{await fs.rm(root,{recursive:true,force:true});}
});
