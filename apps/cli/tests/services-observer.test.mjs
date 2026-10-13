import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';import path from 'node:path';import {createHash} from 'node:crypto';
import {LocalExecutor} from '../dist/executors/local.js';
const id='a'.repeat(64),content='fixture admission and disabled access logs\n';
function archive(type='0',body=content,name='Caddyfile'){
 const header=Buffer.alloc(512);header.write(name);header.write('0000444\0',100);header.write('0000000\0',108);header.write('0000000\0',116);header.write(body.length.toString(8).padStart(11,'0')+'\0',124);header.write('00000000000\0',136);header.fill(32,148,156);header.write(type,156);header.write('ustar\0',257);header.write('00',263);const sum=header.reduce((a,b)=>a+b,0);header.write(sum.toString(8).padStart(6,'0')+'\0 ',148);return Buffer.concat([header,Buffer.from(body),Buffer.alloc((512-body.length%512)%512),Buffer.alloc(1024)]);
}
async function fixture(tar,run){const root=await mkdtemp(path.join(os.tmpdir(),'castlink-caddy-observer-')),before=process.env.PATH;try{await writeFile(path.join(root,'tar'),tar);await writeFile(path.join(root,'docker'),`#!${process.execPath}\nconst fs=require('node:fs');if(JSON.stringify(process.argv.slice(2))!==JSON.stringify(['cp','${id}:/etc/caddy/Caddyfile','-']))process.exit(8);process.stdout.write(fs.readFileSync(${JSON.stringify(path.join(root,'tar'))}));`,{mode:0o700});process.env.PATH=root+path.delimiter+before;await run(new LocalExecutor());}finally{process.env.PATH=before;await rm(root,{recursive:true,force:true});}}
for(const remote of [false,true])test(`actual ${remote?'Python':'Node'} helper hashes single regular Caddy config without returning bytes`,async()=>{
 const api=await import('../dist/services-observer.js').catch(()=>({}));assert.equal(typeof api.observeCaddyConfig,'function','bounded archive observer API missing');
 await fixture(archive(),async executor=>assert.equal(await api.observeCaddyConfig(id,executor,remote),createHash('sha256').update(content).digest('hex')));
});
for(const [label,tar] of [['link',archive('2')],['wrong path',archive('0',content,'secret.env')],['multiple members',Buffer.concat([archive().subarray(0,-1024),archive()])],['oversize',Buffer.alloc(262145)],['truncated',archive().subarray(0,700)],['trailing payload',Buffer.concat([archive(),Buffer.alloc(512,90),Buffer.alloc(1024)])],['checksum',(()=>{const x=archive();x[0]=90;return x;})()]])for(const remote of [false,true])test(`actual observer refuses ${label} ${remote}`,async()=>{
 const api=await import('../dist/services-observer.js').catch(()=>({}));assert.equal(typeof api.observeCaddyConfig,'function','bounded archive observer API missing');await fixture(tar,async executor=>await assert.rejects(()=>api.observeCaddyConfig(id,executor,remote),e=>e.code===4&&!e.message.includes(content)));
});
