import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,stat,symlink,unlink} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {spawn} from 'node:child_process';
const api=await import('../dist/config-target.js').catch(()=>({}));
test('target config exposes fixed local and remote preparation APIs',async()=>{
 assert.equal(typeof api.materializeTargetBundle,'function');
 const remote=await import('../dist/remote-bundle.js');
 assert.equal(typeof remote.materializeRemoteTargetBundle,'function');
});
const association={engine:'fixture-engine',endpoint:'unix:///fixture',epoch:0};
const input=()=>({release:{schemaVersion:1,release:'1.0.0',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(n=>[n,{reference:`example.org/${n}@sha256:${'a'.repeat(64)}`,architectures:['amd64']}]))},installationId:'00000000-0000-4000-8000-000000000001',architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1'});
function child(executable,args,input,env){const p=spawn(executable,args,{env,stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.stdin.end(input);const done=new Promise((resolve,reject)=>{p.once('error',reject);p.once('close',code=>resolve({code,stdout,stderr}));});return{p,done};}
async function fixture(fn){const root=await mkdtemp(path.join(os.tmpdir(),'castlink-config-target-'));try{const bin=path.join(root,'bin');await mkdir(bin,{mode:0o700});await writeFile(path.join(bin,'docker'),`#!${process.execPath}\nconsole.log(process.argv[2]==='info'?JSON.stringify({ID:'fixture-engine'}):JSON.stringify('unix:///fixture'));`,{mode:0o700});await fn(root,{...process.env,PATH:bin+path.delimiter+process.env.PATH});}finally{await rm(root,{recursive:true,force:true});}}
function executor(root,env,inject=''){return{async run(r){let source=r.args[1];if(r.executable==='python3'){source=`import pwd,os\nclass Principal: pw_uid=os.getuid();pw_dir=${JSON.stringify(root)}\npwd.getpwuid=lambda _:Principal()\n`+source;source=source.replace('import os,sys,json,stat,hashlib,secrets,re',inject+'\nimport os,sys,json,stat,hashlib,secrets,re');}else source=`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(root)}});`+source.replace('const fs=leaseFs,path=leasePath,crypto=leaseCrypto;',inject+'\nconst fs=leaseFs,path=leasePath,crypto=leaseCrypto;');return child(r.executable,[r.args[0],source],r.input,env).done;}};}
async function call(language,root,env,a=association,verifyOnly=false,inject=''){a={principal:process.getuid(),scope:path.join(root,'.castlink-target-operations'),...a};const e=executor(root,env,inject),directory=path.join(root,'bundle');if(language==='node')return api.materializeTargetBundle(input(),directory,e,a,verifyOnly);const remote=await import('../dist/remote-bundle.js');return remote.materializeRemoteTargetBundle(input(),{scopeRoot:root,directory},e,a,verifyOnly);}
for(const language of ['node','python']){
 test(`${language} actual config helper writes complete protected bundle, releases and verifies without rewriting`,()=>fixture(async(root,env)=>{
  const first=await call(language,root,env);assert.equal(first.operationEpoch,1);
  const names=['compose.yaml','livekit.yaml','postgres.env','web.env','receipt.json'],before=await Promise.all(names.map(n=>readFile(path.join(root,'bundle',n))));
  for(const n of names)assert.equal((await stat(path.join(root,'bundle',n))).mode&0o777,0o600);
  assert.equal(await stat(path.join(root,'.castlink-target-operations','active')).then(()=>true,()=>false),false);
  const second=await call(language,root,env,{...association,epoch:1},true);assert.equal(second.operationEpoch,2);assert.deepEqual(await Promise.all(names.map(n=>readFile(path.join(root,'bundle',n)))),before);
  await assert.rejects(call(language,root,env),x=>x.code===4);
 }));
 test(`${language} endpoint mismatch blocks every configuration effect`,()=>fixture(async(root,env)=>{
  await assert.rejects(call(language,root,env,{...association,endpoint:'unix:///other'}),x=>x.code===4);assert.equal(await stat(path.join(root,'bundle')).then(()=>true,()=>false),false);
 }));
 test(`${language} recorded attempt never recreates missing bundle`,()=>fixture(async(root,env)=>{
  await assert.rejects(call(language,root,env,association,true),x=>x.code===4);assert.equal(await stat(path.join(root,'bundle')).then(()=>true,()=>false),false);
 }));
 test(`${language} canonical scope rejects alias before config mutation`,()=>fixture(async(root,env)=>{
  const alias=path.join(root,'alias');await symlink(root,alias);const e=executor(root,env);if(language==='node')await assert.rejects(api.materializeTargetBundle(input(),path.join(alias,'bundle'),e,{...association,principal:process.getuid(),scope:path.join(root,'.castlink-target-operations')}));else{const remote=await import('../dist/remote-bundle.js');await assert.rejects(remote.materializeRemoteTargetBundle(input(),{scopeRoot:alias,directory:path.join(alias,'bundle')},e,{...association,principal:process.getuid(),scope:path.join(root,'.castlink-target-operations')}));}assert.equal(await stat(path.join(root,'bundle')).then(()=>true,()=>false),false);
 }));
 test(`${language} actual filesystem fault retains owner and blocks a services contender`,()=>fixture(async(root,env)=>{
  const inject=language==='node'?`const originalWrite=leaseFs.writeFileSync;leaseFs.writeFileSync=(fd,...args)=>{if(typeof fd==='number'&&require('fs').readlinkSync('/proc/self/fd/'+fd).endsWith('/web.env'))throw Error('PRIVATE-FAULT');return originalWrite(fd,...args)};`:`original_write=os.write\ndef fault(fd,data):\n if os.readlink('/proc/self/fd/'+str(fd)).endswith('/web.env'): raise ValueError('PRIVATE-FAULT')\n return original_write(fd,data)\nos.write=fault`;
  await assert.rejects(call(language,root,env,association,false,inject),x=>x.code===4&&!x.message.includes('PRIVATE-FAULT'));
  assert.ok(await stat(path.join(root,'.castlink-target-operations','active','owner.json')));
  const {nodeTargetLease}=await import('../dist/target-operation.js');const effect=path.join(root,'services-effect');const source=`require('os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(root)}});${nodeTargetLease}try{const l=acquireTargetOperation(${JSON.stringify({schemaVersion:1,root:path.join(root,'bundle'),installationId:input().installationId,kind:'services',engine:association.engine,epoch:0,principal:process.getuid(),scope:path.join(root,'.castlink-target-operations')})});dispatchTargetOperation(l);require('fs').writeFileSync(${JSON.stringify(effect)},'unsafe')}catch{process.exitCode=4}`;
  assert.equal((await child(process.execPath,['-e',source],undefined,env).done).code,4);assert.equal(await stat(effect).then(()=>true,()=>false),false);
 }));
 test(`${language} missing owned file cannot regenerate credentials`,()=>fixture(async(root,env)=>{
  await call(language,root,env);const web=await readFile(path.join(root,'bundle','web.env'));await unlink(path.join(root,'bundle','postgres.env'));await assert.rejects(call(language,root,env,{...association,epoch:1},true));assert.deepEqual(await readFile(path.join(root,'bundle','web.env')),web);
 }));
 test(`${language} concurrent actual config helpers cannot both own the same epoch`,()=>fixture(async(root,env)=>{
  const results=await Promise.allSettled([call(language,root,env),call(language,root,env)]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.filter(r=>r.status==='rejected').length,1);assert.equal(JSON.parse(await readFile(path.join(root,'.castlink-target-operations','epoch.json'),'utf8')).epoch,1);
 }));
 test(`${language} response loss after terminal release preserves credentials for observed retry`,()=>fixture(async(root,env)=>{
  const e=executor(root,env),lost={async run(r){await e.run(r);throw Error('PRIVATE-TRANSPORT')}};const directory=path.join(root,'bundle');if(language==='node')await assert.rejects(api.materializeTargetBundle(input(),directory,lost,{...association,principal:process.getuid(),scope:path.join(root,'.castlink-target-operations')}));else{const remote=await import('../dist/remote-bundle.js');await assert.rejects(remote.materializeRemoteTargetBundle(input(),{scopeRoot:root,directory},lost,{...association,principal:process.getuid(),scope:path.join(root,'.castlink-target-operations')}));}
  const before=await readFile(path.join(directory,'web.env'));assert.equal(await stat(path.join(root,'.castlink-target-operations','active')).then(()=>true,()=>false),false);await call(language,root,env,{...association,epoch:1},true);assert.deepEqual(await readFile(path.join(directory,'web.env')),before);
 }));
 test(`${language} failed endpoint POST leaves complete artifacts and a blocking lease`,()=>fixture(async(root,env)=>{
  const inject=language==='node'?`const engineRead=leaseEngine;let reads=0;leaseEngine=()=>{const actual=engineRead();if(++reads===3)actual.endpoint='unix:///changed';return actual};`:`engine_read=lease_engine\nengine_reads=0\ndef changed_engine():\n global engine_reads\n actual=engine_read();engine_reads+=1\n if engine_reads==3: actual['endpoint']='unix:///changed'\n return actual\nlease_engine=changed_engine`;
  await assert.rejects(call(language,root,env,association,false,inject));assert.ok(await stat(path.join(root,'bundle','receipt.json')));assert.ok(await stat(path.join(root,'.castlink-target-operations','active','owner.json')));await assert.rejects(call(language,root,env,association,true));
 }));
 for(const mutation of ['permissions','symlink','duplicate-receipt'])test(`${language} target retry rejects ${mutation} without rewriting`,()=>fixture(async(root,env)=>{
  await call(language,root,env);const file=path.join(root,'bundle','web.env'),before=await readFile(file);
  if(mutation==='permissions')await import('node:fs/promises').then(m=>m.chmod(file,0o644));
  if(mutation==='symlink'){const copy=path.join(root,'copy');await writeFile(copy,before,{mode:0o600});await unlink(file);await symlink(copy,file);}
  if(mutation==='duplicate-receipt'){const receipt=path.join(root,'bundle','receipt.json');await writeFile(receipt,(await readFile(receipt,'utf8')).replace('{','{"schemaVersion":1,'));}
  await assert.rejects(call(language,root,env,{...association,epoch:1},true));assert.deepEqual(await readFile(file),before);
 }));
}
test('Windows target writer rejects POSIX association before executing',async()=>{
 const descriptor=Object.getOwnPropertyDescriptor(process,'platform');let calls=0;
 try{Object.defineProperty(process,'platform',{value:'win32'});await assert.rejects(api.materializeTargetBundle(input(),'/private/bundle',{run(){calls++;throw Error()}},association),e=>e.code===2);assert.equal(calls,0);}finally{Object.defineProperty(process,'platform',descriptor);}
});
test('invalid local target data is redacted before invoking executor',async()=>{
 let calls=0;const e={run(){calls++;throw Error('unexpected')}};
 for(const i of [undefined,{...input(),extra:'PRIVATE-INPUT'},{...input(),installationId:()=> 'PRIVATE-INPUT'},{...input(),installationId:'bad'}])await assert.rejects(api.materializeTargetBundle(i,'/private/bundle',e,association),x=>x.code===2&&!x.message.includes('PRIVATE-INPUT'));
 assert.equal(calls,0);
});
