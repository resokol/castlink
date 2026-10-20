import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {operatorScripts} from '../prepare-web-runtime.mjs';

const [image,postgresImage]=process.argv.slice(2);
if(!image||!postgresImage)throw Error('Usage: node scripts/tests/web-runtime-image.smoke.mjs BUILT_IMAGE POSTGRES_IMAGE');
const name='castlink-runtime-smoke-'+randomUUID();
const database=name+'-postgres',network=name+'-network',installationId=randomUUID(),nodeId='srv-'+installationId.replaceAll('-','');
const docker=(args,options={})=>execFileSync('docker',args,{encoding:'utf8',timeout:30000,stdio:['pipe','pipe','pipe'],...options});
const converter=name+'-converter',socketVolume=name+'-socket';
const converterRequest="const fs=require('node:fs'),http=require('node:http'),assert=require('node:assert/strict');try{fs.writeFileSync('/run/castlink-converter/readonly-probe','x');throw Error('Socket mount is writable')}catch(e){assert.equal(e.code,'EROFS')}const q=http.request({socketPath:'/run/castlink-converter/converter.sock',path:'/convert',method:'POST',headers:{'content-length':'3'}},r=>{let b='';r.on('data',x=>{b+=x;if(b.length>4096)q.destroy(Error('Unbounded response'))});r.on('end',()=>{assert.equal(r.statusCode,422);assert.equal(JSON.parse(b).code,'presentation-invalid-package');console.log('CONVERTER_READONLY_SOCKET_PASS')})});q.setTimeout(5000,()=>q.destroy(Error('Converter deadline')));q.on('error',e=>{console.error(e.message);process.exitCode=1});q.end('bad');";
const converterBoundary="import os,socket\nfrom pathlib import Path\nassert os.getuid()==10001 and os.getgid()==10001\nassert not any(os.environ.get(k) for k in ['DATABASE_URL','LIVEKIT_API_SECRET','CASTLINK_SESSION_SECRET','CASTLINK_SETUP_TOKEN'])\nassert not Path('/data').exists()\ntry:\n Path('/app/readonly-probe').write_text('x')\n raise AssertionError('Runtime filesystem is writable')\nexcept OSError:pass\ns=socket.socket();s.settimeout(1)\nassert s.connect_ex(('1.1.1.1',443))!=0\ns.close()\nprint('CONVERTER_BOUNDARY_PASS')";
const probe=`const fs=require('node:fs'),path=require('node:path'),{createRequire}=require('node:module');
const requireWeb=createRequire('/app/apps/web/package.json');
for(const file of ['app','components','lib','tests','.studiolink-data','next.config.ts','tsconfig.json'])if(fs.existsSync('/app/apps/web/'+file))throw Error('Application source or local data shipped');
for(const file of ${JSON.stringify(operatorScripts)}) {
 const text=fs.readFileSync('/app/scripts/'+file,'utf8');
 for(const match of text.matchAll(/(?:from\\s+|import\\()(['"])(\\.\\/[^'"]+)\\1/g))if(!fs.existsSync(path.resolve('/app/scripts',match[2])))throw Error('Missing operator dependency');
}
if(requireWeb('pg/package.json').version!=='8.23.0')throw Error('pg missing');
requireWeb('next');
try {requireWeb.resolve('typescript');throw Error('TypeScript compiler shipped');}catch(error){if(error.code!=='MODULE_NOT_FOUND')throw error;}
if(!fs.existsSync('/app/LICENSE')||!fs.existsSync('/app/infrastructure/postgres/004_room_creator_access.sql'))throw Error('Runtime migration/notice missing');
import('/app/scripts/setup-database-v1.mjs').then(async helper=>{
 if((await helper.scripts()).length!==11)throw Error('Runtime SQL manifest missing');
 console.log('RUNTIME_FILES_DEPENDENCIES_PASS');
}).catch(()=>{console.error('Runtime SQL contract refused');process.exitCode=1});`;
try {
 docker(['volume','create',socketVolume]);
 docker(['run','-d','--init','--name',converter,'--network','none','--user','10001:10001','--read-only',
  '--cap-drop','ALL','--security-opt','no-new-privileges:true','--memory','512m','--pids-limit','128','--cpus','1',
  '--tmpfs','/tmp:size=512m,mode=1777','-v',socketVolume+':/run/castlink-converter',image,
  'python3','/app/scripts/presentation-converter/server.py']);
 let converterReady=false;
 for(let attempt=0;attempt<20;attempt++){
  try{docker(['exec',converter,'python3','-c',"import os,stat;assert stat.S_ISSOCK(os.stat('/run/castlink-converter/converter.sock').st_mode)"]);converterReady=true;break;}
  catch{await new Promise(resolve=>setTimeout(resolve,250));}
 }
 assert(converterReady,'Nonroot isolated converter did not start');
 const boundary=JSON.parse(docker(['inspect',converter]))[0];
 assert.equal(boundary.HostConfig.Init,true);assert.equal(boundary.Config.User,'10001:10001');assert.equal(boundary.HostConfig.NetworkMode,'none');
 assert.equal(boundary.HostConfig.ReadonlyRootfs,true);assert.equal(boundary.HostConfig.Memory,512*1024*1024);
 assert.equal(boundary.HostConfig.PidsLimit,128);assert.equal(boundary.HostConfig.NanoCpus,1e9);
 assert.deepEqual(boundary.HostConfig.CapDrop,['ALL']);assert.ok(boundary.HostConfig.SecurityOpt.some(v=>v.startsWith('no-new-privileges')));
 assert.deepEqual(boundary.Mounts.filter(v=>v.Type!=='tmpfs').map(v=>[v.Name,v.Destination,v.RW]),[[socketVolume,'/run/castlink-converter',true]]);
 assert.equal(docker(['exec',converter,'python3','-c',converterBoundary]).trim(),'CONVERTER_BOUNDARY_PASS');
 assert.equal(docker(['run','--rm','--network','none','--read-only','-v',socketVolume+':/run/castlink-converter:ro',image,
  'node','-e',converterRequest]).trim(),'CONVERTER_READONLY_SOCKET_PASS');
 docker(['network','create',network]);
 docker(['run','-d','--name',database,'--network',network,'--network-alias','postgres','-e','POSTGRES_USER=castlink','-e','POSTGRES_PASSWORD=runtime-smoke-only','-e','POSTGRES_DB=castlink',postgresImage]);
 let databaseReady=false;
 for(let attempt=0;attempt<30;attempt++) {
  try {docker(['exec',database,'pg_isready','-h','127.0.0.1','-U','castlink','-d','castlink']);databaseReady=true;break;}catch {await new Promise(resolve=>setTimeout(resolve,1000));}
 }
 assert(databaseReady,'Disposable PostgreSQL did not become ready');
 docker(['run','-d','--name',name,'--network',network,
  '-e','STUDIOLINK_DATA_DIR=/data','-e','CASTLINK_STORAGE_BACKEND=json',
  '-e','DATABASE_URL=postgresql://castlink:runtime-smoke-only@postgres:5432/castlink',
  '-e',`STUDIOLINK_INSTALLATION_ID=${installationId}`,'-e',`CASTLINK_NODE_ID=${nodeId}`,
  '-e','CASTLINK_DEPLOYMENT_MODEL=self-hosted','-e','STUDIOLINK_DEFAULT_STUDIO_ID=studio-default',image]);
 let ready=false;
 for(let attempt=0;attempt<30;attempt++) {
  try {docker(['exec',name,'node','-e',"fetch('http://127.0.0.1:3000/api/version').then(async r=>{if(r.status!==200)throw Error();const j=await r.json();if(!j.buildId)throw Error();console.log(j.buildId)}).catch(()=>process.exit(1));"]);ready=true;break;}catch {await new Promise(resolve=>setTimeout(resolve,1000));}
 }
 assert(ready,'Standalone server did not become ready');
 assert.equal(docker(['exec',name,'node','-e',probe]).trim(),'RUNTIME_FILES_DEPENDENCIES_PASS');
 for(const phase of ['migrations','seed','migrations','seed']) {
  const result=JSON.parse(docker(['exec','-i',name,'node','/app/scripts/setup-database-v1.mjs'],{input:JSON.stringify({schemaVersion:1,installationId,nodeId,phase})}));
  assert.equal(result.contract,'castlink-database-v1');assert.equal(result.phase,phase);
  assert.equal(result.installationId,installationId);assert.equal(result.nodeId,nodeId);
  assert.deepEqual(result.migrations,{roomVersions:[1,2,3,4,5,6],controlVersions:[1,2,3,4,5],schema:true,hashes:true});
  assert.deepEqual(result.seed,phase==='seed'?{installations:1,accounts:1,organizations:1,memberships:1,nodes:1,studios:1,rooms:0}:null);
 }
 docker(['exec',name,'node','-e',"fetch('http://127.0.0.1:3000/').then(r=>{if(r.status!==200)throw Error();console.log('ROOT_HTTP_200')}).catch(()=>process.exit(1));"]);
 const designAssetProbe=`(async()=>{const cases=[['/new/live-theme.css',/special-theme\\.css/],['/new/special-theme.css',/data-design-preview/],['/new/assets/font.css',/@font-face/]];for(const [path,content] of cases){const response=await fetch('http://127.0.0.1:3000'+path);if(response.status!==200||!response.headers.get('content-type')?.includes('text/css')||!content.test(await response.text()))throw Error('Runtime design asset unavailable '+path)}console.log('RUNTIME_DESIGN_ASSETS_HTTP_PASS')})().catch(error=>{console.error(error);process.exitCode=1})`;
 assert.equal(docker(['exec',name,'node','-e',designAssetProbe]).trim(),'RUNTIME_DESIGN_ASSETS_HTTP_PASS');
 const maintenanceProbe=`const fs=require('node:fs');(async()=>{const baseline=await fetch('http://127.0.0.1:3000/api/media-admission');const before={status:baseline.status,body:await baseline.text(),retry:baseline.headers.get('retry-after')};const marker='/data/.castlink-update-maintenance';fs.mkdirSync('/data',{recursive:true});fs.writeFileSync(marker,'runtime-test',{flag:'wx'});try{for(const path of ['/api/token','/api/media-admission','/api/server-transfer']){const r=await fetch('http://127.0.0.1:3000'+path,{headers:{'x-middleware-subrequest':'middleware:middleware:middleware:middleware:middleware'}});if(r.status!==503||r.headers.get('retry-after')!=='10')throw Error('Maintenance bypass '+path)}if((await fetch('http://127.0.0.1:3000/api/version')).status!==200)throw Error('Version gate');}finally{fs.unlinkSync(marker)}const restored=await fetch('http://127.0.0.1:3000/api/media-admission');if(restored.status!==before.status||await restored.text()!==before.body||restored.headers.get('retry-after')!==before.retry)throw Error('Maintenance did not restore baseline');console.log('RUNTIME_MAINTENANCE_ADMISSION_PASS')})().catch(e=>{console.error(e);process.exitCode=1})`;
 assert.equal(docker(['exec',name,'node','-e',maintenanceProbe]).trim(),'RUNTIME_MAINTENANCE_ADMISSION_PASS');
 console.log('RUNTIME_IMAGE_FILES_DATABASE_SEED_SERVER_HTTP_PASS');
} finally {
 for(const container of [name,database,converter])try{docker(['rm','-f','-v',container]);}catch{}
 try{docker(['network','rm',network]);}catch{}
 try{docker(['volume','rm',socketVolume]);}catch{}
}
