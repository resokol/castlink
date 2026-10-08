import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
const source=process.cwd();

async function deployment(root,variant='valid') {
 const code=`import importlib.util,json,pathlib,sys
s=importlib.util.spec_from_file_location('p',${JSON.stringify(path.join(source,'scripts/server-provision-vps.py'))});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
root=pathlib.Path(${JSON.stringify(root)});original=m.Path;m.Path=lambda value:root if value=='/opt' else original(value)
m.discover=lambda:[];m.ports_available=lambda:None;m.event=lambda **values:None
c='a'*40;r={'schemaVersion':1,'commit':c,'images':{k:'castlink-easy-'+k+':'+c for k in m.SERVICES},'distributionRepository':'resokol/castlink-releases','capabilities':['peer-profile-v1','root-ssh-v1']}
m.download_release=lambda url,checksum,destination:destination.write_bytes(b'fixture')
m.prepare_release=lambda folder:r;m.docker=lambda *args,**kwargs:''
requests=[];phases=[]
def compose(folder,*args,body=None,**kwargs):
 if '/app/scripts/setup-database-v1.mjs' in args:
  requests.append(body);p=json.loads(body);phase=p['phase'];phases.append(phase)
  ack={**p,'contract':'castlink-database-v1','migrations':{'roomVersions':[1,2,3,4],'controlVersions':[1,2,3,4,5],'schema':True,'hashes':True},'seed':None if phase=='migrations' else {'installations':1,'accounts':1,'organizations':1,'memberships':1,'nodes':1,'studios':1,'rooms':0}}
  variant=${JSON.stringify(variant)}
  if variant=='empty':return ''
  if variant=='refused':return json.dumps({'ok':False,'diagnosis':'database-contract-refused'})
  if variant=='wrong-phase':ack['phase']='seed'
  if variant=='wrong-identity':ack['installationId']='22222222-2222-4222-8222-222222222222'
  if variant=='wrong-schema':ack['migrations']['controlVersions']=[1,2]
  if variant=='wrong-seed' and phase=='seed':ack['seed']['nodes']=0
  return json.dumps(ack)
 if '/app/scripts/server-profile-store.mjs' in args:
  state=json.loads((folder/'.castlink-install.json').read_text());return json.dumps({'installationId':state['installationId'],'id':state['nodeId'],'origin':'https://8.8.8.8'})
 return ''
m.compose=compose
error=None
try:m.deploy({'host':'8.8.8.8','releaseUrl':'fixture','releaseSha256':'b'*64,'releaseCommit':c,'releaseCommitPrefix':c[:12]})
except ValueError as e:error=str(e)
state=json.loads(next(root.glob('*/.castlink-install.json')).read_text())
print(json.dumps({'requests':requests,'phases':phases,'completed':state['completed'],'databasePhase':state['databasePhase'],'error':error}))`;
 return JSON.parse((await execute(process.env.CASTLINK_PYTHON||'python3',['-c',code],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})).stdout);
}

test('actual Python deployment crosses the real Node canonical-input validator and checks phase acknowledgements',async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-python-db-'));
 try {
  const deploymentRoot=path.join(root,'deploy');await fs.mkdir(deploymentRoot);
  const result=await deployment(deploymentRoot);
  assert.equal(result.error,null);assert.deepEqual(result.phases,['migrations','seed']);assert.equal(result.completed,true);
  const runtime=path.join(root,'runtime');await fs.mkdir(path.join(runtime,'scripts'),{recursive:true});
  await fs.mkdir(path.join(runtime,'apps/web/node_modules/pg'),{recursive:true});
  await fs.writeFile(path.join(runtime,'apps/web/package.json'),'{}');
  await fs.writeFile(path.join(runtime,'apps/web/node_modules/pg/index.js'),`module.exports={Pool:class{constructor(){require('node:fs').writeFileSync(process.env.FIXTURE_POOL_MARKER,'reached');throw Error('fixture stops before DB');}}};`);
  for(const name of ['setup-database-v1.mjs','setup-database-schema.mjs','control-plane-seed-transaction.mjs'])await fs.copyFile(path.join(source,'scripts',name),path.join(runtime,'scripts',name));
  for(const directory of ['postgres','control-plane'])await fs.cp(path.join(source,'infrastructure',directory),path.join(runtime,'infrastructure',directory),{recursive:true});
  for(const [index,body] of result.requests.entries()){
   const request=JSON.parse(body),marker=path.join(root,'pool-'+index);
   const {spawn}=await import('node:child_process');
   const processChild=spawn(process.execPath,[path.join(runtime,'scripts/setup-database-v1.mjs')],{cwd:runtime,env:{...process.env,DATABASE_URL:'postgresql://fixture:fixture@invalid/fixture',CASTLINK_CONTROL_PLANE_DATABASE_URL:'',STUDIOLINK_INSTALLATION_ID:request.installationId,CASTLINK_NODE_ID:request.nodeId,CASTLINK_NODE_TYPE:'self-hosted',CASTLINK_DEPLOYMENT_MODEL:'self-hosted',STUDIOLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_DEFAULT_ORGANIZATION_ID:'org-default',CASTLINK_DEFAULT_STUDIO_ID:'studio-default',CASTLINK_DEFAULT_ACCOUNT_ID:'account-owner',FIXTURE_POOL_MARKER:marker},stdio:['pipe','pipe','pipe']});
   const ended=new Promise((resolve,reject)=>{processChild.once('error',reject);processChild.once('close',resolve);});
   processChild.stdout.resume();processChild.stderr.resume();processChild.stdin.end(body);assert.equal(await ended,3,'fixture intentionally stops at SQL construction, after input validation');
   assert.equal(await fs.readFile(marker,'utf8').catch(()=>''),'reached','actual Python request must pass the real Node exact-JSON validator before any SQL');
   assert.equal(body,JSON.stringify(request));
  }
 }finally{await fs.rm(root,{recursive:true,force:true});}
});

test('successful child exit without pinned database acknowledgement cannot mark a reserve completed',async()=>{
 for(const variant of ['empty','refused','wrong-phase','wrong-identity','wrong-schema','wrong-seed']){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-python-db-refusal-'));
  try{const result=await deployment(root,variant);assert.match(result.error||'',/database/i,variant);assert.equal(result.completed,false,variant);assert.equal(result.databasePhase,'new',variant);assert.deepEqual(result.phases,variant==='wrong-seed'?['migrations','seed']:['migrations']);}
  finally{await fs.rm(root,{recursive:true,force:true});}
 }
});
