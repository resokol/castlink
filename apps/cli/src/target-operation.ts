import {nodeTargetPrivateFiles} from './target-private-files.js';
import {nativeWindowsTargetLease} from './windows-target-lease.js';
// Embedded only in fixed target handlers, never selected by a caller script.
// The deliberately coarse per-principal scope serializes aliases and profiles.
// Conditional primitive contract: root is recorded after lexical validation;
// ownership, canonical existing root/parent, installation association and expected
// selected endpoint belong to the fixed handler PRE under this held lease.
// terminalEvidence is a trusted handler assertion of reap + operation POST,
// not proof supplied by this primitive. Outer handlers normalize every failure.
// An uncertain owner persists; there is no PID/age-based recovery operation.
export const nodeTargetLease=nativeWindowsTargetLease+String.raw`
const leaseFs=require('node:fs'),leasePath=require('node:path'),leaseOs=require('node:os'),leaseCrypto=require('node:crypto'),leaseChild=require('node:child_process');
function leaseFail(){throw Error('target-operation-unverified')}
function leasePrivate(p,directory){
 if(process.platform==='win32'){const actual=winInspect(p,directory);if(actual.path!==p)leaseFail();return leaseFs.lstatSync(p)}
 const s=leaseFs.lstatSync(p);
 if(s.isSymbolicLink()||(directory?!s.isDirectory():!s.isFile())||s.uid!==process.getuid()||(s.mode&511)!==(directory?448:384)||(!directory&&s.nlink!==1))leaseFail();
 let current=leasePath.dirname(p);
 while(leasePath.dirname(current)!==current){if(leaseFs.lstatSync(current).isSymbolicLink())leaseFail();current=leasePath.dirname(current)}
 return s;
}
function leaseSync(p){if(process.platform==='win32'){winInspect(p,true);return}const f=leaseFs.openSync(p,'r');try{leaseFs.fsyncSync(f)}finally{leaseFs.closeSync(f)}}
function leaseRecord(p){
 if(process.platform==='win32')return winRecord(p);
 const before=leasePrivate(p,false),f=leaseFs.openSync(p,leaseFs.constants.O_RDONLY|leaseFs.constants.O_NOFOLLOW);
 try{
  const held=leaseFs.fstatSync(f);if(!held.isFile()||held.nlink!==1||held.dev!==before.dev||held.ino!==before.ino||held.size!==before.size||held.size>8192)leaseFail();
  const bytes=Buffer.alloc(8193);let size=0;
  while(size<bytes.length){const read=leaseFs.readSync(f,bytes,size,bytes.length-size,size);if(read===0)break;size+=read}
  const after=leaseFs.fstatSync(f),named=leaseFs.lstatSync(p);
  if(size>8192||size!==held.size||held.size!==after.size||held.mtimeMs!==after.mtimeMs||held.ctimeMs!==after.ctimeMs||named.dev!==held.dev||named.ino!==held.ino)leaseFail();
  return JSON.parse(bytes.subarray(0,size).toString('utf8'));
 }finally{leaseFs.closeSync(f)}
}
function targetOperationEpoch(scope){if(process.platform==='win32'){const identity=winIdentity();if(identity.scope!==scope)leaseFail();return winEpoch(identity)}const p=leasePath.join(scope,'epoch.json');try{leaseFs.lstatSync(p)}catch(e){if(e.code==='ENOENT')return 0;throw e}const v=leaseRecord(p);if(Object.keys(v).join(',')!=='epoch'||!Number.isSafeInteger(v.epoch)||v.epoch<0)leaseFail();return v.epoch}
function leaseEngine(){
 if(process.platform==='win32')return winEngine();
 const options={encoding:'utf8',stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:65536,windowsHide:true,shell:false};
 const engine=JSON.parse(leaseChild.execFileSync('docker',['info','--format','{"ID":{{json .ID}}}'],options));
 if(Object.keys(engine).join(',')!=='ID'||typeof engine.ID!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(engine.ID))leaseFail();
 const endpoint=process.env.DOCKER_HOST&&!process.env.DOCKER_CONTEXT?process.env.DOCKER_HOST:JSON.parse(leaseChild.execFileSync('docker',['context','inspect','--format','{{json .Endpoints.docker.Host}}'],options));
 if(typeof endpoint!=='string'||!/^unix:\/\/\/[^/]/.test(endpoint)||/[\x00-\x1f\x7f]/.test(endpoint))leaseFail();
 return{engine:engine.ID,endpoint};
}
function acquireTargetOperation(association){
 if(process.platform==='win32'){const p=association?.principal;if(!p||Object.keys(p).sort().join(',')!=='kind,sid'||p.kind!=='windows-sid'||typeof p.sid!=='string')leaseFail();const l=acquireWindowsTargetOperation({...association,principal:p.sid});return{...l,scope:l.identity.scope}}
 if(typeof process.getuid!=='function')leaseFail();
 if(!association||Object.keys(association).sort().join(',')!=='engine,epoch,installationId,kind,principal,root,schemaVersion,scope'||association.schemaVersion!==1||!Number.isSafeInteger(association.epoch)||association.epoch<0||!['config','images','services','database','owner','completion','start','stop','uninstall','backup'].includes(association.kind)||typeof association.root!=='string'||!leasePath.isAbsolute(association.root)||leasePath.resolve(association.root)!==association.root||association.root===leasePath.parse(association.root).root||!/^([a-f0-9]{8})(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(association.installationId))leaseFail();
 const principal=leaseOs.userInfo(),home=principal.homedir;
 if(principal.uid!==process.getuid()||!leasePath.isAbsolute(home)||leaseFs.realpathSync(home)!==home||leaseFs.lstatSync(home).uid!==principal.uid)leaseFail();
 const scope=leasePath.join(home,'.castlink-target-operations');
 if(association.principal!==principal.uid||association.scope!==scope)leaseFail();
 try{leaseFs.mkdirSync(scope,{mode:448});leaseSync(home)}catch(e){if(e.code!=='EEXIST')throw e}
 leasePrivate(scope,true);if(leaseOs.userInfo().uid!==association.principal||leasePath.join(leaseOs.userInfo().homedir,'.castlink-target-operations')!==association.scope)leaseFail();if(targetOperationEpoch(scope)!==association.epoch)leaseFail();
 const active=leasePath.join(scope,'active');
 // A directory without owner.json blocks too. Never reclaim it here.
 leaseFs.mkdirSync(active,{mode:448});leaseSync(scope);
 const stat=leasePrivate(active,true),nonce=leaseCrypto.randomBytes(32).toString('hex');
 // Re-read inside ownership; a predecessor may have completed after the hint.
 if(targetOperationEpoch(scope)!==association.epoch)leaseFail();
 const actual=leaseEngine();if(actual.engine!==association.engine)leaseFail();
 const owner={...association,protocol:'castlink-target-operation-v1',nonce,principal:principal.uid,pid:process.pid,endpoint:actual.endpoint};
 const record=leasePath.join(active,'owner.json'),f=leaseFs.openSync(record,'wx',384);
 try{leaseFs.writeFileSync(f,JSON.stringify(owner)+'\n');leaseFs.fsyncSync(f)}finally{leaseFs.closeSync(f)}
 leaseSync(active);leaseSync(scope);
 return{scope,active,stat,owner,dispatched:false};
}
function dispatchTargetOperation(lease){
 if(process.platform==='win32')return dispatchWindowsTargetOperation(lease);
 const principal=leaseOs.userInfo();if(principal.uid!==lease.owner.principal||leasePath.join(principal.homedir,'.castlink-target-operations')!==lease.owner.scope||leaseFs.realpathSync(principal.homedir)!==principal.homedir)leaseFail();
 const s=leasePrivate(lease.active,true);if(targetOperationEpoch(lease.scope)!==lease.owner.epoch)leaseFail();if(s.dev!==lease.stat.dev||s.ino!==lease.stat.ino||JSON.stringify(leaseRecord(leasePath.join(lease.active,'owner.json')))!==JSON.stringify(lease.owner)||JSON.stringify(leaseEngine())!==JSON.stringify({engine:lease.owner.engine,endpoint:lease.owner.endpoint}))leaseFail();
 lease.dispatched=true;
}
function releaseTargetOperation(lease,terminalEvidence){
 if(process.platform==='win32'){if(terminalEvidence!==true)leaseFail();if(!lease.dispatched)dispatchWindowsTargetOperation(lease);return releaseWindowsTargetOperation(lease,true)}
 // The fixed caller supplies this only after reap + operation-specific POST.
 if(terminalEvidence!==true)leaseFail();
 const principal=leaseOs.userInfo();if(principal.uid!==lease.owner.principal||leasePath.join(principal.homedir,'.castlink-target-operations')!==lease.owner.scope||leaseFs.realpathSync(principal.homedir)!==principal.homedir)leaseFail();
 const s=leasePrivate(lease.active,true);
 if(s.dev!==lease.stat.dev||s.ino!==lease.stat.ino||JSON.stringify(leaseRecord(leasePath.join(lease.active,'owner.json')))!==JSON.stringify(lease.owner)||leaseFs.readdirSync(lease.active).sort().join(',')!=='owner.json')leaseFail();
 if(targetOperationEpoch(lease.scope)!==lease.owner.epoch)leaseFail();
 const epochTemp=leasePath.join(lease.scope,'epoch-'+lease.owner.nonce),epochFd=leaseFs.openSync(epochTemp,'wx',384);try{leaseFs.writeFileSync(epochFd,JSON.stringify({epoch:lease.owner.epoch+1})+'\n');leaseFs.fsyncSync(epochFd)}finally{leaseFs.closeSync(epochFd)}leaseFs.renameSync(epochTemp,leasePath.join(lease.scope,'epoch.json'));leaseSync(lease.scope);
 const retired=leasePath.join(lease.scope,'retired-'+lease.owner.nonce);
 leaseFs.renameSync(lease.active,retired);leaseSync(lease.scope);
 // From this point never touch the canonical name, even if cleanup fails.
 leaseFs.unlinkSync(leasePath.join(retired,'owner.json'));leaseFs.rmdirSync(retired);leaseSync(lease.scope);
}
`+nodeTargetPrivateFiles;
export const pythonTargetLease=String.raw`
import os as lease_os,stat as lease_stat,json as lease_json,secrets as lease_secrets,pwd as lease_pwd,subprocess as lease_subprocess,re as lease_re,selectors as lease_selectors,time as lease_time

def lease_fail(): raise ValueError('target-operation-unverified')
def lease_private(p,directory):
 s=lease_os.lstat(p)
 if lease_stat.S_ISLNK(s.st_mode) or (not lease_stat.S_ISDIR(s.st_mode) if directory else not lease_stat.S_ISREG(s.st_mode)) or s.st_uid!=lease_os.getuid() or lease_stat.S_IMODE(s.st_mode)!=(0o700 if directory else 0o600) or (not directory and s.st_nlink!=1): lease_fail()
 current=lease_os.path.dirname(p)
 while lease_os.path.dirname(current)!=current:
  if lease_stat.S_ISLNK(lease_os.lstat(current).st_mode): lease_fail()
  current=lease_os.path.dirname(current)
 return s

def lease_sync(p):
 fd=lease_os.open(p,lease_os.O_RDONLY|lease_os.O_DIRECTORY)
 try: lease_os.fsync(fd)
 finally: lease_os.close(fd)
def lease_record(p):
 before=lease_private(p,False);fd=lease_os.open(p,lease_os.O_RDONLY|lease_os.O_NOFOLLOW)
 try:
  s=lease_os.fstat(fd);b=lease_os.read(fd,8193)
  if s.st_dev!=before.st_dev or s.st_ino!=before.st_ino or s.st_size!=len(b) or len(b)>8192: lease_fail()
  return lease_json.loads(b)
 finally: lease_os.close(fd)
def target_operation_epoch(scope):
 p=scope+'/epoch.json'
 if not lease_os.path.lexists(p): return 0
 v=lease_record(p)
 if set(v)!={'epoch'} or type(v['epoch']) is not int or v['epoch']<0: lease_fail()
 return v['epoch']
def lease_engine():
 def read(args):
  child=None;selector=lease_selectors.DefaultSelector();buffers={'stdout':bytearray(),'stderr':bytearray()};total=0
  try:
   child=lease_subprocess.Popen(['docker']+args,stdin=lease_subprocess.DEVNULL,stdout=lease_subprocess.PIPE,stderr=lease_subprocess.PIPE,bufsize=0)
   selector.register(child.stdout,lease_selectors.EVENT_READ,'stdout');selector.register(child.stderr,lease_selectors.EVENT_READ,'stderr');deadline=lease_time.monotonic()+10
   while selector.get_map():
    remaining=deadline-lease_time.monotonic()
    if remaining<=0: lease_fail()
    for key,_ in selector.select(min(remaining,.1)):
     data=lease_os.read(key.fileobj.fileno(),4096)
     if not data: selector.unregister(key.fileobj);continue
     total+=len(data)
     if total>65536: lease_fail()
     buffers[key.data].extend(data)
   if child.wait(timeout=max(.001,deadline-lease_time.monotonic()))!=0 or buffers['stderr']: lease_fail()
   return lease_json.loads(buffers['stdout'])
  except BaseException:
   lease_fail()
  finally:
   selector.close()
   if child is not None:
    if child.poll() is None: child.kill()
    child.wait(timeout=2)
    child.stdout.close();child.stderr.close()
 engine=read(['info','--format','{"ID":{{json .ID}}}'])
 if set(engine)!= {'ID'} or not isinstance(engine['ID'],str) or lease_re.fullmatch('[A-Za-z0-9:._-]{1,128}',engine['ID']) is None: lease_fail()
 endpoint=lease_os.environ['DOCKER_HOST'] if lease_os.environ.get('DOCKER_HOST') and not lease_os.environ.get('DOCKER_CONTEXT') else read(['context','inspect','--format','{{json .Endpoints.docker.Host}}'])
 if not isinstance(endpoint,str) or lease_re.match('unix:///[^/]',endpoint) is None or any(ord(v)<32 for v in endpoint): lease_fail()
 return {'engine':engine['ID'],'endpoint':endpoint}

def acquire_target_operation(a):
 if set(a)!={'schemaVersion','root','installationId','engine','kind','epoch','principal','scope'} or a['schemaVersion']!=1 or type(a['epoch']) is not int or a['epoch']<0 or a['kind'] not in ('config','images','services','database','owner','completion','start','stop','uninstall') or not isinstance(a['root'],str) or not lease_os.path.isabs(a['root']) or lease_os.path.normpath(a['root'])!=a['root'] or a['root']=='/' or lease_re.fullmatch('[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}',a['installationId']) is None: lease_fail()
 principal=lease_pwd.getpwuid(lease_os.getuid());home=principal.pw_dir
 if not lease_os.path.isabs(home) or lease_os.path.realpath(home)!=home or lease_os.lstat(home).st_uid!=principal.pw_uid: lease_fail()
 scope=home+'/.castlink-target-operations'
 if type(a['principal']) is not int or a['principal']!=principal.pw_uid or a['scope']!=scope: lease_fail()
 try: lease_os.mkdir(scope,0o700);lease_sync(home)
 except FileExistsError: pass
 lease_private(scope,True)
 current=lease_pwd.getpwuid(lease_os.getuid())
 if current.pw_uid!=a['principal'] or current.pw_dir+'/.castlink-target-operations'!=a['scope']: lease_fail()
 if target_operation_epoch(scope)!=a['epoch']: lease_fail()
 active=scope+'/active'
 lease_os.mkdir(active,0o700);lease_sync(scope);s=lease_private(active,True);nonce=lease_secrets.token_hex(32)
 if target_operation_epoch(scope)!=a['epoch']: lease_fail()
 actual=lease_engine()
 if actual['engine']!=a['engine']: lease_fail()
 owner=dict(a,protocol='castlink-target-operation-v1',nonce=nonce,principal=principal.pw_uid,pid=lease_os.getpid(),endpoint=actual['endpoint'])
 fd=lease_os.open(active+'/owner.json',lease_os.O_WRONLY|lease_os.O_CREAT|lease_os.O_EXCL|lease_os.O_NOFOLLOW,0o600)
 try:
  b=(lease_json.dumps(owner)+'\n').encode();offset=0
  while offset<len(b): offset+=lease_os.write(fd,b[offset:])
  lease_os.fsync(fd)
 finally: lease_os.close(fd)
 lease_sync(active);lease_sync(scope)
 return {'scope':scope,'active':active,'stat':s,'owner':owner,'dispatched':False}

def dispatch_target_operation(l):
 principal=lease_pwd.getpwuid(lease_os.getuid())
 if principal.pw_uid!=l['owner']['principal'] or principal.pw_dir+'/.castlink-target-operations'!=l['owner']['scope'] or lease_os.path.realpath(principal.pw_dir)!=principal.pw_dir: lease_fail()
 s=lease_private(l['active'],True)
 if target_operation_epoch(l['scope'])!=l['owner']['epoch']: lease_fail()
 if s.st_dev!=l['stat'].st_dev or s.st_ino!=l['stat'].st_ino or lease_record(l['active']+'/owner.json')!=l['owner'] or lease_engine()!={'engine':l['owner']['engine'],'endpoint':l['owner']['endpoint']}: lease_fail()
 l['dispatched']=True

def release_target_operation(l,terminal_evidence):
 principal=lease_pwd.getpwuid(lease_os.getuid())
 if principal.pw_uid!=l['owner']['principal'] or principal.pw_dir+'/.castlink-target-operations'!=l['owner']['scope'] or lease_os.path.realpath(principal.pw_dir)!=principal.pw_dir: lease_fail()
 if terminal_evidence is not True: lease_fail()
 s=lease_private(l['active'],True)
 if s.st_dev!=l['stat'].st_dev or s.st_ino!=l['stat'].st_ino or lease_record(l['active']+'/owner.json')!=l['owner'] or set(lease_os.listdir(l['active']))!={'owner.json'}: lease_fail()
 if target_operation_epoch(l['scope'])!=l['owner']['epoch']: lease_fail()
 temp=l['scope']+'/epoch-'+l['owner']['nonce'];fd=lease_os.open(temp,lease_os.O_WRONLY|lease_os.O_CREAT|lease_os.O_EXCL|lease_os.O_NOFOLLOW,0o600)
 try:
  b=(lease_json.dumps({'epoch':l['owner']['epoch']+1})+'\n').encode();offset=0
  while offset<len(b): offset+=lease_os.write(fd,b[offset:])
  lease_os.fsync(fd)
 finally: lease_os.close(fd)
 lease_os.rename(temp,l['scope']+'/epoch.json');lease_sync(l['scope'])
 retired=l['scope']+'/retired-'+l['owner']['nonce'];lease_os.rename(l['active'],retired);lease_sync(l['scope'])
 lease_os.unlink(retired+'/owner.json');lease_os.rmdir(retired);lease_sync(l['scope'])
`;
// Read-only diagnosis. An incomplete active directory is reported as blocking.
export const nodeTargetLeaseObservation=nodeTargetLease+String.raw`
try{
 if(process.platform==='win32'){const i=winIdentity();console.log(JSON.stringify({schemaVersion:1,principal:{kind:'windows-sid',sid:i.principal},scope:i.scope,epoch:winEpoch(i),active:(()=>{try{leaseFs.lstatSync(leasePath.join(i.scope,'active'));return true}catch(e){if(e.code==='ENOENT')return false;throw e}})(),...winEngine()}))}else{
 const user=leaseOs.userInfo(),home=user.homedir;if(user.uid!==process.getuid()||leaseFs.realpathSync(home)!==home||leaseFs.lstatSync(home).uid!==user.uid)leaseFail();
 const present=p=>{try{leaseFs.lstatSync(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}};const scope=leasePath.join(home,'.castlink-target-operations'),exists=present(scope);if(exists)leasePrivate(scope,true);
 console.log(JSON.stringify({schemaVersion:1,principal:user.uid,scope,epoch:exists?targetOperationEpoch(scope):0,active:exists&&present(leasePath.join(scope,'active')),...leaseEngine()}));}
}catch{process.exitCode=4}
`;
export const pythonTargetLeaseObservation=pythonTargetLease+String.raw`
try:
 home=lease_pwd.getpwuid(lease_os.getuid()).pw_dir
 if lease_os.path.realpath(home)!=home or lease_os.lstat(home).st_uid!=lease_os.getuid(): lease_fail()
 scope=home+'/.castlink-target-operations';exists=lease_os.path.lexists(scope)
 if exists: lease_private(scope,True)
 print(lease_json.dumps(dict(schemaVersion=1,principal=lease_os.getuid(),scope=scope,epoch=target_operation_epoch(scope) if exists else 0,active=exists and lease_os.path.lexists(scope+'/active'),**lease_engine())))
except BaseException: __import__('sys').exit(4)
`;
