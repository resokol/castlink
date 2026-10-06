import {servicePortBindings,pythonServicePortBindings} from './compose-port-bindings.js';
import {parseStrictJson} from './strict-json.js';
import {nodeImageTarget,pythonImageTarget} from './image-target.js';
import {serviceInspectionFormats,serviceHashProtocol} from './services-protocol.js';
import {nodeServiceCaddyArchive} from './services-archive.js';
// Fixed target actions only. PRE authorization and actual POST stay under one
// shared lease; client journal state cannot repair or recreate missing data.
const imageFormat='{"Id":{{json .Id}},"Os":{{json .Os}},"Architecture":{{json .Architecture}},"RepoDigests":{{json .RepoDigests}},"Volumes":{{json .Config.Volumes}}}';

export const nodeServiceTarget=nodeImageTarget.split('let imageInput=')[0]+nodeServiceCaddyArchive+String.raw`
const servicePortBindings=${servicePortBindings.toString()};
function startFail(){leaseFail()}
const serviceFormats=${JSON.stringify(serviceInspectionFormats)},serviceImageFormat=${JSON.stringify(imageFormat)},serviceNames=['postgres','web','livekit','caddy'],serviceEqual=require('node:util').isDeepStrictEqual;
function serviceCaddyDigest(id){const p=imageRun(['cp',id+':/etc/caddy/Caddyfile','-']);if(p.status!==0||p.stderr.length)leaseFail();if(p.stdout.length>262144)leaseFail();return startCaddyDigest(p.stdout)}
function serviceInventory(){const out={containers:[],volumes:[],networks:[]};for(const kind of ['container','volume','network']){const names=imageDocker([kind,'ls',...(kind==='container'?['--all']:[]),'--quiet',...(kind==='volume'?[]:['--no-trunc'])]).trim().split('\n').filter(Boolean);if(names.length>128||new Set(names).size!==names.length||names.some(n=>!(kind==='volume'?/^[A-Za-z0-9][A-Za-z0-9_.-]{0,254}$/:/^[a-f0-9]{64}$/).test(n)))leaseFail();for(const name of names){const v=JSON.parse(imageDocker([kind,'inspect','--format',serviceFormats[kind],name]));if(!v||typeof v!=='object'||(kind==='volume'?v.Name:v.Id)!==name)leaseFail();out[kind==='container'?'containers':kind==='volume'?'volumes':'networks'].push(v)}}return out}
function serviceOwned(r,all){const L='com.docker.compose.',project=r.project,network=project+'_castlink',volumeNames=Object.keys(r.model.volumes).map(n=>project+'_'+n),owned={containers:[],volumes:[],networks:[]},empty=v=>v===null||serviceEqual(v,{});
 for(const v of all.volumes){if(!v.Name.startsWith(project+'_')&&v.Labels?.[L+'project']!==project)continue;if(!volumeNames.includes(v.Name)||v.Driver!=='local'||v.Scope!=='local'||!empty(v.Options)||v.Labels?.[L+'project']!==project||v.Labels?.[L+'volume']!==v.Name.slice(project.length+1)||typeof v.CreatedAt!=='string'||!/^\d{4}-\d\d-\d\dT/.test(v.CreatedAt))leaseFail();owned.volumes.push(v)}
 for(const n of all.networks){if(n.Name!==network&&n.Labels?.[L+'project']!==project)continue;if(n.Name!==network||n.Driver!=='bridge'||n.Internal!==false||n.Attachable!==false||n.EnableIPv6!==false||!empty(n.Options)||n.Labels?.[L+'project']!==project||n.Labels?.[L+'network']!=='castlink')leaseFail();owned.networks.push(n)}
 if(owned.networks.length>1||new Set(owned.volumes.map(v=>v.Name)).size!==owned.volumes.length)leaseFail();
 for(const c of all.containers){if(!Array.isArray(c.Mounts)||!c.Networks||typeof c.Networks!=='object')leaseFail();if(!c.Name.startsWith('/'+project+'-')&&c.Labels?.[L+'project']!==project){if(c.Mounts.some(m=>volumeNames.includes(m.Name))||Object.hasOwn(c.Networks,network))leaseFail();continue}const name=c.Labels?.[L+'service'],model=r.model.services[name],image=r.contract.images[name];if(!serviceNames.includes(name)||!model||c.Name!=='/'+project+'-'+name+'-1'||c.Labels[L+'project']!==project||c.Labels[L+'config-hash']!==r.contract.hashes[name]||c.Labels[L+'project.config_files']!==leaseComposePath(r.root)||c.Labels[L+'project.working_dir']!==r.root||c.Labels[L+'container-number']!=='1'||c.Labels[L+'oneoff']!=='False'||c.Labels[L+'image']!==image.Id||c.Image!==image.Id||c.ConfigImage!==model.image||c.Privileged!==false||c.NetworkMode!==network||Object.keys(c.Networks).length!==1||c.Networks[network]?.NetworkID!==owned.networks[0]?.Id||typeof c.Running!=='boolean'||typeof c.Health!=='string')leaseFail();const mounts=model.volumes??[];if(c.Mounts.length!==mounts.length)leaseFail();for(const m of mounts){const a=c.Mounts.find(x=>x.Destination===m.target);if(!a||a.Type!==m.type||a.RW!==(m.read_only!==true))leaseFail();if(m.type==='volume'){if(a.Name!==project+'_'+m.source||a.Driver!=='local'||!owned.volumes.some(v=>v.Name===a.Name))leaseFail()}else if(!leaseBindSource(a.Source,m.source))leaseFail()}
 const ports=servicePortBindings(model.ports??[]);if(!serviceEqual(c.PortBindings??{},ports))leaseFail();if(name==='caddy'&&serviceCaddyDigest(c.Id)!==r.caddySHA256)leaseFail();owned.containers.push(c)}
 if(new Set(owned.containers.map(c=>c.Labels[L+'service'])).size!==owned.containers.length)leaseFail();return owned;
}
function serviceIdentity(o){return{containers:o.containers.map(c=>({id:c.Id,service:c.Labels['com.docker.compose.service']})).sort((a,b)=>a.id.localeCompare(b.id)),volumes:o.volumes.map(v=>({name:v.Name,createdAt:v.CreatedAt})).sort((a,b)=>a.name.localeCompare(b.name)),networks:o.networks.map(n=>({id:n.Id,name:n.Name})).sort((a,b)=>a.id.localeCompare(b.id))}}
function serviceReady(o){return o.containers.length===4&&o.volumes.length===4&&o.networks.length===1&&o.containers.every(c=>c.Running&&(c.Labels['com.docker.compose.service']==='postgres'?c.Health==='healthy':['','healthy'].includes(c.Health)))}
function serviceConfig(r){const doubled=v=>typeof v==='string'?v.replaceAll('$',()=> '$$'):Array.isArray(v)?v.map(doubled):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,doubled(x)])):v;if(!serviceEqual(JSON.parse(imageRead(leasePath.join(r.root,'compose.yaml'))),doubled(r.model))||leaseCrypto.createHash('sha256').update(r.model.configs.caddy.content).digest('hex')!==r.caddySHA256)leaseFail();if(!serviceEqual(imageFiles(r.root,r.installationId),r.files)||!serviceEqual(leaseEngine(),{engine:r.engine,endpoint:r.endpoint}))leaseFail();const hashProtocol=${JSON.stringify(serviceHashProtocol)},hashPrefix=['compose','--project-name',r.project,'--project-directory',r.root,'-f'],resolvedHashInput=imageDocker([...hashPrefix,leaseComposePath(r.root),...hashProtocol.resolve]);const resolvedHashModel=(${parseStrictJson.toString()})(resolvedHashInput,hashProtocol.maximumBytes);if(!resolvedHashModel||resolvedHashModel.name!==r.project||!resolvedHashModel.services||Array.isArray(resolvedHashModel.services)||Object.keys(resolvedHashModel.services).sort().join(',')!=='caddy,livekit,postgres,web')leaseFail();const hashResult=leaseChild.spawnSync('docker',[...hashPrefix,'-',...hashProtocol.hash],{input:Buffer.from(resolvedHashInput),stdio:['pipe','pipe','pipe'],maxBuffer:hashProtocol.maximumBytes,timeout:120000,windowsHide:true,shell:false});if(hashResult.error||hashResult.signal||hashResult.status!==0||hashResult.stderr.length||hashResult.stdout.length>hashProtocol.maximumBytes)leaseFail();const hashes={};for(const line of hashResult.stdout.toString('utf8').trim().split('\n')){const m=/^(postgres|web|livekit|caddy) ([a-f0-9]{64})$/.exec(line);if(!m||Object.hasOwn(hashes,m[1]))leaseFail();hashes[m[1]]=m[2]}if(Object.keys(hashes).length!==4||!serviceEqual(hashes,r.contract.hashes)||imageDocker([...hashPrefix,leaseComposePath(r.root),...hashProtocol.resolve])!==resolvedHashInput||!serviceEqual(imageFiles(r.root,r.installationId),r.files))leaseFail();for(const name of serviceNames){const image=JSON.parse(imageDocker(['image','inspect','--format',serviceImageFormat,r.model.services[name].image]));if(!serviceEqual(image,r.contract.images[name])||image.Os!=='linux'||r.model.services[name].platform!=='linux/'+image.Architecture||!/^sha256:[a-f0-9]{64}$/.test(image.Id)||!Array.isArray(image.RepoDigests)||!image.RepoDigests.includes(r.model.services[name].image)||image.Volumes!==null&&(!image.Volumes||Array.isArray(image.Volumes)||Object.entries(image.Volumes).some(([n,v])=>!(r.model.services[name].volumes??[]).some(m=>m.target===n)||!serviceEqual(v,{}))))leaseFail()}}
function servicePersist(p,v){leaseWriteProtected(p,Buffer.from(JSON.stringify(v)+'\n'))}
function serviceReceipt(r,lease,pre,post){const p=leasePath.join(lease.scope,'resources-'+r.installationId+'.json');if(leaseFs.existsSync(p)){if(!serviceEqual(JSON.parse(imageRead(p)),{schemaVersion:1,resources:serviceIdentity(pre)}))leaseFail()}else if(post)servicePersist(p,{schemaVersion:1,resources:serviceIdentity(post)})}
function serviceAttempt(r,lease,pre){const p=leasePath.join(lease.scope,'services-'+r.installationId+'.json'),association={schemaVersion:1,root:r.root,installationId:r.installationId,engine:r.engine,endpoint:r.endpoint,files:r.files,contract:r.contract};if(leaseFs.existsSync(p)){if(!serviceEqual(JSON.parse(imageRead(p)),association)||pre.volumes.length!==4||pre.networks.length!==1)leaseFail()}else{if(r.action==='start'||pre.containers.length||pre.volumes.length||pre.networks.length){if(pre.containers.length!==4||pre.volumes.length!==4||pre.networks.length!==1)leaseFail()}servicePersist(p,association)}return p}
let serviceInput='';process.stdin.setEncoding('utf8');process.stdin.on('data',b=>{serviceInput+=b;if(Buffer.byteLength(serviceInput)>1048576)process.exit(4)});process.stdin.on('end',()=>{try{const r=JSON.parse(serviceInput);if(Object.keys(r).sort().join(',')!=='action,caddySHA256,contract,endpoint,engine,epoch,files,installationId,model,principal,project,resources,root,schemaVersion,scope'||r.schemaVersion!==1||!['services','start'].includes(r.action)||r.project!=='castlink-'+r.installationId.replaceAll('-','')||r.contract.installationId!==r.installationId||r.contract.project!==r.project||r.contract.composePath!==leaseComposePath(r.root)||r.contract.composeSHA256!==r.files['compose.yaml']||r.model.name!==r.project||Object.keys(r.model.services).sort().join(',')!=='caddy,livekit,postgres,web')leaseFail();const lease=acquireTargetOperation({schemaVersion:1,kind:r.action,root:r.root,installationId:r.installationId,engine:r.engine,epoch:r.epoch,principal:r.principal,scope:r.scope});if(lease.owner.endpoint!==r.endpoint)leaseFail();const internetReceipt=JSON.parse(imageRead(leasePath.join(r.root,'receipt.json')));if(internetReceipt.network==='internet'||Object.hasOwn(internetReceipt,'internet'))throw Error('internet-turn-tls-prerequisite-unverified');serviceConfig(r);const pre=serviceOwned(r,serviceInventory());if(!serviceEqual(serviceIdentity(pre),r.resources))leaseFail();serviceAttempt(r,lease,pre);serviceReceipt(r,lease,pre);if(r.action==='start'&&(pre.containers.length!==4||pre.volumes.length!==4||pre.networks.length!==1))leaseFail();const already=serviceReady(pre);if(!already){dispatchTargetOperation(lease);const args=r.action==='start'?['start']:['up','--detach','--no-build','--pull','never','--no-recreate'];imageEffect(['compose','--project-name',r.project,'--project-directory',r.root,'-f',leaseComposePath(r.root),...args,...serviceNames])}serviceConfig(r);const post=serviceOwned(r,serviceInventory());if(!serviceReady(post))leaseFail();const identity=serviceIdentity(post);for(const kind of ['containers','volumes','networks'])for(const entry of serviceIdentity(pre)[kind])if(!identity[kind].some(v=>serviceEqual(v,entry)))leaseFail();serviceReceipt(r,lease,pre,post);releaseTargetOperation(lease,true);console.log(JSON.stringify({schemaVersion:1,running:true,alreadyRunning:already,resources:identity}))}catch(error){if(error?.message==='internet-turn-tls-prerequisite-unverified')console.log('{"schemaVersion":1,"diagnosis":"internet-turn-tls-prerequisite-unverified"}');if(error?.message==='windows-desktop-bind-mapping-unverified')console.log('{"schemaVersion":1,"diagnosis":"windows-desktop-bind-mapping-unverified"}');process.exitCode=4}});
`;
export const pythonServiceTarget=pythonImageTarget.slice(0,pythonImageTarget.lastIndexOf('\ntry:\n raw='))+String.raw`
import tarfile,io
${pythonServicePortBindings}
service_formats=lease_json.loads(${JSON.stringify(JSON.stringify(serviceInspectionFormats))})
service_image_format=${JSON.stringify(imageFormat)}
service_names=['postgres','web','livekit','caddy']
def service_inventory():
 out={'containers':[],'volumes':[],'networks':[]}
 for kind in ('container','volume','network'):
  names=image_docker([kind,'ls']+(['--all'] if kind=='container' else [])+['--quiet']+([] if kind=='volume' else ['--no-trunc'])).decode().strip().splitlines()
  if len(names)>128 or len(set(names))!=len(names) or any(not lease_re.fullmatch('[A-Za-z0-9][A-Za-z0-9_.-]{0,254}' if kind=='volume' else '[a-f0-9]{64}',n) for n in names): lease_fail()
  for name in names:
   v=lease_json.loads(image_docker([kind,'inspect','--format',service_formats[kind],name]))
   if not isinstance(v,dict) or v.get('Name' if kind=='volume' else 'Id')!=name: lease_fail()
   out['containers' if kind=='container' else 'volumes' if kind=='volume' else 'networks'].append(v)
 return out
def service_owned(r,all):
 L='com.docker.compose.';project=r['project'];network=project+'_castlink';volume_names=[project+'_'+n for n in r['model']['volumes']];owned={'containers':[],'volumes':[],'networks':[]}
 for v in all['volumes']:
  labels=v.get('Labels') or {}
  if not v['Name'].startswith(project+'_') and labels.get(L+'project')!=project: continue
  if v['Name'] not in volume_names or v.get('Driver')!='local' or v.get('Scope')!='local' or v.get('Options') not in (None,{}) or labels.get(L+'project')!=project or labels.get(L+'volume')!=v['Name'][len(project)+1:] or not isinstance(v.get('CreatedAt'),str) or not lease_re.match(r'\d{4}-\d\d-\d\dT',v['CreatedAt']): lease_fail()
  owned['volumes'].append(v)
 for n in all['networks']:
  labels=n.get('Labels') or {}
  if n['Name']!=network and labels.get(L+'project')!=project: continue
  if n['Name']!=network or n.get('Driver')!='bridge' or n.get('Internal') is not False or n.get('Attachable') is not False or n.get('EnableIPv6') is not False or n.get('Options') not in (None,{}) or labels.get(L+'project')!=project or labels.get(L+'network')!='castlink': lease_fail()
  owned['networks'].append(n)
 if len(owned['networks'])>1 or len({v['Name'] for v in owned['volumes']})!=len(owned['volumes']): lease_fail()
 for c in all['containers']:
  labels=c.get('Labels') or {};mounts=c.get('Mounts');networks=c.get('Networks')
  if not isinstance(mounts,list) or not isinstance(networks,dict): lease_fail()
  if not c['Name'].startswith('/'+project+'-') and labels.get(L+'project')!=project:
   if any(m.get('Name') in volume_names for m in mounts) or network in networks: lease_fail()
   continue
  name=labels.get(L+'service');model=r['model']['services'].get(name);image=r['contract']['images'].get(name)
  if name not in service_names or not model or not image or c['Name']!='/'+project+'-'+name+'-1' or labels.get(L+'project')!=project or labels.get(L+'config-hash')!=r['contract']['hashes'][name] or labels.get(L+'project.config_files')!=r['root']+'/compose.yaml' or labels.get(L+'project.working_dir')!=r['root'] or labels.get(L+'container-number')!='1' or labels.get(L+'oneoff')!='False' or labels.get(L+'image')!=image['Id'] or c.get('Image')!=image['Id'] or c.get('ConfigImage')!=model['image'] or c.get('Privileged') is not False or c.get('NetworkMode')!=network or len(networks)!=1 or not owned['networks'] or networks.get(network,{}).get('NetworkID')!=owned['networks'][0]['Id'] or type(c.get('Running')) is not bool or not isinstance(c.get('Health'),str): lease_fail()
  expected=model.get('volumes',[])
  if len(mounts)!=len(expected): lease_fail()
  for m in expected:
   actual=[a for a in mounts if a.get('Destination')==m['target']]
   if len(actual)!=1: lease_fail()
   a=actual[0]
   if a.get('Type')!=m['type'] or a.get('RW') is not (m.get('read_only') is not True): lease_fail()
   if m['type']=='volume':
    if a.get('Name')!=project+'_'+m['source'] or a.get('Driver')!='local' or not any(v['Name']==a['Name'] for v in owned['volumes']): lease_fail()
   elif a.get('Source')!=m['source']: lease_fail()
  ports=service_port_bindings(model.get('ports',[]))
  if (c.get('PortBindings') or {})!=ports: lease_fail()
  if name=='caddy':
   data=image_docker(['cp',c['Id']+':/etc/caddy/Caddyfile','-'])
   if len(data)>262144 or len(data)<1536 or len(data)%512 or any(data[-1024:]): lease_fail()
   with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as archive:
    entries=archive.getmembers()
    if len(entries)!=1 or entries[0].name!='Caddyfile' or not entries[0].isfile() or not 0<entries[0].size<=65536 or entries[0].mode!=0o444 or entries[0].linkname: lease_fail()
    entry=entries[0]
    for k,v in entry.pax_headers.items():
     if k not in ('path','mtime','atime','ctime') or (v!='Caddyfile' if k=='path' else lease_re.fullmatch('[0-9]+([.][0-9]+)?',v) is None): lease_fail()
    value=archive.extractfile(entry).read(65537);end=entry.offset_data+((entry.size+511)//512)*512
    if len(value)!=entry.size or len(data)-end<1024 or any(data[end:]) or any(data[entry.offset_data+entry.size:end]) or hashlib.sha256(value).hexdigest()!=r['caddySHA256']: lease_fail()
  owned['containers'].append(c)
 if len({c['Labels'][L+'service'] for c in owned['containers']})!=len(owned['containers']): lease_fail()
 return owned
def service_identity(o):
 return {'containers':sorted([{'id':c['Id'],'service':c['Labels']['com.docker.compose.service']} for c in o['containers']],key=lambda v:v['id']),'volumes':sorted([{'name':v['Name'],'createdAt':v['CreatedAt']} for v in o['volumes']],key=lambda v:v['name']),'networks':sorted([{'id':n['Id'],'name':n['Name']} for n in o['networks']],key=lambda v:v['id'])}
def service_ready(o): return len(o['containers'])==4 and len(o['volumes'])==4 and len(o['networks'])==1 and all(c['Running'] and (c['Health']=='healthy' if c['Labels']['com.docker.compose.service']=='postgres' else c['Health'] in ('','healthy')) for c in o['containers'])
def service_config(r):
 def doubled(v):
  if isinstance(v,str): return v.replace('$','$$')
  if isinstance(v,list): return [doubled(x) for x in v]
  if isinstance(v,dict): return {k:doubled(x) for k,x in v.items()}
  return v
 if lease_json.loads(image_read(r['root']+'/compose.yaml'))!=doubled(r['model']) or hashlib.sha256(r['model']['configs']['caddy']['content'].encode()).hexdigest()!=r['caddySHA256']: lease_fail()
 if image_files(r['root'],r['installationId'])!=r['files'] or lease_engine()!={'engine':r['engine'],'endpoint':r['endpoint']}: lease_fail()
 hash_protocol=lease_json.loads(${JSON.stringify(JSON.stringify(serviceHashProtocol))})
 hash_prefix=['compose','--project-name',r['project'],'--project-directory',r['root'],'-f']
 resolved_hash_input=image_docker(hash_prefix+[r['root']+'/compose.yaml']+hash_protocol['resolve'])
 def strict_pairs(pairs):
  result={}
  for key,value in pairs:
   if key in result: lease_fail()
   result[key]=value
  return result
 if len(resolved_hash_input)>hash_protocol['maximumBytes']: lease_fail()
 resolved_hash_model=lease_json.loads(resolved_hash_input,object_pairs_hook=strict_pairs)
 if not isinstance(resolved_hash_model,dict) or resolved_hash_model.get('name')!=r['project'] or not isinstance(resolved_hash_model.get('services'),dict) or sorted(resolved_hash_model['services'])!=['caddy','livekit','postgres','web']: lease_fail()
 child=None;selector=lease_selectors.DefaultSelector();buffers={'stdout':bytearray(),'stderr':bytearray()};total=0;offset=0
 try:
  child=lease_subprocess.Popen(['docker']+hash_prefix+['-']+hash_protocol['hash'],stdin=lease_subprocess.PIPE,stdout=lease_subprocess.PIPE,stderr=lease_subprocess.PIPE)
  lease_os.set_blocking(child.stdin.fileno(),False)
  selector.register(child.stdin,lease_selectors.EVENT_WRITE,'stdin')
  for name in buffers: selector.register(getattr(child,name),lease_selectors.EVENT_READ,name)
  deadline=lease_time.monotonic()+120
  while selector.get_map():
   if lease_time.monotonic()>deadline: lease_fail()
   for key,_ in selector.select(min(.1,max(0,deadline-lease_time.monotonic()))):
    if key.data=='stdin':
     offset+=lease_os.write(key.fileobj.fileno(),resolved_hash_input[offset:offset+4096])
     if offset==len(resolved_hash_input): selector.unregister(key.fileobj);key.fileobj.close()
     continue
    chunk=lease_os.read(key.fileobj.fileno(),65536)
    if not chunk: selector.unregister(key.fileobj);continue
    total+=len(chunk)
    if total>hash_protocol['maximumBytes']: lease_fail()
    buffers[key.data].extend(chunk)
  if child.wait(timeout=max(.001,deadline-lease_time.monotonic()))!=0 or buffers['stderr']: lease_fail()
  hash_output=bytes(buffers['stdout'])
 finally:
  selector.close()
  if child is not None:
   if child.poll() is None: child.kill()
   child.wait()
   for pipe in (child.stdin,child.stdout,child.stderr): pipe.close()
 hashes={}
 for line in hash_output.decode().strip().splitlines():
  m=lease_re.fullmatch('(postgres|web|livekit|caddy) ([a-f0-9]{64})',line)
  if not m or m[1] in hashes: lease_fail()
  hashes[m[1]]=m[2]
 if len(hashes)!=4 or hashes!=r['contract']['hashes'] or image_docker(hash_prefix+[r['root']+'/compose.yaml']+hash_protocol['resolve'])!=resolved_hash_input or image_files(r['root'],r['installationId'])!=r['files']: lease_fail()
 for name in service_names:
  image=lease_json.loads(image_docker(['image','inspect','--format',service_image_format,r['model']['services'][name]['image']]))
  if image!=r['contract']['images'][name] or image.get('Os')!='linux' or r['model']['services'][name]['platform']!='linux/'+image.get('Architecture','') or not lease_re.fullmatch('sha256:[a-f0-9]{64}',image.get('Id','')) or not isinstance(image.get('RepoDigests'),list) or r['model']['services'][name]['image'] not in image['RepoDigests']: lease_fail()
  volumes=image.get('Volumes')
  if volumes is not None and (not isinstance(volumes,dict) or any(not any(m['target']==n for m in r['model']['services'][name].get('volumes',[])) or v!={} for n,v in volumes.items())): lease_fail()
def service_receipt(r,lease,pre,post=None):
 p=lease['scope']+'/resources-'+r['installationId']+'.json'
 if lease_os.path.lexists(p):
  if lease_json.loads(image_read(p))!={'schemaVersion':1,'resources':service_identity(pre)}: lease_fail()
 elif post is not None:
  f=lease_os.open(p,lease_os.O_WRONLY|lease_os.O_CREAT|lease_os.O_EXCL|lease_os.O_NOFOLLOW,0o600)
  try:
   b=(lease_json.dumps({'schemaVersion':1,'resources':service_identity(post)})+'\n').encode();offset=0
   while offset<len(b): offset+=lease_os.write(f,b[offset:])
   lease_os.fsync(f)
  finally: lease_os.close(f)
  lease_sync(lease['scope'])
def service_attempt(r,lease,pre):
 p=lease['scope']+'/services-'+r['installationId']+'.json';association={k:r[k] for k in ('schemaVersion','root','installationId','engine','endpoint','files','contract')}
 if lease_os.path.lexists(p):
  if lease_json.loads(image_read(p))!=association or len(pre['volumes'])!=4 or len(pre['networks'])!=1: lease_fail()
 else:
  if r['action']=='start' or any(pre.values()):
   if len(pre['containers'])!=4 or len(pre['volumes'])!=4 or len(pre['networks'])!=1: lease_fail()
  f=lease_os.open(p,lease_os.O_WRONLY|lease_os.O_CREAT|lease_os.O_EXCL|lease_os.O_NOFOLLOW,0o600)
  try:
   b=(lease_json.dumps(association)+'\n').encode();offset=0
   while offset<len(b): offset+=lease_os.write(f,b[offset:])
   lease_os.fsync(f)
  finally: lease_os.close(f)
  lease_sync(lease['scope'])
try:
 raw=sys.stdin.buffer.read(1048577)
 if len(raw)>1048576: lease_fail()
 r=lease_json.loads(raw)
 if set(r)!={'schemaVersion','action','root','installationId','engine','endpoint','epoch','files','project','model','contract','resources','caddySHA256','principal','scope'} or r['schemaVersion']!=1 or r['action'] not in ('services','start') or r['project']!='castlink-'+r['installationId'].replace('-','') or r['contract']['installationId']!=r['installationId'] or r['contract']['project']!=r['project'] or r['contract']['composePath']!=r['root']+'/compose.yaml' or r['contract']['composeSHA256']!=r['files']['compose.yaml'] or r['model']['name']!=r['project'] or sorted(r['model']['services'])!=sorted(service_names): lease_fail()
 lease=acquire_target_operation({k:r[k] for k in ('schemaVersion','root','installationId','engine','epoch','principal','scope')}|{'kind':r['action']})
 if lease['owner']['endpoint']!=r['endpoint']: lease_fail()
 internet_receipt=lease_json.loads(image_read(r['root']+'/receipt.json'))
 if internet_receipt.get('network')=='internet' or 'internet' in internet_receipt: raise ValueError('internet-turn-tls-prerequisite-unverified')
 service_config(r);pre=service_owned(r,service_inventory())
 if service_identity(pre)!=r['resources']: lease_fail()
 service_attempt(r,lease,pre);service_receipt(r,lease,pre)
 if r['action']=='start' and (len(pre['containers'])!=4 or len(pre['volumes'])!=4 or len(pre['networks'])!=1): lease_fail()
 already=service_ready(pre)
 if not already:
  dispatch_target_operation(lease);image_effect(['compose','--project-name',r['project'],'--project-directory',r['root'],'-f',r['root']+'/compose.yaml']+(['start'] if r['action']=='start' else ['up','--detach','--no-build','--pull','never','--no-recreate'])+service_names)
 service_config(r);post=service_owned(r,service_inventory())
 if not service_ready(post): lease_fail()
 identity=service_identity(post)
 for kind,entries in service_identity(pre).items():
  if any(entry not in identity[kind] for entry in entries): lease_fail()
 service_receipt(r,lease,pre,post);release_target_operation(lease,True)
 print(lease_json.dumps({'schemaVersion':1,'running':True,'alreadyRunning':already,'resources':identity}))
except BaseException as error:
 if str(error)=='internet-turn-tls-prerequisite-unverified': print('{"schemaVersion":1,"diagnosis":"internet-turn-tls-prerequisite-unverified"}')
 sys.exit(4)
`;
