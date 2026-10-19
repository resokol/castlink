const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module');
function runtime(){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-main-test-')),windows=[],opened=[];
  const app=new EventEmitter();Object.assign(app,{setName(){},isPackaged:false,requestSingleInstanceLock:()=>true,whenReady:()=>new Promise(()=>{}),getPath:()=>temporary,quit(){}});
  const ses=new EventEmitter();ses.setPermissionCheckHandler=h=>ses.check=h;ses.setPermissionRequestHandler=h=>ses.request=h;ses.setDisplayMediaRequestHandler=()=>{};
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},setWindowOpenHandler:handler=>this.popup=handler,send(){}});windows.push(this);}
    isDestroyed(){return this.dead;}loadURL(url){this.webContents.mainFrame.url=url;return Promise.resolve();}loadFile(){return Promise.resolve();}destroy(){this.dead=true;this.emit('closed');}show(){}focus(){}
  }
  const ipcMain=new EventEmitter();ipcMain.handle=()=>{};ipcMain.removeHandler=()=>{};
  let resolveSources;const electron={app,BrowserWindow:Window,Menu:{setApplicationMenu(){},buildFromTemplate:items=>items},dialog:{showMessageBox:async()=>({response:0})},ipcMain,session:{fromPartition:()=>ses},desktopCapturer:{getSources:()=>new Promise(r=>resolveSources=r)},shell:{openExternal:url=>{opened.push(url);return Promise.resolve();}},globalShortcut:{register:()=>true,unregister(){}}};
  const filename=path.resolve(__dirname,'../src/main.cjs'),localRequire=createRequire(filename),module={exports:{}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports={connect,chooseSource,dismissPicker};',{require:name=>name==='electron'?electron:localRequire(name),module,__dirname:path.dirname(filename),process,console,URL},{filename});
  return {api:module.exports,windows,opened,ses,resolveSources:value=>resolveSources(value),cleanup:()=>fs.rmSync(temporary,{recursive:true,force:true})};
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
