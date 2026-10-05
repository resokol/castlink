import{test}from'node:test';import assert from'node:assert/strict';import{validateReleaseManifest}from'../dist/bundle.js';
const digest='a'.repeat(64);
const manifest=()=>({schemaVersion:1,release:'1.0.0-rc.2',nodeVersion:'22.21.0',architectures:['amd64','arm64'],images:Object.fromEntries(['web','postgres','livekit','caddy'].map(name=>[name,{reference:`example.org/castlink/${name}@sha256:${digest}`,architectures:['amd64','arm64']}]))});
test('accepts a pinned release for the requested architecture without claiming remote verification',()=>{
 const input=manifest();const result=validateReleaseManifest(input,'1.0.0-rc.2','arm64');assert.deepEqual(result,input);assert.notEqual(result,input);
});
test('rejects mutable images and missing digest before any container operation',()=>{
 for(const reference of ['example.org/web:latest','example.org/web:1.0.0','example.org/web@sha256:123']){const m=manifest();m.images.web.reference=reference;assert.throws(()=>validateReleaseManifest(m,'1.0.0-rc.2','amd64'),/digest/i);}
});
test('every required server image must exist',()=>{for(const name of ['web','postgres','livekit','caddy']){const m=manifest();delete m.images[name];assert.throws(()=>validateReleaseManifest(m,'1.0.0-rc.2','amd64'),/image/i);}});
test('rejects release mismatch and unsupported bundled Node runtime',()=>{
 const m=manifest();assert.throws(()=>validateReleaseManifest(m,'1.0.1','amd64'),/release/i);
 for(const version of ['24.0.0','22','latest'])assert.throws(()=>validateReleaseManifest({...m,nodeVersion:version},m.release,'amd64'),/Node/i);
});
test('required architecture must be present in release and every image',()=>{
 const m=manifest();assert.throws(()=>validateReleaseManifest({...m,architectures:['amd64']},m.release,'arm64'),/architecture/i);
 m.images.livekit.architectures=['amd64'];assert.throws(()=>validateReleaseManifest(m,m.release,'arm64'),/architecture/i);
});
test('unexpected nested fields cannot transport credentials or deployment commands',()=>{
 for(const m of [{...manifest(),token:'private-fixture'},{...manifest(),images:{...manifest().images,extra:{reference:'x'}}}])assert.throws(()=>validateReleaseManifest(m,'1.0.0-rc.2','amd64'),/schema|field|image/i);
 const m=manifest();m.images.web.password='private-fixture';assert.throws(()=>validateReleaseManifest(m,m.release,'amd64'),/schema|field/i);
});

const bundleModule=await import('../dist/bundle.js');
const input=()=>({release:manifest(),installationId:'00000000-0000-4000-8000-000000000001',architecture:'amd64',network:'loopback',bindIPv4:'127.0.0.1',secretFiles:{webEnv:'./protected/web.env',postgresEnv:'./protected/postgres.env',livekitConfig:'./protected/livekit.yaml'}});
function render(value=input()){assert.equal(typeof bundleModule.renderBundle,'function','pure bundle renderer must exist');return bundleModule.renderBundle(value);}

test('renders exactly four pinned service images on one project scoped bridge',()=>{
 const b=render(),m=b.composeModel;assert.equal(b.projectName,'castlink-00000000000040008000000000000001');assert.equal(m.name,b.projectName);assert.deepEqual(Object.keys(m.services).sort(),['caddy','livekit','postgres','web']);
 for(const name of Object.keys(m.services)){assert.equal(m.services[name].image,manifest().images[name].reference);assert.equal(m.services[name].platform,'linux/amd64');assert.equal('container_name' in m.services[name],false);assert.equal('network_mode' in m.services[name],false);assert.deepEqual(m.services[name].networks,['castlink']);}
 for(const volume of Object.values(m.volumes)){assert.equal('name' in volume,false);assert.equal('external' in volume,false);}
 assert.equal(m.networks.castlink.driver,'bridge');assert.deepEqual(JSON.parse(b.composeText.replaceAll("$$","$")),m);
});
test('only HTTPS and fixed ICE ports are published on the explicitly selected bind',()=>{
 for(const [network,bindIPv4] of [['loopback','127.0.0.1'],['lan','192.168.50.20']]){const m=render({...input(),network,bindIPv4}).composeModel;
 assert.equal(m.services.postgres.ports,undefined);assert.equal(m.services.web.ports,undefined);
 assert.deepEqual(m.services.caddy.ports,[{host_ip:bindIPv4,published:'443',target:443,protocol:'tcp'}]);
 assert.deepEqual(m.services.livekit.ports,[{host_ip:bindIPv4,published:'7881',target:7881,protocol:'tcp'},...Array.from({length:101},(_,index)=>({host_ip:bindIPv4,published:String(61000+index),target:61000+index,protocol:'udp'}))]);}
});
test('web effective overrides force independent local admission and matching installation identity',()=>{
 const b=render(),e=b.composeModel.services.web.environment;assert.equal(e.CASTLINK_DEPLOYMENT_MODEL,'self-hosted');assert.equal(e.CASTLINK_ENFORCE_NODE_ADMISSION,'1');assert.equal(e.LIVEKIT_SERVER_URL,'http://livekit:7880');assert.equal(e.CASTLINK_CONTROL_PLANE_URL,'');assert.equal(e.CASTLINK_LICENSE_SERVICE_URL,'');assert.equal(e.CASTLINK_LICENSE_ENFORCE,'0');assert.equal(e.STUDIOLINK_INSTALLATION_ID,input().installationId);assert.equal(e.CASTLINK_NODE_ID,b.nodeId);
 assert.equal(e.STUDIOLINK_DATA_DIR,'/data');assert.equal(b.composeModel.services.web.extra_hosts,undefined);
});
test('Caddy performs plain HTTP admission before unchanged RTC signalling and preserves private CA',()=>{
 const b=render(),s=b.caddyText;assert.match(s,/https:\/\/127\.0\.0\.1/);assert.match(s,/tls internal/);assert.match(s,/@rtc path \/rtc \/rtc\/\*/);assert.ok(s.indexOf('forward_auth web:3000')<s.indexOf('reverse_proxy livekit:7880'));assert.match(s,/uri \/api\/media-admission/);assert.match(s,/header_up -Upgrade/);assert.match(s,/header_up -Connection/);assert.match(s,/reverse_proxy web:3000/);assert.doesNotMatch(s,/strip_prefix|handle_path|bind |copy_headers|host.docker.internal/);
 assert.ok(b.composeModel.services.caddy.volumes.some(v=>v.type==='volume'&&v.source==='caddy-data'&&v.target==='/data'));assert.equal(b.composeModel.configs.caddy.content,s);assert.doesNotMatch(s,/^\s*log(?:\s*\{|\s*$)/m);
});
test('protected config references use read-only long mounts without reading their contents',()=>{
 const b=render();assert.deepEqual(b.composeModel.services.web.env_file,[input().secretFiles.webEnv]);assert.deepEqual(b.composeModel.services.postgres.env_file,[input().secretFiles.postgresEnv]);assert.deepEqual(b.composeModel.services.livekit.volumes,[{type:'bind',source:input().secretFiles.livekitConfig,target:'/etc/livekit.yaml',read_only:true,bind:{create_host_path:false}}]);assert.ok(b.checks.every(c=>c.state==='unverified'));assert.ok(b.checks.some(c=>c.id==='media'));assert.ok(b.checks.some(c=>c.id==='protected-config'));assert.ok(b.checks.some(c=>c.id==='tls'));
});
test('paths with spaces Unicode dollar interpolation and colons remain data in Compose text',()=>{
 const v=input();v.secretFiles={webEnv:'./secret $ENV/веб.env',postgresEnv:'./secret ${HOME}/pg.env',livekitConfig:'C:\\Secret $ROOT\\livekit.yaml'};const b=render(v);assert.equal(b.composeModel.services.web.env_file[0],v.secretFiles.webEnv);assert.match(b.composeText,/\$\$ENV/);assert.match(b.composeText,/\$\$\{HOME\}/);assert.match(b.composeText,/\$\$ROOT/);
});
test('renderer rejects invalid identity network paths and unvalidated release claims',()=>{
 for(const installationId of ['../bad','uuid','private-secret-fixture'])assert.throws(()=>render({...input(),installationId}),e=>!e.message.includes(installationId));
 for(const patch of [{architecture:'x64'},{network:'internet'},{network:'lan',bindIPv4:'8.8.8.8'}])assert.throws(()=>render({...input(),...patch}));
 for(const key of ['webEnv','postgresEnv','livekitConfig'])for(const path of ['',null,'x\nsecret','x\0secret']){const v=input();v.secretFiles[key]=path;assert.throws(()=>render(v));}
 const v=input();v.release.images.web.reference='example.org/web:latest';assert.throws(()=>render(v),/digest/i);
 const w=input();w.release.images.web.architectures=['amd64'];w.architecture='arm64';assert.throws(()=>render(w),/architecture/i);
});
test('rendering is deterministic does not mutate inputs or expose any runtime readiness claims',()=>{
 const v=input(),snapshot=structuredClone(v);assert.deepEqual(render(v),render(v));assert.deepEqual(v,snapshot);const other=render({...v,installationId:'00000000-0000-4000-8000-000000000002'});assert.notEqual(other.projectName,render(v).projectName);assert.notEqual(other.nodeId,render(v).nodeId);
});
test('checked-in Caddy template is the exact routing used by renderer',async()=>{
 const {readFile}=await import('node:fs/promises');const template=await readFile(new URL('../../../infrastructure/self-hosted/Caddyfile.template',import.meta.url),'utf8');assert.equal(render().caddyText,template.replaceAll('{{BIND_IPV4}}','127.0.0.1'));
});
test('candidate declares Compose content compatibility as an unverified preflight requirement',()=>{
 const b=render();assert.equal(b.requirements.composeMinimumVersion,'2.23.1');assert.ok(b.checks.some(c=>c.id==='compose-compatibility'&&c.state==='unverified'&&c.message.includes('2.23.1')));
});
test('Compose config accepts the emitted candidate and preserves literal protected paths without daemon access',async t=>{
 const {spawnSync}=await import('node:child_process');const available=spawnSync('docker',['compose','version','--short'],{encoding:'utf8'});if(available.status!==0){t.skip('Docker Compose unavailable: daemon-free config acceptance unverified');return;}
 const {mkdtemp,writeFile,mkdir,rm}=await import('node:fs/promises');const {tmpdir}=await import('node:os');const {join}=await import('node:path');const root=await mkdtemp(join(tmpdir(),'castlink-bundle-config-'));
 try{
  const dir=join(root,'protected $CASTLINK_BUNDLE_PATH_FIXTURE Юникод');await mkdir(dir);const files={webEnv:join(dir,'web.env'),postgresEnv:join(dir,'postgres.env'),livekitConfig:join(dir,'livekit.yaml')};await writeFile(files.webEnv,'FIXTURE_VALUE=local\n');await writeFile(files.postgresEnv,'POSTGRES_USER=castlink\nPOSTGRES_DB=castlink\nPOSTGRES_PASSWORD=dummy-test-only\n');await writeFile(files.livekitConfig,'port: 7880\n');
  const b=render({...input(),network:'lan',bindIPv4:'192.168.50.20',secretFiles:files});const config=join(root,'compose.json');await writeFile(config,b.composeText);
  const quiet=spawnSync('docker',['compose','-f',config,'config','--quiet'],{encoding:'utf8',env:{...process.env,CASTLINK_BUNDLE_PATH_FIXTURE:'not-a-config-reference'}});assert.equal(quiet.status,0,quiet.stderr);
  const parsed=spawnSync('docker',['compose','-f',config,'config','--format','json'],{encoding:'utf8',env:{...process.env,CASTLINK_BUNDLE_PATH_FIXTURE:'not-a-config-reference'}});assert.equal(parsed.status,0,parsed.stderr);const model=JSON.parse(parsed.stdout);assert.equal(model.name,b.projectName);assert.equal(model.services.web.environment.FIXTURE_VALUE,"local");assert.equal(model.services.postgres.environment.POSTGRES_USER,"castlink");assert.equal(model.services.livekit.volumes[0].source.replaceAll('$$','$'),files.livekitConfig);assert.match(model.services.postgres.healthcheck.test[1],/\$\$POSTGRES_USER/);assert.equal(model.services.livekit.volumes[0].read_only,true);assert.equal(model.services.web.ports,undefined);assert.equal(model.services.postgres.ports,undefined);for(const service of [model.services.caddy,model.services.livekit])for(const port of service.ports)assert.equal(port.host_ip,'192.168.50.20');
 }finally{await rm(root,{recursive:true,force:true});}
});

test('Caddy excludes request-containing error and access logs while preserving startup diagnostics',()=>{
 const b=render();assert.match(b.caddyText,/log default \{\s*exclude http\.log\.error http\.log\.access\s*\}/);assert.ok(b.checks.some(c=>c.id==='http-diagnostics'&&c.state==='unverified'));assert.doesNotMatch(b.caddyText,/debug/);
});

test('final control characters never pass identity or manifest validation',()=>{
 for(const ending of ['\n','\r','\r\n']){
  assert.throws(()=>render({...input(),installationId:input().installationId+ending}));
  for(const field of ['release','nodeVersion']){const m=manifest();m[field]+=ending;assert.throws(()=>validateReleaseManifest(m,m.release,'amd64'));}
  const m=manifest();m.images.web.reference+=ending;assert.throws(()=>validateReleaseManifest(m,m.release,'amd64'));
 }
});
