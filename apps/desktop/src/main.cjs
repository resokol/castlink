'use strict';
const { app, BrowserWindow, Menu, dialog, ipcMain, session, desktopCapturer, shell, globalShortcut, nativeTheme } = require('electron');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { parseServerInput, parseLaunchInput, isTrustedFrame, canNavigate, settingsForDisk } = require('./server-policy.cjs');
const { createPermissionPolicy } = require('./permissions.cjs');
const { installDisplayCapture } = require('./capture.cjs');

app.setName('CastLink Client');
let launcher, client, picker, finishPicker, pendingSources = [], permissionPolicy, captureDispose, stopController;
let settings = { serverOrigin: '', reserveOrigins: [], locale: 'ru' }, quitting = false;
let pickerGeneration = 0, applicationMenu;
if(nativeTheme)nativeTheme.themeSource='dark';
const trustedOrigins = new Set();
const ui = name => path.join(__dirname, '../ui', name);
const labels = () => ({
  ru: { connect:'Подключение…', server:'Сервер', change:'Сменить сервер…', exit:'Выйти', close:'Выйти из CastLink?', warning:'Соединение будет закрыто. Камера, микрофон и демонстрация этого приложения остановятся.', cancel:'Отмена', allow:'Разрешить', deny:'Не разрешать', permission:'Разрешение устройств', microphone:'Микрофон', camera:'Камера', display:'Выбор экрана или окна', output:'Выбор устройства вывода звука', fullscreen:'Полноэкранный режим', error:'Не удалось открыть сервер. Проверьте сеть и доверие HTTPS-сертификату.' },
  en: { connect:'Connecting…', server:'Server', change:'Change server…', exit:'Exit', close:'Exit CastLink?', warning:'This connection will close. This application’s camera, microphone and screen share will stop.', cancel:'Cancel', allow:'Allow', deny:'Deny', permission:'Device permission', microphone:'Microphone', camera:'Camera', display:'Screen or window selection', output:'Audio output selection', fullscreen:'Fullscreen', error:'Could not open the server. Check your connection and HTTPS certificate trust.' },
  'zh-CN': { connect:'正在连接…', server:'服务器', change:'更换服务器…', exit:'退出', close:'退出 CastLink？', warning:'连接将关闭。此应用的摄像头、麦克风和屏幕共享将停止。', cancel:'取消', allow:'允许', deny:'拒绝', permission:'设备权限', microphone:'麦克风', camera:'摄像头', display:'选择屏幕或窗口', output:'选择音频输出设备', fullscreen:'全屏', error:'无法打开服务器。请检查网络连接及 HTTPS 证书信任。' },
}[settings.locale]);

function preferences(role) {
  return { preload: path.join(__dirname, 'preload.cjs'), additionalArguments: [`--castlink-role=${role}`, `--castlink-locale=${settings.locale}`], nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true, backgroundThrottling: false };
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
  launcher = new BrowserWindow({ width:760, height:720, minWidth:360, minHeight:540, backgroundColor:'#111315', title:'CastLink', autoHideMenuBar:true, webPreferences:preferences('launcher') });
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
  applicationMenu=Menu.buildFromTemplate([{label:t.change,click:async()=>{if(await confirmExit()){showLauncher();captureDispose?.();stopController?.dispose();client?.destroy();client=undefined;permissionPolicy?.reset();trustedOrigins.clear();}}},{type:'separator'},{label:t.exit,click:()=>app.quit()}]);
}
async function chooseSource() {
  const owner=client;
  dismissPicker();
  const ticket=pickerGeneration;
  const sources=await desktopCapturer.getSources({types:['screen','window'],thumbnailSize:{width:400,height:225},fetchWindowIcons:false});
  if (!owner || owner.isDestroyed() || client!==owner || ticket!==pickerGeneration) return null;
  pendingSources=sources.filter(s=>s.name!=='CastLink · STOP');
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
    permissionPolicy.request({permission,frameUrl:details.requestingUrl,isMainFrame:details.isMainFrame,mediaTypes:details.mediaTypes}).then(callback,()=>callback(false));
  });
  // Downloads use Electron's normal save dialog (chat/statistics TXT remains available).
}
async function connect(value) {
  if(client&&!client.isDestroyed())throw Error('Already connected');
  if (!value || !Array.isArray(value.reserves) || value.reserves.length>16) throw Error('Invalid settings');
  const allowLoopback=!app.isPackaged;
  const server=parseLaunchInput(value.input,value.role || 'studio',allowLoopback);
  const reserves=value.reserves.map(input=>{const parsed=parseServerInput(input,allowLoopback);if(parsed.launchUrl!==parsed.origin+'/')throw Error('Origin only');return parsed.origin;});
  settings=settingsForDisk(server,reserves,value.locale);
  fs.writeFileSync(path.join(app.getPath('userData'),'servers.json'),JSON.stringify(settings),{mode:0o600});
  trustedOrigins.clear();[server.origin,...reserves].forEach(origin=>trustedOrigins.add(origin));
  const ses=session.fromPartition('persist:castlink-client');setupPermissions(ses);
  client=new BrowserWindow({width:1440,height:960,minWidth:360,minHeight:540,title:'CastLink',backgroundColor:'#111315',webPreferences:{...preferences('client'),session:ses}});
  const own=client;
  windowMenu(own);
  let navigationOrigin=server.origin;
  captureDispose=installDisplayCapture({session:ses,mainWindow:own,trustedOrigins,chooseSource});
  stopController=require('./stop-panel.cjs').createStopController({client:own,ipcMain,BrowserWindow,globalShortcut,preferences,isLocal,ui,trustedOrigins});
  own.webContents.setWindowOpenHandler(({url})=>{try{const parsed=new URL(url);if(['https:','http:','mailto:'].includes(parsed.protocol))shell.openExternal(url).catch(()=>{});}catch{}return {action:'deny'};});
  own.webContents.on('will-navigate',(event,url)=>{if(!canNavigate(url,trustedOrigins)){event.preventDefault();dialog.showMessageBox(own,{type:'warning',message:labels().error,detail:'Untrusted server origin'});}});
  own.webContents.on('will-redirect',(event,url)=>{if(!canNavigate(url,trustedOrigins))event.preventDefault();});
  own.webContents.on('will-attach-webview',event=>event.preventDefault());
  own.webContents.on('did-start-navigation',(_event,url,inPlace,isMainFrame)=>{if(isMainFrame&&!inPlace){dismissPicker();const origin=new URL(url).origin;permissionPolicy.reset({keepGrants:origin===navigationOrigin});navigationOrigin=origin;stopController?.reset();}});
  own.webContents.on('render-process-gone',()=>{dismissPicker();stopController?.reset();});
  let confirming=false;
  own.on('close',event=>{if(quitting)return;event.preventDefault();if(confirming)return;confirming=true;confirmExit().then(allowed=>{if(allowed){quitting=true;own.destroy();app.quit();}}).finally(()=>confirming=false);});
  own.on('closed',()=>{dismissPicker();captureDispose?.();stopController?.dispose();permissionPolicy?.reset();if(client===own)client=undefined;});
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

if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance',()=>{const window=client||launcher;if(window&&!window.isDestroyed()){if(window.isMinimized())window.restore();window.show();window.focus();}});
  app.whenReady().then(()=>{
    try {const stored=JSON.parse(fs.readFileSync(path.join(app.getPath('userData'),'servers.json'),'utf8'));settings=settingsForDisk(parseServerInput(stored.serverOrigin,!app.isPackaged),stored.reserveOrigins,stored.locale);}catch{}
    ipcMain.handle('castlink:settings',event=>{if(!isLocal(event,launcher,'start.html'))throw Error('Denied');return {...settings,version:app.isPackaged?app.getVersion():require('../../../package.json').version};});
    ipcMain.handle('castlink:connect',(event,value)=>{if(!isLocal(event,launcher,'start.html'))throw Error('Denied');return connect(value);});
    ipcMain.handle('castlink:capture-sources',event=>{if(!isLocal(event,picker,'capture-picker.html'))throw Error('Denied');return {locale:settings.locale,sources:pendingSources.map(s=>({id:s.id,name:s.name,thumbnail:s.thumbnail.toDataURL()}))};});
    ipcMain.handle('castlink:capture-choose',(event,id)=>{if(!isLocal(event,picker,'capture-picker.html'))throw Error('Denied');const source=pendingSources.find(s=>s.id===id);finishPicker?.(source?{source}:null);});
    configureMenu();showLauncher();
  });
  app.on('before-quit',event=>{if(client&&!client.isDestroyed()&&!quitting){event.preventDefault();client.close();}});
  app.on('window-all-closed',()=>app.quit());
}
