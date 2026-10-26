// Real ConferenceScene and production CSS; synthetic keyed video nodes and room events.
const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),{createRequire}=require('node:module');
const web=path.resolve(__dirname,'..'),req=createRequire(path.join(web,'package.json'));
const {chromium}=req(process.env.CASTLINK_QA_PLAYWRIGHT||'playwright'),{build}=require(process.env.CASTLINK_QA_ESBUILD||'esbuild');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-conference-header-')),fixture=path.join(out,'fixture.tsx');
fs.writeFileSync(fixture,`
import React from 'react';import {createRoot} from 'react-dom/client';
import {ConferenceScene} from '${web}/components/ConferenceScene';
export const useI18n=()=>({locale:window.qaLocale||'ru'});
export const RoomEvent={ActiveSpeakersChanged:'speakers',ParticipantDisconnected:'disconnect'};
const listeners=new Map(),room={activeSpeakers:[],on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn)},off(event,fn){listeners.get(event)?.delete(fn)}};
window.qaSpeak=identity=>{room.activeSpeakers=[{identity,isMicrophoneEnabled:true}];listeners.get('speakers')?.forEach(fn=>fn())};
const sources=[{id:'screen',identity:'screen',kind:'screen'},...Array.from({length:12},(_,i)=>({id:'camera-'+i,identity:'camera-'+i,kind:'camera'}))];
function App(){const [target,setTarget]=React.useState(null),[docked,dock]=React.useState(false),[count,setCount]=React.useState(13);window.qaDock=dock;window.qaCount=setCount;
return <main className="media-page guest-room-page guest-app-shell graphite-workspace caster-workspace"><div className="guest-main-column"><header className="guest-page-header"><div className="caster-room-heading"><div className="caster-brand"><strong>CastLink</strong></div><h1>Комната</h1></div><div className="guest-page-header-actions"><div className="caster-scene-controls" ref={setTarget}/><span className="caster-connection-status">Онлайн</span><div className="guest-identity-pill">Кастер</div></div></header><div className="qa-scene-shell"><ConferenceScene room={room} controlsTarget={docked?target:null} items={sources.slice(0,count).map(source=>({...source,node:<div className="qa-media"><video data-video={source.id}/><span>{source.id}</span></div>}))}/></div></div><div className="workspace-footer-slot">Сервисные настройки</div></main>}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser;
(async()=>{
 await build({entryPoints:[fixture],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',nodePaths:[path.join(web,'node_modules')],alias:{'@':web},plugins:[{name:'room-leaves',setup(b){b.onResolve({filter:/^livekit-client$|(?:^|\/)I18nProvider$/},()=>({path:fixture}))}}]});
 const css=fs.readFileSync(path.join(web,'app/globals.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'app/graphite-workspace.css'),'utf8')+'\n'+fs.readFileSync(path.join(out,'bundle.css'),'utf8')+'\n.qa-scene-shell{flex:1 1 0;min-height:0}.qa-media{position:relative;background:#24292e}.qa-media span{position:absolute;bottom:8px;left:8px}.qa-media video{display:block}';
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const proof=[];
 for(const [width,height] of [[1440,900],[900,900],[390,844],[320,844],[844,390]])for(const theme of ['dark','light'])for(const locale of ['ru','en','zh-CN']){
  const page=await browser.newPage({viewport:{width,height}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://scene-header.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
  await page.goto('https://scene-header.test');await page.evaluate(({theme,locale})=>{document.documentElement.dataset.theme=theme;window.qaLocale=locale},{theme,locale});await page.addStyleTag({content:css});await page.addScriptTag({content:fs.readFileSync(path.join(out,'bundle.js'),'utf8')});
  await page.waitForSelector('[data-scene-primary]');
  const scene=page.locator('[data-scene-mode]'),viewport=scene.locator('[tabindex="0"]').first(),before=await viewport.boundingBox();
  await page.evaluate(()=>{window.qaNodes=[...document.querySelectorAll('video')];window.qaDock(true)});
  await page.waitForFunction(()=>document.querySelector('.caster-scene-controls button'));
  const slot=page.locator('.caster-scene-controls');assert.equal(await slot.locator('button').count(),2,'single header mode group');assert.equal(await scene.locator('header').count(),0,'caster has no full-width scene strip');
  const after=await viewport.boundingBox();if(width>=900)assert(after.height>before.height+20,'primary viewport gains height');
  const state=await page.evaluate(()=>{const r=e=>{const b=e.getBoundingClientRect();return{x:b.x,y:b.y,right:b.right,bottom:b.bottom,width:b.width,height:b.height}};return{page:document.documentElement.scrollWidth,slot:r(document.querySelector('.caster-scene-controls')),status:r(document.querySelector('.caster-connection-status')),buttons:[...document.querySelectorAll('.caster-scene-controls button,.caster-scene-controls summary')].map(r)}});
  assert(state.page<=width,'no horizontal overflow');assert(state.slot.right<=state.status.x+1||state.slot.bottom<=state.status.y+1,'controls precede online without overlap');for(const b of state.buttons)assert(b.x>=0&&b.right<=width+1&&b.height>=28,'header action fits viewport');
  const mode=slot.locator('button');await mode.nth(1).click();assert.equal(await scene.getAttribute('data-scene-mode'),'tiles');await mode.first().click();assert.equal(await scene.getAttribute('data-scene-mode'),'speaker');
  await scene.locator('[data-scene-pin="camera-0"]').click();await page.waitForFunction(()=>document.querySelector('[data-scene-primary] video')?.dataset.video==='camera-0');assert.equal(await scene.locator('[data-scene-primary] video').getAttribute('data-video'),'camera-0');await page.evaluate(()=>window.qaSpeak('camera-1'));
  const separator=scene.getByRole('separator');if(await separator.count()){await separator.focus();await page.keyboard.press('Home');await page.keyboard.press('End')}
  const scroll=scene.locator('[tabindex="0"]').first();const primaryBefore=await scene.locator('[data-scene-primary]').boundingBox();await scroll.evaluate(el=>el.scrollTop=el.scrollHeight);const primaryAfter=await scene.locator('[data-scene-primary]').boundingBox();if(width>=900)assert(Math.abs(primaryAfter.y-primaryBefore.y)<=1,'primary stable while rail scrolls');
  await slot.locator('summary').click();const panel=slot.locator('details > div');await panel.waitFor({state:'visible'});await page.waitForFunction(()=>!!document.querySelector('.caster-scene-controls details > div')?.style.left);const box=await panel.boundingBox();assert(box.x>=0&&box.y>=0&&box.x+box.width<=width+1&&box.y+box.height<=height+1,'settings panel bounded '+JSON.stringify({width,height,theme,locale,box}));assert(await panel.locator('input').isVisible());await panel.locator('input').uncheck();
  if(width===1440&&locale==='ru'){
   await page.evaluate(()=>document.querySelector('.workspace-footer-slot').scrollIntoView({block:'end'}));
   await page.waitForTimeout(50);const scrolled=await panel.boundingBox(),summary=await slot.locator('summary').boundingBox();
   if(summary.y+summary.height>0)assert(scrolled.y<=summary.y+summary.height+9,'settings follows header while page scrolls');else assert.equal(await slot.locator('details').getAttribute('open'),null,'offscreen settings closes');
   await page.evaluate(()=>window.scrollTo(0,0));
  }
  if(await slot.locator('details').getAttribute('open')!==null)await slot.locator('summary').click();
  assert(await page.evaluate(()=>window.qaNodes.every((node,i)=>node===document.querySelectorAll('video')[i])),'mode/pin/resize keep media DOM');
  if(locale==='ru')await page.screenshot({path:path.join(out,`header-${theme}-${width}x${height}.png`)});
  await page.evaluate(()=>window.qaCount(1));await page.waitForFunction(()=>document.querySelectorAll('video').length===1);assert.equal(await slot.locator('button').count(),2,'solo retains controls');assert.equal(await scene.locator('video').count(),1);
  assert.deepEqual(errors,[]);proof.push({width,height,theme,locale,before,after,state});await page.close();
 }
 fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log('PASS caster header portal: gained height, one mode/settings instance, menu bounds, stable keyed media, desktop/mobile and RU/EN/ZH; '+out);
})().catch(e=>{console.error(e);process.exitCode=1}).finally(async()=>{await browser?.close()});
