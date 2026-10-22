'use strict';
// Run with official Electron: verifies the real isolated-world/main-world boundary.
const {app,BrowserWindow,ipcMain}=require('electron'),path=require('node:path'),fs=require('node:fs'),os=require('node:os');
const argument=name=>process.argv.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3);
const resultPath=argument('result'),preload=argument('preload')||path.resolve(__dirname,'../src/preload.cjs');
const profile=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-bridge-smoke-'));
app.disableHardwareAcceleration();app.setPath('userData',profile);
let window,done=false;
function finish(result){if(done)return;done=true;if(resultPath)fs.writeFileSync(resultPath,JSON.stringify({...result,profile},null,2)+'\n');window?.destroy();app.exit(result.code==='WINDOW_SLIDES_FOREGROUND'?0:1);}
app.whenReady().then(async()=>{
 ipcMain.handle('castlink:powerpoint-step',()=>({error:'WINDOW_SLIDES_FOREGROUND'}));
 window=new BrowserWindow({show:false,webPreferences:{preload,additionalArguments:['--castlink-role=client'],contextIsolation:true,nodeIntegration:false,sandbox:true}});
 window.webContents.session.setPermissionCheckHandler(()=>false);window.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));
 await window.loadURL('data:text/html,<html><body>isolated bridge fixture</body></html>');
 finish(await window.webContents.executeJavaScript(`(async()=>{try{await window.castlinkDesktop.powerPoint.step({id:'fixture',commandId:'fixture',direction:'next'});return{unexpectedSuccess:true}}catch(error){return{code:error.code||null,message:error.message||null,keys:Object.keys(error)}}})()`));
}).catch(()=>finish({error:'Fixture failed'}));
setTimeout(()=>finish({error:'Fixture timed out'}),15000);
