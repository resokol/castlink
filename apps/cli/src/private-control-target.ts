import {parseStrictJson} from './strict-json.js';
import {privateControlCapability} from './private-control-capability.js';
// Fixed target library embedded inside CONFIG and SERVICES. No caller program.
export const nodePrivateControlConfiguration=String.raw`
const pcCapability=${JSON.stringify(privateControlCapability)},pcEqual=require('node:util').isDeepStrictEqual,pcParse=${parseStrictJson.toString()};
function pcFail(){throw Error('private-control-unverified')}
function pcKeys(v,k){if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).sort().join(',')!==k.split(',').sort().join(','))pcFail()}
function pcPresent(p){try{leaseFs.lstatSync(p);return true}catch(e){if(e.code==='ENOENT')return false;throw e}}
function pcHash(b){return leaseCrypto.createHash('sha256').update(b).digest('hex')}
function pcIdentity(p,directory){const s=leasePrivate(p,directory);if(leaseFs.realpathSync(p)!==p)pcFail();return{dev:s.dev,ino:s.ino}}
function pcRead(p,limit=8192){return leaseReadProtected(p,limit)}
function pcRecord(p,limit=8192){return pcParse(pcRead(p,limit).toString(),limit)}
function pcPublish(p,value){const b=Buffer.from(JSON.stringify(value)+'\n');if(b.length>8192)pcFail();leaseWriteProtected(p,b)}
function pcPaths(scope,id){const controlRoot=leasePath.join(scope,'livekit-control-'+id);return{controlRoot,configFile:leasePath.join(controlRoot,'config.json'),attempt:leasePath.join(scope,'private-control-config-'+id+'.json'),reservation:leasePath.join(controlRoot,'reservation.json'),bound:leasePath.join(controlRoot,'bound.json'),initialized:leasePath.join(controlRoot,'initialized.json'),bootstrap:leasePath.join(controlRoot,'bootstrap-attempt.json')}}
function pcSelected(l){dispatchTargetOperation(l);if(!pcEqual(leaseEngine(),{engine:l.owner.engine,endpoint:l.owner.endpoint}))pcFail()}
function pcValidate(bundle,a,root,model){
 if(bundle.release?.schemaVersion!==2)pcFail();pcKeys(bundle.release,'schemaVersion,release,nodeVersion,architectures,images,privateControl');
 if(!pcEqual(bundle.release.privateControl,pcCapability)||!pcEqual(bundle.release.architectures,['amd64'])||bundle.architecture!=='amd64'||process.platform!=='linux'||process.getuid()!==1000||process.getgid()!==1000||a.principal!==1000||bundle.controlScope!==a.scope||leasePath.basename(a.scope)!=='.castlink-target-operations'||/[,\x00-\x1f\x7f]/.test(a.scope))pcFail();
 const p=pcPaths(a.scope,bundle.installationId);if(root!==leasePath.resolve(root)||leaseFs.realpathSync(leasePath.dirname(root))!==leasePath.dirname(root))pcFail();leasePrivate(leasePath.dirname(root),true);
 if(model){
  if(model.name!=='castlink-'+bundle.installationId.replaceAll('-','')||!pcEqual(Object.keys(model.services??{}).sort(),['caddy','livekit','postgres','web']))pcFail();
  const lk=model.services.livekit,expected=[{type:'bind',source:leasePath.join(root,'livekit.yaml'),target:'/etc/livekit.yaml',read_only:true,bind:{create_host_path:false}},{type:'bind',source:p.configFile,target:'/run/castlink-idleseal/config.json',read_only:true,bind:{create_host_path:false}},{type:'bind',source:p.controlRoot,target:'/run/castlink-idleseal',read_only:false,bind:{create_host_path:false}}];
  if(lk?.image!==bundle.release.images.livekit.reference||lk.platform!=='linux/amd64'||lk.user!=='1000:1000'||!pcEqual(lk.command,['--config','/etc/livekit.yaml'])||!pcEqual(lk.environment,{CASTLINK_IDLE_SEAL_CONFIG:'/run/castlink-idleseal/config.json'})||!pcEqual(lk.volumes,expected))pcFail();
 }
 return p;
}
function pcReservation(bundle,a,root,files){
 const p=pcValidate(bundle,a,root),attempt=pcRecord(p.attempt),r=pcRecord(p.reservation);
 pcKeys(attempt,'schemaVersion,contract,root,installationId,engine,endpoint,parent,templates');pcKeys(r,'schemaVersion,contract,attempt,rootIdentity,controlIdentity,slot,files');
 if(attempt.schemaVersion!==1||attempt.contract!=='castlink-private-control-config-v1'||attempt.root!==root||attempt.installationId!==bundle.installationId||attempt.engine!==a.engine||attempt.endpoint!==a.endpoint||r.schemaVersion!==1||r.contract!==attempt.contract||!pcEqual(r.attempt,attempt)||!pcEqual(pcIdentity(root,true),r.rootIdentity)||!pcEqual(pcIdentity(leasePath.dirname(root),true),attempt.parent)||!pcEqual(pcIdentity(p.controlRoot,true),r.controlIdentity)||!pcEqual(pcIdentity(p.configFile,false),r.slot)||!pcEqual(r.files,files))pcFail();
 const bytes=pcRead(p.configFile);
 if(!pcPresent(p.bound)){if(bytes.length||pcPresent(p.initialized)||pcPresent(leasePath.join(p.controlRoot,'state'))||pcPresent(leasePath.join(p.controlRoot,'state.initialized'))||pcPresent(p.bootstrap))pcFail();}
 else{
  const b=pcRecord(p.bound),config=JSON.parse(bytes);pcKeys(b,'schemaVersion,contract,binding,configSHA256,secretSHA256,resources');pcKeys(config,'binding,stateDir,secret');
  if(b.schemaVersion!==1||b.contract!=='castlink-private-control-binding-v1'||!pcEqual(config.binding,b.binding)||b.binding.installationId!==bundle.installationId||b.binding.digest!==pcCapability.imageId||b.binding.version!==pcCapability.version||!/^[a-f0-9]{64}$/.test(b.binding.containerId)||config.stateDir!=='/run/castlink-idleseal/state'||typeof config.secret!=='string'||!/^[a-f0-9]{64}$/.test(config.secret)||pcHash(config.secret)!==b.secretSHA256||pcHash(bytes)!==b.configSHA256)pcFail();
  if(!pcPresent(p.initialized))pcFail();const initialized=pcRecord(p.initialized);pcKeys(initialized,'schemaVersion,contract,binding,configSHA256,secretSHA256,initializerContainerId,stateIdentity,anchorSHA256,stateSHA256');if(initialized.schemaVersion!==1||initialized.contract!=='castlink-private-control-initialized-v1'||!pcEqual(initialized.binding,b.binding)||initialized.configSHA256!==b.configSHA256||initialized.secretSHA256!==b.secretSHA256||!/^[a-f0-9]{64}$/.test(initialized.initializerContainerId))pcFail();
  if(!pcEqual(pcIdentity(leasePath.join(p.controlRoot,'state'),true),initialized.stateIdentity)||!pcEqual(pcRecord(leasePath.join(p.controlRoot,'state.initialized')),b.binding)||pcHash(pcRead(leasePath.join(p.controlRoot,'state.initialized')))!==initialized.anchorSHA256)pcFail();
  const state=pcRecord(leasePath.join(p.controlRoot,'state','state.json'),65536);pcKeys(state,'schema,binding,mode,usedEpochs'+(Object.hasOwn(state,'activeEpoch')?',activeEpoch':''));if(state.schema!==2||!pcEqual(state.binding,b.binding)||!['retired','sealed'].includes(state.mode)||!Array.isArray(state.usedEpochs)||state.usedEpochs.length>128||state.usedEpochs.some(v=>typeof v!=='string'||!v.length||v.length>128)||new Set(state.usedEpochs).size!==state.usedEpochs.length||(state.mode==='sealed'&&!state.usedEpochs.includes(state.activeEpoch))||(state.mode==='retired'&&state.activeEpoch!==undefined&&state.activeEpoch!==''))pcFail();
 }
 return{paths:p,reservation:r};
}
function pcConfigurationPre(r,l,fresh){
 if(r.bundle.release?.schemaVersion!==2)return;
 if(r.bundle.release.privateControl?.kind==='castlink-idleseal-private-volume-v1')return wvConfigPre(r,l,fresh);
 const model=JSON.parse(r.templates['compose.yaml']),p=pcValidate(r.bundle,r.association,r.directory,model);
 if(fresh){
  if(pcPresent(p.attempt)||pcPresent(p.controlRoot))pcFail();pcSelected(l);
  const attempt={schemaVersion:1,contract:'castlink-private-control-config-v1',root:r.directory,installationId:r.bundle.installationId,engine:l.owner.engine,endpoint:l.owner.endpoint,parent:pcIdentity(leasePath.dirname(r.directory),true),templates:Object.fromEntries(Object.entries(r.templates).map(([n,b])=>[n,pcHash(b)]))};pcPublish(p.attempt,attempt);
  leaseFs.mkdirSync(p.controlRoot,{mode:448});leaseSync(l.scope);const fd=leaseFs.openSync(p.configFile,leaseFs.constants.O_CREAT|leaseFs.constants.O_EXCL|leaseFs.constants.O_WRONLY|leaseFs.constants.O_NOFOLLOW,384);try{leaseFs.fsyncSync(fd)}finally{leaseFs.closeSync(fd)}leaseSync(p.controlRoot);
  return{controlIdentity:pcIdentity(p.controlRoot,true),slot:pcIdentity(p.configFile,false),parent:attempt.parent};
 }else if(!pcPresent(p.attempt)||!pcPresent(p.reservation))pcFail();
}
function pcConfigurationPost(r,l,fresh,hashes,creation){
 if(r.bundle.release?.schemaVersion!==2)return;
 if(r.bundle.release.privateControl?.kind==='castlink-idleseal-private-volume-v1')return wvConfigPost(r,l,fresh,hashes,creation);
 const p=pcValidate(r.bundle,r.association,r.directory),files={...hashes,'receipt.json':pcHash(leaseReadProtected(leasePath.join(r.directory,'receipt.json'),131072))};
 if(fresh){const attempt=pcRecord(p.attempt);if(!creation||!pcEqual(pcIdentity(r.directory,true),creation.rootIdentity)||!pcEqual(pcIdentity(p.controlRoot,true),creation.controlIdentity)||!pcEqual(pcIdentity(p.configFile,false),creation.slot)||!pcEqual(pcIdentity(leasePath.dirname(r.directory),true),creation.parent))pcFail();pcPublish(p.reservation,{schemaVersion:1,contract:'castlink-private-control-config-v1',attempt,rootIdentity:creation.rootIdentity,controlIdentity:creation.controlIdentity,slot:creation.slot,files});}
 const checked=pcReservation(r.bundle,r.association,r.directory,files);if(!pcEqual(checked.reservation.attempt.templates,Object.fromEntries(Object.entries(r.templates).map(([n,b])=>[n,pcHash(b)]))))pcFail();pcSelected(l);
}
`;

export const nodePrivateControlServices=String.raw`
function pcDocker(args,input,limit=1048576){const p=leaseChild.spawnSync('docker',args,{input,timeout:120000,maxBuffer:limit,shell:false,windowsHide:true});if(p.error||p.signal||p.status!==0||p.stderr.length)pcFail();return p.stdout.toString('utf8')}
function pcPrivateImage(reference){const values=pcParse(pcDocker(['image','inspect',reference]),1048576);if(!Array.isArray(values)||values.length!==1)pcFail();const i=values[0];if(i.Id!==pcCapability.imageId||i.Os!=='linux'||i.Architecture!=='amd64'||i.Config?.User!=='1000:1000'||!pcEqual(i.Config.Entrypoint,['/usr/local/bin/livekit-server-private'])||i.Config.Volumes!==null||!Array.isArray(i.RepoDigests)||!i.RepoDigests.includes(reference))pcFail()}
function pcActualLivekit(owned,p,requireRunning){
 const c=owned.containers.find(c=>c.Labels['com.docker.compose.service']==='livekit');if(!c||!/^[a-f0-9]{64}$/.test(c.Id)||c.Image!==pcCapability.imageId)pcFail();
 const values=pcParse(pcDocker(['inspect',c.Id]),1048576);if(!Array.isArray(values)||values.length!==1)pcFail();const actual=values[0],binary='/usr/local/bin/livekit-server-private';
 if(actual.Id!==c.Id||actual.Image!==pcCapability.imageId||actual.State?.Running!==requireRunning||actual.Config?.User!=='1000:1000'||actual.Config.Hostname!==c.Id.slice(0,12)||!pcEqual(actual.Config.Entrypoint,[binary])||!Array.isArray(actual.Config.Env)||actual.Config.Env.filter(x=>x.startsWith('CASTLINK_IDLE_SEAL_CONFIG=')).join(',')!=='CASTLINK_IDLE_SEAL_CONFIG=/run/castlink-idleseal/config.json'||!pcEqual(actual.Mounts,c.Mounts))pcFail();
 for(const [source,target,rw] of [[p.configFile,'/run/castlink-idleseal/config.json',false],[p.controlRoot,'/run/castlink-idleseal',true]])if(actual.Mounts.filter(m=>m.Type==='bind'&&m.Source===source&&m.Destination===target&&m.RW===rw).length!==1)pcFail();return c;
}
function pcClosedStatus(r,l,p,binding){
 pcSelected(l);const owned=serviceOwned(r,serviceInventory());if(!serviceReady(owned))pcFail();const c=pcActualLivekit(owned,p,true),binary='/usr/local/bin/livekit-server-private';if(c.Id!==binding.containerId)pcFail();
 if(pcDocker(['exec',c.Id,binary,'--version'],undefined,8192)!=='livekit-server version '+pcCapability.version+'\n'||pcDocker(['exec',c.Id,'/usr/bin/sha256sum',binary],undefined,8192)!==pcCapability.binarySHA256+'  '+binary+'\n')pcFail();
 const status=pcParse(pcDocker(['exec','-i',c.Id,binary,'castlink-idle-control'],JSON.stringify({operation:'status',binding}),8192),8192);pcKeys(status,'result,processNonce,snapshot');pcKeys(status.snapshot,'Pending,Live,Unknown,Sealed,processNonce');
 if(status.result!=='OK'||!/^[a-f0-9]{64}$/.test(status.processNonce)||status.snapshot.processNonce!==status.processNonce||status.snapshot.Sealed!==true||['Pending','Live','Unknown'].some(k=>status.snapshot[k]!==0))pcFail();pcSelected(l);return status.processNonce;
}
function pcBootstrapServices(r,l,pre,already){
 const receipt=pcParse(imageRead(leasePath.join(r.root,'receipt.json')).toString(),131072);if(receipt.release?.schemaVersion!==2)return null;
 const {schemaVersion,hashes,...bundle}=receipt;if(bundle.release.privateControl?.kind==='castlink-idleseal-private-volume-v1')return wvBootstrap(r,l,pre,already,bundle);const association={engine:r.engine,endpoint:r.endpoint,principal:r.principal,scope:r.scope},p=pcValidate(bundle,association,r.root,r.model),checked=pcReservation(bundle,association,r.root,r.files),reservation=checked.reservation;
 if(schemaVersion!==1||receipt.installationId!==r.installationId||r.contract.images.livekit.Id!==pcCapability.imageId||!pcEqual(hashes,Object.fromEntries(['compose.yaml','livekit.yaml','postgres.env','web.env'].map(n=>[n,r.files[n]]))))pcFail();pcPrivateImage(r.model.services.livekit.image);
 if(already){const b=pcRecord(p.bound),nonce=pcClosedStatus(r,l,p,b.binding);return{bundle,binding:b.binding,nonce}}
 if(r.action!=='services'||pre.containers.length||pre.volumes.length||pre.networks.length||pcPresent(p.bootstrap)||pcPresent(p.bound)||pcPresent(p.initialized))pcFail();
 const profile=()=>{pcSelected(l);if(!pcEqual(pcIdentity(r.root,true),reservation.rootIdentity)||!pcEqual(pcIdentity(leasePath.dirname(r.root),true),reservation.attempt.parent)||!pcEqual(pcIdentity(p.controlRoot,true),reservation.controlIdentity)||!pcEqual(pcIdentity(p.configFile,false),reservation.slot)||!pcEqual(imageFiles(r.root,r.installationId),r.files)||!pcEqual(pcRecord(p.reservation),reservation)||!pcEqual(pcRecord(p.attempt),reservation.attempt))pcFail();serviceConfig(r)};
 profile();pcPublish(p.bootstrap,{schemaVersion:1,contract:'castlink-private-control-bootstrap-v1',installationId:r.installationId,operationNonce:l.owner.nonce,files:r.files});
 // CREATE final four, never UP or recreate; private slot exists before effect.
 pcSelected(l);imageEffect(['compose','--progress','quiet','--project-name',r.project,'--project-directory',r.root,'-f',leaseComposePath(r.root),'create','--no-build','--pull','never',...serviceNames]);
 profile();const created=serviceOwned(r,serviceInventory());if(created.containers.length!==4||created.volumes.length!==4||created.networks.length!==1||created.containers.some(c=>c.Running))pcFail();
 const resources=serviceIdentity(created),c=pcActualLivekit(created,p,false),binding={installationId:r.installationId,containerId:c.Id,digest:pcCapability.imageId,version:pcCapability.version},secret=leaseCrypto.randomBytes(32).toString('hex'),config=Buffer.from(JSON.stringify({binding,stateDir:'/run/castlink-idleseal/state',secret})+'\n'),bound={schemaVersion:1,contract:'castlink-private-control-binding-v1',binding,configSHA256:pcHash(config),secretSHA256:pcHash(secret),resources};
 pcPublish(p.bound,bound);const fd=leaseFs.openSync(p.configFile,leaseFs.constants.O_WRONLY|leaseFs.constants.O_NOFOLLOW);try{const s=leaseFs.fstatSync(fd);if(s.dev!==reservation.slot.dev||s.ino!==reservation.slot.ino||s.size||s.nlink!==1||s.uid!==1000||(s.mode&511)!==384)pcFail();leaseFs.writeFileSync(fd,config);leaseFs.fsyncSync(fd)}finally{leaseFs.closeSync(fd)}leaseSync(p.controlRoot);
 const boundGuard=()=>{profile();if(!pcRead(p.configFile).equals(config)||!pcEqual(pcRecord(p.bound),bound))pcFail()};boundGuard();
 // Explicit one-use initializer in this SAME lease, not a retained fifth service.
 const binary='/usr/local/bin/livekit-server-private',name='castlink-private-initialize-'+r.installationId,labels={'io.castlink.private-initialize':r.installationId,'io.castlink.operation-nonce':l.owner.nonce};
 const cid=pcDocker(['create','--pull=never','--name',name,'--network','none','--user','1000:1000','--hostname',c.Id.slice(0,12),'--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--label','io.castlink.private-initialize='+r.installationId,'--label','io.castlink.operation-nonce='+l.owner.nonce,'--env','CASTLINK_IDLE_SEAL_CONFIG=/run/castlink-idleseal/config.json','--mount','type=bind,src='+p.controlRoot+',dst=/run/castlink-idleseal','--mount','type=bind,src='+p.configFile+',dst=/run/castlink-idleseal/config.json,readonly','--entrypoint',binary,pcCapability.imageId,'castlink-idle-initialize'],undefined,8192).trim();
 if(!/^[a-f0-9]{64}$/.test(cid)||resources.containers.some(c=>c.id===cid))pcFail();pcPublish(leasePath.join(p.controlRoot,'initializer-container.json'),{schemaVersion:1,containerId:cid,operationNonce:l.owner.nonce});
 const inspect=()=>{boundGuard();const values=pcParse(pcDocker(['inspect',cid]),1048576);if(!Array.isArray(values)||values.length!==1)pcFail();const b=values[0],h=b.HostConfig;
  if(b.Id!==cid||b.Name!=='/'+name||b.Image!==pcCapability.imageId||b.Config?.User!=='1000:1000'||b.Config.Hostname!==c.Id.slice(0,12)||!pcEqual(b.Config.Entrypoint,[binary])||!pcEqual(b.Config.Cmd,['castlink-idle-initialize'])||!pcEqual(b.Config.Labels,labels)||!Array.isArray(b.Config.Env)||b.Config.Env.filter(v=>v.startsWith('CASTLINK_IDLE_SEAL_CONFIG=')).join(',')!=='CASTLINK_IDLE_SEAL_CONFIG=/run/castlink-idleseal/config.json'||h?.NetworkMode!=='none'||h.Privileged!==false||h.ReadonlyRootfs!==true||!pcEqual(h.CapDrop,['ALL'])||!Array.isArray(h.SecurityOpt)||h.SecurityOpt.length!==1||!['no-new-privileges','no-new-privileges:true'].includes(h.SecurityOpt[0])||h.PortBindings&&Object.keys(h.PortBindings).length||!b.NetworkSettings||Object.keys(b.NetworkSettings.Ports??{}).length||!Array.isArray(b.Mounts)||b.Mounts.length!==2||typeof b.State?.Running!=='boolean'||!Number.isInteger(b.State.ExitCode))pcFail();
  for(const [source,target,rw] of [[p.controlRoot,'/run/castlink-idleseal',true],[p.configFile,'/run/castlink-idleseal/config.json',false]]){const m=b.Mounts.filter(m=>m.Destination===target);if(m.length!==1||m[0].Type!=='bind'||m[0].Source!==source||m[0].RW!==rw)pcFail()}return b;};
 if(inspect().State.Running)pcFail();boundGuard();pcSelected(l);if(pcDocker(['start','--attach',cid],undefined,8192)!=='')pcFail();
 pcSelected(l);if(pcDocker(['wait',cid],undefined,8192)!=='0\n')pcFail();const reaped=inspect();if(reaped.State.Running||reaped.State.ExitCode!==0)pcFail();
 const state=leasePath.join(p.controlRoot,'state'),anchor=state+'.initialized';pcIdentity(state,true);if(leaseFs.readdirSync(state).join(',')!=='state.json'||!pcEqual(pcRecord(anchor),binding)||!pcEqual(pcRecord(leasePath.join(state,'state.json')),{schema:2,binding,mode:'retired',usedEpochs:[]}))pcFail();
 const initialized={schemaVersion:1,contract:'castlink-private-control-initialized-v1',binding,configSHA256:bound.configSHA256,secretSHA256:bound.secretSHA256,initializerContainerId:cid,stateIdentity:pcIdentity(state,true),anchorSHA256:pcHash(pcRead(anchor)),stateSHA256:pcHash(pcRead(leasePath.join(state,'state.json')))};
 inspect();pcSelected(l);if(pcDocker(['rm',cid],undefined,8192)!==cid+'\n')pcFail();const remaining=pcDocker(['container','ls','--all','--no-trunc','--quiet']).trim().split('\n').filter(Boolean);if(remaining.includes(cid)||remaining.some(v=>!/^[a-f0-9]{64}$/.test(v)))pcFail();
 boundGuard();const stopped=serviceOwned(r,serviceInventory());if(!pcEqual(serviceIdentity(stopped),resources)||stopped.containers.some(c=>c.Running)||!pcEqual(pcIdentity(state,true),initialized.stateIdentity)||pcHash(pcRead(anchor))!==initialized.anchorSHA256||pcHash(pcRead(leasePath.join(state,'state.json')))!==initialized.stateSHA256)pcFail();pcActualLivekit(stopped,p,false);pcPublish(p.initialized,initialized);
 const byName=n=>stopped.containers.find(c=>c.Labels['com.docker.compose.service']===n).Id;
 pcSelected(l);pcDocker(['start',byName('postgres')],undefined,8192);
 function waitReady(all){for(let n=0;n<30;n++){boundGuard();const o=serviceOwned(r,serviceInventory());if(!pcEqual(serviceIdentity(o),resources))pcFail();const pg=o.containers.find(c=>c.Id===byName('postgres'));if(!pg?.Running||pg.Health==='unhealthy')pcFail();if(all?serviceReady(o):pg.Health==='healthy')return;Atomics.wait(new Int32Array(new SharedArrayBuffer(4)),0,0,1000)}pcFail()}
 waitReady(false);pcSelected(l);pcDocker(['start',...['web','livekit','caddy'].map(byName)],undefined,8192);waitReady(true);
 pcReservation(bundle,association,r.root,r.files);const nonce=pcClosedStatus(r,l,p,binding);return{bundle,binding,nonce};
}
function pcServicesPost(r,l,witness){
 if(!witness)return;if(witness.volume)return wvPost(r,l,witness);const association={engine:r.engine,endpoint:r.endpoint,principal:r.principal,scope:r.scope},checked=pcReservation(witness.bundle,association,r.root,r.files);
 if(pcClosedStatus(r,l,checked.paths,witness.binding)!==witness.nonce)pcFail();pcSelected(l);
}
`;

// Compact primitives for the separately selected fixed Windows-volume program.
export const nodePrivateControlPrimitives=nodePrivateControlConfiguration.slice(0,nodePrivateControlConfiguration.indexOf('function pcValidate'));

export const nodePrivateControlDocker=nodePrivateControlServices.slice(0,nodePrivateControlServices.indexOf('function pcPrivateImage'));
