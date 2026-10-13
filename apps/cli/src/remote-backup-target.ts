// Fixed target program; stdout contains bounded public metadata only.
export const remoteBackupTarget=String.raw`import os,sys,json,stat,hashlib,subprocess,re,resource
CAP=64*1024*1024
NAMES=('postgres.dump','web-data.tar','caddy-data.tar','caddy-config.tar','compose.yaml','web.env','postgres.env','livekit.yaml','receipt.json','owner.json')
fds=[]
runtime_epochs={}
def fail(): raise ValueError()
def pairs(items):
 d={}
 for k,v in items:
  if k in d: fail()
  d[k]=v
 return d
def parse(b): return json.loads(b,object_pairs_hook=pairs)
def sha(b): return hashlib.sha256(b).hexdigest()
def canonical(p):
 if not isinstance(p,str) or len(p)>4096 or not p.startswith('/') or p=='/' or os.path.normpath(p)!=p or '\\' in p or any(ord(c)<32 or ord(c)==127 for c in p): fail()
 return p
def directory(p):
 canonical(p);fd=os.open('/',os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW);fds.append(fd);rootuid=os.fstat(fd).st_uid
 for i,part in enumerate(p[1:].split('/')):
  fd=os.open(part,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW,dir_fd=fd);fds.append(fd);s=os.fstat(fd)
  private=i+1>=len(scope[1:].split('/'))
  if private:
   if s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o700: fail()
  elif s.st_uid not in (rootuid,os.geteuid()) or s.st_mode&0o022 and not(s.st_uid==rootuid and s.st_mode&stat.S_ISVTX): fail()
 return fd
def read(fd,n):
 h=os.open(n,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK,dir_fd=fd);fds.append(h);s=os.fstat(h)
 if not stat.S_ISREG(s.st_mode) or s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o600 or s.st_nlink!=1 or s.st_size>CAP: fail()
 b=b''
 while True:
  part=os.read(h,min(1048576,CAP+1-len(b)))
  if not part: break
  b+=part
  if len(b)>CAP: fail()
 after=os.fstat(h);actual=os.stat(n,dir_fd=fd,follow_symlinks=False)
 if (s.st_dev,s.st_ino,s.st_size,s.st_mtime_ns,s.st_ctime_ns)!=(after.st_dev,after.st_ino,after.st_size,after.st_mtime_ns,after.st_ctime_ns) or (s.st_dev,s.st_ino)!=(actual.st_dev,actual.st_ino): fail()
 return b
def write(fd,n,b):
 h=os.open(n,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600,dir_fd=fd);fds.append(h)
 if stat.S_IMODE(os.fstat(h).st_mode)!=0o600: fail()
 v=memoryview(b)
 while v:
  count=os.write(h,v)
  if count<=0: fail()
  v=v[count:]
 os.fsync(h);os.fsync(fd)
def command(args,input=None):
 # Temporary private files bound binary stdout without decoding or exposing it.
 import tempfile
 with tempfile.TemporaryFile(dir='/proc/self/fd/'+str(out)) as output, tempfile.TemporaryFile(dir='/proc/self/fd/'+str(out)) as errors:
  def bounded(): resource.setrlimit(resource.RLIMIT_FSIZE,(CAP,CAP))
  p=subprocess.Popen(['docker',*args],preexec_fn=bounded,stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,stdout=output,stderr=errors)
  try: p.communicate(input=input,timeout=60)
  except BaseException: p.kill();p.wait();fail()
  if p.returncode!=0 or output.tell()>CAP: fail()
  output.seek(0);return output.read(CAP+1)
def archive(b):
 if len(b)<1024 or len(b)>CAP or len(b)%512: fail()
 pos=0;seen=set();pax=None;ended=False
 def field(h,a,n): return h[a:a+n].split(b'\0')[0].decode('ascii')
 def octal(h,a,n):
  s=field(h,a,n).strip()
  if re.fullmatch('[0-7]+',s) is None: fail()
  return int(s,8)
 while pos+512<=len(b):
  h=b[pos:pos+512];pos+=512
  if not any(h):
   if len(b)-pos<512 or any(b[pos:]) or pax is not None: fail()
   ended=True;break
  if any(c>127 for c in h) or sum(h[:148])+256+sum(h[156:])!=octal(h,148,8) or field(h,257,6)!='ustar': fail()
  n=octal(h,124,12);typ=field(h,156,1);end=pos+((n+511)//512)*512
  if n>CAP or end>len(b) or any(b[pos+n:end]): fail()
  body=b[pos:pos+n];pos=end
  if typ=='x':
   if pax is not None: fail()
   offset=0
   while offset<len(body):
    space=body.find(b' ',offset)
    if space<offset: fail()
    size=int(body[offset:space]);line=body[space+1:offset+size-1].decode();key,sep,value=line.partition('=')
    if size<5 or offset+size>len(body) or body[offset+size-1]!=10 or not sep or key not in ('path','mtime','atime','ctime'): fail()
    if key=='path':
     if pax is not None: fail()
     pax=value
    elif re.fullmatch(r'[0-9]+(\.[0-9]+)?',value) is None: fail()
    offset+=size
   continue
  prefix=field(h,345,155);name=pax if pax is not None else (prefix+'/' if prefix else '')+field(h,0,100);pax=None
  if name.startswith('./'): name=name[2:]
  if name.endswith('/'): name=name[:-1]
  if name=='.': name=''
  if name and (name.startswith(('/','\\')) or '\\' in name or any(ord(c)<32 or ord(c)==127 for c in name) or any(c in ('','.','..') for c in name.split('/')) or len(name.encode())>1024): fail()
  if typ not in ('','0','5') or field(h,157,100) or typ=='5' and n!=0 or typ!='5' and not name or name in seen or len(seen)>=10000: fail()
  seen.add(name)
 if not ended: fail()
def content():
 values=[]
 for n in NAMES:
  b=read(out,n)
  if n.endswith('.tar'): archive(b)
  if n=='postgres.dump' and (len(b)<32 or b[:5]!=b'PGDMP'): fail()
  values.append({'path':n,'bytes':len(b),'sha256':sha(b)})
 return values
# Target-observed epochs span the complete binary capture, including stopped A/B/A.
def runtime_epoch(a):
 state=a['State'];epoch={k:state[k] for k in ('StartedAt','FinishedAt','Restarting','Paused','Dead','Status')};epoch['RestartCount']=a['RestartCount']
 if any(not isinstance(epoch[k],str) or re.fullmatch(r'[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}(\.[0-9]{1,9})?Z',epoch[k]) is None for k in ('StartedAt','FinishedAt')): fail()
 if type(epoch['RestartCount']) is not int or epoch['RestartCount']<0 or epoch['RestartCount']>9007199254740991 or any(epoch[k] is not False for k in ('Restarting','Paused','Dead')): fail()
 if state['Running'] is True:
  if epoch['Status']!='running': fail()
 elif state['Running'] is not False or epoch['Status'] not in ('created','exited'): fail()
 if a['Id'] in runtime_epochs and runtime_epochs[a['Id']]!=epoch: fail()
 runtime_epochs[a['Id']]=epoch
def snapshot():
 if len(r['containers'])!=4 or len(set(c['Id'] for c in r['containers']))!=4 or len(r['volumes'])!=4 or len(r['networks'])!=1: fail()
 if set(c['Labels'].get('com.docker.compose.service') for c in r['containers'])!=set(('postgres','web','livekit','caddy')): fail()
 for c in r['containers']:
  if re.fullmatch('[a-f0-9]{64}',c['Id']) is None: fail()
  if c['Labels']['com.docker.compose.service']=='postgres':
   if c['Running'] is not True or c['Health']!='healthy': fail()
  elif c['Running'] is not False: fail()
 if parse(command(['info','--format','{"ID":{{json .ID}}}']))!={'ID':r['manifest']['engine']}: fail()
 for expected in r['containers']:
  a=parse(command(['container','inspect','--format','{{json .}}',expected['Id']]))
  runtime_epoch(a)
  actual={'Id':a['Id'],'Image':a['Image'],'ConfigImage':a['Config']['Image'],'Labels':a['Config']['Labels'],'Mounts':a['Mounts'],'Running':a['State']['Running'],'Health':a['State'].get('Health',{}).get('Status','')}
  for k,v in actual.items():
   e=expected[k]
   if k=='Mounts': v=sorted(v,key=lambda x:x['Destination']);e=sorted(e,key=lambda x:x['Destination'])
   if v!=e: fail()
 for kind,key,identifier in (('volume','volumes','Name'),('network','networks','Id')):
  for expected in r[key]:
   a=parse(command([kind,'inspect','--format','{{json .}}',expected[identifier]]))
   if any(a.get(k)!=v for k,v in expected.items()): fail()
 for service,e in r['manifest']['contract']['images'].items():
  a=parse(command(['image','inspect','--format','{{json .}}',r['references'][service]]))
  v={'Id':a['Id'],'Os':a['Os'],'Architecture':a['Architecture'],'RepoDigests':a['RepoDigests'],'Volumes':a['Config']['Volumes']}
  if v!=e: fail()
def source():
 fd=directory(r['root']);values={n:read(fd,n) for n in NAMES[4:]}
 if any(sha(values[n])!=r['fingerprints'][n] for n in ('compose.yaml','web.env','postgres.env','livekit.yaml')): fail()
 if sha(values['receipt.json'])!=r['receiptHash'] or sha(values['owner.json'])!=r['ownerHash']: fail()
 return values
try:
 raw=sys.stdin.buffer.read(131073)
 if len(raw)>131072: fail()
 r=parse(raw);scope=canonical(r['scopeRoot']);p=canonical(r['directory'])
 if not p.startswith(scope+'/') or set(r)!= {'schemaVersion','action','scopeRoot','directory','root','manifest','containers','volumes','networks','references','fingerprints','receiptHash','ownerHash'} or r['schemaVersion']!=1 or r['action'] not in ('inspect','capture','finalize','verify'): fail()
 if r['action']=='capture':
  if p==r['root'] or p.startswith(r['root']+'/') or r['root'].startswith(p+'/'): fail()
  parent=directory(os.path.dirname(p));os.mkdir(os.path.basename(p),0o700,dir_fd=parent);os.fsync(parent)
 out=directory(p)
 if r['action']=='inspect':
  fd=directory(r['root']);receipt=read(fd,'receipt.json');owner=read(fd,'owner.json')
  print(json.dumps({'schemaVersion':1,'receiptHash':sha(receipt),'ownerHash':sha(owner)}));sys.exit(0)
 if r['action']=='capture':
  write(out,'manifest.json',b'') # exclusive reservation, never a verified partial
  values=source();snapshot()
  ids={c['Labels']['com.docker.compose.service']:c['Id'] for c in r['containers']}
  sql="SELECT current_database() || '|' || current_user || '|' || (SELECT string_agg(installation_id::text, ',' ORDER BY installation_id) FROM public.castlink_installations) || '|' || (SELECT installation_id::text FROM public.castlink_setup_bootstrap WHERE singleton=true);"
  identity=command(['exec','-i',ids['postgres'],'psql','-X','-A','-t','-v','ON_ERROR_STOP=1','-U','castlink','-d','castlink','-f','-'],(sql+'\n').encode())
  iid=r['manifest']['installationId']
  if identity.decode().strip()!='castlink|castlink|'+iid+'|'+iid: fail()
  dump=command(['exec',ids['postgres'],'pg_dump','--format=custom','--no-owner','--no-acl','--username=castlink','--dbname=castlink'])
  listing=command(['exec','-i',ids['postgres'],'pg_restore','--list'],dump)
  if b'castlink_installations' not in listing or b'castlink_setup_bootstrap' not in listing: fail()
  command(['exec','-i',ids['postgres'],'pg_restore','--file=/dev/null'],dump)
  write(out,'postgres.dump',dump)
  for n,service,dest in (('web-data.tar','web','/data/.'),('caddy-data.tar','caddy','/data/.'),('caddy-config.tar','caddy','/config/.')):
   b=command(['cp',ids[service]+':'+dest,'-']);archive(b);write(out,n,b)
  for n,b in values.items(): write(out,n,b)
  if source()!=values: fail()
  snapshot();files=content()
 elif r['action']=='finalize':
  if read(out,'manifest.json')!=b'' or set(os.listdir(out))!=set(NAMES)|{'manifest.json'}: fail()
  source();snapshot();files=content()
  if files!=r['manifest']['files']: fail()
  m=r['manifest'];h=os.open('manifest.json',os.O_WRONLY|os.O_NOFOLLOW,dir_fd=out);fds.append(h);s=os.fstat(h)
  if s.st_nlink!=1 or s.st_size!=0 or s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o600: fail()
  v=memoryview((json.dumps(m,sort_keys=True)+'\n').encode())
  while v:
   n=os.write(h,v)
   if n<=0: fail()
   v=v[n:]
  os.fsync(h);os.fsync(out)
 else:
  if set(os.listdir(out))!=set(NAMES)|{'manifest.json'}: fail()
  m=parse(read(out,'manifest.json'));files=content()
  if m!=r['manifest'] or files!=m['files'] or m['restoreVerified'] is not False: fail()
  if set(m)!=set(('schemaVersion','kind','installationId','release','engine','contract','resources','files','restoreVerified')) or m['schemaVersion']!=1 or m['kind']!='castlink-remote-cold-backup-v1' or re.fullmatch('[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}',m['installationId']) is None or re.fullmatch('[A-Za-z0-9:._-]{1,128}',m['engine']) is None: fail()
  c=m['contract'];resources=m['resources'];receipt=parse(read(out,'receipt.json'));owner=parse(read(out,'owner.json'))
  if c['installationId']!=m['installationId'] or c['project']!='castlink-'+m['installationId'].replace('-','') or c['composeSHA256']!=sha(read(out,'compose.yaml')) or owner!=receipt['owner'] or owner['installationId']!=m['installationId']: fail()
  if receipt['hashes']!={n:sha(read(out,n)) for n in ('compose.yaml','web.env','postgres.env','livekit.yaml')}: fail()
  if len(resources['containers'])!=4 or len(resources['volumes'])!=4 or len(resources['networks'])!=1 or len(set(v['id'] for v in resources['containers']))!=4 or set(v['service'] for v in resources['containers'])!=set(('postgres','web','livekit','caddy')) or any(re.fullmatch('[a-f0-9]{64}',v['id']) is None for v in resources['containers']): fail()
  for service in ('postgres','web','livekit','caddy'):
   if re.fullmatch('sha256:[a-f0-9]{64}',c['images'][service]['Id']) is None or re.fullmatch('[a-f0-9]{64}',c['hashes'][service]) is None: fail()
 # Retained canonical directory identity must still match.
 check=directory(p)
 if (os.fstat(check).st_dev,os.fstat(check).st_ino)!=(os.fstat(out).st_dev,os.fstat(out).st_ino): fail()
 print(json.dumps({'schemaVersion':1,'files':files}))
except Exception:
 print('{"schemaVersion":1,"error":"diagnosis-required"}');sys.exit(4)
finally:
 for fd in reversed(fds):
  try: os.close(fd)
  except OSError: pass
`;
