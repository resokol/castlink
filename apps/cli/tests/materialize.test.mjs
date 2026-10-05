import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,stat,rm,mkdir,writeFile,symlink,readdir} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const module=await import('../dist/bundle.js');
const manifest=()=>({schemaVersion:1,release:'1.0.0-rc.2',nodeVersion:'22.23.3',architectures:['amd64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,{reference:`example.org/${name}@sha256:${'a'.repeat(64)}`,architectures:['amd64']}]))});
const input=()=>({release:manifest(),installationId:'00000000-0000-4000-8000-000000000001',architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1'});
const materialize=(...args)=>{assert.equal(typeof module.materializeBundle,'function','materializeBundle must exist');return module.materializeBundle(...args);};
async function temporary(run){const root=await mkdtemp(path.join(os.tmpdir(),'castlink-materialize-'));try{await run(root);}finally{await rm(root,{recursive:true,force:true});}}
const env=text=>Object.fromEntries(text.trim().split('\n').map(line=>{const at=line.indexOf('=');return [line.slice(0,at),line.slice(at+1)];}));
test('materializes matching protected credentials and fixed LiveKit candidate ports without returning secrets',()=>temporary(async root=>{
 const output=await materialize(input(),path.join(root,'studio ü $ data'));
 const web=env(await readFile(output.secretFiles.webEnv,'utf8')),pg=env(await readFile(output.secretFiles.postgresEnv,'utf8'));
 const livekit=await readFile(output.secretFiles.livekitConfig,'utf8');const parsed=JSON.parse(livekit);
 assert.equal(web.DATABASE_URL,`postgresql://castlink:${pg.POSTGRES_PASSWORD}@postgres:5432/castlink`);
 assert.equal(parsed.keys[web.LIVEKIT_API_KEY],web.LIVEKIT_API_SECRET);
 assert.equal(parsed.rtc.node_ip,'127.0.0.1');assert.equal(parsed.rtc.use_external_ip,false);
 assert.equal(parsed.rtc.tcp_port,7881);assert.equal(parsed.rtc.port_range_start,61000);assert.equal(parsed.rtc.port_range_end,61100);
 assert.equal(parsed.port,7880);assert.equal(parsed.rtc.enable_loopback_candidate,true);
 assert.equal(web.CASTLINK_DEPLOYMENT_MODEL,'self-hosted');assert.equal(web.CASTLINK_STORAGE_BACKEND,'json');
 for(const key of ['CASTLINK_SETUP_TOKEN','CASTLINK_SESSION_SECRET','CASTLINK_DATA_ENCRYPTION_KEY','CASTLINK_NODE_SECRET'])assert.match(web[key],/^[a-f0-9]{64}$/);
 const publicOutput=JSON.stringify(output);for(const secret of [pg.POSTGRES_PASSWORD,web.LIVEKIT_API_SECRET,web.CASTLINK_SETUP_TOKEN])assert.ok(!publicOutput.includes(secret));
 const compose=await readFile(output.composePath,'utf8');assert.ok(!compose.includes(pg.POSTGRES_PASSWORD));assert.ok(output.checks.some(x=>x.id==='media'&&x.state==='unverified'));
 if(process.platform!=='win32'){for(const file of [...Object.values(output.secretFiles),output.composePath])assert.equal((await stat(file)).mode&0o777,0o600);assert.equal((await stat(path.dirname(output.composePath))).mode&0o777,0o700);}
}));
test('refuses existing installations without changing credentials or foreign files',()=>temporary(async root=>{
 const destination=path.join(root,'bundle');const first=await materialize(input(),destination);const original=await readFile(first.secretFiles.webEnv,'utf8');
 await assert.rejects(materialize(input(),destination),error=>error.code===4 && !error.message.includes(destination));assert.equal(await readFile(first.secretFiles.webEnv,'utf8'),original);
 const foreign=path.join(root,'foreign');await mkdir(foreign);await writeFile(path.join(foreign,'keep'),'foreign');await assert.rejects(materialize(input(),foreign));assert.equal(await readFile(path.join(foreign,'keep'),'utf8'),'foreign');
}));
test('invalid candidates create no directory and do not disclose attacker strings',()=>temporary(async root=>{
 const candidate=input();candidate.release.images.web.reference='secret-attacker-fixture';
 await assert.rejects(materialize(candidate,path.join(root,'bundle')),error=>!String(error).includes('secret-attacker-fixture'));assert.deepEqual(await readdir(root),[]);
}));
test('refuses symlink ancestors and nonabsolute destinations before writing',{skip:process.platform==='win32'},()=>temporary(async root=>{
 const actual=path.join(root,'actual'),link=path.join(root,'link');await mkdir(actual);await symlink(actual,link);
 await assert.rejects(materialize(input(),path.join(link,'bundle')),/symbolic|symlink/i);assert.deepEqual(await readdir(actual),[]);
 await assert.rejects(materialize(input(),'relative-path'),/absolute/i);
}));
test('competing materializations have one winner and preserve its credentials',()=>temporary(async root=>{
 const results=await Promise.allSettled([materialize(input(),path.join(root,'bundle')),materialize(input(),path.join(root,'bundle'))]);
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);assert.equal(results.filter(x=>x.status==='rejected').length,1);
}));
test('LAN candidate uses the selected host address and independent installations receive different secrets',()=>temporary(async root=>{
 const candidate={...input(),network:'lan',bindIPv4:'192.168.1.40'};
 const first=await materialize(candidate,path.join(root,'first')),second=await materialize(candidate,path.join(root,'second'));
 const config=JSON.parse(await readFile(first.secretFiles.livekitConfig,'utf8'));assert.equal(config.rtc.node_ip,'192.168.1.40');assert.equal(config.rtc.enable_loopback_candidate,false);
 const a=env(await readFile(first.secretFiles.webEnv,'utf8')),b=env(await readFile(second.secretFiles.webEnv,'utf8'));
 for(const key of ['LIVEKIT_API_SECRET','CASTLINK_SETUP_TOKEN','CASTLINK_SESSION_SECRET','CASTLINK_DATA_ENCRYPTION_KEY','CASTLINK_NODE_SECRET'])assert.notEqual(a[key],b[key]);
}));
test('failure after private directory creation redacts raw errors and blocks credential regeneration',()=>temporary(async root=>{
 const {default:crypto}=await import('node:crypto');const {syncBuiltinESMExports}=await import('node:module');const {mock}=await import('node:test');
 const original=crypto.randomBytes;const mocked=mock.method(crypto,'randomBytes',()=>{throw new Error('secret-failure-fixture');});syncBuiltinESMExports();
 const destination=path.join(root,'partial');
 try{await assert.rejects(materialize(input(),destination),error=>error.code===1 && !String(error).includes('secret-failure-fixture'));assert.equal((await stat(destination)).isDirectory(),true);}
 finally{mocked.mock.restore();crypto.randomBytes=original;syncBuiltinESMExports();}
 await assert.rejects(materialize(input(),destination),error=>error.code===4);assert.deepEqual(await readdir(destination),[]);
}));
