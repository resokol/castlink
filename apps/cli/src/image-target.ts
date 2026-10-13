import {nodeTargetLease,pythonTargetLease} from './target-operation.js';
// Fixed image-cache dispatcher. No caller argv, script, credentials or diagnostics
// cross its result boundary. The lease is retained on every uncertain outcome.
const imageFormat='{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"Variant":{{if index . "Variant"}}{{json (index . "Variant")}}{{else}}""{{end}},"RepoDigests":{{json .RepoDigests}},"Volumes":{{json (index .Config "Volumes")}}}';
const resourceFormats={container:'{"Id":{{json .Id}},"Name":{{json .Name}},"Labels":{{json .Config.Labels}},"Mounts":{{json .Mounts}},"Networks":{{json .NetworkSettings.Networks}}}',volume:'{"Name":{{json .Name}},"Labels":{{json .Labels}}}',network:'{"Id":{{json .Id}},"Name":{{json .Name}},"Labels":{{json .Labels}}}'};
export const nodeImageTarget=nodeTargetLease+String.raw`
const imageFormat=${JSON.stringify(imageFormat)},imageResourceFormats=${JSON.stringify(resourceFormats)};
function imageRead(p){return leaseReadProtected(p)}
function imageRun(a){const p=leaseChild.spawnSync('docker',a,{stdio:['ignore','pipe','pipe'],maxBuffer:1048576,timeout:120000,windowsHide:true,shell:false});if(p.error||p.signal)leaseFail();return p}
function imageEffect(a){const p=imageRun(a);if(p.status!==0)leaseFail()}
function imageDocker(a){const p=imageRun(a);if(p.status!==0||p.stderr.length)leaseFail();return p.stdout.toString('utf8')}
function imageFiles(root,id){leasePrivate(root,true);leasePrivate(leasePath.dirname(root),true);if(leaseFs.realpathSync(root)!==root)leaseFail();const names=leaseFs.readdirSync(root).sort();if(names.join(',')!=='compose.yaml,livekit.yaml,postgres.env,receipt.json,web.env'&&names.join(',')!=='compose.yaml,livekit.yaml,owner.json,postgres.env,receipt.json,web.env')leaseFail();const files={};for(const name of names){const bytes=imageRead(leasePath.join(root,name));files[name]=leaseCrypto.createHash('sha256').update(bytes).digest('hex');if(['receipt.json','owner.json'].includes(name)){const value=JSON.parse(bytes);if(value.schemaVersion!==1||(name==='receipt.json'&&Object.hasOwn(value,'owner')?value.owner?.installationId:value.installationId)!==id)leaseFail()}}return files}
function imageInventory(project){const result={},network=project+'_castlink';for(const kind of ['container','volume','network']){const names=imageDocker([kind,'ls',...(kind==='container'?['--all']:[]),'--quiet',...(kind==='volume'?[]:['--no-trunc'])]).trim().split('\n').filter(Boolean);if(names.length>128||new Set(names).size!==names.length||names.some(n=>!(kind==='volume'?/^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/:/^[a-f0-9]{64}$/).test(n)))leaseFail();result[kind]=[];for(const n of names){const v=JSON.parse(imageDocker([kind,'inspect','--format',imageResourceFormats[kind],n]));if(!v||typeof v!=='object'||(kind==='volume'?v.Name:v.Id)!==n)leaseFail();const touched=v.Labels?.['com.docker.compose.project']===project||typeof v.Name!=='string'||(kind==='container'?v.Name.startsWith('/'+project+'-'):v.Name.startsWith(project+'_'));if(touched)leaseFail();if(kind==='container'&&(!Array.isArray(v.Mounts)||!v.Networks||v.Mounts.some(m=>typeof m.Name==='string'&&m.Name.startsWith(project+'_'))||Object.hasOwn(v.Networks,network)))leaseFail();result[kind].push(v)}}return result}
function imageIdentity(r){const p=imageRun(['image','inspect','--format',imageFormat,r.reference]);if(p.status===1&&p.stdout.length===0&&p.stderr.toString()==='Error response from daemon: No such image: '+r.reference+'\n')return null;if(p.status!==0||p.stderr.length)leaseFail();const v=JSON.parse(p.stdout);if(!v||Object.keys(v).sort().join(',')!=='Architecture,Id,Os,RepoDigests,Variant,Volumes'||!/^sha256:[a-f0-9]{64}$/.test(v.Id)||v.Os!=='linux'||v.Architecture!==r.architecture||!(v.Variant===''||r.architecture==='arm64'&&v.Variant==='v8')||!Array.isArray(v.RepoDigests)||v.RepoDigests.length>128||v.RepoDigests.some(d=>typeof d!=='string')||new Set(v.RepoDigests).size!==v.RepoDigests.length||!v.RepoDigests.includes(r.reference)||v.Volumes!==null&&(!v.Volumes||Array.isArray(v.Volumes)||Object.entries(v.Volumes).some(([n,x])=>!r.targets.includes(n)||JSON.stringify(x)!=='{}')))leaseFail();return {...v,RepoDigests:[r.reference]}}
function imagePayload(r){if(!r||Object.keys(r).sort().join(',')!=='architecture,endpoint,engine,epoch,files,installationId,principal,project,reference,root,schemaVersion,scope,targets'||r.schemaVersion!==1||!['amd64','arm64'].includes(r.architecture)||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId)||r.project!=='castlink-'+r.installationId.replaceAll('-','')||typeof r.reference!=='string'||!/^[a-z0-9.-]+(?::[0-9]+)?\/[a-z0-9._/-]+@sha256:[a-f0-9]{64}$/.test(r.reference)||!Array.isArray(r.targets)||r.targets.length>16||r.targets.some(v=>typeof v!=='string'||!/^\/[A-Za-z0-9_./-]+$/.test(v)))leaseFail()}
let imageInput='';process.stdin.setEncoding('utf8');process.stdin.on('data',b=>{imageInput+=b;if(Buffer.byteLength(imageInput)>1048576)process.exit(4)});process.stdin.on('end',()=>{try{const r=JSON.parse(imageInput);imagePayload(r);const lease=acquireTargetOperation({schemaVersion:1,kind:'images',root:r.root,installationId:r.installationId,engine:r.engine,epoch:r.epoch,principal:r.principal,scope:r.scope});const equal=require('node:util').isDeepStrictEqual;if(lease.owner.endpoint!==r.endpoint||!equal(imageFiles(r.root,r.installationId),r.files))leaseFail();const inventory=imageInventory(r.project);let identity=imageIdentity(r),pulled=false;if(!identity){dispatchTargetOperation(lease);imageEffect(['image','pull','--platform','linux/'+r.architecture,r.reference]);pulled=true;identity=imageIdentity(r);if(!identity)leaseFail()}if(!equal(leaseEngine(),{engine:r.engine,endpoint:r.endpoint})||!equal(imageFiles(r.root,r.installationId),r.files)||!equal(imageInventory(r.project),inventory))leaseFail();releaseTargetOperation(lease,true);console.log(JSON.stringify({schemaVersion:1,pulled,image:identity}))}catch{process.exitCode=4}});
`;
export const pythonImageTarget=pythonTargetLease+String.raw`
import sys,hashlib
image_format=${JSON.stringify(imageFormat)}
image_resource_formats=lease_json.loads(${JSON.stringify(JSON.stringify(resourceFormats))})
def image_read(p):
 before=lease_private(p,False)
 if before.st_size>1048576: lease_fail()
 fd=lease_os.open(p,lease_os.O_RDONLY|lease_os.O_NOFOLLOW)
 try:
  held=lease_os.fstat(fd);b=lease_os.read(fd,1048577);after=lease_os.fstat(fd);named=lease_os.lstat(p)
  if held.st_dev!=before.st_dev or held.st_ino!=before.st_ino or len(b)>1048576 or len(b)!=held.st_size or held.st_size!=after.st_size or held.st_mtime_ns!=after.st_mtime_ns or held.st_ctime_ns!=after.st_ctime_ns or named.st_dev!=held.st_dev or named.st_ino!=held.st_ino: lease_fail()
  return b
 finally: lease_os.close(fd)
def image_run(args):
 child=None;selector=lease_selectors.DefaultSelector();buffers={'stdout':bytearray(),'stderr':bytearray()};total=0
 try:
  child=lease_subprocess.Popen(['docker']+args,stdin=lease_subprocess.DEVNULL,stdout=lease_subprocess.PIPE,stderr=lease_subprocess.PIPE)
  for name in buffers: selector.register(getattr(child,name),lease_selectors.EVENT_READ,name)
  deadline=lease_time.monotonic()+120
  while selector.get_map():
   if lease_time.monotonic()>deadline: lease_fail()
   for key,_ in selector.select(min(.1,max(0,deadline-lease_time.monotonic()))):
    b=lease_os.read(key.fileobj.fileno(),65536)
    if not b: selector.unregister(key.fileobj);continue
    total+=len(b)
    if total>1048576: lease_fail()
    buffers[key.data].extend(b)
  code=child.wait(timeout=max(.001,deadline-lease_time.monotonic()))
  return code,bytes(buffers['stdout']),bytes(buffers['stderr'])
 finally:
  selector.close()
  if child is not None:
   if child.poll() is None: child.kill()
   child.wait()
   child.stdout.close();child.stderr.close()
def image_effect(args):
 code,out,err=image_run(args)
 if code!=0: lease_fail()
def image_docker(args):
 code,out,err=image_run(args)
 if code!=0 or err: lease_fail()
 return out
def image_files(root,identifier):
 lease_private(root,True);lease_private(lease_os.path.dirname(root),True)
 if lease_os.path.realpath(root)!=root: lease_fail()
 names=sorted(lease_os.listdir(root))
 if names not in [sorted(['compose.yaml','livekit.yaml','postgres.env','receipt.json','web.env']),sorted(['compose.yaml','livekit.yaml','owner.json','postgres.env','receipt.json','web.env'])]: lease_fail()
 files={}
 for name in names:
  b=image_read(root+'/'+name);files[name]=hashlib.sha256(b).hexdigest()
  if name in ('receipt.json','owner.json'):
   value=lease_json.loads(b)
   if value.get('schemaVersion')!=1 or (value.get('owner',{}).get('installationId') if name=='receipt.json' and 'owner' in value else value.get('installationId'))!=identifier: lease_fail()
 return files
def image_inventory(project):
 result={};network=project+'_castlink'
 for kind in ('container','volume','network'):
  names=image_docker([kind,'ls']+(['--all'] if kind=='container' else [])+['--quiet']+([] if kind=='volume' else ['--no-trunc'])).decode().strip().splitlines()
  if len(names)>128 or len(set(names))!=len(names) or any(not lease_re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,254}' if kind=='volume' else '[a-f0-9]{64}',n) for n in names): lease_fail()
  result[kind]=[]
  for n in names:
   v=lease_json.loads(image_docker([kind,'inspect','--format',image_resource_formats[kind],n]))
   if not isinstance(v,dict) or v.get('Name' if kind=='volume' else 'Id')!=n or not isinstance(v.get('Name'),str): lease_fail()
   if (v.get('Labels') or {}).get('com.docker.compose.project')==project or v['Name'].startswith('/'+project+'-' if kind=='container' else project+'_'): lease_fail()
   if kind=='container' and (not isinstance(v.get('Mounts'),list) or not isinstance(v.get('Networks'),dict) or any(isinstance(m.get('Name'),str) and m['Name'].startswith(project+'_') for m in v['Mounts']) or network in v['Networks']): lease_fail()
   result[kind].append(v)
 return result
def image_identity(r):
 code,out,err=image_run(['image','inspect','--format',image_format,r['reference']])
 if code==1 and not out and err==('Error response from daemon: No such image: '+r['reference']+'\n').encode(): return None
 if code!=0 or err: lease_fail()
 v=lease_json.loads(out)
 if not isinstance(v,dict) or set(v)!={'Id','Os','Architecture','Variant','RepoDigests','Volumes'} or not lease_re.fullmatch('sha256:[a-f0-9]{64}',v.get('Id','')) or v.get('Os')!='linux' or v.get('Architecture')!=r['architecture'] or v.get('Variant') not in (['','v8'] if r['architecture']=='arm64' else ['']) or not isinstance(v.get('RepoDigests'),list) or len(v['RepoDigests'])>128 or any(not isinstance(d,str) for d in v['RepoDigests']) or len(set(v['RepoDigests']))!=len(v['RepoDigests']) or r['reference'] not in v['RepoDigests']: lease_fail()
 volumes=v.get('Volumes')
 if volumes is not None and (not isinstance(volumes,dict) or any(n not in r['targets'] or x!={} for n,x in volumes.items())): lease_fail()
 return dict(v,RepoDigests=[r['reference']])
try:
 raw=sys.stdin.buffer.read(1048577)
 if len(raw)>1048576: lease_fail()
 r=lease_json.loads(raw)
 if set(r)!={'schemaVersion','root','installationId','engine','epoch','endpoint','project','files','reference','architecture','targets','principal','scope'} or r['schemaVersion']!=1 or r['architecture'] not in ('amd64','arm64') or not lease_re.fullmatch('[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}',r['installationId']) or r['project']!='castlink-'+r['installationId'].replace('-','') or not lease_re.fullmatch('[a-z0-9.-]+(:[0-9]+)?/[a-z0-9._/-]+@sha256:[a-f0-9]{64}',r['reference']) or not isinstance(r['targets'],list) or len(r['targets'])>16 or any(not isinstance(v,str) or not lease_re.fullmatch('/[A-Za-z0-9_./-]+',v) for v in r['targets']): lease_fail()
 lease=acquire_target_operation({k:r[k] for k in ('schemaVersion','root','installationId','engine','epoch','principal','scope')}|{'kind':'images'})
 if lease['owner']['endpoint']!=r['endpoint'] or image_files(r['root'],r['installationId'])!=r['files']: lease_fail()
 inventory=image_inventory(r['project']);identity=image_identity(r);pulled=False
 if identity is None:
  dispatch_target_operation(lease);image_effect(['image','pull','--platform','linux/'+r['architecture'],r['reference']]);pulled=True;identity=image_identity(r)
  if identity is None: lease_fail()
 if lease_engine()!={'engine':r['engine'],'endpoint':r['endpoint']} or image_files(r['root'],r['installationId'])!=r['files'] or image_inventory(r['project'])!=inventory: lease_fail()
 release_target_operation(lease,True)
 print(lease_json.dumps({'schemaVersion':1,'pulled':pulled,'image':identity}))
except BaseException: sys.exit(4)
`;

// Read-only input capture: these hints are verified again inside the held lease.
export const nodeImageObservation=nodeImageTarget.split('let imageInput=')[0]+String.raw`
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',b=>{input+=b;if(Buffer.byteLength(input)>4096)process.exit(4)});process.stdin.on('end',()=>{try{const r=JSON.parse(input);if(Object.keys(r).sort().join(',')!=='installationId,root')leaseFail();const present=p=>{try{leaseFs.lstatSync(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}};if(process.platform==='win32'){const i=winIdentity();console.log(JSON.stringify({schemaVersion:1,principal:{kind:'windows-sid',sid:i.principal},scope:i.scope,files:imageFiles(r.root,r.installationId),epoch:winEpoch(i),active:present(leasePath.join(i.scope,'active')),...winEngine()}))}else{const user=leaseOs.userInfo(),home=user.homedir;if(user.uid!==process.getuid()||leaseFs.realpathSync(home)!==home||leaseFs.lstatSync(home).uid!==user.uid)leaseFail();const scope=leasePath.join(home,'.castlink-target-operations'),exists=present(scope);if(exists)leasePrivate(scope,true);console.log(JSON.stringify({schemaVersion:1,principal:user.uid,scope,files:imageFiles(r.root,r.installationId),epoch:exists?targetOperationEpoch(scope):0,active:exists&&present(leasePath.join(scope,'active')),...leaseEngine()}))}}catch{process.exitCode=4}});
`;
export const pythonImageObservation=pythonImageTarget.slice(0,pythonImageTarget.lastIndexOf('\ntry:\n raw='))+String.raw`
try:
 raw=sys.stdin.buffer.read(4097)
 if len(raw)>4096: lease_fail()
 r=lease_json.loads(raw)
 if set(r)!={'root','installationId'}: lease_fail()
 home=lease_pwd.getpwuid(lease_os.getuid()).pw_dir
 if lease_os.path.realpath(home)!=home or lease_os.lstat(home).st_uid!=lease_os.getuid(): lease_fail()
 scope=home+'/.castlink-target-operations';exists=lease_os.path.lexists(scope)
 if exists: lease_private(scope,True)
 print(lease_json.dumps(dict(schemaVersion=1,principal=lease_os.getuid(),scope=scope,files=image_files(r['root'],r['installationId']),epoch=target_operation_epoch(scope) if exists else 0,active=exists and lease_os.path.lexists(scope+'/active'),**lease_engine())))
except BaseException: sys.exit(4)
`;
