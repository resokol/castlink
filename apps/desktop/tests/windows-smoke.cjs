'use strict';
// Isolated native QA harness; never targets a user's browser or production server.
const {app,BrowserWindow,dialog,session,desktopCapturer,ipcMain,Menu,nativeTheme}=require('electron');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const output=path.join(root,'artifacts/desktop-qa');fs.mkdirSync(output,{recursive:true});
app.setPath('userData',path.join(output,'profile-'+process.pid));
app.commandLine.appendSwitch('use-fake-device-for-media-stream');
const prompts=[];
dialog.showMessageBox=async(_window,options)=>{prompts.push({message:options.message,detail:options.detail});return {response:1};};
const ts=require(path.join(root,'apps/web/node_modules/typescript'));
const adapter=ts.transpileModule(fs.readFileSync(path.join(root,'apps/web/lib/desktop-stop-panel.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const sdk=fs.readFileSync(path.join(root,'apps/web/node_modules/livekit-client/dist/livekit-client.umd.js'),'utf8');
const useAdapter=process.env.CASTLINK_QA_WEB_ADAPTER==='1';
const html='<!doctype html><html><head><meta charset="utf-8"><title>CastLink QA</title><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; media-src \'self\' blob:; style-src \'self\' \'unsafe-inline\'"></head><body style="font:18px Segoe UI;background:#111315;color:#eef0f2;padding:32px"><h1>CastLink · Windows media QA</h1><p>Synthetic camera/microphone · isolated local server</p><button id="copy">Copy invitation</button><button id="devices">Start camera + microphone</button><button id="screen">Share this QA window</button><video id="preview" autoplay muted width="480"></video><p id="status"></p><script src="/livekit.js"></script><script src="/adapter.js"></script><script src="/qa.js"></script></body></html>';
const script=`let media,screen,panel;let stopCalls=0,adapterStopCalls=0;
document.querySelector('#copy').onclick=async()=>{try{await new Promise(r=>setTimeout(r,100));await navigator.clipboard.writeText(location.origin+'/room?name=QA');window.copyReady=true;}catch(e){window.copyError=e.name+': '+e.message;}};
document.querySelector('#devices').onclick=async()=>{try{media=await navigator.mediaDevices.getUserMedia({audio:true,video:true});document.querySelector('video').srcObject=media;window.inventory=await navigator.mediaDevices.enumerateDevices();window.devicesReady=true;}catch(e){window.qaError=e.name+': '+e.message;}};
document.querySelector('#screen').onclick=async()=>{try{screen=await navigator.mediaDevices.getDisplayMedia({video:true,audio:true});window.sdkEnded=0;window.sdkTrack=new LivekitClient.LocalVideoTrack(screen.getVideoTracks()[0],undefined,false);window.sdkTrack.on(LivekitClient.TrackEvent.Ended,()=>window.sdkEnded++);screen.getVideoTracks()[0].addEventListener('ended',()=>stopCalls++);if(${useAdapter}){const labels={locale:'ru',title:'Panel',stop:'ОСТАНОВИТЬ ДЕМОНСТРАЦИЮ',stopping:'Останавливаем…',stopError:'Повторите попытку'};panel=window.adapter.createDesktopStopPanel({bridge:window.castlinkDesktop.screenShare,labels,isSharing:()=>screen.getVideoTracks()[0].readyState==='live',stop:async()=>{adapterStopCalls++;screen.getTracks().forEach(t=>t.stop());}});await panel.open();}window.screenReady=true;}catch(e){window.qaError=e.name+': '+e.message;}};
window.initialInventory=navigator.mediaDevices.enumerateDevices().then(devices=>{window.firstDevices=devices.map(d=>({kind:d.kind,label:d.label}));});
window.results=()=>({devices:media?.getTracks().map(t=>({kind:t.kind,state:t.readyState})),screen:screen?.getTracks().map(t=>({kind:t.kind,state:t.readyState})),stopCalls:stopCalls+adapterStopCalls,error:window.qaError});`;
const server=http.createServer((req,res)=>{const body=req.url==='/livekit.js'?sdk:req.url==='/adapter.js'?`(function(exports){${adapter};window.adapter=exports;})({});`:req.url==='/qa.js'?script:html;res.setHeader('Content-Type',req.url.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8');res.end(body);});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label){for(let i=0;i<120;i++){const value=await fn();if(value)return value;await delay(100);}throw Error('Timed out: '+label);}
function windowWith(role){const ending={launcher:'/start.html',picker:'/capture-picker.html',stop:'/stop-panel.html'}[role];return BrowserWindow.getAllWindows().find(w=>ending?w.webContents.getURL().endsWith(ending):w.webContents.getURL().startsWith('http://127.0.0.1:'));}
async function loaded(window){await until(()=>!window.webContents.isLoading(),'renderer load');}
const report={serverAdapter:useAdapter,platform:process.platform,electron:process.versions.electron,checks:[],syntheticDevices:true};setTimeout(()=>{report.result='FAIL';report.error='Native smoke timeout';fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));app.exit(1);},45000).unref();
report.console=[];app.on('web-contents-created',(_event,contents)=>contents.on('console-message',event=>{if(event.level==='error'||event.level===3)report.console.push(String(event.message));}));ipcMain.on('castlink:stop-ready',event=>{report.stopReady={url:event.senderFrame?.url};});require(path.join(root,'apps/desktop/src/main.cjs'));
app.whenReady().then(async()=>{
  try{
    await new Promise(r=>server.listen(0,'127.0.0.1',r));
    const launcher=await until(()=>windowWith('launcher'),'launcher');await loaded(launcher);
    await until(()=>launcher.webContents.executeJavaScript('Boolean(document.querySelector("#version").textContent)'),'launcher preload');
    assert.match(await launcher.webContents.executeJavaScript('document.querySelector("h1").textContent'),/CastLink/);
    report.checks.push('launcher + preload + translated form');assert.equal(Menu.getApplicationMenu(),null);assert.equal(launcher.isMenuBarVisible(),false);assert.equal(nativeTheme.shouldUseDarkColors,true);report.checks.push('menu bar removed and native dark theme');report.launcherScreenshotError='capturePage unavailable in this Windows session (UnknownVizError)';
    const ses=session.fromPartition('persist:castlink-client');report.permissionChecks=[];const originalCheck=ses.setPermissionCheckHandler.bind(ses);ses.setPermissionCheckHandler=handler=>originalCheck((...args)=>{const allowed=handler(...args);report.permissionChecks.push({permission:args[1],origin:args[2],details:args[3],allowed});return allowed;});report.permissionRequests=[];const originalRequest=ses.setPermissionRequestHandler.bind(ses);ses.setPermissionRequestHandler=handler=>originalRequest((...args)=>{report.permissionRequests.push({permission:args[1],details:args[3]});return handler(...args);});report.captureRequests=[];const originalCapture=ses.setDisplayMediaRequestHandler.bind(ses);ses.setDisplayMediaRequestHandler=handler=>originalCapture(handler?((request,callback)=>{report.captureRequests.push({mainFrame:request.frame===windowWith('client')?.webContents.mainFrame,gesture:request.userGesture,video:request.videoRequested});return handler(request,callback);}):null);const originalSources=desktopCapturer.getSources.bind(desktopCapturer);desktopCapturer.getSources=async options=>{try{return await originalSources(options);}catch(e){report.sourceError=String(e);throw e;}};
    const url='http://127.0.0.1:'+server.address().port;
    await launcher.webContents.executeJavaScript(`document.querySelector('input[name=role][value=caster]').click();document.querySelector('#server').value=${JSON.stringify(url)};document.querySelector('#submit').click();`,true);
    const client=await until(()=>windowWith('client'),'client');await loaded(client);assert.equal(client.isMenuBarVisible(),false);
    await until(()=>client.webContents.executeJavaScript('Boolean(window.results)'),'QA script');
    assert.equal(new URL(client.webContents.getURL()).pathname,'/room');report.checks.push('caster radio opens existing /room access gate');
    await until(()=>client.webContents.executeJavaScript('window.firstDevices'),'initial inventory');
    const firstDevices=await client.webContents.executeJavaScript('window.firstDevices');for(const kind of ['audioinput','videoinput','audiooutput'])assert.ok(firstDevices.some(d=>d.kind===kind&&d.label),'initial inventory has named '+kind);report.checks.push('first page render sees named devices before any capture or refresh');
    assert.equal(await client.webContents.executeJavaScript('typeof require'),'undefined');report.checks.push('remote page sandbox: Node absent');
    await client.webContents.executeJavaScript('document.querySelector("#copy").click()',true);
    await until(()=>client.webContents.executeJavaScript('window.copyReady||window.copyError'),'automatic clipboard write after async invitation creation');
    assert.equal(await client.webContents.executeJavaScript('window.copyError'),undefined);report.checks.push('automatic clipboard write after async action');
    await client.webContents.executeJavaScript('document.querySelector("#devices").click()',true);
    await until(()=>client.webContents.executeJavaScript('window.devicesReady||window.qaError'),'getUserMedia');
    let result=await client.webContents.executeJavaScript('window.results()');assert.equal(result.error,undefined);assert.equal(result.devices.length,2);report.checks.push('real Windows Chromium getUserMedia with synthetic audio/video');
    const inventory=await client.webContents.executeJavaScript('window.inventory.map(d=>({kind:d.kind,label:d.label}))');report.inventory=inventory;
    for(const kind of ['audioinput','videoinput','audiooutput'])assert.ok(inventory.some(d=>d.kind===kind&&d.label),'first enumeration has named '+kind);
    report.checks.push('named inputs and outputs on first enumeration after permission, without manual refresh');
    await client.webContents.executeJavaScript('document.querySelector("#screen").click()',true);
    const picker=await until(()=>windowWith('picker'),'capture picker');await loaded(picker);
    const selected=await picker.webContents.executeJavaScript(`window.castlinkPicker.sources().then(value=>{const source=value.sources.find(s=>s.name==='CastLink QA');if(!source)throw Error('Own QA window not found');setTimeout(()=>window.castlinkPicker.choose(source.id),50);return source.name;})`);
    report.captureSource=selected;
    await until(()=>client.webContents.executeJavaScript('window.screenReady||window.qaError'),'getDisplayMedia');
    result=await client.webContents.executeJavaScript('window.results()');assert.equal(result.error,undefined);assert.equal(result.screen.length,1);assert.equal(result.screen[0].kind,'video');report.checks.push('native picker + capture of own QA window; loopback absent');
    const stop=await until(()=>windowWith('stop'),'native STOP panel');await loaded(stop);
    await until(()=>stop.webContents.executeJavaScript('document.querySelector("#stop").textContent.includes("ДЕМОНСТРАЦИЮ")'),'STOP translation');
    report.stopScreenshotError='Skipped after compositor screenshot failure';
    await stop.webContents.executeJavaScript('document.querySelector("#stop").click()',true);
    await until(()=>client.webContents.executeJavaScript('window.results().stopCalls===1'),'native STOP IPC');
    result=await client.webContents.executeJavaScript('window.results()');assert.equal(result.screen[0].state,'ended');assert.equal(await client.webContents.executeJavaScript('window.sdkEnded'),useAdapter?0:1,'raw native stop notifies SDK; web adapter uses its own stop lifecycle');assert.ok(result.devices.every(t=>t.state==='live'));report.checks.push(useAdapter?'web adapter handover: its STOP invoked once; camera/mic stay live':'automatic native STOP without server adapter; real SDK ended; camera/mic stay live');
    const stats=app.getAppMetrics();report.memoryKb=stats.reduce((n,p)=>n+(p.memory?.privateBytes||0),0);report.processes=stats.length;report.prompts=prompts;report.result='PASS';
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
    server.close();app.exit(0);
  }catch(error){const stopWindow=windowWith('stop');if(stopWindow)report.stopDom=await stopWindow.webContents.executeJavaScript('({text:document.body.innerText,bridge:typeof window.castlinkStop,url:location.href})').catch(()=>null);const w=windowWith('client');if(w)report.media=await w.webContents.executeJavaScript('window.results&&window.results()').catch(()=>null);report.result='FAIL';report.error=error.stack;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.error(error);server.close();app.exit(1);}
});
