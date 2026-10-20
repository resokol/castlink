// Production floating controls and STOP slot, exercised in an actual DocumentPiP browser window.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{createRequire}=require('node:module');
const root=path.resolve(__dirname,'../../..'),web=path.join(root,'apps/web'),req=createRequire(path.join(root,'.qa/tools/package.json')),{chromium}=req('playwright'),{build}=req('esbuild');
const out=path.join(root,'.qa/presentation-size');fs.mkdirSync(out,{recursive:true});let browser,server;
fs.writeFileSync(path.join(out,'entry.ts'),`
import {createCoPresentationControls} from '@/lib/co-presentation-controls';
import {createScreenShareStopPanel} from '@/lib/screen-share-stop-panel';
let sharing=true,changes=0,shown=0;const actions=[];
const original=window.documentPictureInPicture.requestWindow.bind(window.documentPictureInPicture);window.qaResize=[];window.documentPictureInPicture.requestWindow=async opts=>{window.qaResize.push({request:opts});const child=await original(opts),resize=child.resizeTo.bind(child);child.resizeTo=(width,height)=>{window.qaResize.push({width,height,active:navigator.userActivation.isActive,childActive:child.navigator.userActivation.isActive,old:[child.innerWidth,child.innerHeight]});resize(width,height)};return child};const controls=createCoPresentationControls({host:window,action:event=>actions.push(event),browserOpened:()=>shown++});
const state={id:'qa-deck:1:0',title:'QA presentation',controller:'You control',page:1,pages:3,canNavigate:true,canReclaim:false,busy:false,locale:'en',toolbar:{canDelegate:true,canStop:true,sharing:true,controllerIdentity:null,participants:[]}};
const stop=createScreenShareStopPanel({api:window.documentPictureInPicture,labels:{locale:'en',title:'Stop presentation',stop:'STOP PRESENTATION',stopping:'Stopping',stopError:'Retry'},isSharing:()=>sharing,stop:async()=>{await new Promise(resolve=>setTimeout(resolve,30));sharing=false;changes++;}});
document.getElementById('slides').onclick=()=>{controls.update(state);void controls.show()};
document.getElementById('start').onclick=()=>{sharing=true;void stop.open()};
document.getElementById('stop').onclick=()=>{sharing=false;stop.sync()};
document.getElementById('hide').onclick=()=>controls.clear();
window.qa={getState:()=>{const win=window.documentPictureInPicture.window;return{sharing,changes,shown,actions,resize:window.qaResize,width:win?.innerWidth,height:win?.innerHeight,outerWidth:win?.outerWidth,outerHeight:win?.outerHeight,slots:win?[...win.document.querySelectorAll('[data-pip-slot]')].map(e=>({name:e.dataset.pipSlot,width:e.getBoundingClientRect().width,height:e.getBoundingClientRect().height})):[]}}};
`);
(async()=>{
 await build({entryPoints:[path.join(out,'entry.ts')],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',alias:{'@':web}});
 server=http.createServer((request,response)=>{if(request.url==='/bundle.js'){response.setHeader('content-type','text/javascript');response.end(fs.readFileSync(path.join(out,'bundle.js')))}else response.end('<button id=slides>Slides</button><button id=start>Start</button><button id=stop>Stop</button><button id=hide>Hide</button><script src=/bundle.js></script>')});await new Promise(r=>server.listen(0,'127.0.0.1',r));
 browser=await chromium.launch({headless:process.env.CASTLINK_QA_HEADED!=='1',args:['--window-size=1920,1080']});const page=await browser.newPage({viewport:null});const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>console.log('BROWSER',m.text()));page.context().on('page',p=>p.on('console',m=>console.log('PIP',m.text())));await page.goto('http://127.0.0.1:'+server.address().port);
 assert.equal(await page.evaluate(()=>typeof window.documentPictureInPicture?.requestWindow),'function','browser supports DocumentPiP');
 const results=[];
 for(let cycle=0;cycle<3;cycle++){
  const opening = page.context().waitForEvent('page');await page.locator('#slides').click();const pipPage=await opening;
  await pipPage.locator('[data-action="compact-size"]').waitFor();const initial=await page.evaluate(()=>window.qa.getState());
  await pipPage.evaluate(()=>window.resizeTo(1000,700));await pipPage.waitForTimeout(100);
  const enlarged=await page.evaluate(()=>window.qa.getState());assert(enlarged.width>=900,'fixture deliberately enlarges floating window');
  await pipPage.getByRole('button',{name:'Compact size',exact:true}).click();await pipPage.waitForTimeout(100);const before=await page.evaluate(()=>window.qa.getState());if(cycle===0)await pipPage.screenshot({path:path.join(out,process.env.CASTLINK_QA_HEADED==='1'?'floating-compact-headed.png':'floating-compact-headless.png')});
  await page.locator('#start').click();await page.waitForFunction(()=>window.qa.getState().slots.length===2);await page.waitForTimeout(100);const during=await page.evaluate(()=>window.qa.getState());
  const stopDone=await page.evaluate(()=>window.qa.getState().changes);await pipPage.getByRole('button',{name:'STOP PRESENTATION',exact:true}).click();await page.waitForFunction(previous=>window.qa.getState().changes>previous,stopDone);await page.waitForFunction(()=>window.qa.getState().slots.length===1);await page.waitForTimeout(100);const after=await page.evaluate(()=>window.qa.getState());
  for(const state of [before,during,after]){assert(state.width<=450,'explicit compact recovery and share cycles keep width bounded');assert(state.height<=420,'floating height stays compact');assert(state.slots.every(s=>s.width<=state.width+1),'content stays inside floating window')}
  assert(after.height<=before.height+2,'async STOP restores slides geometry');assert.equal(after.slots[0].name,'slides');assert.equal(after.actions.length,0,'size recovery changes no slide/media action');results.push({cycle,initial,enlarged,before,during,after});await page.locator('#hide').click();await page.waitForFunction(()=>window.qa.getState().slots.length===0);
 }
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,process.env.CASTLINK_QA_HEADED==='1'?'results-headed.json':'results-headless.json'),JSON.stringify({headed:process.env.CASTLINK_QA_HEADED==='1',results,errors},null,2));console.log(JSON.stringify({result:'PASS',out,cycles:results.length}));
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close();if(server)await new Promise(r=>server.close(r))});
