#!/usr/bin/env python3
"""Desktop lifecycle driver. Reads one private JSON request on stdin; never accepts credentials in argv."""
import base64,contextlib,copy,socket,itertools,hashlib,importlib.util,json,os,plistlib,re,shutil,stat,subprocess,sys,tempfile,time,types,uuid
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
 info=folder.lstat()
 if not stat.S_ISDIR(info.st_mode) or info.st_uid!=os.geteuid():raise ValueError('Installation folder must be owned by this user with private permissions (0700)')
 if create and stat.S_IMODE(info.st_mode)&0o077:
  # Native folder pickers create ordinary 0755 directories. Only an empty,
  # current-user directory may be made private; existing contents and owned
  # installation permissions are never silently changed.
  descriptor=os.open(folder,os.O_RDONLY|os.O_DIRECTORY|os.O_NOFOLLOW)
  try:
   opened=os.fstat(descriptor);current=folder.lstat()
   if (opened.st_dev,opened.st_ino)!=(info.st_dev,info.st_ino) or (current.st_dev,current.st_ino)!=(opened.st_dev,opened.st_ino) or not stat.S_ISDIR(opened.st_mode) or opened.st_uid!=os.geteuid() or current.st_uid!=opened.st_uid or stat.S_IMODE(opened.st_mode)!=stat.S_IMODE(info.st_mode) or os.listdir(descriptor):raise ValueError('Selected installation folder changed or is not empty')
   # Recheck through the held descriptor immediately before the permission write.
   current=folder.lstat();held=os.fstat(descriptor)
   if (current.st_dev,current.st_ino)!=(held.st_dev,held.st_ino) or (held.st_dev,held.st_ino)!=(opened.st_dev,opened.st_ino) or held.st_uid!=os.geteuid() or current.st_uid!=held.st_uid or stat.S_IMODE(held.st_mode)!=stat.S_IMODE(info.st_mode) or os.listdir(descriptor):raise ValueError('Selected installation folder changed or is not empty')
   os.fchmod(descriptor,0o700);prepared=os.fstat(descriptor);current=folder.lstat()
   if (current.st_dev,current.st_ino)!=(prepared.st_dev,prepared.st_ino) or prepared.st_uid!=os.geteuid() or stat.S_IMODE(prepared.st_mode)!=0o700:raise ValueError('Selected installation folder changed')
  finally:os.close(descriptor)
  info=folder.lstat()
 if stat.S_IMODE(info.st_mode)&0o077:raise ValueError('Installation folder must be owned by this user with private permissions (0700)')
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
 private_json(folder/RECEIPT,{'owner':OWNER,'installationId':state['installationId'],'project':state.get('project'),'folder':str(folder),'device':str(info.st_dev),'inode':str(info.st_ino),'daemon':daemon,'target':target,'files':files})

def verify_receipt(folder,state,daemon,target):
 marker=folder/RECEIPT
 if marker.is_symlink() or marker.stat().st_size>32768:raise ValueError('Installation receipt changed')
 receipt=json.loads(marker.read_text());info=folder.stat()
 expected={'owner':OWNER,'installationId':state['installationId'],'project':state.get('project'),'folder':str(folder),'device':str(info.st_dev),'inode':str(info.st_ino),'daemon':daemon,'target':target}
 if any(receipt.get(k)!=v for k,v in expected.items()):raise ValueError('Installation identity, folder or Docker daemon changed')
 files=receipt.get('files')
 if set(files or {})!={name for name in CONFIG_FILES if (folder/name).exists()}:raise ValueError('Installation resource list changed')
 if not isinstance(files,dict) or not files or any(name not in CONFIG_FILES for name in files):raise ValueError('Invalid resource ownership receipt')
 for name,hash_value in files.items():
  file=folder/name
  if any(parent.is_symlink() for parent in (file,*file.parents)) or not file.is_file() or checksum(file)!=hash_value:raise ValueError('Installation configuration changed; restore or review before continuing')
 return receipt

def remove_resources(engine,folder,state,erase):
 configuration=json.loads((folder/'compose.json').read_text());project=state['project'];services=configuration['services'];volumes=configuration.get('volumes',{})
 ids=engine.docker(['ps','-aq','--no-trunc','--filter','label=com.docker.compose.project='+project]).split()
 if len(ids)>256:raise ValueError('Too many installation containers to verify safely')
 containers=json.loads(engine.docker(['inspect',*ids])) if ids else []
 if len(containers)!=len(ids) or {item.get('Id') for item in containers}!=set(ids):raise ValueError('Installation container observation was incomplete')
 for container in containers:
  labels=container.get('Config',{}).get('Labels',{})
  if labels.get('com.docker.compose.project')!=project or labels.get('com.docker.compose.service') not in services or container.get('Config',{}).get('Image')!=services.get(labels.get('com.docker.compose.service'),{}).get('image'):raise ValueError('Container ownership changed; no resources removed')
 networks=engine.docker(['network','ls','--quiet','--filter','label=com.docker.compose.project='+project]).split()
 for network in networks:
  info=json.loads(engine.docker(['network','inspect',network]))[0];labels=info.get('Labels',{}) or {}
  if labels.get('com.docker.compose.project')!=project or labels.get('com.docker.compose.network')!='default' or any(container not in ids for container in info.get('Containers',{})):raise ValueError('Network ownership changed; no resources removed')
 names=[]
 if erase:
  for logical,volume in volumes.items():
   name=volume.get('name',project+'_'+logical);items=json.loads(engine.docker(['volume','ls','--filter','name=^'+re.escape(name)+'$','--format','{{json .}}']) or 'null')
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
  try:result=subprocess.run([executable,'--context',context,*args],cwd=folder,input=stdin.encode() if stdin is not None else None,stdout=output or subprocess.PIPE,stderr=subprocess.PIPE,env=environment,timeout=timeout or (30 if data.get('action')=='discover' else 1800),check=False)
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
 if result.get('importedFrom'):result['legacyConfig']=False
 return result

def network_extensions(engine,target):
 original_render=engine.render;original_load=engine.load_images;original_probe=engine.probe_origin;original_complete=engine.complete;original_state=engine.load_state
 def state_loader(folder):
  try:return original_state(folder)
  except ValueError:
   state=bounded_json(folder/engine.STATE)
   if target!='ssh' or state.get('owner')!=engine.OWNER or state.get('importedFrom')!='castlink-windows-remote-v1' or not re.fullmatch(r'[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}',state.get('installationId','')) or state.get('project')!='castlink-easy-'+state['installationId'].replace('-',''):raise ValueError('Invalid imported installation identity') from None
   engine.validate_config(state);return state
 def render(folder,state,release):
  validate_turn(state,release,target)
  if state.get('legacyConfig') is True:
   configuration=bounded_json(folder/'compose.json')
   for name,service in configuration['services'].items():service['image']=release['images']['web' if name=='presentation-converter' else 'turntls' if name=='turn-tls' else name]
   engine.write_private(folder/'compose.json',configuration);return
  original_render(folder,state,release)
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
  source=engine.READINESS_JS;adjusted=copy.deepcopy(state)
  if state.get('legacyConfig'):adjusted['network'].update(httpPort=80,httpsPort=443)
  if state.get('turnDomain'):engine.READINESS_JS=source.replace("hostname:'caddy'","hostname:'turn-tls'")
  try:return original_probe(folder,adjusted)
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
 engine.load_state=state_loader;engine.render=render;engine.load_images=load;engine.probe_origin=probe;engine.complete=complete


def discover_installations(engine,daemon,target):
 # Labels locate candidates. Only a matching receipt proves ownership.
 ids=engine.docker(['ps','-aq','--no-trunc','--filter','label=com.docker.compose.project']).split()
 containers=json.loads(engine.docker(['inspect',*ids])) if ids else [];folders=set()
 fixed=Path('/opt/castlink')
 if target=='ssh' and fixed.is_dir() and not fixed.is_symlink():
  for child in itertools.islice(fixed.iterdir(),64):
   if child.is_dir() and not child.is_symlink() and (child/RECEIPT).is_file():folders.add(str(child))
 if target=='ssh' and WINDOWS_ROOT.is_dir() and not WINDOWS_ROOT.is_symlink():
  for child in itertools.islice(WINDOWS_ROOT.iterdir(),256):
   if re.fullmatch(r'castlink-easy-[a-f0-9]{32}',child.name) and child.is_dir() and not child.is_symlink():folders.add(str(child))
 for container in containers[:256]:
  labels=container.get('Config',{}).get('Labels',{});folder=labels.get('com.docker.compose.project.working_dir')
  if isinstance(folder,str) and Path(folder).is_absolute():folders.add(folder)
 result=[]
 for value in sorted(folders)[:64]:
  try:
   folder=validate_folder(Path(value));compatibility=None
   if target=='ssh' and not (folder/RECEIPT).exists():state=windows_preflight(engine,folder,daemon)['state'];compatibility='windows-remote-v1'
   else:state=engine.load_state(folder);verify_receipt(folder,state,daemon,target)
   result.append({'folder':str(folder),'installationId':state['installationId'],'origin':state['network']['publicOrigin'],'completed':state.get('completed') is True,'version':state['release']['version'],'sourceCommit':state['release']['commit'],'daemonId':daemon,'configuration':{key:state[key] for key in ('setupMode','publicHttps','network','turnDomain') if key in state},'compatibility':compatibility})
  except (ValueError,OSError,KeyError,TypeError):continue
 return result

WINDOWS_ROOT=Path('/opt')
SUPPORTED_WINDOWS_VERSIONS={'1.0.0-rc.9'}
class CompatibilityError(ValueError):
 pass

def bounded_json(file,limit=1024*1024):
 if any(parent.is_symlink() for parent in (file,*file.parents)) or not file.is_file() or file.stat().st_size>limit:raise CompatibilityError('Windows layout unsupported')
 return json.loads(file.read_text(encoding='utf-8-sig'))

def private_env(file):
 if any(parent.is_symlink() for parent in (file,*file.parents)) or not file.is_file() or file.stat().st_size>65536:raise CompatibilityError('Windows layout unsupported')
 values={}
 for line in file.read_text(encoding='utf-8-sig').splitlines():
  if not line:continue
  key,separator,value=line.partition('=')
  if not separator or not re.fullmatch(r'[A-Z][A-Z0-9_]*',key) or key in values or '\0' in value:raise CompatibilityError('Windows layout unsupported')
  values[key]=value
 return values

def parse_published(value):
 if not isinstance(value,str):raise CompatibilityError('Windows layout unsupported')
 match=re.fullmatch(r'(?:(\d+\.\d+\.\d+\.\d+):)?([0-9]{1,5}):([0-9]{1,5})(?:/tcp)?',value)
 if not match:raise CompatibilityError('Windows layout unsupported')
 return match[1] or '0.0.0.0',int(match[2]),int(match[3])

def windows_caddy(state,advanced=False):
 n=state['network'];host=__import__('urllib.parse',fromlist=['urlsplit']).urlsplit(n['publicOrigin']).hostname
 if state.get('turnDomain'):return turn_caddy(state)
 is_ip=bool(re.fullmatch(r'\d+\.\d+\.\d+\.\d+',host));tls=[]
 if not state['publicHttps']:tls=['tls internal']
 elif is_ip:tls=['tls {','issuer acme {','dir https://acme-v02.api.letsencrypt.org/directory','profile shortlived','}','}']
 global_lines=['{','admin off'];headers=[];sanitize=[];redirect=[]
 if advanced:
  global_lines.append('auto_https disable_redirects')
  if n['mode']=='proxy':
   sources=' '.join(n['trustedProxies']);global_lines.extend(['servers {','trusted_proxies static '+sources,'trusted_proxies_strict','client_ip_headers X-Forwarded-For','}'])
   sanitize=['@untrusted not remote_ip '+sources,*['request_header @untrusted -'+value for value in ['X-Forwarded-Proto','X-Forwarded-Host','X-Forwarded-For','X-Real-IP','Forwarded']],'vars proxy_proto {scheme}','vars proxy_host {http.request.hostport}','@forwardedProto header X-Forwarded-Proto https','vars @forwardedProto proxy_proto https','@forwardedHost header X-Forwarded-Host *','vars @forwardedHost proxy_host {http.request.header.X-Forwarded-Host}']
   headers=['header_up X-Forwarded-Proto {http.vars.proxy_proto}','header_up X-Forwarded-Host {http.vars.proxy_host}','header_up X-Forwarded-For {client_ip}']
  if n['mode']=='https' and (not state['publicHttps'] or is_ip):
   if not state['publicHttps']:global_lines.append('skip_install_trust')
   global_lines.append('default_sni '+host)
  if n['mode']=='https' and state['publicHttps']:redirect=['http://:80 {','redir '+n['publicOrigin']+'{uri} permanent','}']
 else:
  if not state['publicHttps']:global_lines.extend(['auto_https disable_redirects','skip_install_trust'])
  if not state['publicHttps'] or is_ip:global_lines.append('default_sni '+host)
 global_lines.append('}');site=('https://'+host) if n['mode']=='https' else 'http://:80'
 lines=[*global_lines,site+' {',*tls]
 if advanced:lines.extend(['route {',*sanitize])
 lines.extend(['@rtc path /rtc /rtc/*','route @rtc {','forward_auth web:3000 {','uri /api/media-admission','header_up -Upgrade','header_up -Connection',*headers,'}'])
 if advanced:lines.extend(['reverse_proxy livekit:7880 {',*headers,'}'])
 else:lines.append('reverse_proxy livekit:7880')
 lines.append('}')
 if advanced:lines.extend(['reverse_proxy web:3000 {',*headers,'}','}'])
 else:lines.append('reverse_proxy web:3000')
 lines.extend(['}',*redirect]);return '\n'.join(lines)+'\n'

def normalized_caddy(value):return '\n'.join(line.strip() for line in value.replace('\r\n','\n').splitlines() if line.strip())

def windows_expected_compose(state,release,converter=True):
 n=state['network'];project=state['project'];media_binding='127.0.0.1:' if n['mediaIp']=='127.0.0.1' else '';binding='' if n['bindAddress']=='0.0.0.0' else n['bindAddress']+':'
 media_ports=[media_binding+str(n[key])+':'+str(n[key])+'/'+protocol for key,protocol in [('iceTcpPort','tcp'),('iceUdpPort','udp'),('turnUdpPort','udp')]]+[media_binding+str(n['relayPortStart'])+'-'+str(n['relayPortEnd'])+':'+str(n['relayPortStart'])+'-'+str(n['relayPortEnd'])+'/udp']
 services={'postgres':{'env_file':['postgres.env'],'volumes':['postgres-data:/var/lib/postgresql/data'],'healthcheck':{'test':['CMD-SHELL','pg_isready -U castlink -d castlink'],'interval':'5s','timeout':'5s','retries':24}},'web':{'env_file':['web.env'],'volumes':['web-data:/data','converter-socket:/run/castlink-converter:ro'] if converter else ['web-data:/data'],'depends_on':{'postgres':{'condition':'service_healthy'}}},'livekit':{'command':['--config','/etc/livekit.yaml'],'volumes':['./livekit.json:/etc/livekit.yaml:ro'],'ports':media_ports},'caddy':{'volumes':['./Caddyfile:/etc/caddy/Caddyfile:ro','caddy-data:/data','caddy-config:/config'],'ports':[binding+str(n['httpsPort'])+':443']+([binding+str(n['httpPort'])+':80'] if state['publicHttps'] else []) if n['mode']=='https' else [binding+str(n['httpPort'])+':80'],'depends_on':['web','livekit']}}
 if converter:services['presentation-converter']={'command':['python3','/app/scripts/presentation-converter/server.py'],'init':True,'user':'10001:10001','read_only':True,'network_mode':'none','cap_drop':['ALL'],'security_opt':['no-new-privileges:true'],'volumes':['converter-socket:/run/castlink-converter','converter-work:/tmp'],'mem_limit':'2g','pids_limit':128,'cpus':1}
 for name,service in services.items():service.update(image=release['images']['web' if name=='presentation-converter' else name],platform='linux/amd64',restart='unless-stopped')
 if state.get('turnDomain'):
  services['caddy']['ports']=['80:80'];services['turn-tls']={'image':release['images']['turntls'],'platform':'linux/amd64','restart':'unless-stopped','environment':{'CASTLINK_TURN_HOST':state['turnDomain']},'volumes':['caddy-data:/data:ro'],'ports':['443:443'],'depends_on':['caddy','livekit'],'healthcheck':{'test':['CMD','/usr/local/bin/castlink-turn-tls','health'],'interval':'10s','timeout':'5s','retries':24,'start_period':'30s'}}
 names=['postgres-data','web-data','caddy-data','caddy-config']+(['converter-socket','converter-work'] if converter else [])
 return {'name':project,'services':services,'volumes':{name:{} for name in names}}

WINDOWS_READY_JS=r"""const fs=require('node:fs'),http=require('node:http');const r=JSON.parse(fs.readFileSync(0,'utf8'));const q=http.get({hostname:'127.0.0.1',port:3000,path:'/api/setup',headers:{origin:'http://127.0.0.1:3000',host:'127.0.0.1:3000','x-castlink-setup-token':process.env.CASTLINK_SETUP_TOKEN},timeout:10000},s=>{let text='';s.on('data',c=>{text+=c;if(text.length>65536)q.destroy()});s.on('end',async()=>{let pool;try{if(s.statusCode!==200||JSON.parse(text).needsSetup!==false)throw Error();const {createRequire}=require('node:module');const {Pool}=createRequire('/app/apps/web/package.json')('pg');pool=new Pool({connectionString:process.env.DATABASE_URL,max:1,connectionTimeoutMillis:3000,statement_timeout:5000});const rows=await pool.query('SELECT installation_id::text,node_id,migrations_verified,seed_verified FROM public.castlink_setup_bootstrap');if(rows.rowCount!==1||rows.rows[0].installation_id!==r.installationId||rows.rows[0].node_id!==r.nodeId||rows.rows[0].migrations_verified!==true||rows.rows[0].seed_verified!==true)throw Error();console.log('CASTLINK_WINDOWS_READY')}catch{process.exitCode=1}finally{await pool?.end()}})});q.on('error',()=>{process.exitCode=1});q.on('timeout',()=>q.destroy());"""

def verified_windows_containers(folder,compose,image_ids,ids,containers):
 if len(ids)>256 or len(containers)!=len(ids) or {value.get('Id') for value in containers}!=set(ids):raise CompatibilityError('Windows layout unsupported')
 running=set();service_ids={}
 for item in containers:
  labels=item.get('Config',{}).get('Labels',{});service=labels.get('com.docker.compose.service');configuration=compose['services'].get(service)
  if not configuration or service in service_ids or labels.get('com.docker.compose.project')!=compose['name'] or item.get('Config',{}).get('Image')!=configuration['image'] or item.get('Image')!=image_ids.get(configuration['image']):raise CompatibilityError('Windows layout unsupported')
  expected=[]
  for value in configuration.get('volumes',[]):
   parts=value.split(':');source,destination=parts[:2];rw=parts[2:]!=['ro']
   expected.append(('bind',str(folder/source[2:]),destination,rw) if source.startswith('./') else ('volume',compose['name']+'_'+source,destination,rw))
  observed=[]
  for mount in item.get('Mounts',[]):
   if type(mount.get('RW')) is not bool or mount.get('Type') not in ('volume','bind'):raise CompatibilityError('Windows layout unsupported')
   observed.append((mount['Type'],mount.get('Name') if mount['Type']=='volume' else mount.get('Source'),mount.get('Destination'),mount['RW']))
  if len(observed)!=len(expected) or set(observed)!=set(expected):raise CompatibilityError('Windows layout unsupported')
  service_ids[service]=item['Id']
  if item.get('State',{}).get('Running') is True:running.add(service)
 return running,service_ids

def windows_preflight(engine,folder,daemon):
 try:
  folder=validate_folder(folder)
  if folder.parent!=WINDOWS_ROOT or not re.fullmatch(r'castlink-easy-[a-f0-9]{32}',folder.name):raise ValueError()
  project=folder.name;iid=str(uuid.UUID(hex=project[len('castlink-easy-'):]))
  owned=bounded_json(folder/'.castlink-owned.json');retention=bounded_json(folder/'.castlink-retention.json');release=bounded_json(folder/'payload/release.json');compose=bounded_json(folder/'compose.json');lk=bounded_json(folder/'livekit.json');web=private_env(folder/'web.env');pg=private_env(folder/'postgres.env')
  if owned.get('schemaVersion')!=1 or owned.get('installationId')!=iid or not isinstance(owned.get('folder'),str) or not re.match(r'^(?:[A-Za-z]:[\\/]|\\\\)',owned['folder']):raise ValueError()
  if retention.get('schemaVersion')!=1 or retention.get('owner')!='castlink-windows-retention-v1' or retention.get('installationId')!=iid or retention.get('folder')!=str(folder) or retention.get('daemonId')!=daemon:raise ValueError()
  if release.get('schemaVersion')!=1 or release.get('track')!='linux' or release.get('version') not in SUPPORTED_WINDOWS_VERSIONS or not re.fullmatch(r'[a-f0-9]{40}',release.get('commit','')) or release.get('imageArchive')!='images.tar.gz' or not re.fullmatch(r'[a-f0-9]{64}',release.get('imageArchiveSha256','')):raise ValueError()
  if set(compose)!={'name','services','volumes'} or compose['name']!=project or not isinstance(compose['services'],dict) or not isinstance(compose['volumes'],dict):raise ValueError()
  expected_services={'web','postgres','livekit','caddy','presentation-converter'};turn=compose['services'].get('turn-tls')
  if turn:expected_services.add('turn-tls')
  if set(compose['services'])!=expected_services:raise ValueError()
  for name in ('web','postgres','livekit','caddy',*(['turntls'] if turn else [])):
   if release.get('images',{}).get(name)!='castlink-easy-'+name+':'+release['commit'] or not re.fullmatch(r'sha256:[a-f0-9]{64}',release.get('imageIdentities',{}).get(name,'')):raise ValueError()
  history=retention.get('successfulImageSets');images=retention.get('images')
  if not isinstance(history,list) or not 1<=len(history)<=2 or not isinstance(images,list):raise ValueError()
  if set(release.get('images',{})) not in ({'web','postgres','livekit','caddy'},{'web','postgres','livekit','caddy','turntls'}):raise ValueError()
  converted_history=[]
  for record in history:
   if not isinstance(record,dict) or set(record)!={'commit','images'} or not re.fullmatch(r'[a-f0-9]{40}',record.get('commit','')) or not isinstance(record.get('images'),list) or not 1<=len(record['images'])<=5 or len(set(record['images']))!=len(record['images']):raise ValueError()
   translated={}
   for tag in record['images']:
    match=re.fullmatch(r'castlink-easy-(web|postgres|livekit|caddy|turntls):'+record['commit'],tag)
    if not match or match[1] in translated:raise ValueError()
    translated[match[1]]=tag
   converted_history.append({'commit':record['commit'],'images':translated})
  for entry in images:
   if not isinstance(entry,dict) or not re.fullmatch(r'castlink-easy-(web|postgres|livekit|caddy|turntls):[a-f0-9]{40}',entry.get('tag','')) or not re.fullmatch(r'sha256:[a-f0-9]{64}',entry.get('id','')) or type(entry.get('preexisting')) is not bool:raise ValueError()
  image_ids={};expected_tags=set(release['images'].values())
  if not any(entry.get('commit')==release['commit'] and set(entry.get('images',[]))==expected_tags for entry in history):raise ValueError()
  archives=retention.get('archives',[])
  if not any(entry.get('path')=='payload/images.tar.gz' and entry.get('sha256')==release['imageArchiveSha256'] for entry in archives):raise ValueError()
  for name,tag in release['images'].items():
   if not re.fullmatch(r'castlink-easy-(web|postgres|livekit|caddy|turntls):[a-f0-9]{40}',tag):raise ValueError()
   entries=[entry for entry in images if entry.get('tag')==tag];original=[entry for entry in owned.get('images',[]) if entry.get('tag')==tag]
   if len(entries)!=1 or len(original)!=1 or entries[0].get('id')!=original[0].get('id') or type(entries[0].get('preexisting')) is not bool or entries[0].get('preexisting')!=original[0].get('preexisting') or not re.fullmatch(r'sha256:[a-f0-9]{64}',entries[0].get('id','')):raise ValueError()
   actual=json.loads(engine.docker(['image','inspect','--format','{{json .}}',tag]))
   if actual.get('Id')!=entries[0]['id'] or tag not in actual.get('RepoTags',[]) or actual.get('Os')!='linux' or actual.get('Architecture')!='amd64':raise ValueError()
   image_ids[tag]=actual['Id']
  secrets={'password':pg.get('POSTGRES_PASSWORD'),'livekitKey':web.get('LIVEKIT_API_KEY'),'livekitSecret':web.get('LIVEKIT_API_SECRET'),'session':web.get('CASTLINK_SESSION_SECRET'),'encryption':web.get('CASTLINK_DATA_ENCRYPTION_KEY'),'setupToken':web.get('CASTLINK_SETUP_TOKEN'),'nodeSecret':web.get('CASTLINK_NODE_SECRET')}
  if any(not isinstance(value,str) or not re.fullmatch(r'lk_[a-f0-9]{32}' if key=='livekitKey' else r'[a-f0-9]{64}',value) for key,value in secrets.items()):raise ValueError()
  if pg!={'POSTGRES_USER':'castlink','POSTGRES_DB':'castlink','POSTGRES_PASSWORD':secrets['password']}:raise ValueError()
  node='srv-'+iid.replace('-','');origin=web.get('STUDIOLINK_TRANSFER_ORIGIN','');caddy_file=folder/'Caddyfile'
  if caddy_file.is_symlink() or caddy_file.stat().st_size>65536:raise ValueError()
  caddy=caddy_file.read_text(encoding='utf-8-sig');public='tls internal' not in caddy
  bindings=[parse_published(value) for value in compose['services']['caddy'].get('ports',[])];tls=turn is not None or any(value[2]==443 for value in bindings);mode='https' if tls else ('http' if origin.startswith('http://') else 'proxy')
  if not bindings or len({value[0] for value in bindings})!=1 or len({value[2] for value in bindings})!=len(bindings):raise ValueError()
  ports={value[2]:value[1] for value in bindings};trusted=[]
  if mode=='proxy':
   matches=re.findall(r'(?m)^\s*trusted_proxies static ([^\r\n]+)$',caddy)
   if len(matches)!=1:raise ValueError()
   trusted=matches[0].split()
  net={'mode':mode,'publicOrigin':origin,'mediaIp':lk.get('rtc',{}).get('node_ip'),'bindAddress':bindings[0][0],'httpPort':ports.get(80,80),'httpsPort':443 if turn else ports.get(443,443),'iceTcpPort':lk.get('rtc',{}).get('tcp_port'),'iceUdpPort':lk.get('rtc',{}).get('udp_port'),'turnUdpPort':lk.get('turn',{}).get('udp_port'),'relayPortStart':lk.get('turn',{}).get('relay_range_start'),'relayPortEnd':lk.get('turn',{}).get('relay_range_end'),'trustedProxies':trusted}
  config=engine.validate_config({'setupMode':'advanced','publicHttps':public if mode=='https' else False,'network':net});domain=turn.get('environment',{}).get('CASTLINK_TURN_HOST','') if turn else ''
  state={**config,'schemaVersion':1,'owner':engine.OWNER,'installationId':iid,'nodeId':node,'project':project,'databasePhase':'seed','completed':False,'release':release,'turnDomain':domain,'importedFrom':'castlink-windows-remote-v1','legacyConfig':True}
  if windows_expected_compose(state,release)!=compose:raise ValueError()
  candidates=[windows_caddy(state,False),windows_caddy(state,True)]
  if normalized_caddy(caddy) not in [normalized_caddy(value) for value in candidates]:raise ValueError()
  if normalized_caddy(caddy)==normalized_caddy(candidates[0]):state['setupMode']='quick'
  if turn:validate_turn(state,release,'ssh',resolve=lambda _:{net['mediaIp']})
  expected_lk={'port':7880,'log_level':'info','rtc':{'tcp_port':net['iceTcpPort'],'udp_port':net['iceUdpPort'],'use_external_ip':False,'node_ip':net['mediaIp'],'enable_loopback_candidate':net['mediaIp']=='127.0.0.1'},'keys':{secrets['livekitKey']:secrets['livekitSecret']},'turn':{'enabled':True,'udp_port':net['turnUdpPort'],'relay_range_start':net['relayPortStart'],'relay_range_end':net['relayPortEnd'],'allow_restricted_peer_cidrs':[net['mediaIp']+'/32']}}
  if turn:expected_lk['turn'].update(domain=domain,tls_port=5349,external_tls=True,proxy_protocol=True,proxy_protocol_trusted_cidrs=['10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'])
  if lk!=expected_lk:raise ValueError()
  expected_env={'NODE_ENV':'production','CASTLINK_DEPLOYMENT_MODEL':'self-hosted','CASTLINK_STORAGE_BACKEND':'json','DATABASE_URL':'postgresql://castlink:'+secrets['password']+'@postgres:5432/castlink','LIVEKIT_SERVER_URL':'http://livekit:7880','LIVEKIT_API_KEY':secrets['livekitKey'],'LIVEKIT_API_SECRET':secrets['livekitSecret'],'CASTLINK_GUEST_RELAY_ENABLED':'1','CASTLINK_TURN_TRANSPORT':'tls443' if turn else 'udp','CASTLINK_SESSION_SECRET':secrets['session'],'CASTLINK_DATA_ENCRYPTION_KEY':secrets['encryption'],'CASTLINK_SETUP_TOKEN':secrets['setupToken'],'STUDIOLINK_DATA_DIR':'/data','STUDIOLINK_INSTALLATION_ID':iid,'STUDIOLINK_DEFAULT_STUDIO_ID':'studio-default','CASTLINK_NODE_ID':node,'CASTLINK_SERVER_ID':node,'CASTLINK_NODE_SECRET':secrets['nodeSecret'],'CASTLINK_NODE_TYPE':'self-hosted','CASTLINK_ENFORCE_NODE_ADMISSION':'1','CASTLINK_LICENSE_ENFORCE':'0','CASTLINK_CONTROL_PLANE_URL':'','CASTLINK_LICENSE_SERVICE_URL':'','STUDIOLINK_TRANSFER_ORIGIN':origin,'STUDIOLINK_TRANSFER_SERVER_ID':node}
  creation_hash=web.get('ROOM_CREATION_PASSWORD_SHA256','')
  if creation_hash and not re.fullmatch(r'[a-f0-9]{64}',creation_hash):raise ValueError()
  if 'ROOM_CREATION_PASSWORD_SHA256' in web:expected_env['ROOM_CREATION_PASSWORD_SHA256']=creation_hash
  if web!=expected_env:raise ValueError()
  if creation_hash:state['roomCreationPasswordHash']=creation_hash
  ids=engine.docker(['ps','-aq','--no-trunc','--filter','label=com.docker.compose.project='+project]).split();containers=json.loads(engine.docker(['inspect',*ids])) if ids else []
  running,service_ids=verified_windows_containers(folder,compose,image_ids,ids,containers)
  volumes={}
  for logical in compose['volumes']:
   name=project+'_'+logical;observed=json.loads(engine.docker(['volume','inspect',name]))
   if len(observed)!=1 or observed[0].get('Name')!=name or observed[0].get('Labels',{}).get('com.docker.compose.project')!=project or observed[0].get('Labels',{}).get('com.docker.compose.volume')!=logical:raise ValueError()
   if any(value not in ids for value in engine.docker(['ps','-aq','--no-trunc','--filter','volume='+name]).split()):raise ValueError()
   volumes[logical]=name
  networks=engine.docker(['network','ls','--quiet','--filter','label=com.docker.compose.project='+project]).split()
  for network in networks:
   value=json.loads(engine.docker(['network','inspect',network]))[0]
   if value.get('Name')!=project+'_default' or value.get('Labels',{}).get('com.docker.compose.project')!=project or value.get('Labels',{}).get('com.docker.compose.network')!='default' or any(value not in ids for value in value.get('Containers',{})):raise ValueError()
  scheduler=retention.get('scheduler')
  if not isinstance(scheduler,list) or len(scheduler) not in (0,2):raise ValueError()
  units=[]
  for entry in scheduler:
   if entry.get('name') not in ('castlink-windows-retention-'+iid.replace('-','')+'.service','castlink-windows-retention-'+iid.replace('-','')+'.timer') or not re.fullmatch(r'[a-f0-9]{64}',entry.get('sha256','')):raise ValueError()
   file=engine.SYSTEMD_UNITS/entry['name']
   if file.is_symlink() or file.exists() and checksum(file)!=entry['sha256']:raise ValueError()
   units.append({'file':file,'sha256':entry['sha256']})
  if len({entry['file'].name for entry in units})!=len(units):raise ValueError()
  if {'web','postgres'}.issubset(running):
   if engine.compose(folder,state,['exec','-T','web','node','-e',WINDOWS_READY_JS],stdin=json.dumps({'installationId':iid,'nodeId':node})).strip()!='CASTLINK_WINDOWS_READY':raise ValueError()
   state['completed']=True
  return {'state':state,'secrets':secrets,'compose':compose,'owned':owned,'retention':retention,'volumes':volumes,'running':running,'units':units,'history':converted_history,'imageIds':image_ids,'serviceIds':service_ids}
 except CompatibilityError:raise
 except (ValueError,OSError,KeyError,TypeError,IndexError):raise CompatibilityError('Windows layout unsupported') from None

def backup_windows(engine,folder,state,plan):
 ids=list(plan['serviceIds'].values());containers=json.loads(engine.docker(['inspect',*ids])) if ids else []
 running,_=verified_windows_containers(folder,plan['compose'],plan['imageIds'],ids,containers)
 directory=folder/('.castlink-adoption-backup-'+uuid.uuid4().hex);directory.mkdir(mode=0o700);files=directory/'files';files.mkdir(mode=0o700)
 sources=['compose.json','postgres.env','web.env','livekit.json','Caddyfile','.castlink-owned.json','.castlink-retention.json','payload/release.json']
 for optional in ['.castlink-install.json','.castlink-server.json']:
  if (folder/optional).is_file():sources.append(optional)
 for name in sources:
  target=files/name;target.parent.mkdir(parents=True,exist_ok=True,mode=0o700);shutil.copyfile(folder/name,target);os.chmod(target,0o600)
 for unit in plan['units']:
  if unit['file'].exists():shutil.copyfile(unit['file'],files/unit['file'].name);os.chmod(files/unit['file'].name,0o600)
 outputs=[];formats={}
 for service,logical in [('postgres','postgres-data'),('web','web-data')]:
  name='postgres.dump' if service=='postgres' and service in running else logical+'.tar';output_file=directory/name
  with output_file.open('xb') as output:
   os.chmod(output_file,0o600)
   if service in running:
    command=['exec','-T','postgres','pg_dump','-U','castlink','-d','castlink','-Fc'] if service=='postgres' else ['exec','-T','web','tar','-C','/data','-cf','-','.']
    engine.compose(folder,state,command,output=output);formats[service]='pg_dump' if service=='postgres' else 'volume-tar'
   else:
    # Only stopped services use a raw volume snapshot. A running PostgreSQL
    # service always uses pg_dump, independent of the web service state.
    engine.docker(['run','--rm','--platform','linux/amd64','--network','none','--read-only','--cap-drop','ALL','--cap-add','DAC_READ_SEARCH','--security-opt','no-new-privileges','--mount','type=volume,source='+plan['volumes'][logical]+',target=/source,readonly','--entrypoint','tar',plan['imageIds'][state['release']['images']['web']],'-C','/source','-cf','-','.'],output=output);formats[service]='volume-tar'
  outputs.append(output_file)
 if any(file.stat().st_size==0 for file in outputs):raise ValueError('Adoption backup was not completed')
 hashes={str(file.relative_to(directory)):checksum(file) for file in directory.rglob('*') if file.is_file()}
 manifest={'owner':'castlink-windows-adoption-backup-v1','installationId':state['installationId'],'folder':str(folder),'files':hashes,'formats':formats};private_json(directory/'manifest.json',manifest)
 if any(checksum(directory/name)!=value for name,value in hashes.items()):raise ValueError('Adoption backup did not verify')
 return directory

def adopt_windows(engine,folder,daemon,plan,data):
 state=copy.deepcopy(plan['state']);history=copy.deepcopy(plan['history']);backup=backup_windows(engine,folder,state,plan)
 # Re-check every scheduler hash before disabling either owned unit.
 for entry in plan['units']:
  if entry['file'].is_symlink() or entry['file'].exists() and checksum(entry['file'])!=entry['sha256']:raise CompatibilityError('Windows layout unsupported')
 if plan['units']:
  timer='castlink-windows-retention-'+state['installationId'].replace('-','')+'.timer';engine.systemctl(['disable','--now',timer])
  for entry in plan['units']:
   if entry['file'].exists():entry['file'].unlink()
  engine.systemctl(['daemon-reload'])
 private_json(folder/'.castlink-adoption.json',{'owner':'castlink-windows-adoption-v1','installationId':state['installationId'],'backup':backup.name,'manifestSha256':checksum(backup/'manifest.json')})
 engine.write_private(folder/'secrets.json',plan['secrets']);engine.write_private(folder/engine.STATE,state)
 # Existing images marked preexisting retain their original non-owned status.
 engine.write_private(folder/engine.IMAGE_RECEIPT,{'schemaVersion':1,'images':[{'tag':entry['tag'],'id':entry['id']} for entry in plan['retention']['images'] if not entry['preexisting']],'parents':[],'successfulReleases':history})
 write_receipt(folder,state,daemon,'ssh');return state

def remote_scheduler(engine,folder,state,data,daemon,unregister=False):
 name='castlink-macos-retention-'+state['installationId'];root=folder/'.castlink-runtime';marker=root/'remote-scheduler.json';units_root=engine.SYSTEMD_UNITS
 def quote(value):return '"'+str(value).replace('\\','\\\\').replace('"','\\"').replace('%','%%').replace('$','$$').replace('\n','\\n').replace('\r','\\r')+'"'
 helper=root/'macos-compose-setup.py';request=root/'cleanup.json'
 units={name+'.service':'[Unit]\nDescription=CastLink owned hourly retention\n[Service]\nType=oneshot\nTimeoutStartSec=5min\nExecStart='+' '.join(quote(value) for value in [sys.executable,helper,'--cleanup',request])+'\n',name+'.timer':'[Unit]\nDescription=CastLink owned hourly retention\n[Timer]\nOnBootSec=15min\nOnUnitActiveSec=1h\nPersistent=true\n[Install]\nWantedBy=timers.target\n'}
 if root.is_symlink() or marker.is_symlink() or units_root.is_symlink():raise ValueError('Remote retention ownership changed')
 previous=bounded_json(marker,32768) if marker.exists() else None
 if previous:
  if previous.get('owner')!=OWNER or previous.get('installationId')!=state['installationId'] or previous.get('folder')!=str(folder) or previous.get('daemon')!=daemon:raise ValueError('Remote retention ownership changed')
  for filename,expected in previous.get('helpers',{}).items():
   if filename not in ('macos-compose-setup.py','cleanup.json') or (root/filename).is_symlink() or not (root/filename).is_file() or checksum(root/filename)!=expected:raise ValueError('Remote retention helper changed')
 for filename in units:
  file=units_root/filename
  if file.is_symlink() or file.exists() and (not previous or checksum(file)!=previous.get('units',{}).get(filename)):raise ValueError('Remote retention unit changed')
 if unregister:
  if not previous:return
  engine.systemctl(['disable','--now',name+'.timer'])
  for filename in units:
   file=units_root/filename
   if file.exists():file.unlink()
  engine.systemctl(['daemon-reload'])
  for filename in previous.get('helpers',{}):(root/filename).unlink()
  marker.unlink();return
 root.mkdir(mode=0o700,exist_ok=True)
 if any(file.is_symlink() for file in (helper,request)):raise ValueError('Remote retention helper changed')
 if not previous and (helper.exists() or request.exists()):raise ValueError('Remote retention helper is not owned')
 source=Path(__file__).read_text() if globals().get('__file__') and Path(__file__).is_file() else base64.b64decode(data['backendSource']).decode()
 engine.write_private(helper,source);private_json(request,{'action':'cleanup','target':'ssh','folder':str(folder),'installationId':state['installationId'],'dockerExecutable':data.get('dockerExecutable','/usr/bin/docker'),'dockerContext':data.get('dockerContext','default')})
 for filename,contents in units.items():engine.write_private(units_root/filename,contents)
 private_json(marker,{'owner':OWNER,'installationId':state['installationId'],'folder':str(folder),'daemon':daemon,'helpers':{file.name:checksum(file) for file in (helper,request)},'units':{filename:checksum(units_root/filename) for filename in units}})
 engine.systemctl(['daemon-reload']);engine.systemctl(['enable','--now',name+'.timer']);engine.systemctl(['is-active','--quiet',name+'.timer'])

def run(data):
 validate_request(data);action=data['action'];target=data['target'];lang=data.get('locale','en')
 if target=='local' and sys.platform!='darwin':raise ValueError('Local setup requires macOS')
 if action!='discover':folder=validate_folder(Path(data['folder']),create=action=='install')
 engine=load_engine(data);daemon=bind_docker(engine,data)
 network_extensions(engine,target)
 if action=='discover':return {'ok':True,'action':'discover','installations':discover_installations(engine,daemon,target)}
 engine.cleanup_legacy_backups=lambda f,s:cleanup_mac_backups(engine,f,s)
 legacy=target=='ssh' and action in ('install','update','remove') and not (folder/RECEIPT).exists() and ((folder/'.castlink-owned.json').exists() or folder.name.startswith('castlink-easy-'))
 if legacy:
  planned=windows_preflight(engine,folder,daemon)
  if data.get('installationId') and planned['state']['installationId']!=data['installationId']:raise CompatibilityError('Windows layout unsupported')
  if action=='update' and not planned['state'].get('completed'):raise CompatibilityError('Windows layout unsupported')
 with engine.installation_lock(folder):
  adopted=False
  if legacy:
   planned=windows_preflight(engine,folder,daemon)
   if data.get('installationId') and planned['state']['installationId']!=data['installationId']:raise CompatibilityError('Windows layout unsupported')
   state=adopt_windows(engine,folder,daemon,planned,data);adopted=True
  exists=(folder/engine.STATE).exists();state=engine.load_state(folder) if exists else None
  previous_compose=json.loads((folder/'compose.json').read_text()) if exists and (folder/'compose.json').exists() else {'services':{}}
  if exists:
   verify_receipt(folder,state,daemon,target)
   if data.get('installationId') and data['installationId']!=state['installationId']:raise ValueError('Saved installation identity changed')
  elif action!='install':raise ValueError('No owned installation exists in this folder')
  persist_linux_source(engine,data,folder)
  if target=='local':engine.register_cleanup=lambda f,s:local_scheduler(engine,f,s,data)
  elif state and state.get('importedFrom'):
   engine.register_cleanup=lambda f,s:remote_scheduler(engine,f,s,data,daemon)
   engine.unregister_cleanup=lambda f,s:remote_scheduler(engine,f,s,data,daemon,unregister=True)
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
   if action=='update' and not data.get('reconfigure'):
    if adopted:engine.finish_retention(folder,state,lang)
    return {'ok':True,'action':action,'completed':True,'installationId':state['installationId'],'origin':state['network']['publicOrigin'],'outcome':'current','version':state['release']['version'],'sourceCommit':state['release']['commit'],'daemonId':daemon,'configuration':{key:state[key] for key in ('setupMode','publicHttps','network','turnDomain') if key in state}}
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
 except CompatibilityError:
  print(json.dumps({'ok':False,'errorCode':'WINDOWS_LAYOUT_UNSUPPORTED'}),flush=True);return 1
 except Exception:
  # No exception text: upstream tools may include secrets, environment or private paths.
  print(json.dumps({'ok':False,'error':'Setup did not complete. Existing data and verified backups were retained. Check prerequisites, ownership and the selected installation.'}),flush=True);return 1
if __name__=='__main__':sys.exit(main())
