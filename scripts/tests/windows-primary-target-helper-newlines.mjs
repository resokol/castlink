import assert from 'node:assert/strict';
import {test} from 'node:test';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';

const names=['setup-database-v1.mjs','super-admin-owner.mjs','setup-observe-v1.mjs'];
const imageHelperHashes=['841519c5d0234b2e9c9e50c07401ae6354557dfb423416bdd9702f7f5c812b4b','1a2663ab0f55660f2d26bd3440fac5d9d581f09c8c61649a3889d6dc5c40e5c7','0170552faba1a12275cb6b7bb6a30b1b6355b349eb95de34d16edebbc8db0413'];
const canonicalLF=b=>Buffer.from(b.toString('utf8').replace(/\r\n/g,'\n'));
const sha=b=>createHash('sha256').update(b).digest('hex');
const generator=await readFile(new URL('../windows-primary-target-helper-inventory.mjs',import.meta.url));
async function render(transform){
 const root=await mkdtemp(path.join(tmpdir(),'castlink-helper-newlines-'));
 try{
  await writeFile(path.join(root,'inventory.mjs'),generator);
  const input=[];
  for(const name of names){const bytes=transform(await readFile(new URL('../'+name,import.meta.url)));input.push(bytes);await writeFile(path.join(root,name),bytes);}
  const result=await (await import(pathToFileURL(path.join(root,'inventory.mjs')).href)).renderTargetHelperSourceInventory();
  return{...result,input};
 }finally{await rm(root,{recursive:true,force:true});}
}
test('actual fixed generator emits identical canonical helper hashes/header for CRLF checkout',async()=>{
 const lf=await render(canonicalLF),crlf=await render(b=>Buffer.from(canonicalLF(b).toString('utf8').replace(/\n/g,'\r\n')));
 assert.equal(crlf.header,lf.header);
 for(let i=0;i<3;i++){
  const a=lf.receipt.entries[i],b=crlf.receipt.entries[i];
  assert.equal(a.sha256,sha(lf.input[i]));assert.equal(a.sha256,imageHelperHashes[i]);assert.equal(b.sha256,a.sha256);
  assert.equal(b.bytes,a.bytes);assert.equal(b.sourceMaterialization.sha256,sha(crlf.input[i]));
  assert.equal(b.sourceMaterialization.bytes,crlf.input[i].length);assert.notEqual(b.sourceMaterialization.sha256,a.sha256);
  assert.equal(lf.receipt.sourceAssociationOnly,true);assert.equal(crlf.receipt.runtimeContainerContent,'unverified');
 }
});
test('content changes are retained and change exact expected helper hash',async()=>{
 const a=await render(b=>b),b=await render(b=>Buffer.concat([b,Buffer.from('// content change\n')]));
 for(let i=0;i<3;i++)assert.notEqual(a.receipt.entries[i].sha256,b.receipt.entries[i].sha256);
 assert.notEqual(a.header,b.header);
});
test('invalid UTF8 and standalone CR are refused rather than repaired',async()=>{
 await assert.rejects(render(b=>Buffer.concat([b,Buffer.from([255])])),/Fixed helper source refused/);
 await assert.rejects(render(b=>Buffer.concat([b,Buffer.from('\r')])),/Fixed helper source refused/);
});
