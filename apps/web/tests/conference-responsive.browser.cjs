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
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-conference-responsive-'));
const fixture = path.join(out, 'fixture.tsx');
fs.writeFileSync(fixture, `
import React, {useEffect, useMemo, forwardRef} from 'react';
import {createRoot} from 'react-dom/client';
import {RoomConference} from '${path.join(source, 'components/RoomConference.tsx').replaceAll(String.fromCharCode(92), '/')}';
import {CoPresentationPanel} from '${path.join(source, 'components/CoPresentationPanel.tsx').replaceAll(String.fromCharCode(92), '/')}';
export const Track = {Source:{Camera:'camera',ScreenShare:'screen_share',Microphone:'microphone',ScreenShareAudio:'screen_share_audio',Unknown:'unknown'},Kind:{Audio:'audio'}};
export const RoomEvent = {ActiveSpeakersChanged:'speakers',ParticipantDisconnected:'disconnected',ParticipantMetadataChanged:'metadata',ParticipantConnected:'joined',TrackSubscribed:'subscribed'};
const listeners=new Map();
export const LocalVideoTrack=class {};
import ScreenShareIcon from '${path.join(web,'node_modules/@livekit/components-react/src/assets/icons/ScreenShareIcon.tsx').replaceAll(String.fromCharCode(92), '/')}';
export {ScreenShareIcon};
import ScreenShareStopIcon from '${path.join(web,'node_modules/@livekit/components-react/src/assets/icons/ScreenShareStopIcon.tsx').replaceAll(String.fromCharCode(92), '/')}';
export {ScreenShareStopIcon};
export const PdfPresentationViewer=()=>null;
const room={state:'connected',localParticipant:{identity:'local',sid:'local-sid',name:'QA',trackPublications:new Map(),getTrackPublication(source){return source==='screen_share'?window.qaPublication:undefined}},activeSpeakers:[],remoteParticipants:new Map(),on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return this},off(event,fn){listeners.get(event)?.delete(fn);return this}};
window.qaSetScreen=active=>{window.qaPublication=active?{isMuted:false,track:{mediaStreamTrack:Object.assign(new EventTarget(),{readyState:'live'})}}:undefined;for(const handlers of listeners.values())for(const fn of handlers)fn()};
export const useI18n = () => ({locale:'en',t:(value)=>value});
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
 useEffect(()=>{const canvas=document.createElement('canvas');canvas.width=trackRef.source==='camera'?640:900;canvas.height=trackRef.source==='camera'?480:1200;const ctx=canvas.getContext('2d');ctx.fillStyle='#658779';ctx.fillRect(0,0,canvas.width,canvas.height);const stream=canvas.captureStream(1);video.current.srcObject=stream;video.current.play().catch(()=>{});return()=>stream.getTracks().forEach(track=>track.stop())},[]);
 return <div ref={ref} className="lk-participant-tile"><video muted autoPlay playsInline ref={video} data-qa-source={trackRef.source}/></div>
});
export const GuestCameraButton = () => <button className="lk-button">Camera</button>;
export const RoomChat = () => null;
export const isVerifiedTalkback = () => false;
export const exitCssFullscreen = () => {};
export const toggleElementFullscreen = () => {};
export const watchFullscreenChrome = () => () => {};
function App(){const [sharing,setSharing]=React.useState(true);window.qaSetSharing=setSharing;
 window.qaTracks=Array.from({length:window.qaCount||8},(_,index)=>({source:'camera',participant:{identity:'guest-'+index,sid:'sid-'+index,name:'Guest '+index,isLocal:false,metadata:'',isMicrophoneEnabled:true}}));
 if(sharing)window.qaTracks.unshift({source:'screen_share',participant:{identity:'guest-deck',sid:'deck',name:'Deck',isLocal:false,metadata:'',isMicrophoneEnabled:true}});
 return <main className="media-page guest-room-page guest-app-shell graphite-workspace caster-workspace"><div className="guest-main-column"><header className="guest-page-header"><h1>Conference layout fixture</h1></header><div className="guest-conference-shell"><div className="guest-conference-grid"><RoomConference workspaceLayout studioOnly={false} onLeave={()=>{}} showLeaveButton={false} microphoneControl={<button className="lk-button">Mic</button>} cameraControl={<button className="lk-button">Camera</button>} transportControl={<CoPresentationPanel room={room} token="synthetic-token" studioId="qa" roomName="qa"/>} settingsControl={<button className="guest-settings-toggle">Settings</button>}/></div></div></div></main>
}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser;
(async () => {
  await build({entryPoints:[fixture],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',nodePaths:[path.join(web,'node_modules')],alias:{'@':source},plugins:[{name:'deterministic-media',setup(builder){
    const overrides = /^(livekit-client|@livekit\/components-react)$|(?:^|\/)(I18nProvider|PdfPresentationViewer|GuestCameraButton|RoomChat)$|^@\/lib\/(?:i18n\/workspaces|fullscreen|fullscreen-chrome|talkback-policy)$/;
    builder.onResolve({filter:overrides}, args => ({path:fixture}));
  }}]});
  const css = [path.join(web,'node_modules/@livekit/components-styles/dist/general/index.css'),path.join(source,'app/globals.css'),path.join(source,'app/graphite-workspace.css'),path.join(out,'bundle.css')].map(file=>fs.readFileSync(file,'utf8')).join('\n');
  browser = await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium',headless:true,ignoreDefaultArgs:['--hide-scrollbars'],args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,XDG_CACHE_HOME:path.join(out,'cache'),XDG_CONFIG_HOME:path.join(out,'config')}});
  const results = [], failures = []; let checks=0;
  for (const theme of ['dark','light']) for (const [width,height,count] of [[390,844,8],[844,390,8],[1440,900,1],[1440,900,2],[1440,900,8],[1440,900,24]]) {
    const mobile = width<701 || height<=600;
    const page = await browser.newPage({viewport:{width,height},hasTouch:mobile,isMobile:mobile}), errors=[];
    page.setDefaultTimeout(10000);
    page.on('pageerror', error=>{errors.push(error.message);console.error('BROWSER',error.message)});
    await page.route('https://conference.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
    await page.route('https://conference.test/api/co-presentations',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({sessions:[]})}));
    await page.goto('https://conference.test/');
    await page.evaluate(({theme,count})=>{document.documentElement.dataset.theme=theme;window.qaCount=count;window.qaDisplayCaptureCalls=0;Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:async()=>{window.qaDisplayCaptureCalls++;throw Error('Physical capture prohibited')}})}, {theme,count});
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:fs.readFileSync(path.join(out,'bundle.js'),'utf8')});
    await page.waitForSelector('[data-scene-mode]');
    await page.waitForFunction(()=>document.querySelector('video')?.videoWidth>0);
    await page.waitForTimeout(150);
    const state = await page.evaluate(() => {
      const scene=document.querySelector('[data-scene-mode]'),viewport=scene.querySelector('[tabindex="0"][aria-label]'),primary=scene.querySelector('[data-scene-primary]');
      const box=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
      const primaryBox=box(primary),other=[...scene.querySelectorAll('[data-scene-source]')].filter(e=>!e.hasAttribute('data-scene-primary'));
      window.qaCameraNode=other[0].querySelector('video');
      const scrolling=getComputedStyle(viewport);
      return {viewport:box(viewport),scrollHeight:viewport.scrollHeight,clientHeight:viewport.clientHeight,scrollWidth:viewport.scrollWidth,clientWidth:viewport.clientWidth,overflowY:scrolling.overflowY,overflowX:scrolling.overflowX,primary:primaryBox,others:other.map(box),separators:scene.querySelectorAll('[role="separator"]').length,share:box(document.querySelector('.guest-screen-share-button')),controls:box(document.querySelector('.co-presentation-trigger'))};
    });
    const check=(condition,message)=>{checks++;if(!condition)failures.push({theme,width,height,count,message})};
    if(mobile) check(state.scrollHeight<=state.clientHeight+1,'mobile participant count must not grow the stage vertically');
    check(state.primary.y>=state.viewport.y-1&&state.primary.bottom<=state.viewport.bottom+1,'main source stays inside viewport');
    const rail=await page.locator('[data-scene-mode]').evaluate(scene=>{
      const view=scene.querySelector('[tabindex="0"][aria-label]'),canvas=view.firstElementChild,main=canvas.querySelector('[data-scene-primary]'),portrait=scene.dataset.scenePortrait==='true';
      const others=[...canvas.querySelectorAll('[data-scene-source]')].filter(e=>e!==main),last=others.at(-1),first=others[0];
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
      const before=box(main),firstBefore=box(first);const scroller=canvas.scrollHeight>canvas.clientHeight+1||canvas.scrollWidth>canvas.clientWidth+1?canvas:view;scroller.scrollLeft=scroller.scrollWidth;scroller.scrollTop=scroller.scrollHeight;
      return {portrait,before,after:box(main),firstBefore,firstAfter:box(first),last:box(last),canvas:box(canvas),scroll:portrait?scroller.scrollLeft:scroller.scrollTop,minSize:Math.min(...others.map(e=>portrait?e.getBoundingClientRect().width:e.getBoundingClientRect().height))};
    });
    if(mobile||count===24) check(rail.scroll>0,'many participants scroll inside their rail');
    check(Math.abs(rail.before.x-rail.after.x)<1&&Math.abs(rail.before.y-rail.after.y)<1,'scrolling participant rail keeps the main source fixed');
    if(mobile||count===24) check(rail.portrait?rail.firstAfter.x<rail.firstBefore.x-1:rail.firstAfter.y<rail.firstBefore.y-1,'participant rail moves during scroll');
    check(rail.minSize>=(rail.portrait?109:89),'participant thumbnails remain readable');
    if(mobile||count===24) check(rail.portrait?rail.last.right<=rail.canvas.right+1:rail.last.bottom<=rail.canvas.bottom+1,'last participant remains reachable');
    if(!mobile){
      check(state.overflowY==='scroll','desktop keeps the vertical scroll track visible even when the participant rail fits');
      check(state.overflowX==='hidden'&&state.scrollWidth<=state.clientWidth+1,'desktop has no horizontal scene scrolling');
      const wrapper=state.others[0];
      check(Math.abs(wrapper.w/wrapper.h-16/9)<.01,'desktop participant wrapper keeps16:9 for every roster count');
      const previous=results.find(r=>r.theme===theme&&r.width===width&&r.height===height);
      if(previous)check(Math.abs(wrapper.w-previous.others[0].w)<1&&Math.abs(wrapper.h-previous.others[0].h)<1,'desktop wrapper size independent of roster count');
    }
    const checkColors=async()=>{
      const actual=await page.locator('.guest-screen-share-button').evaluate(button=>({screen:getComputedStyle(button).backgroundColor,presentation:getComputedStyle(document.querySelector('.co-presentation-trigger')).backgroundColor,touch:button.getBoundingClientRect().height}));
      check(actual.screen==='rgb(172, 217, 187)','real idle/active ScreenShareButton has approved mint');
      check(actual.presentation==='rgb(184, 212, 244)','real CoPresentationPanel trigger has approved blue');
      if(mobile)check(actual.touch>=44,'mobile real screen-share action has44px touch height');
      return actual;
    };
    if(mobile) {
      check(state.separators===0,'phone portrait and landscape must have no resize separator');
      await page.locator('.conference-more-toggle, .conference-more-actions > summary').click();
      const menuVisible=await page.locator('.guest-screen-share-button').evaluate(button=>{const r=button.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return hit===button||button.contains(hit)});
      check(menuVisible,'phone More menu actions are visible above the footer');
      await checkColors();await page.evaluate(()=>window.qaSetScreen(true));await page.waitForTimeout(30);check(await page.locator('.guest-screen-share-button').getAttribute('aria-pressed')==='true','real screen-share button enters active state');await checkColors();await page.evaluate(()=>window.qaSetScreen(false));await page.waitForTimeout(30);check(await page.locator('.guest-screen-share-button').getAttribute('aria-pressed')==='false','real screen-share button returns to idle');
      await page.screenshot({path:path.join(out,'menu-'+theme+'-'+width+'.png')});
      await page.keyboard.press('Escape');
    }
    else {
      check(state.separators===1,'desktop sharing exposes one resize separator');
      check(state.others.every(b=>b.x>=state.primary.right-1),'desktop participant strip stays on the right');
      check(Math.abs(state.share.y+state.share.h/2-state.controls.y-state.controls.h/2)<=2,'desktop screen share and controls stay on one line');
      await checkColors();await page.evaluate(()=>window.qaSetScreen(true));await page.waitForTimeout(30);check(await page.locator('.guest-screen-share-button').getAttribute('aria-pressed')==='true','real screen-share button enters active state');await checkColors();await page.evaluate(()=>window.qaSetScreen(false));await page.waitForTimeout(30);check(await page.locator('.guest-screen-share-button').getAttribute('aria-pressed')==='false','real screen-share button returns to idle');
      await page.locator('.co-presentation-trigger').click();await page.waitForTimeout(50);
      const panel=page.locator('.co-presentation-popover');check(await panel.isVisible(),'real CoPresentationPanel idle popover opens');
      const panelBox=await panel.boundingBox();check(panelBox.x>=0&&panelBox.y>=0&&panelBox.x+panelBox.width<=width+1&&panelBox.y+panelBox.height<=height+1,'real presentation popover stays inside viewport');
      await page.screenshot({path:path.join(out,'presentation-'+theme+'-'+count+'.png')});
      await page.keyboard.press('Escape');
      const separator=page.getByRole('separator');
      await separator.focus();await page.keyboard.press('ArrowLeft');await page.waitForTimeout(80);
      const after=await page.locator('[data-scene-primary]').boundingBox();
      check(after.width<state.primary.w-1,'keyboard resize changes source allocation');
      const bounds=await separator.boundingBox();
      await page.mouse.move(bounds.x+bounds.width/2,bounds.y+bounds.height/2);await page.mouse.down();await page.mouse.move(bounds.x-50,bounds.y+bounds.height/2);await page.mouse.up();
      await page.waitForTimeout(80);
      const geometry=await page.locator('[data-scene-primary] video').evaluate(video=>{const r=video.getBoundingClientRect(),p=video.closest('[data-scene-source]').getBoundingClientRect(),s=getComputedStyle(video);return {w:r.width,h:r.height,x:r.x,y:r.y,right:r.right,bottom:r.bottom,parent:{x:p.x,y:p.y,right:p.right,bottom:p.bottom},fit:s.objectFit}});
      check(geometry.fit==='contain','source pixels retain proportions through containment');
      check(geometry.x>=geometry.parent.x-1&&geometry.y>=geometry.parent.y-1&&geometry.right<=geometry.parent.right+1&&geometry.bottom<=geometry.parent.bottom+1,'resized source fits its frame');
    }
    await page.screenshot({path:path.join(out,`conference-${theme}-${width}x${height}-${count}-sharing.png`)});
    await page.getByRole('button',{name:'Tiles',exact:true}).click();
    await page.waitForTimeout(80);
    const tiles=await page.locator('[data-scene-mode]').evaluate(scene=>{const view=scene.querySelector('[tabindex="0"][aria-label]');return {mode:scene.dataset.sceneMode,scroll:view.scrollHeight,height:view.clientHeight,sameVideo:window.qaCameraNode.isConnected}});
    check(tiles.mode==='tiles'&&tiles.scroll<=tiles.height+1&&tiles.sameVideo,'Tiles fits the viewport and preserves media nodes');
    await page.getByRole('button',{name:/^(Windows|Speaker)$/,exact:true}).click();
    await page.waitForTimeout(80);
    // Switching presentation state must preserve camera elements/attached streams.
    await page.evaluate(()=>window.qaSetSharing(false));await page.waitForTimeout(100);
    check(await page.getByRole('separator').count()===0,'camera-only windows have no resize separator');
    check(await page.evaluate(()=>window.qaCameraNode.isConnected&&window.qaCameraNode.srcObject?.getVideoTracks()[0]?.readyState==='live'),'camera remains mounted when sharing stops');
    const cameraFit=await page.locator('[data-scene-primary] video').evaluate(video=>{const r=video.getBoundingClientRect();return {ratio:r.width/r.height,decoded:video.videoWidth/video.videoHeight}});
    check(Math.abs(cameraFit.ratio-cameraFit.decoded)<.01,'decoded camera aspect ratio survives focus and mode changes');
    if(!mobile&&count===2) {
      for(const [resizeWidth,resizeHeight] of [[1280,800],[1200,900],[1024,768]]) {
        await page.setViewportSize({width:resizeWidth,height:resizeHeight});await page.waitForTimeout(100);
        const resized=await page.locator('[data-scene-mode]').evaluate(scene=>{
          const view=scene.querySelector('[tabindex="0"][aria-label]'),main=scene.querySelector('[data-scene-primary]'),video=main.querySelector('video');
          const p=main.getBoundingClientRect(),v=video.getBoundingClientRect(),s=view.getBoundingClientRect();
          return {ratio:v.width/v.height,decoded:video.videoWidth/video.videoHeight,contained:v.x>=p.x-1&&v.y>=p.y-1&&v.right<=p.right+1&&v.bottom<=p.bottom+1,mainVisible:p.x>=s.x-1&&p.y>=s.y-1&&p.right<=s.right+1&&p.bottom<=s.bottom+1,horizontal:view.scrollWidth>view.clientWidth+1,sameVideo:window.qaCameraNode.isConnected};
        });
        check(resized.contained&&Math.abs(resized.ratio-resized.decoded)<.01,'main camera scales proportionally at '+resizeWidth+'x'+resizeHeight);
        check(resized.mainVisible&&!resized.horizontal&&resized.sameVideo,'window resize keeps main visible, horizontal scrolling absent and media mounted');
        await page.screenshot({path:path.join(out,`conference-${theme}-${resizeWidth}x${resizeHeight}-2-resized.png`)});
      }
      await page.setViewportSize({width,height});await page.waitForTimeout(100);
    }
    check(errors.length===0,'React render has no browser errors: '+errors.join('; '));
    await page.screenshot({path:path.join(out,`conference-${theme}-${width}x${height}-${count}.png`)});
    check(await page.evaluate(()=>window.qaDisplayCaptureCalls===0),'no physical screen capture launched');results.push({theme,count,width,height,mobile,...state,rail,errors});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({results,failures,checks},null,2));
  console.log(JSON.stringify({out,failures,cases:results.length,checks}));
  assert.deepEqual(failures,[],'responsive conference geometry and controls');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
