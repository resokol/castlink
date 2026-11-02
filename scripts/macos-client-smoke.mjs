// Launch the actual candidate with an isolated profile; debugging exists only
// for this test-owned process on loopback and is torn down in finally.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import https from 'node:https';
import {randomBytes} from 'node:crypto';
import {spawn,execFileSync} from 'node:child_process';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {verifyMacPackagedResources} from './macos-packaged-resources.mjs';

export async function connectCdp(target,port,{WebSocketImpl=globalThis.WebSocket,timeoutMs=5000}={}){
 const endpoint=new URL(target.webSocketDebuggerUrl);
 if(endpoint.protocol!=='ws:'||!['127.0.0.1','localhost'].includes(endpoint.hostname)||Number(endpoint.port)!==port||endpoint.username||endpoint.password)throw Error('Unexpected debugger endpoint');
 const socket=new WebSocketImpl(endpoint),pending=new Map();let nextId=0,closed=false;
 const failPending=error=>{for(const request of pending.values()){clearTimeout(request.timer);request.reject(error);}pending.clear();};
 socket.addEventListener('message',event=>{
  let data;try{if(typeof event.data!=='string'||event.data.length>1048576)throw Error();data=JSON.parse(event.data);if(!data||typeof data!=='object'||Array.isArray(data))throw Error();}catch{closed=true;failPending(Error('Malformed debugger response'));socket.close();return;}
  const request=pending.get(data.id);if(!request)return;
  pending.delete(data.id);clearTimeout(request.timer);
  if(data.error)request.reject(Error('Debugger command failed: '+request.method));else request.resolve(data.result);
 });
 socket.addEventListener('close',()=>{closed=true;failPending(Error('Debugger closed'));});
 socket.addEventListener('error',()=>failPending(Error('Debugger failed')));
 try{
  await new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>reject(Error('Debugger connection timeout')),timeoutMs);
   socket.addEventListener('open',()=>{clearTimeout(timer);resolve();},{once:true});
   socket.addEventListener('error',()=>{clearTimeout(timer);reject(Error('Debugger failed'));},{once:true});
   socket.addEventListener('close',()=>{clearTimeout(timer);reject(Error('Debugger closed'));},{once:true});
  });
 }catch(error){socket.close();throw error;}
 function request(method,params={}){
  if(closed)return Promise.reject(Error('Debugger closed'));
  const id=++nextId;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{pending.delete(id);reject(Error('Debugger command timeout: '+method));},timeoutMs);
   pending.set(id,{resolve,reject,timer,method});
   try{socket.send(JSON.stringify({id,method,params}));}catch{clearTimeout(timer);pending.delete(id);reject(Error('Debugger send failed'));}
  });
 }
 return {request,async evaluate(expression){
  const response=await request('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true,userGesture:true});
  if(response?.exceptionDetails)throw Error('Renderer evaluation failed');return response?.result?.value;
 },close(){closed=true;failPending(Error('Debugger closed'));socket.close();}};
}

export function isPackagedPage(target,bundle,file){
 if(target?.type!=='page'||typeof target.url!=='string')return false;
 try{const url=new URL(target.url);return !url.search&&!url.hash&&fileURLToPath(url)===path.join(path.resolve(bundle),'Contents/Resources/app.asar/ui',file);}catch{return false;}
}

const URI_SCHEMES=Object.freeze(['castlink','castlink-remote','castlink-presenter','castlink-share']);
export async function verifyMacUriRegistration({bundle,run=execFileSync}){
 const options={encoding:'utf8',shell:false,timeout:10000,maxBuffer:65536,killSignal:'SIGKILL'};
 const declarations=JSON.parse(await run('/usr/bin/plutil',['-extract','CFBundleURLTypes','json','-o','-',path.join(bundle,'Contents/Info.plist')],options));
 const schemes=Array.isArray(declarations)?declarations.flatMap(value=>Array.isArray(value.CFBundleURLSchemes)?value.CFBundleURLSchemes:[]):[];
 if(JSON.stringify([...schemes].sort())!==JSON.stringify([...URI_SCHEMES].sort()))throw Error('Packaged URI declarations do not contain exactly the four CastLink schemes');
 const query="ObjC.import('AppKit'); const schemes=['castlink','castlink-remote','castlink-presenter','castlink-share']; const handlers={}; for(const scheme of schemes){const application=$.NSWorkspace.sharedWorkspace.URLForApplicationToOpenURL($.NSURL.URLWithString(scheme+'://connect')); handlers[scheme]=ObjC.unwrap(application.path);} JSON.stringify(handlers);";
 const handlers=JSON.parse(await run('/usr/bin/osascript',['-l','JavaScript','-e',query],options)),candidate=fs.realpathSync(bundle);
 for(const scheme of URI_SCHEMES){
  let resolved;try{resolved=fs.realpathSync(handlers[scheme]);}catch{}
  if(resolved!==candidate)throw Error('macOS URI handler does not resolve to this candidate: '+scheme);
 }
 return {status:'PASS',schemes:[...URI_SCHEMES],selectedHandlers:'PASS',delivery:'NOT VERIFIED'};
}

export function claimHelperProfile(directory){
 try{fs.lstatSync(directory);throw Error('Helper profile already exists; refusing to touch it');}catch(error){if(error.code!=='ENOENT')throw error;}
 const nonce=randomBytes(24).toString('hex');fs.mkdirSync(directory,{mode:0o700});
 const identity=fs.lstatSync(directory),marker=path.join(directory,'.castlink-packaged-smoke-owner');fs.writeFileSync(marker,nonce,{flag:'wx',mode:0o600});
 return ()=>{
  const current=fs.lstatSync(directory),receipt=fs.lstatSync(marker);
  if(!current.isDirectory()||current.dev!==identity.dev||current.ino!==identity.ino||!receipt.isFile()||fs.readFileSync(marker,'utf8')!==nonce)throw Error('Helper profile ownership changed; refusing cleanup');
  fs.rmSync(directory,{recursive:true});
 };
}

export async function createUriRejectionFixture({directory}){
 const key=path.join(directory,'fixture.key'),certificate=path.join(directory,'fixture.crt'),configuration=path.join(directory,'fixture.cnf');
 fs.writeFileSync(configuration,'[req]\nprompt=no\ndistinguished_name=subject\nx509_extensions=extensions\n[subject]\nCN=CastLink owned loopback fixture\n[extensions]\nsubjectAltName=IP:127.0.0.1\nbasicConstraints=critical,CA:TRUE\nkeyUsage=critical,digitalSignature,keyEncipherment,keyCertSign\nextendedKeyUsage=serverAuth\n',{mode:0o600});
 execFileSync('/usr/bin/openssl',['req','-x509','-newkey','rsa:2048','-nodes','-sha256','-days','1','-keyout',key,'-out',certificate,'-config',configuration],{stdio:'ignore',shell:false,timeout:15000,killSignal:'SIGKILL'});fs.chmodSync(key,0o600);
 const requests=[];let expected,tlsFailures=0;
 const server=https.createServer({key:fs.readFileSync(key),cert:fs.readFileSync(certificate)},(request,response)=>{
  const record={scheme:expected?.scheme,matched:false,complete:false};requests.push(record);let size=0,body='';
  request.on('data',chunk=>{size+=chunk.length;if(size>16384)request.destroy();else body+=chunk.toString('utf8');});
  request.on('end',()=>{
   let value;try{value=JSON.parse(body);}catch{}
   const presenter=expected?.scheme==='castlink-presenter',endpoint=presenter?'/api/co-presentation-helper':'/api/remote-pc-control';
   const required=presenter?{action:'pair',code:expected?.token}:{purpose:'remote-pc-v1',action:'pair',ticket:expected?.token};
   record.matched=Boolean(expected&&request.method==='POST'&&request.url===endpoint&&!request.headers.authorization&&!request.headers.cookie&&value&&JSON.stringify(Object.keys(value).sort())===JSON.stringify(Object.keys(required).sort())&&Object.entries(required).every(([name,entry])=>value[name]===entry));
   record.complete=true;response.writeHead(record.matched?401:400,{'content-type':'application/json','cache-control':'no-store'});response.end('{"error":"owned-fixture-pair-rejected"}');
  });
 });
 server.headersTimeout=5000;server.requestTimeout=5000;server.on('tlsClientError',()=>tlsFailures++);
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const origin='https://127.0.0.1:'+server.address().port;
 return {certificate,origin,arm(scheme){
  if(!URI_SCHEMES.includes(scheme)||scheme==='castlink')throw Error('Unsupported URI fixture mode');
  expected={scheme,token:(scheme==='castlink-presenter'?'cp2_':'rp1_')+randomBytes(32).toString('base64url')};
  return scheme+'://connect?server='+encodeURIComponent(origin)+'#'+expected.token;
 },observed(scheme){return requests.filter(value=>value.scheme===scheme).some(value=>value.matched&&value.complete);},verify(scheme){
  const found=requests.filter(value=>value.scheme===scheme);
  if(found.length!==1||!found[0].matched||!found[0].complete||tlsFailures)throw Error('Packaged URI did not produce one exact trusted TLS pairing rejection: '+scheme);
  return {status:'PASS',pairRequests:1,rejected:true,transport:'owned-loopback-TLS',successfulOperation:'NOT VERIFIED'};
 },async close(){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}};
}

async function unusedLoopbackPort(){const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});const port=server.address().port;await new Promise(resolve=>server.close(resolve));return port;}

async function verifyUriRejectionModes({bundle,executable,directory}){
 const fixture=await createUriRejectionFixture({directory}),results={};
 const modes=[['castlink-remote','CastLink Remote PC Helper'],['castlink-share','CastLink Screen Share'],['castlink-presenter','CastLink Presentation Helper']];
 try{
  for(const [scheme,name]of modes){
   const port=await unusedLoopbackPort(),profile=path.join(os.homedir(),'Library/Application Support',name),cleanup=claimHelperProfile(profile);
   let child,exitCode=null,spawnError,session;
   const signal=kind=>{try{if(child?.pid)process.kill(-child.pid,kind);}catch{}};
   try{
    const uri=fixture.arm(scheme);
    child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${path.join(directory,'early-profile-'+scheme)}`,uri],{stdio:'ignore',detached:true,env:{...process.env,NODE_EXTRA_CA_CERTS:fixture.certificate}});
    child.once('error',error=>spawnError=error);child.once('exit',code=>exitCode=code??-1);
    const deadline=Date.now()+30000;
    while(!fixture.observed(scheme)&&Date.now()<deadline){if(spawnError)throw spawnError;if(exitCode!==null)throw Error('URI helper exited before its TLS rejection: '+scheme);await delay(100);}
    if(!fixture.observed(scheme))throw Error('URI helper pairing request was not observed: '+scheme);
    if(!fs.statSync(path.join(profile,'session')).isDirectory())throw Error('URI helper did not use the claimed profile');
    if(scheme==='castlink-presenter'){
     let target;
     while(Date.now()<deadline){
      if(exitCode!==null)throw Error('Presenter helper exited before its rejection UI');
      try{const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)});const pages=await response.json();target=pages.find(page=>isPackagedPage(page,bundle,'presentation-helper.html'));if(target)break;}catch{}
      await delay(100);
     }
     if(!target)throw Error('Packaged presenter rejection renderer did not load');session=await connectCdp(target,port);
     let observation;
     while(Date.now()<deadline){
      observation=await session.evaluate("(async()=>({ready:document.readyState,state:(await window.castlinkPresentationHelper.state()).state,nodeExposed:typeof process!=='undefined'||typeof require!=='undefined',preload:['connect','disconnect','state'].every(name=>typeof window.castlinkPresentationHelper[name]==='function'),errorVisible:document.getElementById('status')?.dataset.state==='error'}))()");
      if(observation.state==='error'&&observation.errorVisible)break;await delay(100);
     }
     if(observation?.state!=='error'||!observation.errorVisible||!observation.preload||observation.nodeExposed||!['interactive','complete'].includes(observation.ready))throw Error('Packaged presenter rejection UI or sandbox failed');
    }else{
     while(exitCode===null&&Date.now()<deadline)await delay(100);
     if(exitCode!==0)throw Error('Rejected URI helper did not exit cleanly: '+scheme);
    }
    results[scheme]={...fixture.verify(scheme),invocation:'packaged-executable-URI',...(scheme==='castlink-presenter'?{rejectionRenderer:'PASS',sandbox:'PASS'}:{rejectionExit:'PASS'}),captureOrAuthority:'NOT STARTED'};
   }finally{
    session?.close();if(child?.pid){signal('SIGTERM');if(exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);signal('SIGKILL');if(exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(1000)]);}
    cleanup();
   }
  }
  return results;
 }finally{await fixture.close();}
}

export async function runPackagedSmoke({bundle,expectedArch,output}){
 if(process.platform!=='darwin'||process.arch!==expectedArch||!['arm64','x64'].includes(expectedArch)||!bundle||!output)throw Error('Native macOS bundle smoke arguments required');
 const macOS=path.join(bundle,'Contents','MacOS'),executables=fs.readdirSync(macOS);
 if(executables.length!==1)throw Error('Expected one bundle executable');
 const executable=path.join(macOS,executables[0]);
 const arch=execFileSync('/usr/bin/lipo',['-archs',executable],{encoding:'utf8',timeout:5000,maxBuffer:65536,killSignal:'SIGKILL'}).trim();
 if(arch!==(expectedArch==='x64'?'x86_64':'arm64'))throw Error('Wrong bundle architecture');
 const packagedResources=await verifyMacPackagedResources({bundle:path.resolve(bundle),arch:expectedArch});
 fs.writeFileSync(path.join(path.dirname(output),'packaged-resources.json'),JSON.stringify(packagedResources,null,2)+'\n');
 const server=net.createServer();await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const port=server.address().port;await new Promise(resolve=>server.close(resolve));
 const profile=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-macos-smoke-')),sessions=[];
 let child,exitCode=null,spawnError;
 function assertRunning(){if(spawnError)throw spawnError;if(exitCode!==null)throw Error(`Candidate exited early: ${exitCode}`);}
 async function targets(){
  assertRunning();const response=await fetch(`http://127.0.0.1:${port}/json/list`,{signal:AbortSignal.timeout(1000)});
  if(!response.ok)throw Error('Debugger target listing failed');const pages=await response.json();
  if(!Array.isArray(pages)||pages.length>100)throw Error('Unexpected debugger targets');return pages;
 }
 async function waitForTarget(file,{exclude=new Set(),timeoutMs=30000}={}){
  const deadline=Date.now()+timeoutMs;
  while(Date.now()<deadline){
   assertRunning();let pages;try{pages=await targets();}catch{assertRunning();}
   const target=pages?.find(page=>!exclude.has(page.id)&&isPackagedPage(page,bundle,file));if(target)return target;
   await delay(100);
  }
  throw Error('Packaged renderer did not load: '+file);
 }
 async function inspect(session,expression,predicate,label){
  const deadline=Date.now()+10000;let value;
  while(Date.now()<deadline){assertRunning();value=await session.evaluate(expression);if(predicate(value))return value;await delay(100);}
  throw Error(label+' did not become ready');
 }
 function signalOwned(signal){try{if(child?.pid)process.kill(-child.pid,signal);}catch{}}
 try{
  child=spawn(executable,[`--remote-debugging-port=${port}`,'--remote-debugging-address=127.0.0.1',`--user-data-dir=${profile}`],{stdio:'ignore',detached:true});
  child.once('error',error=>spawnError=error);child.once('exit',code=>exitCode=code??-1);
  const launcherTarget=await waitForTarget('start.html'),launcher=await connectCdp(launcherTarget,port);sessions.push(launcher);
  const launcherState=await inspect(launcher,"({ready:document.readyState,title:document.title,buttons:document.querySelectorAll('button').length,nodeExposed:typeof process!=='undefined'||typeof require!=='undefined',settingsReady:Boolean(document.getElementById('version')?.textContent),preloadReady:typeof window.castlinkLauncher?.settings==='function'&&typeof window.castlinkLauncher?.setup==='function'})",value=>['interactive','complete'].includes(value?.ready)&&value.settingsReady,'Packaged launcher');
  console.log('Launcher observation:',JSON.stringify(launcherState));
  if(launcherState.buttons<1||launcherState.nodeExposed||!launcherState.preloadReady)throw Error('Launcher DOM, preload or sandbox failed');
  const uriRegistration=await verifyMacUriRegistration({bundle:path.resolve(bundle)});
  const panels=await launcher.evaluate(`(()=>{
   const get=id=>document.getElementById(id),locale=get('locale');locale.value='en';locale.dispatchEvent(new Event('change',{bubbles:true}));
   get('open-help').click();const helpOpened=!get('help-panel').hidden&&document.activeElement.id==='close-help';
   get('close-help').click();const helpClosed=get('help-panel').hidden&&document.activeElement.id==='open-help';
   get('open-setup').click();const setupOpened=!get('setup-panel').hidden&&document.activeElement.id==='setup-install';
   get('close-setup').click();const setupClosed=get('setup-panel').hidden&&document.activeElement.id==='open-setup';
   return {helpOpened,helpClosed,setupOpened,setupClosed};
  })()`);
  if(!panels||!Object.values(panels).every(value=>value===true))throw Error('Launcher local panel flow failed');
  const previousTargets=new Set((await targets()).map(target=>target.id));
  const setupRequested=await launcher.evaluate("(()=>{document.getElementById('open-setup').click();const panel=document.getElementById('setup-panel'),button=document.getElementById('setup-install');if(panel.hidden||button.disabled)return false;button.click();return true;})()");
  if(!setupRequested)throw Error('Launcher setup action was unavailable');
  const setupTarget=await waitForTarget('macos-setup.html',{exclude:previousTargets}),setup=await connectCdp(setupTarget,port);sessions.push(setup);
  const setupState=await inspect(setup,"({ready:document.readyState,title:document.getElementById('title')?.textContent,submit:document.getElementById('submit')?.textContent,initialized:Boolean(document.getElementById('trust-certificate')&&document.getElementById('generate-key')&&document.getElementById('turn-domain')),nodeExposed:typeof process!=='undefined'||typeof require!=='undefined',error:document.getElementById('error')?.textContent,translated:[...document.querySelectorAll('[data-t]')].every(element=>element.textContent.trim().length>0)})",value=>['interactive','complete'].includes(value?.ready)&&value.initialized&&Boolean(value.title),'Packaged setup');
  if(setupState.nodeExposed||setupState.error||!setupState.translated||setupState.title!=='Install server'||setupState.submit!=='Install server')throw Error('Setup DOM, translations or sandbox failed');
  const setupApi=await setup.evaluate(`(async()=>{
   const api=window.castlinkMacSetup,methods=['state','run','discover','generateKey','probe','folder','cancel','onProgress'];
   if(!api||Object.keys(api).length!==methods.length||!methods.every(name=>typeof api[name]==='function'))return {valid:false};
   const state=await api.state();return {valid:true,action:state.action,arch:state.arch,locale:state.locale};
  })()`);
  if(!setupApi?.valid||setupApi.action!=='install'||setupApi.arch!==expectedArch||setupApi.locale!=='en')throw Error('Setup preload state IPC failed');
  const setupControls=await setup.evaluate(`(()=>{
   const get=id=>document.getElementById(id),change=(id,value)=>{get(id).value=value;get(id).dispatchEvent(new Event('change',{bubbles:true}));};
   const local=get('target').value==='local'&&get('ssh-fields').hidden&&!get('docker-fields').hidden&&!get('browse').hidden;
   const options=[...get('target').options].map(option=>option.value).join(',')==='local,ssh';
   change('target','ssh');const remote=!get('ssh-fields').hidden&&get('docker-fields').hidden&&get('browse').hidden;
   change('auth','private-key');const privateKey=!get('key-fields').hidden&&get('password-field').hidden;
   change('auth','password');const password=get('key-fields').hidden&&!get('password-field').hidden;
   change('target','local');const restored=get('ssh-fields').hidden&&!get('docker-fields').hidden&&!get('browse').hidden;
   const translations={};for(const [locale,title]of [['ru','Установить сервер'],['zh-CN','安装服务器'],['en','Install server']]){
    change('locale',locale);translations[locale]=document.documentElement.lang===locale&&get('title').textContent===title&&get('submit').textContent===title&&[...document.querySelectorAll('[data-t]')].every(element=>element.textContent.trim().length>0);
   }
   const idle=!get('fields').disabled&&!get('submit').disabled&&get('cancel').disabled&&!get('status').textContent&&!get('error').textContent;
   const consentsUntouched=['confirm','install-docker','docker-license','trust-certificate','emulation','host-confirm','erase'].every(id=>!get(id).checked);
   return {local,options,remote,privateKey,password,restored,translations,idle,consentsUntouched,nodeExposed:typeof process!=='undefined'||typeof require!=='undefined'};
  })()`);
  if(!setupControls||setupControls.nodeExposed||!['local','options','remote','privateKey','password','restored','idle','consentsUntouched'].every(key=>setupControls[key]===true)||!['ru','zh-CN','en'].every(locale=>setupControls.translations?.[locale]===true))throw Error('Setup target controls, translations or idle state failed');
  console.log('Setup observation:',JSON.stringify({dom:setupState,preload:setupApi,controls:setupControls}));
  const uriRejectionBootstrap=await verifyUriRejectionModes({bundle:path.resolve(bundle),executable,directory:profile});
  fs.writeFileSync(output,JSON.stringify({arch:expectedArch,packagedLauncher:'PASS',launcherPanels:'PASS',packagedSetup:'PASS',setupTranslations:['en','ru','zh-CN'],setupTargetControls:'PASS',setupPreload:'PASS',sandbox:'PASS',setupOperations:'NOT RUN',uriRegistration,uriRejectionBootstrap,successfulUriModes:'NOT VERIFIED',nativeFeatures:'NOT VERIFIED'},null,2)+'\n');
  console.log('Packaged launcher, setup UI and renderer isolation PASS');
 }finally{
  for(const session of sessions)session.close();
  if(child?.pid){signalOwned('SIGTERM');if(exitCode===null)await Promise.race([new Promise(resolve=>child.once('exit',resolve)),delay(3000)]);signalOwned('SIGKILL');}
  fs.rmSync(profile,{recursive:true,force:true});
 }
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href){
 const [bundle,expectedArch,output]=process.argv.slice(2);await runPackagedSmoke({bundle,expectedArch,output});
}
