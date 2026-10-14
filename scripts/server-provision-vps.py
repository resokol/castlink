"""Fixed root-SSH operations for Easy Setup VPS scopes. Input is never shell code."""
import copy,hashlib,http.client,io,json,os,re,secrets,shutil,signal,socket,ssl,stat,subprocess,sys,tarfile,tempfile,time,urllib.request,urllib.parse,uuid
from pathlib import Path

SERVICES=('web','postgres','livekit','caddy')
UUID=re.compile(r'^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$')
PROJECT=re.compile(r'^castlink-easy-[a-f0-9]{32}$')
def event(**value):
 try:print(json.dumps(value),flush=True)
 except (BrokenPipeError,OSError):pass # A lost SSH progress stream must not abort recovery.
def run(arguments,body=None,timeout=1800,output=None,input_file=None):
 env=os.environ.copy()
 for name in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:env.pop(name,None)
 if input_file:
  with Path(input_file).open('rb') as source:result=subprocess.run(arguments,stdin=source,stdout=subprocess.PIPE,stderr=subprocess.PIPE,timeout=timeout,env=env)
 elif output:
  with os.fdopen(os.open(output,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600),'wb') as destination:
   result=subprocess.run(arguments,stdout=destination,stderr=subprocess.PIPE,timeout=timeout,env=env)
 else:result=subprocess.run(arguments,input=body,text=True,capture_output=True,timeout=timeout,env=env)
 if result.returncode: raise ValueError('Remote operation refused')
 return '' if output else result.stdout.decode() if isinstance(result.stdout,bytes) else result.stdout
def docker(*arguments,body=None,timeout=1800,output=None,input_file=None):return run(['docker','--host','unix:///var/run/docker.sock',*arguments],body,timeout,output,input_file)
def compose(folder,*arguments,body=None,timeout=1800,output=None,input_file=None):return docker('compose','--project-directory',str(folder),'-f',str(folder/'compose.json'),*arguments,body=body,timeout=timeout,output=output,input_file=input_file)
def private_file(location,text):
 flags=os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW
 with os.fdopen(os.open(location,flags,0o600),'w') as output:output.write(text)
def validate_compose(value,project):
 if not PROJECT.fullmatch(project) or value.get('name')!=project or set(value)!=set(['name','services','volumes']):raise ValueError('Invalid Easy Setup project')
 if set(value['services']) not in [set(SERVICES),set([*SERVICES,'turn-tls'])] or set(value['volumes'])!=set(['postgres-data','web-data','caddy-data','caddy-config']):raise ValueError('Invalid Easy Setup resources')
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
def configuration(address,release,installation_id=None,saved_state=None):
 installation_id=installation_id or str(uuid.uuid4());node='srv-'+installation_id.replace('-','')
 if not UUID.fullmatch(installation_id) or not re.fullmatch(r'[a-f0-9]{40}',release.get('commit','')):raise ValueError('Invalid release identity')
 image_names=set(release.get('images',{}))
 if release.get('schemaVersion')!=1 or image_names not in [set(SERVICES),set([*SERVICES,'turntls'])] or release.get('images')!={name:'castlink-easy-'+name+':'+release['commit'] for name in image_names}:raise ValueError('Invalid release images')
 state=saved_state if saved_state is not None else {'schemaVersion':1,'installationId':installation_id,'nodeId':node,'address':address,'publicHttps':True,'databasePhase':'new','completed':False,'target':'remote','serverIp':address,'sshPort':22,'sshLogin':'root'}
 if saved_state is None:
  for name in ['password','livekitSecret','setupToken','session','encryption','nodeSecret']:state[name]=secrets.token_hex(32)
  state['livekitKey']='lk_'+secrets.token_hex(16)
 env={'NODE_ENV':'production','NODE_OPTIONS':'--max-old-space-size=384','CASTLINK_DEPLOYMENT_MODEL':'self-hosted','CASTLINK_STORAGE_BACKEND':'json','DATABASE_URL':'postgresql://castlink:'+state['password']+'@postgres:5432/castlink','LIVEKIT_SERVER_URL':'http://livekit:7880','LIVEKIT_API_KEY':state['livekitKey'],'LIVEKIT_API_SECRET':state['livekitSecret'],'CASTLINK_GUEST_RELAY_ENABLED':'1','CASTLINK_TURN_TRANSPORT':'udp','CASTLINK_SESSION_SECRET':state['session'],'CASTLINK_DATA_ENCRYPTION_KEY':state['encryption'],'CASTLINK_SETUP_TOKEN':state['setupToken'],'STUDIOLINK_DATA_DIR':'/data','STUDIOLINK_INSTALLATION_ID':installation_id,'STUDIOLINK_DEFAULT_STUDIO_ID':'studio-default','CASTLINK_NODE_ID':node,'CASTLINK_SERVER_ID':node,'CASTLINK_NODE_SECRET':state['nodeSecret'],'CASTLINK_NODE_TYPE':'self-hosted','CASTLINK_ENFORCE_NODE_ADMISSION':'1','CASTLINK_LICENSE_ENFORCE':'0','CASTLINK_CONTROL_PLANE_URL':'','CASTLINK_LICENSE_SERVICE_URL':'','STUDIOLINK_TRANSFER_ORIGIN':'https://'+address,'STUDIOLINK_TRANSFER_SERVER_ID':node}
 files={'web.env':''.join(k+'='+v+'\n' for k,v in env.items()),'postgres.env':'POSTGRES_USER=castlink\nPOSTGRES_DB=castlink\nPOSTGRES_PASSWORD='+state['password']+'\n','livekit.json':json.dumps({'port':7880,'log_level':'info','rtc':{'tcp_port':7881,'udp_port':7882,'use_external_ip':False,'node_ip':address},'keys':{state['livekitKey']:state['livekitSecret']},'turn':{'enabled':True,'udp_port':3478,'relay_range_start':30000,'relay_range_end':30031,'allow_restricted_peer_cidrs':[address+'/32']}}),'Caddyfile':'{\n admin off\n default_sni '+address+'\n}\nhttps://'+address+' {\n tls {\n  issuer acme {\n   dir https://acme-v02.api.letsencrypt.org/directory\n   profile shortlived\n  }\n }\n @rtc path /rtc /rtc/*\n route @rtc {\n  forward_auth web:3000 {\n   uri /api/media-admission\n   header_up -Upgrade\n   header_up -Connection\n  }\n  reverse_proxy livekit:7880\n }\n reverse_proxy web:3000\n}\n'}
 services={name:{'image':release['images'][name],'platform':'linux/amd64','restart':'unless-stopped'} for name in SERVICES}
 for name,limit in [('web','512m'),('livekit','512m'),('postgres','256m'),('caddy','128m')]:services[name].update(mem_limit=limit,memswap_limit=limit,logging={'driver':'json-file','options':{'max-size':'10m','max-file':'3'}})
 services['postgres'].update(env_file=['postgres.env'],command=['postgres','-c','shared_buffers=64MB','-c','max_connections=50'],volumes=['postgres-data:/var/lib/postgresql/data'],healthcheck={'test':['CMD-SHELL','pg_isready -U castlink -d castlink'],'interval':'5s','timeout':'5s','retries':24})
 services['web'].update(env_file=['web.env'],volumes=['web-data:/data'],depends_on={'postgres':{'condition':'service_healthy'}})
 services['livekit'].update(command=['--config','/etc/livekit.yaml'],environment={'GOMEMLIMIT':'384MiB'},volumes=['./livekit.json:/etc/livekit.yaml:ro'],ports=['7881:7881/tcp','7882:7882/udp','3478:3478/udp','30000-30031:30000-30031/udp'])
 services['caddy'].update(volumes=['./Caddyfile:/etc/caddy/Caddyfile:ro','caddy-data:/data','caddy-config:/config'],ports=['443:443','80:80'],depends_on=['web','livekit'])
 return {'state':state,'files':files,'compose':{'name':'castlink-easy-'+installation_id.replace('-',''),'services':services,'volumes':{k:{} for k in ['postgres-data','web-data','caddy-data','caddy-config']}}}
def ports_available(exclude_project=None):
 ids=docker('ps','-q',timeout=30).split()
 own_ports=set()
 if ids:
  containers=json.loads(docker('inspect',*ids,timeout=30))
  for container in containers:
   own=exclude_project and container.get('Config',{}).get('Labels',{}).get('com.docker.compose.project')==exclude_project
   for exposed,bindings in container.get('NetworkSettings',{}).get('Ports',{}).items():
    protocol=exposed.rsplit('/',1)[-1]
    for binding in bindings or []:
     port=int(binding.get('HostPort','0'))
     if own:
      own_ports.add((protocol,port));continue
     if protocol=='tcp' and port in [80,443,7881] or protocol=='udp' and (port in [3478,7882] or 30000<=port<=30031):raise ValueError('Required VPS port is occupied; existing services were preserved')
 for protocol,ports in [(socket.SOCK_STREAM,[80,443,7881]),(socket.SOCK_DGRAM,[3478,7882,*range(30000,30032)])]:
  for port in ports:
   if ('tcp' if protocol==socket.SOCK_STREAM else 'udp',port) in own_ports:continue
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
def prepare_release(folder,progress=None):
 if progress:progress(stage='unpack')
 with tarfile.open(folder/'release.tar.gz','r:gz') as archive:
  for member in archive.getmembers():
   location=Path(member.name)
   if location.is_absolute() or '..' in location.parts or member.issym() or member.islnk() or not (member.isdir() or member.isfile()) or not location.parts or location.parts[0] not in ['LICENSE','THIRD_PARTY_NOTICES','distribution','third_party','payload','scripts']:raise ValueError('Invalid release archive member')
  archive.extractall(folder,filter='data')
 release=json.loads((folder/'payload/release.json').read_text())
 if progress:progress(stage='verify-images')
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
def partial_installation(address):
 candidates=[]
 for entry in Path('/opt').glob('castlink-easy-*'):
  if not PROJECT.fullmatch(entry.name):continue
  try:
   folder=scope(entry.name)
   state=json.loads((folder/'.castlink-install.json').read_text())
   if state.get('address')==address and not state.get('completed'):candidates.append((folder,state))
  except (ValueError,OSError,KeyError):
   # An untrusted or damaged matching scope must not be silently reused.
   raise ValueError('Existing Easy Setup scope needs manual inspection') from None
 if len(candidates)>1:raise ValueError('Multiple incomplete Easy Setup scopes need manual inspection')
 return candidates[0] if candidates else None
def verified_partial(folder,state,data):
 installation_id=str(uuid.UUID(hex=folder.name[14:]))
 if state.get('schemaVersion')!=1 or state.get('installationId')!=installation_id or state.get('nodeId')!='srv-'+installation_id.replace('-','') or state.get('address')!=data['host'] or state.get('completed') is not False or state.get('databasePhase') not in ['new','migrations','seed'] or state.get('target')!='remote':raise ValueError('Incomplete installation identity changed')
 if any(not re.fullmatch(r'[a-f0-9]{64}',state.get(name,'')) for name in ['password','livekitSecret','setupToken','session','encryption','nodeSecret']) or not re.fullmatch(r'lk_[a-f0-9]{32}',state.get('livekitKey','')):raise ValueError('Incomplete installation secrets changed')
 digest=hashlib.sha256()
 with (folder/'release.tar.gz').open('rb') as archive:
  for chunk in iter(lambda:archive.read(1024*1024),b''):digest.update(chunk)
 if digest.hexdigest()!=data['releaseSha256']:raise ValueError('Incomplete installation release differs from requested release')
 with tarfile.open(folder/'release.tar.gz','r:gz') as archive:
  manifest=archive.extractfile('payload/release.json')
  if manifest is None or manifest.read()!= (folder/'payload/release.json').read_bytes():raise ValueError('Incomplete installation release manifest changed')
 release=json.loads((folder/'payload/release.json').read_text())
 if release.get('commit')!=data['releaseCommit'] or not release['commit'].startswith(data['releaseCommitPrefix']) or release.get('distributionRepository')!='resokol/castlink-releases' or not all(value in release.get('capabilities',[]) for value in ['peer-profile-v1','root-ssh-v1']):raise ValueError('Incomplete installation release identity changed')
 images=hashlib.sha256()
 with (folder/'payload/images.tar.gz').open('rb') as archive:
  for chunk in iter(lambda:archive.read(1024*1024),b''):images.update(chunk)
 if images.hexdigest()!=release.get('imageArchiveSha256'):raise ValueError('Incomplete installation image archive changed')
 config=configuration(data['host'],release,installation_id,state)
 old=json.loads(json.dumps(config['compose']))
 for service in old['services'].values():
  for key in ['mem_limit','memswap_limit','logging']:service.pop(key)
 old['services']['postgres'].pop('command')
 old['services']['livekit'].pop('environment')
 old['services']['livekit']['ports']=['7881:7881/tcp','61000-61100:61000-61100/udp','3478:3478/udp','30000-30999:30000-30999/udp']
 current=json.loads((folder/'compose.json').read_text())
 if current not in [old,config['compose']]:raise ValueError('Incomplete installation Compose changed; manual inspection required')
 legacy=json.loads(config['files']['livekit.json']);legacy['rtc'].pop('udp_port');legacy['rtc'].update(port_range_start=61000,port_range_end=61100);legacy['turn']['relay_range_end']=30999
 if json.loads((folder/'livekit.json').read_text()) not in [legacy,json.loads(config['files']['livekit.json'])]:raise ValueError('Incomplete installation LiveKit configuration changed')
 old_web=''.join(line for line in config['files']['web.env'].splitlines(keepends=True) if not line.startswith('NODE_OPTIONS='))
 if (folder/'web.env').read_text() not in [old_web,config['files']['web.env']] or (folder/'postgres.env').read_text()!=config['files']['postgres.env'] or (folder/'Caddyfile').read_text()!=config['files']['Caddyfile']:raise ValueError('Incomplete installation configuration changed')
 return config
def replace_private(folder,name,content):
 temporary=folder/(name+'.new-'+secrets.token_hex(8));private_file(temporary,content);os.replace(temporary,folder/name)
def deploy(data):
 partial=partial_installation(data['host'])
 installed=discover()
 if installed and (not partial or any(value.get('installationId')!=partial[1]['installationId'] for value in installed)):raise ValueError('CastLink already exists; choose Connect to preserve it')
 ports_available(partial[0].name if partial else None)
 if partial:
  folder,state=partial;config=verified_partial(folder,state,data);release=json.loads((folder/'payload/release.json').read_text())
  for name in ['web.env','livekit.json']:replace_private(folder,name,config['files'][name])
  replace_private(folder,'compose.json',json.dumps(config['compose']))
 else:
  installation_id=str(uuid.uuid4());folder=Path('/opt')/('castlink-easy-'+installation_id.replace('-',''))
  # Publish an installation scope only after the checked release and state exist.
  # A failed download/extraction must not block every later retry.
  with tempfile.TemporaryDirectory(prefix=".castlink-stage-",dir=Path("/opt")) as staging_name:
   staging=Path(staging_name)
   event(stage='download');download_release(data['releaseUrl'],data['releaseSha256'],staging/'release.tar.gz')
   release=prepare_release(staging,event);config=configuration(data['host'],release,installation_id)
   if release['commit']!=data['releaseCommit'] or not release['commit'].startswith(data['releaseCommitPrefix']) or release.get('distributionRepository')!='resokol/castlink-releases' or not all(value in release.get('capabilities',[]) for value in ['peer-profile-v1','root-ssh-v1']):raise ValueError('Release commit or capabilities mismatch')
   for name,text in config['files'].items():private_file(staging/name,text)
   private_file(staging/'compose.json',json.dumps(config['compose']));private_file(staging/'.castlink-install.json',json.dumps(config['state']))
   os.rename(staging,folder)
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
 verify_setup="require('node:http').get('http://127.0.0.1:3000/api/setup',r=>{let b='';r.on('data',c=>b+=c);r.on('end',()=>{try{process.exit(r.statusCode===200&&JSON.parse(b).needsSetup===false?0:1)}catch{process.exit(1)}})}).on('error',()=>process.exit(1))"
 compose(folder,'exec','-T','web','node','-e',verify_setup,timeout=30)
 identity=json.loads(compose(folder,'exec','-T','web','node','/app/scripts/server-profile-store.mjs',body=json.dumps({'action':'identity'}),timeout=30))
 if identity.get('installationId')!=config['state']['installationId'] or identity.get('id')!=config['state']['nodeId'] or identity.get('origin')!='https://'+data['host']:raise ValueError('Installed identity acknowledgement refused')
 config['state']['completed']=True
 replace_private(folder,'.castlink-install.json',json.dumps(config['state']))
 event(stage='ready',identity=identity)
 return identity
UPDATE_GUARD="""const c=require('node:crypto');(async()=>{const n=Math.floor(Date.now()/1000),e=v=>Buffer.from(JSON.stringify(v)).toString('base64url'),u=e({alg:'HS256',typ:'JWT'})+'.'+e({iss:process.env.LIVEKIT_API_KEY,nbf:n-5,exp:n+60,video:{roomList:true}}),t=u+'.'+c.createHmac('sha256',process.env.LIVEKIT_API_SECRET).update(u).digest('base64url');const r=await fetch((process.env.LIVEKIT_SERVER_URL||'http://livekit:7880')+'/twirp/livekit.RoomService/ListRooms',{method:'POST',headers:{authorization:'Bearer '+t,'content-type':'application/json'},body:'{}',signal:AbortSignal.timeout(8000)});if(!r.ok)throw Error();const d=await r.json();if(!d||typeof d!=='object'||Array.isArray(d))throw Error();const a=d.rooms===undefined?[]:d.rooms;if(!Array.isArray(a)||a.some(x=>!x||typeof x!=='object'||Array.isArray(x)||x.numParticipants!==undefined&&(!Number.isInteger(x.numParticipants)||x.numParticipants<0)||x.numParticipants>0))throw Error();console.log('NO_ACTIVE_PARTICIPANTS')})().catch(()=>process.exitCode=1);"""
UPDATE_VERSION="fetch('http://127.0.0.1:3000/api/version',{signal:AbortSignal.timeout(5000)}).then(async r=>{if(!r.ok)throw Error();const v=await r.json();if(typeof v.buildId!=='string')throw Error();console.log(v.buildId)}).catch(()=>process.exitCode=1)"
UPDATE_MIGRATIONS="""const fs=require('node:fs'),c=require('node:crypto'),x={};for(const d of ['/app/infrastructure/postgres','/app/infrastructure/control-plane']){const a=fs.readdirSync(d).filter(n=>/^\\d+.*\\.sql$/.test(n)).sort();if(!a.length)throw Error();for(const n of a)x[d+'/'+n]=c.createHash('sha256').update(fs.readFileSync(d+'/'+n)).digest('hex')}console.log(JSON.stringify(x))"""
def file_sha(location):
 digest=hashlib.sha256()
 with location.open('rb') as source:
  for chunk in iter(lambda:source.read(1048576),b''):digest.update(chunk)
 return digest.hexdigest()
def update_identity(folder):return json.loads(compose(folder,'exec','-T','web','node','/app/scripts/server-profile-store.mjs',body=json.dumps({'action':'identity'}),timeout=30))
def update_build(folder):return compose(folder,'exec','-T','web','node','-e',UPDATE_VERSION,timeout=15).strip()
def update_no_participants(folder):
 try:
  if compose(folder,'exec','-T','web','node','-e',UPDATE_GUARD,timeout=20).strip()!='NO_ACTIVE_PARTICIPANTS':raise ValueError()
 except (ValueError,subprocess.SubprocessError):raise ValueError('Active VPS sessions or session check unavailable') from None
def update_offline_no_participants(folder,image):
 try:
  result=docker('run','--rm','--network',folder.name+'_default','--env-file',str(folder/'web.env'),'--entrypoint','node',image,'-e',UPDATE_GUARD,timeout=30).strip()
  if result!='NO_ACTIVE_PARTICIPANTS':raise ValueError()
 except (ValueError,subprocess.SubprocessError):raise ValueError('Active VPS sessions or session check unavailable') from None
def update_maintenance(folder,image,enabled,token,allow_missing=False):
 volume='type=volume,source='+folder.name+'_web-data,target=/data'
 content='castlink-vps-update-v1:'+token+'\n'
 program="const fs=require('node:fs');const p='/data/.castlink-update-maintenance',v="+json.dumps(content)+";"+("fs.writeFileSync(p,v,{flag:'wx',mode:0o600});console.log('MAINTENANCE_SET')" if enabled else "try{if(!fs.lstatSync(p).isFile()||fs.readFileSync(p,'utf8')!==v)throw Error();fs.unlinkSync(p)}catch(e){if(e.code!=='ENOENT'||"+('false' if allow_missing else 'true')+")throw e}console.log('MAINTENANCE_CLEARED')")
 expected='MAINTENANCE_SET' if enabled else 'MAINTENANCE_CLEARED'
 if enabled is None:
  program="const fs=require('node:fs');if(fs.existsSync('/data/.castlink-update-maintenance'))throw Error();console.log('MAINTENANCE_ABSENT')";expected='MAINTENANCE_ABSENT'
 if docker('run','--rm','--network','none','--mount',volume,'--entrypoint','node',image,'-e',program,timeout=30).strip()!=expected:raise ValueError('VPS maintenance gate unavailable')
def update_resources(folder,model):
 ids={};web_id=None;web_image=None
 for service in model['services']:
  values=compose(folder,'ps','-q',service,timeout=30).split()
  if len(values)!=1:raise ValueError('VPS installation resources changed')
  observed=json.loads(docker('inspect',values[0],timeout=30))[0]
  labels=observed.get('Config',{}).get('Labels',{})
  if labels.get('com.docker.compose.project')!=folder.name or labels.get('com.docker.compose.service')!=service or not observed.get('State',{}).get('Running'):raise ValueError('VPS installation resources changed')
  if service=='web':
   mounts=observed.get('Mounts',[])
   if len(mounts)!=1 or mounts[0].get('Type')!='volume' or mounts[0].get('Name')!=folder.name+'_web-data' or mounts[0].get('Destination')!='/data':raise ValueError('VPS installation resources changed')
   web_id=observed['Id'];web_image=observed['Image']
   if docker('image','inspect',model['services']['web']['image'],'--format','{{.Id}}',timeout=30).strip()!=web_image:raise ValueError('VPS installation resources changed')
  else:
   if service=='postgres':
    mounts=observed.get('Mounts',[])
    if len(mounts)!=1 or mounts[0].get('Type')!='volume' or mounts[0].get('Name')!=folder.name+'_postgres-data' or mounts[0].get('Destination')!='/var/lib/postgresql/data':raise ValueError('VPS installation resources changed')
   ids[service]=observed['Id']
 return ids,web_id,web_image
def update_migrations(folder,image):
 try:
  current=json.loads(compose(folder,'exec','-T','web','node','-e',UPDATE_MIGRATIONS,timeout=30))
  candidate=json.loads(docker('run','--rm','--network','none','--read-only','--entrypoint','node',image,'-e',UPDATE_MIGRATIONS,timeout=30))
  if not current or current!=candidate:raise ValueError()
 except (ValueError,subprocess.SubprocessError):raise ValueError('VPS release needs a database migration') from None
def update_release_tags(stage,release):
 # The complete compressed archive was already hashed by prepare_release.
 # Streaming avoids a full layer decompression just to locate Docker metadata.
 with tarfile.open(stage/'payload/images.tar.gz','r|gz') as archive:
  for member in archive:
   if member.name!='manifest.json':continue
   entry=archive.extractfile(member)
   if entry is None:raise ValueError('VPS update release identity changed')
   body=entry.read(1048577)
   if len(body)>1048576:raise ValueError('VPS update release identity changed')
   manifest=json.loads(body)
   if {tag for image in manifest for tag in image.get('RepoTags',[])}!=set(release['images'].values()):raise ValueError('VPS update release identity changed')
   return
  raise ValueError('VPS update release identity changed')
def update_space(folder,archive=None):
 # Covers the release, imported images and backups before interruption.
 sizes=compose(folder,'exec','-T','web','node','-e',"const fs=require('node:fs');let n=0;function walk(p){for(const e of fs.readdirSync(p,{withFileTypes:true})){const q=p+'/'+e.name;if(e.isDirectory())walk(q);else if(e.isFile())n+=fs.statSync(q).size}}walk('/data');console.log(n)",timeout=30).strip()
 database=compose(folder,'exec','-T','postgres','psql','-X','-A','-t','-U','castlink','-d','castlink','-c',"SELECT pg_database_size('castlink')",timeout=30).strip()
 if not sizes.isdigit() or not database.isdigit():raise ValueError('VPS backup space unavailable')
 required=3*(int(sizes)+int(database))+1024**3+(3*archive.stat().st_size if archive and archive.exists() else 0)
 if shutil.disk_usage(folder).free<required:raise ValueError('VPS backup space unavailable')
def update_health(folder,data,expected):
 origin=urllib.parse.urlparse(data['origin']);context=ssl.create_default_context()
 if data.get('ca'):context.load_verify_locations(cadata=data['ca'])
 for attempt in range(30):
  try:
   if update_build(folder)!=expected:raise ValueError()
   identity=update_identity(folder)
   if identity.get('installationId')!=data['installationId'] or identity.get('origin')!=data['origin']:raise ValueError()
   with socket.create_connection((data['host'],443),timeout=8) as raw,context.wrap_socket(raw,server_hostname=origin.hostname) as connection:
    connection.sendall(('GET /api/version HTTP/1.1\r\nHost: '+origin.hostname+'\r\nConnection: close\r\n\r\n').encode())
    response=http.client.HTTPResponse(connection);response.begin();body=response.read(65537)
    if response.status!=200 or len(body)>65536 or json.loads(body).get('buildId')!=expected:raise ValueError()
   return
  except (ValueError,OSError,http.client.HTTPException,subprocess.SubprocessError):
   if attempt==29:raise ValueError('VPS update health deadline exceeded') from None
   time.sleep(2)
def update_unchanged(folder,record,model):
 for name,digest in record['fileHashes'].items():
  if name!='compose.json' and file_sha(folder/name)!=digest:raise ValueError('VPS installation resources changed')
 for service,identifier in record['infrastructureIds'].items():
  if compose(folder,'ps','-q',service,timeout=30).strip()!=identifier or docker('inspect',identifier,'--format','{{.State.Running}}',timeout=30).strip()!='true':raise ValueError('VPS installation resources changed')
def update(data):
 import fcntl
 installation_id=data.get('installationId','')
 if not UUID.fullmatch(installation_id):raise ValueError('Invalid installation')
 folder=scope('castlink-easy-'+installation_id.replace('-',''))
 lock=os.open(folder/'.castlink-update.lock',os.O_WRONLY|os.O_CREAT|os.O_NOFOLLOW,0o600)
 handlers={}
 def interrupted(signum,frame):raise ValueError('VPS update interrupted')
 try:
  try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  except BlockingIOError:raise ValueError('VPS update is already running') from None
  for name in [signal.SIGHUP,signal.SIGTERM]:handlers[name]=signal.signal(name,interrupted)
  return update_locked(folder,data)
 finally:
  for name,handler in handlers.items():signal.signal(name,handler)
  os.close(lock)
def update_locked(folder,data):
 state=json.loads((folder/'.castlink-install.json').read_text());identity=update_identity(folder)
 if state.get('installationId')!=data['installationId'] or state.get('completed') is not True or identity.get('installationId')!=data['installationId'] or identity.get('origin')!=data.get('origin'):raise ValueError('VPS update target identity changed')
 origin=urllib.parse.urlparse(data['origin'])
 if origin.scheme!='https' or not origin.hostname or origin.port not in [None,443] or origin.path not in ['', '/'] or origin.username or origin.password or origin.query or origin.fragment:raise ValueError('VPS update target identity changed')
 original=(folder/'compose.json').read_text();model=json.loads(original);validate_compose(model,folder.name)
 if model['services']['web'].get('volumes')!=['web-data:/data'] or model['services']['web'].get('env_file')!=['web.env']:raise ValueError('VPS installation resources changed')
 infrastructure,web_id,old_image=update_resources(folder,model);previous=update_build(folder)
 update_maintenance(folder,old_image,None,'')
 update_no_participants(folder);update_space(folder)
 with tempfile.TemporaryDirectory(prefix='.castlink-update-',dir=folder) as temporary:
  stage=Path(temporary);event(stage='download');download_release(data['releaseUrl'],data['releaseSha256'],stage/'release.tar.gz');release=prepare_release(stage,event)
  # Reuse release validation without generating or writing installation files.
  configuration(data['host'],release,data['installationId'],state)
  if release.get('commit')!=data['releaseCommit'] or not release['commit'].startswith(data['releaseCommitPrefix']) or release.get('distributionRepository')!='resokol/castlink-releases' or not all(c in release.get('capabilities',[]) for c in ['peer-profile-v1','root-ssh-v1','vps-update-maintenance-v1']):raise ValueError('VPS update release identity changed')
  expected=release.get('version','')+'-'+release['commit'][:12]
  if not re.fullmatch(r'[0-9]+\.[0-9]+\.[0-9]+(?:-[a-zA-Z0-9.]+)?-[a-f0-9]{12}',expected):raise ValueError('VPS update release identity changed')
  update_release_tags(stage,release)
  if previous==expected and model['services']['web']['image']==release['images']['web']:return {'outcome':'current','installationId':data['installationId'],'origin':data['origin'],'previousBuildId':previous,'targetBuildId':expected,'buildId':expected,'infrastructurePreserved':True}
  event(stage='images',previousBuildId=previous,targetBuildId=expected);update_space(folder,stage/'release.tar.gz')
  if model['services']['web']['image']==release['images']['web']:raise ValueError('VPS update release identity changed')
  docker('load','--input',str(stage/'payload/images.tar.gz'),timeout=600)
  # IDs are local to the Docker store; bind the transported exact verified tag
  # to its local immutable ID instead of assuming equality with the CI store.
  image=docker('image','inspect',release['images']['web'],'--format','{{.Id}}',timeout=30).strip()
  if not re.fullmatch(r'sha256:[a-f0-9]{64}',image) or docker('image','inspect',image,'--format','{{.Os}}/{{.Architecture}}',timeout=30).strip()!='linux/amd64':raise ValueError('VPS update release identity changed')
  update_migrations(folder,image)
  if docker('image','inspect',model['services']['web']['image'],'--format','{{.Id}}',timeout=30).strip()!=old_image:raise ValueError('VPS installation resources changed')
  docker('run','--rm','--network','none','--read-only','--entrypoint','tar',old_image,'--version',timeout=30)
  if previous==expected and old_image==image:return {'outcome':'current','installationId':data['installationId'],'origin':data['origin'],'previousBuildId':previous,'targetBuildId':expected,'buildId':expected,'infrastructurePreserved':True}
  backup_root=folder/'backups';backup_root.mkdir(mode=0o700,exist_ok=True)
  if backup_root.is_symlink() or backup_root.stat().st_uid!=os.getuid() or backup_root.stat().st_mode&0o777!=0o700:raise ValueError('VPS backup space unavailable')
  backup=backup_root/('web-'+release['commit'][:12]+'-'+secrets.token_hex(4));backup.mkdir(mode=0o700)
  names=['compose.json','web.env','postgres.env','livekit.json','Caddyfile','.castlink-install.json']
  if (folder/'turn-helper-entrypoint.sh').exists():names.append('turn-helper-entrypoint.sh')
  for name in names:
   info=(folder/name).lstat()
   if not stat.S_ISREG(info.st_mode) or info.st_uid!=os.getuid():raise ValueError('VPS installation resources changed')
   private_file(backup/name,(folder/name).read_text())
  record={'installationId':data['installationId'],'fileHashes':{name:file_sha(backup/name) for name in names},'infrastructureIds':infrastructure,'previousBuildId':previous,'previousWebImageId':old_image,'status':'config-ready'}
  update_no_participants(folder);update_unchanged(folder,record,model)
  if (folder/'compose.json').read_text()!=original or update_identity(folder)!=identity:raise ValueError('VPS update target identity changed')
  event(stage='backup');stopped=False;maintenance=False;committed=False;maintenance_token=secrets.token_hex(16)
  try:
   maintenance=True;update_maintenance(folder,old_image,True,maintenance_token)
   stopped=True;compose(folder,'stop','web',timeout=60)
   update_offline_no_participants(folder,old_image)
   compose(folder,'exec','-T','postgres','pg_dump','-Fc','--no-owner','--no-acl','-U','castlink','castlink',timeout=120,output=backup/'postgres.dump')
   docker('cp',web_id+':/data/.','-',timeout=120,output=backup/'web-data.tar')
   with (backup/'postgres.dump').open('rb') as dump:
    if dump.read(5)!=b'PGDMP':raise ValueError('VPS backup space unavailable')
   with tarfile.open(backup/'web-data.tar','r:') as archive:
    if archive.next() is None:raise ValueError('VPS backup space unavailable')
   record['dataHashes']={name:file_sha(backup/name) for name in ['postgres.dump','web-data.tar']};record['status']='data-ready';private_file(backup/'backup.json',json.dumps(record))
   candidate=copy.deepcopy(model);candidate['services']['web']['image']=image
   event(stage='update');replace_private(folder,'compose.json',json.dumps(candidate));compose(folder,'config','--quiet',timeout=30)
   compose(folder,'up','-d','--no-deps','--pull','never','--no-build','--force-recreate','web',timeout=90)
   event(stage='ready');update_health(folder,data,expected);update_unchanged(folder,record,model)
   record['status']='updated';replace_private(backup,'backup.json',json.dumps(record))
   # This is the final mutating operation. Public writes resume only after
   # verified health and the durable result; no later work can request rollback.
   # From this point, a lost acknowledgement must preserve the healthy new
   # app: public writes may have resumed even if Docker's reply was lost.
   committed=True
   for name in [getattr(signal,'SIGHUP',None),signal.SIGTERM]:
    if name is not None:signal.signal(name,signal.SIG_IGN)
   update_maintenance(folder,image,False,maintenance_token);maintenance=False
   return {'outcome':'updated','installationId':data['installationId'],'origin':data['origin'],'previousBuildId':previous,'targetBuildId':expected,'buildId':expected,'backup':str(backup),'infrastructurePreserved':True}
  except Exception:
   if committed:raise
   if not stopped and maintenance:
    # Creation may have succeeded before its acknowledgement was lost. Only
    # this transaction's marker can be removed; a prior gate is preserved.
    for name in [getattr(signal,'SIGHUP',None),signal.SIGTERM]:
     if name is not None:signal.signal(name,signal.SIG_IGN)
    try:update_maintenance(folder,old_image,False,maintenance_token,allow_missing=True)
    except Exception:raise ValueError('VPS maintenance gate unavailable') from None
   if stopped:
    # Once recovering, allow the bounded recovery commands to finish on hangup.
    for name in [getattr(signal,'SIGHUP',None),signal.SIGTERM]:
     if name is not None:signal.signal(name,signal.SIG_IGN)
    event(stage='rollback',backup=str(backup))
    try:
     if file_sha(backup/'compose.json')!=record['fileHashes']['compose.json'] or docker('image','inspect',model['services']['web']['image'],'--format','{{.Id}}',timeout=30).strip()!=old_image:raise ValueError()
     update_unchanged(folder,record,model)
     compose(folder,'stop','web',timeout=60)
     if record.get('dataHashes'):
      for name,digest in record['dataHashes'].items():
       if file_sha(backup/name)!=digest:raise ValueError()
      # The app stays offline while restoring only this installation's data.
      docker('exec','-i',record['infrastructureIds']['postgres'],'pg_restore','--clean','--if-exists','--no-owner','--no-acl','-U','castlink','-d','castlink',input_file=backup/'postgres.dump',timeout=180)
      volume='type=volume,source='+folder.name+'_web-data,target=/data'
      docker('run','--rm','--network','none','--mount',volume,'--entrypoint','node',old_image,'-e',"const fs=require('node:fs');for(const n of fs.readdirSync('/data'))fs.rmSync('/data/'+n,{recursive:true,force:true})",timeout=120)
      docker('run','--rm','-i','--network','none','--mount',volume,'--entrypoint','tar',old_image,'-xf','-','-C','/data',input_file=backup/'web-data.tar',timeout=180)
     replace_private(folder,'compose.json',original)
     if maintenance:update_maintenance(folder,old_image,False,maintenance_token);maintenance=False
     compose(folder,'up','-d','--no-deps','--pull','never','--no-build','--force-recreate','web',timeout=90)
     update_health(folder,data,previous);update_unchanged(folder,record,model)
    except Exception:
     event(outcome='rollback-failed',backup=str(backup));raise ValueError('VPS update and web rollback failed; private backup retained') from None
    event(outcome='rolled-back',backup=str(backup));raise ValueError('VPS update failed; previous web restored, data retained') from None
   raise
def main(data):
 if os.geteuid()!=0:raise ValueError('Root SSH login is required')
 action=data.get('action')
 if action=='inspect':return {'installations':discover()}
 if action=='deploy':return deploy(data)
 if action=='update':return update(data)
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
