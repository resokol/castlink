#!/usr/bin/env python3
"""Desktop lifecycle driver. Reads one private JSON request on stdin; never accepts credentials in argv."""
import base64,contextlib,copy,socket,hashlib,importlib.util,json,os,plistlib,re,shutil,stat,subprocess,sys,tempfile,time,types,uuid
from pathlib import Path
OWNER='castlink-macos-compose-v1'
RECEIPT='.castlink-macos-owner.json'
CONFIG_FILES=('compose.json','postgres.env','web.env','livekit.json','Caddyfile','secrets.json','server-origin-ca.pem')

def validate_folder(folder,create=False):
 folder=Path(folder)
 if not folder.is_absolute() or str(folder) in ('/','/opt',str(Path.home())):raise ValueError('Choose a dedicated absolute installation folder')
 for parent in (folder,*folder.parents):
  if parent.is_symlink():raise ValueError('Installation folder cannot contain symbolic links')
 if create:folder.mkdir(parents=True,exist_ok=True,mode=0o700)
 info=folder.stat()
 if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)&0o077:raise ValueError('Installation folder must be owned by this user with private permissions (0700)')
 return folder

def validate_request(data):
 if not isinstance(data,dict) or data.get('action') not in ('install','update','remove','cleanup','discover') or data.get('target') not in ('local','ssh'):raise ValueError('Invalid lifecycle request')
 if data['action'] not in ('cleanup','discover') and data.get('confirmed') is not True:raise ValueError('Confirm the operation review before continuing')
 if not isinstance(data.get('folder'),str):raise ValueError('Installation folder required')
 if data.get('eraseData') and data.get('deleteConfirmation')!='DELETE':raise ValueError('Type DELETE to erase installation data')

def checksum(file):return hashlib.sha256(file.read_bytes()).hexdigest()

def private_json(file,value):
 temp=file.with_name(file.name+'.'+uuid.uuid4().hex)
 try:
  fd=os.open(str(temp),os.O_WRONLY|os.O_CREAT|os.O_EXCL,0o600)
  with os.fdopen(fd,'w') as handle:json.dump(value,handle)
  os.replace(temp,file)
 finally:
  if temp.exists():temp.unlink()

def write_receipt(folder,state,daemon,target):
 info=folder.stat();files={name:checksum(folder/name) for name in CONFIG_FILES if (folder/name).is_file()}
 private_json(folder/RECEIPT,{'owner':OWNER,'installationId':state['installationId'],'folder':str(folder),'device':info.st_dev,'inode':info.st_ino,'daemon':daemon,'target':target,'files':files})

def verify_receipt(folder,state,daemon,target):
 marker=folder/RECEIPT
 if marker.is_symlink() or marker.stat().st_size>32768:raise ValueError('Installation receipt changed')
 receipt=json.loads(marker.read_text());info=folder.stat()
 expected={'owner':OWNER,'installationId':state['installationId'],'folder':str(folder),'device':info.st_dev,'inode':info.st_ino,'daemon':daemon,'target':target}
 if any(receipt.get(k)!=v for k,v in expected.items()):raise ValueError('Installation identity, folder or Docker daemon changed')
 files=receipt.get('files')
 if set(files or {})!={name for name in CONFIG_FILES if (folder/name).exists()}:raise ValueError('Installation resource list changed')
 if not isinstance(files,dict) or not files or any(name not in CONFIG_FILES for name in files):raise ValueError('Invalid resource ownership receipt')
 for name,hash_value in files.items():
  file=folder/name
  if file.is_symlink() or not file.is_file() or checksum(file)!=hash_value:raise ValueError('Installation configuration changed; restore or review before continuing')
 return receipt

def remove_resources(engine,folder,state,erase):
 configuration=json.loads((folder/'compose.json').read_text());project=state['project'];services=configuration['services'];volumes=configuration.get('volumes',{})
 ids=engine.docker(['ps','-aq','--no-trunc','--filter','label=com.docker.compose.project='+project]).split()
 containers=json.loads(engine.docker(['inspect',*ids])) if ids else []
 for container in containers[:256]:
  labels=container.get('Config',{}).get('Labels',{})
  if labels.get('com.docker.compose.project')!=project or labels.get('com.docker.compose.service') not in services or container.get('Config',{}).get('Image')!=services.get(labels.get('com.docker.compose.service'),{}).get('image'):raise ValueError('Container ownership changed; no resources removed')
 networks=engine.docker(['network','ls','--quiet','--filter','label=com.docker.compose.project='+project]).split()
 for network in networks:
  info=json.loads(engine.docker(['network','inspect',network]))[0];labels=info.get('Labels',{}) or {}
  if labels.get('com.docker.compose.project')!=project or labels.get('com.docker.compose.network')!='default' or any(container not in ids for container in info.get('Containers',{})):raise ValueError('Network ownership changed; no resources removed')
 names=[]
 if erase:
  for logical,volume in volumes.items():
   name=volume['name'];items=json.loads(engine.docker(['volume','ls','--filter','name=^'+re.escape(name)+'$','--format','{{json .}}']) or 'null')
   if items is None:continue
   info=json.loads(engine.docker(['volume','inspect',name]))[0];labels=info.get('Labels',{}) or {}
   if labels.get('com.docker.compose.project')!=project or labels.get('com.docker.compose.volume')!=logical:raise ValueError('Volume ownership changed; no resources removed')
   users=engine.docker(['ps','-aq','--no-trunc','--filter','volume='+name]).split()
   if any(user not in ids for user in users):raise ValueError('A volume is used by another installation')
   names.append(name)
 # Every ownership decision above precedes the first destructive operation.
 if ids:engine.docker(['stop','--time','30',*ids]);engine.docker(['rm',*ids])
 for name in names:engine.docker(['volume','rm',name])
 for network in networks:engine.docker(['network','rm',network])
 # Images stay for other installations; retention only removes proven obsolete owned images.

def remove_obsolete_services(engine,state,previous,current):
 obsolete=set(previous.get('services',{}))-set(current.get('services',{}));selected=[]
 for service in sorted(obsolete):
  ids=engine.docker(['ps','-aq','--no-trunc','--filter','label=com.docker.compose.project='+state['project'],'--filter','label=com.docker.compose.service='+service]).split()
  if not ids:continue
  containers=json.loads(engine.docker(['inspect',*ids]))
  if {item.get('Id') for item in containers}!=set(ids):raise ValueError('Obsolete service identity changed')
  for item in containers:
   labels=item.get('Config',{}).get('Labels',{})
   if labels.get('com.docker.compose.project')!=state['project'] or labels.get('com.docker.compose.service')!=service or item.get('Config',{}).get('Image')!=previous['services'][service]['image']:raise ValueError('Obsolete service ownership changed')
  selected.extend(ids)
 if selected:engine.docker(['stop','--time','30',*selected]);engine.docker(['rm',*selected])

def load_engine(data):
 if 'linuxSource' in data:
  module=types.ModuleType('castlink_linux_setup');module.__file__='/dev/null'
  exec(compile(base64.b64decode(data['linuxSource']),module.__file__,'exec'),module.__dict__)
 else:
  file=Path(__file__).with_name('linux-compose-setup.py');spec=importlib.util.spec_from_file_location('castlink_linux_setup',file);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
 return module

def persist_linux_source(engine,data,folder):
 if 'linuxSource' not in data:return
 runtime=folder/'.castlink-runtime';runtime.mkdir(mode=0o700,exist_ok=True)
 if runtime.is_symlink():raise ValueError('Runtime directory changed')
 target=runtime/'linux-compose-setup.py';marker=runtime/'source-owner.json'
 if target.is_symlink() or marker.is_symlink() or (target.exists() and (not marker.exists() or checksum(target)!=json.loads(marker.read_text()).get('sha256'))):raise ValueError('Runtime source changed')
 source=base64.b64decode(data['linuxSource']).decode();engine.write_private(target,source);private_json(marker,{'owner':OWNER,'sha256':checksum(target)});engine.__file__=str(target)

def bind_docker(engine,data):
 executable=data.get('dockerExecutable','/usr/bin/docker');context=data.get('dockerContext','default')
 if not Path(executable).is_absolute() or context not in ('desktop-linux','default'):raise ValueError('Invalid Docker binding')
 environment={k:v for k,v in os.environ.items() if k not in ('DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH')}
 def docker(args,folder=None,stdin=None,output=None,timeout=None):
  try:result=subprocess.run([executable,'--context',context,*args],cwd=folder,input=stdin.encode() if stdin is not None else None,stdout=output or subprocess.PIPE,stderr=subprocess.PIPE,env=environment,timeout=timeout or 1800,check=False)
  except (OSError,subprocess.TimeoutExpired):raise ValueError('Docker operation unavailable or timed out') from None
  if result.returncode:raise ValueError('Docker operation failed; inspect only this installation locally')
  return result.stdout.decode('utf-8',errors='replace') if result.stdout else ''
 engine.docker=docker
 kind=json.loads(docker(['info','--format','{{json .}}'],timeout=20))
 if kind.get('OSType')!='linux' or not kind.get('ID'):raise ValueError('A local Linux Docker daemon is required')
 endpoint=docker(['context','inspect',context,'--format','{{.Endpoints.docker.Host}}'],timeout=20).strip()
 if not endpoint.startswith('unix:///'):raise ValueError('Only the explicitly selected local Docker socket is supported')
 version=docker(['compose','version','--short'],timeout=20).strip().lstrip('v');match=re.match(r'^(\d+)\.(\d+)\.(\d+)',version)
 if not match or tuple(map(int,match.groups()))<(2,23,1):raise ValueError('Docker Compose 2.23.1 or newer is required')
 return kind['ID']

def backup(engine,folder,state):
 root=folder/'backups';root.mkdir(mode=0o700,exist_ok=True)
 if root.is_symlink():raise ValueError('Backup directory changed')
 destination=root/(time.strftime('%Y%m%d-%H%M%S-')+uuid.uuid4().hex[:8]);destination.mkdir(mode=0o700)
 for name in (engine.STATE,RECEIPT,*[name for name in CONFIG_FILES if (folder/name).is_file()]):shutil.copyfile(folder/name,destination/name);os.chmod(destination/name,0o600)
 for name,args in [('postgres.dump',['exec','-T','postgres','pg_dump','-U','castlink','-d','castlink','-Fc']),('web-data.tar',['exec','-T','web','tar','-C','/data','-cf','-','.'])]:
  with (destination/name).open('xb') as handle:os.chmod(destination/name,0o600);engine.compose(folder,state,args,output=handle)
 checks=''.join(checksum(file)+'  '+file.name+'\n' for file in sorted(destination.iterdir()))
 engine.write_private(destination/'SHA256SUMS',checks)
 return str(destination)

def cleanup_mac_backups(engine,folder,state):
 root=folder/'backups'
 if not root.is_dir() or root.is_symlink():return
 required={engine.STATE,RECEIPT,*[name for name in CONFIG_FILES if name!='server-origin-ca.pem'],'postgres.dump','web-data.tar'};verified=[]
 for directory in root.iterdir():
  if directory.is_symlink() or not directory.is_dir() or not re.fullmatch(r'[0-9]{8}-[0-9]{6}-[a-f0-9]{8}',directory.name):continue
  try:
   files=list(directory.iterdir());names={file.name for file in files}
   if not required.issubset(names) or not names.issubset(required|{'SHA256SUMS','server-origin-ca.pem'}) or 'SHA256SUMS' not in names or any(file.is_symlink() or not file.is_file() for file in files):continue
   if (directory/'SHA256SUMS').stat().st_size>16384 or (directory/engine.STATE).stat().st_size>1024*1024 or (directory/RECEIPT).stat().st_size>32768:continue
   previous=json.loads((directory/engine.STATE).read_text());owner=json.loads((directory/RECEIPT).read_text())
   if previous.get('owner')!=engine.OWNER or previous.get('installationId')!=state['installationId'] or owner.get('owner')!=OWNER or owner.get('installationId')!=state['installationId'] or owner.get('folder')!=str(folder):continue
   checks={}
   for line in (directory/'SHA256SUMS').read_text().splitlines():
    match=re.fullmatch(r'([a-f0-9]{64})  ([A-Za-z0-9._-]+)',line)
    if not match or match[2] in checks:raise ValueError('Invalid backup checksum manifest')
    checks[match[2]]=match[1]
   if set(checks)!=names-{'SHA256SUMS'} or any(checksum(directory/name)!=expected for name,expected in checks.items()):continue
   verified.append(directory)
  except (OSError,ValueError,KeyError,TypeError):continue
 # A partial or corrupt newer directory cannot displace the last intact backup.
 for directory in sorted(verified,key=lambda item:item.name,reverse=True)[1:]:
  for file in directory.iterdir():file.unlink()
  directory.rmdir()

def local_scheduler(engine,folder,state,data,unregister=False):
 label='ru.castlink.retention.'+state['installationId'];root=folder/'.castlink-runtime';plist=Path.home()/'Library/LaunchAgents'/(label+'.plist');owner=root/'scheduler.json'
 if unregister:
  if not owner.exists():return
  value=json.loads(owner.read_text())
  if owner.is_symlink() or plist.is_symlink() or value.get('label')!=label or (plist.exists() and checksum(plist)!=value.get('sha256')):raise ValueError('Retention scheduler ownership changed')
  subprocess.run(['/bin/launchctl','bootout','gui/'+str(os.getuid()),str(plist)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False,timeout=20)
  if plist.exists():plist.unlink()
  owner.unlink();return
 root.mkdir(mode=0o700,exist_ok=True)
 if root.is_symlink():raise ValueError('Retention runtime changed')
 runtime=Path(__file__).read_text() if '__file__' in globals() and Path(__file__).exists() else base64.b64decode(data['backendSource']).decode()
 linux=base64.b64decode(data['linuxSource']).decode() if 'linuxSource' in data else Path(engine.__file__).read_text()
 engine.write_private(root/'macos-compose-setup.py',runtime);engine.write_private(root/'linux-compose-setup.py',linux)
 request={k:data[k] for k in ('target','folder','dockerExecutable','dockerContext')};request.update(action='cleanup',installationId=state['installationId'])
 private_json(root/'cleanup.json',request)
 contents=plistlib.dumps({'Label':label,'ProgramArguments':[sys.executable,str(root/'macos-compose-setup.py'),'--cleanup',str(root/'cleanup.json')],'StartInterval':3600,'ProcessType':'Background','StandardOutPath':'/dev/null','StandardErrorPath':'/dev/null'})
 if plist.is_symlink() or (plist.exists() and (not owner.exists() or checksum(plist)!=json.loads(owner.read_text()).get('sha256'))):raise ValueError('Retention launch agent is not owned by this installation')
 plist.parent.mkdir(parents=True,exist_ok=True);engine.write_private(plist,contents.decode());private_json(owner,{'label':label,'sha256':checksum(plist)})
 subprocess.run(['/bin/launchctl','bootout','gui/'+str(os.getuid()),str(plist)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False,timeout=20)
 result=subprocess.run(['/bin/launchctl','bootstrap','gui/'+str(os.getuid()),str(plist)],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,check=False,timeout=20)
 if result.returncode:raise ValueError('Server ready; hourly retention could not be registered')

def resolve_ipv4(host):return {entry[4][0] for entry in socket.getaddrinfo(host,443,socket.AF_INET,socket.SOCK_STREAM)}

def validate_turn(state,release,target,resolve=resolve_ipv4):
 domain=state.get('turnDomain','')
 if not domain:return
 n=state['network'];host=__import__('urllib.parse',fromlist=['urlsplit']).urlsplit(n['publicOrigin']).hostname
 pattern=r'(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}'
 if target!='ssh' or not state.get('publicHttps') or n['mode']!='https' or n['httpPort']!=80 or n['httpsPort']!=443 or n['bindAddress']!='0.0.0.0' or not re.fullmatch(pattern,domain) or not re.fullmatch(pattern,host or '') or domain==host:raise ValueError('TURN/TLS requires Ubuntu, two separate public domains, direct HTTPS and ports 80/443')
 if release.get('images',{}).get('turntls')!='castlink-easy-turntls:'+release['commit'] or not re.fullmatch(r'sha256:[a-f0-9]{64}',release.get('imageIdentities',{}).get('turntls','')):raise ValueError('This verified release does not include TURN/TLS')
 if resolve(host)!={n['mediaIp']} or resolve(domain)!={n['mediaIp']}:raise ValueError('Both site and TURN DNS must point only to the selected server media IPv4')

def turn_caddy(state):
 host=__import__('urllib.parse',fromlist=['urlsplit']).urlsplit(state['network']['publicOrigin']).hostname;domain=state['turnDomain']
 return ('{\n admin off\n auto_https disable_redirects\n https_port 8443\n servers :8443 {\n  protocols h1 h2\n  listener_wrappers {\n   proxy_protocol {\n    timeout 2s\n    allow 10.0.0.0/8 172.16.0.0/12 192.168.0.0/16\n    fallback_policy require\n   }\n   tls\n  }\n }\n}\n'
  +'http://'+host+' {\n redir https://'+host+'{uri} permanent\n}\nhttp://'+domain+' {\n redir https://'+domain+'{uri} permanent\n}\n'
  +'https://'+host+' {\n tls {\n  issuer acme {\n   disable_tlsalpn_challenge\n  }\n }\n @rtc path /rtc /rtc/*\n route @rtc {\n  forward_auth web:3000 {\n   uri /api/media-admission\n   header_up -Upgrade\n   header_up -Connection\n  }\n  reverse_proxy livekit:7880\n }\n reverse_proxy web:3000\n}\n'
  +'https://'+domain+' {\n tls {\n  issuer acme {\n   disable_tlsalpn_challenge\n  }\n }\n respond "TURN endpoint" 204\n}\n')

def reconfigure(engine,state,config):
 candidate=engine.validate_config(config);result=copy.deepcopy(state)
 for key in ('setupMode','publicHttps','network'):result[key]=candidate[key]
 domain=config.get('turnDomain','')
 if not isinstance(domain,str):raise ValueError('Invalid TURN domain')
 result['turnDomain']=domain
 return result

def network_extensions(engine,target):
 original_render=engine.render;original_load=engine.load_images;original_probe=engine.probe_origin;original_complete=engine.complete
 def render(folder,state,release):
  validate_turn(state,release,target);original_render(folder,state,release)
  if not state.get('turnDomain'):return
  lk=json.loads((folder/'livekit.json').read_text());lk['turn'].update(domain=state['turnDomain'],tls_port=5349,external_tls=True,proxy_protocol=True,proxy_protocol_trusted_cidrs=['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16']);engine.write_private(folder/'livekit.json',lk)
  engine.write_private(folder/'web.env',(folder/'web.env').read_text().replace('CASTLINK_TURN_TRANSPORT=udp','CASTLINK_TURN_TRANSPORT=tls443'));engine.write_private(folder/'Caddyfile',turn_caddy(state))
  compose=json.loads((folder/'compose.json').read_text());compose['services']['caddy']['ports']=['80:80']
  compose['services']['turn-tls']={'image':release['images']['turntls'],'platform':'linux/amd64','restart':'unless-stopped','pull_policy':'never','environment':{'CASTLINK_TURN_HOST':state['turnDomain']},'volumes':['caddy-data:/data:ro'],'ports':['443:443'],'depends_on':['caddy','livekit'],'healthcheck':{'test':['CMD','/usr/local/bin/castlink-turn-tls','health'],'interval':'10s','timeout':'5s','retries':24,'start_period':'30s'}}
  engine.write_private(folder/'compose.json',compose)
 def load(package,release):
  original_load(package,release)
  if 'turntls' not in release.get('images',{}):return
  image=release['images']['turntls'];actual=json.loads(engine.docker(['image','inspect','--format','{{json .}}',image]))
  if image not in actual.get('RepoTags',[]) or actual.get('Os')!='linux' or actual.get('Architecture')!='amd64':raise ValueError('Invalid TURN/TLS image platform')
 def probe(folder,state):
  if not state.get('turnDomain'):return original_probe(folder,state)
  source=engine.READINESS_JS;engine.READINESS_JS=source.replace("hostname:'caddy'","hostname:'turn-tls'")
  try:return original_probe(folder,state)
  finally:engine.READINESS_JS=source
 def complete(folder,state):
  original_complete(folder,state)
  if not state.get('turnDomain'):return
  state['completed']=False;engine.write_private(folder/engine.STATE,state)
  for attempt in range(60):
   try:engine.compose(folder,state,['exec','-T','turn-tls','/usr/local/bin/castlink-turn-tls','health']);break
   except ValueError:
    if attempt==59:raise ValueError('TURN/TLS certificate and route are not ready') from None
    time.sleep(4)
  state['completed']=True;engine.write_private(folder/engine.STATE,state)
 engine.render=render;engine.load_images=load;engine.probe_origin=probe;engine.complete=complete


def discover_installations(engine,daemon,target):
 # Labels locate candidates. Only a matching receipt proves ownership.
 ids=engine.docker(['ps','-aq','--no-trunc','--filter','label=com.docker.compose.project']).split()
 containers=json.loads(engine.docker(['inspect',*ids])) if ids else [];folders=set()
 fixed=Path('/opt/castlink')
 if target=='ssh' and fixed.is_dir() and not fixed.is_symlink():
  for child in list(fixed.iterdir())[:64]:
   if child.is_dir() and not child.is_symlink() and (child/RECEIPT).is_file():folders.add(str(child))
 for container in containers[:256]:
  labels=container.get('Config',{}).get('Labels',{});folder=labels.get('com.docker.compose.project.working_dir')
  if isinstance(folder,str) and Path(folder).is_absolute():folders.add(folder)
 result=[]
 for value in sorted(folders)[:64]:
  try:
   folder=validate_folder(Path(value));state=engine.load_state(folder);verify_receipt(folder,state,daemon,target)
   result.append({'folder':str(folder),'installationId':state['installationId'],'origin':state['network']['publicOrigin'],'completed':state.get('completed') is True})
  except (ValueError,OSError,KeyError,TypeError):continue
 return result

def run(data):
 validate_request(data);action=data['action'];target=data['target'];lang=data.get('locale','en')
 if target=='local' and sys.platform!='darwin':raise ValueError('Local setup requires macOS')
 if action!='discover':folder=validate_folder(Path(data['folder']),create=action=='install')
 engine=load_engine(data);daemon=bind_docker(engine,data)
 if action=='discover':return {'ok':True,'action':'discover','installations':discover_installations(engine,daemon,target)}
 network_extensions(engine,target);engine.cleanup_legacy_backups=lambda f,s:cleanup_mac_backups(engine,f,s)
 with engine.installation_lock(folder):
  exists=(folder/engine.STATE).exists();state=engine.load_state(folder) if exists else None
  previous_compose=json.loads((folder/'compose.json').read_text()) if exists and (folder/'compose.json').exists() else {'services':{}}
  if exists:
   verify_receipt(folder,state,daemon,target)
   if data.get('installationId') and data['installationId']!=state['installationId']:raise ValueError('Saved installation identity changed')
  elif action!='install':raise ValueError('No owned installation exists in this folder')
  persist_linux_source(engine,data,folder)
  if target=='local':engine.register_cleanup=lambda f,s:local_scheduler(engine,f,s,data)
  if action=='cleanup':
   if not state.get('completed'):return {'ok':True,'action':action,'completed':False}
   engine.cleanup_installation(folder,state,lang);return {'ok':True,'action':action,'completed':True}
  if action=='remove':
   if target=='local':local_scheduler(engine,folder,state,data,unregister=True)
   else:engine.unregister_cleanup(folder,state)
   remove_resources(engine,folder,state,data.get('eraseData') is True)
   state.update(completed=False,removed=True)
   if data.get('eraseData'):state['databasePhase']='new'
   engine.write_private(folder/engine.STATE,state);write_receipt(folder,state,daemon,target)
   return {'ok':True,'action':action,'completed':True,'installationId':state['installationId'],'dataRetained':not data.get('eraseData',False)}
  if action=='update' and not state.get('completed'):raise ValueError('Complete or resume this installation before updating')
  candidate=engine.check_updates(state['release'] if state else {})
  if candidate is None and state:
   if action=='update' and not data.get('reconfigure'):return {'ok':True,'action':action,'completed':True,'installationId':state['installationId'],'origin':state['network']['publicOrigin'],'outcome':'current','version':state['release']['version'],'sourceCommit':state['release']['commit'],'daemonId':daemon,'configuration':{key:state[key] for key in ('setupMode','publicHttps','network','turnDomain') if key in state}}
   package_context=contextlib.nullcontext((None,state['release']))
  elif candidate is None:raise ValueError('No verified public Linux server release is available')
  else:package_context=engine.downloaded_update(folder,candidate)
  backup_path=backup(engine,folder,state) if action=='update' else None
  if action=='update' and data.get('reconfigure') is True:state=reconfigure(engine,state,data['config'])
  with package_context as (package,release):
   if not state:
    password=data.pop('roomPassword','')
    if not isinstance(password,str) or not 8<=len(password.encode('utf-16-le'))//2<=256 or not password.strip() or any(c in password for c in '\r\n\0'):raise ValueError('Room creation password must be 8–256 characters')
    password_hash=hashlib.sha256(password.encode()).hexdigest();password=''
    config=engine.validate_config(data['config']);config['turnDomain']=data['config'].get('turnDomain','');validate_turn(config,release,target)
    state=engine.init_state(folder,config,release,password_hash);write_receipt(folder,state,daemon,target)
   if package:
    engine.load_images(package,release);engine.remember_images(folder,release)
   # All release images are explicitly linux/amd64. Prove actual x64 execution on the selected daemon.
   if target=='local' and data.get('hostArch')=='arm64' and data.get('allowEmulation') is not True:raise ValueError('Explicit Apple Silicon amd64 emulation approval is required')
   if engine.docker(['run','--rm','--platform','linux/amd64','--network','none','--entrypoint','node',release['images']['web'],'-p','process.arch']).strip()!='x64':raise ValueError('Docker could not execute the validated linux/amd64 server image')
   if state.get('completed'):engine.remember_successful_release(folder,state['release'])
   engine.render(folder,state,release);state.update(release=release,completed=False,removed=False);engine.write_private(folder/engine.STATE,state);write_receipt(folder,state,daemon,target)
   remove_obsolete_services(engine,state,previous_compose,json.loads((folder/'compose.json').read_text()))
   engine.compose(folder,state,['up','-d','--wait','--wait-timeout','180']);engine.complete(folder,state)
   if target=='local' and state['network']['mode']=='https' and not state['publicHttps']:
    certificate=engine.compose(folder,state,['exec','-T','caddy','cat','/data/caddy/pki/authorities/local/root.crt'])
    if len(certificate)>16384 or '-----BEGIN CERTIFICATE-----' not in certificate:raise ValueError('Local certificate authority is unavailable')
    engine.write_private(folder/'server-origin-ca.pem',certificate)
   write_receipt(folder,state,daemon,target);engine.finish_retention(folder,state,lang)
  return {'ok':True,'action':action,'completed':state['completed'],'installationId':state['installationId'],'origin':state['network']['publicOrigin'],'readiness':state.get('readiness'),'backup':backup_path,'version':state['release']['version'],'sourceCommit':state['release']['commit'],'daemonId':daemon,'configuration':{key:state[key] for key in ('setupMode','publicHttps','network','turnDomain') if key in state}}

def main():
 try:
  if len(sys.argv)==3 and sys.argv[1]=='--cleanup':
   request=Path(sys.argv[2]);info=request.stat()
   if request.is_symlink() or info.st_uid!=os.geteuid() or stat.S_IMODE(info.st_mode)&0o077:raise ValueError('Invalid retention request')
   data=json.loads(request.read_text())
  else:
   raw=sys.stdin.buffer.read(2*1024*1024+1)
   if len(raw)>2*1024*1024:raise ValueError('Request too large')
   data=json.loads(raw)
  print(json.dumps(run(data)),flush=True);return 0
 except Exception:
  # No exception text: upstream tools may include secrets, environment or private paths.
  print(json.dumps({'ok':False,'error':'Setup did not complete. Existing data and verified backups were retained. Check prerequisites, ownership and the selected installation.'}),flush=True);return 1
if __name__=='__main__':sys.exit(main())
