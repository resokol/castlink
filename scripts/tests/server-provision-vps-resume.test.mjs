import test from 'node:test';
import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const run=promisify(execFile);
const script=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../server-provision-vps.py');

test('partial reserve accepts only its pinned release, files and existing secrets',async()=>{
 const root=await mkdtemp(path.join(os.tmpdir(),'castlink-resume-'));
 try{
  const code=`import importlib.util,json,pathlib,hashlib,sys,tarfile,io
s=importlib.util.spec_from_file_location('p',sys.argv[1]);m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
# Exercise Linux provisioning logic on Windows without weakening production O_NOFOLLOW.
if __import__('os').name=='nt':
 def fixture_private_file(location,text):
  with location.open('x',encoding='utf-8') as output:output.write(text)
 m.private_file=fixture_private_file
folder=pathlib.Path(sys.argv[2])/'castlink-easy-11111111111141118111111111111111';folder.mkdir()
(folder/'payload').mkdir()
commit='a'*40
release={'schemaVersion':1,'commit':commit,'images':{k:'castlink-easy-'+k+':'+commit for k in m.SERVICES},'distributionRepository':'resokol/castlink-releases','capabilities':['peer-profile-v1','root-ssh-v1'],'imageArchiveSha256':hashlib.sha256(b'images').hexdigest()}
(folder/'payload/images.tar.gz').write_bytes(b'images');(folder/'payload/release.json').write_text(json.dumps(release))
with tarfile.open(folder/'release.tar.gz','w:gz') as archive:
 body=(folder/'payload/release.json').read_bytes();info=tarfile.TarInfo('payload/release.json');info.size=len(body);archive.addfile(info,io.BytesIO(body))
config=m.configuration('8.8.8.8',release,'11111111-1111-4111-8111-111111111111')
old=m.without_presentation_converter(config['compose'])
for service in old['services'].values():
 for key in ['mem_limit','memswap_limit','logging']:service.pop(key)
old['services']['postgres'].pop('command');old['services']['livekit'].pop('environment');old['services']['livekit']['ports']=['7881:7881/tcp','61000-61100:61000-61100/udp','3478:3478/udp','30000-30999:30000-30999/udp']
(folder/'compose.json').write_text(json.dumps(old))
legacy=json.loads(config['files']['livekit.json']);legacy['rtc'].pop('udp_port');legacy['rtc'].update(port_range_start=61000,port_range_end=61100);legacy['turn']['relay_range_end']=30999
(folder/'livekit.json').write_text(json.dumps(legacy))
for name in ['postgres.env','Caddyfile']:(folder/name).write_text(config['files'][name])
(folder/'web.env').write_text(''.join(line for line in config['files']['web.env'].splitlines(keepends=True) if not line.startswith('NODE_OPTIONS=')))
data={'host':'8.8.8.8','releaseSha256':hashlib.sha256((folder/'release.tar.gz').read_bytes()).hexdigest(),'releaseCommit':commit,'releaseCommitPrefix':commit[:12]}
same=m.verified_partial(folder,config['state'],data)
assert same['state']==config['state'] and same['state']['password']==config['state']['password']
old['services']['foreign']={'image':'foreign'};(folder/'compose.json').write_text(json.dumps(old))
try:m.verified_partial(folder,config['state'],data);foreign='accepted'
except ValueError:foreign='rejected'
old['services'].pop('foreign');(folder/'compose.json').write_text(json.dumps(old))
tampered=dict(config['state']);tampered['password']='b'*64
try:m.verified_partial(folder,tampered,data);secret='accepted'
except ValueError:secret='rejected'
data['releaseSha256']='b'*64
try:m.verified_partial(folder,config['state'],data);release_result='accepted'
except ValueError:release_result='rejected'
data['releaseSha256']=hashlib.sha256((folder/'release.tar.gz').read_bytes()).hexdigest()
(folder/'payload/release.json').write_text('{}')
try:m.verified_partial(folder,config['state'],data);manifest='accepted'
except ValueError:manifest='rejected'
(folder/'payload/release.json').write_text(json.dumps(release))
m.partial_installation=lambda address:(folder,config['state']);m.discover=lambda:[];m.ports_available=lambda *_:None;m.event=lambda **values:None;m.docker=lambda *args,**kwargs:''
def no_download(*args):raise AssertionError('resume attempted download')
m.download_release=no_download
def compose(folder,*args,body=None,**kwargs):
 if '/app/scripts/setup-database-v1.mjs' in args:
  request=json.loads(body);return json.dumps({**request,'contract':'castlink-database-v1','migrations':{'roomVersions':[1,2,3,4,5,6],'controlVersions':[1,2,3,4,5],'schema':True,'hashes':True},'seed':None if request['phase']=='migrations' else {'installations':1,'accounts':1,'organizations':1,'memberships':1,'nodes':1,'studios':1,'rooms':0}})
 if '/app/scripts/server-profile-store.mjs' in args:return json.dumps({'installationId':config['state']['installationId'],'id':config['state']['nodeId'],'origin':'https://8.8.8.8'})
 return ''
m.compose=compose
identity=m.deploy(data)
final=json.loads((folder/'.castlink-install.json').read_text())
assert identity['installationId']==final['installationId'] and final['completed'] is True and final['password']==config['state']['password'] and final['livekitSecret']==config['state']['livekitSecret']
print(json.dumps({'identity':same['state']['installationId'],'foreign':foreign,'secret':secret,'release':release_result,'manifest':manifest,'resumed':final['installationId']}))`;
  const result=JSON.parse((await run(process.env.CASTLINK_PYTHON||'python3',['-c',code,script,root],{env:{...process.env,PYTHONDONTWRITEBYTECODE:'1'}})).stdout);
  assert.deepEqual(result,{identity:'11111111-1111-4111-8111-111111111111',foreign:'rejected',secret:'rejected',release:'rejected',manifest:'rejected',resumed:'11111111-1111-4111-8111-111111111111'});
 }finally{await rm(root,{recursive:true,force:true});}
});
