"""Fixed root-SSH operations for Easy Setup VPS scopes. Input is never shell code."""
import hashlib,json,os,re,secrets,socket,stat,subprocess,sys,tarfile,time,urllib.request,urllib.parse,uuid
from pathlib import Path

SERVICES=('web','postgres','livekit','caddy')
UUID=re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
PROJECT=re.compile(r'^castlink-easy-[a-f0-9]{32}$')
def event(**value): print(json.dumps(value),flush=True)
def run(arguments,body=None,timeout=1800):
 result=subprocess.run(arguments,input=body,text=True,capture_output=True,timeout=timeout)
 if result.returncode: raise ValueError('Remote operation refused')
 return result.stdout
def docker(*arguments,body=None,timeout=1800):return run(['docker','--host','unix:///var/run/docker.sock',*arguments],body,timeout)
def compose(folder,*arguments,body=None,timeout=1800):return docker('compose','--project-directory',str(folder),'-f',str(folder/'compose.json'),*arguments,body=body,timeout=timeout)
def private_file(location,text):
 flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW
 with os.fdopen(os.open(location,flags,0o600),'w') as output:output.write(text)
def validate_compose(value,project):
 if not PROJECT.fullmatch(project) or value.get('name')!=project or set(value)!=set(['name','services','volumes']):raise ValueError('Invalid Easy Setup project')
 if set(value['services'])!=set(SERVICES) or set(value['volumes'])!=set(['postgres-data','web-data','caddy-data','caddy-config']):raise ValueError('Invalid Easy Setup resources')
 if any(value['volumes'].values()):raise ValueError('External resources refused')
 for name,service in value['services'].items():
  if any(key in service for key in ['extends','networks','container_name','build','privileged']):raise ValueError('Custom service refused')
  if not isinstance(service.get('image'),str):raise ValueError('Image absent')
def scope(project):
 if not PROJECT.fullmatch(project):raise ValueError('Invalid project')
 folder=Path('/opt')/project
 for location in [folder,folder/'compose.json']:
  info=location.lstat()
  if stat.S_ISLNK(info.st_mode) or info.st_uid!=0:raise ValueError('Untrusted project path')
 if not folder.is_dir() or folder.stat().st_mode&0o777!=0o700:raise ValueError('Untrusted project scope')
 value=json.loads((folder/'compose.json').read_text());validate_compose(value,project)
 return folder
def discover():
 installations=[]
 if not Path('/var/run/docker.sock').exists():return installations
 raw=docker('ps','--format','{{json .Labels}}',timeout=30)
 projects=set()
 for line in raw.splitlines():
  labels=dict(part.split('=',1) for part in json.loads(line).split(',') if '=' in part)
  project=labels.get('com.docker.compose.project','')
  if PROJECT.fullmatch(project) and labels.get('com.docker.compose.project.working_dir')=='/opt/'+project:projects.add(project)
 for project in sorted(projects):
  try:
   folder=scope(project)
   identity=json.loads(compose(folder,'exec','-T','web','node','/app/scripts/server-profile-store.mjs',body=json.dumps({'action':'identity'}),timeout=30))
   installation_id=str(uuid.UUID(hex=project[14:]))
   if identity.get('installationId')!=installation_id:continue
   installations.append(identity)
  except (ValueError,OSError,subprocess.SubprocessError):continue
 return installations
def configuration(address,release,installation_id=None):
 installation_id=installation_id or str(uuid.uuid4());node='srv-'+installation_id.replace('-','')
 if not UUID.fullmatch(installation_id) or not re.fullmatch(r'[a-f0-9]{40}',release.get('commit','')):raise ValueError('Invalid release identity')
 if release.get('schemaVersion')!=1 or release.get('images')!={name:'castlink-easy-'+name+':'+release['commit'] for name in SERVICES}:raise ValueError('Invalid release images')
 state={'schemaVersion':1,'installationId':installation_id,'nodeId':node,'address':address,'publicHttps':True,'databasePhase':'new','completed':False,'target':'remote','serverIp':address,'sshPort':22,'sshLogin':'root'}
 for name in ['password','livekitSecret','setupToken','session','encryption','nodeSecret']:state[name]=secrets.token_hex(32)
 state['livekitKey']='lk_'+secrets.token_hex(16)
 env={'NODE_ENV':'production','CASTLINK_DEPLOYMENT_MODEL':'self-hosted','CASTLINK_STORAGE_BACKEND':'json','DATABASE_URL':'postgresql://castlink:'+state['password']+'@postgres:5432/castlink','LIVEKIT_SERVER_URL':'http://livekit:7880','LIVEKIT_API_KEY':state['livekitKey'],'LIVEKIT_API_SECRET':state['livekitSecret'],'CASTLINK_SESSION_SECRET':state['session'],'CASTLINK_DATA_ENCRYPTION_KEY':state['encryption'],'CASTLINK_SETUP_TOKEN':state['setupToken'],'STUDIOLINK_DATA_DIR':'/data','STUDIOLINK_INSTALLATION_ID':installation_id,'STUDIOLINK_DEFAULT_STUDIO_ID':'studio-default','CASTLINK_NODE_ID':node,'CASTLINK_SERVER_ID':node,'CASTLINK_NODE_SECRET':state['nodeSecret'],'CASTLINK_NODE_TYPE':'self-hosted','CASTLINK_ENFORCE_NODE_ADMISSION':'1','CASTLINK_LICENSE_ENFORCE':'0','CASTLINK_CONTROL_PLANE_URL':'','CASTLINK_LICENSE_SERVICE_URL':'','STUDIOLINK_TRANSFER_ORIGIN':'https://'+address,'STUDIOLINK_TRANSFER_SERVER_ID':node}
 files={'web.env':''.join(k+'='+v+'\n' for k,v in env.items()),'postgres.env':'POSTGRES_USER=castlink\nPOSTGRES_DB=castlink\nPOSTGRES_PASSWORD='+state['password']+'\n','livekit.json':json.dumps({'port':7880,'log_level':'info','rtc':{'tcp_port':7881,'port_range_start':61000,'port_range_end':61100,'use_external_ip':False,'node_ip':address},'keys':{state['livekitKey']:state['livekitSecret']}}),'Caddyfile':'{\n admin off\n default_sni '+address+'\n}\nhttps://'+address+' {\n tls {\n  issuer acme {\n   dir https://acme-v02.api.letsencrypt.org/directory\n   profile shortlived\n  }\n }\n @rtc path /rtc /rtc/*\n route @rtc {\n  forward_auth web:3000 {\n   uri /api/media-admission\n   header_up -Upgrade\n   header_up -Connection\n  }\n  reverse_proxy livekit:7880\n }\n reverse_proxy web:3000\n}\n'}
 services={name:{'image':release['images'][name],'platform':'linux/amd64','restart':'unless-stopped'} for name in SERVICES}
 services['postgres'].update(env_file=['postgres.env'],volumes=['postgres-data:/var/lib/postgresql/data'],healthcheck={'test':['CMD-SHELL','pg_isready -U castlink -d castlink'],'interval':'5s','timeout':'5s','retries':24})
 services['web'].update(env_file=['web.env'],volumes=['web-data:/data'],depends_on={'postgres':{'condition':'service_healthy'}})
 services['livekit'].update(command=['--config','/etc/livekit.yaml'],volumes=['./livekit.json:/etc/livekit.yaml:ro'],ports=['7881:7881/tcp','61000-61100:61000-61100/udp'])
 services['caddy'].update(volumes=['./Caddyfile:/etc/caddy/Caddyfile:ro','caddy-data:/data','caddy-config:/config'],ports=['443:443','80:80'],depends_on=['web','livekit'])
 return {'state':state,'files':files,'compose':{'name':'castlink-easy-'+installation_id.replace('-',''),'services':services,'volumes':{k:{} for k in ['postgres-data','web-data','caddy-data','caddy-config']}}}
def ports_available():
 ids=docker('ps','-q',timeout=30).split()
 if ids:
  containers=json.loads(docker('inspect',*ids,timeout=30))
  for container in containers:
   for exposed,bindings in container.get('NetworkSettings',{}).get('Ports',{}).items():
    protocol=exposed.rsplit('/',1)[-1]
    for binding in bindings or []:
     port=int(binding.get('HostPort','0'))
     if protocol=='tcp' and port in [80,443,7881] or protocol=='udp' and 61000<=port<=61100:raise ValueError('Required VPS port is occupied; existing services were preserved')
 for protocol,ports in [(socket.SOCK_STREAM,[80,443,7881]),(socket.SOCK_DGRAM,range(61000,61101))]:
  for port in ports:
   with socket.socket(socket.AF_INET,protocol) as probe:
    try:probe.bind(('0.0.0.0',port))
    except OSError:raise ValueError('Required VPS port is occupied; existing services were preserved')
class ReleaseRedirect(urllib.request.HTTPRedirectHandler):
 def redirect_request(self,req,fp,code,msg,headers,newurl):
  url=urllib.parse.urlparse(newurl)
  if url.scheme!='https' or url.hostname not in ['github.com','release-assets.githubusercontent.com','objects.githubusercontent.com']:raise ValueError('Unexpected release redirect')
  return super().redirect_request(req,fp,code,msg,headers,newurl)
def download_release(url,checksum,destination):
 parsed=urllib.parse.urlparse(url)
 if parsed.scheme!='https' or parsed.hostname!='github.com' or not parsed.path.startswith('/resokol/castlink-releases/releases/download/') or not parsed.path.endswith('/CastLink-Linux.tar.gz') or parsed.query or parsed.fragment or not re.fullmatch(r'[a-f0-9]{64}',checksum):raise ValueError('Invalid public release')
 digest=hashlib.sha256();count=0;previous=time.monotonic();last_count=0
 opener=urllib.request.build_opener(ReleaseRedirect())
 with opener.open(urllib.request.Request(url,headers={'User-Agent':'CastLink-Easy-Setup'}),timeout=60) as response,destination.open('xb') as output:
  total=int(response.headers.get('Content-Length','0'))
  while True:
   chunk=response.read(1024*1024)
   if not chunk:break
   count+=len(chunk)
   if count>8*1024**3:raise ValueError('Release is too large')
   output.write(chunk);digest.update(chunk);now=time.monotonic()
   if now-previous>=1:event(stage='download',bytes=count,total=total,bytesPerSecond=int((count-last_count)/(now-previous)));previous=now;last_count=count
 if digest.hexdigest()!=checksum:raise ValueError('Public release SHA256 mismatch')
def prepare_release(folder):
 with tarfile.open(folder/'release.tar.gz','r:gz') as archive:
  for member in archive.getmembers():
   location=Path(member.name)
   if location.is_absolute() or '..' in location.parts or member.issym() or member.islnk() or not (member.isdir() or member.isfile()) or not location.parts or location.parts[0] not in ['LICENSE','payload','scripts']:raise ValueError('Invalid release archive member')
  archive.extractall(folder,filter='data')
 release=json.loads((folder/'payload/release.json').read_text())
 digest=hashlib.sha256()
 with (folder/'payload/images.tar.gz').open('rb') as images:
  for chunk in iter(lambda:images.read(1024*1024),b''):digest.update(chunk)
 if digest.hexdigest()!=release.get('imageArchiveSha256'):raise ValueError('Image archive SHA256 mismatch')
 return release
def prepare_database_phase(folder,state,phase):
 # The fixed Node protocol accepts only JSON.stringify bytes, without spaces.
 request={'schemaVersion':1,'installationId':state['installationId'],'nodeId':state['nodeId'],'phase':phase}
 output=compose(folder,'exec','-T','web','node','/app/scripts/setup-database-v1.mjs',body=json.dumps(request,separators=(',',':')))
 expected={**request,'contract':'castlink-database-v1','migrations':{'roomVersions':[1,2,3,4],'controlVersions':[1,2,3,4,5],'schema':True,'hashes':True},'seed':None if phase=='migrations' else {'installations':1,'accounts':1,'organizations':1,'memberships':1,'nodes':1,'studios':1,'rooms':0}}
 try:
  observed=json.loads(output)
  if json.dumps(observed,sort_keys=True,separators=(',',':'))!=json.dumps(expected,sort_keys=True,separators=(',',':')):raise ValueError()
 except (ValueError,TypeError):raise ValueError('Database preparation acknowledgement refused') from None
def deploy(data):
 if discover():raise ValueError('CastLink already exists; choose Connect to preserve it')
 ports_available()
 installation_id=str(uuid.uuid4());folder=Path('/opt')/('castlink-easy-'+installation_id.replace('-',''))
 folder.mkdir(mode=0o700)
 event(stage='download');download_release(data['releaseUrl'],data['releaseSha256'],folder/'release.tar.gz')
 release=prepare_release(folder);config=configuration(data['host'],release,installation_id)
 if release['commit']!=data['releaseCommit'] or not release['commit'].startswith(data['releaseCommitPrefix']) or release.get('distributionRepository')!='resokol/castlink-releases' or not all(value in release.get('capabilities',[]) for value in ['peer-profile-v1','root-ssh-v1']):raise ValueError('Release commit or capabilities mismatch')
 for name,text in config['files'].items():private_file(folder/name,text)
 private_file(folder/'compose.json',json.dumps(config['compose']));private_file(folder/'.castlink-install.json',json.dumps(config['state']))
 event(stage='images');docker('load','--input',str(folder/'payload/images.tar.gz'))
 # Verify transported RepoTags, without relying on engine-specific Image IDs.
 for image in release['images'].values():docker('image','inspect',image,timeout=30)
 event(stage='start');compose(folder,'up','-d','--pull','never','--no-build',timeout=300)
 deadline=time.monotonic()+180
 while True:
  try:
   compose(folder,'exec','-T','web','node','-e',"require('http').get('http://127.0.0.1:3000/api/setup',r=>{r.resume();r.on('end',()=>process.exit(r.statusCode===200?0:1))}).on('error',()=>process.exit(1))",timeout=20);break
  except ValueError:
   if time.monotonic()>deadline:raise ValueError('CastLink startup deadline exceeded')
   time.sleep(2)
 event(stage='database')
 for phase in ['migrations','seed']:
  prepare_database_phase(folder,config['state'],phase)
  config['state']['databasePhase']=phase
 compose(folder,'exec','-T','web','node','/app/scripts/postgres-migrate.mjs')
 finish="const h=require('node:http');const b=JSON.stringify({mode:'public',serverName:'CastLink'});const q=h.request({hostname:'127.0.0.1',port:3000,path:'/api/setup',method:'POST',headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000','content-type':'application/json','x-castlink-setup-token':process.env.CASTLINK_SETUP_TOKEN}},r=>{r.resume();r.on('end',()=>process.exit([200,409].includes(r.statusCode)?0:1))});q.on('error',()=>process.exit(1));q.end(b)"
 compose(folder,'exec','-T','web','node','-e',finish,timeout=30)
 config['state']['completed']=True
 # Only replace our own newly-created state, retaining failed deployment data.
 temporary=folder/'.castlink-install.new';private_file(temporary,json.dumps(config['state']));os.replace(temporary,folder/'.castlink-install.json')
 identity=json.loads(compose(folder,'exec','-T','web','node','/app/scripts/server-profile-store.mjs',body=json.dumps({'action':'identity'}),timeout=30))
 event(stage='ready',identity=identity)
 return identity
def main(data):
 if os.geteuid()!=0:raise ValueError('Root SSH login is required')
 action=data.get('action')
 if action=='inspect':return {'installations':discover()}
 if action=='deploy':return deploy(data)
 if action=='register':
  installation_id=data['installationId']
  if not UUID.fullmatch(installation_id):raise ValueError('Invalid installation')
  folder=scope('castlink-easy-'+installation_id.replace('-',''))
  return json.loads(compose(folder,'exec','-T','web','node','/app/scripts/server-profile-store.mjs',body=json.dumps({'action':'register','peer':data['peer']}),timeout=30))
 raise ValueError('Unknown provisioning operation')
if __name__=='__main__':
 try:
  payload=json.loads(sys.stdin.read(65537));event(result=main(payload))
 except Exception as error:
  # Never reflect subprocess output, input, credentials or arbitrary paths.
  event(error=str(error) if isinstance(error,ValueError) else 'VPS operation failed');sys.exit(1)
