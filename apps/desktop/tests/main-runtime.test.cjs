const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module');
function runtime(options={}){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-main-test-')),windows=[],opened=[];
  const app=new EventEmitter();Object.assign(app,{setName(){},isPackaged:options.packaged||false,getVersion:()=>'1.0.0',requestSingleInstanceLock:()=>true,whenReady:()=>options.ready?Promise.resolve():new Promise(()=>{}),setAsDefaultProtocolClient:(...args)=>{app.protocol=args;return true;},getPath:()=>temporary,quit(){}});
  const ses=new EventEmitter();ses.setPermissionCheckHandler=h=>ses.check=h;ses.setPermissionRequestHandler=h=>ses.request=h;ses.setDisplayMediaRequestHandler=()=>{};
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},setWindowOpenHandler:handler=>this.popup=handler,send(){},getUserAgent:()=> 'Electron/44',setUserAgent:value=>this.userAgent=value});windows.push(this);}
    setMenu(menu){this.menu=menu;}isDestroyed(){return this.dead;}loadURL(url){this.webContents.mainFrame.url=url;return Promise.resolve();}loadFile(){return Promise.resolve();}destroy(){this.dead=true;this.emit('closed');}close(){this.destroy();}show(){}focus(){}isMinimized(){return false;}
  }
  const ipcMain=new EventEmitter();ipcMain.handlers={};ipcMain.handle=(name,handler)=>ipcMain.handlers[name]=handler;ipcMain.removeHandler=()=>{};
  const prompts=[];let resolveSources;const electron={app,BrowserWindow:Window,Menu:{setApplicationMenu(){},buildFromTemplate:items=>items},dialog:{showMessageBox:async(...args)=>{prompts.push(args);return {response:options.response||0};}},ipcMain,session:{fromPartition:()=>ses},desktopCapturer:{getSources:()=>new Promise(r=>resolveSources=r)},shell:{openExternal:url=>{opened.push(url);return Promise.resolve();}},globalShortcut:{register:()=>true,unregister(){}}};
  const filename=path.resolve(__dirname,'../src/main.cjs'),localRequire=createRequire(filename),module={exports:{}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports={connect,chooseSource,dismissPicker};',{require:name=>name==='electron'?electron:localRequire(name),module,__dirname:path.dirname(filename),process:options.argv?{...process,resourcesPath:temporary,argv:options.argv}:process,console,URL},{filename});
  return {api:module.exports,windows,opened,ses,app,prompts,ipcMain,resolveSources:value=>resolveSources(value),cleanup:()=>fs.rmSync(temporary,{recursive:true,force:true})};
}
test('actual popup handler opens trusted output links externally without native privileges',async()=>{
  const state=runtime();try{
    await state.api.connect({input:'https://studio.example',reserves:[],locale:'ru'});
    const client=state.windows[0],url='https://studio.example/output/caster?studioId=room';
    assert.equal(client.popup({url}).action,'deny');assert.deepEqual(state.opened,[url]);
    for(const url of ['file:///tmp/a','javascript:alert(1)','powershell:bad'])client.popup({url});
    assert.equal(state.opened.length,1);assert.equal(state.windows.length,1);
  }finally{state.cleanup();}
});
test('actual source enumeration cannot resurrect a picker after navigation',async()=>{
  const state=runtime();try{
    await state.api.connect({input:'https://studio.example',reserves:[],locale:'ru'});
    const pending=state.api.chooseSource();
    state.windows[0].webContents.emit('did-start-navigation',{},'https://studio.example/room',false,true);
    state.resolveSources([{id:'window:1:0',name:'Test window',thumbnail:{toDataURL:()=>''}}]);
    await new Promise(resolve=>setImmediate(resolve));
    const created=state.windows.length;
    state.api.dismissPicker();
    assert.equal(created,1,'only client exists; no stale modal picker');
    assert.equal(await pending,null);
  }finally{state.cleanup();}
});

test('actual Electron check binding keeps inventory distinct from display capture',async()=>{
  const state=runtime();try{
    await state.api.connect({input:'https://studio.example',role:'caster',reserves:[],locale:'ru'});
    const client=state.windows[0],details={isMainFrame:true,requestingUrl:'https://studio.example/room'};
    assert.equal(client.webContents.mainFrame.url,'https://studio.example/room');
    assert.equal(state.ses.check(client.webContents,'clipboard-sanitized-write','https://studio.example',details),true);
    assert.equal(state.ses.check(client.webContents,'clipboard-read','https://studio.example',details),false);
    assert.equal(state.ses.check(client.webContents,'media','https://studio.example',details),false);
    assert.equal(state.ses.check(client.webContents,'clipboard-sanitized-write','https://studio.example',{...details,isMainFrame:false}),false);
  }finally{state.cleanup();}
});

const invite=target=>'castlink://join?url='+encodeURIComponent(target);
const tick=()=>new Promise(resolve=>setImmediate(resolve));
test('initial argv invite registers protocol and loads full invitation in native client',async()=>{
  const target='https://studio.example/?name=Show&mode=guest#invite=private';
  const state=runtime({ready:true,packaged:true,argv:['CastLink.exe',invite(target)]});try{
    await tick();await tick();
    assert.deepEqual(Array.from(state.app.protocol),['castlink']);
    const client=state.windows.find(window=>window.webContents.mainFrame.url===target);
    assert.ok(client,'startup invitation reaches existing connect policy');
    assert.match(client.userAgent,/CastLinkDesktop\/1/);
    const saved=fs.readFileSync(path.join(state.app.getPath(),'servers.json'),'utf8');
    assert.ok(!saved.includes('private'));assert.ok(!saved.includes('name='));
  }finally{state.cleanup();}
});
test('second-instance invitation preserves an active room when replacement is declined',async()=>{
  const state=runtime({ready:true});try{
    await tick();await state.api.connect({input:'https://studio.example/room#current',reserves:[],locale:'ru'});
    const active=state.windows.find(window=>window.webContents.mainFrame.url.includes('#current'));
    state.app.emit('second-instance',{},['CastLink.exe',invite('https://other.example/room#next')]);
    await tick();await tick();
    assert.equal(active.isDestroyed(),false);assert.equal(active.webContents.mainFrame.url,'https://studio.example/room#current');
    assert.equal(state.prompts.length,2,'initial media prompt plus replacement confirmation');
    assert.equal(state.opened.length,0);
  }finally{state.cleanup();}
});
test('second-instance accepted invitation replaces only after explicit confirmation',async()=>{
  const state=runtime({ready:true,response:1});try{
    await tick();await state.api.connect({input:'https://studio.example/room#current',reserves:[],locale:'en'});
    const active=state.windows.find(window=>window.webContents.mainFrame.url.includes('#current'));
    state.app.emit('second-instance',{},['CastLink.exe',invite('https://other.example/room#next')]);
    await tick();await tick();
    assert.equal(active.isDestroyed(),true);assert.ok(state.windows.some(window=>window.webContents.mainFrame.url==='https://other.example/room#next'));
    assert.equal(state.opened.length,0);
  }finally{state.cleanup();}
});
test('invalid second-instance invitation never closes active room or opens an external handler',async()=>{
  const state=runtime({ready:true,response:1});try{
    await tick();await state.api.connect({input:'https://studio.example/room#current',reserves:[],locale:'ru'});
    const active=state.windows.find(window=>window.webContents.mainFrame.url.includes('#current'));
    state.app.emit('second-instance',{},['CastLink.exe',invite('file:///tmp/private')]);
    await tick();await tick();
    assert.equal(active.isDestroyed(),false);assert.equal(state.opened.length,0);
    const warning=state.prompts.at(-1)[1];assert.equal(warning.type,'warning');assert.ok(!JSON.stringify(warning).includes('private'));
  }finally{state.cleanup();}
});
