'use strict';
// Isolated render proof: real native UI versus the website's floating toolbar.
const {app,BrowserWindow,ipcMain,nativeTheme}=require('electron');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'artifacts/slide-parity-qa');
fs.mkdirSync(out,{recursive:true});app.setPath('userData',path.join(out,'profile-'+process.pid));
const ts=require(path.join(root,'apps/web/node_modules/typescript'));
const source=fs.readFileSync(path.join(root,'apps/web/lib/co-presentation-toolbar.ts'),'utf8');
const compiled=ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
app.on('window-all-closed',()=>{});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const base={id:'parity:grant:1',title:'Доклад о результатах команды.pptx',controller:'Вы управляете',page:2,pages:18,canNavigate:true,canReclaim:false,busy:false,locale:'ru',toolbar:{canDelegate:true,canStop:true,sharing:true,controllerIdentity:null,participants:[{identity:'caster-a',name:'Александра — ведущая презентации'},{identity:'caster-b',name:'李明 — 远程演示控制'}]}};
const report={result:'FAIL',syntheticState:true,productionAccess:false,checks:[],captures:[]};let pending;
ipcMain.on('castlink:slides-ready',e=>e.sender.send('castlink:slides-view',pending));
function check(value,label){assert.ok(value,label);report.checks.push(label);}
async function render(state,width,theme,menu,label){
 nativeTheme.themeSource=theme;pending={...state,menuOpen:menu};
 const height=menu?470:state.stopFailed?210:162;
 const native=new BrowserWindow({show:false,frame:false,width,height,webPreferences:{preload:path.join(root,'apps/desktop/src/preload.cjs'),additionalArguments:['--castlink-role=slides'],contextIsolation:true,sandbox:true}});
 await native.loadFile(path.join(root,'apps/desktop/ui/slide-panel.html'));await delay(100);
 const browser=new BrowserWindow({show:false,frame:false,width,height,webPreferences:{contextIsolation:true,sandbox:true}});await browser.loadURL('about:blank');
 await browser.webContents.executeJavaScript(`(()=>{document.body.style.margin='0';const exports={};${compiled};const slot=document.createElement('div');slot.dataset.pipSlot='slides';slot.dataset.theme=${JSON.stringify(theme)};document.body.append(slot);const surface=document.createElement('div');slot.append(surface);const toolbar=exports.createSlideToolbar(window,()=>{},()=>{},surface);toolbar.update(${JSON.stringify(state)},false,!!${JSON.stringify(state.stopPending||false)},!!${JSON.stringify(state.stopFailed||false)});${menu?"document.querySelector('.cl-trigger').click();":''}})()`);
 await delay(100);
 for(const [name,win] of [['native',native],['website',browser]]){const file=label+'-'+name+'.png';fs.writeFileSync(path.join(out,file),(await win.webContents.capturePage()).toPNG());report.captures.push(file);}
 const geometry=await native.webContents.executeJavaScript(`(()=>{const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,bottom:r.bottom,right:r.right}};return {stop:rect('stop'),navigation:rect('navigation'),strip:rect('sharing-strip'),menu:rect('menu-host'),page:rect('page'),toggle:getComputedStyle(document.getElementById('control-toggle')).backgroundColor,scroll:document.documentElement.scrollWidth,width:innerWidth,button:rect('next')}})()`);
 native.destroy();browser.destroy();return geometry;
}
app.whenReady().then(async()=>{try{
 const g=await render(base,340,'dark',false,'owner-dark');
 check(g.stop.y>=g.navigation.bottom,'STOP is in the lower strip below navigation, matching website');
 check(g.toggle==='rgb(42, 57, 48)','delegation uses website green surface');
 check(g.scroll<=g.width,'owner fits without horizontal overflow');
 for(const [label,width,theme,state,menu] of [
 ['owner-menu',340,'dark',base,true],['owner-light',340,'light',base,false],
 ['narrow-en',280,'dark',{...base,locale:'en',title:'Quarterly review — a very long presentation filename.pptx',controller:'You control'},true],
 ['narrow-zh',280,'light',{...base,locale:'zh-CN',title:'季度演示文稿与远程协作.pptx',controller:'您控制'},false],
 ['recipient',300,'dark',{...base,toolbar:{...base.toolbar,canDelegate:false,canStop:false},controller:'Вы можете переключать слайды'},false],
 ['busy',340,'dark',{...base,busy:true},false],['failed-stop',340,'dark',{...base,stopFailed:true},false],
 ['many-casters',340,'light',{...base,toolbar:{...base.toolbar,participants:Array.from({length:100},(_,i)=>({identity:'caster-'+i,name:'Кастер '+i+' — длинное имя участника'}))}},true]]){
 const x=await render(state,width,theme,menu,label);check(x.scroll<=x.width,label+' fits width');
 if(state.toolbar.canStop)check(x.stop.y>=x.navigation.bottom,label+' keeps STOP separate from navigation');
 if(menu)check(x.menu.y>=x.strip.bottom,label+' menu leaves STOP unobstructed');
 }
 report.result='PASS';
}catch(e){report.error=e.stack||String(e);}finally{fs.writeFileSync(path.join(out,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));app.exit(report.result==='PASS'?0:1);}});
