import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
import path from 'node:path';
const script=path.resolve('scripts/server-provision-vps.py');
const harness=String.raw`
import importlib.util,json,tempfile,tarfile,io,copy,os
from pathlib import Path
s=importlib.util.spec_from_file_location('p',SCRIPT);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
m.os.getuid=getattr(os,'getuid',lambda:0)
# Windows reports emulated directory modes rather than POSIX700. Only the
# fixture backup-directory mode is adapted; production guards stay unchanged.
if os.name=='nt':
 original_stat=Path.stat
 def fixture_stat(location,*args,**kwargs):
  info=original_stat(location,*args,**kwargs)
  if location.name=='backups':
   values=list(info);values[0]=(info.st_mode & ~0o777)|0o700;return os.stat_result(values)
  return info
 Path.stat=fixture_stat
def fixture_private_file(location,text):
 with location.open('x',encoding='utf-8') as output:output.write(text)
 os.chmod(location,0o600)
m.private_file=fixture_private_file
iid='11111111-1111-4111-8111-111111111111';project='castlink-easy-'+iid.replace('-','');old='a'*40;new='b'*40
identity={'installationId':iid,'id':'srv-'+iid.replace('-',''),'origin':'https://8.8.8.8'}
release={'schemaVersion':1,'commit':new,'version':'1.0.0-rc.2','distributionRepository':'resokol/castlink-releases','capabilities':['peer-profile-v1','root-ssh-v1','vps-update-maintenance-v1'],'images':{n:'castlink-easy-'+n+':'+new for n in m.SERVICES},'imageIdentities':{'web':'sha256:'+'b'*64}}
calls=[];health_calls=[];phase='old';variant=VARIANT
if variant=='canonical':release['distributionRepository']='resokol/castlink'
images={};infrastructure_images={};ack_lost=False
for index,n in enumerate(m.SERVICES):
 infrastructure_images[n]='sha256:'+('a'*64 if n=='web' else str(index)*64)
 images['castlink-easy-'+n+':'+old]=infrastructure_images[n]
work_exists='preexisting' in variant or 'foreign' in variant
if variant=='cross-store':release['imageIdentities']['web']='sha256:'+'c'*64
with tempfile.TemporaryDirectory() as td:
 root=Path(td)/project;root.mkdir(mode=0o700)
 webdata=Path(td)/'webdata';webdata.mkdir();(webdata/'peer.json').write_text('original-peer-secret');database=Path(td)/'database';database.write_bytes(b'PGDMP-private-snapshot')
 config=m.configuration('8.8.8.8',dict(release,commit=old,images={n:'castlink-easy-'+n+':'+old for n in m.SERVICES}),iid);config['state']['completed']=True
 if variant.startswith('legacy'):
  config['compose']['services'].pop('presentation-converter');config['compose']['volumes'].pop('converter-socket');config['compose']['volumes'].pop('converter-work');config['compose']['services']['web']['volumes']=['web-data:/data']
 for name,value in config['files'].items():(root/name).write_text(value)
 (root/'compose.json').write_text(json.dumps(config['compose']));(root/'.castlink-install.json').write_text(json.dumps(config['state']))
 original={p.name:p.read_bytes() for p in root.iterdir()}
 m.scope=lambda p:root
 m.download_release=lambda *a:None
 m.prepare_release=lambda *a:release
 m.update_release_tags=lambda *a:None
 m.update_offline_no_participants=lambda *a: (_ for _ in ()).throw(ValueError('Active VPS sessions or session check unavailable')) if variant=='late-active' else None
 m.update_resources=lambda *a:({'postgres':'pg-id','livekit':'lk-id','caddy':'caddy-id'},'web-id',images.get(json.loads((root/'compose.json').read_text())['services']['web']['image'],json.loads((root/'compose.json').read_text())['services']['web']['image']))
 m.retention_schedule=lambda *a:None
 m.update_unchanged=lambda *a:None
 m.update_identity=lambda *a:dict(identity,installationId=('22222222-2222-4222-8222-222222222222' if variant=='wrong-identity' else iid))
 m.update_build=lambda *a:'1.0.0-rc.2-'+json.loads((root/'compose.json').read_text())['services']['web']['image'].split(':')[-1][:12]
 m.update_no_participants=lambda *a: (_ for _ in ()).throw(ValueError('Active VPS sessions or session check unavailable')) if variant=='active' else None
 m.update_space=lambda *a: (_ for _ in ()).throw(ValueError('VPS backup space unavailable')) if variant=='disk' else None
 m.update_migrations=lambda *a: (_ for _ in ()).throw(ValueError('VPS release needs a database migration')) if variant=='migration' else None
 def docker(*a,**kw):
  global work_exists,ack_lost
  calls.append(list(a))
  if a[0]=='volume':
   if a[1]=='ls':return project+'_converter-work' if work_exists else ''
   if a[1]=='inspect':return json.dumps([{'Name':project+'_converter-work','Labels':{'com.docker.compose.project':'other' if 'foreign' in variant else project,'com.docker.compose.volume':'converter-work'}}])
   if a[1]=='rm':work_exists=False;return ''
  if a[0]=='info':return 'fixture-engine'
  if a[0]=='load':
   for index,n in enumerate(m.SERVICES):images[release['images'][n]]='sha256:'+release['commit'][0]*64 if n=='web' else 'sha256:'+release['commit'][0]*62+str(index)*2
   return ''
  if a[0]=='ps':return 'pg-id lk-id caddy-id' if a[1]=='-aq' and '--filter' not in a else ''
  if a[0]=='inspect':return json.dumps([{'Image':infrastructure_images[n],'Config':{'Image':'castlink-easy-'+n+':'+old}} for n in ['postgres','livekit','caddy']])
  if a[0]=='image':
   if a[1]=='rm':del images[a[3] if a[2]=='--no-prune' else a[2]];return ''
   if a[-1]=='{{.Os}}/{{.Architecture}}':return 'linux/amd64'
   identifier=images.get(a[2],a[2])
   if '--format' in a:return identifier
   return json.dumps([{'Id':identifier,'RepoTags':[tag for tag,ident in images.items() if ident==identifier]}])
  if a[0]=='exec' and a[3]=='pg_restore':database.write_bytes(Path(kw['input_file']).read_bytes())
  if a[0]=='run' and '--mount' in a:
   if 'node' in a and 'MAINTENANCE_ABSENT' in a[-1]:
    if variant=='stale-gate':raise ValueError('VPS maintenance gate unavailable')
    return 'MAINTENANCE_ABSENT'
   elif 'node' in a and 'MAINTENANCE_SET' in a[-1]:
    (webdata/'.castlink-update-maintenance').write_text('maintenance')
    if variant=='gate-set-unknown':raise ValueError('VPS maintenance gate unavailable')
    return 'MAINTENANCE_SET'
   elif 'node' in a and 'MAINTENANCE_CLEARED' in a[-1]:
    (webdata/'.castlink-update-maintenance').unlink(missing_ok=True)
    if variant=='cleanup-unknown' or variant=='lost-ack-retry' and release['commit']=='b'*40 and not ack_lost:
     ack_lost=True;raise ValueError('VPS maintenance gate unavailable')
    return 'MAINTENANCE_CLEARED'
   elif 'node' in a:
    for p in webdata.iterdir():p.unlink()
   elif 'tar' in a:
    with tarfile.open(kw['input_file'],'r:') as t:
     member=t.getmember('peer.json');assert member.isfile();(webdata/'peer.json').write_bytes(t.extractfile(member).read())
  if a[0]=='cp':
   with tarfile.open(kw['output'],'w') as t:
    b=(webdata/'peer.json').read_bytes();info=tarfile.TarInfo('peer.json');info.size=len(b);t.addfile(info,io.BytesIO(b))
  return ''
 def compose(folder,*a,**kw):
  global work_exists,ack_lost
  calls.append(list(a))
  if a[0]=='up' and 'converter-work' in json.loads((root/'compose.json').read_text())['volumes']:work_exists=True

  if kw.get('output'):Path(kw['output']).write_bytes(b'PGDMP-private-snapshot')
  if a[0]=='up' and variant=='start-fails' and json.loads((root/'compose.json').read_text())['services']['web']['image']==release['imageIdentities']['web']:raise ValueError('Remote operation refused')
  return ''
 m.docker=docker;m.compose=compose
 def health(folder,data,expected):
  health_calls.append(expected)
  if expected.endswith(new[:12]):assert (webdata/'.castlink-update-maintenance').exists(),'candidate exposed before health verification'
  if (variant in ['health','rollback-fails','writes-fail','hangup','legacy-health'] or variant.endswith('work-health')) and expected.endswith(new[:12]):
   (webdata/'peer.json').write_text('candidate-mutated');(webdata/'new-file').write_text('candidate-new-data');database.write_bytes(b'candidate-mutated-db')
   if variant=='hangup':os.kill(os.getpid(),m.signal.SIGHUP)
   raise ValueError('VPS update health deadline exceeded')
  if variant=='rollback-fails':raise ValueError('rollback failure')
 m.update_health=health
 if variant=='retention-fails':m.retention_postcommit=lambda *a: (_ for _ in ()).throw(ValueError('cleanup failed'))
 try:
  operation=m.update if variant=='hangup' else lambda d:m.update_locked(root,d)
  if variant in ['three-updates','lost-ack-retry']:
   for letter in (['b','c'] if variant=='lost-ack-retry' else ['b','c','d']):
    new=letter*40;release['commit']=new;release['images']={n:'castlink-easy-'+n+':'+new for n in m.SERVICES};release['imageIdentities']['web']='sha256:'+letter*64
    request={'installationId':iid,'origin':identity['origin'],'host':'8.8.8.8','releaseCommit':new,'releaseCommitPrefix':new[:12],'releaseUrl':'fixture','releaseSha256':'c'*64}
    if variant=='lost-ack-retry' and letter=='b':
     try:operation(request);raise AssertionError('lost acknowledgement expected')
     except ValueError as lost:assert 'maintenance gate' in str(lost)
     result=operation(request);assert result['outcome']=='current'
    else:result=operation(request)
  else:result=operation({'installationId':iid,'origin':identity['origin'],'host':'8.8.8.8','releaseCommit':new,'releaseCommitPrefix':new[:12],'releaseUrl':'fixture','releaseSha256':'c'*64})
  error=None
 except ValueError as e:result=None;error=str(e)
 preserved=all((root/n).read_bytes()==b for n,b in original.items() if n!='compose.json')
 restored=(root/'compose.json').read_bytes()==original['compose.json']
 print(json.dumps({'images':sorted(images),'workExists':work_exists,'model':json.loads((root/'compose.json').read_text()),'maintenance':(webdata/'.castlink-update-maintenance').exists(),'dataRestored':(webdata/'peer.json').read_text()=='original-peer-secret' and not (webdata/'new-file').exists() and database.read_bytes()==b'PGDMP-private-snapshot','result':result,'error':error,'calls':calls,'preserved':preserved,'restored':restored,'health':health_calls,'backups':[p.name for p in (root/'backups').glob('*')] if (root/'backups').exists() else []}))
`;
async function run(variant){return JSON.parse((await execute(process.env.CASTLINK_PYTHON||'python3',['-c',harness.replace('SCRIPT',JSON.stringify(script)).replace('VARIANT',JSON.stringify(variant))],{encoding:'utf8',env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})).stdout.trim().split('\n').at(-1));}
test('existing VPS update backs up config and data, switches only exact web and preserves all other files',async()=>{
 const r=await run('success');assert.equal(r.error,null);assert.equal(r.result.outcome,'updated');assert.equal(r.preserved,true);assert.equal(r.backups.length,1);assert.equal(r.result.installationId,'11111111-1111-4111-8111-111111111111');
 assert.equal(r.model.services['presentation-converter'].image,r.model.services.web.image);
 const up=r.calls.filter(c=>c[0]==='up');assert.equal(up.length,1);assert.ok(up[0].includes('presentation-converter'));assert.equal(up[0].at(-1),'web');assert.ok(up[0].includes('--no-deps'));assert.ok(up[0].includes('--pull'));assert.ok(up[0].includes('never'));assert.ok(r.calls.some(c=>c[0]==='stop'&&c[1]==='web'));assert.ok(!r.calls.some(c=>['down','prune','rm'].includes(c[0])||c[0]==='volume'&&c[1]==='rm'));
});
test('legacy installations receive converter and readonly socket without changing other services',async()=>{
 const r=await run('legacy');assert.equal(r.error,null);assert.equal(r.result.outcome,'updated');assert.equal(r.preserved,true);
 assert.equal(r.model.services['presentation-converter'].image,r.model.services.web.image);
 assert.deepEqual(r.model.services.web.volumes,['web-data:/data','converter-socket:/run/castlink-converter:ro']);
 assert.ok(r.calls.find(c=>c[0]==='up').includes('presentation-converter'));
});
test('failed legacy upgrade restores original compose and removes only newly introduced converter',async()=>{
 const r=await run('legacy-health');assert.match(r.error,/previous web restored/);assert.equal(r.restored,true);assert.equal(r.dataRestored,true);
 assert.equal(r.model.services['presentation-converter'],undefined);assert.ok(r.calls.some(c=>c[0]==='rm'&&c.at(-1)==='presentation-converter'));
});
test('target mismatch, active media, unsupported migration or insufficient disk refuses before stopping web',async()=>{
 for(const v of ['wrong-identity','active','migration','disk']){const r=await run(v);assert.ok(r.error,v);assert.equal(r.preserved,true);assert.equal(r.restored,true);assert.ok(!r.calls.some(c=>c[0]==='stop'),v);}
});
test('candidate start or health failure restores exact previous compose and only the old web',async()=>{
 for(const v of ['health','start-fails']){const r=await run(v);assert.match(r.error,/previous web restored/);assert.equal(r.restored,true);assert.equal(r.preserved,true);assert.equal(r.calls.filter(c=>c[0]==='up').length,2);assert.ok(r.health.at(-1).endsWith('aaaaaaaaaaaa'));assert.equal(r.backups.length,1);}
});
test('failed rollback retains private backup and reports recovery required',async()=>{const r=await run('rollback-fails');assert.match(r.error,/rollback failed/);assert.equal(r.backups.length,1);assert.equal(r.preserved,true);});

test('candidate file and SQL writes are undone before old web restarts after failed health',async()=>{const r=await run('writes-fail');assert.match(r.error,/previous web restored/);assert.equal(r.dataRestored,true);assert.ok(r.calls.some(c=>c.includes('pg_restore')));assert.ok(r.calls.filter(c=>c.includes('--mount')).every(c=>c[c.indexOf('--mount')+1].includes('castlink-easy-11111111111141118111111111111111_web-data')));});
test('transported release uses local imported ID when Docker store differs from CI',async()=>{const r=await run('cross-store');assert.equal(r.error,null);assert.equal(r.result.outcome,'updated');});
test('SSH hangup after candidate writes triggers verified data and web rollback',{skip:process.platform==='win32'},async()=>{const r=await run('hangup');assert.match(r.error,/previous web restored/);assert.equal(r.dataRestored,true);assert.equal(r.restored,true);});

test('post-stop participant arrival refuses replacement and resumes previous web',async()=>{const r=await run('late-active');assert.match(r.error,/previous web restored/);assert.equal(r.restored,true);assert.equal(r.maintenance,false);assert.equal(r.calls.filter(c=>c[0]==='up').length,1);});

test('lost final maintenance-clear acknowledgement never rolls healthy candidate data back',async()=>{const r=await run('cleanup-unknown');assert.match(r.error,/maintenance gate/);assert.equal(r.calls.filter(c=>c[0]==='up').length,1);assert.equal(r.restored,false);assert.equal(r.maintenance,false);assert.equal(r.backups.length,1);});

test('lost acknowledgement after initial gate creation clears own marker without stopping current web',async()=>{const r=await run('gate-set-unknown');assert.match(r.error,/maintenance gate/);assert.equal(r.maintenance,false);assert.equal(r.restored,true);assert.ok(!r.calls.some(c=>c[0]==='stop'||c[0]==='up'));});

test('preexisting maintenance marker refuses a new job instead of claiming current or clearing another transaction',async()=>{const r=await run('stale-gate');assert.match(r.error,/maintenance gate/);assert.ok(!r.calls.some(c=>c[0]==='stop'||c.includes('MAINTENANCE_CLEARED')));assert.equal(r.restored,true);});

test('failed legacy update removes only newly-created owned converter work after rollback',async()=>{
 const r=await run('legacy-work-health');assert.match(r.error,/previous web restored/);assert.equal(r.workExists,false);assert.equal(r.restored,true);
 const removed=r.calls.filter(c=>c[0]==='volume'&&c[1]==='rm');assert.equal(removed.length,1);assert.equal(removed[0][2],'castlink-easy-11111111111141118111111111111111_converter-work');
});
test('failed legacy update preserves preexisting owned converter work',async()=>{
 const r=await run('legacy-preexisting-work-health');assert.match(r.error,/previous web restored/);assert.equal(r.workExists,true);assert.equal(r.restored,true);assert.equal(r.calls.some(c=>c[0]==='volume'&&c[1]==='rm'),false);
});
test('foreign converter work refuses legacy update before stopping services',async()=>{
 const r=await run('legacy-foreign-work-health');assert.ok(r.error);assert.equal(r.workExists,true);assert.equal(r.calls.some(c=>c[0]==='stop'||c[0]==='volume'&&c[1]==='rm'),false);
});

test('retention failure after commit leaves the healthy candidate running without restoring data',async()=>{const r=await run('retention-fails');assert.equal(r.error,null);assert.equal(r.result.outcome,'updated');assert.equal(r.result.cleanupWarning,true);assert.equal(r.restored,false);assert.equal(r.calls.filter(c=>c[0]==='up').length,1);assert.equal(r.calls.some(c=>c.includes('pg_restore')),false);});

test('three actual healthy web VPS updates leave two web versions and one verified snapshot',async()=>{const r=await run('three-updates');assert.equal(r.error,null);assert.equal(r.result.cleanupWarning,undefined);assert.deepEqual(r.images.filter(t=>t.startsWith('castlink-easy-web:')),['castlink-easy-web:'+ 'c'.repeat(40),'castlink-easy-web:'+ 'd'.repeat(40)]);assert.equal(r.backups.length,1);assert.match(r.backups[0],/^web-dddddddddddd-/);assert.equal(r.calls.filter(c=>c[0]==='up').length,3);assert.ok(!r.calls.some(c=>c.includes('pg_restore')&&c.includes('--clean')));});

test('lost maintenance-clear acknowledgement then current retry preserves the true previous successful image',async()=>{const r=await run('lost-ack-retry');assert.equal(r.error,null);assert.deepEqual(r.images.filter(t=>t.startsWith('castlink-easy-web:')),['castlink-easy-web:'+ 'b'.repeat(40),'castlink-easy-web:'+ 'c'.repeat(40)]);assert.equal(r.calls.filter(c=>c[0]==='up').length,2);assert.ok(!r.calls.some(c=>c.includes('--clean')));});

test('canonical metadata permits the verified VPS update while historical alias remains supported',async()=>{const r=await run('canonical');assert.equal(r.error,null);assert.equal(r.result.outcome,'updated');});
