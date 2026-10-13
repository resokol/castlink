// Real shared lease/private filesystem; fixed Docker info/context adapter only.
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {spawnSync} from 'node:child_process';import {fileURLToPath} from 'node:url';
export const dist=fileURLToPath(new URL('../dist/',import.meta.url)),id='12345678-1234-4123-8123-123456789abc';
export const capability={kind:'castlink-idleseal-private-v2',version:'1.13.7+castlink-idleseal-private.2',imageId:'sha256:b3ddff3a9605095a8da4b45e55b1d238cc1db51f4e3e896ff45e1815fc64c90f',binarySHA256:'7fc823d552d9438914eba9c8878714a56038a3f324bdb6e763bc0998783d7d41',uid:1000,gid:1000};
export function configFixture(fn){
 const home=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-capability-config-'));
 try{
  const scope=home+'/.castlink-target-operations',root=home+'/bundle',bin=home+'/bin';fs.mkdirSync(bin,{mode:0o700});fs.writeFileSync(bin+'/docker',`#!${process.execPath}\nconsole.log(process.argv[2]==='info'?'{"ID":"fixture-engine"}':'"unix:///fixture"');`,{mode:0o700});
  const input={release:{schemaVersion:2,release:'3.0.0',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(n=>[n,{reference:'example.org/'+n+'@sha256:'+'a'.repeat(64),architectures:['amd64']}])),privateControl:{...capability}},installationId:id,architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1',controlScope:scope};
  const association={engine:'fixture-engine',endpoint:'unix:///fixture',epoch:0,principal:1000,scope};
  const run=(epoch=0,verifyOnly=false,patch={},inject='')=>spawnSync(process.execPath,['--input-type=module','-e',`import os from 'node:os';os.userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(home)}});import {materializeTargetBundle} from ${JSON.stringify(dist+'config-target.js')};import {spawnSync} from 'node:child_process';const executor={run:async q=>{const p=spawnSync(process.execPath,[q.args[0],${JSON.stringify(`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(home)}});`)}+q.args[1].replace('const fs=leaseFs,path=leasePath,crypto=leaseCrypto;',${JSON.stringify(inject)}+'const fs=leaseFs,path=leasePath,crypto=leaseCrypto;')],{input:q.input,env:process.env,encoding:'utf8',timeout:20000,maxBuffer:32768});return{code:p.status,stdout:p.stdout,stderr:p.stderr}}};try{const r=await materializeTargetBundle(${JSON.stringify({...input,...patch})},${JSON.stringify(root)},executor,${JSON.stringify({...association,epoch})},${verifyOnly});console.log(JSON.stringify(r));}catch(e){console.log('private-config-refused');process.exitCode=4}`],{env:{...process.env,PATH:bin+path.delimiter+process.env.PATH},encoding:'utf8',timeout:30000,maxBuffer:32768});
  fn({home,scope,root,control:scope+'/livekit-control-'+id,input,association,run});
 }finally{fs.rmSync(home,{recursive:true,force:true})}
}
