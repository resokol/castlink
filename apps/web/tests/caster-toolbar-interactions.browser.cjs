// The tiny PDF below exercises prepared-file menus only; it is not a rendering fixture.
// Hydrated production controls and styles; an offline Room substitutes the SFU/devices.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {createRequire}=require('node:module');
const web=path.resolve(__dirname,'..'),req=createRequire(path.join(web,'package.json'));
const {chromium}=req(process.env.CASTLINK_QA_PLAYWRIGHT||'playwright');
const {build}=require(process.env.CASTLINK_QA_ESBUILD||'esbuild');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-caster-toolbar-')),fixture=path.join(out,'fixture.tsx');
fs.writeFileSync(fixture,`
import React,{useEffect,useState,createContext,useContext} from 'react';
import {createRoot} from 'react-dom/client';
import {Room,RoomEvent,Track} from 'livekit-client';
import {RoomConference} from '${web}/components/RoomConference';
import {GuestMicrophoneButton} from '${web}/components/GuestMicrophoneButton';
import {GuestCodecCameraButton} from '${web}/components/GuestCodecCameraButton';
import {GuestSettingsPanel} from '${web}/components/GuestSettingsPanel';
import {CoPresentationPanel} from '${web}/components/CoPresentationPanel';
export const useI18n=()=>({locale:'ru',t:(value)=>value});
export const room=new Room();room.state='connected';
Object.defineProperty(room.localParticipant,'identity',{value:'guest-qa'});Object.defineProperty(room.localParticipant,'sid',{value:'qa-sid'});
let mic=true,camera=true;Object.defineProperty(room.localParticipant,'isMicrophoneEnabled',{get:()=>mic});Object.defineProperty(room.localParticipant,'isCameraEnabled',{get:()=>camera});
room.localParticipant.publishData=async()=>{};
window.qa={left:0,micCalls:0,cameraCalls:0,effectStops:0};
export async function setGuestMicrophoneEnabled(_room,value){window.qa.micCalls++;mic=value;room.emit(RoomEvent.TrackMuted);return true}
export async function setGuestCameraEnabled(_room,value){window.qa.cameraCalls++;camera=value;room.emit(RoomEvent.TrackMuted);return true}
export const cameraBlurRadius=value=>value??10;
export function watchGuestCameraEffects(){return {setEffect:async()=>{},stop(){window.qa.effectStops++}}}
const localTrack={source:Track.Source.Camera,participant:room.localParticipant};
export const useRoomContext=()=>room;
export const useLocalParticipant=()=>({isCameraEnabled:camera}),useTrackToggle=()=>({buttonProps:{},pending:false});
export const useChat=()=>({chatMessages:[],send:async()=>{},isSending:false}),useConnectionState=()=>room.state;
export const useLayoutContext=()=>({widget:{dispatch(){},state:{showChat:false}}});
export const ChatEntry=()=>null;
export const useTracks=sources=>typeof sources[0]==='object'?[localTrack]:[];
export const useEnsureTrackRef=track=>track;
export const useCreateLayoutContext=()=>({});
const Layout=createContext(()=>{});
export function LayoutContextProvider({children,onWidgetChange}){return <Layout.Provider value={onWidgetChange}>{children}</Layout.Provider>}
export function ChatToggle({children,...props}){const change=useContext(Layout);const [open,setOpen]=useState(false);return <button {...props} onClick={()=>{setOpen(!open);change({showChat:!open})}}>{children}</button>}
export const ParticipantTile=React.forwardRef((props,ref)=><div ref={ref} className="lk-participant-tile"><video data-qa-media/><span>Кастер</span></div>);
export const AudioTrack=()=>null,ControlBar=()=>null;
export const ScreenShareIcon=()=> <svg viewBox="0 0 24 24"><path d="M3 3h18v14H3zM8 21h8m-4-4v4m-3-11 3-3 3 3m-3-3v7" fill="none" stroke="currentColor" strokeWidth="1.7"/></svg>;
export const ScreenShareStopIcon=ScreenShareIcon;
function App(){const [disabled,setDisabled]=useState(false),[preview,setPreview]=useState(true);window.qa.disable=setDisabled;window.qa.preview=setPreview;const controls={room,choicesRef:{current:{}},generation:{current:0},disabled,onError:console.error};
return <main className="media-page guest-room-page guest-app-shell graphite-workspace caster-workspace"><div className="guest-main-column"><header className="guest-page-header"><h1>CastLink — Комната</h1><span>Кастер</span></header><div className="guest-conference-shell"><div className="guest-conference-grid"><RoomConference workspaceLayout studioOnly={false} selfPreviewVisible={preview} onLeave={()=>window.qa.left++} microphoneControl={<GuestMicrophoneButton {...controls}/>} cameraControl={<GuestCodecCameraButton {...controls}/>} transportControl={<CoPresentationPanel room={room} token="qa" studioId="qa" roomName="qa"/>} settingsControl={<GuestSettingsPanel><label><input type="checkbox" checked={preview} onChange={event=>setPreview(event.target.checked)}/>Свой предпросмотр</label></GuestSettingsPanel>}/></div></div></div></main>}
createRoot(document.getElementById('root')).render(<App/>);
`);
let browser;
(async()=>{
 await build({entryPoints:[fixture],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',nodePaths:[path.join(web,'node_modules')],alias:{'@':web},plugins:[{name:'offline-room',setup(builder){builder.onResolve({filter:/^@livekit\/components-react$|(?:^|\/)I18nProvider$|^@\/lib\/guest-audio$|^@\/lib\/guest-video-codec$|^@\/lib\/guest-camera-effects$/},()=>({path:fixture}))}}]});
 const css=fs.readFileSync(require.resolve('@livekit/components-styles'),'utf8')+'\n'+fs.readFileSync(path.join(web,'app/globals.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'app/graphite-workspace.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'components/native-pptx.css'),'utf8')+'\n'+fs.readFileSync(path.join(out,'bundle.css'),'utf8');
 browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const proof=[];
 for(const [width,height] of [[1440,900],[900,900],[701,900],[700,900],[390,844],[320,844],[844,390],[568,320]])for(const theme of ['dark','light']){
  const mobile=width<=700||height<=600,page=await browser.newPage({viewport:{width,height}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.route('https://toolbar.test/**',route=>route.fulfill({contentType:'text/html',body:'<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><div id="root"></div>'}));
  await page.goto('https://toolbar.test/');await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.addStyleTag({content:css});await page.addScriptTag({content:fs.readFileSync(path.join(out,'bundle.js'),'utf8')});
  await page.waitForSelector('.caster-toolbar-exit');
  const toolbar=page.locator('.caster-action-toolbar');
  const geometry=await toolbar.evaluate(toolbar=>{const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return{page:document.documentElement.scrollWidth,items:[...toolbar.querySelectorAll('.caster-toolbar-item')].map(item=>{const button=item.querySelector('button'),caption=item.querySelector('.caster-toolbar-caption');return{caption:caption.textContent,button:rect(button),item:rect(item),captionRect:rect(caption),captionDisplay:getComputedStyle(caption).display,color:getComputedStyle(button).backgroundColor,accessible:!!(button.getAttribute('aria-label')||button.textContent)}})}});
  assert.equal(geometry.items.length,8);assert.deepEqual(geometry.items.map(i=>i.caption),['Микрофон','Камера','Чат','Реакции','Демонстрация','Загрузить','Настройки','Выйти']);assert(geometry.page<=width,'no page overflow '+JSON.stringify({width,height,geometry}));
  for(const item of geometry.items){assert(item.accessible,'icon has accessible name');assert(item.button.x>=0&&item.button.right<=width+1,'action fits viewport');assert(item.button.h>=44);if(mobile)assert.equal(item.captionDisplay,'none');else{assert.equal(item.captionDisplay,'block');assert(item.captionRect.y>=item.button.bottom+7,'caption below button')}}
  if(!mobile){assert.equal(new Set(geometry.items.map(item=>item.item.w)).size,1,'equal desktop widths');assert.equal(new Set(geometry.items.map(item=>item.button.y)).size,1,'desktop one row')}
  assert.equal(geometry.items[0].color,geometry.items[1].color,'graphite microphone and camera');assert.equal(geometry.items[5].color,'rgb(181, 210, 242)');assert.equal(geometry.items[7].color,'rgb(197, 70, 80)');
  assert.equal(await page.locator('header .room-leave-button').count(),0);
  assert.equal(await page.locator('[data-qa-media]').count(),1,'real conference mounts the media node');
  await page.screenshot({path:path.join(out,`ready-${theme}-${width}x${height}.png`)});
  await page.evaluate(()=>window.qa.media=document.querySelector('[data-qa-media]'));
  await toolbar.locator('[data-lk-source="microphone"]').click();assert.equal(await page.evaluate(()=>window.qa.micCalls),1);assert.equal(await toolbar.locator('[data-lk-source="microphone"]').getAttribute('aria-pressed'),'false');
  await toolbar.locator('[data-lk-source="camera"]').click();assert.equal(await page.evaluate(()=>window.qa.cameraCalls),1);assert.equal(await toolbar.locator('[data-lk-source="camera"]').getAttribute('aria-pressed'),'false');
  await page.locator('.guest-camera-effects-toggle').click();const cameraMenu=page.locator('.guest-camera-effects-menu');await cameraMenu.waitFor({state:'visible'});
  const bounds=await cameraMenu.boundingBox();assert(bounds.x>=0&&bounds.y>=0&&bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=height+1,'camera menu bounded '+JSON.stringify({width,height,bounds}));
  await page.screenshot({path:path.join(out,`camera-${theme}-${width}x${height}.png`)});await page.keyboard.press('Escape');
  await page.locator('.room-reactions-toggle').click();assert(await page.locator('[popover]:popover-open').count()>0);await page.keyboard.press('Escape');
  await page.locator('.guest-settings-toggle').click();await page.locator('.guest-settings-popover').waitFor({state:'visible'});await page.getByLabel('Свой предпросмотр').uncheck();await page.keyboard.press('Escape');
  await page.getByRole('button',{name:'Чат',exact:true}).click();assert.equal(await page.locator('.caster-conference').getAttribute('data-workspace-chat'),'true');await page.getByRole('button',{name:'Чат',exact:true}).click();
  const picker=page.waitForEvent('filechooser');await page.locator('.native-pptx-prepare').click();
  await (await picker).setFiles({name:'Toolbar QA.pdf',mimeType:'application/pdf',buffer:Buffer.from('%PDF-1.4\n%%EOF')});
  await page.locator('.presentation-file-menu').waitFor({state:'visible'});
  assert(await page.locator('.presentation-file-menu button').first().isVisible(),'prepared Show action visible');assert(await page.getByRole('button',{name:'Удалить файл',exact:true}).isVisible(),'prepared Delete action visible');
  await page.keyboard.press('Escape');await page.locator('.native-pptx-prepare').click();await page.locator('.presentation-file-menu').waitFor({state:'visible'});
  const fileMenuBounds=await page.locator('.presentation-file-menu').boundingBox();assert(fileMenuBounds.x>=0&&fileMenuBounds.y>=0&&fileMenuBounds.x+fileMenuBounds.width<=width+1&&fileMenuBounds.y+fileMenuBounds.height<=height+1,'prepared file menu fits viewport');
  await page.keyboard.press('Escape');
  await page.evaluate(()=>window.qa.disable(true));await page.waitForFunction(()=>document.querySelector('[data-lk-source="microphone"]').disabled);assert(await page.locator('[data-lk-source="camera"]').isDisabled());assert(await page.locator('.guest-camera-effects-toggle').isDisabled());
  await page.screenshot({path:path.join(out,`toolbar-${theme}-${width}x${height}.png`)});
  await page.locator('.caster-toolbar-exit').click();assert.equal(await page.evaluate(()=>window.qa.left),1);
  assert(await page.evaluate(()=>window.qa.media===document.querySelector('[data-qa-media]')),'media DOM retained across controls/chat/settings/preview');assert.equal(await page.evaluate(()=>window.qa.effectStops),0,'camera effects controller retained');assert.deepEqual(errors,[]);
  proof.push({width,height,theme,mobile,geometry});await page.close();
 }
 fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log('PASS hydrated caster toolbar: captions, mobile icons, real toggles/menus/file picker/leave, disabled/off states, retained media; '+out);
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close()});
