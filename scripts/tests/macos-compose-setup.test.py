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
   folder=Path(tmp);(folder/'compose.json').write_text('{}');state={'installationId':'12345678-1234-4234-9234-123456789abc'}
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
   folder=Path(tmp);(folder/'compose.json').write_text(json.dumps({'services':{'web':{}},'volumes':{}}))
   with self.assertRaises(ValueError):m.remove_resources(Engine(),folder,{'project':'project'},False)
   self.assertFalse(any(c[0] in ['stop','rm','volume','network'] for c in calls))
 def test_remove_confirmation_and_non_private_folder_refused_before_docker(self):
  m=self.module()
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp);folder.chmod(0o755)
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
   folder=Path(tmp)/'install';package=Path(tmp)/'package';package.mkdir();release={'schemaVersion':1,'version':'1.0.0','commit':'a'*40,'images':{name:'castlink-easy-'+name+':'+('a'*40) for name in ['web','postgres','livekit','caddy']},'imageIdentities':{name:'sha256:'+('b'*64) for name in ['web','postgres','livekit','caddy']}}
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
   folder=Path(tmp);(folder/'compose.json').write_text(json.dumps({'services':{'web':{'image':'castlink-web:fixed'}},'volumes':{'web-data':{'name':'project_web-data'}}}))
   m.remove_resources(Engine(),folder,{'project':'project'},False)
  self.assertIn(['rm','container-owned'],calls);self.assertEqual(calls[-1],['network','rm','network-owned']);self.assertFalse(any(command[0]=='volume' for command in calls))
 def test_discovery_uses_container_labels_only_as_hints_and_requires_owned_receipt(self):
  m=self.module();engine=m.load_engine({})
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp);config={'setupMode':'quick','publicHttps':False,'network':{'mode':'http','publicOrigin':'http://127.0.0.1','mediaIp':'127.0.0.1','bindAddress':'127.0.0.1','httpPort':80,'httpsPort':443,'iceTcpPort':7881,'iceUdpPort':7882,'turnUdpPort':3478,'relayPortStart':30000,'relayPortEnd':30031,'trustedProxies':[]}};state=engine.init_state(folder,config,{'version':'1.0.0','commit':'a'*40})
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
   source=(Path(SPEC.origin).with_name('linux-compose-setup.py')).read_bytes();data={'action':'install','folder':tmp,'linuxSource':base64.b64encode(source).decode()}
   engine=m.load_engine(data);self.assertFalse((Path(tmp)/'.castlink-runtime').exists())
   with engine.installation_lock(Path(tmp)):m.persist_linux_source(engine,data,Path(tmp))
   self.assertTrue(Path(engine.__file__).is_file())
 def test_backup_retains_ownership_receipt_and_only_latest_intact_verified_copy(self):
  from unittest.mock import patch
  m=self.module();engine=m.load_engine({})
  with tempfile.TemporaryDirectory() as tmp:
   folder=Path(tmp);config={'setupMode':'quick','publicHttps':False,'network':{'mode':'http','publicOrigin':'http://127.0.0.1','mediaIp':'127.0.0.1','bindAddress':'127.0.0.1','httpPort':80,'httpsPort':443,'iceTcpPort':7881,'iceUdpPort':7882,'turnUdpPort':3478,'relayPortStart':30000,'relayPortEnd':30031,'trustedProxies':[]}};release={'version':'1.0.0','commit':'a'*40,'images':{name:'castlink-easy-'+name+':'+('a'*40) for name in ['web','postgres','livekit','caddy']}};state=engine.init_state(folder,config,release);engine.render(folder,state,release);m.write_receipt(folder,state,'daemon','ssh')
   engine.compose=lambda *args,**kwargs:kwargs['output'].write(b'fixture-backup')
   with patch.object(m.time,'strftime',return_value='20261101-120000-'):first=Path(m.backup(engine,folder,state))
   with patch.object(m.time,'strftime',return_value='20261102-120000-'):second=Path(m.backup(engine,folder,state))
   self.assertTrue((second/m.RECEIPT).is_file());m.cleanup_mac_backups(engine,folder,state);self.assertFalse(first.exists());self.assertTrue(second.exists())
 def test_turn_tls_origin_probe_uses_the_frontdoor_with_proxy_protocol(self):
  m=self.module();engine=m.load_engine({});seen=[]
  engine.probe_origin=lambda folder,state:seen.append((engine.READINESS_JS,state['network']['httpsPort']))
  m.network_extensions(engine,'ssh');engine.probe_origin(Path('/unused'),{'turnDomain':'turn.example.com','network':{'httpsPort':443}})
  self.assertIn("hostname:'turn-tls'",seen[0][0]);self.assertEqual(seen[0][1],443)
if __name__=='__main__':unittest.main()
