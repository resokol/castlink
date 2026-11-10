// Real ConferenceScene and RoomConference React/CSS. SDK and transport leaves are
// deterministic fixtures: these checks prove layout/continuity, not an SFU or devices.
// Requires playwright plus esbuild; CASTLINK_QA_PLAYWRIGHT and CASTLINK_QA_ESBUILD
// may name external installs. CASTLINK_QA_CHROMIUM_BINARY defaults to /usr/bin/chromium.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..');
const req = createRequire(path.join(web, 'package.json'));
const { chromium } = req(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');
const { build } = require(process.env.CASTLINK_QA_ESBUILD || 'esbuild');
const source = process.env.CASTLINK_QA_SOURCE || web;
const entry = process.env.CASTLINK_MOBILE_ENTRY === '1';
const out = process.env.CASTLINK_WINDOW_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-window-proportions-'));
fs.mkdirSync(out,{recursive:true});
const fixture = path.join(out, 'fixture.tsx');
fs.writeFileSync(fixture, `
import React, {useEffect, useMemo, forwardRef} from 'react';
import {createRoot} from 'react-dom/client';
${entry ? `import {AppChrome,AppFooterSlot} from '${source}/components/AppChrome';import {PathnameContext} from 'next/dist/shared/lib/hooks-client-context.shared-runtime';` : ''}
import {BrandIcon} from '${path.join(source, 'components/BrandIcon.tsx').replaceAll(String.fromCharCode(92), '/')}';
import {RoomConference} from '${path.join(source, 'components/RoomConference.tsx').replaceAll(String.fromCharCode(92), '/')}';
import {GuestMicrophoneButton} from '${path.join(source, 'components/GuestMicrophoneButton.tsx').replaceAll(String.fromCharCode(92), '/')}';
import {GuestCodecCameraButton} from '${path.join(source, 'components/GuestCodecCameraButton.tsx').replaceAll(String.fromCharCode(92), '/')}';
import {GuestNoiseSuppressionControl} from '${path.join(source, 'components/GuestNoiseSuppressionControl.tsx').replaceAll(String.fromCharCode(92), '/')}';
import {GuestSettingsPanel} from '${path.join(source, 'components/GuestSettingsPanel.tsx').replaceAll(String.fromCharCode(92), '/')}';
import {CoPresentationPanel} from '${path.join(source, 'components/CoPresentationPanel.tsx').replaceAll(String.fromCharCode(92), '/')}';
export const Track = {Source:{Camera:'camera',ScreenShare:'screen_share',Microphone:'microphone',ScreenShareAudio:'screen_share_audio',Unknown:'unknown'},Kind:{Audio:'audio'}};
export const RoomEvent = {ActiveSpeakersChanged:'speakers',ParticipantDisconnected:'disconnected',ParticipantMetadataChanged:'metadata',ParticipantConnected:'joined',TrackSubscribed:'subscribed',LocalTrackPublished:'published',LocalTrackUnpublished:'unpublished',TrackMuted:'muted',TrackUnmuted:'unmuted'};
const listeners=new Map();
export const LocalVideoTrack=class {};
import ScreenShareIcon from '${path.join(web,'node_modules/@livekit/components-react/src/assets/icons/ScreenShareIcon.tsx').replaceAll(String.fromCharCode(92), '/')}';
export {ScreenShareIcon};
import ScreenShareStopIcon from '${path.join(web,'node_modules/@livekit/components-react/src/assets/icons/ScreenShareStopIcon.tsx').replaceAll(String.fromCharCode(92), '/')}';
export {ScreenShareStopIcon};
export const PdfPresentationViewer=()=>null;
const room={state:'connected',localParticipant:{identity:'local',sid:'local-sid',name:'Макс Соколов',isLocal:true,isCameraEnabled:true,isMicrophoneEnabled:false,trackPublications:new Map(),async unpublishTrack(){window.qaSetScreen(false)},getTrackPublication(source){return source==='screen_share'?window.qaPublication:undefined}},activeSpeakers:[],remoteParticipants:new Map(),on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return this},off(event,fn){listeners.get(event)?.delete(fn);return this}};
window.qaSetScreen=active=>{window.qaPublication=active?{trackSid:'qa-live-share',isMuted:false,track:{stop(){window.qaStopCalls=(window.qaStopCalls||0)+1;this.mediaStreamTrack.readyState='ended'},mediaStreamTrack:Object.assign(new EventTarget(),{readyState:'live'})}}:undefined;for(const fn of listeners.get(active?'localTrackPublished':'localTrackUnpublished')||[])fn(window.qaPublication||{source:'screen_share'})};
export const useI18n = () => ({locale:'ru',t:(value)=>value});
export const translateWorkspaceMessage = (_t,value) => value;
export const useRoomContext = () => room;
export const useEnsureTrackRef = value => value;
export const useTracks = sources => sources[0]?.source === 'camera' ? window.qaTracks : [];
export const useCreateLayoutContext = () => useMemo(()=>({}),[]);
export const usePinnedTracks = () => [];
export const LayoutContextProvider = ({children}) => children;
export const AudioTrack = () => null;
export const ControlBar = () => null;
export const ChatToggle = ({children,...props}) => <button {...props}>{children}</button>;
export const ParticipantTile = forwardRef(function Tile({trackRef},ref) {
 const video=React.useRef(null);
 useEffect(()=>{if(trackRef.participant.identity==='studio-panel-main')return;const canvas=document.createElement('canvas');canvas.width=trackRef.participant.isLocal?360:640;canvas.height=trackRef.participant.isLocal?640:360;const ctx=canvas.getContext('2d');ctx.fillStyle='#26352f';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.fillStyle='#acd9bb';ctx.fillRect(20,20,canvas.width-40,canvas.height-40);ctx.fillStyle='#354d42';ctx.font='24px sans-serif';ctx.fillText(trackRef.participant.isLocal?'Портрет 9:16':'Камера 16:9',35,70);const stream=canvas.captureStream(1);video.current.srcObject=stream;video.current.play().catch(()=>{});return()=>stream.getTracks().forEach(track=>track.stop())},[]);
 return <div ref={ref} className="lk-participant-tile" data-qa-identity={trackRef.participant.identity}>{trackRef.participant.identity==='studio-panel-main'?<div className="qa-muted-studio"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="23" r="15"/><path d="M10 78v-12a30 30 0 0160 0v12"/></svg></div>:<video muted autoPlay playsInline ref={video} data-qa-source={trackRef.source}/>}<span className="qa-source-name">{trackRef.participant.name}</span></div>
});
export const GuestCameraButton = () => <button className="lk-button">Camera</button>;
export const RoomChat = () => null;
export const isVerifiedTalkback = () => false;
export const exitCssFullscreen = () => {};
export const toggleElementFullscreen = () => {};
export const watchFullscreenChrome = () => () => {};
function App(){const [sceneControlsTarget,setSceneControlsTarget]=React.useState(null);const [profile,setProfile]=React.useState('speech');const [sharing,setSharing]=React.useState(false);window.qaSetSharing=setSharing;const [count,setCount]=React.useState(window.qaCount||2);window.qaSetCount=setCount;window.qaSpeak=identity=>{room.activeSpeakers=[{identity,isMicrophoneEnabled:true}];listeners.get('activeSpeakersChanged')?.forEach(fn=>fn())};
 window.qaTracks=[{source:'camera',participant:room.localParticipant},{source:'camera',participant:{identity:'studio-panel-main',sid:'studio-sid',name:'Основная студия',isLocal:false,metadata:'',isMicrophoneEnabled:false}},...Array.from({length:Math.max(0,count-2)},(_,index)=>({source:'camera',participant:{identity:'guest-'+index,sid:'sid-'+index,name:'Гость '+index,isLocal:false,metadata:'',isMicrophoneEnabled:true}}))].slice(0,count);
 if(sharing)window.qaTracks.unshift({source:'screen_share',participant:{identity:'guest-deck',sid:'deck',name:'Deck',isLocal:false,metadata:'',isMicrophoneEnabled:true}});
 return <main className="media-page guest-room-page guest-app-shell graphite-workspace caster-workspace"><div className="guest-main-column"><header className="guest-page-header"><div className="caster-room-heading"><div className="caster-brand"><BrandIcon className="studio-brand-mark"/><strong>CastLink</strong></div><h1>tester</h1></div><div className="guest-page-header-actions"><div className="caster-scene-controls" ref={setSceneControlsTarget}/><span className="caster-connection-status">Подключено</span><div className="guest-identity-pill"><span className="participant-dot self"/>Макс Соколов</div></div></header><div className="guest-conference-shell"><div className="guest-conference-grid"><RoomConference workspaceLayout sceneControlsTarget={sceneControlsTarget} studioOnly={false} onLeave={()=>{}} showLeaveButton={false} microphoneControl={<GuestMicrophoneButton room={room} choicesRef={{current:{}}} generation={{current:0}} disabled={false} onError={()=>{}}/>} cameraControl={<GuestCodecCameraButton room={room} choicesRef={{current:{}}} generation={{current:0}} disabled={false} onError={()=>{}}/>} transportControl={<CoPresentationPanel room={room} token="synthetic-token" studioId="qa" roomName="qa"/>} settingsControl={<GuestSettingsPanel><div className="panel guest-device-panel"><label>Микрофон<select><option>Встроенный микрофон телефона</option></select></label></div><GuestNoiseSuppressionControl profile={profile} state="pending" confirmed={false} disabled={false} busy={false} onChange={setProfile}/><section className="panel personal-monitor-panel"><h2>Собственный мониторинг</h2><p className="muted">Звук, видео и громкость меняются только для вас.</p></section></GuestSettingsPanel>}/></div></div></div>${entry ? '<AppFooterSlot/>' : ''}</main>
}
createRoot(document.getElementById('root')).render(${entry ? '<PathnameContext.Provider value="/"><AppChrome><App/></AppChrome></PathnameContext.Provider>' : '<App/>'});
`);
let browser;
(async()=>{
 await build({entryPoints:[fixture],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',nodePaths:[path.join(web,'node_modules')],alias:{'@':source},define:{'process.env':JSON.stringify({NODE_ENV:'production',NEXT_PUBLIC_BUILD_ID:'preview',NEXT_PUBLIC_PRODUCT_VERSION:'preview',NEXT_PUBLIC_BUILD_NUMBER:'preview'})},plugins:[{name:'deterministic-media',setup(builder){builder.onResolve({filter:/^@livekit\/components-react$|(?:^|\/)(I18nProvider|PdfPresentationViewer|GuestCameraButton|RoomChat)$|^@\/lib\/(?:i18n\/workspaces|fullscreen|fullscreen-chrome|talkback-policy)$/},args=>entry&&/(?:^|\/)I18nProvider$/.test(args.path)?undefined:({path:fixture}))}}]});
 const css=[req.resolve('@livekit/components-styles'),path.join(source,'app/globals.css'),path.join(source,'app/graphite-workspace.css'),path.join(out,'bundle.css')].map(file=>fs.readFileSync(file,'utf8')).join('\n')+'\n.qa-muted-studio{display:grid;place-items:center;width:100%;height:100%;background:var(--secondary-bg)}.qa-muted-studio svg{width:64px;height:64px;fill:var(--muted);stroke:none}.qa-source-name{position:absolute;bottom:4px;left:4px;max-width:calc(100% - 8px);padding:2px 4px;background:#0009;color:white;font-size:12px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
 browser=await chromium.launch({executablePath:'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 if(entry){await proveMobileEntry(browser,css);return;}
 const results=[],failures=[],errors=[];let checks=0;const check=(value,message,context)=>{checks++;if(!value)failures.push({message,...context})};
 const cases=process.env.CASTLINK_WINDOW_TABLET_CONFIRM==='1'?[[768,1024,3]]:process.env.CASTLINK_WINDOW_RED==='1'?[[393,730,2]]:[[393,730,1],[320,730,2],[393,730,2],[393,730,3],[393,730,12],[390,844,3],[873,393,3],[768,1024,3],[1440,900,2],[1440,900,3],[1440,900,12]];
 for(const [width,height,count] of cases)for(const theme of process.env.CASTLINK_WINDOW_RED==='1'?['dark']:['dark','light']){
  const context={width,height,count,theme},page=await browser.newPage({viewport:{width,height},isMobile:width<=700||height<=600,hasTouch:width<=700||height<=600});page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://window.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
  await page.route('https://window.test/icon.svg',route=>route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(source,'app/icon.svg'))}));
  await page.route('https://window.test/api/co-presentations',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({sessions:[]})}));
  await page.goto('https://window.test/');await page.evaluate(({theme,count})=>{document.documentElement.dataset.theme=theme;window.qaCount=count;Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:undefined,configurable:true})},{theme,count});
  await page.addStyleTag({content:css});await page.addScriptTag({content:fs.readFileSync(path.join(out,'bundle.js'),'utf8')});await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);await page.waitForTimeout(120);
  const scene=page.locator('[data-scene-mode]');
  await page.getByRole('button',{name:'Окно',exact:true}).click();await page.waitForTimeout(40);
  const measure=()=>scene.evaluate(scene=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};const main=scene.querySelector('[data-scene-primary]');return{primary:box(main),others:[...scene.querySelectorAll('[data-scene-source]')].filter(e=>e!==main).map(box),viewport:box(scene.querySelector('[tabindex="0"][aria-label]')),canvas:box(main.parentElement),portrait:scene.dataset.scenePortrait==='true',pageWidth:document.documentElement.scrollWidth,fit:getComputedStyle(main.querySelector('video')||main).objectFit}});
  const g=await measure();results.push({...context,...g});
  check(g.pageWidth<=width,'page has no horizontal overflow',context);
  if(g.portrait){check(Math.abs(g.primary.w/g.primary.h-16/9)<.01,'portrait Window main frame is16:9',context);check(g.others.every(r=>Math.abs(r.w/r.h-16/9)<.01&&r.w>=109&&r.h>=61),'portrait secondary frames retain readable16:9',context);}
  check(g.primary.y>=g.viewport.y-1&&g.primary.bottom<=g.viewport.bottom+1,'main frame fully visible inside stage',context);
  check(g.fit==='contain','portrait video is contained without cropping',context);
  const toolbar=await page.locator('.caster-action-toolbar').evaluate(e=>{const r=e.getBoundingClientRect();return{client:e.clientWidth,scroll:e.scrollWidth,box:{x:r.x,right:r.right,bottom:r.bottom},actions:[...e.querySelectorAll(':scope > .caster-toolbar-item > button,:scope > .guest-camera-control > button')].filter(e=>e.getBoundingClientRect().width).map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height,y:r.y,x:r.x,right:r.right}})}});
  check(toolbar.scroll<=toolbar.client+1&&toolbar.box.x>=0&&toolbar.box.right<=width+1&&toolbar.box.bottom<=height+1,'approved toolbar remains contained without scrolling',context);
  const toolbarTargets=await page.locator('.caster-action-toolbar').evaluate(e=>{const mobile=matchMedia('(max-width:700px), (max-height:600px) and (orientation:landscape)').matches;const selectors=['[data-lk-source="microphone"]','.guest-camera-control > .lk-track-toggle','.castlink-chat-toggle','.room-reactions-toggle','.guest-screen-share-button','.guest-settings-toggle','.caster-more-toggle','.caster-toolbar-exit'];return selectors.map(s=>({selector:s,button:e.querySelector(s)})).filter(({button:b})=>b?.getBoundingClientRect().width>0).map(({selector,button:b})=>{const r=b.getBoundingClientRect();return{selector,w:r.width,h:r.height,minimum:mobile?Math.min(44,(innerWidth-40)/8)-1:24,hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})});
  results.at(-1).toolbarTargets=toolbarTargets;
  check(toolbarTargets.every(r=>r.h>=44&&r.w>=r.minimum&&r.hit),'direct toolbar controls retain honest touch size and hit targets',context);
  await page.evaluate(()=>window.qaNodes=[...document.querySelectorAll('video')].map(node=>({node,stream:node.srcObject,track:node.srcObject.getVideoTracks()[0]})));
  if(count===12){const rail=await scene.evaluate(scene=>{const canvas=scene.querySelector('[data-scene-primary]').parentElement,view=canvas.parentElement,main=scene.querySelector('[data-scene-primary]'),portrait=scene.dataset.scenePortrait==='true',scroller=portrait?canvas:view,before=main.getBoundingClientRect();scroller.scrollLeft=scroller.scrollWidth;scroller.scrollTop=scroller.scrollHeight;const after=main.getBoundingClientRect();return{scroll:portrait?scroller.scrollLeft:scroller.scrollTop,stable:Math.abs(before.x-after.x)<1&&Math.abs(before.y-after.y)<1}});check(rail.scroll>0&&rail.stable,'long roster scrolls locally while primary stays fixed',context);await scene.evaluate(s=>{s.querySelector('[data-scene-primary]').parentElement.scrollLeft=0;s.querySelector('[data-scene-primary]').parentElement.parentElement.scrollTop=0});}
  await page.screenshot({path:path.join(out,`window-${theme}-${width}x${height}-${count}.png`)});
  await page.getByRole('button',{name:'Плитка',exact:true}).click();await page.waitForTimeout(40);
  const tiles=await scene.locator('[data-scene-source]').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{w:r.width,h:r.height}}));check(tiles.every(r=>Math.abs(r.w/r.h-16/9)<.01),'Tiles retains proportional frames',context);
  await page.getByRole('button',{name:'Окно',exact:true}).click();await page.waitForTimeout(40);
  if(width===393&&count===3&&theme==='dark'){await page.evaluate(()=>window.qaSpeak('guest-0'));await page.waitForFunction(()=>document.querySelector('[data-scene-primary] [data-qa-identity="guest-0"]'));check(true,'sustained active speaker retains automatic primary selection',context);}
  if(count>1)await scene.locator('[data-scene-pin^="studio-panel-main:"]').click();await page.waitForTimeout(40);if(count>1)check(await scene.locator('[data-scene-primary] [data-qa-identity="studio-panel-main"]').count()===1,'pin changes primary without changing source ownership',context);
  if(count>1)await scene.locator('[data-scene-pin^="studio-panel-main:"]').click();await page.evaluate(()=>window.qaSetSharing(true));await page.waitForTimeout(80);check(await scene.locator('[data-scene-primary][data-scene-source="screen"]').count()===1,'shared content retains priority after clearing pin',context);
  if(width===393&&count===2){await page.setViewportSize({width:873,height:393});await page.waitForTimeout(70);await page.setViewportSize({width,height});await page.waitForTimeout(70);check((await measure()).portrait,'orientation restores portrait layout',context);}
  check(await page.evaluate(()=>window.qaNodes.every(({node,stream,track})=>node.isConnected&&node.srcObject===stream&&track.readyState==='live')),'mode pin and orientation retain every mounted live node and track',context);
  await page.close();
 }
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,results,failures,errors},null,2));console.log(JSON.stringify({out,checks,failures,errors},null,2));assert.equal(failures.length,0,'Window proportions regression');assert.equal(errors.length,0,'browser errors');
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>browser?.close());

/** Actual AppChrome footer plus real conference/transport; only media/SFU leaves are local. */
async function proveMobileEntry(browser,css){
 const results=[],failures=[],errors=[];let checks=0;const check=(value,message,context)=>{checks++;if(!value)failures.push({message,...context})};
 const cases=process.env.CASTLINK_MOBILE_ENTRY_RED==='1'?[[393,730,2]]:[[320,600,3],[393,730,2],[393,540,3],[390,844,12],[873,393,3],[1440,900,3]];
 for(const [width,height,count]of cases)for(const theme of process.env.CASTLINK_MOBILE_ENTRY_RED==='1'?['dark']:['dark','light']){
  const mobile=width<=700||height<=600,context={width,height,count,theme,mobile},page=await browser.newPage({viewport:{width,height},isMobile:mobile,hasTouch:mobile});page.on('pageerror',e=>errors.push(e.message));
  await page.route('https://window.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
  await page.route('https://window.test/icon.svg',route=>route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(source,'app/icon.svg'))}));
  await page.route('https://window.test/api/**',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({sessions:[],buildId:'preview',productVersion:'preview',buildNumber:'preview'})}));
  await page.route('https://window.test/new/**',route=>{const file=path.join(web,'../../design-preview',new URL(route.request().url()).pathname);return fs.existsSync(file)?route.fulfill({contentType:file.endsWith('.woff2')?'font/woff2':'text/css',body:fs.readFileSync(file)}):route.fulfill({status:404,body:''})});
  const mount=async(seed=false)=>{
   await page.goto('https://window.test/');await page.evaluate(({theme,count,seed})=>{window.qaCount=count;localStorage.setItem('studiolink-theme',theme);if(seed)localStorage.setItem('castlink.conference-scene.v1',JSON.stringify({mode:'speaker',automatic:true,split:.88,railVersion:2}));Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:undefined,configurable:true})},{theme,count,seed});
   await page.addStyleTag({content:css});await page.addScriptTag({content:fs.readFileSync(path.join(out,'bundle.js'),'utf8')});await page.waitForSelector('.workspace-footer .theme-toggle');await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);await page.waitForTimeout(120);
  };
  await mount(true);
  const scene=page.locator('[data-scene-mode]');
  const storedMode=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('castlink.conference-scene.v1')).mode);
  check(await scene.getAttribute('data-scene-mode')===(mobile?'tiles':'speaker'),'fresh phone entry starts Tiles despite saved Window; desktop restores Window',context);
  check(await storedMode()==='speaker','entry does not overwrite saved desktop mode',context);
  check(await scene.locator('[data-scene-source]').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&Math.abs(r.width/r.height-16/9)<.01||e.hasAttribute('data-scene-primary')})),'approved frame proportions remain intact at entry',context);
  const bounds=await page.evaluate(()=>{const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return{main:box(document.querySelector('.guest-main-column')),scene:box(document.querySelector('[data-scene-mode]')),toolbar:box(document.querySelector('.caster-action-toolbar')),footer:box(document.querySelector('.workspace-footer-slot')),pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight}});results.push({...context,...bounds});
  check(bounds.main.bottom<=height+1&&bounds.toolbar.bottom<=height+1&&bounds.toolbar.y>=0,'header scene and approved transport fit first usable viewport',context);
  check(bounds.footer.y>=height-1,'actual AppChrome service footer begins below first viewport',context);
  check(bounds.pageWidth<=width&&bounds.pageHeight>height,'footer is reachable through vertical page scrolling without horizontal overflow',context);
  const targets=await page.locator('.caster-action-toolbar').evaluate(e=>{const names=['[data-lk-source="microphone"]','.guest-camera-control > .lk-track-toggle','.castlink-chat-toggle','.room-reactions-toggle','.guest-screen-share-button','.guest-settings-toggle','.caster-more-toggle','.caster-toolbar-exit'];return names.map(s=>e.querySelector(s)).filter(b=>b?.getBoundingClientRect().width).map(b=>{const r=b.getBoundingClientRect();return{w:r.width,h:r.height,y:r.y,hit:b.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}})});
  check(targets.length===(mobile?8:7)&&targets.every(r=>r.h>=44&&r.w>=(mobile?Math.min(44,(width-40)/8)-1:24)&&r.hit)&&new Set(targets.map(r=>r.y)).size===1,'all direct toolbar actions remain in one usable row',context);
  await page.evaluate(()=>window.qaEntryMedia=[...document.querySelectorAll('video')].map(node=>({node,stream:node.srcObject,track:node.srcObject.getVideoTracks()[0]})));
  const unchanged=()=>page.evaluate(()=>window.qaEntryMedia.every(({node,stream,track})=>node.isConnected&&node.srcObject===stream&&track.readyState==='live'));
  if(mobile&&count===12){const rail=await scene.evaluate(s=>{const view=s.querySelector('[tabindex="0"][aria-label]'),toolbar=document.querySelector('.caster-action-toolbar'),before=toolbar.getBoundingClientRect().y;view.scrollTop=view.scrollHeight;return{scroll:view.scrollTop,stable:Math.abs(toolbar.getBoundingClientRect().y-before)<1}});check(rail.scroll>0&&rail.stable,'long Tiles roster scrolls locally while transport stays in place',context);await scene.evaluate(s=>s.querySelector('[tabindex="0"][aria-label]').scrollTop=0);}
  await page.screenshot({path:path.join(out,`entry-${theme}-${width}x${height}.png`)});
  await page.locator('.workspace-footer').scrollIntoViewIfNeeded();
  check(await page.locator('.workspace-footer .theme-toggle').evaluate(e=>{const r=e.getBoundingClientRect();return r.y>=0&&r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'real footer theme control is visible and hit-testable after scroll',context);
  check(await page.locator('.workspace-footer .bug-report-link').isVisible()&&await page.locator('.workspace-footer .app-version-row').isVisible(),'real version and report controls remain reachable',context);
  await page.locator('.workspace-footer .theme-toggle').click();check(await page.evaluate(expected=>document.documentElement.dataset.theme===expected,theme==='dark'?'light':'dark'),'actual below-fold theme action still works',context);await page.locator('.workspace-footer .theme-toggle').click();
  await page.screenshot({path:path.join(out,`footer-${theme}-${width}x${height}.png`)});await page.evaluate(()=>window.scrollTo(0,0));
  if(mobile){
   await page.getByRole('button',{name:'Окно',exact:true}).click();await page.evaluate(count=>window.qaSetCount(count+1),count);await page.waitForTimeout(40);await page.evaluate(count=>window.qaSetCount(count),count);await page.waitForTimeout(40);
   await page.setViewportSize({width:mobile&&width<height?873:393,height:mobile&&width<height?393:730});await page.waitForTimeout(60);await page.setViewportSize({width,height});await page.waitForTimeout(60);
   check(await scene.getAttribute('data-scene-mode')==='speaker','explicit Window remains throughout current visit across rerender and orientation',context);
   check(await storedMode()==='speaker','mobile session choice leaves desktop preference intact',context);
   if(count>1){await scene.locator('[data-scene-pin^="studio-panel-main:"]').click();await page.waitForFunction(()=>!!document.querySelector('[data-scene-primary] [data-qa-identity="studio-panel-main"]'));check(await scene.locator('[data-scene-primary] [data-qa-identity="studio-panel-main"]').count()===1,'pin retains its action after entry/orientation changes',context);}
   check(await unchanged(),'footer scroll mode and orientation preserve every mounted live stream',context);
   await mount(false);check(await scene.getAttribute('data-scene-mode')==='tiles','next mobile visit always returns to Tiles',context);
  }else{
   await page.getByRole('button',{name:'Плитка',exact:true}).click();await page.waitForTimeout(30);check(await storedMode()==='tiles','desktop explicit choice still persists',context);check(await unchanged(),'desktop mode switch retains media owners',context);await mount(false);check(await scene.getAttribute('data-scene-mode')==='tiles','desktop saved Tiles restores normally',context);
  }
  await page.close();
 }
 fs.writeFileSync(path.join(out,'entry-results.json'),JSON.stringify({checks,results,failures,errors},null,2));console.log(JSON.stringify({out,checks,failures,errors},null,2));assert.equal(failures.length,0,'mobile entry regression');assert.equal(errors.length,0,'browser errors');
}
