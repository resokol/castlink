import {nodeServiceTarget,pythonServiceTarget} from './service-target.js';
import {pythonImageTarget} from './image-target.js';
import type {Executor} from './types.js';
import {CliError} from './types.js';
import {parseStrictJson} from './strict-json.js';
// Existing service guards are retained with one CREATED-only network predicate.
// This dispatcher removes exact cold IDs; no Compose down/stop or force removal.
const nodePrelude=nodeServiceTarget.split("let serviceInput=")[0]!.replace("c.Networks[network]?.NetworkID!==owned.networks[0]?.Id","!uninstallNetwork(c,owned.networks[0],network)");
const pythonPrelude=pythonServiceTarget.slice(0,pythonServiceTarget.lastIndexOf('\ntry:\n raw=')).replace("networks.get(network,{}).get('NetworkID')!=owned['networks'][0]['Id']","not uninstall_network(c,owned['networks'][0],network)");
const pythonNative=pythonImageTarget.slice(pythonImageTarget.indexOf('def image_run('),pythonImageTarget.indexOf('def image_docker(')).replace('def image_run(args):','def uninstall_native(args):').replace("['docker']+args","args").replaceAll('1048576','65536').replace('lease_time.monotonic()+120','lease_time.monotonic()+10');
export const uninstallDiagnosis='Uninstall is unverified or blocked; retain the private profile, attempt and target lock. Diagnose actual state read-only; automatic retry, forced stop and registration removal are unavailable.';
export class UninstallError extends CliError{}
export type UninstallReply={schemaVersion:1;status:'not-uninstalled'|'uninstalled-retained'|'uninstalled-deleted';epoch:number};
export async function runUninstallTarget(request:unknown,executor:Executor,remote:boolean):Promise<UninstallReply>{
 try{const result=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonUninstallTarget]:['-e',nodeUninstallTarget],input:Buffer.from(JSON.stringify(request)),sensitive:true});if(result.code!==0||result.stderr)throw Error();const reply=parseStrictJson(result.stdout,1024) as UninstallReply;if(Object.keys(reply).sort().join(',')!=='epoch,schemaVersion,status'||reply.schemaVersion!==1||!Number.isSafeInteger(reply.epoch)||reply.epoch<0||!['not-uninstalled','uninstalled-retained','uninstalled-deleted'].includes(reply.status))throw Error();return reply;}catch{throw new UninstallError(uninstallDiagnosis,4);}
}
export const nodeUninstallTarget=nodePrelude+String.raw`
const uninstallStateFormat='{"Id":{{json .Id}},"Running":{{json .State.Running}},"Restarting":{{json .State.Restarting}},"Status":{{json .State.Status}}}';
function uninstallAbsent(p){try{leaseFs.lstatSync(p);leaseFail()}catch(e){if(e.code!=='ENOENT')throw e}}
function uninstallNative(args){const c=leaseChild.spawnSync('systemctl',args,{encoding:'utf8',stdio:['ignore','pipe','pipe'],maxBuffer:65536,timeout:10000,windowsHide:true,shell:false});if(c.error||c.signal||c.stderr||![0,1].includes(c.status))leaseFail();return c.stdout}
function uninstallControllers(r){
 if(process.platform!=='linux')leaseFail();const home=leaseOs.userInfo().homedir,name='castlink-controller-'+r.installationId,units=[name+'.service',name+'.timer'];
 for(const file of ['controller-','host-controller-','registration-'])uninstallAbsent(leasePath.join(r.scope,file+r.installationId+'.json'));uninstallAbsent(leasePath.join(r.scope,'livekit-control-'+r.installationId));
 const user=[leasePath.join(home,'.config/systemd/user'),leasePath.join(home,'.local/share/systemd/user')];
 for(const directory of user){let p=directory;while(p!==home){try{const s=leaseFs.lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink())leaseFail()}catch(e){if(e.code!=='ENOENT')throw e}p=leasePath.dirname(p)}}
 for(const directory of [...user,'/etc/systemd/system','/run/systemd/system','/usr/lib/systemd/system','/lib/systemd/system','/etc/systemd/user','/run/systemd/user','/usr/lib/systemd/user','/lib/systemd/user','/run/user/'+r.principal+'/systemd/user'])for(const unit of units)uninstallAbsent(leasePath.join(directory,unit));
 for(const mode of [[],['--global'],['--user']])if(uninstallNative([...mode,'list-unit-files','--no-legend','--no-pager',...units]).trim()!=='')leaseFail();
 const present=p=>{try{leaseFs.lstatSync(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}},system=leaseFs.readFileSync('/proc/1/comm','utf8').trim()==='systemd'||present('/run/systemd/system');
 let userManager=present('/run/user/'+r.principal+'/bus')||present('/run/user/'+r.principal+'/systemd/private');const pids=leaseFs.readdirSync('/proc').filter(p=>/^[0-9]+$/.test(p));if(pids.length>4096)leaseFail();for(const pid of pids){if(pid==='1')continue;try{if(leaseFs.statSync('/proc/'+pid).uid===r.principal&&leaseFs.readFileSync('/proc/'+pid+'/comm','utf8').trim()==='systemd')userManager=true}catch(e){if(!['ENOENT','ESRCH'].includes(e.code))throw e}}
 for(const mode of [...(system?[[]]:[]),...(userManager?[['--user']]:[])]){const output=uninstallNative([...mode,'show','--no-pager','--property=LoadState','--property=ActiveState','--property=UnitFileState',...units]);const records=output.trim().split(/\n\s*\n/);if(records.length!==2||records.some(s=>!serviceEqual(s.split('\n').sort(),['ActiveState=inactive','LoadState=not-found','UnitFileState='].sort())))leaseFail()}
}
function uninstallGeneration(r){const p=leaseOs.userInfo();if(p.uid!==process.getuid()||r.principal!==p.uid||r.scope!==leasePath.join(p.homedir,'.castlink-target-operations')||leaseFs.realpathSync(p.homedir)!==p.homedir||!serviceEqual(leaseEngine(),{engine:r.engine,endpoint:r.endpoint}))leaseFail();leasePrivate(r.scope,true);uninstallAbsent(leasePath.join(r.scope,'active'));if(targetOperationEpoch(r.scope)!==r.epoch)leaseFail()}
function uninstallRoot(r){const s=leasePrivate(r.root,true);if(leaseFs.realpathSync(r.root)!==r.root)leaseFail();return{dev:s.dev,ino:s.ino}}
function uninstallCold(o){for(const c of o.containers){const state=JSON.parse(imageDocker(['inspect','--format',uninstallStateFormat,c.Id]));if(!serviceEqual(Object.keys(state).sort(),['Id','Restarting','Running','Status'])||state.Id!==c.Id||state.Running!==false||state.Restarting!==false||!['created','exited'].includes(state.Status))leaseFail()}}
// Docker CREATED containers have not joined the bridge yet. Only a fresh
// actual CREATED/cold state permits the empty ID; never synthesize an ID.
function uninstallNetwork(c,network,name){if(!network||network.Name!==name)return false;const id=c.Networks[name]?.NetworkID;if(id===network.Id)return true;if(id!=='')return false;uninstallCold({containers:[c]});const state=JSON.parse(imageDocker(['inspect','--format',uninstallStateFormat,c.Id]));return state.Status==='created'&&state.Running===false&&state.Restarting===false}
function uninstallOwned(r){return serviceOwned(r,serviceInventory())}
function uninstallAuthority(r){const association={schemaVersion:1,root:r.root,installationId:r.installationId,engine:r.engine,endpoint:r.endpoint,files:r.files,contract:r.contract};if(!serviceEqual(JSON.parse(imageRead(leasePath.join(r.scope,'services-'+r.installationId+'.json'))),association)||!serviceEqual(JSON.parse(imageRead(leasePath.join(r.scope,'resources-'+r.installationId+'.json'))),{schemaVersion:1,resources:r.resources}))leaseFail()}
function uninstallPost(r,root){const post=uninstallOwned(r),expected={containers:[],volumes:r.deleteData?[]:r.resources.volumes,networks:r.resources.networks};if(!serviceEqual(serviceIdentity(post),expected))leaseFail();uninstallControllers(r);if(!serviceEqual(leaseEngine(),{engine:r.engine,endpoint:r.endpoint}))leaseFail();if(r.deleteData)uninstallAbsent(r.root);else{if(!serviceEqual(uninstallRoot(r),root))leaseFail();serviceConfig(r)}}
let uninstallInput='';process.stdin.setEncoding('utf8');process.stdin.on('data',b=>{uninstallInput+=b;if(Buffer.byteLength(uninstallInput)>1048576)process.exit(4)});process.stdin.on('end',()=>{try{
 const r=JSON.parse(uninstallInput),base=['schemaVersion','mode','root','installationId','engine','endpoint','epoch','principal','scope','profileSHA256'];if(!r||r.schemaVersion!==1||!['observe','remove'].includes(r.mode)||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId)||!/^([a-f0-9]{64})$/.test(r.profileSHA256)||typeof r.root!=='string'||!leasePath.isAbsolute(r.root)||leasePath.resolve(r.root)!==r.root||r.root==='/'||!Number.isSafeInteger(r.epoch)||r.epoch<0)leaseFail();
 const receiptPath=leasePath.join(r.scope,'uninstall-'+r.installationId+'.json'),attemptPath=leasePath.join(r.scope,'uninstall-'+r.installationId+'-attempt.json');
 if(r.mode==='observe'){
  if(!serviceEqual(Object.keys(r).sort(),base.sort()))leaseFail();uninstallGeneration(r);uninstallControllers(r);
  try{leaseFs.lstatSync(receiptPath)}catch(e){if(e.code!=='ENOENT')throw e;uninstallAbsent(attemptPath);console.log(JSON.stringify({schemaVersion:1,status:'not-uninstalled',epoch:r.epoch}));return}
  const receipt=JSON.parse(imageRead(receiptPath));if(!serviceEqual(Object.keys(receipt).sort(),['contract','epoch','request','rootAssociation','schemaVersion'])||receipt.schemaVersion!==1||receipt.contract!=='castlink-uninstall-v1'||receipt.epoch!==r.epoch||receipt.request.epoch+1!==r.epoch)leaseFail();for(const key of base.filter(k=>!['mode','epoch'].includes(k)))if(!serviceEqual(receipt.request[key],r[key]))leaseFail();if(!serviceEqual(JSON.parse(imageRead(attemptPath)),{schemaVersion:1,request:receipt.request,rootAssociation:receipt.rootAssociation}))leaseFail();uninstallPost(receipt.request,receipt.rootAssociation);uninstallGeneration(r);console.log(JSON.stringify({schemaVersion:1,status:receipt.request.deleteData?'uninstalled-deleted':'uninstalled-retained',epoch:r.epoch}));return;
 }
 if(!serviceEqual(Object.keys(r).sort(),[...base,'deleteData','files','project','model','contract','resources','caddySHA256'].sort())||typeof r.deleteData!=='boolean'||r.project!=='castlink-'+r.installationId.replaceAll('-','')||r.contract.installationId!==r.installationId||r.contract.project!==r.project||r.contract.composePath!==r.root+'/compose.yaml'||r.contract.composeSHA256!==r.files['compose.yaml']||r.model.name!==r.project||Object.keys(r.model.services).sort().join(',')!=='caddy,livekit,postgres,web'||!(r.deleteData?['compose.yaml,livekit.yaml,postgres.env,receipt.json,web.env']:['compose.yaml,livekit.yaml,postgres.env,receipt.json,web.env','compose.yaml,livekit.yaml,owner.json,postgres.env,receipt.json,web.env']).includes(Object.keys(r.files).sort().join(',')))leaseFail();
 const lease=acquireTargetOperation({schemaVersion:1,kind:'uninstall',root:r.root,installationId:r.installationId,engine:r.engine,epoch:r.epoch,principal:r.principal,scope:r.scope});if(lease.owner.endpoint!==r.endpoint)leaseFail();uninstallAbsent(receiptPath);uninstallAbsent(attemptPath);uninstallControllers(r);serviceConfig(r);uninstallAuthority(r);const root=uninstallRoot(r),pre=uninstallOwned(r);if(pre.containers.length!==4||pre.volumes.length!==4||pre.networks.length!==1||!serviceEqual(serviceIdentity(pre),r.resources))leaseFail();uninstallCold(pre);servicePersist(attemptPath,{schemaVersion:1,request:r,rootAssociation:root});dispatchTargetOperation(lease);
 const remaining=structuredClone(r.resources);for(const entry of r.resources.containers){uninstallControllers(r);serviceConfig(r);const now=uninstallOwned(r);if(!serviceEqual(serviceIdentity(now),remaining)||!serviceEqual(uninstallRoot(r),root))leaseFail();uninstallCold(now);dispatchTargetOperation(lease);imageEffect(['container','rm',entry.id]);remaining.containers=remaining.containers.filter(c=>c.id!==entry.id);if(!serviceEqual(serviceIdentity(uninstallOwned(r)),remaining))leaseFail()}
 if(r.deleteData){for(const entry of r.resources.volumes){uninstallControllers(r);serviceConfig(r);if(!serviceEqual(uninstallRoot(r),root)||!serviceEqual(serviceIdentity(uninstallOwned(r)),remaining))leaseFail();dispatchTargetOperation(lease);imageEffect(['volume','rm',entry.name]);remaining.volumes=remaining.volumes.filter(v=>v.name!==entry.name);if(!serviceEqual(serviceIdentity(uninstallOwned(r)),remaining))leaseFail()}if(!serviceEqual(imageFiles(r.root,r.installationId),r.files)||!serviceEqual(uninstallRoot(r),root))leaseFail();for(const name of Object.keys(r.files)){if(!serviceEqual(uninstallRoot(r),root)||leaseCrypto.createHash('sha256').update(imageRead(leasePath.join(r.root,name))).digest('hex')!==r.files[name])leaseFail();uninstallControllers(r);dispatchTargetOperation(lease);leaseFs.unlinkSync(leasePath.join(r.root,name));leaseSync(r.root)}if(!serviceEqual(uninstallRoot(r),root)||leaseFs.readdirSync(r.root).length)leaseFail();leaseFs.rmdirSync(r.root);leaseSync(leasePath.dirname(r.root))}
 uninstallPost(r,root);servicePersist(receiptPath,{schemaVersion:1,contract:'castlink-uninstall-v1',request:r,rootAssociation:root,epoch:r.epoch+1});releaseTargetOperation(lease,true);console.log(JSON.stringify({schemaVersion:1,status:r.deleteData?'uninstalled-deleted':'uninstalled-retained',epoch:r.epoch+1}));
 }catch{process.exitCode=4}});
`;
export const pythonUninstallTarget=pythonPrelude+'\n'+pythonNative+String.raw`
uninstall_state_format='{"Id":{{json .Id}},"Running":{{json .State.Running}},"Restarting":{{json .State.Restarting}},"Status":{{json .State.Status}}}'
def uninstall_absent(p):
 if lease_os.path.lexists(p): lease_fail()
def uninstall_systemctl(args):
 code,out,err=uninstall_native(['systemctl']+args)
 if code not in (0,1) or err: lease_fail()
 return out.decode()
def uninstall_controllers(r):
 if sys.platform!='linux': lease_fail()
 home=lease_pwd.getpwuid(lease_os.getuid()).pw_dir;name='castlink-controller-'+r['installationId'];units=[name+'.service',name+'.timer']
 for prefix in ('controller-','host-controller-','registration-'): uninstall_absent(lease_os.path.join(r['scope'],prefix+r['installationId']+'.json'))
 uninstall_absent(lease_os.path.join(r['scope'],'livekit-control-'+r['installationId']))
 user=[lease_os.path.join(home,'.config/systemd/user'),lease_os.path.join(home,'.local/share/systemd/user')]
 for directory in user:
  p=directory
  while p!=home:
   try:
    s=lease_os.lstat(p)
    if not lease_stat.S_ISDIR(s.st_mode) or lease_stat.S_ISLNK(s.st_mode): lease_fail()
   except FileNotFoundError: pass
   p=lease_os.path.dirname(p)
 for directory in user+['/etc/systemd/system','/run/systemd/system','/usr/lib/systemd/system','/lib/systemd/system','/etc/systemd/user','/run/systemd/user','/usr/lib/systemd/user','/lib/systemd/user','/run/user/'+str(r['principal'])+'/systemd/user']:
  for unit in units: uninstall_absent(lease_os.path.join(directory,unit))
 for mode in ([],['--global'],['--user']):
  if uninstall_systemctl(mode+['list-unit-files','--no-legend','--no-pager']+units).strip(): lease_fail()
 with open('/proc/1/comm') as f: system=f.read().strip()=='systemd' or lease_os.path.lexists('/run/systemd/system')
 user_manager=lease_os.path.lexists('/run/user/'+str(r['principal'])+'/bus') or lease_os.path.lexists('/run/user/'+str(r['principal'])+'/systemd/private');pids=[p for p in lease_os.listdir('/proc') if p.isdigit()]
 if len(pids)>4096: lease_fail()
 for pid in pids:
  if pid=='1': continue
  try:
   if lease_os.stat('/proc/'+pid).st_uid==r['principal']:
    with open('/proc/'+pid+'/comm') as f:
     if f.read().strip()=='systemd': user_manager=True
  except (FileNotFoundError,ProcessLookupError): pass
 for mode in ([[]] if system else [])+([['--user']] if user_manager else []):
  raw=uninstall_systemctl(mode+['show','--no-pager','--property=LoadState','--property=ActiveState','--property=UnitFileState']+units);records=lease_re.split(r'\n\s*\n',raw.strip())
  if len(records)!=2 or any(sorted(v.splitlines())!=sorted(['ActiveState=inactive','LoadState=not-found','UnitFileState=']) for v in records): lease_fail()
def uninstall_generation(r):
 p=lease_pwd.getpwuid(lease_os.getuid())
 if p.pw_uid!=r['principal'] or lease_os.path.join(p.pw_dir,'.castlink-target-operations')!=r['scope'] or lease_os.path.realpath(p.pw_dir)!=p.pw_dir or lease_engine()!={'engine':r['engine'],'endpoint':r['endpoint']}: lease_fail()
 lease_private(r['scope'],True);uninstall_absent(lease_os.path.join(r['scope'],'active'))
 if target_operation_epoch(r['scope'])!=r['epoch']: lease_fail()
def uninstall_root(r):
 s=lease_private(r['root'],True)
 if lease_os.path.realpath(r['root'])!=r['root']: lease_fail()
 return {'dev':s.st_dev,'ino':s.st_ino}
def uninstall_cold(o):
 for c in o['containers']:
  state=lease_json.loads(image_docker(['inspect','--format',uninstall_state_format,c['Id']]))
  if set(state)!={'Id','Running','Restarting','Status'} or state['Id']!=c['Id'] or state['Running'] is not False or state['Restarting'] is not False or state['Status'] not in ('created','exited'): lease_fail()
def uninstall_network(c,network,name):
 if network['Name']!=name: return False
 actual=c['Networks'].get(name,{}).get('NetworkID')
 if actual==network['Id']: return True
 if actual!='': return False
 uninstall_cold({'containers':[c]});state=lease_json.loads(image_docker(['inspect','--format',uninstall_state_format,c['Id']]))
 return state['Status']=='created' and state['Running'] is False and state['Restarting'] is False
def uninstall_owned(r): return service_owned(r,service_inventory())
def uninstall_authority(r):
 association={k:r[k] for k in ('schemaVersion','root','installationId','engine','endpoint','files','contract')}
 if lease_json.loads(image_read(lease_os.path.join(r['scope'],'services-'+r['installationId']+'.json')))!=association or lease_json.loads(image_read(lease_os.path.join(r['scope'],'resources-'+r['installationId']+'.json')))!={'schemaVersion':1,'resources':r['resources']}: lease_fail()
def uninstall_post(r,root):
 post=uninstall_owned(r);expected={'containers':[],'volumes':[] if r['deleteData'] else r['resources']['volumes'],'networks':r['resources']['networks']}
 if service_identity(post)!=expected: lease_fail()
 uninstall_controllers(r)
 if lease_engine()!={'engine':r['engine'],'endpoint':r['endpoint']}: lease_fail()
 if r['deleteData']: uninstall_absent(r['root'])
 else:
  if uninstall_root(r)!=root: lease_fail()
  service_config(r)
def uninstall_persist(p,v):
 f=lease_os.open(p,lease_os.O_WRONLY|lease_os.O_CREAT|lease_os.O_EXCL|lease_os.O_NOFOLLOW,0o600)
 try:
  b=(lease_json.dumps(v)+'\n').encode();offset=0
  while offset<len(b): offset+=lease_os.write(f,b[offset:])
  lease_os.fsync(f)
 finally: lease_os.close(f)
 lease_sync(lease_os.path.dirname(p))
try:
 raw=sys.stdin.buffer.read(1048577)
 if len(raw)>1048576: lease_fail()
 r=lease_json.loads(raw);base={'schemaVersion','mode','root','installationId','engine','endpoint','epoch','principal','scope','profileSHA256'}
 if type(r['schemaVersion']) is not int or r['schemaVersion']!=1 or type(r['principal']) is not int or r['principal']<0 or r['mode'] not in ('observe','remove') or not lease_re.fullmatch('[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}',r['installationId']) or not lease_re.fullmatch('[a-f0-9]{64}',r['profileSHA256']) or not isinstance(r['root'],str) or not lease_os.path.isabs(r['root']) or lease_os.path.normpath(r['root'])!=r['root'] or r['root']=='/' or type(r['epoch']) is not int or r['epoch']<0: lease_fail()
 receipt_path=lease_os.path.join(r['scope'],'uninstall-'+r['installationId']+'.json');attempt_path=lease_os.path.join(r['scope'],'uninstall-'+r['installationId']+'-attempt.json')
 if r['mode']=='observe':
  if set(r)!=base: lease_fail()
  uninstall_generation(r);uninstall_controllers(r)
  if not lease_os.path.lexists(receipt_path):
   uninstall_absent(attempt_path);print(lease_json.dumps({'schemaVersion':1,'status':'not-uninstalled','epoch':r['epoch']}));sys.exit(0)
  receipt=lease_json.loads(image_read(receipt_path))
  if set(receipt)!={'schemaVersion','contract','request','rootAssociation','epoch'} or type(receipt['schemaVersion']) is not int or receipt['schemaVersion']!=1 or type(receipt['epoch']) is not int or type(receipt['request']['epoch']) is not int or receipt['contract']!='castlink-uninstall-v1' or receipt['epoch']!=r['epoch'] or receipt['request']['epoch']+1!=r['epoch']: lease_fail()
  for key in base-{'mode','epoch'}:
   if receipt['request'][key]!=r[key]: lease_fail()
  if lease_json.loads(image_read(attempt_path))!={'schemaVersion':1,'request':receipt['request'],'rootAssociation':receipt['rootAssociation']}: lease_fail()
  uninstall_post(receipt['request'],receipt['rootAssociation']);uninstall_generation(r);print(lease_json.dumps({'schemaVersion':1,'status':'uninstalled-deleted' if receipt['request']['deleteData'] else 'uninstalled-retained','epoch':r['epoch']}));sys.exit(0)
 if set(r)!=base|{'deleteData','files','project','model','contract','resources','caddySHA256'} or type(r['deleteData']) is not bool or r['project']!='castlink-'+r['installationId'].replace('-','') or r['contract']['installationId']!=r['installationId'] or r['contract']['project']!=r['project'] or r['contract']['composePath']!=r['root']+'/compose.yaml' or r['contract']['composeSHA256']!=r['files']['compose.yaml'] or r['model']['name']!=r['project'] or set(r['model']['services'])!={'postgres','web','livekit','caddy'} or set(r['files']) not in ([{'compose.yaml','livekit.yaml','postgres.env','web.env','receipt.json'}] if r['deleteData'] else [{'compose.yaml','livekit.yaml','postgres.env','web.env','receipt.json'},{'compose.yaml','livekit.yaml','owner.json','postgres.env','web.env','receipt.json'}]): lease_fail()
 lease=acquire_target_operation({k:r[k] for k in ('schemaVersion','root','installationId','engine','epoch','principal','scope')}|{'kind':'uninstall'})
 if lease['owner']['endpoint']!=r['endpoint']: lease_fail()
 uninstall_absent(receipt_path);uninstall_absent(attempt_path);uninstall_controllers(r);service_config(r);uninstall_authority(r);root=uninstall_root(r);pre=uninstall_owned(r)
 if len(pre['containers'])!=4 or len(pre['volumes'])!=4 or len(pre['networks'])!=1 or service_identity(pre)!=r['resources']: lease_fail()
 uninstall_cold(pre);uninstall_persist(attempt_path,{'schemaVersion':1,'request':r,'rootAssociation':root});dispatch_target_operation(lease);remaining=lease_json.loads(lease_json.dumps(r['resources']))
 for entry in r['resources']['containers']:
  uninstall_controllers(r);service_config(r);now=uninstall_owned(r)
  if service_identity(now)!=remaining or uninstall_root(r)!=root: lease_fail()
  uninstall_cold(now);dispatch_target_operation(lease);image_effect(['container','rm',entry['id']]);remaining['containers']=[c for c in remaining['containers'] if c['id']!=entry['id']]
  if service_identity(uninstall_owned(r))!=remaining: lease_fail()
 if r['deleteData']:
  for entry in r['resources']['volumes']:
   uninstall_controllers(r);service_config(r)
   if uninstall_root(r)!=root or service_identity(uninstall_owned(r))!=remaining: lease_fail()
   dispatch_target_operation(lease);image_effect(['volume','rm',entry['name']]);remaining['volumes']=[v for v in remaining['volumes'] if v['name']!=entry['name']]
   if service_identity(uninstall_owned(r))!=remaining: lease_fail()
  if image_files(r['root'],r['installationId'])!=r['files'] or uninstall_root(r)!=root: lease_fail()
  for name in r['files']:
   if uninstall_root(r)!=root or __import__('hashlib').sha256(image_read(lease_os.path.join(r['root'],name))).hexdigest()!=r['files'][name]: lease_fail()
   uninstall_controllers(r);dispatch_target_operation(lease);lease_os.unlink(lease_os.path.join(r['root'],name));lease_sync(r['root'])
  if uninstall_root(r)!=root or lease_os.listdir(r['root']): lease_fail()
  lease_os.rmdir(r['root']);lease_sync(lease_os.path.dirname(r['root']))
 uninstall_post(r,root);uninstall_persist(receipt_path,{'schemaVersion':1,'contract':'castlink-uninstall-v1','request':r,'rootAssociation':root,'epoch':r['epoch']+1});release_target_operation(lease,True);print(lease_json.dumps({'schemaVersion':1,'status':'uninstalled-deleted' if r['deleteData'] else 'uninstalled-retained','epoch':r['epoch']+1}))
except BaseException as error:
 if isinstance(error,SystemExit) and error.code==0: raise
 sys.exit(4)
`;
