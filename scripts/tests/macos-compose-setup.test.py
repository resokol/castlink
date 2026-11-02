import importlib.util,json,tempfile,unittest,sys
from pathlib import Path
SPEC=importlib.util.spec_from_file_location('macsetup',Path(__file__).resolve().parents[1]/'macos-compose-setup.py')
class BackendTests(unittest.TestCase):
 def module(self):
  self.assertTrue(Path(SPEC.origin).exists(),'macOS lifecycle backend must exist')
  module=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(module);return module
 def test_owned_receipt_rejects_changed_directory_daemon_or_config(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve();(folder/'compose.json').write_text('{}');state={'installationId':'12345678-1234-4234-9234-123456789abc'}
   m.write_receipt(folder,state,'daemon-one','local');m.verify_receipt(folder,state,'daemon-one','local')
   with self.assertRaises(ValueError):m.verify_receipt(folder,state,'daemon-two','local')
   (folder/'compose.json').write_text('{"changed":true}')
   with self.assertRaises(ValueError):m.verify_receipt(folder,state,'daemon-one','local')
 def test_resource_deletion_proves_all_ownership_before_first_mutation(self):
  m=self.module();calls=[]
  class Engine:
   def docker(self,args,**kwargs):
    calls.append(args)
    if args[:2]==['ps','-aq']:return 'owned foreign'
    if args[0]=='inspect':return json.dumps([{'Id':'owned','Config':{'Labels':{'com.docker.compose.project':'project','com.docker.compose.service':'web'}},'Mounts':[]},{'Id':'foreign','Config':{'Labels':{'com.docker.compose.project':'other','com.docker.compose.service':'web'}},'Mounts':[]}])
    raise AssertionError(args)
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve();(folder/'compose.json').write_text(json.dumps({'services':{'web':{}},'volumes':{}}))
   with self.assertRaises(ValueError):m.remove_resources(Engine(),folder,{'project':'project'},False)
   self.assertFalse(any(c[0] in ['stop','rm','volume','network'] for c in calls))
 def test_remove_confirmation_and_non_private_folder_refused_before_docker(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve();folder.chmod(0o755)
   with self.assertRaises(ValueError):m.validate_folder(folder,create=False)
   with self.assertRaises(ValueError):m.validate_request({'action':'remove','target':'local','folder':tmp})
 def test_turn_tls_requires_remote_public_matching_dns_and_generates_isolated_listener(self):
  m=self.module();config={'setupMode':'advanced','publicHttps':True,'network':{'mode':'https','publicOrigin':'https://site.example.com','mediaIp':'203.0.113.2','bindAddress':'0.0.0.0','httpPort':80,'httpsPort':443,'iceTcpPort':7881,'iceUdpPort':7882,'turnUdpPort':3478,'relayPortStart':30000,'relayPortEnd':30031,'trustedProxies':[]},'turnDomain':'turn.example.com'}
  release={'commit':'a'*40,'images':{'turntls':'castlink-easy-turntls:'+('a'*40)},'imageIdentities':{'turntls':'sha256:'+('b'*64)}}
  with self.assertRaises(ValueError):m.validate_turn(config,release,'local',resolve=lambda host:{'203.0.113.2'})
  with self.assertRaises(ValueError):m.validate_turn(config,release,'ssh',resolve=lambda host:{'203.0.113.3'})
  m.validate_turn(config,release,'ssh',resolve=lambda host:{'203.0.113.2'})
  output=m.turn_caddy(config)
  self.assertIn('https_port 8443',output);self.assertIn('proxy_protocol',output);self.assertIn('turn.example.com',output)
 def test_reconfiguration_preserves_installation_identity_secrets_and_password_hash(self):
  m=self.module();state={'installationId':'fixed','roomCreationPasswordHash':'hash','network':{'mode':'https'},'setupMode':'quick','publicHttps':False,'secrets':'unchanged'}
  class Engine:
   def validate_config(self,value):return value
  result=m.reconfigure(Engine(),state,{'setupMode':'advanced','publicHttps':True,'network':{'mode':'https','publicOrigin':'https://new.example.com'},'turnDomain':''})
  self.assertEqual(result['installationId'],'fixed');self.assertEqual(result['roomCreationPasswordHash'],'hash');self.assertEqual(result['secrets'],'unchanged');self.assertEqual(result['network']['publicOrigin'],'https://new.example.com');self.assertNotIn('publicOrigin',state['network'])
 def test_lifecycle_install_uses_real_renderer_and_readiness_ack_before_completion(self):
  import contextlib
  from unittest.mock import patch
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve()/'install';package=Path(tmp)/'package';package.mkdir();release={'schemaVersion':1,'version':'1.0.0','commit':'a'*40,'images':{name:'castlink-easy-'+name+':'+('a'*40) for name in ['web','postgres','livekit','caddy']},'imageIdentities':{name:'sha256:'+('b'*64) for name in ['web','postgres','livekit','caddy']}}
   engine=m.load_engine({});calls=[];pending={'ready':True}
   def docker(args,**kwargs):
    calls.append(args)
    if args[0]=='run':return 'x64'
    if args[:2]==['image','inspect'] and '{{.Id}}' in args:return 'sha256:'+('b'*64)
    if args[:2]==['image','inspect']:return json.dumps({'Id':'sha256:'+('b'*64),'RepoTags':[args[-1]],'Os':'linux','Architecture':'amd64','Config':{'Labels':{}},'RootFS':{'Layers':[]}})
    if args[0]=='load':return ''
    if args[0]=='compose':
     if 'setup-database-v1.mjs' in ' '.join(args):
      body=json.loads(kwargs['stdin']);return json.dumps({**body,'contract':'castlink-database-v1','migrations':{'schema':True,'hashes':True,'roomVersions':[1,2,3,4,5,6],'controlVersions':[1,2,3,4,5]},'seed':None if body['phase']=='migrations' else {'installations':1,'accounts':1,'organizations':1,'memberships':1,'nodes':1,'studios':1,'rooms':0}})
     if engine.READINESS_JS in args:return 'CASTLINK_ORIGIN_READY' if pending['ready'] else 'started'
     return ''
    raise AssertionError(args)
   engine.docker=docker;engine.register_cleanup=lambda *_:None;engine.cleanup_installation=lambda *_:None;engine.check_updates=lambda _: {'version':'1.0.0'}
   @contextlib.contextmanager
   def downloaded(*_):yield package,release
   engine.downloaded_update=downloaded
   config={'setupMode':'quick','publicHttps':False,'network':{'mode':'http','publicOrigin':'http://127.0.0.1','mediaIp':'127.0.0.1','bindAddress':'127.0.0.1','httpPort':80,'httpsPort':443,'iceTcpPort':7881,'iceUdpPort':7882,'turnUdpPort':3478,'relayPortStart':30000,'relayPortEnd':30031,'trustedProxies':[]}}
   data={'action':'install','target':'ssh','folder':str(folder),'confirmed':True,'config':config,'roomPassword':'fixture-password'}
   with patch.object(m,'load_engine',return_value=engine),patch.object(m,'bind_docker',return_value='daemon-fixture'):result=m.run(data)
   self.assertTrue(result['completed']);state=engine.load_state(folder);self.assertTrue(state['completed']);m.verify_receipt(folder,state,'daemon-fixture','ssh')
   compose=json.loads((folder/'compose.json').read_text());self.assertTrue(all(service['platform']=='linux/amd64' for service in compose['services'].values()));self.assertTrue(any(engine.READINESS_JS in command for command in calls));self.assertNotIn('fixture-password',(folder/engine.STATE).read_text());self.assertEqual((folder/'secrets.json').stat().st_mode&0o777,0o600)
   pending['ready']=False
   with patch.object(m,'load_engine',return_value=engine),patch.object(m,'bind_docker',return_value='daemon-fixture'),patch.object(engine.time,'sleep',return_value=None):
    with self.assertRaises(ValueError):m.run({**data,'roomPassword':'fixture-password'})
   self.assertFalse(engine.load_state(folder)['completed'])
 def test_remove_default_retains_volumes_and_only_removes_verified_containers(self):
  m=self.module();calls=[]
  class Engine:
   def docker(self,args,**kwargs):
    calls.append(args)
    if args[:2]==['ps','-aq']:return 'container-owned'
    if args[0]=='inspect':return json.dumps([{'Id':'container-owned','Config':{'Image':'castlink-web:fixed','Labels':{'com.docker.compose.project':'project','com.docker.compose.service':'web'}},'Mounts':[]}])
    if args[:2]==['network','ls']:return 'network-owned'
    if args[:2]==['network','inspect']:return json.dumps([{'Id':'network-owned','Labels':{'com.docker.compose.project':'project','com.docker.compose.network':'default'},'Containers':{'container-owned':{}}}])
    if args[0] in ('stop','rm') or args[:2]==['network','rm']:return ''
    raise AssertionError(args)
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve();(folder/'compose.json').write_text(json.dumps({'services':{'web':{'image':'castlink-web:fixed'}},'volumes':{'web-data':{'name':'project_web-data'}}}))
   m.remove_resources(Engine(),folder,{'project':'project'},False)
  self.assertIn(['rm','container-owned'],calls);self.assertEqual(calls[-1],['network','rm','network-owned']);self.assertFalse(any(command[0]=='volume' for command in calls))
 def test_discovery_uses_container_labels_only_as_hints_and_requires_owned_receipt(self):
  m=self.module();engine=m.load_engine({})
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve();config={'setupMode':'quick','publicHttps':False,'network':{'mode':'http','publicOrigin':'http://127.0.0.1','mediaIp':'127.0.0.1','bindAddress':'127.0.0.1','httpPort':80,'httpsPort':443,'iceTcpPort':7881,'iceUdpPort':7882,'turnUdpPort':3478,'relayPortStart':30000,'relayPortEnd':30031,'trustedProxies':[]}};state=engine.init_state(folder,config,{'version':'1.0.0','commit':'a'*40})
   def docker(args,**kwargs):return 'container' if args[0]=='ps' else json.dumps([{'Config':{'Labels':{'com.docker.compose.project.working_dir':str(folder)}}}])
   engine.docker=docker
   self.assertEqual(m.discover_installations(engine,'daemon','ssh'),[])
   m.write_receipt(folder,state,'daemon','ssh');self.assertEqual(m.discover_installations(engine,'daemon','ssh')[0]['installationId'],state['installationId'])
   self.assertEqual(m.discover_installations(engine,'different-daemon','ssh'),[])
 def test_disabling_turn_tls_removes_only_proven_obsolete_service_before_reusing_443(self):
  m=self.module();calls=[]
  class Engine:
   def docker(self,args,**kwargs):
    calls.append(args)
    if args[0]=='ps':return 'owned-turn'
    if args[0]=='inspect':return json.dumps([{'Id':'owned-turn','Config':{'Image':'turn:fixed','Labels':{'com.docker.compose.project':'project','com.docker.compose.service':'turn-tls'}}}])
    return ''
  m.remove_obsolete_services(Engine(),{'project':'project'},{'services':{'web':{'image':'web:fixed'},'turn-tls':{'image':'turn:fixed'}}},{'services':{'web':{'image':'web:fixed'}}})
  self.assertEqual(calls[-2:], [['stop','--time','30','owned-turn'],['rm','owned-turn']])
 def test_loading_verified_remote_code_does_not_write_before_the_operation_lock(self):
  import base64
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   source=(Path(SPEC.origin).with_name('linux-compose-setup.py')).read_bytes();data={'action':'install','folder':str(Path(tmp).resolve()),'linuxSource':base64.b64encode(source).decode()}
   engine=m.load_engine(data);self.assertFalse((Path(tmp)/'.castlink-runtime').exists())
   with engine.installation_lock(Path(tmp).resolve()):m.persist_linux_source(engine,data,Path(tmp).resolve())
   self.assertTrue(Path(engine.__file__).is_file())
 def test_backup_retains_ownership_receipt_and_only_latest_intact_verified_copy(self):
  from unittest.mock import patch
  m=self.module();engine=m.load_engine({})
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve();config={'setupMode':'quick','publicHttps':False,'network':{'mode':'http','publicOrigin':'http://127.0.0.1','mediaIp':'127.0.0.1','bindAddress':'127.0.0.1','httpPort':80,'httpsPort':443,'iceTcpPort':7881,'iceUdpPort':7882,'turnUdpPort':3478,'relayPortStart':30000,'relayPortEnd':30031,'trustedProxies':[]}};release={'version':'1.0.0','commit':'a'*40,'images':{name:'castlink-easy-'+name+':'+('a'*40) for name in ['web','postgres','livekit','caddy']}};state=engine.init_state(folder,config,release);engine.render(folder,state,release);m.write_receipt(folder,state,'daemon','ssh')
   engine.compose=lambda *args,**kwargs:kwargs['output'].write(b'fixture-backup')
   with patch.object(m.time,'strftime',return_value='20261101-120000-'):first=Path(m.backup(engine,folder,state))
   with patch.object(m.time,'strftime',return_value='20261102-120000-'):second=Path(m.backup(engine,folder,state))
   self.assertTrue((second/m.RECEIPT).is_file());m.cleanup_mac_backups(engine,folder,state);self.assertFalse(first.exists());self.assertTrue(second.exists())
 def test_turn_tls_origin_probe_uses_the_frontdoor_with_proxy_protocol(self):
  m=self.module();engine=m.load_engine({});seen=[]
  engine.probe_origin=lambda folder,state:seen.append((engine.READINESS_JS,state['network']['httpsPort']))
  m.network_extensions(engine,'ssh');engine.probe_origin(Path('/unused'),{'turnDomain':'turn.example.com','network':{'httpsPort':443}})
  self.assertIn("hostname:'turn-tls'",seen[0][0]);self.assertEqual(seen[0][1],443)
 def test_imported_retention_uses_owned_backend_and_rejects_edited_units_before_unregister(self):
  from unittest.mock import patch
  m=self.module();engine=m.load_engine({});calls=[]
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve()/'server';folder.mkdir(mode=0o700);engine.SYSTEMD_UNITS=Path(tmp)/'systemd';engine.SYSTEMD_UNITS.mkdir();engine.systemctl=lambda args:calls.append(args);state={'installationId':'12345678-1234-4234-9234-123456789abc','project':'castlink-easy-12345678123442349234123456789abc'};data={'target':'ssh','folder':str(folder),'dockerExecutable':'/usr/bin/docker','dockerContext':'default'}
   m.remote_scheduler(engine,folder,state,data,'daemon');marker=folder/'.castlink-runtime/remote-scheduler.json';self.assertTrue(marker.is_file());unit=next(engine.SYSTEMD_UNITS.glob('*.service'));self.assertIn('macos-compose-setup.py',unit.read_text());unit.write_text('foreign');before=len(calls)
   with self.assertRaises(ValueError):m.remote_scheduler(engine,folder,state,data,'daemon',unregister=True)
   self.assertEqual(before,len(calls));self.assertTrue(marker.exists())
 def test_remove_refuses_oversized_or_incomplete_observations_before_any_mutation(self):
  m=self.module();calls=[]
  class Engine:
   def docker(self,args,**kwargs):
    calls.append(args)
    if args[0]=='ps':return ' '.join('id'+str(index) for index in range(257))
    if args[0]=='inspect':return json.dumps([{'Id':'id'+str(index),'Config':{'Image':'web:fixed','Labels':{'com.docker.compose.project':'project','com.docker.compose.service':'web' if index<256 else 'foreign'}}} for index in range(257)])
    if args[:2]==['network','ls']:return ''
    return ''
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve();(folder/'compose.json').write_text(json.dumps({'services':{'web':{'image':'web:fixed'}},'volumes':{}}))
   with self.assertRaises(ValueError):m.remove_resources(Engine(),folder,{'project':'project'},False)
  self.assertFalse(any(command[0] in ('stop','rm') for command in calls))
 def test_install_prepares_only_empty_current_user_selected_directory_as_private(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve()/'picked';folder.mkdir(mode=0o755);folder.chmod(0o755);identity=folder.stat();result=m.validate_folder(folder,create=True)
   self.assertEqual(result,folder);self.assertEqual(folder.stat().st_mode&0o777,0o700);self.assertEqual(folder.stat().st_ino,identity.st_ino)
 def test_directory_preparation_does_not_chmod_existing_data_or_non_install_operations(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp).resolve();folder=root/'existing';folder.mkdir(mode=0o755);folder.chmod(0o755);(folder/'foreign.txt').write_text('keep me')
   with self.assertRaises(ValueError):m.validate_folder(folder,create=True)
   self.assertEqual(folder.stat().st_mode&0o777,0o755);self.assertEqual((folder/'foreign.txt').read_text(),'keep me')
   empty=root/'empty';empty.mkdir(mode=0o755);empty.chmod(0o755)
   with self.assertRaises(ValueError):m.validate_folder(empty,create=False)
   self.assertEqual(empty.stat().st_mode&0o777,0o755)
 def test_directory_preparation_refuses_replaced_inode_and_closes_its_descriptor(self):
  from unittest.mock import patch
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp).resolve();folder=root/'picked';folder.mkdir(mode=0o755);folder.chmod(0o755);moved=root/'moved';opened=[];real_open=m.os.open
   def swap(file,flags,*args,**kwargs):
    fd=real_open(file,flags,*args,**kwargs);opened.append(fd);self.assertTrue(flags&m.os.O_DIRECTORY);self.assertTrue(flags&m.os.O_NOFOLLOW);folder.rename(moved);folder.mkdir(mode=0o755);folder.chmod(0o755);return fd
   with patch.object(m.os,'open',side_effect=swap):
    with self.assertRaises(ValueError):m.validate_folder(folder,create=True)
   self.assertEqual(folder.stat().st_mode&0o777,0o755);self.assertEqual(moved.stat().st_mode&0o777,0o755);self.assertEqual(len(opened),1)
   with self.assertRaises(OSError):m.os.fstat(opened[0])
 def test_directory_preparation_refuses_symlinks_or_foreign_ownership(self):
  from unittest.mock import patch
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp).resolve();folder=root/'picked';folder.mkdir(mode=0o755);folder.chmod(0o755);link=root/'link';link.symlink_to(folder,target_is_directory=True)
   with self.assertRaises(ValueError):m.validate_folder(link,create=True)
   with patch.object(m.os,'geteuid',return_value=m.os.geteuid()+1):
    with self.assertRaises(ValueError):m.validate_folder(folder,create=True)
   self.assertEqual(folder.stat().st_mode&0o777,0o755)
 def test_directory_preparation_rechecks_contents_before_chmod_and_preserves_private_installs(self):
  from unittest.mock import patch
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   root=Path(tmp).resolve();folder=root/'picked';folder.mkdir(mode=0o755);folder.chmod(0o755);real_listdir=m.os.listdir;observed=[]
   def add_content(descriptor):
    result=real_listdir(descriptor);observed.append(descriptor)
    if len(observed)==1:(folder/'foreign.txt').write_text('preserve')
    return result
   with patch.object(m.os,'listdir',side_effect=add_content):
    with self.assertRaises(ValueError):m.validate_folder(folder,create=True)
   self.assertEqual(folder.stat().st_mode&0o777,0o755);self.assertEqual((folder/'foreign.txt').read_text(),'preserve')
   private=root/'owned';private.mkdir(mode=0o700);(private/m.RECEIPT).write_text('existing-owner')
   with patch.object(m.os,'fchmod',side_effect=AssertionError('Existing private installation must not be chmodded')):self.assertEqual(m.validate_folder(private,create=True),private)
 def test_directory_preparation_rechecks_descriptor_owner_before_permission_write(self):
  from unittest.mock import patch
  from types import SimpleNamespace
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp).resolve()/'picked';folder.mkdir(mode=0o755);folder.chmod(0o755);real_fstat=m.os.fstat;seen=[]
   def changed_owner(descriptor):
    value=real_fstat(descriptor);seen.append(descriptor)
    return value if len(seen)==1 else SimpleNamespace(st_dev=value.st_dev,st_ino=value.st_ino,st_uid=m.os.geteuid()+1,st_mode=value.st_mode)
   with patch.object(m.os,'fstat',side_effect=changed_owner),patch.object(m.os,'fchmod',wraps=m.os.fchmod) as chmod:
    with self.assertRaises(ValueError):m.validate_folder(folder,create=True)
    chmod.assert_not_called()
   self.assertEqual(folder.stat().st_mode&0o777,0o755)

class WindowsAdoptionTests(unittest.TestCase):
 def setUp(self):
  import base64
  self.module=importlib.util.module_from_spec(SPEC);SPEC.loader.exec_module(self.module);self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup);self.root=Path(self.temp.name).resolve();self.module.WINDOWS_ROOT=self.root/'opt';self.module.WINDOWS_ROOT.mkdir();self.iid='12345678-1234-4234-9234-123456789abc';self.project='castlink-easy-'+self.iid.replace('-','');self.folder=self.module.WINDOWS_ROOT/self.project;self.folder.mkdir(mode=0o700);self.commit='a'*40;self.calls=[];self.files={}
  self.release={'schemaVersion':1,'track':'linux','version':'1.0.0-rc.9','commit':self.commit,'imageArchive':'images.tar.gz','imageArchiveSha256':'c'*64,'images':{name:'castlink-easy-'+name+':'+self.commit for name in ['web','postgres','livekit','caddy']},'imageIdentities':{name:'sha256:'+('b'*64) for name in ['web','postgres','livekit','caddy']}}
  self.engine=self.module.load_engine({});n={'mode':'https','publicOrigin':'https://site.example.com','mediaIp':'203.0.113.20','bindAddress':'0.0.0.0','httpPort':80,'httpsPort':443,'iceTcpPort':7881,'iceUdpPort':7882,'turnUdpPort':3478,'relayPortStart':30000,'relayPortEnd':30031,'trustedProxies':[]};state=self.engine.init_state(self.folder,{'setupMode':'quick','publicHttps':True,'network':n},self.release,'d'*64);state.update(installationId=self.iid,nodeId='srv-'+self.iid.replace('-',''),project=self.project);self.engine.write_private(self.folder/self.engine.STATE,state);self.engine.render(self.folder,state,self.release)
  # Convert the fixture to the exact public Windows producer's remote layout.
  compose=json.loads((self.folder/'compose.json').read_text());compose['volumes']={key:{} for key in compose['volumes']}
  for service in compose['services'].values():service.pop('pull_policy',None)
  compose['services']['caddy']['ports']=['443:443','80:80'];compose['services']['livekit']['ports']=['7881:7881/tcp','7882:7882/udp','3478:3478/udp','30000-30031:30000-30031/udp'];self.engine.write_private(self.folder/'compose.json',compose)
  (self.folder/'Caddyfile').write_text('{\n admin off\n}\nhttps://site.example.com {\n @rtc path /rtc /rtc/*\n route @rtc {\n  forward_auth web:3000 {\n   uri /api/media-admission\n   header_up -Upgrade\n   header_up -Connection\n  }\n  reverse_proxy livekit:7880\n }\n reverse_proxy web:3000\n}\n')
  (self.folder/self.engine.STATE).unlink();(self.folder/'secrets.json').unlink();(self.folder/'payload').mkdir();self.engine.write_private(self.folder/'payload/release.json',self.release)
  images=[{'tag':tag,'id':'sha256:'+('b'*64),'preexisting':False} for tag in self.release['images'].values()];self.engine.write_private(self.folder/'.castlink-owned.json',{'schemaVersion':1,'folder':'D:\\CastLink','installationId':self.iid,'images':images,'files':[],'baseline':[],'rootCreated':True})
  self.engine.write_private(self.folder/'.castlink-retention.json',{'schemaVersion':1,'owner':'castlink-windows-retention-v1','installationId':self.iid,'folder':str(self.folder),'daemonId':'daemon','successfulImageSets':[{'commit':self.commit,'images':list(self.release['images'].values())}],'images':images,'parents':[],'archives':[{'path':'payload/images.tar.gz','sha256':'c'*64}],'scheduler':[]})
  self.container_ids=['container-'+name for name in compose['services']];self.compose=compose;self.containers=[]
  for name,service in compose['services'].items():
   mounts=[]
   for value in service.get('volumes',[]):
    pieces=value.split(':');source,destination=pieces[:2];rw=pieces[2:]!=['ro']
    mounts.append({'Type':'bind','Source':str(self.folder/source[2:]),'Destination':destination,'RW':rw} if source.startswith('./') else {'Type':'volume','Name':self.project+'_'+source,'Destination':destination,'RW':rw})
   self.containers.append({'Id':'container-'+name,'Image':'sha256:'+('b'*64),'Config':{'Image':service['image'],'Labels':{'com.docker.compose.project':self.project,'com.docker.compose.service':name}},'State':{'Running':True},'Mounts':mounts})
  self.engine.docker=self.docker;self.engine.systemctl=lambda args:self.calls.append(['systemctl',*args]);self.engine.compose=self.compose_command
 def docker(self,args,**kwargs):
  self.calls.append(args)
  if args[0]=='ps':
   if any(value.startswith('volume=') for value in args):return ' '.join(self.container_ids)
   return ' '.join(self.container_ids)
  if args[0]=='inspect':return json.dumps(self.containers)
  if args[:2]==['image','inspect']:return json.dumps({'Id':'sha256:'+('b'*64),'RepoTags':[args[-1]],'Os':'linux','Architecture':'amd64','Config':{'Labels':{}}})
  if args[:2]==['volume','inspect']:
   name=args[-1];return json.dumps([{'Name':name,'Labels':{'com.docker.compose.project':self.project,'com.docker.compose.volume':name[len(self.project)+1:]}}])
  if args[:2]==['network','ls']:return 'network-owned'
  if args[:2]==['network','inspect']:return json.dumps([{'Id':'network-owned','Name':self.project+'_default','Labels':{'com.docker.compose.project':self.project,'com.docker.compose.network':'default'},'Containers':{value:{} for value in self.container_ids}}])
  if args[0]=='run' and kwargs.get('output'):kwargs['output'].write(b'fixture-volume-backup');return ''
  if args[0] in ('stop','rm') or args[:2]==['network','rm']:return ''
  raise AssertionError(args)
 def compose_command(self,folder,state,args,**kwargs):
  self.calls.append(['compose',*args])
  if kwargs.get('output'):kwargs['output'].write(b'fixture-data-backup');return ''
  return 'CASTLINK_WINDOWS_READY'
 def test_preflight_is_read_only_and_preserves_identity_secrets_network_and_volume_names(self):
  before={str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()};plan=self.module.windows_preflight(self.engine,self.folder,'daemon')
  self.assertEqual(plan['state']['installationId'],self.iid);self.assertEqual(plan['state']['project'],self.project);self.assertEqual(plan['state']['network']['publicOrigin'],'https://site.example.com');self.assertEqual(plan['state']['databasePhase'],'seed');self.assertFalse((self.folder/self.module.RECEIPT).exists());self.assertEqual(plan['secrets']['livekitKey'],json.loads((self.folder/'livekit.json').read_text())['keys'].popitem()[0]);self.assertEqual(before,{str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()})
 def test_incompatible_schema_fails_before_any_write_or_destructive_docker_command(self):
  self.release['version']='9.9.9';self.engine.write_private(self.folder/'payload/release.json',self.release);before={str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()}
  with self.assertRaises(self.module.CompatibilityError):self.module.windows_preflight(self.engine,self.folder,'daemon')
  self.assertEqual(before,{str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()});self.assertFalse(any(command[0] in ('stop','rm','systemctl') for command in self.calls))
 def test_adoption_backs_up_original_configuration_before_adding_receipt_and_keeps_data_on_remove(self):
  plan=self.module.windows_preflight(self.engine,self.folder,'daemon');state=self.module.adopt_windows(self.engine,self.folder,'daemon',plan,{'target':'ssh'})
  marker=json.loads((self.folder/'.castlink-adoption.json').read_text());backup=self.folder/marker['backup'];self.assertTrue((backup/'manifest.json').is_file());self.assertEqual((backup/'files/compose.json').read_bytes(),(self.folder/'compose.json').read_bytes());self.assertTrue((self.folder/self.module.RECEIPT).is_file());self.module.verify_receipt(self.folder,state,'daemon','ssh');self.module.remove_resources(self.engine,self.folder,state,False);self.assertFalse(any(command[:2]==['volume','rm'] for command in self.calls))
 def test_foreign_volume_or_changed_image_is_refused_without_mac_ownership(self):
  original=self.engine.docker
  def changed(args,**kwargs):
   if args[:2]==['volume','inspect']:return json.dumps([{'Name':args[-1],'Labels':{'com.docker.compose.project':'foreign'}}])
   return original(args,**kwargs)
  self.engine.docker=changed
  with self.assertRaises(self.module.CompatibilityError):self.module.windows_preflight(self.engine,self.folder,'daemon')
  self.assertFalse((self.folder/self.module.RECEIPT).exists())

 def test_adopted_update_changes_images_without_changing_existing_secrets_or_volume_topology(self):
  plan=self.module.windows_preflight(self.engine,self.folder,'daemon');state=self.module.adopt_windows(self.engine,self.folder,'daemon',plan,{'target':'ssh'});preserved={name:(self.folder/name).read_bytes() for name in ['postgres.env','web.env','livekit.json','Caddyfile']};release=json.loads(json.dumps(self.release));release['commit']='e'*40;release['images']={name:tag.split(':')[0]+':'+release['commit'] for name,tag in release['images'].items()}
  self.module.network_extensions(self.engine,'ssh');self.assertEqual(self.engine.load_state(self.folder)['project'],self.project);self.engine.render(self.folder,state,release);updated=json.loads((self.folder/'compose.json').read_text())
  self.assertEqual(updated['volumes'],self.compose['volumes']);self.assertEqual(updated['name'],self.project);self.assertEqual(updated['services']['web']['image'],release['images']['web']);self.assertEqual(preserved,{name:(self.folder/name).read_bytes() for name in preserved})

 def test_windows_remove_and_current_update_route_through_real_lifecycle_entry(self):
  from unittest.mock import patch
  self.engine.check_updates=lambda _:None;self.engine.cleanup_installation=lambda *_:None
  data={'action':'update','target':'ssh','folder':str(self.folder),'confirmed':True,'installationId':self.iid}
  with patch.object(self.module,'load_engine',return_value=self.engine),patch.object(self.module,'bind_docker',return_value='daemon'),patch.object(self.module,'remote_scheduler') as scheduler:result=self.module.run(data)
  self.assertEqual(result['installationId'],self.iid);self.assertEqual(result['outcome'],'current');self.assertTrue(scheduler.called);self.assertEqual(json.loads((self.folder/'compose.json').read_text())['volumes'],self.compose['volumes'])
  with patch.object(self.module,'load_engine',return_value=self.engine),patch.object(self.module,'bind_docker',return_value='daemon'),patch.object(self.module,'remote_scheduler'):result=self.module.run({**data,'action':'remove'})
  self.assertTrue(result['dataRetained']);self.assertFalse(any(command[:2]==['volume','rm'] for command in self.calls))
 def test_unknown_windows_layout_is_refused_by_entry_before_lock_or_any_marker(self):
  from unittest.mock import patch
  self.release['version']='9.9.9';self.engine.write_private(self.folder/'payload/release.json',self.release);before={str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()}
  with patch.object(self.module,'load_engine',return_value=self.engine),patch.object(self.module,'bind_docker',return_value='daemon'):
   with self.assertRaises(self.module.CompatibilityError):self.module.run({'action':'remove','target':'ssh','folder':str(self.folder),'confirmed':True})
  self.assertEqual(before,{str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()})

 def test_remote_discovery_finds_supported_windows_layout_without_adopting_it(self):
  result=self.module.discover_installations(self.engine,'daemon','ssh');self.assertEqual(len(result),1);self.assertEqual(result[0]['folder'],str(self.folder));self.assertEqual(result[0]['compatibility'],'windows-remote-v1');self.assertFalse((self.folder/self.module.RECEIPT).exists())

 def test_running_postgres_is_always_backed_up_with_pg_dump_when_web_is_stopped(self):
  for item in self.containers:
   if item['Config']['Labels']['com.docker.compose.service']=='web':item['State']['Running']=False
  plan=self.module.windows_preflight(self.engine,self.folder,'daemon');self.module.backup_windows(self.engine,self.folder,plan['state'],plan)
  self.assertTrue(any(command[:1]==['compose'] and 'pg_dump' in command for command in self.calls))
  self.assertFalse(any(command[:1]==['run'] and any('source='+self.project+'_postgres-data,' in value for value in command) for command in self.calls))
 def test_runtime_image_digest_and_actual_mounts_must_match_the_owned_service(self):
  web=next(item for item in self.containers if item['Config']['Labels']['com.docker.compose.service']=='web');web['Image']='sha256:'+('f'*64)
  with self.assertRaises(self.module.CompatibilityError):self.module.windows_preflight(self.engine,self.folder,'daemon')
  web['Image']='sha256:'+('b'*64);web['Mounts']=[{'Type':'bind','Source':'/srv/unrelated-data','Destination':'/data','RW':True}]
  with self.assertRaises(self.module.CompatibilityError):self.module.windows_preflight(self.engine,self.folder,'daemon')
  self.assertFalse((self.folder/self.module.RECEIPT).exists())
 def test_every_history_entry_is_validated_before_adoption_writes(self):
  record=json.loads((self.folder/'.castlink-retention.json').read_text());record['successfulImageSets'].append({'commit':'invalid-history','images':['foreign-image']});self.engine.write_private(self.folder/'.castlink-retention.json',record)
  before={str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()}
  with self.assertRaises(self.module.CompatibilityError):self.module.windows_preflight(self.engine,self.folder,'daemon')
  self.assertEqual(before,{str(file.relative_to(self.folder)):file.read_bytes() for file in self.folder.rglob('*') if file.is_file()})

 def test_stopped_owned_volumes_have_only_read_search_capability_for_private_pgdata(self):
  for item in self.containers:item['State']['Running']=False
  plan=self.module.windows_preflight(self.engine,self.folder,'daemon');directory=self.module.backup_windows(self.engine,self.folder,plan['state'],plan);commands=[command for command in self.calls if command[:1]==['run']]
  self.assertEqual(len(commands),2)
  for command in commands:
   self.assertEqual(command[command.index('--cap-drop')+1],'ALL');self.assertEqual(command[command.index('--cap-add')+1],'DAC_READ_SEARCH');self.assertIn('--read-only',command);self.assertEqual(command[command.index('--network')+1],'none');self.assertIn('readonly',command[command.index('--mount')+1]);self.assertIn('sha256:'+('b'*64),command)
  self.assertEqual(json.loads((directory/'manifest.json').read_text())['formats']['postgres'],'volume-tar')

if __name__=='__main__':unittest.main()
