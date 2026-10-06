// Orchestration-only adapter for existing injected-executor fixtures. The actual
// held target protocols are proved separately by image/service-target.test.mjs.
import {readFile,readdir,mkdtemp,writeFile} from 'node:fs/promises';import {createHash} from 'node:crypto';
import {rmSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {LocalExecutor} from '../dist/executors/local.js';
let home=await mkdtemp(path.join(os.tmpdir(),'castlink-injected-target-')),scope=path.join(home,'.castlink-target-operations');const local=new LocalExecutor();
const homes=new Set([home]);process.once('exit',()=>{for(const directory of homes)rmSync(directory,{recursive:true,force:true})});
async function epoch(){try{return JSON.parse(await readFile(path.join(scope,'epoch.json'),'utf8')).epoch}catch{return 0}}
async function advance(){await writeFile(path.join(scope,'epoch.json'),JSON.stringify({epoch:await epoch()+1})+'\n',{mode:0o600})}
import {inventory,resourceIdentity} from '../dist/services.js';
export async function fixedTargetFixture(request,executor){
 if(!request.input){if(request.args[1]?.includes('epoch:exists')||request.args[1]?.includes('epoch=target_operation_epoch(scope) if exists')){const observed=await executor.run({executable:'docker',args:['info','--format','{"ID":{{json .ID}}}'],sensitive:true});return{code:0,stdout:JSON.stringify({schemaVersion:1,epoch:await epoch(),principal:process.getuid(),scope,active:false,engine:JSON.parse(observed.stdout).ID,endpoint:'unix:///var/run/docker.sock'}),stderr:''};}return null;}const r=JSON.parse(Buffer.from(request.input));
 if(r.association&&r.bundle){
  const a=r.association;let source=request.args[1];
  if(request.executable==='python3')source=`import pwd,os\nclass FixturePrincipal: pw_uid=os.getuid();pw_dir=${JSON.stringify(home)}\npwd.getpwuid=lambda _:FixturePrincipal()\n`+source.replace('import os,sys,json,stat,hashlib,secrets,re',`def fixture_engine(): return ${JSON.stringify({engine:'fixture-engine',endpoint:'unix:///var/run/docker.sock'})}\nlease_engine=fixture_engine\nimport os,sys,json,stat,hashlib,secrets,re`);
  else source=`require('node:os').userInfo=()=>({uid:process.getuid(),homedir:${JSON.stringify(home)}});`+source.replace('const fs=leaseFs,path=leasePath,crypto=leaseCrypto;',`leaseEngine=()=>(${JSON.stringify({engine:'fixture-engine',endpoint:'unix:///var/run/docker.sock'})});const fs=leaseFs,path=leasePath,crypto=leaseCrypto;`);
  return local.run({...request,args:[request.args[0],source]});
 }
 if(r.targetGuard&&r.phase){const delegated={...request,input:Buffer.from(JSON.stringify({...r,targetGuard:undefined})),executable:r.outputDirectory?request.executable:'docker',args:r.outputDirectory?request.args:['compose','exec','-T','web','node','/app/scripts/setup-database-v1.mjs']};const result=await executor.run(delegated);if(result.code===0)await advance();return result;}
 if(Object.keys(r).sort().join(',')==='installationId,root'&&request.args[1]?.includes('image_files')||Object.keys(r).sort().join(',')==='installationId,root'&&request.args[1]?.includes('imageFiles')){
  const files={};for(const n of await readdir(r.root))files[n]=createHash('sha256').update(await readFile(r.root+'/'+n)).digest('hex');const observed=await executor.run({executable:'docker',args:['info','--format','{"ID":{{json .ID}}}'],sensitive:true});return{code:0,stdout:JSON.stringify({schemaVersion:1,files,epoch:await epoch(),principal:process.getuid(),scope,active:false,engine:JSON.parse(observed.stdout).ID,endpoint:'unix:///var/run/docker.sock'}),stderr:''};
 }
 if(['services','start'].includes(r.action)&&r.model&&r.contract&&Object.hasOwn(r,'epoch')){
  try{const effect=await executor.run({executable:'docker',args:['compose','--project-name',r.project,'--project-directory',r.root,'-f',r.root+'/compose.yaml',...(r.action==='start'?['start']:['up','--detach','--no-build','--pull','never','--no-recreate']),'postgres','web','livekit','caddy'],sensitive:true});if(effect.code!==0)throw Error();const resources=await inventory(executor);if(resources.containers.length!==4||resources.volumes.length!==4||resources.networks.length!==1||resources.containers.some(c=>!c.Running))throw Error();await advance();return{code:0,stdout:JSON.stringify({schemaVersion:1,running:true,alreadyRunning:false,resources:resourceIdentity(resources)}),stderr:''};}catch{return{code:4,stdout:'',stderr:''}}
 }
 return null;
}

export async function advanceFixtureTarget(){await advance()}

export {home as fixtureHome};
export async function resetFixtureTarget(){home=await mkdtemp(path.join(os.tmpdir(),'castlink-injected-target-'));scope=path.join(home,'.castlink-target-operations');homes.add(home);}

// Fixture construction only: switch the simulated selected transport before stages.
export async function retargetFixtureCursor(directory,request){const file=path.join(directory,'target-cursor.json'),record=JSON.parse(await readFile(file,'utf8'));record.request=structuredClone(request);await writeFile(file,JSON.stringify(record,null,2)+'\n',{mode:0o600})}
