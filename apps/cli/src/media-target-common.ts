import type {MediaRoomReceipt} from './media-check.js';
import {nodeSqlGuard,pythonSqlGuard} from './target-sql-guard.js';
import {nodeObserver,pythonObserver} from './setup-verification-target.js';
export type MediaFileAssociation={dev:number;ino:number;mode:384;sha256:string};
export type MediaArtifactAuthority={association:MediaFileAssociation;ledgerAssociation:MediaFileAssociation;present:boolean};
export type MediaAuthority={run:MediaFileAssociation|null;room:{receipt:MediaRoomReceipt;association:MediaFileAssociation}|null;artifacts:Partial<Record<'guest-entry.txt'|'report.json'|'browser-evidence.json',MediaArtifactAuthority>>};
export type MediaTargetBinding={installationId:string;nodeId:string;origin:string;studioId:string;runId:string;caddyContainerId:string;caddyImageId:string;caSHA:string;targetSessionFile:MediaFileAssociation&{path:string}};
export type MediaPrivateArtifact={schemaVersion:1;contract:'castlink-media-private-v1';target:'local'|'remote';runId:string;studioId:string;room:string;path:string;association:MediaFileAssociation};
// Reuse only the audited bounded file/archive/CA primitives. Setup/bootstrap
// observers are never invoked: the caller supplies an existing Studio session.
export const nodeMediaCommon=nodeSqlGuard+nodeObserver.slice(0,nodeObserver.indexOf('function validate(r)'))+nodeObserver.slice(nodeObserver.indexOf('function ca(r)'),nodeObserver.indexOf('function server(r)'))+String.raw`
const mediaUUID=/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/;
function mediaValidate(e,fields){
 if(!keys(e,'binding,guard,'+fields))fail();const b=e.binding,g=e.guard;
 if(!keys(b,'installationId,nodeId,origin,studioId,runId,caddyContainerId,caddyImageId,caSHA,targetSessionFile')||!mediaUUID.test(b.installationId)||b.nodeId!=='srv-'+b.installationId.replaceAll('-','')||!mediaUUID.test(b.runId)||!/^studio-[a-z0-9][a-z0-9-]{0,120}$/.test(b.studioId)||!keys(b.targetSessionFile,'path,dev,ino,mode,sha256'))fail();
 const {path:p,...a}=b.targetSessionFile;absolute(p);association(a);const u=new URL(b.origin);if(u.protocol!=='https:'||u.origin!==b.origin||u.username||u.password||u.hostname==='')fail();
 if(!/^[a-f0-9]{64}$/.test(b.caddyContainerId)||!/^sha256:[a-f0-9]{64}$/.test(b.caddyImageId)||!/^[a-f0-9]{64}$/.test(b.caSHA)||g.operation.kind!=='owner'||g.operation.installationId!==b.installationId||g.containerId===b.caddyContainerId)fail();return b;
}
function mediaCheck(e,l,readonly=false){
 const b=e.binding,g=e.guard;sqlGuardCheck(g,l,b.installationId,b.nodeId);if(!readonly)dispatchTargetOperation(l);
 const inspected=JSON.parse(run(['inspect',b.caddyContainerId]).toString());if(!Array.isArray(inspected)||inspected.length!==1)fail();const c=inspected[0],labels=c.Config.Labels;
 if(c.Id!==b.caddyContainerId||c.Image!==b.caddyImageId||c.State.Running!==true||labels['com.docker.compose.project']!==g.project||labels['com.docker.compose.service']!=='caddy'||labels['com.docker.compose.project.working_dir']!==g.operation.root||labels['com.docker.compose.project.config_files']!==path.join(g.operation.root,'compose.yaml'))fail();
 const cert=ca(b);if(hash(cert)!==b.caSHA)fail();const {path:p,...a}=b.targetSessionFile,secret=read(p,a).toString('utf8');if(!/^(?:studiolink-studio|castlink-studio-owner-[a-f0-9]{24})=[A-Za-z0-9._~-]{1,4000}$/.test(secret))fail();return{cert,secret};
}
function mediaPath(e,name){if(!['binding.json','create-intent.json','invite-intent.json','delete-intent.json','invite-artifact.json','report-artifact.json','browser-evidence-artifact.json','room.json','guest-entry.txt','report.json','browser-evidence.json'].includes(name))fail();return path.join(e.guard.operation.root,'.castlink-media',e.binding.runId,name)}
function mediaStable(e){const {operation,...guard}=e.guard;const {epoch,...op}=operation;return{schemaVersion:1,binding:e.binding,guard:{...guard,operation:op}}}
// Expected metadata comes from the adapter's original ACKs, never a current-path capture.
function mediaAuthority(e){const a=e.authority;if(!keys(a,'run,room,artifacts')||!a.artifacts||typeof a.artifacts!=='object'||Array.isArray(a.artifacts)||Object.keys(a.artifacts).some(k=>!['guest-entry.txt','report.json','browser-evidence.json'].includes(k)))fail();if(a.run!==null)association(a.run);if(a.room!==null){if(!keys(a.room,'receipt,association'))fail();association(a.room.association)}for(const record of Object.values(a.artifacts)){if(!keys(record,'association,ledgerAssociation,present')||typeof record.present!=='boolean')fail();association(record.association);association(record.ledgerAssociation)}return a}
function mediaRun(e){const a=mediaAuthority(e);if(a.run===null)fail();directory(path.dirname(mediaPath(e,'binding.json')),true);const b=read(mediaPath(e,'binding.json'),a.run);eq(parse(b.toString()),mediaStable(e))||fail()}
function mediaWrite(e,l,name,bytes){if(bytes.length>65536||!bytes.length)fail();mediaCheck(e,l);const p=mediaPath(e,name);directory(path.dirname(p),true);const fd=fs.openSync(p,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,384);let a;try{fs.writeFileSync(fd,bytes);fs.fsyncSync(fd);const held=fs.fstatSync(fd);if(!held.isFile()||held.nlink!==1||held.uid!==process.getuid()||(held.mode&511)!==384||held.size!==bytes.length)fail();a={dev:held.dev,ino:held.ino,mode:384,sha256:hash(bytes)}}finally{fs.closeSync(fd)}leaseSync(path.dirname(p));mediaCheck(e,l);read(p,a);return a}
function mediaRemove(e,l,name,a){association(a);const p=mediaPath(e,name);read(p,a);mediaCheck(e,l);read(p,a);fs.unlinkSync(p);leaseSync(path.dirname(p));mediaCheck(e,l);if(fs.existsSync(p))fail()}
function mediaArtifactRecord(name){const record={'guest-entry.txt':'invite-artifact.json','report.json':'report-artifact.json','browser-evidence.json':'browser-evidence-artifact.json'}[name];if(!record)fail();return record}
function mediaWriteArtifact(e,l,name,bytes){if(Object.hasOwn(e.authority.artifacts,name))fail();const a=mediaWrite(e,l,name,bytes),ledgerAssociation=mediaWrite(e,l,mediaArtifactRecord(name),Buffer.from(JSON.stringify(a)));read(mediaPath(e,name),a);read(mediaPath(e,mediaArtifactRecord(name)),ledgerAssociation);return{association:a,ledgerAssociation}}
function mediaExists(p){try{fs.lstatSync(p);return true}catch(error){if(error.code==='ENOENT')return false;throw error}}
function mediaArtifactCheck(e,name){const original=mediaAuthority(e).artifacts[name];if(!original)fail();const stored=parse(read(mediaPath(e,mediaArtifactRecord(name)),original.ledgerAssociation).toString());if(!eq(stored,original.association))fail();if(original.present)read(mediaPath(e,name),original.association);else if(mediaExists(mediaPath(e,name)))fail();return original}
function mediaRemoveArtifact(e,l,name,a){const original=mediaArtifactCheck(e,name);if(!original.present||!eq(original.association,a))fail();mediaRemove(e,l,name,original.association)}
function mediaReceipt(e){mediaRun(e);const original=e.authority.room;if(original===null)fail();const v=parse(read(mediaPath(e,'room.json'),original.association).toString());if(!eq(v,original.receipt))fail();if(!keys(v,'schemaVersion,contract,studioId,name,association')||v.schemaVersion!==1||v.contract!=='castlink-media-room-v2'||v.studioId!==e.binding.studioId||v.name!=='cli-media-'+e.binding.runId||!keys(v.association,'creationId,revision')||!Object.values(v.association).every(x=>typeof x==='string'&&mediaUUID.test(x)))fail();return v}
function mediaArtifact(e,a){return{schemaVersion:1,contract:'castlink-media-private-v1',runId:e.binding.runId,studioId:e.binding.studioId,room:'cli-media-'+e.binding.runId,path:mediaPath(e,'guest-entry.txt'),association:a}}
function mediaDone(l,value){releaseTargetOperation(l,true);console.log(JSON.stringify(value))}
`;
export const pythonMediaCommon=pythonSqlGuard+pythonObserver.slice(0,pythonObserver.indexOf('def validate(r):'))+pythonObserver.slice(pythonObserver.indexOf('def ca(r):'),pythonObserver.indexOf('def server(r):'))+String.raw`
# The observer's legacy capture is replaced with the bounded/reaped guard capture.
def run(args,input=None,cap=262144): return sql_guard_capture(['docker']+args,input,cap,10)
def media_equal(a,b):
 return json.dumps(a,sort_keys=True,separators=(',',':'),allow_nan=False)==json.dumps(b,sort_keys=True,separators=(',',':'),allow_nan=False)
media_uuid='[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}'
def media_validate(e,fields):
 if not isinstance(e,dict) or set(e)!={'binding','guard'}|set(fields): fail()
 b=e['binding'];g=e['guard']
 if not isinstance(b,dict) or set(b)!={'installationId','nodeId','origin','studioId','runId','caddyContainerId','caddyImageId','caSHA','targetSessionFile'} or re.fullmatch(media_uuid,b['installationId']) is None or b['nodeId']!='srv-'+b['installationId'].replace('-','') or re.fullmatch(media_uuid,b['runId']) is None or re.fullmatch('studio-[a-z0-9][a-z0-9-]{0,120}',b['studioId']) is None or set(b['targetSessionFile'])!={'path','dev','ino','mode','sha256'}: fail()
 a={k:v for k,v in b['targetSessionFile'].items() if k!='path'};absolute(b['targetSessionFile']['path']);association(a)
 from urllib.parse import urlsplit
 u=urlsplit(b['origin'])
 if u.scheme!='https' or not u.hostname or u.username or u.password or u.path or u.query or u.fragment or b['origin']!='https://'+u.netloc: fail()
 if re.fullmatch('[a-f0-9]{64}',b['caddyContainerId']) is None or re.fullmatch('sha256:[a-f0-9]{64}',b['caddyImageId']) is None or re.fullmatch('[a-f0-9]{64}',b['caSHA']) is None or g['operation']['kind']!='owner' or g['operation']['installationId']!=b['installationId'] or g['containerId']==b['caddyContainerId']: fail()
 return b

def media_check(e,l,readonly=False):
 b=e['binding'];g=e['guard'];sql_guard_check(g,l,b['installationId'],b['nodeId'])
 if not readonly: dispatch_target_operation(l)
 inspected=parse(run(['inspect',b['caddyContainerId']]))
 if not isinstance(inspected,list) or len(inspected)!=1: fail()
 c=inspected[0];labels=c['Config']['Labels']
 if c['Id']!=b['caddyContainerId'] or c['Image']!=b['caddyImageId'] or c['State']['Running'] is not True or labels.get('com.docker.compose.project')!=g['project'] or labels.get('com.docker.compose.service')!='caddy' or labels.get('com.docker.compose.project.working_dir')!=g['operation']['root'] or labels.get('com.docker.compose.project.config_files')!=g['operation']['root']+'/compose.yaml': fail()
 cert=ca(b)
 context=ssl.create_default_context(cadata=cert.decode())
 if context.cert_store_stats()!={'x509':1,'crl':0,'x509_ca':1} or hashlib.sha256(cert).hexdigest()!=b['caSHA']: fail()
 s=b['targetSessionFile'];secret=read(s['path'],{k:v for k,v in s.items() if k!='path'}).decode()
 if re.fullmatch('(?:studiolink-studio|castlink-studio-owner-[a-f0-9]{24})=[A-Za-z0-9._~-]{1,4000}',secret) is None: fail()
 return cert,secret

def media_path(e,name):
 if name not in ('binding.json','create-intent.json','invite-intent.json','delete-intent.json','invite-artifact.json','report-artifact.json','browser-evidence-artifact.json','room.json','guest-entry.txt','report.json','browser-evidence.json'): fail()
 return e['guard']['operation']['root']+'/.castlink-media/'+e['binding']['runId']+'/'+name

def media_stable(e):
 g=dict(e['guard']);g['operation']={k:v for k,v in g['operation'].items() if k!='epoch'}
 return {'schemaVersion':1,'binding':e['binding'],'guard':g}

def media_authority(e):
 a=e['authority']
 if not isinstance(a,dict) or set(a)!={'run','room','artifacts'} or not isinstance(a['artifacts'],dict) or any(k not in ('guest-entry.txt','report.json','browser-evidence.json') for k in a['artifacts']): fail()
 if a['run'] is not None: association(a['run'])
 if a['room'] is not None:
  if not isinstance(a['room'],dict) or set(a['room'])!={'receipt','association'}: fail()
  association(a['room']['association'])
 for record in a['artifacts'].values():
  if not isinstance(record,dict) or set(record)!={'association','ledgerAssociation','present'} or type(record['present']) is not bool: fail()
  association(record['association']);association(record['ledgerAssociation'])
 return a

def media_run(e):
 a=media_authority(e)
 if a['run'] is None: fail()
 directory(os.path.dirname(media_path(e,'binding.json')),True)
 if not media_equal(parse(read(media_path(e,'binding.json'),a['run'])),media_stable(e)): fail()

def media_write(e,l,name,b):
 if not 0<len(b)<=65536: fail()
 media_check(e,l);p=media_path(e,name);directory(os.path.dirname(p),True);fd=os.open(p,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
 try:
  pos=0
  while pos<len(b): pos+=os.write(fd,b[pos:])
  os.fsync(fd);held=os.fstat(fd)
  if not stat.S_ISREG(held.st_mode) or held.st_nlink!=1 or held.st_uid!=os.geteuid() or stat.S_IMODE(held.st_mode)!=0o600 or held.st_size!=len(b): fail()
  a={'dev':held.st_dev,'ino':held.st_ino,'mode':0o600,'sha256':hashlib.sha256(b).hexdigest()}
 finally: os.close(fd)
 lease_sync(os.path.dirname(p));media_check(e,l);read(p,a);return a

def media_remove(e,l,name,a):
 association(a);p=media_path(e,name);read(p,a);media_check(e,l);read(p,a);os.unlink(p);lease_sync(os.path.dirname(p));media_check(e,l)
 if os.path.lexists(p): fail()

def media_artifact_record(name):
 record={'guest-entry.txt':'invite-artifact.json','report.json':'report-artifact.json','browser-evidence.json':'browser-evidence-artifact.json'}.get(name)
 if record is None: fail()
 return record

def media_write_artifact(e,l,name,b):
 if name in e['authority']['artifacts']: fail()
 a=media_write(e,l,name,b);ledger=media_write(e,l,media_artifact_record(name),json.dumps(a,separators=(',',':')).encode());read(media_path(e,name),a);read(media_path(e,media_artifact_record(name)),ledger);return {'association':a,'ledgerAssociation':ledger}

def media_artifact_check(e,name):
 original=media_authority(e)['artifacts'].get(name)
 if original is None: fail()
 stored=parse(read(media_path(e,media_artifact_record(name)),original['ledgerAssociation']))
 if not media_equal(stored,original['association']): fail()
 if original['present']: read(media_path(e,name),original['association'])
 elif os.path.lexists(media_path(e,name)): fail()
 return original

def media_remove_artifact(e,l,name,a):
 original=media_artifact_check(e,name)
 if not original['present'] or not media_equal(original['association'],a): fail()
 media_remove(e,l,name,original['association'])

def media_receipt(e):
 media_run(e);original=e['authority']['room']
 if original is None: fail()
 v=parse(read(media_path(e,'room.json'),original['association']))
 if not media_equal(v,original['receipt']): fail()
 if not isinstance(v,dict) or set(v)!={'schemaVersion','contract','studioId','name','association'} or v['schemaVersion']!=1 or v['contract']!='castlink-media-room-v2' or v['studioId']!=e['binding']['studioId'] or v['name']!='cli-media-'+e['binding']['runId'] or set(v['association'])!={'creationId','revision'} or any(not isinstance(x,str) or re.fullmatch(media_uuid,x) is None for x in v['association'].values()): fail()
 return v

def media_artifact(e,a): return {'schemaVersion':1,'contract':'castlink-media-private-v1','runId':e['binding']['runId'],'studioId':e['binding']['studioId'],'room':'cli-media-'+e['binding']['runId'],'path':media_path(e,'guest-entry.txt'),'association':a}
def media_done(l,v):
 release_target_operation(l,True);print(json.dumps(v,separators=(',',':')))
`;
export const nodeMediaEntry=(body:string)=>String.raw`
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(Buffer.byteLength(input)>131072)process.exit(3)});process.stdin.on('end',async()=>{try{const e=parse(input);${body}}catch{console.log('{"schemaVersion":1,"contract":"castlink-media-target-v1","ok":false,"diagnosis":"media-target-unverified"}');process.exitCode=3}});
`;
export const pythonMediaEntry=(body:string)=>String.raw`
try:
 raw=sys.stdin.buffer.read(131073)
 if len(raw)>131072: fail()
 e=parse(raw)
 ${body.trim().split('\n').join('\n ')}
except Exception:
 print('{"schemaVersion":1,"contract":"castlink-media-target-v1","ok":false,"diagnosis":"media-target-unverified"}');sys.exit(3)
`;
