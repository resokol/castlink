'use strict';
// Actual main/preload/native renderers; isolated profile, loopback server and synthetic sources.
// No live server, media capture, helper execution or installation.
const electron=require('electron'),{app,BrowserWindow,nativeTheme,nativeImage}=electron;
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),http=require('node:http'),assert=require('node:assert/strict'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),output=path.join(root,'.qa','desktop-native');
fs.mkdirSync(output,{recursive:true});app.setPath('userData',path.join(output,'profile-'+process.pid));
const report={platform:process.platform,electron:process.versions.electron,syntheticSources:true,productionAccess:false,checks:[]};
let server,api;
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label){for(let i=0;i<80;i++){if(await fn())return;await delay(60);}throw Error('Timeout: '+label);}
const check=(value,label)=>{assert.ok(value,label);report.checks.push(label);};
const evaluate=(window,source)=>window.webContents.executeJavaScript(source,true);
const local=name=>BrowserWindow.getAllWindows().find(window=>!window.isDestroyed()&&window.webContents.getURL().endsWith('/'+name));
async function ready(name){await until(()=>local(name)&&!local(name).webContents.isLoading(),name);return local(name);}
async function capture(window,name){await delay(100);fs.writeFileSync(path.join(output,name+'.png'),(await window.webContents.capturePage()).toPNG());}
const timer=setTimeout(()=>{report.error='Timeout';finish();},60000);timer.unref();
function finish(){clearTimeout(timer);api?.dismissPicker();for(const window of BrowserWindow.getAllWindows())window.destroy();server?.close();report.result=report.error?'FAIL':'PASS';fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.error?1:0);}
app.whenReady().then(async()=>{
 try{
  const pixels=Buffer.alloc(400*225*4);for(let i=0;i<pixels.length;i+=4){pixels[i]=70;pixels[i+1]=85;pixels[i+2]=80;pixels[i+3]=255;}
  const thumbnail=nativeImage.createFromBitmap(pixels,{width:400,height:225});
  // Simulate a platform with the existing process-audio helper available; never start it.
  const fixtureFs={...fs,existsSync:file=>String(file).endsWith('CastLink.ProcessAudio.exe')||fs.existsSync(file)};
  const fixtureElectron={...electron,dialog:{...electron.dialog,showMessageBox:async()=>({response:0})},desktopCapturer:{getSources:async()=>[
   {id:'screen:1:0',name:'QA screen',thumbnail},{id:'window:12:0',name:'QA presentation.pptx',thumbnail}
  ]}};
  const filename=path.join(root,'apps/desktop/src/main.cjs'),localRequire=createRequire(filename),module={exports:{}};
  vm.runInNewContext(fs.readFileSync(filename,'utf8')+'\nmodule.exports={connect,chooseSource,dismissPicker,getClient:()=>client};',{
   require:name=>name==='electron'?fixtureElectron:name==='node:fs'?fixtureFs:name==='node:os'?{release:()=> '10.0.26100'}:localRequire(name),
   module,__dirname:path.dirname(filename),process,console,URL
  },{filename});
  api=module.exports;await ready('start.html');
  server=http.createServer((_request,response)=>{response.setHeader('Content-Type','text/html; charset=utf-8');response.end('<!doctype html><html data-theme="dark"><meta charset="utf-8"><title>Isolated CastLink QA</title></html>');});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  await api.connect({input:origin,role:'caster',reserves:[],locale:'ru'});const client=api.getClient();
  await until(()=>nativeTheme.themeSource==='dark','initial client theme');
  check(nativeTheme.themeSource==='dark','actual main receives initial explicit dark theme from sandbox preload');
  const state={id:'qa:theme:1',title:'QA presentation.pptx',controller:'QA owner',page:2,pages:6,canNavigate:true,canReclaim:false,busy:false,locale:'ru',toolbar:{canDelegate:true,canStop:true,sharing:true,controllerIdentity:null,participants:[{identity:'qa-other',name:'QA caster'}]}};
  await evaluate(client,'castlinkDesktop.slides.show('+JSON.stringify(state)+')');const panel=await ready('slide-panel.html');
  await until(()=>evaluate(panel,'document.getElementById("page").textContent==="2 / 6"'),'slide state');
  for(const theme of ['dark','light']){
   await evaluate(client,'document.documentElement.dataset.theme='+JSON.stringify(theme));
   await until(()=>nativeTheme.themeSource===theme,'native '+theme);
   await until(async()=>await evaluate(panel,'matchMedia("(prefers-color-scheme: light)").matches')===(theme==='light'),'panel theme '+theme);
   await capture(panel,'slides-'+theme);
   const style=await evaluate(panel,'getComputedStyle(document.documentElement).getPropertyValue("--surface").trim()');
   check(style===(theme==='dark'?'#1c2024':'#fafbfc'),'native slides use selected '+theme+' palette');
  }
  await evaluate(panel,'document.getElementById("control-toggle").click()');await until(()=>panel.getBounds().height>200,'expanded menu');
  await evaluate(panel,'document.getElementById("control-toggle").click()');await until(()=>panel.getBounds().height===162,'collapsed menu');
  for(const sharing of [false,true,false]){const next={...state,toolbar:{...state.toolbar,sharing,canStop:sharing}};await evaluate(client,'castlinkDesktop.slides.update('+JSON.stringify(next)+')');}
  check(panel.getBounds().height===162&&panel.getBounds().width===340,'native panel stays compact after repeated sharing state transitions');
  const picking=api.chooseSource({audioRequested:true});const picker=await ready('capture-picker.html');
  await until(()=>evaluate(picker,'document.querySelectorAll("#sources button").length===2'),'capture sources');
  check(await evaluate(picker,'!document.getElementById("audio-settings").hidden&&document.getElementById("audio-label").textContent==="Передавать звук"'),'audio option uses requested label with existing capability fixture');
  for(const theme of ['dark','light']){
   await evaluate(client,'document.documentElement.dataset.theme='+JSON.stringify(theme));await until(()=>nativeTheme.themeSource===theme,'picker native '+theme);
   await until(async()=>await evaluate(picker,'document.documentElement.dataset.theme')===theme,'picker renderer '+theme);
   const layout=await evaluate(picker,'(()=>{const checkbox=document.getElementById("include-audio").getBoundingClientRect();return {width:checkbox.width,height:checkbox.height,overflow:document.documentElement.scrollWidth>innerWidth,bg:getComputedStyle(document.documentElement).getPropertyValue("--bg").trim(),card:getComputedStyle(document.querySelector("#sources button")).backgroundColor}})()');
   check(layout.width===18&&layout.height===18&&!layout.overflow,'picker '+theme+' has compact checkbox and no horizontal overflow');
   check(layout.bg===(theme==='dark'?'#111315':'#f2f3f5'),'picker uses '+theme+' palette');
   await capture(picker,'picker-'+theme);
  }
  picker.setBounds({...picker.getBounds(),width:360,height:540});await capture(picker,'picker-light-narrow');
  check(await evaluate(picker,'document.documentElement.scrollWidth<=innerWidth'),'narrow native picker fits its viewport');
  await evaluate(picker,'document.getElementById("cancel").click()');check(await picking===null,'cancel returns no source');
 }catch(error){report.error=error.stack||String(error);}
 finally{finish();}
});
