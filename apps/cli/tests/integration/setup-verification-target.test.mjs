import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,rm,symlink,chmod,lstat} from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import {createHash} from 'node:crypto';
import {execFile,spawn} from 'node:child_process';
import {promisify} from 'node:util';
const exec=promisify(execFile);
const hash=v=>createHash('sha256').update(v).digest('hex');

const request={schemaVersion:1,installationId:'11111111-1111-4111-8111-111111111111',nodeId:'srv-11111111111141118111111111111111',origin:'https://127.0.0.1',serverName:'studio'};
async function fixture(run){const root=await mkdtemp(path.join(os.tmpdir(),'castlink-setup-observe-'));try{await mkdir(path.join(root,'runtime'),{mode:0o700});await run(root);}finally{await rm(root,{recursive:true,force:true});}}
async function targetApi(){const module=await import('../../dist/setup-verification.js').catch(()=>({}));assert.equal(typeof module.observeSetupTarget,'function','fixed HTTPS target observer is missing');return module;}
async function association(file){const s=await lstat(file);return{dev:s.dev,ino:s.ino,mode:s.mode&0o777,sha256:hash(await readFile(file))};}
async function tlsFixture(run){await fixture(async root=>{
 const bin=path.join(root,'bin'),bundle=path.join(root,'bundle');await mkdir(bin,{mode:0o700});await mkdir(bundle,{mode:0o700});
 await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',root+'/ca.key','-out',root+'/ca.crt','-days','1','-subj','/CN=CastLink fixture CA','-addext','basicConstraints=critical,CA:TRUE']);
 await exec('openssl',['req','-newkey','rsa:2048','-nodes','-keyout',root+'/server.key','-out',root+'/server.csr','-subj','/CN=127.0.0.1']);
 await writeFile(root+'/ext','subjectAltName=IP:127.0.0.1\nbasicConstraints=CA:FALSE\n');
 await exec('openssl',['x509','-req','-in',root+'/server.csr','-CA',root+'/ca.crt','-CAkey',root+'/ca.key','-CAcreateserial','-out',root+'/server.crt','-days','1','-extfile',root+'/ext']);
 await writeFile(root+'/root.crt',await readFile(root+'/ca.crt'));await chmod(root+'/root.crt',0o644);
 const owner=root+'/owner-invite.txt',ownerBytes=request.origin+'/super-admin#access=csa2.'+'a'.repeat(43)+'\n';await writeFile(owner,ownerBytes,{mode:0o600});
 const files={};for(const name of ['compose.yaml','web.env','postgres.env','livekit.yaml']){await writeFile(bundle+'/'+name,name==='web.env'?'CASTLINK_SETUP_TOKEN='+'b'.repeat(64)+'\n':name+'\n',{mode:0o600});files[name]=await association(bundle+'/'+name);}
 const req={...request,release:'1.0.0-rc.2',root:bundle,files,ownerFile:owner,ownerAssociation:await association(owner),webContainerId:'a'.repeat(64),caddyContainerId:'c'.repeat(64),webImageId:'sha256:'+'a'.repeat(64),caddyImageId:'sha256:'+'c'.repeat(64),complete:false,attempt:null};
 const metadata={...request,contract:'castlink-setup-observe-v1',sql:'verified',ownerAccess:'invite',setup:'pending'};await writeFile(root+'/metadata.json',JSON.stringify(metadata));
 await writeFile(bin+'/docker',`#!${process.execPath}\nconst fs=require('node:fs'),{spawnSync}=require('node:child_process');const a=process.argv.slice(2),root=${JSON.stringify(root)};if(a[0]==='inspect'){const web=a.at(-1)==='${req.webContainerId}';console.log(JSON.stringify({Id:a.at(-1),Image:'sha256:'+(web?'a':'c').repeat(64),Running:true}));}else if(a[0]==='cp'){const name=a[1].endsWith('root.crt')?'root.crt':'owner-invite.txt';const r=spawnSync('tar',['--format=ustar','-C',root,'-cf','-',name]);process.stdout.write(r.stdout);process.exitCode=r.status;}else if(a[0]==='exec'){process.stdin.resume();process.stdin.on('end',()=>process.stdout.write(fs.readFileSync(root+'/metadata.json')));}else process.exitCode=9;\n`,{mode:0o700});
 const executor={run:r=>new Promise((resolve,reject)=>{const p=spawn(r.executable,r.args,{env:{...process.env,PATH:bin+path.delimiter+process.env.PATH},stdio:['pipe','pipe','pipe']});let stdout='',stderr='';p.stdout.on('data',b=>stdout+=b);p.stderr.on('data',b=>stderr+=b);p.on('error',reject);p.on('close',code=>resolve({code,stdout,stderr}));p.stdin.on('error',()=>{});p.stdin.end(r.input);})};
 let version={version:req.release,buildId:req.release,productVersion:'1.0.0-rc.2'},needsSetup=true,redirect=false,refuse=false,lost=false,posts=0,requests=[];
 const server=https.createServer({key:await readFile(root+'/server.key'),cert:await readFile(root+'/server.crt')},async (incoming,response)=>{
  requests.push(incoming.url);if(redirect){response.writeHead(302,{Location:'https://127.0.0.1/private'});response.end();return;}
  if(incoming.url==='/api/version'){response.end(JSON.stringify(version));return;}
  if(incoming.method==='GET'){response.end(JSON.stringify({needsSetup,deploymentModel:'self-hosted'}));return;}
  posts++;let text='';for await(const b of incoming)text+=b;
  if(refuse||incoming.headers.origin!==req.origin||incoming.headers['x-castlink-setup-token']!=='b'.repeat(64)||text!==JSON.stringify({mode:'public',serverName:'studio'})){response.writeHead(401);response.end('PRIVATE');return;}
  needsSetup=false;metadata.setup='complete';await writeFile(root+'/metadata.json',JSON.stringify(metadata));if(lost){incoming.socket.destroy();return;}response.end(JSON.stringify({ok:true}));
 });await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(443,'127.0.0.1',resolve);});
 try{await run({root,req,executor,metadata,posts:()=>posts,requests,version:v=>version=v,redirect:()=>redirect=true,refuse:()=>refuse=true,lost:()=>lost=true,
  wrongHostname:async()=>{await writeFile(root+'/ext','subjectAltName=IP:127.0.0.2\nbasicConstraints=CA:FALSE\n');await exec('openssl',['x509','-req','-in',root+'/server.csr','-CA',root+'/ca.crt','-CAkey',root+'/ca.key','-CAcreateserial','-out',root+'/server.crt','-days','1','-extfile',root+'/ext']);server.setSecureContext({key:await readFile(root+'/server.key'),cert:await readFile(root+'/server.crt')});},
  attempt:async()=>{const a={schemaVersion:1,installationId:req.installationId,nodeId:req.nodeId,origin:req.origin,serverName:req.serverName,release:req.release,webContainerId:req.webContainerId,caddyContainerId:req.caddyContainerId,files:req.files,ownerAssociation:req.ownerAssociation};const file=root+'/completion-attempt.json';await writeFile(file,JSON.stringify(a),{mode:0o600});return{...req,complete:true,attempt:{path:file,...await association(file)}};}
 });}finally{await new Promise(resolve=>server.close(resolve));}
});}
for(const remote of [false,true]){
 test(`${remote?'Python':'Node'} helper verifies real TLS/version/setup and returns bounded pending metadata`,()=>tlsFixture(async f=>{
  const {observeSetupTarget}=await targetApi(),o=await observeSetupTarget(f.req,f.executor,remote);assert.equal(o.tls,'verified');assert.equal(o.setup,'pending');assert.equal(o.ownerAccess,'invite');assert.equal(o.sql,'verified');assert.equal('ready' in o,false);assert.equal(f.posts(),0);assert.doesNotMatch(JSON.stringify(o),/csa2\.|token|password/);
 }));
 test(`${remote?'Python':'Node'} lost completion response observes actual retained completion without repeating POST`,()=>tlsFixture(async f=>{
  const {observeSetupTarget}=await targetApi(),req=await f.attempt();f.lost();const o=await observeSetupTarget(req,f.executor,remote);assert.equal(o.setup,'complete');assert.equal(f.posts(),1);assert.equal((await observeSetupTarget(req,f.executor,remote)).setup,'complete');assert.equal(f.posts(),1);
 }));
 for(const failure of ['release','redirect','untrusted','hostname','file','owner','attempt','token','foreign','changedcert'])test(`${remote?'Python':'Node'} ${failure} refusal is fixed and never marks ready`,()=>tlsFixture(async f=>{
  const {observeSetupTarget}=await targetApi();let req=f.req;
  if(failure==='release')f.version({version:'foreign',buildId:'foreign',productVersion:'1.0.0'});
  if(failure==='redirect')f.redirect();
  if(failure==='untrusted'){await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',f.root+'/other.key','-out',f.root+'/root.crt','-days','1','-subj','/CN=foreign CA','-addext','basicConstraints=critical,CA:TRUE']);await chmod(f.root+'/root.crt',0o644);}
  if(failure==='hostname')await f.wrongHostname();
  if(failure==='file')await writeFile(req.root+'/web.env','PRIVATE');
  if(failure==='owner')await writeFile(req.ownerFile,'PRIVATE');
  if(failure==='attempt'){req=await f.attempt();await writeFile(req.attempt.path,'PRIVATE');}
  if(failure==='token'){req=await f.attempt();f.refuse();}
  if(failure==='foreign'){req=await f.attempt();await writeFile(f.root+'/metadata.json',JSON.stringify({...f.metadata,setup:'complete',serverName:'foreign'}));}
  if(failure==='changedcert'){
   // Change the cert source during the helper's final docker copy, after the
   // successful requests. The Docker shim changes only its own fixture file.
   const file=f.root+'/bin/docker',source=await readFile(file,'utf8');await exec('openssl',['req','-x509','-newkey','rsa:2048','-nodes','-keyout',f.root+'/changed.key','-out',f.root+'/changed.crt','-days','1','-subj','/CN=changed CA','-addext','basicConstraints=critical,CA:TRUE']);await writeFile(file,source.replace("const name=a[1].endsWith('root.crt')?", "if(a[1].endsWith('root.crt')){const count=root+'/cert-count';const n=fs.existsSync(count)?Number(fs.readFileSync(count)):0;fs.writeFileSync(count,String(n+1));if(n>0)fs.copyFileSync(root+'/changed.crt',root+'/root.crt');}const name=a[1].endsWith('root.crt')?"));
  }
  await assert.rejects(()=>observeSetupTarget(req,f.executor,remote),e=>e.code===3&&!/PRIVATE|csa2\.|bbbbb|postgresql/.test(e.message));assert.equal(f.posts(),failure==='token'?1:0);assert.equal(f.requests.includes('/private'),false);
 }));
}
