// Real ConferenceScene/React/CSS, synthetic video nodes and room events.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..');
const req = createRequire(path.join(web, 'package.json'));
const { chromium } = req(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');
const { build } = require(process.env.CASTLINK_QA_ESBUILD || 'esbuild');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-conference-pin-'));
const fixture = path.join(out, 'fixture.tsx');
fs.writeFileSync(fixture, `
import React from 'react';
import {createRoot} from 'react-dom/client';
import {ConferenceScene} from '${path.join(web, 'components/ConferenceScene.tsx')}';
export const useI18n = () => ({locale:'ru'});
export const RoomEvent = {ActiveSpeakersChanged:'speakers',ParticipantDisconnected:'disconnected'};
const listeners = new Map();
const room = {activeSpeakers:[],on(event, fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn)},off(event, fn){listeners.get(event)?.delete(fn)}};
window.qaSpeak = identity => {room.activeSpeakers=[{identity,isMicrophoneEnabled:true}];listeners.get('speakers')?.forEach(fn=>fn())};
const sources = [
 {id:'screen',identity:'screen-owner',kind:'screen',name:'Демонстрация экрана'},
 {id:'alice',identity:'alice',kind:'camera',name:'Анна'},
 {id:'bob',identity:'bob',kind:'camera',name:'Борис'},
];
function App(){
 const [removed,setRemoved]=React.useState('');window.qaRemove=setRemoved;
 const items=sources.filter(source=>source.id!==removed).map(source=>({...source,node:<div className="qa-media"><video data-video={source.id}/><span>{source.name}</span></div>}));
 return <><section id="viewer"><ConferenceScene items={items} room={room}/></section><section id="other"><ConferenceScene items={items} room={room}/></section></>;
}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser;
(async () => {
 await build({entryPoints:[fixture],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',nodePaths:[path.join(web,'node_modules')],alias:{'@':web},plugins:[{name:'fixture-leaves',setup(builder){builder.onResolve({filter:/^livekit-client$|(?:^|\/)I18nProvider$/},()=>({path:fixture}))}}]});
 const css = fs.readFileSync(path.join(web,'app/globals.css'),'utf8')+'\n'+fs.readFileSync(path.join(out,'bundle.css'),'utf8')+`\nbody{margin:0;padding:16px;background:var(--page-bg)}#viewer{height:650px;width:100%}#other{height:250px;margin-top:16px}.qa-media{position:relative;background:#202b40}.qa-media video{display:block}.qa-media span{position:absolute;bottom:8px;left:8px;color:#eef0f2;font:14px Arial}`;
 browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,XDG_CACHE_HOME:path.join(out,'cache'),XDG_CONFIG_HOME:path.join(out,'config')}});
 let checks=0;
 for(const theme of ['dark','light']) for(const mobile of [false,true]) {
  const page=await browser.newPage({viewport:mobile?{width:390,height:844}:{width:1280,height:900},isMobile:mobile,hasTouch:mobile});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://pin.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
  const mount=async()=>{await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.addStyleTag({content:css});await page.addScriptTag({content:fs.readFileSync(path.join(out,'bundle.js'),'utf8')});await page.waitForSelector('#viewer [data-scene-primary]')};
  await page.goto('https://pin.test/');await mount();
  const viewer=page.locator('#viewer');
  const pin=id=>viewer.locator(`[data-scene-pin="${id}"]`);
  const primary=async()=>viewer.locator('[data-scene-primary] video').getAttribute('data-video');
  const expectPrimary=async id=>{await page.waitForFunction(id=>document.querySelector('#viewer [data-scene-primary] video')?.dataset.video===id,id);assert.equal(await primary(),id);checks++};
  await expectPrimary('screen');
  assert.equal(await viewer.locator('[data-scene-pin][aria-pressed="true"]').count(),0);checks++;
  await page.evaluate(()=>window.qaNodes=[...document.querySelectorAll('#viewer video')]);
  await pin('alice').click();await expectPrimary('alice');
  assert.equal(await pin('alice').getAttribute('aria-pressed'),'true');checks++;
  assert.equal(await page.locator('#other [data-scene-primary] video').getAttribute('data-video'),'screen');checks++;
  await page.evaluate(()=>window.qaSpeak('bob'));await page.waitForTimeout(1100);await expectPrimary('alice');
  const geometry=await pin('alice').evaluate(button=>{const tile=button.parentElement.getBoundingClientRect(),b=button.getBoundingClientRect(),hit=document.elementFromPoint(b.x+b.width/2,b.y+b.height/2);return {x:b.x-tile.x,y:b.y-tile.y,width:b.width,hit:hit===button||button.contains(hit),background:getComputedStyle(button).backgroundColor}});
  assert.equal(geometry.x,6);assert.equal(geometry.y,6);assert(geometry.hit);assert(geometry.width>=(mobile?44:30));assert.equal(geometry.background,'rgb(172, 217, 187)');checks+=5;
  await page.screenshot({path:path.join(out,`pin-${theme}-${mobile?'mobile':'desktop'}.png`)});
  await pin('bob').click();await expectPrimary('bob');assert.equal(await pin('alice').getAttribute('aria-pressed'),'false');checks++;
  await pin('bob').focus();await page.keyboard.press('Enter');await expectPrimary('screen');
  await pin('alice').click();await expectPrimary('alice');
  await viewer.getByRole('button',{name:'Плитка',exact:true}).click();assert.equal(await viewer.locator('[data-scene-pin]').count(),0);checks++;
  await viewer.getByRole('button',{name:'Окно',exact:true}).click();await expectPrimary('alice');
  assert(await page.evaluate(()=>window.qaNodes.every((node,i)=>node===document.querySelectorAll('#viewer video')[i])));checks++;
  await page.evaluate(()=>window.qaRemove('alice'));await expectPrimary('screen');
  await page.evaluate(()=>window.qaRemove(''));assert.equal(await pin('alice').getAttribute('aria-pressed'),'false');checks++;
  await pin('alice').click();await expectPrimary('alice');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('castlink.conference-scene.v1')));assert(!('pinnedId' in saved));checks++;
  await page.reload();await mount();await expectPrimary('screen');assert.equal(await viewer.locator('[data-scene-pin][aria-pressed="true"]').count(),0);checks++;
  await page.evaluate(()=>window.qaRemove('screen'));await page.waitForFunction(()=>document.querySelector('#viewer [data-scene-primary] video')?.dataset.video!=='screen');
  await pin('alice').click();await expectPrimary('alice');await page.evaluate(()=>window.qaSpeak('bob'));await page.waitForTimeout(1100);await expectPrimary('alice');
  await pin('alice').click();await expectPrimary('bob');
  assert.deepEqual(errors,[]);checks++;
  await page.close();
 }
 console.log(JSON.stringify({result:'PASS',cases:4,checks,out}));
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
