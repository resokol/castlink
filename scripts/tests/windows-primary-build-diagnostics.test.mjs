import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, readFile, rm, writeFile} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {retainPrimaryCompileDiagnostics} from '../windows-primary-build-diagnostics.mjs';

async function fixture(run) { const p=await mkdtemp(path.join(os.tmpdir(),'primary-compile-proof-'));try{await run(p);}finally{await rm(p,{recursive:true,force:true});} }
test('failed link retains exact bounded output and numeric failure without exception text',()=>fixture(async p=>{
  const r=await retainPrimaryCompileDiagnostics(p,{status:1,signal:null,stdout:'object compiled\n',stderr:'linker failure\n',error:null});
  assert.equal(r.status,1);assert.equal(r.nativeExecution,'not-run');assert.equal(await readFile(path.join(p,'BUILD-STDERR.log'),'utf8'),'linker failure\n');
  assert.deepEqual(JSON.parse(await readFile(path.join(p,'BUILD-DIAGNOSTIC.json'),'utf8')),r);
}));
test('spawn error keeps null status and finite code, omitting arbitrary messages',()=>fixture(async p=>{
  const r=await retainPrimaryCompileDiagnostics(p,{status:null,signal:null,error:{code:'ENOENT',message:'must not be copied'},stdout:null,stderr:null});
  assert.equal(r.status,null);assert.equal(r.errorCode,'ENOENT');assert.equal(JSON.stringify(r).includes('must not'),false);
}));
test('oversized output refuses before creating diagnostic files',()=>fixture(async p=>{
  await assert.rejects(retainPrimaryCompileDiagnostics(p,{status:1,stdout:'x'.repeat(1048577),stderr:''}));
  await assert.rejects(readFile(path.join(p,'BUILD-STDOUT.log')),{code:'ENOENT'});
}));
test('existing retained output is never overwritten',()=>fixture(async p=>{
  const f=path.join(p,'BUILD-STDOUT.log');await writeFile(f,'original');
  await assert.rejects(retainPrimaryCompileDiagnostics(p,{status:1,stdout:'replacement',stderr:''}),{code:'EEXIST'});
  assert.equal(await readFile(f,'utf8'),'original');
}));
