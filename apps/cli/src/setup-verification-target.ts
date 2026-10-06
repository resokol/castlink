import {nodeSqlGuard,pythonSqlGuard} from './target-sql-guard.js';
// Fixed selected-target programs; all secret/archive/HTTP bytes stay in target.
export const nodeObserver=String.raw`const fs=require('node:fs'),path=require('node:path'),https=require('node:https'),{createHash,X509Certificate}=require('node:crypto'),{spawnSync}=require('node:child_process'),{isDeepStrictEqual:eq}=require('node:util');
function fail(){throw Error()}
const win=process.platform==='win32',acl="$ErrorActionPreference='Stop'\n$item=Get-Item -Force -LiteralPath $env:CASTLINK_PRIVATE_PATH\n$owner=[System.Security.Principal.WindowsIdentity]::GetCurrent().User\n$a=$item.GetAccessControl()\nif(!$a.AreAccessRulesProtected -or $a.GetOwner([System.Security.Principal.SecurityIdentifier]).Value -ne $owner.Value){exit 1}\n$seen=@{}\nforeach($rule in $a.GetAccessRules($true,$true,[System.Security.Principal.SecurityIdentifier])){\n if($rule.IsInherited -or $rule.AccessControlType -ne 'Allow' -or $rule.FileSystemRights -ne 'FullControl'){exit 1}\n $sid=$rule.IdentityReference.Value\n if($sid -ne $owner.Value -and $sid -ne 'S-1-5-18'){exit 1}\n $seen[$sid]=1\n}\nif(!$seen[$owner.Value] -or !$seen['S-1-5-18']){exit 1}\n";
function privacy(p,directory){const s=fs.lstatSync(p);if(win){const r=spawnSync('powershell.exe',['-NoProfile','-NonInteractive','-Command',acl],{env:{...process.env,CASTLINK_PRIVATE_PATH:p},timeout:10000,windowsHide:true,shell:false});if(r.error||r.status!==0||r.stdout.length||r.stderr.length)fail()}else if(s.uid!==process.getuid()||(s.mode&511)!==(directory?448:384))fail();return s}
const hash=b=>createHash('sha256').update(b).digest('hex'),keys=(o,k)=>o&&typeof o==='object'&&!Array.isArray(o)&&Object.keys(o).sort().join(',')===k.split(',').sort().join(',');
function parse(raw){const o=JSON.parse(raw);if(raw!==JSON.stringify(o))fail();return o}
function run(args,input,cap=262144){const r=spawnSync('docker',args,{input,maxBuffer:cap,timeout:10000,windowsHide:true,shell:false});if(r.error||r.status!==0||r.stderr.length)fail();return r.stdout}
function field(b,a,n){return b.subarray(a,a+n).toString('ascii').replace(/\x00.*$/s,'')}
function octal(b,a,n){const s=field(b,a,n).trim();if(!/^[0-7]+$/.test(s))fail();return parseInt(s,8)}
function archive(b,name,mode,cap){let offset=0,file,pax=false,ended=false;if(b.length>262144||b.length%512)fail();while(offset+512<=b.length){const h=b.subarray(offset,offset+512);offset+=512;if(h.every(x=>x===0)){if(b.length-offset<512||!b.subarray(offset).every(x=>x===0))fail();ended=true;break}
let sum=0;for(let i=0;i<512;i++)sum+=(i>=148&&i<156)?32:h[i];if(h.some(x=>x>127)||octal(h,148,8)!==sum||field(h,257,6)!=='ustar'||field(h,345,155)!=='')fail();const size=octal(h,124,12),type=field(h,156,1);if(size>cap||offset+Math.ceil(size/512)*512>b.length)fail();const body=b.subarray(offset,offset+size);if(!b.subarray(offset+size,offset+Math.ceil(size/512)*512).every(x=>x===0))fail();offset+=Math.ceil(size/512)*512;
if(type==='x'){if(pax||file)fail();pax=true;let pos=0;while(pos<body.length){const space=body.indexOf(32,pos);if(space<0)fail();const n=Number(body.subarray(pos,space).toString());if(!Number.isInteger(n)||n<5||pos+n>body.length||body[pos+n-1]!==10)fail();const record=body.subarray(space+1,pos+n-1).toString('utf8'),eq=record.indexOf('='),key=record.slice(0,eq),value=record.slice(eq+1);if(eq<1||!['path','mtime','atime','ctime'].includes(key))fail();if(key==='path'?value!==name:!/^\d+(\.\d+)?$/.test(value))fail();pos+=n}continue}
if(!['0',''].includes(type)||field(h,0,100)!==name||file||!size||!(Array.isArray(mode)?mode:[mode]).includes(octal(h,100,8)))fail();file=body;
}if(!ended||!file)fail();return file}
function absolute(p){if(typeof p!=='string'||!path.isAbsolute(p)||path.resolve(p)!==p||p===path.parse(p).root||/[\x00-\x1f\x7f]/.test(p))fail()}
function directory(p,privateMode){absolute(p);let at=p;while(at!==path.dirname(at)){const s=fs.lstatSync(at);if(s.isSymbolicLink()||!s.isDirectory())fail();if(at===p&&privateMode)privacy(p,true);at=path.dirname(at)}}
function readBounded(fd,cap=1048576){const chunks=[];let size=0;for(;;){const b=Buffer.alloc(Math.min(65536,cap+1-size)),n=fs.readSync(fd,b,0,b.length,null);if(n===0)break;size+=n;if(size>cap)fail();chunks.push(b.subarray(0,n))}return Buffer.concat(chunks,size)}
function read(p,association){absolute(p);directory(path.dirname(p),true);const s=privacy(p,false);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>1048576)fail();const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));try{const held=fs.fstatSync(fd);if(s.ino!==held.ino||s.dev!==held.dev)fail();const b=readBounded(fd),after=fs.lstatSync(p);if(after.ino!==s.ino||after.dev!==s.dev||after.mtimeMs!==s.mtimeMs||after.mode!==s.mode||after.size!==b.length||!eq(association,{dev:s.dev,ino:s.ino,mode:win?384:s.mode&511,sha256:hash(b)}))fail();return b}finally{fs.closeSync(fd)}}
function association(a){if(!keys(a,'dev,ino,mode,sha256')||!Number.isSafeInteger(a.dev)||a.dev<0||!Number.isSafeInteger(a.ino)||a.ino<0||a.mode!==384||typeof a.sha256!=='string'||!/^[a-f0-9]{64}$/.test(a.sha256))fail()}
function validate(r){if(!keys(r,'schemaVersion,installationId,nodeId,origin,serverName,release,root,files,ownerFile,ownerAssociation,webContainerId,caddyContainerId,webImageId,caddyImageId,complete,attempt')||r.schemaVersion!==1||typeof r.installationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId)||r.nodeId!=='srv-'+r.installationId.replaceAll('-','')||typeof r.serverName!=='string'||!r.serverName||r.serverName.length>120||r.serverName.trim()!==r.serverName||/[\x00-\x1f\x7f]/.test(r.serverName)||typeof r.release!=='string'||!/^[0-9A-Za-z][0-9A-Za-z._+-]{0,127}$/.test(r.release)||typeof r.complete!=='boolean')fail();
const u=new URL(r.origin);if(u.protocol!=='https:'||u.origin!==r.origin||u.port||!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))fail();const n=u.hostname.split('.').map(Number);if(n.some(x=>x>255)||!(n[0]===127&&n[1]===0&&n[2]===0&&n[3]===1||n[0]===10||n[0]===192&&n[1]===168||n[0]===172&&n[1]>=16&&n[1]<=31))fail();
for(const k of ['webContainerId','caddyContainerId'])if(typeof r[k]!=='string'||!/^[a-f0-9]{64}$/.test(r[k]))fail();for(const k of ['webImageId','caddyImageId'])if(typeof r[k]!=='string'||!/^sha256:[a-f0-9]{64}$/.test(r[k]))fail();if(r.webContainerId===r.caddyContainerId)fail();absolute(r.root);absolute(r.ownerFile);if(!keys(r.files,'compose.yaml,web.env,postgres.env,livekit.yaml'))fail();for(const a of Object.values(r.files))association(a);association(r.ownerAssociation);if(r.complete){if(!keys(r.attempt,'path,dev,ino,mode,sha256'))fail();absolute(r.attempt.path);const {path:p,...a}=r.attempt;association(a)}else if(r.attempt!==null)fail();return r}
function identity(r){for(const service of ['web','caddy']){const id=r[service+'ContainerId'],o=parse(run(['inspect','--format','{"Id":{{json .Id}},"Image":{{json .Image}},"Running":{{json .State.Running}}}',id],undefined,2048).toString().trim());if(!eq(o,{Id:id,Image:r[service+'ImageId'],Running:true}))fail()}}
function local(r){directory(r.root,true);let web;for(const [name,a] of Object.entries(r.files)){const b=read(path.join(r.root,name),a);if(name==='web.env')web=b.toString('utf8')}const owner=read(r.ownerFile,r.ownerAssociation);if(r.complete){const {path:p,...a}=r.attempt,attemptBytes=read(p,a).toString(),attempt=JSON.parse(attemptBytes);if(attemptBytes!==JSON.stringify(attempt,null,2)+'\n')fail();if(!eq(attempt,{schemaVersion:1,installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,release:r.release,webContainerId:r.webContainerId,caddyContainerId:r.caddyContainerId,files:r.files,ownerAssociation:r.ownerAssociation}))fail()}
const lines=web.split('\n');if(lines.pop()!=='')fail();const env={};for(const line of lines){const m=/^([A-Z][A-Z0-9_]*)=(.*)$/.exec(line);if(!m||Object.hasOwn(env,m[1]))fail();env[m[1]]=m[2]}if(!/^[a-f0-9]{64}$/.test(env.CASTLINK_SETUP_TOKEN||''))fail();return {token:env.CASTLINK_SETUP_TOKEN,owner}}
function ca(r){const b=archive(run(['cp',r.caddyContainerId+':/data/caddy/pki/authorities/local/root.crt','-']),'root.crt',[384,420],8192),s=b.toString('ascii');if(!/^-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\r?\n?$/.test(s))fail();const x=new X509Certificate(b);if(!x.ca||Date.parse(x.validFrom)>Date.now()||Date.parse(x.validTo)<=Date.now())fail();return b}
function server(r){const request={schemaVersion:1,installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName},o=parse(run(['exec','-i',r.webContainerId,'node','/app/scripts/setup-observe-v1.mjs'],JSON.stringify(request),2048).toString().trim());if(!['invite','session'].includes(o.ownerAccess)||!['pending','complete'].includes(o.setup)||!eq(o,{...request,contract:'castlink-setup-observe-v1',sql:'verified',ownerAccess:o.ownerAccess,setup:o.setup}))fail();return o}
function owner(r,b){const source=archive(run(['cp',r.webContainerId+':/data/.castlink-owner/'+r.installationId+'/owner-invite.txt','-']),'owner-invite.txt',384,2048);if(!b.equals(source)||!new RegExp('^'+r.origin.replace(/[.*+?^$\{\}()|[\]\\]/g,'\\$&')+'/super-admin#access=csa2\\.[A-Za-z0-9_-]{43}\\n$').test(b.toString()))fail()}
function http(r,cert,method,endpoint,token){return new Promise((resolve,reject)=>{const body=method==='POST'?JSON.stringify({mode:'public',serverName:r.serverName}):undefined;const headers=method==='POST'?{Origin:r.origin,'x-castlink-setup-token':token,'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)}:{};
const q=https.request(r.origin+endpoint,{method,headers,ca:cert,rejectUnauthorized:true,agent:false,timeout:5000},s=>{let chunks=[],size=0;s.on('data',b=>{size+=b.length;if(size>4096){q.destroy();reject(Error())}else chunks.push(b)});s.on('error',reject);s.on('end',()=>{try{if(s.statusCode!==200)fail();resolve(parse(Buffer.concat(chunks).toString('utf8')))}catch(e){reject(e)}})});q.on('timeout',()=>q.destroy(Error()));q.on('error',reject);q.end(body)})}
async function observe(r){identity(r);const initial=local(r),cert=ca(r);owner(r,initial.owner);const v=await http(r,cert,'GET','/api/version');if(!keys(v,'version,buildId,productVersion')||v.version!==r.release||v.buildId!==r.release||typeof v.productVersion!=='string'||!/^(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)\.(?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/.test(v.productVersion))fail();let s=server(r),get=await http(r,cert,'GET','/api/setup');if(!eq(get,{needsSetup:s.setup==='pending',deploymentModel:'self-hosted'}))fail();
if(r.complete&&s.setup==='pending'){identity(r);local(r);if(!ca(r).equals(cert))fail();try{const post=await http(r,cert,'POST','/api/setup',initial.token);if(!eq(post,{ok:true}))fail()}catch{}s=server(r);get=await http(r,cert,'GET','/api/setup');if(s.setup!=='complete'||!eq(get,{needsSetup:false,deploymentModel:'self-hosted'}))fail()}
const final=server(r);if(!eq(final,s))fail();if(!eq(await http(r,cert,'GET','/api/version'),v))fail();if(!eq(await http(r,cert,'GET','/api/setup'),{needsSetup:final.setup==='pending',deploymentModel:'self-hosted'}))fail();identity(r);local(r);owner(r,initial.owner);if(!ca(r).equals(cert))fail();return{schemaVersion:1,contract:'castlink-setup-target-v1',installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,release:r.release,productVersion:v.productVersion,tls:'verified',version:'verified',sql:'verified',ownerAccess:final.ownerAccess,setup:final.setup}}
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>16384)process.exit(3)});process.stdin.on('end',async()=>{try{const r=validate(parse(input));if(r.complete)fail();console.log(JSON.stringify(await observe(r)))}catch{console.log(JSON.stringify({schemaVersion:1,contract:'castlink-setup-target-v1',ok:false,diagnosis:'setup-observation-refused'}));process.exitCode=3}});
`;
export const pythonObserver=String.raw`import os,sys,json,stat,re,subprocess,tarfile,io,hashlib,signal,ssl,time
from http.client import HTTPSConnection
signal.signal(signal.SIGALRM,lambda *_:sys.exit(3));signal.alarm(90)
def fail(): raise ValueError()
def pairs(items):
 d={}
 for k,v in items:
  if k in d: fail()
  d[k]=v
 return d
def parse(raw): return json.loads(raw,object_pairs_hook=pairs)
def run(args,input=None,cap=262144):
 child=subprocess.Popen(['docker']+args,stdin=subprocess.PIPE if input is not None else subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 try:
  if input is not None: child.stdin.write(input);child.stdin.close()
  raw=child.stdout.read(cap+1)
  if len(raw)>cap or child.wait(timeout=10)!=0 or child.stderr.read(1): fail()
  return raw
 finally:
  if child.poll() is None: child.kill()
  child.wait()
def archive(raw,name,mode,cap):
 if len(raw)>262144 or len(raw)<1536 or len(raw)%512 or any(raw[-1024:]): fail()
 with tarfile.open(fileobj=io.BytesIO(raw),mode='r:') as t:
  entries=t.getmembers()
  if len(entries)!=1: fail()
  e=entries[0]
  if not e.isfile() or e.name!=name or e.mode not in (mode if isinstance(mode,tuple) else (mode,)) or not 0<e.size<=cap or e.linkname: fail()
  for k,v in e.pax_headers.items():
   if k not in ('path','mtime','atime','ctime') or (v!=name if k=='path' else re.fullmatch('[0-9]+([.][0-9]+)?',v) is None): fail()
  end=e.offset_data+((e.size+511)//512)*512
  if len(raw)-end<1024 or any(raw[end:]) or any(raw[e.offset_data+e.size:end]): fail()
  b=t.extractfile(e).read(cap+1)
  if len(b)!=e.size: fail()
  return b
def absolute(p):
 if not isinstance(p,str) or not p.startswith('/') or p=='/' or os.path.normpath(p)!=p or any(ord(c)<32 or ord(c)==127 for c in p) or '\\' in p: fail()
def directory(p,private_mode):
 absolute(p);at='/'
 for part in p.split('/')[1:]:
  at=os.path.join(at,part);s=os.lstat(at)
  if not stat.S_ISDIR(s.st_mode) or stat.S_ISLNK(s.st_mode): fail()
 if s.st_uid!=os.geteuid() or private_mode and stat.S_IMODE(s.st_mode)!=0o700: fail()
def association(a):
 if not isinstance(a,dict) or set(a)!={'dev','ino','mode','sha256'} or type(a['dev']) is not int or not 0<=a['dev']<=9007199254740991 or type(a['ino']) is not int or not 0<=a['ino']<=9007199254740991 or a['mode']!=0o600 or not isinstance(a['sha256'],str) or re.fullmatch('[a-f0-9]{64}',a['sha256']) is None: fail()
def read(p,a):
 absolute(p);directory(os.path.dirname(p),True);s=os.lstat(p)
 if not stat.S_ISREG(s.st_mode) or stat.S_ISLNK(s.st_mode) or s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o600 or s.st_nlink!=1 or s.st_size>1048576: fail()
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  held=os.fstat(fd)
  if (s.st_dev,s.st_ino)!=(held.st_dev,held.st_ino): fail()
  chunks=[];size=0
  while True:
   b=os.read(fd,65536)
   if not b: break
   size+=len(b)
   if size>1048576: fail()
   chunks.append(b)
  b=b''.join(chunks);after=os.lstat(p)
  if (after.st_dev,after.st_ino,after.st_mode,after.st_mtime_ns,after.st_size)!=(s.st_dev,s.st_ino,s.st_mode,s.st_mtime_ns,len(b)) or a!={'dev':s.st_dev,'ino':s.st_ino,'mode':stat.S_IMODE(s.st_mode),'sha256':hashlib.sha256(b).hexdigest()}: fail()
  return b
 finally: os.close(fd)
def validate(r):
 names={'schemaVersion','installationId','nodeId','origin','serverName','release','root','files','ownerFile','ownerAssociation','webContainerId','caddyContainerId','webImageId','caddyImageId','complete','attempt'}
 if not isinstance(r,dict) or set(r)!=names or type(r['schemaVersion']) is not int or r['schemaVersion']!=1 or not isinstance(r['installationId'],str) or re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',r['installationId']) is None or r['nodeId']!='srv-'+r['installationId'].replace('-','') or not isinstance(r['serverName'],str) or not 0<len(r['serverName'])<=120 or r['serverName'].strip()!=r['serverName'] or any(ord(c)<32 or ord(c)==127 for c in r['serverName']) or not isinstance(r['release'],str) or re.fullmatch('[0-9A-Za-z][0-9A-Za-z._+-]{0,127}',r['release']) is None or type(r['complete']) is not bool: fail()
 from urllib.parse import urlsplit
 u=urlsplit(r['origin'])
 if u.scheme!='https' or u.username or u.password or u.path or u.query or u.fragment or u.port or r['origin']!='https://'+u.netloc: fail()
 import ipaddress
 ip=ipaddress.IPv4Address(u.hostname)
 if str(ip)!=u.hostname or not any(ip in ipaddress.IPv4Network(n) for n in ('127.0.0.1/32','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')): fail()
 for k in ('webContainerId','caddyContainerId'):
  if not isinstance(r[k],str) or re.fullmatch('[a-f0-9]{64}',r[k]) is None: fail()
 for k in ('webImageId','caddyImageId'):
  if not isinstance(r[k],str) or re.fullmatch('sha256:[a-f0-9]{64}',r[k]) is None: fail()
 if r['webContainerId']==r['caddyContainerId']: fail()
 absolute(r['root']);absolute(r['ownerFile'])
 if not isinstance(r['files'],dict) or set(r['files'])!={'compose.yaml','web.env','postgres.env','livekit.yaml'}: fail()
 for a in r['files'].values(): association(a)
 association(r['ownerAssociation'])
 if r['complete']:
  if not isinstance(r['attempt'],dict) or set(r['attempt'])!={'path','dev','ino','mode','sha256'}: fail()
  absolute(r['attempt']['path']);association({k:v for k,v in r['attempt'].items() if k!='path'})
 elif r['attempt'] is not None: fail()
 return r
def identity(r):
 for service in ('web','caddy'):
  id=r[service+'ContainerId'];o=parse(run(['inspect','--format','{"Id":{{json .Id}},"Image":{{json .Image}},"Running":{{json .State.Running}}}',id],cap=2048))
  if o!={'Id':id,'Image':r[service+'ImageId'],'Running':True}: fail()
def local(r):
 directory(r['root'],True);web=None
 for name,a in r['files'].items():
  b=read(os.path.join(r['root'],name),a)
  if name=='web.env': web=b.decode()
 owner=read(r['ownerFile'],r['ownerAssociation'])
 if r['complete']:
  a=r['attempt'];o=parse(read(a['path'],{k:v for k,v in a.items() if k!='path'}));expected={k:r[k] for k in ('schemaVersion','installationId','nodeId','origin','serverName','release','webContainerId','caddyContainerId','files','ownerAssociation')}
  if o!=expected: fail()
 if not web.endswith('\n'): fail()
 env={}
 for line in web[:-1].split('\n'):
  m=re.fullmatch('([A-Z][A-Z0-9_]*)=(.*)',line)
  if m is None or m[1] in env: fail()
  env[m[1]]=m[2]
 if re.fullmatch('[a-f0-9]{64}',env.get('CASTLINK_SETUP_TOKEN','')) is None: fail()
 return env['CASTLINK_SETUP_TOKEN'],owner
def ca(r):
 b=archive(run(['cp',r['caddyContainerId']+':/data/caddy/pki/authorities/local/root.crt','-']),'root.crt',(0o600,0o644),8192)
 if re.fullmatch(b'-----BEGIN CERTIFICATE-----\r?\n[A-Za-z0-9+/=\r\n]+-----END CERTIFICATE-----\r?\n?',b) is None: fail()
 return b
def server(r):
 req={k:r[k] for k in ('schemaVersion','installationId','nodeId','origin','serverName')};o=parse(run(['exec','-i',r['webContainerId'],'node','/app/scripts/setup-observe-v1.mjs'],json.dumps(req,separators=(',',':')).encode(),2048))
 if o.get('ownerAccess') not in ('invite','session') or o.get('setup') not in ('pending','complete') or o!={**req,'contract':'castlink-setup-observe-v1','sql':'verified','ownerAccess':o['ownerAccess'],'setup':o['setup']}: fail()
 return o
def owner(r,b):
 source=archive(run(['cp',r['webContainerId']+':/data/.castlink-owner/'+r['installationId']+'/owner-invite.txt','-']),'owner-invite.txt',0o600,2048)
 if b!=source or re.fullmatch(re.escape(r['origin']+'/super-admin#access=csa2.')+'[A-Za-z0-9_-]{43}\n',b.decode()) is None: fail()
def http(r,cert,method,endpoint,token=None):
 context=ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT);context.load_verify_locations(cadata=cert.decode('ascii'));context.check_hostname=True;context.verify_mode=ssl.CERT_REQUIRED
 if context.cert_store_stats()['x509_ca']!=1: fail()
 from urllib.parse import urlsplit
 conn=HTTPSConnection(urlsplit(r['origin']).hostname,443,context=context,timeout=5)
 body=json.dumps({'mode':'public','serverName':r['serverName']},ensure_ascii=False,separators=(',',':')).encode() if method=='POST' else None
 headers={'Origin':r['origin'],'x-castlink-setup-token':token,'Content-Type':'application/json'} if method=='POST' else {}
 try:
  conn.request(method,endpoint,body=body,headers=headers);s=conn.getresponse();raw=s.read(4097)
  if s.status!=200 or len(raw)>4096: fail()
  return parse(raw)
 finally: conn.close()
def observe(r):
 identity(r);token,b=local(r);cert=ca(r);owner(r,b);v=http(r,cert,'GET','/api/version')
 if not isinstance(v,dict) or set(v)!={'version','buildId','productVersion'} or v['version']!=r['release'] or v['buildId']!=r['release'] or not isinstance(v['productVersion'],str) or re.fullmatch('(?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)[.](?:0|[1-9][0-9]*)(?:-(?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*)(?:[.](?:0|[1-9][0-9]*|[0-9]*[A-Za-z-][0-9A-Za-z-]*))*)?(?:[+][0-9A-Za-z-]+(?:[.][0-9A-Za-z-]+)*)?',v['productVersion']) is None: fail()
 s=server(r);get=http(r,cert,'GET','/api/setup')
 if get!={'needsSetup':s['setup']=='pending','deploymentModel':'self-hosted'}: fail()
 if r['complete'] and s['setup']=='pending':
  identity(r);local(r)
  if ca(r)!=cert: fail()
  try:
   post=http(r,cert,'POST','/api/setup',token)
   if post!={'ok':True}: fail()
  except Exception: pass
  s=server(r);get=http(r,cert,'GET','/api/setup')
  if s['setup']!='complete' or get!={'needsSetup':False,'deploymentModel':'self-hosted'}: fail()
 final=server(r)
 if final!=s or http(r,cert,'GET','/api/version')!=v or http(r,cert,'GET','/api/setup')!={'needsSetup':final['setup']=='pending','deploymentModel':'self-hosted'}: fail()
 identity(r);local(r);owner(r,b)
 if ca(r)!=cert: fail()
 return {**{k:r[k] for k in ('schemaVersion','installationId','nodeId','origin','serverName','release')},'contract':'castlink-setup-target-v1','productVersion':v['productVersion'],'tls':'verified','version':'verified','sql':'verified','ownerAccess':final['ownerAccess'],'setup':final['setup']}
try:
 raw=sys.stdin.buffer.read(16385)
 if len(raw)>16384: fail()
 r=validate(parse(raw))
 if r['complete']: fail()
 if json.dumps(r,ensure_ascii=False,separators=(',',':')).encode()!=raw: fail()
 print(json.dumps(observe(r),separators=(',',':')))
except BaseException:
 print(json.dumps({'schemaVersion':1,'contract':'castlink-setup-target-v1','ok':False,'diagnosis':'setup-observation-refused'}));sys.exit(3)
`;

// Reuse exactly the observer's protected read/ACL/parser primitives. The fixed
// capture entrypoint calls only filesystem operations; no Docker/SQL/HTTP calls.
export const nodeAssociationCapture=nodeObserver.slice(0,nodeObserver.indexOf("let input='';process.stdin"))+String.raw`
function captureRequest(r){if(!keys(r,'schemaVersion,installationId,nodeId,origin,root,fileHashes,ownerFile,ownerSHA')||r.schemaVersion!==1||typeof r.installationId!=='string'||!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(r.installationId)||r.nodeId!=='srv-'+r.installationId.replaceAll('-',''))fail();const u=new URL(r.origin);if(u.protocol!=='https:'||u.origin!==r.origin||u.port||!/^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))fail();const n=u.hostname.split('.').map(Number);if(n.some(x=>x>255)||!(u.hostname==='127.0.0.1'||n[0]===10||n[0]===192&&n[1]===168||n[0]===172&&n[1]>=16&&n[1]<=31))fail();absolute(r.root);absolute(r.ownerFile);if(path.basename(r.ownerFile)!=='owner-invite.txt'||!keys(r.fileHashes,'compose.yaml,web.env,postgres.env,livekit.yaml')||Object.values(r.fileHashes).some(v=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))||r.ownerSHA!==null&&(typeof r.ownerSHA!=='string'||!/^[a-f0-9]{64}$/.test(r.ownerSHA)))fail();return r}
function fingerprint(p){directory(path.dirname(p),true);const s=privacy(p,false);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||s.size>1048576)fail();const fd=fs.openSync(p,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0)|(fs.constants.O_NONBLOCK||0));let b;try{const held=fs.fstatSync(fd);if(held.dev!==s.dev||held.ino!==s.ino)fail();b=readBounded(fd);const after=privacy(p,false);if(after.dev!==held.dev||after.ino!==held.ino||after.mtimeMs!==held.mtimeMs||after.mode!==held.mode||after.nlink!==1||after.size!==b.length)fail()}finally{fs.closeSync(fd)}const a={dev:s.dev,ino:s.ino,mode:win?384:s.mode&511,sha256:hash(b)};if(!read(p,a).equals(b))fail();return {a,b}}
function capture(r){directory(r.root,true);const root=fs.lstatSync(r.root),parent=fs.lstatSync(path.dirname(r.ownerFile)),files={};for(const [name,expected] of Object.entries(r.fileHashes)){const {a}=fingerprint(path.join(r.root,name));if(a.sha256!==expected)fail();files[name]=a}const {a:ownerAssociation,b}=fingerprint(r.ownerFile);if(r.ownerSHA!==null&&ownerAssociation.sha256!==r.ownerSHA)fail();const url=new URL(b.toString('utf8').trim()),token=new URLSearchParams(url.hash.slice(1)).get('access'),expected=new URL('/super-admin',r.origin);expected.hash=new URLSearchParams({access:token}).toString();if(typeof token!=='string'||!/^csa2\.[A-Za-z0-9_-]{43}$/.test(token)||b.toString('utf8')!==expected.href+'\n')fail();for(const [name,a] of Object.entries(files))read(path.join(r.root,name),a);read(r.ownerFile,ownerAssociation);directory(r.root,true);directory(path.dirname(r.ownerFile),true);const after=fs.lstatSync(r.root),afterParent=fs.lstatSync(path.dirname(r.ownerFile));if(after.dev!==root.dev||after.ino!==root.ino||afterParent.dev!==parent.dev||afterParent.ino!==parent.ino)fail();return{schemaVersion:1,contract:'castlink-setup-associations-v1',installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,root:r.root,ownerFile:r.ownerFile,files,ownerAssociation}}
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>8192)process.exit(3)});process.stdin.on('end',()=>{try{console.log(JSON.stringify(capture(captureRequest(parse(input)))))}catch{console.log(JSON.stringify({schemaVersion:1,contract:'castlink-setup-associations-v1',ok:false,diagnosis:'setup-associations-refused'}));process.exitCode=3}});
`;
export const pythonAssociationCapture=pythonObserver.slice(0,pythonObserver.lastIndexOf('try:\n raw=sys.stdin'))+String.raw`
def capture_request(r):
 if not isinstance(r,dict) or set(r)!={'schemaVersion','installationId','nodeId','origin','root','fileHashes','ownerFile','ownerSHA'} or type(r['schemaVersion']) is not int or r['schemaVersion']!=1 or not isinstance(r['installationId'],str) or re.fullmatch('[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',r['installationId']) is None or r['nodeId']!='srv-'+r['installationId'].replace('-',''): fail()
 from urllib.parse import urlsplit
 u=urlsplit(r['origin'])
 if u.scheme!='https' or u.username or u.password or u.path or u.query or u.fragment or u.port or r['origin']!='https://'+u.netloc: fail()
 import ipaddress
 ip=ipaddress.IPv4Address(u.hostname)
 if str(ip)!=u.hostname or not any(ip in ipaddress.IPv4Network(n) for n in ('127.0.0.1/32','10.0.0.0/8','172.16.0.0/12','192.168.0.0/16')): fail()
 absolute(r['root']);absolute(r['ownerFile'])
 if os.path.basename(r['ownerFile'])!='owner-invite.txt' or not isinstance(r['fileHashes'],dict) or set(r['fileHashes'])!={'compose.yaml','web.env','postgres.env','livekit.yaml'} or any(not isinstance(v,str) or re.fullmatch('[a-f0-9]{64}',v) is None for v in r['fileHashes'].values()) or r['ownerSHA'] is not None and (not isinstance(r['ownerSHA'],str) or re.fullmatch('[a-f0-9]{64}',r['ownerSHA']) is None): fail()
 return r
def fingerprint(p):
 directory(os.path.dirname(p),True);s=os.lstat(p)
 if not stat.S_ISREG(s.st_mode) or stat.S_ISLNK(s.st_mode) or s.st_uid!=os.geteuid() or stat.S_IMODE(s.st_mode)!=0o600 or s.st_nlink!=1 or s.st_size>1048576: fail()
 fd=os.open(p,os.O_RDONLY|os.O_NOFOLLOW|os.O_NONBLOCK)
 try:
  held=os.fstat(fd)
  if (held.st_dev,held.st_ino)!=(s.st_dev,s.st_ino): fail()
  chunks=[];size=0
  while True:
   chunk=os.read(fd,65536)
   if not chunk: break
   size+=len(chunk)
   if size>1048576: fail()
   chunks.append(chunk)
  b=b''.join(chunks);after=os.lstat(p)
  if (after.st_dev,after.st_ino,after.st_mode,after.st_uid,after.st_nlink,after.st_mtime_ns,after.st_size)!=(held.st_dev,held.st_ino,held.st_mode,held.st_uid,1,held.st_mtime_ns,len(b)): fail()
 finally: os.close(fd)
 a={'dev':s.st_dev,'ino':s.st_ino,'mode':stat.S_IMODE(s.st_mode),'sha256':hashlib.sha256(b).hexdigest()}
 if read(p,a)!=b: fail()
 return a,b
def capture(r):
 directory(r['root'],True);root=os.lstat(r['root']);parent=os.lstat(os.path.dirname(r['ownerFile']));files={}
 for name,expected in r['fileHashes'].items():
  a,b=fingerprint(os.path.join(r['root'],name))
  if a['sha256']!=expected: fail()
  files[name]=a
 a,b=fingerprint(r['ownerFile'])
 if r['ownerSHA'] is not None and r['ownerSHA']!=a['sha256'] or re.fullmatch(re.escape(r['origin']+'/super-admin#access=csa2.')+'[A-Za-z0-9_-]{43}\n',b.decode()) is None: fail()
 for name,association in files.items(): read(os.path.join(r['root'],name),association)
 read(r['ownerFile'],a);directory(r['root'],True);directory(os.path.dirname(r['ownerFile']),True);after=os.lstat(r['root']);after_parent=os.lstat(os.path.dirname(r['ownerFile']))
 if (after.st_dev,after.st_ino,after_parent.st_dev,after_parent.st_ino)!=(root.st_dev,root.st_ino,parent.st_dev,parent.st_ino): fail()
 return {**{k:r[k] for k in ('schemaVersion','installationId','nodeId','origin','root','ownerFile')},'contract':'castlink-setup-associations-v1','files':files,'ownerAssociation':a}
try:
 raw=sys.stdin.buffer.read(8193)
 if len(raw)>8192: fail()
 r=capture_request(parse(raw))
 if json.dumps(r,ensure_ascii=False,separators=(',',':')).encode()!=raw: fail()
 print(json.dumps(capture(r),ensure_ascii=False,separators=(',',':')))
except BaseException:
 print(json.dumps({'schemaVersion':1,'contract':'castlink-setup-associations-v1','ok':False,'diagnosis':'setup-associations-refused'}));sys.exit(3)
`;

// One fixed target invocation owns attempt creation + authenticated POST + SQL/
// HTTPS/file POST. Lost replies must be reobserved with nodeObserver/pythonObserver.
export const nodeCompletionTarget=nodeSqlGuard+nodeObserver.slice(0,nodeObserver.indexOf("let input='';process.stdin"))+String.raw`
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>32768)process.exit(3)});process.stdin.on('end',async()=>{try{const e=parse(input);if(!keys(e,'request,targetGuard,attemptPath,allowCreate')||typeof e.allowCreate!=='boolean')fail();const r=validate(e.request),g=e.targetGuard;if(r.complete||g.operation.kind!=='completion'||g.operation.root!==r.root||g.containerId!==r.webContainerId||g.containerImage!==r.webImageId)fail();absolute(e.attemptPath);if(path.dirname(e.attemptPath)!==path.dirname(r.ownerFile)||path.basename(e.attemptPath)!=='setup-completion.json')fail();const l=sqlGuard(g,r.installationId,r.nodeId);const before=await observe(r);if(before.setup==='complete'&&e.allowCreate)fail();sqlGuardCheck(g,l,r.installationId,r.nodeId);dispatchTargetOperation(l);
const intent={schemaVersion:1,installationId:r.installationId,nodeId:r.nodeId,origin:r.origin,serverName:r.serverName,release:r.release,webContainerId:r.webContainerId,caddyContainerId:r.caddyContainerId,files:r.files,ownerAssociation:r.ownerAssociation},b=Buffer.from(JSON.stringify(intent,null,2)+'\n');directory(path.dirname(e.attemptPath),true);if(!fs.existsSync(e.attemptPath)){if(!e.allowCreate)fail();const f=fs.openSync(e.attemptPath,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,384);try{fs.writeFileSync(f,b);fs.fsyncSync(f)}finally{fs.closeSync(f)}leaseSync(path.dirname(e.attemptPath))}const s=leasePrivate(e.attemptPath,false),a={path:e.attemptPath,dev:s.dev,ino:s.ino,mode:384,sha256:hash(b)};const {path:p,...association}=a;if(!read(p,association).equals(b))fail();r.complete=true;r.attempt=a;const observation=await observe(r);if(observation.setup!=='complete')fail();sqlGuardCheck(g,l,r.installationId,r.nodeId);releaseTargetOperation(l,true);console.log(JSON.stringify({schemaVersion:1,contract:'castlink-setup-completion-v1',observation,attempt:a}))}catch{console.log(JSON.stringify({schemaVersion:1,contract:'castlink-setup-completion-v1',ok:false,diagnosis:'setup-completion-unverified'}));process.exitCode=3}});
`;
export const pythonCompletionTarget=pythonSqlGuard+pythonObserver.slice(0,pythonObserver.lastIndexOf('try:\n raw=sys.stdin'))+String.raw`
try:
 raw=sys.stdin.buffer.read(32769);e=parse(raw)
 if len(raw)>32768 or json.dumps(e,ensure_ascii=False,separators=(',',':')).encode()!=raw or set(e)!={'request','targetGuard','attemptPath','allowCreate'} or type(e['allowCreate']) is not bool: fail()
 r=validate(e['request']);g=e['targetGuard'];p=e['attemptPath'];absolute(p)
 if r['complete'] or g['operation']['kind']!='completion' or g['operation']['root']!=r['root'] or g['containerId']!=r['webContainerId'] or g['containerImage']!=r['webImageId'] or os.path.dirname(p)!=os.path.dirname(r['ownerFile']) or os.path.basename(p)!='setup-completion.json': fail()
 l=sql_guard(g,r['installationId'],r['nodeId']);before=observe(r)
 if before['setup']=='complete' and e['allowCreate']: fail()
 sql_guard_check(g,l,r['installationId'],r['nodeId']);dispatch_target_operation(l)
 intent={k:r[k] for k in ('schemaVersion','installationId','nodeId','origin','serverName','release','webContainerId','caddyContainerId','files','ownerAssociation')};b=(json.dumps(intent,ensure_ascii=False,indent=2)+'\n').encode();directory(os.path.dirname(p),True)
 if not os.path.lexists(p):
  if not e['allowCreate']: fail()
  fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
  try:
   at=0
   while at<len(b): at+=os.write(fd,b[at:])
   os.fsync(fd)
  finally: os.close(fd)
  lease_sync(os.path.dirname(p))
 s=lease_private(p,False);association={'dev':s.st_dev,'ino':s.st_ino,'mode':384,'sha256':hashlib.sha256(b).hexdigest()}
 if read(p,association)!=b: fail()
 a={'path':p,**association};r['complete']=True;r['attempt']=a;observation=observe(r)
 if observation['setup']!='complete': fail()
 sql_guard_check(g,l,r['installationId'],r['nodeId']);release_target_operation(l,True);print(json.dumps({'schemaVersion':1,'contract':'castlink-setup-completion-v1','observation':observation,'attempt':a},separators=(',',':')))
except BaseException:
 print(json.dumps({'schemaVersion':1,'contract':'castlink-setup-completion-v1','ok':False,'diagnosis':'setup-completion-unverified'}));sys.exit(3)
`;
