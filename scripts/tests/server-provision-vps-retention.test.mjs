import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import path from 'node:path';
const execute=promisify(execFile),script=process.env.CASTLINK_VPS_TEST_SCRIPT||path.resolve('scripts/server-provision-vps.py');
const harness=String.raw`
import importlib.util,json,tempfile,tarfile,io,os,copy
from pathlib import Path
s=importlib.util.spec_from_file_location('p',SCRIPT);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
m.os.getuid=getattr(os,'getuid',lambda:0)
if os.name=='nt':
 def fixture_private_file(location,text):
  with location.open('x',encoding='utf-8') as output:output.write(text)
 m.private_file=fixture_private_file
iid='11111111-1111-4111-8111-111111111111';project='castlink-easy-'+iid.replace('-','');images={};calls=[];containers=[];daemon='engine-one';systemcalls=[]
def image(tag):
 if tag.startswith('sha256:'):return tag
 return images[tag]
def docker(*a,**kw):
 calls.append(list(a))
 if a[0]=='info':return daemon
 if a[:2]==('ps','-aq'):return ' '.join(str(n) for n in range(len(containers)))
 if a[0]=='inspect':return json.dumps(containers)
 if a[:2]==('image','inspect'):
  ident=image(a[2])
  if '--format' in a:return ident
  return json.dumps([{'Id':ident,'RepoTags':[t for t,v in images.items() if v==ident]}])
 if a[:2]==('image','rm'):
  assert a[2]=='--no-prune','image removal may prune unreceipted parents'
  del images[a[3]];return ''
 if a[0]=='run':
  assert '--pull' in a and a[a.index('--pull')+1]=='never','backup validation may not fetch missing images'
  return ''
 raise AssertionError(a)
m.docker=docker
with tempfile.TemporaryDirectory() as td:
 root=Path(td)/project;root.mkdir(mode=0o700);units=Path(td)/'units';units.mkdir();m.RETENTION_SYSTEMD_ROOT=units
 def systemrun(arguments,**kw):
  systemcalls.append(arguments);return 'enabled' if arguments[1]=='is-enabled' else 'active'
 m.run=systemrun
 m.scope=lambda name:root
 state={'installationId':iid,'completed':True};(root/'.castlink-install.json').write_text(json.dumps(state))
 def release(letter):
  commit=letter*40;tags={n:'castlink-easy-'+n+':'+commit for n in m.SERVICES}
  for index,tag in enumerate(tags.values()):images[tag]='sha256:'+letter*62+str(index)*2
  return {'commit':commit,'images':tags}
 def model(release):return m.configuration('8.8.8.8',release,iid)['compose']
 # configuration's release contract is unchanged.
 def rel(letter):return dict(release(letter),schemaVersion=1)
 old=rel('a');current=model(old);(root/'compose.json').write_text(json.dumps(current))
 def backup(letter,broken=False):
  directory=root/'backups'/('web-'+letter*12+'-12345678');directory.mkdir(parents=True,mode=0o700)
  names=['compose.json','web.env','postgres.env','livekit.json','Caddyfile','.castlink-install.json']
  for name in names:(directory/name).write_text(json.dumps(current) if name=='compose.json' else json.dumps(state) if name=='.castlink-install.json' else 'config')
  (directory/'postgres.dump').write_bytes(b'PGDMP-fixture')
  with tarfile.open(directory/'web-data.tar','w') as archive:
   info=tarfile.TarInfo('state.json');body=b'{}';info.size=len(body);archive.addfile(info,io.BytesIO(body))
  record={'installationId':iid,'status':'updated','fileHashes':{n:m.file_sha(directory/n) for n in names},'dataHashes':{n:m.file_sha(directory/n) for n in ['postgres.dump','web-data.tar']}}
  (directory/'backup.json').write_text(json.dumps(record))
  if broken:(directory/'postgres.dump').write_bytes(b'corrupt')
  return directory
 mode=MODE
 if mode in ['rotation','corrupt','references','changed-tag','unknown','sibling-linux','sibling-windows','sibling-web','sibling-owned','same-id']:
  backups=[]
  for letter in ['b','c','d']:
   new=rel(letter)
   if mode=='same-id':
    for name in ['postgres','livekit','caddy']:images[new['images'][name]]=images[old['images'][name]]
   saved=backup(letter,mode=='corrupt' and letter=='d');backups.append(saved)
   candidate=model(new)
   if mode=='same-id':
    for name in ['postgres','livekit','caddy']:candidate['services'][name]['image']=old['images'][name]
   (root/'compose.json').write_text(json.dumps(candidate))
   m.retention_commit(root,new,current,saved)
   current=candidate
   if letter=='b' and mode=='references':
    containers=[{'Image':images['castlink-easy-web:'+'a'*40],'Config':{'Image':'castlink-easy-web:'+'a'*40},'State':{'Running':False}}]
    sibling=Path(td)/('castlink-easy-'+'2'*32);sibling.mkdir();(sibling/'compose.json').write_text(json.dumps({'services':{'web':{'image':'castlink-easy-livekit:'+'a'*40}}}))
    images['manual:keep']=images['castlink-easy-caddy:'+'a'*40]
   if letter=='b' and mode.startswith('sibling-'):
    sibling=Path(td)/('castlink-easy-'+'2'*32);sibling.mkdir();(sibling/'compose.json').write_text(json.dumps({'services':{'web':{'image':'foreign:current'}}}))
    tag='castlink-easy-web:'+'a'*40;entry={'tag':tag,'id':images[tag]}
    if mode=='sibling-linux':receipt={'schemaVersion':1,'images':[entry],'successfulReleases':[{'commit':'a'*40,'images':{'web':tag}}]};name='.castlink-image-ownership.json'
    elif mode in ['sibling-windows','sibling-owned']:receipt={'schemaVersion':1,'owner':'castlink-windows-retention-v1','images':[entry],'successfulImageSets':[{'commit':'a'*40,'images':[tag]}]};name='.castlink-retention.json' if mode=='sibling-windows' else '.castlink-owned.json'
    else:receipt={'schemaVersion':1,'daemonId':daemon,'directoryIdentity':[0,0],'current':[],'previous':[entry],'owned':[entry]};name='.castlink-retention.json'
    (sibling/name).write_text(json.dumps(receipt))
   if letter=='b' and mode=='changed-tag':images['castlink-easy-web:'+'a'*40]='sha256:'+'f'*64
   if letter=='b' and mode=='unknown':
    (root/'manual.tar.gz').write_text('manual');(root/'backups'/'manual').mkdir();(root/'release.tar.gz').write_text('unreceipted')
   m.retention_cleanup_locked(root,iid)
  before=copy.deepcopy(images);m.retention_cleanup_locked(root,iid);assert images==before
  print(json.dumps({'tags':sorted(images),'backups':[p.name for p in (root/'backups').iterdir()],'calls':calls,'receipt':json.loads((root/m.RETENTION_RECEIPT).read_text()),'manual':(root/'manual.tar.gz').exists(),'archive':(root/'release.tar.gz').exists()}))
 elif mode=='failed':
  new=rel('b');saved=backup('b');(root/'compose.json').write_text(json.dumps(model(new)));m.retention_commit(root,new,current,saved)
  before=json.loads((root/m.RETENTION_RECEIPT).read_text());failed=rel('c');m.retention_track_import(root,failed)
  after=json.loads((root/m.RETENTION_RECEIPT).read_text());assert after['current']==before['current'] and after['previous']==before['previous']
  m.retention_cleanup_locked(root,iid);assert all(not t.endswith('c'*40) for t in images)
  assert all('castlink-easy-'+n+':'+'b'*40 in images for n in m.SERVICES)
  print(json.dumps({'safe':True}))
 elif mode=='schedule-fails':
  m.RETENTION_SOURCE=Path(SCRIPT).read_text();new=rel('b');saved=backup('b');(root/'compose.json').write_text(json.dumps(model(new)))
  m.retention_commit(root,new,current,saved)
  newer=rel('c');saved=backup('c');(root/'compose.json').write_text(json.dumps(model(newer)))
  m.retention_schedule=lambda *a: (_ for _ in ()).throw(ValueError('scheduler unavailable'))
  result=m.retention_finish(root,newer,model(new),saved,{'outcome':'updated'})
  assert result['cleanupWarning'] is True
  assert all(not t.endswith('a'*40) for t in images),'scheduler error prevented disk cleanup'
  assert len(list((root/'backups').iterdir()))==1
  print(json.dumps({'safe':True}))
 elif mode=='legacy-archives':
  (root/'payload').mkdir();(root/'payload/images.tar.gz').write_bytes(b'legacy-images')
  old['imageArchiveSha256']=m.file_sha(root/'payload/images.tar.gz');old['distributionRepository']='resokol/castlink-releases'
  (root/'payload/release.json').write_text(json.dumps(old))
  with tarfile.open(root/'release.tar.gz','w:gz') as archive:
   body=(root/'payload/release.json').read_bytes();info=tarfile.TarInfo('payload/release.json');info.size=len(body);archive.addfile(info,io.BytesIO(body))
  new=rel('b');saved=backup('b');(root/'compose.json').write_text(json.dumps(model(new)));m.retention_commit(root,new,current,saved);m.retention_cleanup_locked(root,iid)
  assert not (root/'release.tar.gz').exists() and not (root/'payload/images.tar.gz').exists()
  assert (root/'payload/release.json').exists()
  print(json.dumps({'safe':True}))
 elif mode=='sibling-unknown':
  new=rel('b');saved=backup('b');(root/'compose.json').write_text(json.dumps(model(new)));m.retention_commit(root,new,current,saved)
  sibling=Path(td)/'other';sibling.mkdir();(sibling/'.castlink-retention.json').write_text(json.dumps({'schemaVersion':99,'successfulImageSets':[]}))
  try:m.retention_cleanup_locked(root,iid);raise AssertionError('unknown sibling history accepted')
  except ValueError:pass
  assert not any(c[:2]==['image','rm'] for c in calls);print(json.dumps({'safe':True}))
 elif mode in ['staging','staging-identity']:
  stage=root/'.castlink-update-abcd1234';(stage/'payload').mkdir(parents=True);(stage/'release.tar.gz').write_bytes(b'transport');(stage/'payload/images.tar.gz').write_bytes(b'images')
  m.retention_remember_staging(root,stage)
  if mode=='staging-identity':
   stage.rename(root/'.castlink-update-original');stage.mkdir();(stage/'release.tar.gz').write_bytes(b'transport')
   m.retention_cleanup_locked(root,iid);assert (stage/'release.tar.gz').exists()
  else:
   (stage/'release.tar.gz').write_bytes(b'user-replacement');(stage/'manual.txt').write_text('manual')
   complete=root/'.castlink-update-abcd1235';complete.mkdir();(complete/'release.tar.gz').write_bytes(b'owned');m.retention_remember_staging(root,complete)
   unknown=root/'.castlink-update-unknown1';unknown.mkdir();(unknown/'release.tar.gz').write_bytes(b'unverified')
   m.retention_cleanup_locked(root,iid)
   assert (stage/'release.tar.gz').read_bytes()==b'user-replacement' and (stage/'manual.txt').exists()
   assert not (stage/'payload/images.tar.gz').exists() and not complete.exists() and (unknown/'release.tar.gz').exists()
  print(json.dumps({'safe':True}))
 elif mode=='daemon-inactive':
  m.run=lambda *a,**kw:'inactive'
  try:m.retention({'installationId':iid});raise AssertionError('stopped Docker contacted')
  except ValueError:pass
  assert calls==[];print(json.dumps({'safe':True}))
 elif mode=='resume-identity':
  (root/'payload').mkdir();(root/'payload/release.json').write_text(json.dumps(old))
  m.partial_installation=lambda address:(root,dict(state,completed=False));m.discover=lambda:[];m.ports_available=lambda *a:None
  def verified(folder,observed,data):
   if observed['completed']:raise ValueError('Incomplete installation identity changed')
   return {'state':observed,'compose':current,'files':{'web.env':'','livekit.json':''}}
  m.verified_partial=verified
  m.deploy_locked=lambda *a: (_ for _ in ()).throw(AssertionError('completed scope redeployed from stale pre-lock state'))
  try:m.deploy({'host':'8.8.8.8'});raise AssertionError('completed scope accepted')
  except ValueError:pass
  assert calls==[];print(json.dumps({'safe':True}))
 elif mode=='archives':
  (root/'payload').mkdir();(root/'release.tar.gz').write_bytes(b'owned-release');(root/'payload/images.tar.gz').write_bytes(b'owned-images')
  m.retention_commit(root,old,current)
  (root/'release.tar.gz').write_bytes(b'user-replacement')
  m.retention_cleanup_locked(root,iid)
  assert (root/'release.tar.gz').read_bytes()==b'user-replacement' and not (root/'payload/images.tar.gz').exists()
  print(json.dumps({'safe':True}))
 elif mode=='identity':
  new=rel('b');saved=backup('b');(root/'compose.json').write_text(json.dumps(model(new)));m.retention_commit(root,new,current,saved)
  before=copy.deepcopy(images);daemon='engine-two'
  try:m.retention_cleanup_locked(root,iid);raise AssertionError('changed daemon accepted')
  except ValueError:pass
  daemon='engine-one';state['installationId']='22222222-2222-4222-8222-222222222222';(root/'.castlink-install.json').write_text(json.dumps(state))
  try:m.retention_cleanup_locked(root,iid);raise AssertionError('changed installation accepted')
  except ValueError:pass
  assert images==before;print(json.dumps({'safe':True}))
 elif mode=='schedule':
  m.RETENTION_SOURCE=Path(SCRIPT).read_text();m.retention_schedule(root,iid)
  service=next(units.glob('*.service'));timer=next(units.glob('*.timer'));content=service.read_text();timer_content=timer.read_text();helper=root/'.castlink-retention.py'
  assert helper.read_text()==m.RETENTION_SOURCE
  m.retention_schedule(root,iid);assert service.read_text()==content and timer.read_text()==timer_content
  service.write_text('foreign task')
  try:m.retention_schedule(root,iid);raise AssertionError('foreign scheduler overwritten')
  except ValueError:pass
  assert service.read_text()=='foreign task'
  try:m.retention_remove_schedule(root,iid);raise AssertionError('foreign scheduler removed')
  except ValueError:pass
  service.write_text(content);m.retention_remove_schedule(root,iid);assert not service.exists() and not timer.exists()
  m.retention_remove_schedule(root,iid)
  assert all(command[1] not in ['start','restart'] for command in systemcalls)
  print(json.dumps({'service':content,'timer':timer_content,'helper':str(helper)}))
 elif mode=='lock':
  import fcntl
  lock=os.open(root/'.castlink-update.lock',os.O_WRONLY|os.O_CREAT,0o600);fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
  try:
   try:m.retention({'installationId':iid});raise AssertionError('cleanup ignored update lock')
   except ValueError as error:assert 'running' in str(error)
  finally:os.close(lock)
  assert calls==[];print(json.dumps({'safe':True}))
`;
async function run(mode){return JSON.parse((await execute(process.env.CASTLINK_PYTHON||'python3',['-c',harness.replaceAll('SCRIPT',JSON.stringify(script)).replace('MODE',JSON.stringify(mode))],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})).stdout.trim().split('\n').at(-1));}
test('three successful VPS versions retain two own image sets and one verified generated backup',async()=>{const r=await run('rotation');assert.equal(r.tags.length,8);assert.ok(r.tags.every(t=>t.endsWith('c'.repeat(40))||t.endsWith('d'.repeat(40))));assert.deepEqual(r.backups,['web-'+ 'd'.repeat(12)+'-12345678']);assert.ok(r.calls.filter(a=>a[0]==='image'&&a[1]==='rm').every(a=>a.length===4&&a[2]==='--no-prune'));});
test('corrupt latest VPS backup keeps the previous verified snapshot',async()=>{const r=await run('corrupt');assert.ok(r.backups.includes('web-'+ 'c'.repeat(12)+'-12345678'));assert.ok(!r.backups.includes('web-'+ 'b'.repeat(12)+'-12345678'));assert.equal(r.receipt.lastCleanup.status,'warning');});
test('stopped containers, sibling Compose references and foreign aliases protect image IDs',async()=>{const r=await run('references');for(const name of ['web','livekit','caddy'])assert.ok(r.tags.includes('castlink-easy-'+name+':'+ 'a'.repeat(40)));assert.ok(r.tags.includes('manual:keep'));});
test('retagged VPS image and unknown files are preserved',async()=>{const changed=await run('changed-tag');assert.ok(changed.tags.includes('castlink-easy-web:'+ 'a'.repeat(40)));const r=await run('unknown');assert.equal(r.manual,true);assert.equal(r.archive,true);assert.ok(r.backups.includes('manual'));});
test('VPS cleanup refuses changed daemon or installation identity before deletion',async()=>{assert.equal((await run('identity')).safe,true);});
test('hourly VPS scheduler is scoped, idempotent and preserves foreign task content',{skip:process.platform==='win32'},async()=>{const r=await run('schedule');assert.match(r.timer,/OnCalendar=hourly/);assert.match(r.service,/ExecStart=\/usr\/bin\/python3 .* --retention 11111111-1111-4111-8111-111111111111/);assert.doesNotMatch(r.service,/ssh|docker.*start|systemctl/);});
test('periodic VPS cleanup shares the updater lock and never contacts Docker while locked',{skip:process.platform==='win32'},async()=>{assert.equal((await run('lock')).safe,true);});

test('failed imported release never promotes rollback and is removed when unused',async()=>{assert.equal((await run('failed')).safe,true);});
test('only hashed owned transfer archives are removed and changed files survive',async()=>{assert.equal((await run('archives')).safe,true);});

test('scheduler failure remains visible while independent committed disk cleanup completes',async()=>{assert.equal((await run('schedule-fails')).safe,true);});

test('legacy VPS generated transfer archives are adopted only through matching release manifest and hashes',async()=>{assert.equal((await run('legacy-archives')).safe,true);});

test('resumed deployment rechecks durable completion state after acquiring the shared lock',{skip:process.platform==='win32'},async()=>{assert.equal((await run('resume-identity')).safe,true);});

test('sibling rollback histories from Linux, Windows and web receipts protect previous image IDs',async()=>{for(const mode of ['sibling-linux','sibling-windows','sibling-web','sibling-owned']){const r=await run(mode);assert.ok(r.tags.includes('castlink-easy-web:'+ 'a'.repeat(40)),mode);}});
test('unknown sibling retention metadata prevents deletion',async()=>{assert.equal((await run('sibling-unknown')).safe,true);});
test('inactive Docker is never contacted or socket-activated by periodic VPS cleanup',{skip:process.platform==='win32'},async()=>{assert.equal((await run('daemon-inactive')).safe,true);});

test('same-ID infrastructure aliases retire obsolete sets while exact configured tags stay',async()=>{const r=await run('same-id');for(const n of ['postgres','livekit','caddy']){assert.ok(r.tags.includes('castlink-easy-'+n+':'+ 'a'.repeat(40)));assert.ok(!r.tags.includes('castlink-easy-'+n+':'+ 'b'.repeat(40)));}assert.equal(r.tags.length,11);});
test('verified abandoned VPS staging removes only unchanged receipted files',async()=>{assert.equal((await run('staging')).safe,true);});
test('replacement staging directory identity prevents deletion',async()=>{assert.equal((await run('staging-identity')).safe,true);});
