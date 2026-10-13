import {test} from 'node:test';import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,lstat,rm} from 'node:fs/promises';import os from 'node:os';import path from 'node:path';
import {restoreTarget} from '../dist/restore-target.js';import {LocalExecutor} from '../dist/executors/local.js';
for(const changed of ['principal','scope'])test(`actual cold restore helper refuses changed ${changed} before private target writes`,async()=>{
 const home=await mkdtemp(path.join(os.tmpdir(),'castlink-restore-binding-'));try{
 const root=path.join(home,'bundle'),backup=path.join(home,'backup'),attempt=path.join(home,'attempt'),scope=path.join(home,'.castlink-target-operations');await mkdir(root,{mode:0o700});await mkdir(backup,{mode:0o700});const secret=Buffer.from('PRIVATE_RETAINED_CREDENTIAL');await writeFile(path.join(root,'web.env'),secret,{mode:0o600});
 const payload={root,backupDirectory:backup,attemptDirectory:attempt,installationId:'00000000-0000-4000-8000-000000000001',engine:'retained-engine',endpoint:'unix:///var/run/docker.sock',epoch:0,principal:process.getuid(),scope,manifest:{},containers:[{},{},{},{}],volumes:[{},{},{},{}],networks:[{}],protectedFiles:{}};if(changed==='principal')payload.principal++;else payload.scope=path.join(home,'foreign','.castlink-target-operations');
 const source=`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(home)}});`+restoreTarget;
 const result=await new LocalExecutor().run({executable:process.execPath,args:['-e',source],input:Buffer.from(JSON.stringify(payload)),sensitive:true});assert.equal(result.code,4);assert.equal(result.stdout+result.stderr,'');await assert.rejects(lstat(scope),e=>e.code==='ENOENT');await assert.rejects(lstat(attempt),e=>e.code==='ENOENT');assert.deepEqual(await readFile(path.join(root,'web.env')),secret);
 }finally{await rm(home,{recursive:true,force:true})}
});
