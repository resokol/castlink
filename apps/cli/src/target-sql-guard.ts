import {nodeTargetLease,pythonTargetLease} from './target-operation.js';
export type TargetSqlGuard={operation:{schemaVersion:1;kind:'database'|'owner'|'completion';root:string;installationId:string;engine:string;epoch:number;principal:number;scope:string};endpoint:string;fileHashes:Record<string,string>;containerId:string;containerImage:string;project:string;configHash:string};
// These guards are embedded in fixed programs. No arbitrary command crosses stdin.
export const nodeSqlGuard=nodeTargetLease+String.raw`
function sqlGuard(g,id,node){
 if(!g||Object.keys(g).sort().join(',')!=='configHash,containerId,containerImage,endpoint,fileHashes,operation,project'||g.operation.installationId!==id||typeof g.endpoint!=='string'||!/^unix:\/\/\/[^/]/.test(g.endpoint)||Object.keys(g.fileHashes).sort().join(',')!=='compose.yaml,livekit.yaml,postgres.env,web.env'||Object.values(g.fileHashes).some(x=>typeof x!=='string'||!/^[a-f0-9]{64}$/.test(x))||!/^[a-f0-9]{64}$/.test(g.containerId)||!/^sha256:[a-f0-9]{64}$/.test(g.containerImage)||!/^[a-z0-9][a-z0-9_-]{0,127}$/.test(g.project)||!/^[a-f0-9]{64}$/.test(g.configHash))leaseFail();
 const l=acquireTargetOperation(g.operation);sqlGuardCheck(g,l,id,node);return l;
}
function sqlGuardCheck(g,l,id,node){
 const root=g.operation.root;leasePrivate(root,true);if(leaseFs.realpathSync(root)!==root||l.owner.endpoint!==g.endpoint)leaseFail();let web;
 for(const [name,sha] of Object.entries(g.fileHashes)){const p=leasePath.join(root,name),s=leasePrivate(p,false),fd=leaseFs.openSync(p,leaseFs.constants.O_RDONLY|leaseFs.constants.O_NOFOLLOW);let b;try{const h=leaseFs.fstatSync(fd);if(h.dev!==s.dev||h.ino!==s.ino||h.size>1048576)leaseFail();const chunks=[];let size=0;for(;;){const chunk=Buffer.alloc(Math.min(65536,1048577-size)),n=leaseFs.readSync(fd,chunk,0,chunk.length,null);if(n===0)break;size+=n;if(size>1048576)leaseFail();chunks.push(chunk.subarray(0,n))}b=Buffer.concat(chunks,size);const a=leaseFs.lstatSync(p);if(a.dev!==h.dev||a.ino!==h.ino||a.size!==b.length||a.mtimeMs!==h.mtimeMs)leaseFail()}finally{leaseFs.closeSync(fd)}if(leaseCrypto.createHash('sha256').update(b).digest('hex')!==sha)leaseFail();if(name==='web.env')web=b.toString('utf8')}
 if(!web.endsWith('\n'))leaseFail();const env={};for(const line of web.slice(0,-1).split('\n')){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!m||Object.hasOwn(env,m[1]))leaseFail();env[m[1]]=m[2]}if(env.STUDIOLINK_INSTALLATION_ID!==id||env.CASTLINK_NODE_ID!==node)leaseFail();
 const inspected=leaseChild.spawnSync('docker',['inspect',g.containerId],{encoding:'utf8',timeout:10000,maxBuffer:262144,stdio:['ignore','pipe','pipe'],shell:false});if(inspected.error||inspected.status!==0||inspected.stderr)leaseFail();const o=JSON.parse(inspected.stdout);if(!Array.isArray(o)||o.length!==1)leaseFail();const c=o[0],labels=c.Config.Labels;if(c.Id!==g.containerId||c.Image!==g.containerImage||c.State.Running!==true||labels['com.docker.compose.project']!==g.project||labels['com.docker.compose.service']!=='web'||labels['com.docker.compose.config-hash']!==g.configHash||labels['com.docker.compose.project.working_dir']!==root||labels['com.docker.compose.project.config_files']!==leasePath.join(root,'compose.yaml')||!c.Config.Env.includes('STUDIOLINK_INSTALLATION_ID='+id)||!c.Config.Env.includes('CASTLINK_NODE_ID='+node)||typeof env.DATABASE_URL!=='string'||!c.Config.Env.includes('DATABASE_URL='+env.DATABASE_URL))leaseFail();
 if(JSON.stringify(leaseEngine())!==JSON.stringify({engine:l.owner.engine,endpoint:g.endpoint}))leaseFail();
}
`;
export const pythonSqlGuard=pythonTargetLease+String.raw`
import hashlib as guard_hashlib

def sql_guard_capture(args,input=None,cap=262144,timeout=10):
 child=None;selector=lease_selectors.DefaultSelector();buffers={'stdout':bytearray(),'stderr':bytearray()};total=0;sent=0
 try:
  child=lease_subprocess.Popen(args,stdin=lease_subprocess.PIPE if input is not None else lease_subprocess.DEVNULL,stdout=lease_subprocess.PIPE,stderr=lease_subprocess.PIPE,bufsize=0)
  for name in buffers: selector.register(getattr(child,name),lease_selectors.EVENT_READ,name)
  if input is not None:
   lease_os.set_blocking(child.stdin.fileno(),False);selector.register(child.stdin,lease_selectors.EVENT_WRITE,'stdin')
  deadline=lease_time.monotonic()+timeout
  while selector.get_map():
   remaining=deadline-lease_time.monotonic()
   if remaining<=0: lease_fail()
   for key,_ in selector.select(min(remaining,.1)):
    if key.data=='stdin':
     if sent<len(input):
      try: sent+=lease_os.write(key.fileobj.fileno(),input[sent:sent+4096])
      except BlockingIOError: continue
     if sent==len(input): selector.unregister(key.fileobj);key.fileobj.close()
     continue
    data=lease_os.read(key.fileobj.fileno(),min(4096,cap+1-total))
    if not data: selector.unregister(key.fileobj);continue
    total+=len(data)
    if total>cap or key.data=='stderr': lease_fail()
    buffers[key.data].extend(data)
  remaining=deadline-lease_time.monotonic()
  if remaining<=0 or child.wait(timeout=remaining)!=0: lease_fail()
  return bytes(buffers['stdout'])
 finally:
  selector.close()
  if child is not None:
   if child.poll() is None:
    try: child.kill()
    except ProcessLookupError: pass
   child.wait(timeout=5)
   for name in ('stdin','stdout','stderr'):
    stream=getattr(child,name)
    if stream is not None: stream.close()

def sql_guard(g,id,node):
 if not isinstance(g,dict) or set(g)!={'operation','endpoint','fileHashes','containerId','containerImage','project','configHash'} or g['operation']['installationId']!=id or not isinstance(g['endpoint'],str) or lease_re.match('unix:///[^/]',g['endpoint']) is None or set(g['fileHashes'])!={'compose.yaml','livekit.yaml','postgres.env','web.env'} or any(not isinstance(x,str) or lease_re.fullmatch('[a-f0-9]{64}',x) is None for x in g['fileHashes'].values()) or lease_re.fullmatch('[a-f0-9]{64}',g['containerId']) is None or lease_re.fullmatch('sha256:[a-f0-9]{64}',g['containerImage']) is None or lease_re.fullmatch('[a-z0-9][a-z0-9_-]{0,127}',g['project']) is None or lease_re.fullmatch('[a-f0-9]{64}',g['configHash']) is None: lease_fail()
 l=acquire_target_operation(g['operation']);sql_guard_check(g,l,id,node);return l

def sql_guard_check(g,l,id,node):
 root=g['operation']['root'];lease_private(root,True)
 if lease_os.path.realpath(root)!=root or l['owner']['endpoint']!=g['endpoint']: lease_fail()
 web=None
 for name,sha in g['fileHashes'].items():
  p=root+'/'+name;s=lease_private(p,False);fd=lease_os.open(p,lease_os.O_RDONLY|lease_os.O_NOFOLLOW)
  try:
   h=lease_os.fstat(fd)
   if (h.st_dev,h.st_ino)!=(s.st_dev,s.st_ino) or h.st_size>1048576: lease_fail()
   chunks=[];size=0
   while True:
    b=lease_os.read(fd,65536)
    if not b: break
    size+=len(b)
    if size>1048576: lease_fail()
    chunks.append(b)
   b=b''.join(chunks);a=lease_os.lstat(p)
   if (a.st_dev,a.st_ino,a.st_size,a.st_mtime_ns)!=(h.st_dev,h.st_ino,len(b),h.st_mtime_ns) or guard_hashlib.sha256(b).hexdigest()!=sha: lease_fail()
   if name=='web.env': web=b.decode()
  finally: lease_os.close(fd)
 if not web.endswith('\n'): lease_fail()
 env={}
 for line in web[:-1].split('\n'):
  m=lease_re.fullmatch('([A-Z][A-Z0-9_]*)=(.*)',line)
  if m is None or m[1] in env: lease_fail()
  env[m[1]]=m[2]
 if env.get('STUDIOLINK_INSTALLATION_ID')!=id or env.get('CASTLINK_NODE_ID')!=node: lease_fail()
 raw=sql_guard_capture(['docker','inspect',g['containerId']],cap=262144,timeout=10)
 o=lease_json.loads(raw)
 if not isinstance(o,list) or len(o)!=1: lease_fail()
 c=o[0];labels=c['Config']['Labels']
 if c['Id']!=g['containerId'] or c['Image']!=g['containerImage'] or c['State']['Running'] is not True or labels.get('com.docker.compose.project')!=g['project'] or labels.get('com.docker.compose.service')!='web' or labels.get('com.docker.compose.config-hash')!=g['configHash'] or labels.get('com.docker.compose.project.working_dir')!=root or labels.get('com.docker.compose.project.config_files')!=root+'/compose.yaml' or 'STUDIOLINK_INSTALLATION_ID='+id not in c['Config']['Env'] or 'CASTLINK_NODE_ID='+node not in c['Config']['Env'] or not isinstance(env.get('DATABASE_URL'),str) or 'DATABASE_URL='+env['DATABASE_URL'] not in c['Config']['Env']: lease_fail()
 if lease_engine()!={'engine':l['owner']['engine'],'endpoint':g['endpoint']}: lease_fail()
`;
