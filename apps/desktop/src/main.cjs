'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, session, desktopCapturer, shell, globalShortcut, nativeTheme, screen } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseServerInput, parseLaunchInput, parseDeepLink, isTrustedFrame, canNavigate, settingsForDisk } = require('./server-policy.cjs');
const { createPermissionPolicy, isRemoteLaunchPermission } = require('./permissions.cjs');
const { installDisplayCapture } = require('./capture.cjs');

const {isRemoteLaunch}=require('./remote-pc-protocol.cjs');
const remoteHelperMode=process.argv.some(isRemoteLaunch)||process.argv.includes('--remote-pc-helper');
const {isPresenterLaunch}=require('./presenter-protocol.cjs');
const presenterLaunch=process.argv.find(isPresenterLaunch);
const presentationHelperMode=!!presenterLaunch||process.argv.includes('--presentation-helper');
let buildInfo={};
try{buildInfo=JSON.parse(fs.readFileSync(path.join(__dirname,'../build-info.json'),'utf8'));}catch{}
const presenterBuild=buildInfo.presenterBuild===true;
const pptxTestBuild=presenterBuild||process.argv.includes('--pptx-test-build')||buildInfo.testBuild===true;
const allowLoopback=!app.isPackaged||pptxTestBuild&&!presenterBuild;
const remotePcQaMode=remoteHelperMode&&pptxTestBuild&&!presenterBuild&&process.argv.includes('--remote-pc-allow-loopback-test');
const applicationName=remoteHelperMode?(remotePcQaMode?'CastLink Remote PC Test':'CastLink Remote PC Helper'):presenterBuild?(presentationHelperMode?'CastLink Client Preview Presenter':'CastLink Client Preview'):presentationHelperMode?'CastLink Presentation Helper':pptxTestBuild?'CastLink PPTX Test':'CastLink Client';
app.setName(applicationName);
if(remoteHelperMode||presentationHelperMode||pptxTestBuild){
  const isolatedProfile=path.join(app.getPath('appData'),applicationName);
  fs.mkdirSync(path.join(isolatedProfile,'session'),{recursive:true});
  app.setPath('userData',isolatedProfile);
  app.setPath('sessionData',path.join(isolatedProfile,'session'));
  if(process.platform==='win32')app.setAppUserModelId?.(remoteHelperMode?'ru.castlink.remote-pc-helper':presenterBuild?(presentationHelperMode?'ru.castlink.client.preview.presenter':'ru.castlink.client.preview'):presentationHelperMode?'ru.castlink.presentation-helper':'ru.castlink.pptx-test');
}
let launcher, client, picker, finishPicker, pendingSources = [], permissionPolicy, captureDispose, stopController, slideController, setupController, powerPointController;
let settings = { serverOrigin: 'https://castlink.ru', reserveOrigins: [], locale: 'ru' }, quitting = false;
let pickerGeneration = 0, applicationMenu, audioRequested=false, processAudio, pendingDisplay, updateController;
let selectedDisplay, sharedDisplay,remoteControlController;
const {randomUUID}=require('node:crypto');
if(nativeTheme)nativeTheme.themeSource='system';
const trustedOrigins = new Set();
const resourcesRoot = () => app.isPackaged ? process.resourcesPath : path.join(__dirname,'../../../artifacts/desktop-native');
const ui = name => path.join(__dirname, '../ui', name);
const labels = () => ({
  ru: { connect:'Подключение…', server:'Сервер', change:'Сменить сервер…', exit:'Выйти', close:'Выйти из CastLink?', warning:'Соединение будет закрыто. Камера, микрофон и демонстрация этого приложения остановятся.', cancel:'Отмена', allow:'Разрешить', deny:'Не разрешать', permission:'Разрешение устройств', microphone:'Микрофон', camera:'Камера', display:'Выбор экрана или окна', output:'Выбор устройства вывода звука', fullscreen:'Полноэкранный режим', error:'Не удалось открыть сервер. Проверьте сеть и доверие HTTPS-сертификату.' },
  en: { connect:'Connecting…', server:'Server', change:'Change server…', exit:'Exit', close:'Exit CastLink?', warning:'This connection will close. This application’s camera, microphone and screen share will stop.', cancel:'Cancel', allow:'Allow', deny:'Deny', permission:'Device permission', microphone:'Microphone', camera:'Camera', display:'Screen or window selection', output:'Audio output selection', fullscreen:'Fullscreen', error:'Could not open the server. Check your connection and HTTPS certificate trust.' },
  'zh-CN': { connect:'正在连接…', server:'服务器', change:'更换服务器…', exit:'退出', close:'退出 CastLink？', warning:'连接将关闭。此应用的摄像头、麦克风和屏幕共享将停止。', cancel:'取消', allow:'允许', deny:'拒绝', permission:'设备权限', microphone:'麦克风', camera:'摄像头', display:'选择屏幕或窗口', output:'选择音频输出设备', fullscreen:'全屏', error:'无法打开服务器。请检查网络连接及 HTTPS 证书信任。' },
}[settings.locale]);

function preferences(role) {
  return { preload: path.join(__dirname, 'preload.cjs'), additionalArguments: [`--castlink-role=${role}`, `--castlink-locale=${settings.locale}`], nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false, autoplayPolicy:'no-user-gesture-required' };
}
function isLocal(event, window, name) {
  return !!window && !window.isDestroyed() && event.sender === window.webContents && event.senderFrame === window.webContents.mainFrame && event.senderFrame.url === pathToFileURL(ui(name)).href;
}
function dismissPicker() { pickerGeneration++; finishPicker?.(null); }
function windowMenu(window) {
  window.setMenu(null);
  window.webContents.on('before-input-event',(event,input)=>{if(input.type==='keyDown'&&input.key==='F10'){event.preventDefault();applicationMenu?.popup({window});}});
}
function protectLocal(window) {
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
}
function showLauncher() {
  if (launcher && !launcher.isDestroyed()) { launcher.show(); launcher.focus(); return; }
  launcher = new BrowserWindow({ width:1000, height:780, minWidth:360, minHeight:540, backgroundColor:'#111315', title:'CastLink', autoHideMenuBar:true, webPreferences:preferences('launcher') });
  windowMenu(launcher); protectLocal(launcher); launcher.loadFile(ui('start.html')); launcher.on('closed', () => launcher = undefined);
}
async function confirmExit() {
  if (!client || client.isDestroyed()) return true;
  const t=labels();
  return (await dialog.showMessageBox(client, {type:'question',message:t.close,detail:t.warning,buttons:[t.cancel,t.exit],cancelId:0,defaultId:0,noLink:true})).response===1;
}
function configureMenu() {
  const t=labels();
  Menu.setApplicationMenu(null);
  const updateItems=pptxTestBuild?[]:[{label:require('./updates.cjs').TEXT[settings.locale].check,click:()=>updateController?.check({manual:true}).finally(configureMenu)},{label:require('./updates.cjs').TEXT[settings.locale].automatic,type:'checkbox',checked:updateController?.automatic()!==false,click:item=>updateController?.setAutomatic(item.checked)},{type:'separator'}];
  applicationMenu=Menu.buildFromTemplate([...updateItems,{label:t.change,click:async()=>{if(await confirmExit()){showLauncher();captureDispose?.();stopController?.dispose();slideController?.dispose();client?.destroy();client=undefined;permissionPolicy?.reset();trustedOrigins.clear();}}},{type:'separator'},{label:t.exit,click:()=>app.quit()}]);
}
function createUpdates() {
  const updates=require('./updates.cjs');
  let current={track:'client',version:app.isPackaged?app.getVersion():require('../../../package.json').version};
  try{const info=JSON.parse(fs.readFileSync(path.join(__dirname,'../build-info.json'),'utf8'));if(info.track==='client')current=info;}catch{}
  const roots=['D:\\CastLink',path.join(require('node:os').homedir(),'CastLink')];
  const downloads=path.join(app.getPath('userData'),'update-downloads');updates.cleanupDownloads(downloads);
  return updates.createUpdateController({userData:app.getPath('userData'),current,getLocale:()=>settings.locale,
    getServers:()=>updates.discoverServerBuilds({roots,indexPath:path.join(process.env.LOCALAPPDATA||path.join(require('node:os').homedir(),'AppData','Local'),'CastLink','managed-servers.json')}),
    showMessage:options=>{const owner=client||launcher;return owner&&!owner.isDestroyed()?dialog.showMessageBox(owner,options):dialog.showMessageBox(options);},
    updateServer:build=>setupController.launch('update',settings.locale,build.folder),
    download:info=>updates.downloadInstaller(info,{directory:downloads}),
    install:file=>updates.launchInstaller(file,{onStarted:()=>{quitting=true;app.quit();}}),
  });
}
function stopProcessAudio(id) {
  if(!processAudio||id&&processAudio.id!==id)return;
  const owned=processAudio;processAudio=undefined;owned.capture?.stop();
}
async function prepareProcessAudio(choice) {
  stopProcessAudio();
  if(choice.audio!==true)return;
  const requestId=pendingDisplay;if(!requestId)throw Error('Display request cancelled');
  const own=client,id=randomUUID(),state={id,requestId,closed:false,capture:undefined};processAudio=state;
  const ended=()=>{if(state.closed)return;state.closed=true;if(processAudio===state&&!own.isDestroyed())own.webContents.send('castlink:audio-ended',{id});};
  try{
    state.capture=require('./process-audio.cjs').createProcessAudioAdapter({resourcesPath:resourcesRoot()}).start({sourceId:choice.source.id,enabled:true,onFrame:value=>{if(processAudio===state&&!state.closed&&!own.isDestroyed())own.webContents.send('castlink:audio-data',{id,frames:value.frames,pcm:new Uint8Array(value.pcm)});},onError:ended,onEnded:ended});
    await state.capture.ready;
    if(processAudio!==state||pendingDisplay!==requestId||state.closed||own.isDestroyed())throw Error('Audio cancelled');
  }catch{if(processAudio===state)stopProcessAudio(id);else state.capture?.stop();if(client===own&&!own.isDestroyed()&&pendingDisplay===requestId)void dialog.showMessageBox(own,{type:'warning',title:'PowerPoint',message:settings.locale==='ru'?'Не удалось передать звук. Выберите окно показа PowerPoint и повторите попытку.':settings.locale==='en'?'Could not share audio. Select the PowerPoint slideshow window and retry.':'无法共享音频。请选择 PowerPoint 幻灯片窗口并重试。'});throw Error('PowerPoint audio unavailable');}
}
function createPowerPointController() {
  powerPointController?.dispose();
  powerPointController=require('./native-presentation-desktop.cjs').createDesktopPresentationController({resourcesPath:resourcesRoot(),BrowserWindow,ipcMain,dialog,getWindow:()=>client,locale:()=>settings.locale,getSharedSource:()=>sharedDisplay});
}
async function chooseSource(options={}) {
  const owner=client;
  audioRequested=options.audioRequested===true;
  dismissPicker();
  const ticket=pickerGeneration;
  const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:400,height:225},fetchWindowIcons:false});
  if (!owner || owner.isDestroyed() || client!==owner || ticket!==pickerGeneration) return null;
  pendingSources=sources.filter(s=>!['CastLink · STOP','CastLink · Slides'].includes(s.name));
  return new Promise(resolve=>{
    const owned=new BrowserWindow({width:820,height:620,minWidth:360,minHeight:400,parent:owner,modal:true,backgroundColor:'#111315',title:'CastLink · Screen',autoHideMenuBar:true,webPreferences:preferences('picker')});
    picker=owned;owned.setMenu(null);protectLocal(owned);
    let settled=false;
    finishPicker=choice=>{if(settled)return;settled=true;finishPicker=undefined;picker=undefined;pendingSources=[];if(!owned.isDestroyed())owned.destroy();resolve(choice);};
    owned.on('closed',()=>finishPicker?.(null));
    owned.loadFile(ui('capture-picker.html')).catch(()=>finishPicker?.(null));
  });
}
function setupPermissions(ses) {
  permissionPolicy=createPermissionPolicy({trustedOrigins,ask:async request=>{
    if (!client || client.isDestroyed()) return false;
    const t=labels(), origin=new URL(request.frameUrl).origin;
    const requested=request.permission==='media'&&request.mediaTypes?.length ? request.mediaTypes.map(type=>type==='audio'?t.microphone:t.camera).join(', ') : request.permission==='speaker-selection'?t.output:request.permission==='fullscreen'?t.fullscreen:t.display;
    return (await dialog.showMessageBox(client,{type:'question',title:t.permission,message:origin,detail:requested,buttons:[t.deny,t.allow],defaultId:0,cancelId:0,noLink:true})).response===1;
  }});
  ses.setPermissionCheckHandler((contents,permission,origin,details)=>{
    if(contents!==client?.webContents || !details.isMainFrame || !canNavigate(origin,trustedOrigins))return false;
    return permissionPolicy.check({permission,frameUrl:details.requestingUrl||origin,isMainFrame:details.isMainFrame,mediaTypes:details.mediaType?[details.mediaType]:undefined});
  });
  ses.setPermissionRequestHandler((contents,permission,callback,details)=>{
    if(contents!==client?.webContents){callback(false);return;}
    if(permission==='openExternal'){callback(isRemoteLaunchPermission({contents,client,details,trustedOrigins}));return;}
    permissionPolicy.request({permission,frameUrl:details.requestingUrl,isMainFrame:details.isMainFrame,mediaTypes:details.mediaTypes}).then(callback,()=>callback(false));
  });
  // Downloads use Electron's normal save dialog (chat/statistics TXT remains available).
}
async function connect(value) {
  if(client&&!client.isDestroyed())throw Error('Already connected');
  if (!value || !Array.isArray(value.reserves) || value.reserves.length>16) throw Error('Invalid settings');
  const server=parseLaunchInput(value.input,value.role || 'studio',allowLoopback);
  const reserves=value.reserves.map(input=>{const parsed=parseServerInput(input,allowLoopback);if(parsed.launchUrl!==parsed.origin+'/')throw Error('Origin only');return parsed.origin;});
  settings=settingsForDisk(server,reserves,value.locale);
  fs.writeFileSync(path.join(app.getPath('userData'),'servers.json'),JSON.stringify(settings),{mode:0o600});
  trustedOrigins.clear();[server.origin,...reserves].forEach(origin=>trustedOrigins.add(origin));
  const ses=session.fromPartition('persist:castlink-client');setupPermissions(ses);
  client=new BrowserWindow({width:1440,height:960,minWidth:360,minHeight:540,title:'CastLink',backgroundColor:'#111315',webPreferences:{...preferences('client'),session:ses}});
  const own=client;
  own.webContents.setUserAgent(own.webContents.getUserAgent()+' CastLinkDesktop/1');
  windowMenu(own);
  createPowerPointController();
  let navigationOrigin=server.origin;
  captureDispose=installDisplayCapture({session:ses,mainWindow:own,trustedOrigins,chooseSource,prepareAudio:prepareProcessAudio,selectedSource:async source=>{if(!pendingDisplay)throw Error('Display request cancelled');let target;try{target=require('./remote-pc-capture.cjs').bindSelectedSource(source,screen);}catch{const kind=source.id.startsWith('window:')?'window':source.id.startsWith('screen:')?'screen':null;if(kind)target={kind,unavailable:true};}const selected={id:pendingDisplay,sourceId:source.id,name:source.name,target};selectedDisplay=selected;await remoteControlController?.selectCapture(selected);}});
  stopController=require('./stop-panel.cjs').createStopController({client:own,ipcMain,BrowserWindow,globalShortcut,preferences,isLocal,ui,trustedOrigins,getSharedSource:()=>sharedDisplay});
  remoteControlController=require('./remote-pc-desktop.cjs').createRemotePcDesktop({client:own,ipcMain,trustedOrigins,resourcesPath:resourcesRoot(),getSharedSource:()=>sharedDisplay,toolbar:stopController});
  slideController=require('./slide-panel.cjs').createSlideController({client:own,ipcMain,BrowserWindow,preferences,isLocal,ui,trustedOrigins,getWorkArea:bounds=>screen.getDisplayMatching(bounds).workArea});
  own.webContents.setWindowOpenHandler(({url})=>{try{const parsed=new URL(url);if(['https:','http:','mailto:'].includes(parsed.protocol))shell.openExternal(url).catch(()=>{});else if(isRemoteLaunch(url)){require('./remote-pc-protocol.cjs').parseRemoteLaunch(url);shell.openExternal(url).catch(()=>{});}else if(presenterBuild&&isPresenterLaunch(url)){require('./presenter-protocol.cjs').parsePresenterLaunch(url);shell.openExternal(url).catch(()=>{});}}catch{}return {action:'deny'};});
  own.webContents.on('will-navigate',(event,url)=>{if(!canNavigate(url,trustedOrigins)){event.preventDefault();dialog.showMessageBox(own,{type:'warning',message:labels().error,detail:'Untrusted server origin'});}});
  own.webContents.on('will-redirect',(event,url)=>{if(!canNavigate(url,trustedOrigins))event.preventDefault();});
  own.webContents.on('will-attach-webview',event=>event.preventDefault());
  own.webContents.on('did-start-navigation',(_event,url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace){dismissPicker();void remoteControlController?.releaseCapture();pendingDisplay=selectedDisplay=sharedDisplay=undefined;captureDispose?.reset();stopProcessAudio();createPowerPointController();const origin=new URL(url).origin;permissionPolicy.reset({keepGrants:origin===navigationOrigin});navigationOrigin=origin;stopController?.reset();slideController?.reset();}});
  own.webContents.on('render-process-gone',()=>{dismissPicker();void remoteControlController?.releaseCapture();pendingDisplay=selectedDisplay=sharedDisplay=undefined;stopProcessAudio();powerPointController?.dispose();stopController?.reset();slideController?.reset();});
  let confirming=false;
  own.on('close',event=>{if(quitting)return;event.preventDefault();if(confirming)return;confirming=true;confirmExit().then(allowed=>{if(allowed){quitting=true;own.destroy();app.quit();}}).finally(()=>confirming=false);});
  own.on('closed',()=>{dismissPicker();void remoteControlController?.releaseCapture();pendingDisplay=selectedDisplay=sharedDisplay=undefined;stopProcessAudio();powerPointController?.dispose();remoteControlController?.dispose();remoteControlController=undefined;captureDispose?.();stopController?.dispose();slideController?.dispose();permissionPolicy?.reset();if(client===own)client=undefined;});
  configureMenu();
  try {
    // The studio inventory does not start capture by itself. Ask once before its
    // first render so named inputs/outputs are available without Refresh devices.
    await permissionPolicy.request({permission:'media',frameUrl:server.launchUrl,isMainFrame:true,mediaTypes:['audio','video']});
    if (own.isDestroyed()) throw Error('Connection closed');
    await own.loadURL(server.launchUrl); launcher?.close();
  }
  catch { if(!own.isDestroyed())own.destroy();showLauncher();throw Error('Connection failed'); }
}

// Keep invitations in memory only; never put argv, URLs or parse errors into logs.
let readyForInvitations=false, pendingInvitation=process.argv.find(arg=>/^castlink:/i.test(arg)), invitationQueue=Promise.resolve();
function focusApplication() {
  const window=client||launcher;
  if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}
}
function receiveInvitation(input) {
  if(!readyForInvitations){pendingInvitation=input;return;}
  invitationQueue=invitationQueue.then(async()=>{
    // Validate before touching the current session or its trusted origins.
    const target=parseDeepLink(input,allowLoopback);
    if(client&&!client.isDestroyed()){
      focusApplication();
      if(!await confirmExit())return;
      showLauncher();
      client.destroy();
    }
    await connect({input:target.launchUrl,role:'caster',reserves:settings.reserveOrigins,locale:settings.locale});
  }).catch(()=>{
    if(!client||client.isDestroyed())showLauncher();
    const owner=client||launcher;
    void dialog.showMessageBox(owner,{type:'warning',message:labels().error});
  });
}
if(remoteHelperMode){
  if(!app.requestSingleInstanceLock())app.quit();
  else void Promise.resolve(require('./remote-pc-helper.cjs').runRemotePcHelper({app,BrowserWindow,ipcMain,session,desktopCapturer,screen,globalShortcut,dialog,allowLoopback:remotePcQaMode})).catch(()=>app.quit());
} else if(presentationHelperMode){
  if(!app.requestSingleInstanceLock())app.quit();
  else void Promise.resolve(require('./presentation-helper.cjs').runPresentationHelper({app,BrowserWindow,dialog})).catch(()=>app.quit());
} else if (!app.requestSingleInstanceLock()) app.quit();
else {
  require('./private-test-basic-auth.cjs').installPrivateTestAuth({app,enabled:pptxTestBuild&&!presenterBuild,file:process.env.CASTLINK_PRIVATE_TEST_AUTH_FILE,getClient:()=>client,getOrigin:()=>settings.serverOrigin});
  if(app.isPackaged&&!pptxTestBuild){
    // electron-builder removes the portable's extracted process.execPath on exit.
    const portable=process.platform==='win32'&&process.env.PORTABLE_EXECUTABLE_FILE;
    for(const scheme of ['castlink-remote','castlink-presenter','castlink']){
      if(portable)app.setAsDefaultProtocolClient(scheme,portable,[]);
      else app.setAsDefaultProtocolClient(scheme);
    }
  }
  app.on('second-instance',(_event,argv)=>{
    focusApplication();
    const invitation=argv.find(arg=>/^castlink:/i.test(arg));
    if(invitation)receiveInvitation(invitation);
  });
  app.on('open-url',(event,url)=>{event.preventDefault();receiveInvitation(url);});
  app.whenReady().then(()=>{
    setupController=require('./setup.cjs').createSetupAdapter({resourcesPath:resourcesRoot()});
    try {const stored=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'servers.json'),'utf8'));settings=settingsForDisk(parseServerInput(stored.serverOrigin,allowLoopback),stored.reserveOrigins,stored.locale);}catch{}
    if(!pptxTestBuild)updateController=createUpdates();
    ipcMain.handle('castlink:updates',(event,locale)=>{if(pptxTestBuild)throw Error('Updates disabled in the private PPTX test build');if(!isLocal(event,launcher,'start.html')||locale!==undefined&&!['ru','en','zh-CN'].includes(locale))throw Error('Denied');return updateController.check({manual:true,locale}).finally(configureMenu);});
    ipcMain.handle('castlink:settings',event=>{if(!isLocal(event,launcher,'start.html'))throw Error('Denied');return {...settings,version:app.isPackaged?app.getVersion():require('../../../package.json').version};});
    ipcMain.handle('castlink:setup',(event,value)=>{if(pptxTestBuild)throw Error('Server setup disabled in the private PPTX test build');if(!isLocal(event,launcher,'start.html')||!value||Object.keys(value).some(key=>!['action','locale'].includes(key)))throw Error('Denied');return setupController.launch(value.action,value.locale);});
    ipcMain.handle('castlink:connect',(event,value)=>{if(!isLocal(event,launcher,'start.html'))throw Error('Denied');return connect(value);});
    const clientEvent=event=>require('./ipc-policy.cjs').isClientEvent(event,client,trustedOrigins);
    ipcMain.on('castlink:theme',(event,value)=>{if(clientEvent(event)&&['dark','light'].includes(value)&&nativeTheme)nativeTheme.themeSource=value;});
    ipcMain.handle('castlink:audio-begin',event=>{if(!clientEvent(event)||pendingDisplay)throw Error('Display request busy');pendingDisplay=randomUUID();selectedDisplay=undefined;return pendingDisplay;});
    ipcMain.handle('castlink:audio-cancel',(event,id)=>{if(!clientEvent(event)||typeof id!=='string')throw Error('Denied');if(pendingDisplay===id)pendingDisplay=undefined;if(selectedDisplay?.id===id)selectedDisplay=undefined;void remoteControlController?.releaseCapture(id);if(sharedDisplay?.id===id){sharedDisplay=undefined;powerPointController?.cancelSharedCapture(id);}if(processAudio?.requestId===id)stopProcessAudio(processAudio.id);});
    ipcMain.handle('castlink:audio-info',(event,id)=>{if(!clientEvent(event)||typeof id!=='string'||pendingDisplay!==id||selectedDisplay?.id!==id)throw Error('Denied');pendingDisplay=undefined;const audio=processAudio?.requestId===id?processAudio:null;if(audio?.closed)throw Error('Source audio ended');if(sharedDisplay){powerPointController?.cancelSharedCapture(sharedDisplay.id);}sharedDisplay={...selectedDisplay,ready:true};selectedDisplay=undefined;return audio?{id:audio.id,sampleRate:48000,channels:2}:null;});
    ipcMain.handle('castlink:audio-stop',(event,id)=>{if(!clientEvent(event)||typeof id!=='string')throw Error('Denied');stopProcessAudio(id);});
    for(const method of ['connect','connectShared','status','goTo','disconnect','prepare','start','step'])ipcMain.handle('castlink:powerpoint-'+method,(event,value)=>{if(!clientEvent(event))throw Error('Denied');return Promise.resolve().then(()=>powerPointController[method](value)).catch(error=>({error:method==='step'&&error.code==='WINDOW_SLIDES_FOREGROUND'?'WINDOW_SLIDES_FOREGROUND':require('./powerpoint.cjs').powerPointErrorCode(error)}));});
    ipcMain.handle('castlink:capture-sources',event=>{if(!isLocal(event,picker,'capture-picker.html'))throw Error('Denied');return {locale:settings.locale,audioAvailable:audioRequested&&process.platform==='win32'&&Number(require('node:os').release().split('.')[2])>=20348&&fs.existsSync(path.join(resourcesRoot(),'process-audio/CastLink.ProcessAudio.exe')),sources:pendingSources.map(s=>({id:s.id,name:s.name,thumbnail:s.thumbnail.toDataURL()}))};});
    ipcMain.handle('castlink:capture-choose',(event,value)=>{if(!isLocal(event,picker,'capture-picker.html'))throw Error('Denied');const id=typeof value==='string'?value:value?.id;const source=pendingSources.find(s=>s.id===id);const audio=!!source&&typeof value==='object'&&value?.audio===true;if(audio&&(!audioRequested||!/^window:[1-9][0-9]*:0$/.test(id)))throw Error('Choose PowerPoint window for audio');finishPicker?.(source?{source,audio}:null);});
    configureMenu();showLauncher();readyForInvitations=true;
    if(pendingInvitation){const invitation=pendingInvitation;pendingInvitation=undefined;receiveInvitation(invitation);}
    if(app.isPackaged&&!pptxTestBuild)void updateController.check().finally(configureMenu);
  });
  app.on('before-quit',event=>{if(client&&!client.isDestroyed()&&!quitting){event.preventDefault();client.close();}});
  app.on('window-all-closed',()=>app.quit());
}
