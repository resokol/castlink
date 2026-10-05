import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {SshExecutor} from '../dist/executors/ssh.js';
import {LocalExecutor} from '../dist/executors/local.js';
const names=['web','postgres','livekit','caddy'];
const oci='application/vnd.oci.image.';
const docker='application/vnd.docker.distribution.';
const hash=raw=>'sha256:'+createHash('sha256').update(raw).digest('hex');
const descriptor=(raw,mediaType)=>({mediaType,digest:hash(raw),size:Buffer.byteLength(raw)});
function single(family=oci){return JSON.stringify({schemaVersion:2,mediaType:family==='application/vnd.oci.image.'?oci+'manifest.v1+json':docker+'manifest.v2+json',config:{mediaType:family===oci?oci+'config.v1+json':'application/vnd.docker.container.image.v1+json',digest:'sha256:'+'1'.repeat(64),size:120},layers:[{mediaType:family===oci?oci+'layer.v1.tar+gzip':'application/vnd.docker.image.rootfs.diff.tar.gzip',digest:'sha256:'+'2'.repeat(64),size:12}]});}
function fixture({index=true,family=oci,arch='amd64',os='linux',variant='',mutate,reply}={}){
 const child=single(family),type=JSON.parse(child).mediaType,childDescriptor=descriptor(child,type);
 const root=index?JSON.stringify({schemaVersion:2,mediaType:family===oci?oci+'index.v1+json':docker+'manifest.list.v2+json',manifests:[{...childDescriptor,platform:{architecture:arch,os, ...(variant?{variant}:{})}},{...descriptor(child.replace('1'.repeat(64),'3'.repeat(64)),type),platform:{architecture:'s390x',os:'linux'}}]}):child;
 const manifest={schemaVersion:1,release:'1.2.3',nodeVersion:'22.23.3',architectures:['amd64','arm64'],images:Object.fromEntries(names.map(n=>[n,{reference:`ghcr.io/castlink/${n}@${hash(root)}`,architectures:['amd64','arm64']}]))};
 const calls=[];
 const executor={run:async r=>{calls.push(structuredClone(r));mutate?.();const ref=r.args.at(-1);let stdout=r.args.includes('--raw')?(ref.endsWith(hash(root))?root:child):JSON.stringify({manifest:childDescriptor,platform:{architecture:arch,os,variant}});return reply?reply(r,stdout,{root,child,childDescriptor}):{code:0,stdout,stderr:''};}};
 return {manifest,executor,calls,root,child};
}
async function check(f,changes={}){const {releaseAvailabilityChecks}=await import('../dist/release-availability.js');return releaseAvailabilityChecks({manifest:f.manifest,release:'1.2.3',architecture:'amd64',...changes},f.executor);}
function assertStates(checks,state){assert.equal(checks.length,4);assert.deepEqual(checks.map(x=>x.id),names.map(n=>'registry-'+n));assert.ok(checks.every(x=>x.state===state));assert.doesNotMatch(JSON.stringify(checks),/raw-secret/);}
test('actual OCI and Docker indexes and singles require hashed raw and observed config',async()=>{for(const index of [true,false])for(const family of [oci,docker]){const f=fixture({index,family});assertStates(await check(f),'pass');assert.equal(f.calls.length,index?12:8);assert.ok(f.calls.every(r=>r.executable==='docker'&&r.sensitive===false&&!r.input));assert.ok(f.calls.every(r=>r.args.slice(0,3).join(' ')==='buildx imagetools inspect'));assert.ok(f.calls.every(r=>!r.args.includes('--insecure')));}});
test('arm64 v8 is supported from config; unsupported variants fail closed',async()=>{assertStates(await check(fixture({arch:'arm64',variant:'v8'}),{architecture:'arm64'}),'pass');for(const options of [{variant:'v2'},{arch:'arm64',variant:'v9'}])assertStates(await check(fixture(options),{architecture:options.arch??'amd64'}),'fail');});
test('release claims cannot replace missing architecture or Linux observation',async()=>{for(const index of [true,false])for(const options of [{arch:'arm64'},{os:'windows'}])assertStates(await check(fixture({index,...options})),'fail');});
test('index platform claim must agree with selected single image config',async()=>{const f=fixture({reply:(r,stdout)=>({code:0,stdout:r.args.includes('--format')?stdout.replace('amd64','arm64'):stdout,stderr:''})});assertStates(await check(f),'fail');});
test('root raw digest mismatch and repository response substitution fail',async()=>{const f=fixture({reply:()=>({code:0,stdout:single(docker),stderr:''})});assertStates(await check(f),'fail');});
test('selected child bytes and descriptor digest size and media type must bind',async()=>{for(const field of ['digest','size','mediaType']){const f=fixture({reply:(r,stdout)=>{if(r.args.includes('--format')){const data=JSON.parse(stdout);data.manifest[field]=field==='size'?3:field==='digest'?'sha256:'+'f'.repeat(64):'unknown';stdout=JSON.stringify(data);}return{code:0,stdout,stderr:''};}});assertStates(await check(f),'fail');}const f=fixture({reply:(r,stdout,{root})=>({code:0,stdout:r.args.includes('--raw')&&!r.args.at(-1).endsWith(hash(root))?stdout+' ':stdout,stderr:''})});assertStates(await check(f),'fail');});
test('missing private inaccessible images, thrown errors and stderr fail with fixed redaction',async()=>{for(const reply of [()=>({code:1,stdout:'raw-secret not found',stderr:'raw-secret denied'}),()=>{throw Error('raw-secret')},()=>({code:0,stdout:'{}',stderr:'raw-secret'}),()=>({code:0,stdout:'unknown raw-secret',stderr:''}),()=>({code:'0',stdout:'{}',stderr:''})])assertStates(await check(fixture({reply})),'fail');});
test('malformed duplicate escaped-key excess and truncated response forms fail',async()=>{for(const raw of ['{','[]','null','{"architecture":"arm64","architecture":"amd64"}','{"architecture":"arm64","\\u0061rchitecture":"amd64"}','x'.repeat(262145)]){const f=fixture({reply:(r,stdout)=>({code:0,stdout:r.args.includes('--format')?raw:stdout,stderr:''})});assertStates(await check(f),'fail');}});
test('unsupported root schemas duplicate raw keys and ambiguous index entries fail',async()=>{for(const change of [r=>({...r,schemaVersion:1}),r=>({...r,mediaType:'unknown'}),r=>({...r,extra:true}),r=>({...r,manifests:[...r.manifests,...r.manifests]})]){const f=fixture();const raw=JSON.stringify(change(JSON.parse(f.root)));for(const n of names)f.manifest.images[n].reference=`ghcr.io/castlink/${n}@${hash(raw)}`;f.executor.run=async()=>({code:0,stdout:raw,stderr:''});assertStates(await check(f),'fail');}for(const key of ['schemaVersion','\\u0073chemaVersion']){const f=fixture();const raw=f.root.replace('"schemaVersion":2',`"schemaVersion":1,"${key}":2`);for(const n of names)f.manifest.images[n].reference=`ghcr.io/castlink/${n}@${hash(raw)}`;f.executor.run=async()=>({code:0,stdout:raw,stderr:''});assertStates(await check(f),'fail');}});
test('all manifest input and references validate before any executor call',async()=>{const module=await import('../dist/release-availability.js');assert.equal(typeof module.releaseAvailabilityChecks,'function');for(const change of [f=>{f.manifest.images.caddy.reference='ghcr.io/x/caddy:latest'},f=>{f.manifest.images.caddy.reference='secret:password@sha256:'+'f'.repeat(64)},f=>{f.manifest.images.caddy.reference='ghcr.io/x/caddy:tag@sha256:'+'f'.repeat(64)},f=>{delete f.manifest.images.livekit},f=>{f.manifest.architectures=['arm64']}]){const f=fixture();change(f);await assert.rejects(check(f));assert.equal(f.calls.length,0);}const f=fixture();await assert.rejects(check(f,{architecture:'x64'}));assert.equal(f.calls.length,0);});
test('caller mutation after first await cannot alter later refs or platform',async()=>{const f=fixture({mutate:()=>{f.manifest.images.caddy.reference='raw-secret';f.manifest.images.postgres.architectures=[];}});assertStates(await check(f),'pass');assert.ok(f.calls.every(r=>!r.args.at(-1).includes('raw-secret')));});
test('the same exact metadata argv passes selected SSH executor JSON stdin seam',async()=>{
 const local=fixture(),responseFixture=fixture(),remote=fixture();
 const transport={run:async invocation=>{assert.equal(invocation.executable,'ssh');assert.ok(invocation.args.includes('StrictHostKeyChecking=yes'));assert.equal(invocation.args.at(-2),'vps.example');const request=JSON.parse(Buffer.from(invocation.input));const result=await responseFixture.executor.run(request);return{code:0,stdout:JSON.stringify(result),stderr:''};}};
 remote.executor=new SshExecutor({kind:'remote',host:'vps.example',user:'deploy',port:22},transport);
 assert.deepEqual(await check(remote),await check(local));assert.deepEqual(responseFixture.calls.map(r=>r.args),local.calls.map(r=>r.args));
});
test('fixed platform template rejects missing fields and undocumented extra fields',async()=>{
 for(const change of [p=>{delete p.variant;},p=>{p['os.features']=[];},p=>{p['os.version']='';}]){
 const f=fixture({reply:(r,stdout)=>{if(r.args.includes('--format')){const d=JSON.parse(stdout);change(d.platform);stdout=JSON.stringify(d);}return{code:0,stdout,stderr:''};}});assertStates(await check(f),'fail');
 }
});
test('invalid registry port rejects every reference before executing',async()=>{const f=fixture();f.manifest.images.caddy.reference=f.manifest.images.caddy.reference.replace('ghcr.io/','ghcr.io:99999/');await assert.rejects(check(f));assert.equal(f.calls.length,0);});
test('raw overflow and truncated root bytes fail closed before platform command',async()=>{for(const raw of ['x'.repeat(262145),single().slice(0,-1)]){const f=fixture({reply:()=>({code:0,stdout:raw,stderr:''})});assertStates(await check(f),'fail');assert.ok(f.calls.every(r=>r.args.includes('--raw')));}});
test('single manifest requires known config/layer descriptors and forbids artifact URLs',async()=>{for(const change of [m=>{delete m.config;},m=>{m.config.mediaType='unknown';},m=>{m.layers[0].urls=['https://secret.example/'];},m=>{m.subject=m.config;},m=>{m.config.size='120';}]){const f=fixture({index:false});const data=JSON.parse(f.root);change(data);const raw=JSON.stringify(data);for(const n of names)f.manifest.images[n].reference=`ghcr.io/castlink/${n}@${hash(raw)}`;f.executor.run=async()=>({code:0,stdout:raw,stderr:''});assertStates(await check(f),'fail');}});
test('an inaccessible selected image does not fabricate or suppress other image results',async()=>{const f=fixture({reply:(r,stdout)=>r.args.at(-1).startsWith('ghcr.io/castlink/web@')?{code:1,stdout:'raw-secret',stderr:'raw-secret unauthorized'}:{code:0,stdout,stderr:''}});const result=await check(f);assert.deepEqual(result.map(x=>x.state),['fail','pass','pass','pass']);assert.doesNotMatch(JSON.stringify(result),/raw-secret/);});
for(const newline of ['\r\n','\r'])test(`registry digest checks preserve ${newline==='\r'?'lone CR':'CRLF'} Unicode metadata through actual SSH helper`,async()=>{
 const child=JSON.stringify({...JSON.parse(single()),annotations:{description:'Привет 世界'}},null,2).replaceAll('\n',newline),childDescriptor=descriptor(child,oci+'manifest.v1+json');
 const root=JSON.stringify({schemaVersion:2,mediaType:oci+'index.v1+json',manifests:[{...childDescriptor,platform:{architecture:'amd64',os:'linux'}}],annotations:{description:'Привет 世界'}},null,2).replaceAll('\n',newline);
 const f=fixture();for(const n of names)f.manifest.images[n].reference=`ghcr.io/castlink/${n}@${hash(root)}`;
 let changed=false;
 const responder={run:async r=>({code:0,stdout:r.args.includes('--raw')?(r.args.at(-1).endsWith(hash(root))?root+(changed?' ':''):child):JSON.stringify({manifest:childDescriptor,platform:{architecture:'amd64',os:'linux',variant:''}}),stderr:''})};
 f.executor=responder;assertStates(await check(f),'pass');
 const transport={run:async invocation=>{
  assert.equal(invocation.executable,'ssh');const prefix="python3 -c '",command=invocation.args.at(-1);assert.ok(command.startsWith(prefix)&&command.endsWith("'"));
  const helper=command.slice(prefix.length,-1).replaceAll("'\\''","'");
  const request=JSON.parse(Buffer.from(invocation.input));assert.equal(request.executable,'docker');assert.deepEqual(request.args.slice(0,3),['buildx','imagetools','inspect']);
  // Simulated Docker metadata producer; actual constant helper captures its bytes.
  const response=await responder.run(request),input=Buffer.from(JSON.stringify({schemaVersion:1,executable:'python3',args:['-c','import sys; sys.stdout.buffer.write(sys.argv[1].encode("utf-8"))',response.stdout]}));
  return new LocalExecutor().run({executable:'python3',args:['-c',helper],input,sensitive:false});
 }};
 f.executor=new SshExecutor({kind:'remote',host:'fixture.example',user:'deploy',port:22},transport);assertStates(await check(f),'pass');
 changed=true;assertStates(await check(f),'fail');
});
