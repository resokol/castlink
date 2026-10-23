'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module');
const main=path.resolve(__dirname,'../src/main.cjs'),localRequire=createRequire(main);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function boot({argv=[],info,packaged=true}={}){
  const directory=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-isolation-')),calls={updates:0,helper:[],paths:{},names:[],menus:[],protocol:[],locks:0},windows=[],handlers={};
  const app=new EventEmitter();Object.assign(app,{isPackaged:packaged,setName:n=>calls.names.push(n),setPath:(n,p)=>calls.paths[n]=p,getPath:n=>calls.paths[n]||directory,getVersion:()=>'1.0.0',requestSingleInstanceLock:()=>{calls.locks++;return true;},setAsDefaultProtocolClient:(...args)=>calls.protocol.push(args),whenReady:()=>Promise.resolve(),quit(){}});
  class Window extends EventEmitter{constructor(options){super();this.options=options;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},setWindowOpenHandler(){},getUserAgent:()=>'',setUserAgent(){},send(){}});windows.push(this);}setMenu(){}loadFile(){return Promise.resolve();}loadURL(url){this.webContents.mainFrame.url=url;return Promise.resolve();}isDestroyed(){return false;}show(){}focus(){}close(){}destroy(){}}
  const ses={setPermissionCheckHandler(){},setPermissionRequestHandler(){},setDisplayMediaRequestHandler(){}};
  const ipcMain=new EventEmitter();ipcMain.handle=(name,handler)=>handlers[name]=handler;
  const electron={app,BrowserWindow:Window,dialog:{showMessageBox:async()=>({response:0})},Menu:{setApplicationMenu(){},buildFromTemplate:items=>{calls.menus.push(items);return{};}},ipcMain,session:{fromPartition:()=>ses},desktopCapturer:{},shell:{},globalShortcut:{register:()=>true,unregister(){}},nativeTheme:{}};
  const runtimeProcess={...process,argv:['CastLink.exe',...argv],env:{},resourcesPath:directory};
  const wrappedFs={...fs,readFileSync:(file,...args)=>String(file)===path.resolve(path.dirname(main),'../build-info.json')&&info!==undefined?JSON.stringify(info):fs.readFileSync(file,...args)};
  const context={require:name=>name==='electron'?electron:name==='node:fs'?wrappedFs:name==='./presentation-helper.cjs'?{runPresentationHelper:args=>{calls.helper.push(args);return Promise.resolve();}}:name==='./updates.cjs'?{...localRequire(name),createUpdateController:()=>{calls.updates++;return{check:async()=>{},automatic:()=>true};}}:localRequire(name),process:runtimeProcess,console,URL,__dirname:path.dirname(main),module:{exports:{}}};
  vm.runInNewContext(fs.readFileSync(main,'utf8')+'\nmodule.exports={connect};',context,{filename:main});
  return{app,calls,windows,handlers,connect:context.module.exports.connect,cleanup:()=>fs.rmSync(directory,{recursive:true,force:true}),directory};
}
test('explicit PPTX test build isolates profile, blocks stable protocol/updater and permits only loopback HTTP',async()=>{
  const s=boot({argv:['--pptx-test-build']});try{
    await tick();await tick();
    assert.equal(s.calls.names.at(-1),'CastLink PPTX Test');assert.equal(s.calls.paths.userData,path.join(s.directory,'CastLink PPTX Test'));
    assert.equal(s.calls.protocol.length,0);assert.equal(s.calls.updates,0);
    const menu=s.calls.menus.at(-1);assert.equal(menu.filter(item=>item.type==='checkbox').length,0,'stable automatic update menu absent');
    const launcher=s.windows[0];launcher.webContents.mainFrame.url=require('node:url').pathToFileURL(path.resolve(__dirname,'../ui/start.html')).href;
    assert.throws(()=>s.handlers['castlink:updates']({sender:launcher.webContents,senderFrame:launcher.webContents.mainFrame}),/disabled|Denied/i);
    assert.throws(()=>s.handlers['castlink:setup']({sender:launcher.webContents,senderFrame:launcher.webContents.mainFrame},{action:'install',locale:'ru'}),/disabled/i);
    await assert.rejects(s.connect({input:'http://remote.example',reserves:[],locale:'ru'}),/HTTPS/);
    await s.connect({input:'http://127.0.0.1:31999',reserves:[],locale:'ru'});
    assert.ok(s.windows.some(w=>w.webContents.mainFrame.url.startsWith('http://127.0.0.1:31999')));
  }finally{s.cleanup();}
});
test('testBuild build-info isolates packaged launch without command-line flags',async()=>{
  const s=boot({info:{track:'client',testBuild:true}});try{await tick();assert.equal(s.calls.names.at(-1),'CastLink PPTX Test');assert.equal(s.calls.protocol.length,0);assert.equal(s.calls.updates,0);}finally{s.cleanup();}
});
test('helper dispatch happens before normal bootstrap and gets its own profile without protocol or updater',async()=>{
  const s=boot({argv:['--presentation-helper']});try{
    await tick();assert.equal(s.calls.helper.length,1);assert.equal(s.calls.helper[0].app,s.app);
    assert.equal(s.calls.names.at(-1),'CastLink Presentation Helper');assert.equal(s.calls.paths.userData,path.join(s.directory,'CastLink Presentation Helper'));
    assert.equal(s.calls.protocol.length,0);assert.equal(s.calls.updates,0);assert.equal(s.windows.length,0);assert.deepEqual(Object.keys(s.handlers),[]);
  }finally{s.cleanup();}
});
test('default packaged launch retains normal name, protocol, updater and HTTPS-only policy',async()=>{
  const s=boot();try{
    await tick();await tick();assert.equal(s.calls.names.at(-1),'CastLink Client');assert.equal(s.calls.paths.userData,undefined);
    assert.deepEqual(s.calls.protocol.map(call=>call[0]),['castlink-presenter','castlink']);assert.equal(s.calls.updates,1);
    await assert.rejects(s.connect({input:'http://127.0.0.1:31999',reserves:[],locale:'ru'}),/HTTPS/);
  }finally{s.cleanup();}
});

test('combined client preview isolates both normal and URI component profiles, disables stable features and requires HTTPS',async()=>{
 const s=boot({info:{presenterBuild:true}});try{await tick();assert.equal(s.calls.names.at(-1),'CastLink Client Preview');assert.equal(s.calls.protocol.length,0);assert.equal(s.calls.updates,0);await assert.rejects(s.connect({input:'http://127.0.0.1:31999',reserves:[],locale:'ru'}),/HTTPS/);}finally{s.cleanup();}
 const h=boot({argv:['castlink-presenter://connect?server=https%3A%2F%2Fcastlink.ru#cp2_'+'a'.repeat(43)],info:{presenterBuild:true}});try{await tick();assert.equal(h.calls.names.at(-1),'CastLink Client Preview Presenter');assert.equal(h.calls.helper.length,1);assert.equal(h.windows.length,0);assert.equal(h.calls.protocol.length,0);assert.equal(h.calls.updates,0);}finally{h.cleanup();}
});
