import {fixedNodeArguments} from './fixed-node-program.js';
import {nodeSqlGuard,pythonSqlGuard,type TargetSqlGuard} from './target-sql-guard.js';
import path from 'node:path';
import {isDeepStrictEqual} from 'node:util';
import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
export class OwnerPhaseError extends CliError {}
export type OwnerMetadata={schemaVersion:1;contract:'castlink-owner-host-v1';installationId:string;nodeId:string;filePath:string;origin:string;status:'verified';expiresAt:number};
export type OwnerHostRequest={schemaVersion:1;phase:'inspect'|'prepare'|'verify';installationId:string;nodeId:string;origin:string;containerId:string;outputDirectory:string;allowExisting:boolean;allowInitial:boolean};
// Programs, paths inside the container and Docker verbs are fixed. Archive bytes
// and invite URL stay inside the selected-target helper, including SSH targets.
export const nodeOwnerTarget=nodeSqlGuard+String.raw`const fs=require('node:fs'),path=require('node:path'),{spawnSync}=require('node:child_process');
function fail(){throw Error()}
function field(b,a,n){return b.subarray(a,a+n).toString('ascii').replace(/\0.*$/s,'')}
function octal(b,a,n){const s=field(b,a,n).trim();if(!/^[0-7]+$/.test(s))fail();return parseInt(s,8)}
function digest(b){let offset=0,file,pax=false,ended=false;while(offset+512<=b.length){const h=b.subarray(offset,offset+512);offset+=512;if(h.every(x=>x===0)){if(b.length-offset<512||!b.subarray(offset).every(x=>x===0))fail();ended=true;break}
let sum=0;for(let i=0;i<512;i++)sum+=(i>=148&&i<156)?32:h[i];if(h.some(x=>x>127)||octal(h,148,8)!==sum)fail();if(field(h,257,6)!=='ustar'||field(h,345,155)!=='')fail();const size=octal(h,124,12),type=field(h,156,1),name=field(h,0,100);if(size>2048||offset+Math.ceil(size/512)*512>b.length)fail();const body=b.subarray(offset,offset+size);if(!b.subarray(offset+size,offset+Math.ceil(size/512)*512).every(x=>x===0))fail();offset+=Math.ceil(size/512)*512;
if(type==='x'){if(pax||file)fail();pax=true;let pos=0;while(pos<body.length){const space=body.indexOf(32,pos);if(space<0)fail();const n=Number(body.subarray(pos,space).toString());if(!Number.isInteger(n)||n<5||pos+n>body.length||body[pos+n-1]!==10)fail();const record=body.subarray(space+1,pos+n-1).toString('utf8'),eq=record.indexOf('='),key=record.slice(0,eq),value=record.slice(eq+1);if(eq<1||!['path','mtime','atime','ctime'].includes(key))fail();if(key==='path'?value!=='owner-invite.txt':!/^\d+(\.\d+)?$/.test(value))fail();pos+=n}continue}
if(type!=='0'&&type!=='')fail();if(name!=='owner-invite.txt'||file||size===0||octal(h,100,8)!==384)fail();file=body;
}if(!ended||!file||offset>b.length)fail();return file}
const cap=262144,win=process.platform==='win32';let publicDiagnosis='owner-host-contract-refused';
const serverDiagnoses=['owner-contract-refused','owner-database-conflict','owner-file-conflict','owner-file-incomplete','owner-invite-expired','owner-invite-consumed','owner-attempt-incomplete'];
function run(exe,args,input,maxBuffer=cap){const r=spawnSync(exe,args,{input,maxBuffer,timeout:20000,windowsHide:true,shell:false});if(r.error||r.status!==0||r.stderr.length){try{const o=JSON.parse(r.stdout.toString('utf8'));if(Object.keys(o).sort().join(',')==='contract,diagnosis,ok,schemaVersion'&&o.schemaVersion===1&&o.contract==='castlink-owner-v1'&&o.ok===false&&serverDiagnoses.includes(o.diagnosis))publicDiagnosis=o.diagnosis;}catch{}fail();}return r.stdout}
function privateCheck(file,directory){const s=fs.lstatSync(file);if(s.isSymbolicLink()||!(directory?s.isDirectory():s.isFile())||!directory&&(s.nlink!==1||s.size>2048))fail();if(win){if(winInspect(file,directory).path!==file)fail()}else if(s.uid!==process.getuid()||(s.mode&0o777)!==(directory?448:384))fail();return s}
function syncDir(dir){if(win)return;const fd=fs.openSync(dir,'r');try{fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function hostDirectory(dir,create){const parts=[];let at=dir;while(at!==path.dirname(at)){parts.unshift(at);at=path.dirname(at)}for(const p of parts){if(!fs.existsSync(p)){if(p!==dir||!create) return false;if(win){const i=winIdentity(),created=winBridge({action:'mkdir',path:p,principal:i.principal,scope:i.scope});if(!winSame(winInspect(p,true,i),created))fail()}else fs.mkdirSync(p,{mode:448});syncDir(path.dirname(p))}const s=fs.lstatSync(p);if(s.isSymbolicLink()||!s.isDirectory())fail()}privateCheck(dir,true);return true}
function read(file){if(win)return leaseReadProtected(file,2048);const s=privateCheck(file,false),fd=fs.openSync(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));try{const held=fs.fstatSync(fd);if(s.ino!==held.ino||s.dev!==held.dev)fail();const raw=fs.readFileSync(fd),after=privateCheck(file,false);if(after.ino!==held.ino||after.dev!==held.dev)fail();return raw}finally{fs.closeSync(fd)}}
function request(raw){const r=JSON.parse(raw);if(raw!==JSON.stringify(r)||Object.keys(r).sort().join(',')!=='allowExisting,allowInitial,containerId,installationId,nodeId,origin,outputDirectory,phase,schemaVersion'||r.schemaVersion!==1||!['inspect','prepare','verify'].includes(r.phase)||typeof r.allowExisting!=='boolean'||typeof r.allowInitial!=='boolean'||typeof r.installationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId)||r.nodeId!=='srv-'+r.installationId.replaceAll('-','')||typeof r.containerId!=='string'||!/^[a-f0-9]{64}$/.test(r.containerId)||typeof r.outputDirectory!=='string'||!path.isAbsolute(r.outputDirectory)||path.resolve(r.outputDirectory)!==r.outputDirectory||r.outputDirectory===path.parse(r.outputDirectory).root||/[\x00-\x1f\x7f]/.test(r.outputDirectory))fail();const u=new URL(r.origin);if(u.protocol!=='https:'||u.origin!==r.origin)fail();return r}
function server(r,initial=false){const input=JSON.stringify({schemaVersion:1,installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,phase:initial?'initial':'retained'}),raw=run('docker',['exec','-i',r.containerId,'node','/app/scripts/super-admin-owner.mjs','--installer-v1'],input,2048).toString('utf8'),o=JSON.parse(raw);if(Object.keys(o).sort().join(',')!=='contract,expiresAt,filePath,installationId,nodeId,origin,schemaVersion,status'||o.schemaVersion!==1||o.contract!=='castlink-owner-v1'||o.installationId!==r.installationId||o.nodeId!==r.nodeId||o.origin!==r.origin||o.filePath!=='/data/.castlink-owner/'+r.installationId+'/owner-invite.txt'||o.status!=='verified'||!Number.isSafeInteger(o.expiresAt)||o.expiresAt<=Date.now())fail();return o}
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>8192)process.exit(4)});
process.stdin.on('end',()=>{try{const envelope=JSON.parse(input),g=envelope.targetGuard;delete envelope.targetGuard;const r=request(JSON.stringify(envelope));let lease;if(r.phase!=='inspect'){if(g.operation.kind!=='owner'||g.containerId!==r.containerId)fail();lease=sqlGuard(g,r.installationId,r.nodeId);dispatchTargetOperation(lease)}const file=path.join(r.outputDirectory,'owner-invite.txt'),ready=hostDirectory(r.outputDirectory,r.phase==='prepare');if(r.phase!=='inspect'&&!ready)fail();const present=ready&&fs.existsSync(file);if(r.phase==='verify'&&!present)fail();if(present){if(!r.allowExisting)fail();read(file)}
if(r.phase==='inspect'){console.log(JSON.stringify({schemaVersion:1,contract:'castlink-owner-host-v1',filePath:file,status:present?'present':'absent'}));return}
const o=server(r,r.allowInitial&&r.phase==='prepare'),bytes=digest(run('docker',['cp',r.containerId+':'+o.filePath,'-']));const text=bytes.toString('utf8'),url=new URL(text.trim()),token=new URLSearchParams(url.hash.slice(1)).get('access'),expected=new URL('/super-admin',r.origin);expected.hash=new URLSearchParams({access:token}).toString();if(typeof token!=='string'||!/^csa2\.[A-Za-z0-9_-]{43}$/.test(token)||text!==expected.href+'\n')fail();
if(present){if(!read(file).equals(bytes))fail()}else{if(win)leaseWriteProtected(file,bytes);else{const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|(fs.constants.O_NOFOLLOW||0),384);try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}syncDir(r.outputDirectory)}
if(!read(file).equals(bytes)||JSON.stringify(server(r))!==JSON.stringify(o))fail();syncDir(r.outputDirectory);sqlGuardCheck(g,lease,r.installationId,r.nodeId);releaseTargetOperation(lease,true);console.log(JSON.stringify({...o,contract:'castlink-owner-host-v1',filePath:file}));
}catch{console.log(JSON.stringify({schemaVersion:1,contract:'castlink-owner-host-v1',ok:false,diagnosis:publicDiagnosis}));process.exitCode=4}});
`;
export const pythonOwnerTarget=pythonSqlGuard+String.raw`import os,sys,json,stat,re,subprocess,tarfile,io,signal
signal.signal(signal.SIGALRM,lambda *_:sys.exit(4));signal.alarm(60)
fds=[]
public_diagnosis='owner-host-contract-refused'
server_diagnoses=('owner-contract-refused','owner-database-conflict','owner-file-conflict','owner-file-incomplete','owner-invite-expired','owner-invite-consumed','owner-attempt-incomplete')
def fail(): raise ValueError()
def pairs(items):
 d={}
 for k,v in items:
  if k in d: fail()
  d[k]=v
 return d
def parse(raw): return json.loads(raw,object_pairs_hook=pairs)
def private(s,directory):
 if not (stat.S_ISDIR(s.st_mode) if directory else stat.S_ISREG(s.st_mode)) or s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=(0o700 if directory else 0o600) or not directory and (s.st_nlink!=1 or s.st_size>2048): fail()
def directory(path,create):
 parts=path.split('/')[1:];fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY);fds.append(fd)
 for i,part in enumerate(parts):
  try: child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
  except FileNotFoundError:
   if i!=len(parts)-1 or not create: return None
   os.mkdir(part,0o700,dir_fd=fd);os.fsync(fd);child=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd)
  fds.append(child);s=os.fstat(child)
  if i==len(parts)-1: private(s,True)
  elif s.st_uid not in (os.stat('/').st_uid,os.geteuid()) or s.st_mode&0o022 and not (s.st_uid==os.stat('/').st_uid and s.st_mode&stat.S_ISVTX): fail()
  fd=child
 return fd
def read(parent):
 fd=os.open('owner-invite.txt',os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=parent);fds.append(fd);s=os.fstat(fd);private(s,False);raw=os.read(fd,2049);after=os.stat('owner-invite.txt',dir_fd=parent,follow_symlinks=False)
 if len(raw)>2048 or (s.st_dev,s.st_ino)!=(after.st_dev,after.st_ino): fail()
 return raw
def run(args,input=None,cap=262144):
 global public_diagnosis
 child=subprocess.Popen(args,stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 try:
  if input is not None: child.stdin.write(input);child.stdin.close()
  raw=child.stdout.read(cap+1)
  if len(raw)>cap: fail()
  if child.wait(timeout=20)!=0:
   try:
    o=parse(raw)
    if isinstance(o,dict) and set(o)=={'schemaVersion','contract','ok','diagnosis'} and o['schemaVersion']==1 and o['contract']=='castlink-owner-v1' and o['ok'] is False and o['diagnosis'] in server_diagnoses: public_diagnosis=o['diagnosis']
   except BaseException: pass
   fail()
  return raw
 finally:
  if child.poll() is None: child.kill()
  child.wait()
def server(r,initial=False):
 request={k:r[k] for k in ('schemaVersion','installationId','nodeId','origin')}
 request['phase']='initial' if initial else 'retained'
 o=parse(run(['docker','exec','-i',r['containerId'],'node','/app/scripts/super-admin-owner.mjs','--installer-v1'],json.dumps(request,separators=(',',':')).encode(),2048))
 if not isinstance(o,dict) or set(o)!=set(('schemaVersion','contract','installationId','nodeId','filePath','origin','status','expiresAt')) or o['schemaVersion']!=1 or o['contract']!='castlink-owner-v1' or any(o[k]!=r[k] for k in ('installationId','nodeId','origin')) or o['filePath']!='/data/.castlink-owner/'+r['installationId']+'/owner-invite.txt' or o['status']!='verified' or type(o['expiresAt']) is not int: fail()
 import time
 if o['expiresAt']<=time.time()*1000: fail()
 return o
def archive(raw):
 if len(raw)<1536 or len(raw)%512 or any(raw[-1024:]): fail()
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:') as t:
  entries=t.getmembers()
  if len(entries)!=1: fail()
  e=entries[0]
  if not e.isfile() or e.name!='owner-invite.txt' or e.mode!=0o600 or not 0<e.size<=2048 or e.linkname: fail()
  for k,v in e.pax_headers.items():
   if k not in ('path','mtime','atime','ctime') or (v!='owner-invite.txt' if k=='path' else re.fullmatch('[0-9]+([.][0-9]+)?',v) is None): fail()
  end=e.offset_data+((e.size+511)//512)*512
  if len(raw)-end<1024 or any(raw[end:]) or any(raw[e.offset_data+e.size:end]): fail()
  b=t.extractfile(e).read(2049)
  if len(b)!=e.size: fail()
  return b
try:
 raw=sys.stdin.buffer.read(8193)
 if len(raw)>8192: fail()
 r=parse(raw);g=r.pop('targetGuard',None)
 if not isinstance(r,dict) or set(r)!=set(('schemaVersion','phase','installationId','nodeId','origin','containerId','outputDirectory','allowExisting','allowInitial')) or type(r['schemaVersion']) is not int or r['schemaVersion']!=1 or r['phase'] not in ('inspect','prepare','verify') or type(r['allowExisting']) is not bool or type(r['allowInitial']) is not bool or not isinstance(r['installationId'],str) or re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',r['installationId']) is None or r['nodeId']!='srv-'+r['installationId'].replace('-','') or not isinstance(r['containerId'],str) or re.fullmatch('[a-f0-9]{64}',r['containerId']) is None: fail()
 from urllib.parse import urlsplit
 u=urlsplit(r['origin'])
 if u.scheme!='https' or u.username or u.password or u.path or u.query or u.fragment or r['origin']!='https://'+u.netloc: fail()
 out=r['outputDirectory']
 if not isinstance(out,str) or not out.startswith('/') or out=='/' or os.path.normpath(out)!=out or any(ord(c)<32 or ord(c)==127 for c in out) or '\\' in out: fail()
 lease=None
 if r['phase']!='inspect':
  if g['operation']['kind']!='owner' or g['containerId']!=r['containerId']: fail()
  lease=sql_guard(g,r['installationId'],r['nodeId']);dispatch_target_operation(lease)
 parent=directory(out,r['phase']=='prepare');file=out+'/owner-invite.txt'
 if r['phase']!='inspect' and parent is None: fail()
 if parent is not None and set(os.listdir(parent))-{'owner-invite.txt'}: fail()
 present=parent is not None and 'owner-invite.txt' in os.listdir(parent)
 if r['phase']=='verify' and not present: fail()
 if present:
  if not r['allowExisting']: fail()
  read(parent)
 if r['phase']=='inspect': print(json.dumps({'schemaVersion':1,'contract':'castlink-owner-host-v1','filePath':file,'status':'present' if present else 'absent'}))
 else:
  o=server(r,r['allowInitial'] and r['phase']=='prepare');b=archive(run(['docker','cp',r['containerId']+':'+o['filePath'],'-']))
  if re.fullmatch(re.escape(r['origin']+'/super-admin#access=csa2.')+'[A-Za-z0-9_-]{43}\\n',b.decode()) is None: fail()
  if present:
   if read(parent)!=b: fail()
  else:
   fd=os.open('owner-invite.txt',os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=parent);fds.append(fd);private(os.fstat(fd),False)
   view=memoryview(b)
   while view:
    n=os.write(fd,view)
    if n<=0: fail()
    view=view[n:]
   os.fsync(fd);os.fsync(parent)
  if read(parent)!=b or server(r)!=o: fail()
  os.fsync(parent);check=directory(out,False)
  if (os.fstat(check).st_dev,os.fstat(check).st_ino)!=(os.fstat(parent).st_dev,os.fstat(parent).st_ino): fail()
  sql_guard_check(g,lease,r['installationId'],r['nodeId']);release_target_operation(lease,True)
  print(json.dumps({**o,'contract':'castlink-owner-host-v1','filePath':file}))
except BaseException:
 print(json.dumps({'schemaVersion':1,'contract':'castlink-owner-host-v1','ok':False,'diagnosis':public_diagnosis}));sys.exit(4)
finally:
 for fd in reversed(fds):
  try: os.close(fd)
  except OSError: pass
`;
const diagnosis='Protected owner source, SQL receipt or host file refused observation; diagnose partial, foreign, expired or consumed state before retry. Setup and readiness remain pending.';
export async function observeOwnerHost(request:OwnerHostRequest,executor:Executor,remote:boolean,targetGuard?:TargetSqlGuard):Promise<OwnerMetadata|{schemaVersion:1;contract:'castlink-owner-host-v1';filePath:string;status:'present'|'absent'}>{
 if(request.phase!=='inspect'&&!targetGuard)throw new OwnerPhaseError('Protected owner mutation requires current target root, engine, endpoint and operation epoch association; owner issuance was not dispatched.',3);
 const filePath=(remote?path.posix:path).join(request.outputDirectory,'owner-invite.txt');
 try{
  const r=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonOwnerTarget]:fixedNodeArguments(nodeOwnerTarget),input:Buffer.from(JSON.stringify({...request,...(targetGuard?{targetGuard}:{})})),sensitive:true});
  const data=parseStrictJson(r.stdout,2048);
  if(r.code!==0||r.stderr!==''){
   const value=data as {diagnosis?:string},messages:Record<string,string>={
    'owner-invite-expired':'The recorded owner invitation expired; setup retry cannot replace it. Diagnose retained SQL and protected files.',
    'owner-invite-consumed':'The recorded owner invitation was consumed; setup retry cannot replace it. Browser setup and readiness remain pending.',
    'owner-attempt-incomplete':'The retained SQL owner attempt is absent; automatic issuance is refused for this ambiguous retry.',
    'owner-file-incomplete':'The recorded persistent owner invitation is missing or incomplete; automatic regeneration is refused.',
    'owner-file-conflict':'The protected persistent owner invitation conflicts or is unsafe; automatic replacement is refused.',
    'owner-database-conflict':'Actual owner SQL, schema or installation topology conflicts; no foreign credential is adopted.',
    'owner-contract-refused':'The pinned server owner-v1 contract is missing, unsupported or refused; owner and readiness remain pending.'
   };
   if(typeof value?.diagnosis==='string'&&messages[value.diagnosis]&&isDeepStrictEqual(data,{schemaVersion:1,contract:'castlink-owner-host-v1',ok:false,diagnosis:value.diagnosis}))throw new OwnerPhaseError(messages[value.diagnosis]!,3);
   throw new OwnerPhaseError(diagnosis,3);
  }
  if(request.phase==='inspect'){
   if(!isDeepStrictEqual(data,{schemaVersion:1,contract:'castlink-owner-host-v1',filePath,status:'absent'})&&!isDeepStrictEqual(data,{schemaVersion:1,contract:'castlink-owner-host-v1',filePath,status:'present'}))throw Error();
   return data as {schemaVersion:1;contract:'castlink-owner-host-v1';filePath:string;status:'present'|'absent'};
  }
  const value=data as OwnerMetadata;if(!Number.isSafeInteger(value?.expiresAt)||value.expiresAt<=Date.now()||!isDeepStrictEqual(value,{schemaVersion:1,contract:'castlink-owner-host-v1',installationId:request.installationId,nodeId:request.nodeId,filePath,origin:request.origin,status:'verified',expiresAt:value.expiresAt}))throw Error();
  return value;
 }catch(e){if(e instanceof OwnerPhaseError)throw e;throw new OwnerPhaseError('Guarded owner response was lost or unsupported; retry observes the retained SQL and private files before advancing. Setup and readiness remain pending.',3);}
}
