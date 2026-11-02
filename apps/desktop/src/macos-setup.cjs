'use strict';
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');
const {pathToFileURL}=require('node:url');
const {X509Certificate,randomUUID}=require('node:crypto');
const CHANNEL='castlink:macos-setup-';
function execute(file,args,{input='',signal,timeout=1800000,...options}={}){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted)return reject(Error('Setup cancelled'));
  let child,stdout='',size=0,settled=false;
  const done=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);signal?.removeEventListener('abort',abort);error?reject(error):resolve(value);};
  const kill=()=>{try{if(process.platform!=='win32'&&child?.pid)process.kill(-child.pid,'SIGTERM');else child?.kill('SIGTERM');}catch{child?.kill('SIGTERM');}};
  const abort=()=>{kill();done(Error('Setup cancelled. Check this installation before resuming from the same folder.'));};
  const timer=setTimeout(()=>{kill();done(Error('Setup operation timed out'));},timeout);
  try{child=spawn(file,args,{...options,env:Object.fromEntries(Object.entries(process.env).filter(([key])=>!['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH','PYTHONPATH','PYTHONHOME'].includes(key))),shell:false,detached:process.platform!=='win32',stdio:['pipe','pipe','pipe']});}catch{done(Error('Required setup program is unavailable'));return;}
  signal?.addEventListener('abort',abort,{once:true});child.on('error',()=>done(Error('Required setup program is unavailable')));
  child.stdout.on('data',chunk=>{size+=chunk.length;if(size>2*1024*1024){kill();done(Error('Setup output exceeded its safe limit'));}else stdout+=chunk.toString('utf8');});
  child.stderr.on('data',()=>{});child.stdin.on('error',()=>{});child.on('close',code=>done(null,{code,stdout}));child.stdin.end(input);
 });
}
function validEndpoint(input){if(!input||typeof input.host!=='string'||!/^(?=.{1,253}$)[a-zA-Z0-9](?:[a-zA-Z0-9.-]*[a-zA-Z0-9])?$/.test(input.host)||input.host.includes('..')||!Number.isInteger(input.port)||input.port<1||input.port>65535)throw Error('Invalid SSH host or port');return {host:input.host,port:input.port};}
function validate(input,arch){
 if(!input||!['install','update','remove','discover'].includes(input.action)||!['local','ssh'].includes(input.target))throw Error('Invalid setup operation');
 if(input.confirmed!==true)throw Error('Confirm the operation review first');
 if(typeof input.folder!=='string'||!path.posix.isAbsolute(input.folder)||input.folder.length>2048||/[\0\r\n]/.test(input.folder))throw Error('Choose an absolute dedicated installation folder');
 if(input.eraseData&&(input.action!=='remove'||input.deleteConfirmation!=='DELETE'))throw Error('Type DELETE to confirm data removal');
 if(input.target==='local'&&arch==='arm64'&&!['remove','discover'].includes(input.action)&&input.allowEmulation!==true)throw Error('Approve linux/amd64 emulation on Apple Silicon');
 if(input.target==='ssh'){validEndpoint(input.ssh);if(!/^SHA256:[A-Za-z0-9+/]{43}$/.test(input.ssh.fingerprint))throw Error('Verify and confirm the SSH host fingerprint first');}
 if(input.installationId!==undefined&&!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(input.installationId))throw Error('Invalid installation identity');
}
async function defaultSsh(resourcesPath){const {makeSshTools}=await import(pathToFileURL(path.join(resourcesPath,'setup/scripts/server-provisioning-ssh.mjs')).href);const {Client,utils}=require(path.join(resourcesPath,'setup/node_modules/ssh2'));return makeSshTools(Client,utils.parseKey);}
function createMacSetupRunner({resourcesPath,arch=process.arch,execute:exec=execute,ssh,prepareDocker,pythonExecutable=path.join(resourcesPath,'setup/python/bin/python3')}={}){
 const scripts=path.join(resourcesPath,'setup/scripts');
 const resource=name=>{const file=path.join(scripts,name);if(!fs.existsSync(file)||!fs.lstatSync(file).isFile())throw Error('Packaged setup resources are unavailable');return file;};
 async function tools(){return ssh||await defaultSsh(resourcesPath);}
 async function checked(file,args,options){const result=await exec(file,args,{shell:false,...options});if(result.code!==0)throw Error('Setup prerequisite failed. Check Docker Desktop and Python 3 installation.');return result.stdout||'';}
 async function prepare(input,signal,onProgress){
  if(prepareDocker)return prepareDocker(input,{signal,onProgress});
  try{await checked(pythonExecutable,['--version'],{signal,timeout:15000});}catch{throw Error('The bundled Python runtime is unavailable. Reinstall this CastLink client from the official release.');}
  let app=['/Applications/Docker.app',path.join(os.homedir(),'Applications/Docker.app')].find(file=>fs.existsSync(path.join(file,'Contents/Resources/bin/docker')));
  if(!app){
   if(input.installDocker!==true)throw Error('Docker Desktop is required. Select Install Docker Desktop in the review and accept its license to continue.');
   if(input.acceptDockerLicense!==true)throw Error('Review and accept the Docker Desktop license before installation');
   const temp=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-docker-'));const image=path.join(temp,'Docker.dmg'),mount=path.join(temp,'mount');fs.mkdirSync(mount);let mounted=false;
   try{
    onProgress?.({stage:'docker-download'});
    await checked('/usr/bin/curl',['--fail','--location','--proto','=https','--proto-redir','=https','--tlsv1.2','--output',image,'https://desktop.docker.com/mac/main/'+(arch==='arm64'?'arm64':'amd64')+'/Docker.dmg'],{signal,timeout:900000});
    await checked('/usr/bin/hdiutil',['attach','-nobrowse','-readonly','-mountpoint',mount,image],{signal,timeout:120000});mounted=true;
    const source=path.join(mount,'Docker.app');await checked('/usr/bin/codesign',['--verify','--deep','--strict','--test-requirement','=identifier "com.docker.docker" and anchor apple generic and certificate leaf[subject.OU] = "9BNSXJN65R"',source],{signal,timeout:120000});
    await checked('/usr/sbin/spctl',['--assess','--type','execute',source],{signal,timeout:120000});
    const destination=path.join(os.homedir(),'Applications');fs.mkdirSync(destination,{recursive:true});app=path.join(destination,'Docker.app');
    if(fs.existsSync(app))throw Error('Docker installation destination already exists');
    await checked('/usr/bin/ditto',[source,app],{signal,timeout:300000});
   }finally{if(mounted)await exec('/usr/bin/hdiutil',['detach',mount],{shell:false,timeout:30000}).catch(()=>{});fs.rmSync(temp,{recursive:true,force:true});}
  }
  await checked('/usr/bin/codesign',['--verify','--deep','--strict','--test-requirement','=identifier "com.docker.docker" and anchor apple generic and certificate leaf[subject.OU] = "9BNSXJN65R"',app],{signal,timeout:120000});
  const executable=path.join(app,'Contents/Resources/bin/docker');
  const ready=async()=>{try{return JSON.parse(await checked(executable,['--context','desktop-linux','info','--format','{{json .}}'],{signal,timeout:15000})).OSType==='linux';}catch{return false;}};
  if(!await ready()){
   if(['remove','discover'].includes(input.action))throw Error('Start Docker Desktop before removing an installation');
   await checked('/usr/bin/open',['-a',app],{signal,timeout:15000});onProgress?.({stage:'docker-start',message:'Finish Docker Desktop first-run permissions if prompted.'});
   for(let attempt=0;attempt<60;attempt++){if(signal?.aborted)throw Error('Setup cancelled');if(await ready())return {executable,context:'desktop-linux'};await new Promise(resolve=>setTimeout(resolve,2000));}
   throw Error('Docker Desktop did not become ready. Complete its first-run setup and retry.');
  }
  return {executable,context:'desktop-linux'};
 }
 async function trustCertificate(folder,installationId,{remove=false,signal}={}){
  const file=path.join(folder,'server-origin-ca.pem'),marker=path.join(folder,'.castlink-macos-trust.json');
  for(let current=path.resolve(folder);;current=path.dirname(current)){if(fs.lstatSync(current).isSymbolicLink())throw Error('Certificate folder contains a symbolic link');if(path.dirname(current)===current)break;}
  if(remove&&!fs.existsSync(marker))return false;
  if(fs.lstatSync(file).isSymbolicLink()||fs.statSync(file).size>16384)throw Error('Invalid local certificate file');
  let cert;try{cert=new X509Certificate(fs.readFileSync(file));}catch{throw Error('Invalid local certificate file');}
  if(!cert.ca||cert.validToDate<Date.now()||cert.validFromDate>Date.now())throw Error('Invalid local certificate authority');
  const fingerprint=cert.fingerprint.replaceAll(':',''),fingerprint256=cert.fingerprint256.replaceAll(':','');
  if(fs.existsSync(marker)){
   if(fs.lstatSync(marker).isSymbolicLink()||fs.statSync(marker).size>2048)throw Error('Certificate trust receipt changed');const saved=JSON.parse(fs.readFileSync(marker,'utf8'));
   if(saved.installationId!==installationId||saved.fingerprint!==fingerprint||saved.fingerprint256!==fingerprint256)throw Error('Certificate trust ownership changed');
   if(!remove)return true;
  }
  const keychain=path.join(os.homedir(),'Library/Keychains/login.keychain-db');
  await checked('/usr/bin/security',remove?['delete-certificate','-Z',fingerprint,'-t',keychain]:['add-trusted-cert','-r','trustRoot','-k',keychain,file],{signal,timeout:120000});
  if(remove){fs.unlinkSync(marker);return false;}
  const temporary=marker+'.'+randomUUID();fs.writeFileSync(temporary,JSON.stringify({installationId,fingerprint,fingerprint256}),{flag:'wx',mode:0o600});fs.renameSync(temporary,marker);return true;
 }
 return {
  trustCertificate,
  async discover(input,options){return this.run({...input,action:'discover',confirmed:true,folder:input.folder||'/'},options);},
  async probe(endpoint){return (await tools()).probeSshFingerprint(validEndpoint(endpoint));},
  async authorizeKey(endpoint,savePrivateKey){
   validEndpoint(endpoint);if(!/^SHA256:[A-Za-z0-9+/]{43}$/.test(endpoint.fingerprint))throw Error('Verify the SSH fingerprint first');
   const transport=await tools(),keys=await transport.generateSshKeyPair();let session,verification,saved=false,path;
   try{
    path=await savePrivateKey(keys.privateKey);if(!path)throw Error('Key save was cancelled');saved=true;
    session=await transport.openVerifiedSsh({...endpoint});
    const source=fs.readFileSync(resource('server-ssh-authorize-key.py')).toString('base64'),payload=Buffer.from(JSON.stringify({publicKey:keys.publicKey})).toString('base64');
    const program="import base64,json\nnamespace={'__name__':'castlink_authorize'}\nexec(compile(base64.b64decode('"+source+"'),'castlink-authorize','exec'),namespace)\nprint(json.dumps(namespace['main'](json.loads(base64.b64decode('"+payload+"')))))\n";
    const value=JSON.parse((await transport.executeFixedSsh(session,'python3 -',program,30000)).trim());if(value.ok!==true)throw Error();
    session.end();session=undefined;verification=await transport.openVerifiedSsh({...validEndpoint(endpoint),fingerprint:endpoint.fingerprint,authType:'private-key',privateKey:keys.privateKey});
    return {path,privateKey:keys.privateKey};
   }catch{throw Error(saved?'The key was saved, but a fresh SSH login was not confirmed. Keep the saved key and your previous login; check the server before retrying.':'SSH key creation was cancelled or unavailable. Existing access was retained.');}
   finally{session?.end();verification?.end();keys.privateKey='';}
  },
  async run(input,{signal,onProgress}={}){
   validate(input,arch);if(signal?.aborted)throw Error('Setup cancelled');
   const payload={action:input.action,target:input.target,folder:input.folder,confirmed:true,eraseData:input.eraseData===true,deleteConfirmation:input.deleteConfirmation,installationId:input.installationId,locale:input.locale||'en',hostArch:arch,allowEmulation:input.allowEmulation===true,reconfigure:input.reconfigure===true,config:input.config,roomPassword:input.roomPassword};
   let session,result,abort;
   try{
    onProgress?.({stage:'prerequisites'});
    if(input.target==='local'){
     const docker=await prepare(input,signal,onProgress);payload.dockerExecutable=docker.executable;payload.dockerContext=docker.context;
     result=await exec(pythonExecutable,['-I',resource('macos-compose-setup.py')],{shell:false,input:JSON.stringify(payload),signal,timeout:3600000});
    }else{
     const transport=await tools();session=await transport.openVerifiedSsh({...input.ssh});abort=()=>session?.end();signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)throw Error('Setup cancelled');
     if(input.action==='install'){
      onProgress?.({stage:'ubuntu-runtime'});const bootstrap=fs.readFileSync(resource('ubuntu-easy-setup-bootstrap.sh'),'utf8');
      await transport.executeFixedSsh(session,'bash -s -- install',bootstrap,1200000);
     }
     payload.dockerExecutable='/usr/bin/docker';payload.dockerContext='default';payload.linuxSource=fs.readFileSync(resource('linux-compose-setup.py')).toString('base64');payload.backendSource=fs.readFileSync(resource('macos-compose-setup.py')).toString('base64');
     const encoded=Buffer.from(JSON.stringify(payload)).toString('base64');
     const program="import base64,json\ndata=json.loads(base64.b64decode('"+encoded+"'))\nnamespace={'__name__':'castlink_mac_remote'}\nexec(compile(base64.b64decode(data['backendSource']),'castlink-macos-setup','exec'),namespace)\ntry:\n print(json.dumps(namespace['run'](data)),flush=True)\nexcept Exception as failure:\n if isinstance(failure,namespace['CompatibilityError']):\n  print(json.dumps({'ok':False,'errorCode':'WINDOWS_LAYOUT_UNSUPPORTED'}),flush=True)\n else:\n  print(json.dumps({'ok':False}),flush=True)\n  raise SystemExit(1)\n";
     result={code:0,stdout:await transport.executeFixedSsh(session,'python3 -',program,input.action==='discover'?120000:3600000)};
    }
    if(signal?.aborted)throw Error('Setup cancelled');
    let ack;for(const line of (result.stdout||'').split(/\r?\n/)){try{const value=JSON.parse(line);if(value&&typeof value==='object'&&'ok' in value)ack=value;}catch{}}
    if(ack?.errorCode==='WINDOWS_LAYOUT_UNSUPPORTED'){
     const guidance={en:'This Windows server layout or version is not supported for verified adoption. Use its original setup wizard. Server configuration and data were retained.',ru:'Эта версия или конфигурация сервера Windows не поддерживает проверенный перенос. Используй исходный мастер установки. Настройки и данные сервера сохранены.','zh-CN':'此 Windows 服务器版本或配置不支持经过验证的接管。请使用原始安装向导。已保留服务器配置和数据。'};
     throw Object.assign(Error(guidance[input.locale]||guidance.en),{code:'WINDOWS_LAYOUT_UNSUPPORTED'});
    }
    if(input.action==='discover'){
     if(result.code!==0||ack?.ok!==true||ack.action!=='discover'||!Array.isArray(ack.installations)||ack.installations.length>64)throw Error('Server discovery was not confirmed');
     return {installations:ack.installations.filter(value=>typeof value.folder==='string'&&path.posix.isAbsolute(value.folder)&&/^[a-f0-9-]{36}$/.test(value.installationId||'')&&typeof value.origin==='string').map(value=>({folder:value.folder,installationId:value.installationId,origin:value.origin,completed:value.completed===true,...(value.configuration&&typeof value.configuration==='object'?{configuration:value.configuration}:{}),...(typeof value.version==='string'?{version:value.version}:{}),...(/^[a-f0-9]{40}$/.test(value.sourceCommit||'')?{sourceCommit:value.sourceCommit}:{}),...(typeof value.daemonId==='string'?{daemonId:value.daemonId}:{}),...(value.compatibility==='windows-remote-v1'?{compatibility:value.compatibility}:{})}))};
    }
    if(result.code!==0||!ack||ack.ok!==true||ack.action!==input.action||ack.completed!==true||!/^[a-f0-9-]{36}$/.test(ack.installationId||''))throw Error('Setup completion acknowledgement was not confirmed. Existing data and backups were retained.');
    if(input.target==='local'){if(input.action==='remove')await trustCertificate(input.folder,ack.installationId,{remove:true,signal}).catch(()=>{ack.certificateTrustRemovalPending=true;});else if(input.trustLocalCertificate===true)ack.certificateTrusted=await trustCertificate(input.folder,ack.installationId,{signal}).catch(()=>false);}
    return Object.fromEntries(Object.entries(ack).filter(([key])=>['ok','action','completed','installationId','origin','readiness','backup','outcome','dataRetained','certificateTrusted','certificateTrustRemovalPending','version','sourceCommit','daemonId','installations','configuration'].includes(key)));
   }catch(error){if(error.code==='WINDOWS_LAYOUT_UNSUPPORTED')throw error;if(input.target==='ssh')throw Error(signal?.aborted?'Setup cancelled; remote work may still be running. Reconnect and check this installation before retrying.':'SSH setup did not complete. Check the verified host, root login, Ubuntu 22.04/24.04 x86_64, Docker and the installation receipt. Existing data was retained.');throw error;}
   finally{payload.roomPassword='';input.roomPassword='';if(input.ssh){input.ssh.password='';input.ssh.privateKey='';input.ssh.passphrase='';}if(abort)signal?.removeEventListener('abort',abort);session?.end();}
  },
 };
}
function createMacSetupAdapter({resourcesPath,BrowserWindow,ipcMain,dialog,indexPath,runner=createMacSetupRunner({resourcesPath}),arch=process.arch,homeDirectory=os.homedir()}={}){
 let window,controller,busy=false,initial,generatedKey;
 const names=['state','run','probe','folder','cancel','generate-key','discover'];
 const authorize=event=>{if(!window||event.sender!==window.webContents||event.senderFrame!==window.webContents.mainFrame)throw Error('Unauthorized setup request');};
 const send=value=>{if(window&&!window.isDestroyed())window.webContents.send(CHANNEL+'progress',value);};
 function register(){
  const handle=(name,fn)=>ipcMain.handle(CHANNEL+name,async(event,value)=>{authorize(event);return fn(value);});
  handle('state',()=>({...initial,arch,defaultFolder:path.join(homeDirectory,'CastLink Server'),installations:(()=>{try{return indexPath?require('./macos-server-discovery.cjs').listMacInstallations(indexPath):[];}catch{return [];}})()}));
  handle('folder',async()=>{if(busy)throw Error('Setup is running');const value=await dialog.showOpenDialog(window,{properties:['openDirectory','createDirectory']});return value.canceled?null:value.filePaths[0];});
  handle('probe',async value=>{if(busy)throw Error('Setup is running');return runner.probe(value);});
  handle('generate-key',async value=>{if(busy)throw Error('Setup is running');busy=true;try{
   const destination=await dialog.showSaveDialog(window,{defaultPath:path.join(homeDirectory,'castlink-server-key.pem'),buttonLabel:'Save SSH key'});if(destination.canceled)return {cancelled:true};
   const result=await runner.authorizeKey(value,async secret=>{const fd=fs.openSync(destination.filePath,'wx',0o600);try{fs.writeFileSync(fd,secret);fs.fsyncSync(fd);}finally{fs.closeSync(fd);}return destination.filePath;});generatedKey={privateKey:result.privateKey,...validEndpoint(value),fingerprint:value.fingerprint};return {path:result.path};
  }finally{busy=false;}});
  handle('discover',async value=>{if(busy)throw Error('Setup is running');busy=true;controller=new AbortController();try{
   if(value?.ssh?.authType==='generated-key'){if(!generatedKey||generatedKey.host!==value.ssh.host||generatedKey.port!==value.ssh.port||generatedKey.fingerprint!==value.ssh.fingerprint)throw Error('Generated key target changed');value={...value,ssh:{...value.ssh,authType:'private-key',privateKey:generatedKey.privateKey}};}
   return await runner.discover(value,{signal:controller.signal,onProgress:send});
  }finally{busy=false;controller=undefined;}});
  handle('cancel',()=>{controller?.abort();return {cancelled:true};});
  handle('run',async value=>{if(busy)throw Error('Setup is already running');busy=true;controller=new AbortController();try{
   if(initial.installationId&&(value.target!==initial.target||value.folder!==initial.folder||initial.target==='ssh'&&(value.ssh?.host!==initial.ssh.host||value.ssh?.port!==initial.ssh.port||value.ssh?.fingerprint!==initial.ssh.fingerprint)))throw Error('Saved setup target identity changed');
   if(value?.ssh?.authType==='generated-key'){if(!generatedKey||generatedKey.host!==value.ssh.host||generatedKey.port!==value.ssh.port||generatedKey.fingerprint!==value.ssh.fingerprint)throw Error('Generated key target changed');value={...value,ssh:{...value.ssh,authType:'private-key',privateKey:generatedKey.privateKey}};}
   const request={...value,action:initial.action,locale:initial.locale,...(initial.installationId?{installationId:initial.installationId}:{})};
   const result=await runner.run(request,{signal:controller.signal,onProgress:send});
   if(indexPath)try{const store=require('./macos-server-discovery.cjs');if(initial.action==='remove')store.removeMacInstallation(indexPath,request,result.installationId,!request.eraseData);else store.recordMacInstallation(indexPath,request,result);}catch{result.indexWarning=true;}
   return result;
  }finally{busy=false;controller=undefined;}});
 }
 return {async launch(action,locale='ru',folder){
  if(!['install','update','remove'].includes(action))throw Error('Invalid setup action');if(!['ru','en','zh-CN'].includes(locale))throw Error('Invalid setup language');let saved;if(folder&&typeof folder==='object'){if(action!=='update'||!indexPath)throw Error('Invalid saved setup target');saved=require('./macos-server-discovery.cjs').verifiedMacRecord(indexPath,folder);folder=saved.folder;}
  if(folder!==undefined&&(action!=='update'||typeof folder!=='string'||!path.isAbsolute(folder)))throw Error('Invalid installation folder');
  if(window&&!window.isDestroyed()){window.focus();throw Error('Setup wizard is already open');}
  initial={action,locale,folder,...(saved?{target:saved.target,ssh:saved.ssh,installationId:saved.installationId,configuration:saved.configuration}:{})};window=new BrowserWindow({width:850,height:900,minWidth:620,minHeight:640,title:'CastLink Server Setup',show:false,webPreferences:{preload:path.join(__dirname,'macos-setup-preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true}});register();
  window.webContents.setWindowOpenHandler?.(()=>({action:'deny'}));window.webContents.on?.('will-navigate',event=>event.preventDefault());
  window.on('close',event=>{if(busy){event.preventDefault();send({stage:'busy',message:'Cancel the operation and wait before closing.'});}});
  window.on('closed',()=>{if(generatedKey)generatedKey.privateKey='';generatedKey=undefined;controller?.abort();for(const name of names)ipcMain.removeHandler(CHANNEL+name);window=undefined;});
  await window.loadFile(path.join(__dirname,'../ui/macos-setup.html'));window.show();return {started:true};
 }};
}
module.exports={createMacSetupAdapter,createMacSetupRunner,execute};
