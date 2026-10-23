const {test}=require('node:test');
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),vm=require('node:vm');
const {EventEmitter}=require('node:events'),{createRequire}=require('node:module');
function runtime(options={}){
  const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-main-test-')),windows=[],opened=[];
  const runtimeProcess={...process,resourcesPath:temporary,argv:options.argv||process.argv,platform:options.platform||process.platform,execPath:options.execPath||process.execPath,env:options.env||{}};
  const app=new EventEmitter();app.protocols=[];Object.assign(app,{setName(value){app.name=value;},setPath(key,value){app.paths??={};app.paths[key]=value;},isPackaged:options.packaged||false,getVersion:()=>'1.0.0',requestSingleInstanceLock:()=>true,whenReady:()=>options.ready?Promise.resolve():new Promise(()=>{}),setAsDefaultProtocolClient:(...args)=>{app.protocol=args;app.protocols.push(args);return true;},getPath:()=>temporary,quit(){}});
  const ses=new EventEmitter();ses.setPermissionCheckHandler=h=>ses.check=h;ses.setPermissionRequestHandler=h=>ses.request=h;ses.setDisplayMediaRequestHandler=h=>ses.display=h;
  class Window extends EventEmitter{
    constructor(options){super();this.options=options;this.dead=false;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{url:''},setWindowOpenHandler:handler=>this.popup=handler,send(){},getUserAgent:()=> 'Electron/44',setUserAgent:value=>this.userAgent=value});windows.push(this);}
    setMenu(menu){this.menu=menu;}isDestroyed(){return this.dead;}loadURL(url){this.webContents.mainFrame.url=url;return Promise.resolve();}loadFile(file){this.webContents.mainFrame.url=require('node:url').pathToFileURL(file).href;return Promise.resolve();}destroy(){this.dead=true;this.emit('closed');}close(){this.destroy();}show(){}focus(){}isMinimized(){return false;}
  }
  const updateCalls=[],updateAdapter={automatic:()=>true,setAutomatic:value=>updateCalls.push({automatic:value}),check:async value=>updateCalls.push(value||{})};
  const ipcMain=new EventEmitter();ipcMain.handlers={};ipcMain.handle=(name,handler)=>ipcMain.handlers[name]=handler;ipcMain.removeHandler=()=>{};
  const prompts=[];let resolveSources;const electron={app,BrowserWindow:Window,Menu:{setApplicationMenu(){},buildFromTemplate:items=>items},dialog:{showMessageBox:async(...args)=>{prompts.push(args);return {response:options.response||0};}},ipcMain,session:{fromPartition:()=>ses},desktopCapturer:{getSources:()=>new Promise(r=>resolveSources=r)},shell:{openExternal:url=>{opened.push(url);return Promise.resolve();}},nativeTheme:{themeSource:'system'},globalShortcut:{register:()=>true,unregister(){}}};
  const filename=path.resolve(__dirname,'../src/main.cjs'),localRequire=createRequire(filename),module={exports:{}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports={connect,chooseSource,dismissPicker};',{require:name=>name==='electron'?electron:name==='./remote-pc-helper.cjs'?{runRemotePcHelper:value=>{app.remoteOptions=value;}}:name==='./updates.cjs'?{...localRequire(name),createUpdateController:()=>updateAdapter}:localRequire(name),module,__dirname:path.dirname(filename),process:runtimeProcess,console,URL},{filename});
  return {api:module.exports,windows,opened,ses,app,prompts,updateCalls,ipcMain,nativeTheme:electron.nativeTheme,resolveSources:value=>resolveSources(value),cleanup:()=>fs.rmSync(temporary,{recursive:true,force:true})};
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


test('portable protocol registration targets stable wrapper and preserves installed/development routes',()=>{
  const stable=path.win32.join('D:/Apps With Spaces','CastLink Portable.exe');
  const extracted=path.win32.join('C:/Temp/portable-session/app','CastLink Client.exe');
  const cases=[
    {packaged:true,platform:'win32',env:{PORTABLE_EXECUTABLE_FILE:stable},expected:['castlink',stable,[]]},
    {packaged:true,platform:'win32',env:{},expected:['castlink']},
    {packaged:false,platform:'win32',env:{PORTABLE_EXECUTABLE_FILE:stable},expected:undefined},
    {packaged:true,platform:'darwin',env:{PORTABLE_EXECUTABLE_FILE:stable},expected:['castlink']},
  ];
  for(const candidate of cases){
    const state=runtime({...candidate,execPath:extracted});
    try{
      const actual=state.app.protocol&&JSON.parse(JSON.stringify(state.app.protocol));
      assert.deepEqual(actual,candidate.expected,'portable registration must retain the stable wrapper including spaces; installed/default and development behavior stays unchanged');
      assert.deepEqual(JSON.parse(JSON.stringify(state.app.protocols)),candidate.expected?[['castlink-remote',...candidate.expected.slice(1)],['castlink-presenter',...candidate.expected.slice(1)],candidate.expected]:[],'both invitation and browser-presenter protocols target the same stable executable');
      if(candidate.expected?.length===3){
        assert.notEqual(actual[1],extracted,'registered target remains after the portable launcher removes its temporary child');
        assert.deepEqual(actual[2],[],'invitation URLs are forwarded by the OS at invocation, never embedded as registration arguments');
      }
    }finally{state.cleanup();}
  }
});

test('only current trusted main frame can synchronize native windows with the selected client theme',async()=>{
  const state=runtime({ready:true});try{
    await tick();await state.api.connect({input:'https://studio.example',reserves:[],locale:'ru'});
    const client=state.windows.find(window=>window.webContents.mainFrame.url.startsWith('https://studio.example'));
    const event={sender:client.webContents,senderFrame:client.webContents.mainFrame};
    state.ipcMain.emit('castlink:theme',event,'dark');assert.equal(state.nativeTheme.themeSource,'dark');
    state.ipcMain.emit('castlink:theme',event,'light');assert.equal(state.nativeTheme.themeSource,'light');
    for(const bad of [undefined,'system',{},'LIGHT'])state.ipcMain.emit('castlink:theme',event,bad);
    state.ipcMain.emit('castlink:theme',{...event,senderFrame:{url:'https://studio.example/'}},'dark');
    state.ipcMain.emit('castlink:theme',{...event,sender:{}},'dark');
    assert.equal(state.nativeTheme.themeSource,'light','invalid values and foreign frames cannot change native UI');
    client.webContents.mainFrame.url='https://untrusted.example/';
    state.ipcMain.emit('castlink:theme',event,'dark');assert.equal(state.nativeTheme.themeSource,'light');
  }finally{state.cleanup();}
});

test('startup checks only packaged client and manual update IPC is confined to the local launcher main frame',async()=>{
  const state=runtime({ready:true,packaged:true});try{
    await tick();assert.equal(state.updateCalls.length,1);
    const launcher=state.windows[0],handler=state.ipcMain.handlers['castlink:updates'];assert.equal(typeof handler,'function');
    launcher.webContents.mainFrame.url=require('node:url').pathToFileURL(path.resolve(__dirname,'../ui/start.html')).href;
    const event={sender:launcher.webContents,senderFrame:launcher.webContents.mainFrame};
    await handler(event);assert.equal(state.updateCalls.at(-1).manual,true);
    assert.throws(()=>handler({...event,senderFrame:{url:launcher.webContents.mainFrame.url}}),/Denied/);
    assert.throws(()=>handler({...event,sender:{}}),/Denied/);
  }finally{state.cleanup();}
  const dev=runtime({ready:true});try{await tick();assert.equal(dev.updateCalls.length,0);}finally{dev.cleanup();}
});

test('actual capture picker binds one native capture id, rejects renderer targets and cannot release a newer capture',async()=>{
  const state=runtime({ready:true});try{
    await tick();await state.api.connect({input:'https://studio.example/room',reserves:[],locale:'ru'});
    const client=state.windows.find(window=>window.webContents.mainFrame.url==='https://studio.example/room');
    const event={sender:client.webContents,senderFrame:client.webContents.mainFrame};
    const invoke=(method,value)=>state.ipcMain.handlers[method](event,value);
    const capture=async sourceId=>{
      const id=await invoke('castlink:audio-begin');
      const pending=new Promise(resolve=>state.ses.display({frame:client.webContents.mainFrame,videoRequested:true,audioRequested:false,userGesture:true},resolve));
      state.resolveSources([{id:sourceId,name:'Chosen source',thumbnail:{toDataURL:()=>''}}]);await tick();
      const picker=state.windows.findLast(window=>window.options.title==='CastLink · Screen');
      await state.ipcMain.handlers['castlink:capture-choose']({sender:picker.webContents,senderFrame:picker.webContents.mainFrame},sourceId);
      assert.equal((await pending).video.id,sourceId);
      assert.equal(await invoke('castlink:audio-info',id),null,'source is finalized even without audio');return id;
    };
    const first=await capture('window:12345:0');
    assert.equal((await invoke('castlink:powerpoint-connectShared',{captureId:first,windowHandle:'54321'})).error,'POWERPOINT_CAPTURE_STALE');
    const second=await capture('screen:0:0');
    assert.equal((await invoke('castlink:powerpoint-connectShared',{captureId:first})).error,'POWERPOINT_CAPTURE_STALE');
    await invoke('castlink:audio-cancel',first);
    const actual=await invoke('castlink:powerpoint-connectShared',{captureId:second});
    assert.equal(actual.error,'POWERPOINT_NATIVE_UNAVAILABLE','matching new source reaches the native stage despite old capture cleanup');
    await invoke('castlink:audio-cancel',second);
    assert.equal((await invoke('castlink:powerpoint-connectShared',{captureId:second})).error,'POWERPOINT_CAPTURE_STALE');
    assert.throws(()=>state.ipcMain.handlers['castlink:powerpoint-connectShared']({...event,senderFrame:{url:client.webContents.mainFrame.url}},{captureId:second}));
  }finally{state.cleanup();}
});

test('standard packaged remote helper QA requires both explicit flags and uses separate profile',()=>{for(const [flags,expected]of [[[],false],[['--remote-pc-allow-loopback-test'],false],[['--pptx-test-build','--remote-pc-allow-loopback-test'],true]]){const state=runtime({packaged:true,platform:'win32',argv:['CastLink.exe','--remote-pc-helper',...flags]});try{assert.equal(state.app.remoteOptions.allowLoopback,expected);assert.equal(state.app.name,expected?'CastLink Remote PC Test':'CastLink Remote PC Helper');assert.match(state.app.paths.userData,expected?/Remote PC Test$/:/Remote PC Helper$/);assert.equal(state.app.protocols.length,0);assert.equal(state.updateCalls.length,0);}finally{state.cleanup();}}});

test('actual normal-client permission handler dispatches only the verified current-top remote URI',async()=>{
 const state=runtime();try{
  await state.api.connect({input:'https://studio.example',role:'caster',reserves:[],locale:'ru'});
  const client=state.windows[0],url='castlink-remote://connect?server=https%3A%2F%2Fstudio.example#rp1_'+'A'.repeat(43);
  const details={isMainFrame:true,requestingUrl:client.webContents.mainFrame.url,externalURL:url};
  const request=(value,contents=client.webContents)=>new Promise(resolve=>state.ses.request(contents,'openExternal',resolve,value));
  assert.equal(await request(details),true,'actual top-created iframe requester is authorized for this strict URI');
  assert.equal(await request({...details,isMainFrame:false,requestingUrl:'about:blank'}),false);
  assert.equal(await request({...details,isMainFrame:false,requestingUrl:'https://studio.example/child'}),false);
  assert.equal(await request({...details,externalURL:url.replace('studio.example','foreign.example')}),false);
  assert.equal(await request({...details,externalURL:'mailto:owner@example.com'}),false);
  assert.equal(await request(details,{mainFrame:client.webContents.mainFrame}),false);
  client.webContents.mainFrame.url='https://studio.example/room?next';
  assert.equal(await request(details),false,'a previous top document cannot authorize a later launch');
  assert.equal(state.prompts.length,1,'initial device prompt only; no extra grant dialog');assert.equal(state.opened.length,0,'Electron owns the one native dispatch after permission callback');
 }finally{state.cleanup();}
});
