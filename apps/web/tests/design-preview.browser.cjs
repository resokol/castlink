// Real AppChrome/DesignPreview JSX and React DOM; synthetic native audio/video.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..');
const req = createRequire(path.join(web, 'package.json'));
assert.ok(fs.existsSync(path.join(web, 'components/DesignPreview.tsx')), 'native preview component is available');
const { chromium } = req('playwright');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-design-preview-'));
const entry = path.join(temp, 'probe.tsx');
const navigation = path.join(temp, 'navigation.ts');
fs.writeFileSync(navigation, `import {useEffect,useState} from 'react'; export function usePathname(){const [path,setPath]=useState(window.location.pathname);useEffect(()=>{const change=()=>setPath(window.location.pathname);window.addEventListener('popstate',change);return()=>window.removeEventListener('popstate',change);},[]);return path;}`);
fs.writeFileSync(entry, `
import React, {useEffect,useRef} from 'react';
import {createRoot} from 'react-dom/client';
import {AppChrome} from '@/components/AppChrome';
function MediaProbe(){const video=useRef(null);useEffect(()=>{
 window.mounts=(window.mounts||0)+1;
 const canvas=document.createElement('canvas');canvas.width=160;canvas.height=90;const painter=canvas.getContext('2d');let tick=0;const timer=setInterval(()=>{painter.fillStyle=tick++%2?'#a0d0b0':'#121212';painter.fillRect(0,0,160,90)},30);
 const stream=canvas.captureStream(20);const context=new AudioContext();const oscillator=context.createOscillator();const gain=context.createGain();gain.gain.value=.2;const destination=context.createMediaStreamDestination();oscillator.connect(gain);gain.connect(destination);oscillator.start();const audio=destination.stream.getAudioTracks()[0];stream.addTrack(audio);const source=context.createMediaStreamSource(new MediaStream([audio]));const analyser=context.createAnalyser();source.connect(analyser);
 video.current.srcObject=stream;void video.current.play();window.probe={video:video.current,stream,analyser,context,trackIds:stream.getTracks().map(t=>t.id)};window.probeReady=true;
 return()=>{window.unmounts=(window.unmounts||0)+1;clearInterval(timer);stream.getTracks().forEach(t=>t.stop());oscillator.stop();void context.close();};},[]);return <main><input id="draft" defaultValue="keep draft"/><video ref={video} muted autoPlay playsInline/><div id="must-stay-hidden" hidden>Not a control</div></main>;}
createRoot(document.getElementById('root')).render(<AppChrome><MediaProbe/></AppChrome>);
`);
const loader = path.join(temp, 'loader.cjs');
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(req.resolve('typescript'))});module.exports=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);
const webpack = req('next/dist/compiled/webpack/webpack'); webpack.init();
let server, browser;
const banner = '[data-design-preview-banner]';
async function main() {
 await new Promise((resolve,reject)=>webpack.webpack({mode:'development',entry,devtool:false,plugins:[new webpack.webpack.DefinePlugin({'process.env.NEXT_PUBLIC_BUILD_ID':JSON.stringify('development'),'process.env.NEXT_PUBLIC_APP_VERSION':JSON.stringify('development'),'process.env.NEXT_PUBLIC_PRODUCT_VERSION':JSON.stringify('development')})],output:{path:temp,filename:'bundle.js'},resolve:{extensions:['.ts','.tsx','.js'],alias:{'@':web,'next/navigation':navigation,react:path.dirname(req.resolve('react')),'react-dom':path.dirname(req.resolve('react-dom'))}},module:{rules:[{test:/\.tsx?$/,use:loader}]},optimization:{minimize:false}},(error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
 server=http.createServer((request,response)=>{
  if(request.url.startsWith('/api/version')){response.setHeader('content-type','application/json');response.end(JSON.stringify({buildId:'development',version:'development'}));return;}
  if(request.url==='/bundle.js'){response.setHeader('content-type','text/javascript');response.end(fs.readFileSync(path.join(temp,'bundle.js')));return;}
  if(request.url==='/new/live-theme.css'){response.setHeader('content-type','text/css');response.end('html[data-design-preview=on]{--preview-test:active} [hidden]{display:none!important}');return;}
  response.setHeader('content-type','text/html');response.end('<!doctype html><html><head><meta charset="utf-8"></head><body><div id="root"></div><script src="/bundle.js"></script></body></html>');
 });
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--autoplay-policy=no-user-gesture-required']});
 const context=await browser.newContext(),page=await context.newPage(),errors=[];page.on('pageerror',error=>{errors.push(error.message);console.error('Browser error:',error.message);});
 await page.goto(origin+'/studio?name=alpha&design=preview#owner=secret%26invite');await page.waitForSelector(banner);await page.waitForFunction(()=>window.probeReady);
 assert.equal(new URL(page.url()).search,'?name=alpha');assert.equal(new URL(page.url()).hash,'#owner=secret%26invite','cleaning query preserves invitation fragment');
 assert.equal(await page.evaluate(()=>document.documentElement.dataset.designPreview),'on');
 await page.locator('#draft').fill('preserved edit');
 const before=await sample(page);
 for(let i=0;i<4;i++){await page.locator('[data-design-preview-toggle]').click();assert.equal(await page.evaluate(()=>document.documentElement.dataset.designPreview),i%2?'on':'off');}
 const after=await sample(page);assert.equal(after.videoSame,true);assert.deepEqual(after.trackIds,before.trackIds);assert.equal(after.mounts,1);assert.equal(after.unmounts,0);assert.ok(after.frames>before.frames,'decoded frames advance while style toggles');assert.ok(before.rms>.05&&after.rms>.05,'native audio signal remains present');assert.equal(after.stylesheets,1);assert.equal(await page.locator('#draft').inputValue(),'preserved edit');assert.equal(await page.locator('#must-stay-hidden').isVisible(),false);
 // Changing query flags later in this document must not re-run initial activation.
 await page.evaluate(()=>{history.replaceState(history.state,'','/studio?design=current#owner=keep');window.dispatchEvent(new PopStateEvent('popstate'));});await page.waitForTimeout(50);assert.equal(await page.evaluate(()=>document.documentElement.dataset.designPreview),'on');
 // Special routes hide comparison chrome while retaining the design stylesheet and media sibling.
 for(const route of ['/output/guest-a','/multiview/scene','/watch','/monitor','/transfer']){
  await page.evaluate(route=>{history.pushState({},'',route);window.dispatchEvent(new PopStateEvent('popstate'));},route);
  await page.waitForFunction(()=>!document.querySelector('[data-design-preview-banner]')&&document.getElementById('castlink-preview-theme')&&document.documentElement.dataset.designPreview==='on');assert.equal((await sample(page)).mounts,1);assert.equal(await page.evaluate(()=>document.documentElement.dataset.designCleanOutput==='true'),/^\/(output|multiview)\//.test(route),'only clean media routes receive transparent-output guard');
 }
 await page.evaluate(()=>{history.pushState({},'','/studio');window.dispatchEvent(new PopStateEvent('popstate'));});await page.waitForSelector(banner);
 await page.goto(origin+'/admin');await page.waitForSelector(banner);assert.equal(await page.evaluate(()=>document.documentElement.dataset.designPreview),'on','same-tab full navigation restores boolean preference');
 await page.goto(origin+'/studio?design=current#invite=keep');await page.waitForSelector(banner);assert.equal(await page.evaluate(()=>document.documentElement.dataset.designPreview),'off');assert.equal(new URL(page.url()).hash,'#invite=keep');
 await page.locator('[data-design-preview-exit]').click();assert.equal(await page.locator(banner).count(),0);assert.equal(await page.evaluate(()=>!!document.getElementById('castlink-preview-theme')),true);assert.equal(await page.evaluate(()=>document.documentElement.dataset.designPreview),'on');assert.equal(await page.evaluate(()=>Object.keys(sessionStorage).some(key=>key.includes('design-preview'))),false);await page.goto(origin+'/studio');await page.waitForFunction(()=>window.probeReady);assert.equal(await page.locator(banner).count(),0);
 // Clean outputs receive the same stylesheet but never comparison chrome.
 await page.goto(origin+'/output/guest-a?design=preview#access=keep');await page.waitForFunction(()=>window.probeReady);assert.equal(await page.locator(banner).count(),0);assert.equal(await page.evaluate(()=>!!document.getElementById('castlink-preview-theme')),true);assert.equal(await page.evaluate(()=>document.documentElement.dataset.designCleanOutput),'true');assert.equal(new URL(page.url()).search,'');assert.equal(new URL(page.url()).hash,'#access=keep');
 const separate=await context.newPage();await separate.goto(origin+'/studio');await separate.waitForFunction(()=>window.probeReady);assert.equal(await separate.locator(banner).count(),0,'new independent tab starts without comparison controls');assert.equal(await separate.evaluate(()=>document.documentElement.dataset.designPreview),'on','default new design applies in independent tabs');await separate.close();
 const restricted=await browser.newContext();const privatePage=await restricted.newPage();await privatePage.addInitScript(()=>{Object.defineProperty(window,'sessionStorage',{get(){throw Error('Storage unavailable');}});});await privatePage.goto(origin+'/studio?design=preview#invite=keep');await privatePage.waitForSelector(banner);await privatePage.locator('[data-design-preview-toggle]').click();assert.equal(await privatePage.evaluate(()=>document.documentElement.dataset.designPreview),'off');await privatePage.locator('[data-design-preview-exit]').click();assert.equal(await privatePage.locator(banner).count(),0);await restricted.close();
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',before,after,checks:'actual AppChrome JSX; native audio/video continuity; same-tab persistence; clean outputs; query and invite cleanup; restricted storage; exit'}));
 await context.close();
}
async function sample(page){return page.evaluate(async()=>{const p=window.probe;await p.context.resume();await new Promise(resolve=>setTimeout(resolve,120));const values=new Float32Array(p.analyser.fftSize);p.analyser.getFloatTimeDomainData(values);return{mounts:window.mounts,unmounts:window.unmounts||0,videoSame:document.querySelector('video')===p.video,trackIds:p.stream.getTracks().map(t=>t.id),live:p.stream.getTracks().every(t=>t.readyState==='live'),frames:p.video.getVideoPlaybackQuality().totalVideoFrames,rms:Math.sqrt(values.reduce((sum,v)=>sum+v*v,0)/values.length),stylesheets:document.querySelectorAll('#castlink-preview-theme').length};});}
main().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));fs.rmSync(temp,{recursive:true,force:true});});
