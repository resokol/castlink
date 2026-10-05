import{test}from'node:test';import assert from'node:assert/strict';import{mkdtemp,readFile,stat,rm}from'node:fs/promises';import path from'node:path';import os from'node:os';
import{writeSecretFile}from'../dist/secrets.js';
test('protected secret writes preserve exact content and never overwrite a prior secret',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-secrets-'));const file=path.join(root,'private','owner-token');
 try{await writeSecretFile(file,'protected-fixture',process.platform);assert.equal(await readFile(file,'utf8'),'protected-fixture');await assert.rejects(writeSecretFile(file,'replacement',process.platform),/exist/i);assert.equal(await readFile(file,'utf8'),'protected-fixture');if(process.platform!=='win32')assert.equal((await stat(file)).mode&0o777,0o600);}finally{await rm(root,{recursive:true,force:true});}
});

test('Windows protection removes pre-existing explicit access for other users',{skip:process.platform!=='win32'},async()=>{
 const {execFile}=await import('node:child_process');const {promisify}=await import('node:util');const execute=promisify(execFile);
 const {ensurePrivateDirectory}=await import('../dist/secrets.js');
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-explicit-acl-'));
 try{
  await execute('icacls.exe',[root,'/grant','*S-1-1-0:(OI)(CI)F']);
  await ensurePrivateDirectory(root);
  const script='$a=Get-Acl -LiteralPath $env:CASTLINK_ACL_TEST_PATH; $a.Access | ForEach-Object { $_.IdentityReference.Translate([System.Security.Principal.SecurityIdentifier]).Value }';
  const result=await execute('powershell.exe',['-NoProfile','-NonInteractive','-Command',script],{env:{...process.env,CASTLINK_ACL_TEST_PATH:root}});
  const ids=result.stdout.trim().split(/\r?\n/);assert.equal(ids.length,2);assert.ok(ids.includes('S-1-5-18'));assert.ok(!ids.includes('S-1-1-0'));
 }finally{await rm(root,{recursive:true,force:true});}
});
