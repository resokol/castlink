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
const out = process.env.CASTLINK_MOBILE_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-current-mobile-'));
fs.mkdirSync(out,{recursive:true});
const fixture = path.join(out, 'fixture.tsx');
fs.writeFileSync(fixture, `
import React, {useEffect, useMemo, forwardRef} from 'react';
import {createRoot} from 'react-dom/client';
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
const room={state:'connected',localParticipant:{identity:'local',sid:'local-sid',name:'QA',isCameraEnabled:false,isMicrophoneEnabled:false,trackPublications:new Map(),async unpublishTrack(){window.qaSetScreen(false)},getTrackPublication(source){return source==='screen_share'?window.qaPublication:undefined}},activeSpeakers:[],remoteParticipants:new Map(),on(event,fn){if(!listeners.has(event))listeners.set(event,new Set());listeners.get(event).add(fn);return this},off(event,fn){listeners.get(event)?.delete(fn);return this}};
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
 useEffect(()=>{const canvas=document.createElement('canvas');canvas.width=trackRef.source==='camera'?640:900;canvas.height=trackRef.source==='camera'?480:1200;const ctx=canvas.getContext('2d');ctx.fillStyle='#658779';ctx.fillRect(0,0,canvas.width,canvas.height);const stream=canvas.captureStream(1);video.current.srcObject=stream;video.current.play().catch(()=>{});return()=>stream.getTracks().forEach(track=>track.stop())},[]);
 return <div ref={ref} className="lk-participant-tile"><video muted autoPlay playsInline ref={video} data-qa-source={trackRef.source}/></div>
});
export const GuestCameraButton = () => <button className="lk-button">Camera</button>;
export const RoomChat = () => null;
export const isVerifiedTalkback = () => false;
export const exitCssFullscreen = () => {};
export const toggleElementFullscreen = () => {};
export const watchFullscreenChrome = () => () => {};
function App(){const [sceneControlsTarget,setSceneControlsTarget]=React.useState(null);const [profile,setProfile]=React.useState('speech');const [sharing,setSharing]=React.useState(true);window.qaSetSharing=setSharing;
 window.qaTracks=Array.from({length:window.qaCount||8},(_,index)=>({source:'camera',participant:{identity:'guest-'+index,sid:'sid-'+index,name:'Guest '+index,isLocal:false,metadata:'',isMicrophoneEnabled:true}}));
 if(sharing)window.qaTracks.unshift({source:'screen_share',participant:{identity:'guest-deck',sid:'deck',name:'Deck',isLocal:false,metadata:'',isMicrophoneEnabled:true}});
 return <main className="media-page guest-room-page guest-app-shell graphite-workspace caster-workspace"><div className="guest-main-column"><header className="guest-page-header"><div className="caster-room-heading"><div className="caster-brand"><BrandIcon className="studio-brand-mark"/><strong>CastLink</strong></div><h1>Эфир со зрителями</h1></div><div className="guest-page-header-actions"><div className="caster-scene-controls" ref={setSceneControlsTarget}/><span className="caster-connection-status">Подключено</span><div className="guest-identity-pill"><span className="participant-dot self"/>Александр — длинное имя</div></div></header><div className="guest-conference-shell"><div className="guest-conference-grid"><RoomConference workspaceLayout sceneControlsTarget={sceneControlsTarget} studioOnly={false} onLeave={()=>{}} showLeaveButton={false} microphoneControl={<GuestMicrophoneButton room={room} choicesRef={{current:{}}} generation={{current:0}} disabled={false} onError={()=>{}}/>} cameraControl={<GuestCodecCameraButton room={room} choicesRef={{current:{}}} generation={{current:0}} disabled={false} onError={()=>{}}/>} transportControl={<CoPresentationPanel room={room} token="synthetic-token" studioId="qa" roomName="qa"/>} settingsControl={<GuestSettingsPanel><div className="panel guest-device-panel"><label>Микрофон<select><option>Встроенный микрофон телефона</option></select></label></div><GuestNoiseSuppressionControl profile={profile} state="pending" confirmed={false} disabled={false} busy={false} onChange={setProfile}/><section className="panel personal-monitor-panel"><h2>Собственный мониторинг</h2><p className="muted">Звук, видео и громкость меняются только для вас.</p></section></GuestSettingsPanel>}/></div></div></div></main>
}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser;
(async () => {
  await build({entryPoints:[fixture],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',nodePaths:[path.join(web,'node_modules')],alias:{'@':source},plugins:[{name:'deterministic-media',setup(builder){
    const overrides = /^(@livekit\/components-react)$|(?:^|\/)(I18nProvider|PdfPresentationViewer|GuestCameraButton|RoomChat)$|^@\/lib\/(?:i18n\/workspaces|fullscreen|fullscreen-chrome|talkback-policy)$/;
    builder.onResolve({filter:overrides}, args => ({path:fixture}));
  }}]});
  const css = [path.join(web,'node_modules/@livekit/components-styles/dist/general/index.css'),path.join(source,'app/globals.css'),path.join(source,'app/graphite-workspace.css'),path.join(out,'bundle.css')].map(file=>fs.readFileSync(file,'utf8')).join('\n');
  browser = await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium',headless:true,ignoreDefaultArgs:['--hide-scrollbars'],args:['--no-sandbox','--disable-dev-shm-usage'],env:{...process.env,XDG_CACHE_HOME:path.join(out,'cache'),XDG_CONFIG_HOME:path.join(out,'config')}});
  const results = [], failures = []; let checks=0;
  for (const theme of ['dark','light']) for (const [width,height,count] of [[320,568,8],[393,873,8],[873,393,8],[1440,900,8]]) {
    const mobile = width<701 || height<=600;
    const page = await browser.newPage({viewport:{width,height},hasTouch:mobile,isMobile:mobile}), errors=[];
    page.on('pageerror', error=>errors.push(error.message));
    await page.route('https://conference.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
    await page.route('https://conference.test/icon.svg',route=>route.fulfill({contentType:'image/svg+xml',body:fs.readFileSync(path.join(source,'app/icon.svg'))}));
    await page.route('https://conference.test/api/co-presentations',route=>route.fulfill({contentType:'application/json',body:JSON.stringify({sessions:[]})}));
    await page.goto('https://conference.test/');
    await page.evaluate(({theme,count})=>{document.documentElement.dataset.theme=theme;window.qaCount=count;Object.defineProperty(navigator.mediaDevices,'getDisplayMedia',{value:undefined,configurable:true})}, {theme,count});
    await page.addStyleTag({content:css});
    await page.addScriptTag({content:fs.readFileSync(path.join(out,'bundle.js'),'utf8')});
    await page.waitForSelector('[data-scene-mode]');
    await page.waitForTimeout(180);
    const check=(condition,message)=>{checks++;if(!condition)failures.push({theme,width,height,message})};
    const geometry=await page.evaluate(()=>{
      const box=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};
      const selectors=matchMedia('(max-width:700px), (max-height:600px) and (orientation:landscape)').matches?['[data-lk-source="microphone"]','.guest-camera-control > .lk-track-toggle','.castlink-chat-toggle','.room-reactions-toggle','.guest-screen-share-button','.guest-settings-toggle','.caster-more-toggle','.caster-toolbar-exit']:['[data-lk-source="microphone"]','.guest-camera-control > .lk-track-toggle','.guest-camera-effects-toggle','.castlink-chat-toggle','button[aria-label="Реакции"]','.guest-screen-share-button','.native-pptx-prepare','.caster-toolbar-exit','.guest-settings-toggle'];
      return {width:document.documentElement.scrollWidth,height:document.documentElement.scrollHeight,footer:box(document.querySelector('.castlink-conference-footer')),buttons:selectors.map(selector=>({selector,...box(document.querySelector(selector))})),scene:box(document.querySelector('[data-scene-mode]')),separators:document.querySelectorAll('[role="separator"]').length,headerControls:[...document.querySelectorAll('.caster-scene-controls button,.caster-scene-controls summary')].map(box),toolbar:box(document.querySelector('.caster-action-toolbar')),toolbarScroll:{width:document.querySelector('.caster-action-toolbar').clientWidth,total:document.querySelector('.caster-action-toolbar').scrollWidth},unavailable:box(document.querySelector('.guest-screen-share-unavailable'))};
    });
    if(!mobile)check(!await page.locator('.caster-more-toggle').isVisible()&&await page.locator('.caster-more-toggle').evaluate(e=>e.getBoundingClientRect().width===0),'desktop has no phantom More button');
    check(geometry.width<=width+1,'no horizontal page overflow');
    check(geometry.scene.x>=0&&geometry.scene.y>=0&&geometry.scene.right<=width+1&&geometry.scene.bottom<=height+1,'entire stage fits viewport');
    check(geometry.headerControls.length===3&&geometry.headerControls.every(b=>b.x>=0&&b.y>=0&&b.right<=width+1&&b.bottom<=height+1&&b.h>=36),'header portal controls fit viewport and retain existing36px minimum');
    if(mobile){
      check(geometry.toolbarScroll.total<=geometry.toolbarScroll.width+1,'mobile toolbar has no horizontal scroll');
      check(await page.locator('.caster-more-toggle').count()===1,'mobile has progressive-disclosure More action');
      const controls=geometry.buttons;
      check(Math.max(...controls.map(b=>b.y))-Math.min(...controls.map(b=>b.y))<=1,'all transport actions stay in exactly one row');
      check(controls.every(b=>b.bottom<=height),'every control stays vertically inside phone viewport');
      check(controls.every(b=>b.w>=Math.min(44,(width-40)/8)-1),'primary widths adapt honestly to8actions:35px at320,44px at393');
      check(geometry.toolbar.x>=0&&geometry.toolbar.right<=width+1,'toolbar scrollport fits viewport');
      check(controls.every(b=>b.h>=44),'transport controls retain44px touch height');
      check(geometry.footer.bottom<=height+1,'footer stays above phone gesture area');
      check(geometry.scene.h>=120,'video stage remains usable');
      check(geometry.separators===0,'phones never show resize separator');
    }
    check(geometry.unavailable.w<=1&&geometry.unavailable.h<=1,'unsupported screen hint does not form a narrow text column');
    check(await page.locator('.guest-screen-share-button').isDisabled(),'unsupported screen share is disabled');
    check((await page.locator('.guest-screen-share-button').getAttribute('aria-label')).includes('не поддерживается'),'unsupported reason remains accessible');
    await page.screenshot({path:path.join(out,'ready-'+theme+'-'+width+'.png')});
    await page.evaluate(()=>{window.qaMedia=[...document.querySelectorAll('video')].map(node=>({node,track:node.srcObject?.getVideoTracks()[0]}))});
    check(await page.locator('.caster-scene-controls [aria-label="Вид сцены"]').count()===1,'real scene mode controls use header portal');
    check(await page.locator('.room-reactions-toggle').isVisible()&&await page.locator('.guest-screen-share-button').isVisible(),'reactions and screen share stay direct');
    const openMore=async()=>{if(mobile&&!await page.locator('.caster-secondary-actions').evaluate(e=>e.matches(':popover-open')))await page.locator('.caster-more-toggle').click()};
    if(mobile){await openMore();const bounds=await page.locator('.caster-secondary-actions').boundingBox();check(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'More is bounded');check(await page.locator('.caster-secondary-actions .caster-toolbar-item').count()===2,'More contains onlyupload andcameraeffects');await page.screenshot({path:path.join(out,'more-'+theme+'-'+width+'.png')});await page.keyboard.press('Escape');check(await page.locator('.caster-more-toggle').evaluate(e=>document.activeElement===e),'Escape returns focus to More');await openMore();await page.mouse.click(2,2);check(!await page.locator('.caster-secondary-actions').evaluate(e=>e.matches(':popover-open')),'outside click closes More');}
    for(const selector of ['.guest-camera-effects-toggle','.room-reactions-toggle']){
      if(selector==='.guest-camera-effects-toggle')await openMore();
      await page.locator(selector).click();
      const menu=await page.locator(selector==='.guest-camera-effects-toggle'?'.guest-camera-effects-menu':'[popover]:popover-open:not(.caster-secondary-actions)').evaluate(element=>{const r=element.getBoundingClientRect(),target=element.querySelector('button')||element,hit=document.elementFromPoint(Math.max(0,r.x+r.width/2),Math.max(0,r.y+r.height/2));return {x:r.x,y:r.y,right:r.right,bottom:r.bottom,hit:element.contains(hit)}});
      check(menu.x>=0&&menu.y>=0&&menu.right<=width+1&&menu.bottom<=height+1&&menu.hit,'camera/reaction popover escapes toolbar scroll clipping: '+selector);
      await page.keyboard.press('Escape');
      if(mobile&&selector==='.guest-camera-effects-toggle')check(await page.evaluate(()=>{const e=document.activeElement;return e instanceof HTMLElement&&e.getClientRects().length>0&&(e.matches('.guest-camera-effects-toggle')||e.matches('.caster-more-toggle'))}),'camera Escape restores a visible trigger');
    }
    await page.keyboard.press('Escape');
    await page.locator('.guest-settings-toggle').click();
    const panel=await page.locator('.guest-settings-popover').boundingBox();
    check(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=width+1&&panel.y+panel.height<=height+1,'system settings fit viewport');
    const noise=await page.locator('.guest-noise-control').evaluate(control=>{const label=control.querySelector('label'),input=control.querySelector('input'),status=control.querySelector('[role="status"]');return {labelHeight:label.getBoundingClientRect().height,width:control.scrollWidth,clientWidth:control.clientWidth,statusSize:parseFloat(getComputedStyle(status).fontSize),display:getComputedStyle(label).display,checked:input.checked}});
    check(noise.labelHeight>=44&&noise.display==='flex','noise suppression switch has one44px labelled touch row');
    check(noise.width<=noise.clientWidth+1&&noise.statusSize>=12,'noise suppression status wraps at readable text size');
    await page.locator('.guest-noise-control input').uncheck();
    check(!await page.locator('.guest-noise-control input').isChecked(),'noise suppression switch remains interactive');
    await page.screenshot({path:path.join(out,'settings-'+theme+'-'+width+'.png')});
    await page.keyboard.press('Escape');
    await page.screenshot({path:path.join(out,'window-'+theme+'-'+width+'.png')});
    await page.getByRole('button',{name:'Плитка',exact:true}).click();
    await page.waitForTimeout(80);
    await page.screenshot({path:path.join(out,'tiles-'+theme+'-'+width+'.png')});
    if(mobile){await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(80);check(await page.locator('.native-pptx-prepare').isVisible(),'desktop restores direct upload');await page.setViewportSize({width,height});await page.waitForTimeout(80);check(await page.locator('.caster-more-toggle').isVisible(),'resize restores More');}
    check(await page.locator('.caster-presentation-context').evaluate(e=>!e.closest('.caster-secondary-actions')),'active presentation context stays outside More');
    check(await page.locator('.co-presentation-control > input[type="file"]').evaluate(e=>!e.closest('.caster-secondary-actions')),'source file input stays outside More');
    await page.evaluate(()=>window.qaSetScreen(true));
    await page.locator('.co-presentation-owner-trigger').waitFor({state:'visible'});
    check(!await page.locator('.caster-secondary-actions').evaluate(e=>e.matches(':popover-open')),'active owner entry reachable with More closed');
    await page.locator('.co-presentation-owner-trigger').click();
    await page.locator('.co-presentation-popover .co-presentation-stop').click();
    check(await page.evaluate(()=>window.qaStopCalls===1),'actual active Stop action remains reachable and stops bound share');
    await page.keyboard.press('Escape');
    check(await page.evaluate(()=>window.qaMedia.length===9&&window.qaMedia.every(({node,track})=>node.isConnected&&node.srcObject?.getVideoTracks()[0]===track&&track?.readyState==='live')),'settings and mode switch preserve mounted live media');
    check(errors.length===0,'no browser errors: '+errors.join('; '));
    results.push({theme,width,height,...geometry});
    await page.close();
  }
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({checks,failures,results},null,2));
  console.log(JSON.stringify({out,checks,failures},null,2));
  assert.equal(failures.length,0,'mobile caster regressions');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>browser?.close());
