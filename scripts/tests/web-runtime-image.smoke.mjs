import {execFileSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {operatorScripts} from '../prepare-web-runtime.mjs';

const image=process.argv[2];
if(!image)throw Error('Usage: node scripts/tests/web-runtime-image.smoke.mjs BUILT_IMAGE');
const name='castlink-runtime-smoke-'+randomUUID();
const docker=(args)=>execFileSync('docker',args,{encoding:'utf8',timeout:30000,stdio:['ignore','pipe','pipe']});
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
console.log('RUNTIME_FILES_DEPENDENCIES_PASS');`;
try {
 docker(['run','-d','--name',name,'-e','STUDIOLINK_DATA_DIR=/data','-e','CASTLINK_STORAGE_BACKEND=json',image]);
 let ready=false;
 for(let attempt=0;attempt<30;attempt++) {
  try {docker(['exec',name,'node','-e',"fetch('http://127.0.0.1:3000/api/version').then(async r=>{if(r.status!==200)throw Error();const j=await r.json();if(!j.buildId)throw Error();console.log(j.buildId)}).catch(()=>process.exit(1));"]);ready=true;break;}catch {await new Promise(resolve=>setTimeout(resolve,1000));}
 }
 assert(ready,'Standalone server did not become ready');
 assert.equal(docker(['exec',name,'node','-e',probe]).trim(),'RUNTIME_FILES_DEPENDENCIES_PASS');
 docker(['exec',name,'node','-e',"fetch('http://127.0.0.1:3000/').then(r=>{if(r.status!==200)throw Error();console.log('ROOT_HTTP_200')}).catch(()=>process.exit(1));"]);
 console.log('RUNTIME_IMAGE_FILES_SERVER_HTTP_PASS');
} finally {docker(['rm','-f',name]);}
