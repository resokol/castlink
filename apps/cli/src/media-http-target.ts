import {nodeSqlGuard,pythonSqlGuard} from './target-sql-guard.js';
import {nodeMediaCommon,pythonMediaCommon,nodeMediaEntry,pythonMediaEntry} from './media-target-common.js';
export const nodeMediaHttpTarget=nodeMediaCommon+String.raw`
function mediaHttp(b,cert,secret,route,body){return new Promise((resolve,reject)=>{const bytes=body===undefined?undefined:JSON.stringify(body),q=https.request(b.origin+route,{method:bytes===undefined?'GET':'POST',headers:{Cookie:secret,Origin:b.origin,'Content-Type':'application/json',...(bytes?{'Content-Length':Buffer.byteLength(bytes)}:{})},ca:cert,rejectUnauthorized:true,agent:false,signal:AbortSignal.timeout(5000)},s=>{let chunks=[],size=0;if(s.statusCode!==200||s.headers['content-encoding']&&s.headers['content-encoding']!=='identity'){s.resume();reject(Error());return}s.on('data',v=>{size+=v.length;if(size>16384){q.destroy();reject(Error())}else chunks.push(v)});s.on('error',()=>reject(Error()));s.on('end',()=>{try{resolve(parse(Buffer.concat(chunks).toString('utf8')))}catch{reject(Error())}})});q.on('error',()=>reject(Error()));q.end(bytes)})}
function mediaBody(e){const b=e.binding,v=e.body,name='cli-media-'+b.runId;if(!v||v.studioId!==b.studioId)fail();
 if(e.route==='/api/rooms'&&v.action==='create'){if(!keys(v,'action,name,password,studioId,diagnostic')||v.name!==name||v.diagnostic!==true||typeof v.password!=='string'||!/^[a-f0-9]{64}$/.test(v.password))fail();return'create'}
 if(e.route==='/api/invites'&&v.action==='create'){if(!keys(v,'action,room,studioId,diagnostic,expectedDiagnosticAssociation')||v.room!==name||v.diagnostic!==true)fail();return'invite'}
 if(e.route==='/api/rooms'&&v.action==='delete'){if(!keys(v,'action,name,studioId,expectedDiagnosticAssociation')||v.name!==name)fail();return'delete'}fail();}
`+nodeMediaEntry(String.raw`
mediaValidate(e,'route,body,authority');mediaAuthority(e);const action=mediaBody(e),l=sqlGuard(e.guard,e.binding.installationId,e.binding.nodeId);mediaRun(e);const initial=mediaCheck(e,l);
if(action!=='create'&&!eq(e.body.expectedDiagnosticAssociation,mediaReceipt(e).association))fail();if(action==='create'&&e.authority.room!==null)fail();
if(action==='delete'){if(e.authority.artifacts['guest-entry.txt'])mediaArtifactCheck(e,'guest-entry.txt');else if(mediaExists(mediaPath(e,'guest-entry.txt'))||mediaExists(mediaPath(e,'invite-artifact.json')))fail()}
// Capability is checked with the same held binding before any room mutation.
if(action==='create'){const capability=await mediaHttp(e.binding,initial.cert,initial.secret,'/api/rooms?diagnostic=true&studioId='+encodeURIComponent(e.binding.studioId));if(!eq(capability,{schemaVersion:1,contract:'castlink-media-room-v2',studioId:e.binding.studioId,conditionalCleanup:true}))fail();mediaCheck(e,l)}
mediaWrite(e,l,action+'-intent.json',Buffer.from(JSON.stringify({action,runId:e.binding.runId})));mediaCheck(e,l);
const value=await mediaHttp(e.binding,initial.cert,initial.secret,e.route,e.body);mediaCheck(e,l);let result;
if(action==='create'){
 if(!keys(value,'schemaVersion,contract,studioId,name,association')||!keys(value.association,'creationId,revision')||!Object.values(value.association).every(x=>typeof x==='string'&&mediaUUID.test(x))||!eq(value,{schemaVersion:1,contract:'castlink-media-room-v2',studioId:e.binding.studioId,name:'cli-media-'+e.binding.runId,association:value.association}))fail();
 const association=mediaWrite(e,l,'room.json',Buffer.from(JSON.stringify(value)));result={schemaVersion:1,contract:'castlink-media-created-v1',receipt:value,association};
}else if(action==='invite'){
 if(!keys(value,'path')||typeof value.path!=='string'||value.path.length>8192||!value.path.startsWith('/room?'))fail();const u=new URL(value.path,e.binding.origin);if(u.origin!==e.binding.origin||u.pathname!=='/room'||u.searchParams.get('studioId')!==e.binding.studioId||u.searchParams.get('name')!=='cli-media-'+e.binding.runId||!/^#invite=[A-Za-z0-9._~%+-]+$/.test(u.hash))fail();
 const record=mediaWriteArtifact(e,l,'guest-entry.txt',Buffer.from(u.href));result={schemaVersion:1,contract:'castlink-media-invited-v1',artifact:mediaArtifact(e,record.association),ledgerAssociation:record.ledgerAssociation};
}else{
 if(!eq(value,{schemaVersion:1,contract:'castlink-media-room-v2',studioId:e.binding.studioId,name:'cli-media-'+e.binding.runId,deleted:true}))fail();
 if(e.authority.artifacts['guest-entry.txt']?.present)mediaRemoveArtifact(e,l,'guest-entry.txt',e.authority.artifacts['guest-entry.txt'].association);result=value;
}mediaCheck(e,l);mediaDone(l,result);
`);
export const pythonMediaHttpTarget=pythonMediaCommon+String.raw`
from urllib.parse import urlsplit,parse_qs,quote,urljoin

def media_http(b,cert,secret,route,body=None):
 u=urlsplit(b['origin']);context=ssl.create_default_context(cadata=cert.decode());conn=HTTPSConnection(u.hostname,u.port or 443,context=context,timeout=5);deadline=time.monotonic()+5
 try:
  headers={'Cookie':secret,'Origin':b['origin'],'Content-Type':'application/json'};raw=None if body is None else json.dumps(body,separators=(',',':')).encode()
  conn.request('GET' if body is None else 'POST',route,body=raw,headers=headers);sock=conn.sock;response=conn.getresponse()
  if response.status!=200 or response.getheader('Content-Encoding','identity')!='identity': fail()
  chunks=[];size=0
  while True:
   remaining=deadline-time.monotonic()
   if remaining<=0: fail()
   sock.settimeout(remaining);chunk=response.read1(min(4096,16385-size));size+=len(chunk)
   if size>16384: fail()
   if not chunk: break
   chunks.append(chunk)
  return parse(b''.join(chunks))
 finally: conn.close()

def media_body(e):
 b=e['binding'];v=e['body'];name='cli-media-'+b['runId']
 if not isinstance(v,dict) or v.get('studioId')!=b['studioId']: fail()
 if e['route']=='/api/rooms' and v.get('action')=='create':
  if set(v)!={'action','name','password','studioId','diagnostic'} or v['name']!=name or v['diagnostic'] is not True or not isinstance(v['password'],str) or re.fullmatch('[a-f0-9]{64}',v['password']) is None: fail()
  return 'create'
 if e['route']=='/api/invites' and v.get('action')=='create':
  if set(v)!={'action','room','studioId','diagnostic','expectedDiagnosticAssociation'} or v['room']!=name or v['diagnostic'] is not True: fail()
  return 'invite'
 if e['route']=='/api/rooms' and v.get('action')=='delete':
  if set(v)!={'action','name','studioId','expectedDiagnosticAssociation'} or v['name']!=name: fail()
  return 'delete'
 fail()
`+pythonMediaEntry(String.raw`
media_validate(e,('route','body','authority'));media_authority(e);action=media_body(e);l=sql_guard(e['guard'],e['binding']['installationId'],e['binding']['nodeId']);media_run(e);cert,secret=media_check(e,l)
if action!='create' and not media_equal(e['body']['expectedDiagnosticAssociation'],media_receipt(e)['association']): fail()
if action=='create' and e['authority']['room'] is not None: fail()
if action=='delete':
 if 'guest-entry.txt' in e['authority']['artifacts']: media_artifact_check(e,'guest-entry.txt')
 elif os.path.lexists(media_path(e,'guest-entry.txt')) or os.path.lexists(media_path(e,'invite-artifact.json')): fail()
if action=='create':
 capability=media_http(e['binding'],cert,secret,'/api/rooms?diagnostic=true&studioId='+quote(e['binding']['studioId']))
 if not media_equal(capability,{'schemaVersion':1,'contract':'castlink-media-room-v2','studioId':e['binding']['studioId'],'conditionalCleanup':True}): fail()
 media_check(e,l)
media_write(e,l,action+'-intent.json',json.dumps({'action':action,'runId':e['binding']['runId']},separators=(',',':')).encode());media_check(e,l)
value=media_http(e['binding'],cert,secret,e['route'],e['body']);media_check(e,l)
if action=='create':
 if not isinstance(value,dict) or set(value)!={'schemaVersion','contract','studioId','name','association'} or set(value['association'])!={'creationId','revision'} or any(not isinstance(x,str) or re.fullmatch(media_uuid,x) is None for x in value['association'].values()) or not media_equal(value,{'schemaVersion':1,'contract':'castlink-media-room-v2','studioId':e['binding']['studioId'],'name':'cli-media-'+e['binding']['runId'],'association':value['association']}): fail()
 a=media_write(e,l,'room.json',json.dumps(value,separators=(',',':')).encode());result={'schemaVersion':1,'contract':'castlink-media-created-v1','receipt':value,'association':a}
elif action=='invite':
 if not isinstance(value,dict) or set(value)!={'path'} or not isinstance(value['path'],str) or len(value['path'])>8192 or not value['path'].startswith('/room?'): fail()
 u=urlsplit(urljoin(e['binding']['origin'],value['path']));q=parse_qs(u.query)
 if u.scheme+'://'+u.netloc!=e['binding']['origin'] or u.path!='/room' or q.get('studioId')!=[e['binding']['studioId']] or q.get('name')!=['cli-media-'+e['binding']['runId']] or re.fullmatch('invite=[A-Za-z0-9._~%+-]+',u.fragment) is None: fail()
 record=media_write_artifact(e,l,'guest-entry.txt',(e['binding']['origin']+value['path']).encode());result={'schemaVersion':1,'contract':'castlink-media-invited-v1','artifact':media_artifact(e,record['association']),'ledgerAssociation':record['ledgerAssociation']}
else:
 if not media_equal(value,{'schemaVersion':1,'contract':'castlink-media-room-v2','studioId':e['binding']['studioId'],'name':'cli-media-'+e['binding']['runId'],'deleted':True}): fail()
 if e['authority']['artifacts'].get('guest-entry.txt',{}).get('present') is True: media_remove_artifact(e,l,'guest-entry.txt',e['authority']['artifacts']['guest-entry.txt']['association'])
 result=value
media_check(e,l);media_done(l,result)
`);

const nodeGuardValidation=nodeSqlGuard.slice(nodeSqlGuard.indexOf('function sqlGuard(g,id,node){'),nodeSqlGuard.indexOf(' const l=acquireTargetOperation')).replace('function sqlGuard(', 'function mediaGuardValidation(')+'}\n';
const pythonGuardValidation=pythonSqlGuard.slice(pythonSqlGuard.indexOf('def sql_guard(g,id,node):'),pythonSqlGuard.indexOf(' l=acquire_target_operation')).replace('def sql_guard(', 'def media_guard_validation(')+'\n';
export const nodeMediaAdmissionTarget=nodeMediaCommon+nodeGuardValidation+nodeMediaHttpTarget.slice(nodeMediaCommon.length,nodeMediaHttpTarget.indexOf("let input='';process.stdin"))+String.raw`
function mediaAdmissionCheck(e){
 const g=e.guard,a=g.operation;mediaGuardValidation(g,e.binding.installationId,e.binding.nodeId);
 const p=leaseOs.userInfo();if(p.uid!==process.getuid()||a.principal!==p.uid||leaseFs.realpathSync(p.homedir)!==p.homedir||leaseFs.lstatSync(p.homedir).uid!==p.uid||a.scope!==path.join(p.homedir,'.castlink-target-operations'))fail();
 try{leaseFs.lstatSync(a.scope);leasePrivate(a.scope,true)}catch(error){if(error.code!=='ENOENT')throw error}
 try{leaseFs.lstatSync(path.join(a.scope,'active'));fail()}catch(error){if(error.code!=='ENOENT')throw error}
 if(targetOperationEpoch(a.scope)!==a.epoch||!eq(leaseEngine(),{engine:a.engine,endpoint:g.endpoint}))fail();return mediaCheck(e,{owner:{engine:a.engine,endpoint:g.endpoint}},true);
}
`+nodeMediaEntry(String.raw`
mediaValidate(e,'action');if(e.action!=='inspect')fail();const initial=mediaAdmissionCheck(e);
const value=await mediaHttp(e.binding,initial.cert,initial.secret,'/api/rooms?diagnostic=true&studioId='+encodeURIComponent(e.binding.studioId));if(!eq(value,{schemaVersion:1,contract:'castlink-media-room-v2',studioId:e.binding.studioId,conditionalCleanup:true}))fail();mediaAdmissionCheck(e);
console.log(JSON.stringify({schemaVersion:1,contract:'castlink-media-admission-v1',runId:e.binding.runId}));
`);
export const pythonMediaAdmissionTarget=pythonMediaCommon+pythonGuardValidation+pythonMediaHttpTarget.slice(pythonMediaCommon.length,pythonMediaHttpTarget.indexOf('try:\n raw=sys.stdin'))+String.raw`
def media_admission_check(e):
 g=e['guard'];a=g['operation'];media_guard_validation(g,e['binding']['installationId'],e['binding']['nodeId']);p=lease_pwd.getpwuid(lease_os.getuid())
 if p.pw_uid!=os.geteuid() or a['principal']!=p.pw_uid or os.path.realpath(p.pw_dir)!=p.pw_dir or os.lstat(p.pw_dir).st_uid!=p.pw_uid or a['scope']!=p.pw_dir+'/.castlink-target-operations': fail()
 if os.path.lexists(a['scope']): lease_private(a['scope'],True)
 if os.path.lexists(a['scope']+'/active') or target_operation_epoch(a['scope'])!=a['epoch'] or lease_engine()!={'engine':a['engine'],'endpoint':g['endpoint']}: fail()
 return media_check(e,{'owner':{'engine':a['engine'],'endpoint':g['endpoint']}},True)
`+pythonMediaEntry(String.raw`
media_validate(e,('action',))
if e['action']!='inspect': fail()
cert,secret=media_admission_check(e);value=media_http(e['binding'],cert,secret,'/api/rooms?diagnostic=true&studioId='+quote(e['binding']['studioId']))
if not media_equal(value,{'schemaVersion':1,'contract':'castlink-media-room-v2','studioId':e['binding']['studioId'],'conditionalCleanup':True}): fail()
media_admission_check(e);print(json.dumps({'schemaVersion':1,'contract':'castlink-media-admission-v1','runId':e['binding']['runId']},separators=(',',':')))
`);
