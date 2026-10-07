import path from 'node:path';
import {pythonTargetLease} from './target-operation.js';
import {validateConfigTargetAssociation,type ConfigTargetAssociation} from './config-target.js';
import {parseStrictJson} from './strict-json.js';
import {createHash} from 'node:crypto';
import {bundleContents,renderBundle,type BundleInput,type BundleCredentials,type MaterializedBundle} from './bundle.js';
import {CliError,type Executor} from './types.js';
export type RemoteBundleScope={scopeRoot:string;directory:string};
export type RemoteMaterializedBundle=MaterializedBundle&{installationId:string;fingerprints:Record<string,string>};
const marker='__CASTLINK_CREDENTIAL_';
const keys=['postgresPassword','livekitKey','livekitSecret','sessionSecret','dataEncryptionKey','setupToken','nodeSecret'] as const;
// Fixed program. All caller values use stdin; there is no remote shell interpolation.
const helper=pythonTargetLease+String.raw`
import os,sys,json,stat,hashlib,secrets,re
NAMES=('postgres.env','web.env','livekit.yaml','compose.yaml')
KEYS=('postgresPassword','livekitKey','livekitSecret','sessionSecret','dataEncryptionKey','setupToken','nodeSecret')
CAP=131072
fds=[]
readfds=[]
root_uid=os.stat('/').st_uid
def fail(): raise ValueError('conflict')
def pairs(items):
 d={}
 for k,v in items:
  if k in d: fail()
  d[k]=v
 return d
def parse(s): return json.loads(s,object_pairs_hook=pairs)
def digest(b): return hashlib.sha256(b).hexdigest()
def equal(a,b): return json.dumps(a,sort_keys=True,separators=(',',':'))==json.dumps(b,sort_keys=True,separators=(',',':'))
def directory(name,parent=None,private=False):
 fd=os.open(name,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=parent);fds.append(fd);s=os.fstat(fd)
 if not stat.S_ISDIR(s.st_mode): fail()
 if private:
  if s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o700: fail()
 elif s.st_uid not in (root_uid,os.geteuid()) or (s.st_mode&0o022 and not (s.st_uid==root_uid and s.st_mode&stat.S_ISVTX)): fail()
 return fd
def canonical(s):
 if not isinstance(s,str) or len(s)>4096 or not s.startswith('/') or s=='/' or os.path.normpath(s)!=s or any(ord(c)<32 or ord(c)==127 for c in s) or '\\' in s: fail()
 return s
def fileinfo(s):
 if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o600 or s.st_nlink!=1 or s.st_size>CAP: fail()
def read(name):
 fd=os.open(name,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=bundle);fds.append(fd);readfds.append(fd);s=os.fstat(fd);fileinfo(s)
 raw=b''
 while True:
  part=os.read(fd,CAP+1-len(raw))
  if not part: break
  raw+=part
  if len(raw)>CAP: fail()
 if os.fstat(fd)[:7]!=s[:7] or os.fstat(fd).st_mtime_ns!=s.st_mtime_ns or os.fstat(fd).st_ctime_ns!=s.st_ctime_ns or os.stat(name,dir_fd=bundle,follow_symlinks=False)[:7]!=s[:7]: fail()
 return raw
def write(name,raw):
 fd=os.open(name,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=bundle);fds.append(fd)
 fileinfo(os.fstat(fd))
 view=memoryview(raw)
 while view:
  n=os.write(fd,view)
  if n<=0: fail()
  view=view[n:]
 os.fsync(fd);os.fsync(bundle)
def expand(values):
 result={}
 for n,t in request['templates'].items():
  if n=='compose.yaml': result[n]=t.encode();continue
  for k in KEYS: t=t.replace('__CASTLINK_CREDENTIAL_'+k+'__',values[k])
  result[n]=t.encode()
 return result
def credentials(raw):
 web={};pg={}
 for dest,name in ((web,'web.env'),(pg,'postgres.env')):
  text=raw[name].decode()
  if not text.endswith('\n'): fail()
  for line in text[:-1].split('\n'):
   k,sep,v=line.partition('=')
   if not sep or k in dest: fail()
   dest[k]=v
 values=dict(zip(KEYS,(pg.get('POSTGRES_PASSWORD'),web.get('LIVEKIT_API_KEY'),web.get('LIVEKIT_API_SECRET'),web.get('CASTLINK_SESSION_SECRET'),web.get('CASTLINK_DATA_ENCRYPTION_KEY'),web.get('CASTLINK_SETUP_TOKEN'),web.get('CASTLINK_NODE_SECRET'))))
 for k,v in values.items():
  if not isinstance(v,str) or re.fullmatch('lk_[a-f0-9]{32}' if k=='livekitKey' else '[a-f0-9]{64}',v) is None: fail()
 return values
try:
 data=sys.stdin.buffer.read(CAP+1)
 if len(data)>CAP: fail()
 request=parse(data)
 if not isinstance(request,dict) or set(request) not in ({'schemaVersion','scopeRoot','directory','installationId','bundle','templates','verifyOnly','observationOnly'},{'schemaVersion','scopeRoot','directory','installationId','bundle','templates','verifyOnly','observationOnly','association'}) or type(request['schemaVersion']) is not int or request['schemaVersion']!=1: fail()
 association=request.get('association')
 if association is not None and (not isinstance(association,dict) or set(association)!={'engine','endpoint','epoch','principal','scope'} or request['observationOnly']): fail()
 if type(request['verifyOnly']) is not bool or type(request['observationOnly']) is not bool or request['observationOnly'] and not request['verifyOnly']: fail()
 scope=canonical(request['scopeRoot']);root=canonical(request['directory'])
 if not root.startswith(scope+'/') or not isinstance(request['installationId'],str) or re.fullmatch('[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}',request['installationId']) is None: fail()
 # Bind the complete caller-validated declaration, even metadata absent from rendered files.
 declaration=request['bundle']
 if not isinstance(declaration,dict) or set(declaration)!=({'release','installationId','architecture','network','bindIPv4','internet'} if declaration.get('network')=='internet' else {'release','installationId','architecture','network','bindIPv4'}): fail()
 if declaration['installationId']!=request['installationId'] or declaration['architecture'] not in ('amd64','arm64') or declaration['network'] not in ('loopback','lan','internet') or not isinstance(declaration['bindIPv4'],str) or not isinstance(declaration['release'],dict): fail()
 if declaration['network']=='internet' and (not isinstance(declaration['internet'],dict) or set(declaration['internet']) not in ({'domain','publicIPv4'},{'domain','publicIPv4','turnDomain'})): fail()
 templates=request['templates']
 if not isinstance(templates,dict) or set(templates)!=set(NAMES) or any(not isinstance(v,str) or len(v)>65536 for v in templates.values()): fail()
 # Public compose and paths cannot become secret substitution sites.
 if '__CASTLINK_CREDENTIAL_' in root or '__CASTLINK_CREDENTIAL_' in scope or '__CASTLINK_CREDENTIAL_' in templates['compose.yaml']: fail()
 identity_request={k:v for k,v in request.items() if k not in ('verifyOnly','observationOnly','association')}
 lease=None
 if association is not None:
  lease=acquire_target_operation({'schemaVersion':1,'root':root,'installationId':request['installationId'],'engine':association['engine'],'epoch':association['epoch'],'principal':association['principal'],'scope':association['scope'],'kind':'config'})
  if lease['owner']['endpoint']!=association['endpoint']: fail()
 current=directory('/')
 parts=root[1:].split('/');scope_parts=scope[1:].split('/')
 for i,component in enumerate(parts[:-1]):
  current=directory(component,current,i+1>=len(scope_parts))
 parent=current;leaf=parts[-1]
 owner={'schemaVersion':1,'installationId':request['installationId'],'scopeRoot':scope,'directory':root,'requestHash':digest(json.dumps(identity_request,sort_keys=True,separators=(',',':')).encode())}
 fresh=False
 if lease is not None: dispatch_target_operation(lease)
 try:
  if request['verifyOnly']: raise FileExistsError()
  os.mkdir(leaf,0o700,dir_fd=parent);os.fsync(parent);fresh=True
 except FileExistsError: pass
 bundle=directory(leaf,parent,True)
 if fresh:
  write('owner.json',(json.dumps(owner,sort_keys=True)+'\n').encode())
  values={k:('lk_'+secrets.token_hex(16) if k=='livekitKey' else secrets.token_hex(32)) for k in KEYS}
  raw=expand(values)
  for n in NAMES: write(n,raw[n])
  receipt={'schemaVersion':1,'owner':owner,'hashes':{n:digest(raw[n]) for n in NAMES}}|({'network':'internet','internet':declaration['internet']} if declaration['network']=='internet' else {})
  write('receipt.json',(json.dumps(receipt,sort_keys=True)+'\n').encode())
 # Never trust a receipt alone; reconstruct exact semantic artifacts using existing credentials.
 if set(os.listdir(bundle))!=set(NAMES)|{'owner.json','receipt.json'} or not equal(parse(read('owner.json')),owner): fail()
 raw={n:read(n) for n in NAMES}
 if raw!=expand(credentials(raw)): fail()
 hashes={n:digest(raw[n]) for n in NAMES}
 receipt=parse(read('receipt.json'))
 if not equal(receipt,{'schemaVersion':1,'owner':owner,'hashes':hashes}|({'network':'internet','internet':declaration['internet']} if declaration['network']=='internet' else {})): fail()
 # A complete visible receipt after interrupted fsync still requires durable retry.
 if not request['observationOnly']:
  for fd in readfds: os.fsync(fd)
  os.fsync(bundle);os.fsync(parent)
 # Reopen the canonical chain to detect renamed/replaced ancestors before claiming success.
 check=directory('/')
 for i,component in enumerate(parts): check=directory(component,check,i+1>=len(scope_parts))
 if (os.fstat(check).st_dev,os.fstat(check).st_ino)!=(os.fstat(bundle).st_dev,os.fstat(bundle).st_ino): fail()
 result={'schemaVersion':1,'installationId':request['installationId'],'hashes':hashes}
 if lease is not None:
  if lease_engine()!={'engine':association['engine'],'endpoint':association['endpoint']}: fail()
  release_target_operation(lease,True)
  result['operationEpoch']=association['epoch']+1
 sys.stdout.write(json.dumps(result))
except BaseException:
 sys.stdout.write('{"schemaVersion":1,"error":"diagnosis-required"}')
 sys.exit(4)
finally:
 for fd in reversed(fds):
  try: os.close(fd)
  except OSError: pass
`;
function canonical(s:unknown):string {
 if(typeof s!=='string'||s.length>4096||!s.startsWith('/')||s==='/'||path.posix.normalize(s)!==s||/[\x00-\x1f\x7f\\]/.test(s)||s.includes(marker))throw new CliError('Invalid protected remote scope.',2);
 return s;
}
// Caller persists installation identity and owns its profile lock before invoking this writer.
// The selected executor must be SshExecutor for remote use. This library never proves StateStore safety.
export function validateRemoteScope(options:RemoteBundleScope):void {
 const scope=canonical(options.scopeRoot),root=canonical(options.directory);
 if(!root.startsWith(scope+'/'))throw new CliError('Invalid protected remote scope.',2);
}
// Read-only target scope validation before any local lifecycle reservation.
export async function inspectRemoteScope(options:RemoteBundleScope,executor:Executor):Promise<boolean>{
 const scope=structuredClone(options);validateRemoteScope(scope);
 const program=String.raw`import os,sys,json,stat
fds=[]
try:
 r=json.loads(sys.stdin.buffer.read(8193));scope=r['scopeRoot'];root=r['directory'];parts=root[1:].split('/');private_from=len(scope[1:].split('/'))
 fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);fds.append(fd);root_uid=os.fstat(fd).st_uid
 exists=True
 for i,part in enumerate(parts):
  try: fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
  except FileNotFoundError:
   if i!=len(parts)-1: raise
   exists=False;break
  fds.append(fd);s=os.fstat(fd)
  if i+1>=private_from:
   if s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o700: raise ValueError()
  elif s.st_uid not in (root_uid,os.geteuid()) or (s.st_mode&0o022 and not (s.st_uid==root_uid and s.st_mode&stat.S_ISVTX)): raise ValueError()
 print(json.dumps({'schemaVersion':1,'exists':exists}))
except BaseException:
 sys.exit(4)
finally:
 for fd in reversed(fds): os.close(fd)
`;
 try{
  const result=await executor.run({executable:'python3',args:['-c',program],input:Buffer.from(JSON.stringify({schemaVersion:1,...scope})),sensitive:false});
  const data=parseStrictJson(result.stdout,2048) as Record<string,unknown>;
  if(result.code!==0||result.stderr!==''||!data||Object.keys(data).sort().join(',')!=='exists,schemaVersion'||data.schemaVersion!==1||typeof data.exists!=='boolean')throw Error();
  return data.exists;
 }catch{throw new CliError('Remote private scope is unavailable or unsafe; provision operator-owned parents before preparation.',4);}
}
async function remoteBundle(input:Omit<BundleInput,'secretFiles'>,options:RemoteBundleScope,executor:Executor,verifyOnly:boolean,observationOnly:boolean,association?:ConfigTargetAssociation):Promise<RemoteMaterializedBundle&{operationEpoch?:number}>{
 let bundleInput:BundleInput,scopeRoot:string,directory:string;
 try{
  const i=structuredClone(input),o=structuredClone(options);
  if(!i||Object.keys(i).sort().join(',')!==(i.network==='internet'?'architecture,bindIPv4,installationId,internet,network,release':'architecture,bindIPv4,installationId,network,release'))throw Error();
  if(!o||Object.keys(o).sort().join(',')!=='directory,scopeRoot')throw Error();
  scopeRoot=canonical(o.scopeRoot);directory=canonical(o.directory);
  if(!directory.startsWith(scopeRoot+'/')||JSON.stringify(i).includes(marker))throw Error();
  bundleInput={...i,installationId:i.installationId.toLowerCase(),secretFiles:{webEnv:directory+'/web.env',postgresEnv:directory+'/postgres.env',livekitConfig:directory+'/livekit.yaml'}};
  renderBundle(bundleInput);
 }catch{throw new CliError('Invalid protected remote bundle input or scope.',2);}
 if(association)validateConfigTargetAssociation(association);
 const a=association?structuredClone(association):undefined;
 const rendered=renderBundle(bundleInput);
 const credentials=Object.fromEntries(keys.map(k=>[k,marker+k+'__'])) as BundleCredentials;
 const templates=bundleContents(bundleInput,credentials);
 const {secretFiles: _secretPaths,...declaration}=bundleInput;
 const payload=Buffer.from(JSON.stringify({schemaVersion:1,scopeRoot,directory,installationId:bundleInput.installationId,bundle:declaration,templates,verifyOnly,observationOnly,...(a?{association:a}:{})}));
 if(payload.length>131072)throw new CliError('Protected remote bundle payload exceeds limit.',2);
 try{
  const result=await executor.run({executable:'python3',args:['-c',helper],input:payload,sensitive:true});
  if(result.code!==0||result.stderr!==''||typeof result.stdout!=='string')throw Error();
  const data=parseStrictJson(result.stdout,2048) as Record<string,unknown>;
  if(!data||typeof data!=='object'||Array.isArray(data))throw Error();
  if(Object.keys(data).sort().join(',')!==(a?'hashes,installationId,operationEpoch,schemaVersion':'hashes,installationId,schemaVersion')||data.schemaVersion!==1||data.installationId!==bundleInput.installationId)throw Error();
  if(a&&data.operationEpoch!==a.epoch+1)throw Error();
  const hashes=data.hashes;
  if(!hashes||typeof hashes!=='object'||Array.isArray(hashes)||Object.keys(hashes).sort().join(',')!==Object.keys(templates).sort().join(',')||Object.values(hashes).some(v=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v)))throw Error();
  if((hashes as Record<string,string>)['compose.yaml']!==createHash('sha256').update(rendered.composeText).digest('hex'))throw Error();
  return {installationId:bundleInput.installationId,composePath:directory+'/compose.yaml',secretFiles:bundleInput.secretFiles,projectName:rendered.projectName,nodeId:rendered.nodeId,requirements:rendered.requirements,checks:[...rendered.checks.map(c=>c.id==='protected-config'?{...c,state:'pass' as const,message:'Protected remote candidate files and identity verified; installation readiness remains unverified.'}:c)],fingerprints:hashes as Record<string,string>,...(a?{operationEpoch:a.epoch+1}:{})};
 }catch{throw new CliError('Protected remote materialization interrupted or conflicts; private partial artifacts require diagnosis or verified retry.',4);}
}

// Authorized preparation/retry retains its existing durability completion semantics.
export async function materializeRemoteBundle(input:Omit<BundleInput,'secretFiles'>,options:RemoteBundleScope,executor:Executor,verifyOnly=false):Promise<RemoteMaterializedBundle>{
 return remoteBundle(input,options,executor,verifyOnly,false);
}
// Read-only status never completes durability, creates artifacts or repairs them.
export async function observeRemoteBundle(input:Omit<BundleInput,'secretFiles'>,options:RemoteBundleScope,executor:Executor):Promise<RemoteMaterializedBundle>{
 return remoteBundle(input,options,executor,true,true);
}

// Actual CLI target preparation; ordinary materialization/observation remains separate.
export async function materializeRemoteTargetBundle(input:Omit<BundleInput,'secretFiles'>,options:RemoteBundleScope,executor:Executor,association:ConfigTargetAssociation,verifyOnly=false):Promise<RemoteMaterializedBundle&{operationEpoch:number}>{
 validateConfigTargetAssociation(association);
 return await remoteBundle(input,options,executor,verifyOnly,false,association) as RemoteMaterializedBundle&{operationEpoch:number};
}
