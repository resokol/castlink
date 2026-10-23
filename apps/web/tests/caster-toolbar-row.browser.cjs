// Actual RoomConference/guest controls rendered with an offline room adapter.
// Geometry only: this does not claim a physical camera or SFU was exercised.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{load}=require('./load-typescript.cjs');
const web=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-toolbar-row-'));
const room={state:'connected',localParticipant:{identity:'guest-owner',sid:'owner',isCameraEnabled:true,isMicrophoneEnabled:true},remoteParticipants:new Map()};
const overrides={
 '@/components/I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 './I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 '@/components/ConferenceScene':{ConferenceScene:()=>React.createElement('div',{className:'qa-stage'},'Камера')},
 '@/components/RoomChat':{RoomChat:()=>null},
 '@livekit/components-react':{ScreenShareIcon:()=>null,ScreenShareStopIcon:()=>null,ChatToggle:({children,...props})=>React.createElement('button',props,children),useRoomContext:()=>room,useTracks:()=>[],usePinnedTracks:()=>[],useCreateLayoutContext:()=>({widget:{state:{},dispatch(){}}}),LayoutContextProvider:({children})=>children},
};
const {RoomConference}=load('../components/RoomConference.tsx',overrides),{GuestSettingsPanel}=load('../components/GuestSettingsPanel.tsx',overrides),{GuestMicrophoneButton}=load('../components/GuestMicrophoneButton.tsx',overrides),{GuestCodecCameraButton}=load('../components/GuestCodecCameraButton.tsx',overrides),{CoPresentationPanel}=load('../components/CoPresentationPanel.tsx',overrides);
const controlProps={room,choicesRef:{current:{}},generation:{current:0},disabled:false,onError(){}};
const markup=renderToStaticMarkup(React.createElement('main',{className:'guest-room-page guest-app-shell graphite-workspace caster-workspace'},React.createElement('div',{className:'guest-main-column'},React.createElement('div',{className:'guest-conference-shell'},React.createElement('div',{className:'guest-conference-grid'},React.createElement(RoomConference,{workspaceLayout:true,studioOnly:false,onLeave(){},showLeaveButton:false,microphoneControl:React.createElement(GuestMicrophoneButton,controlProps),cameraControl:React.createElement(GuestCodecCameraButton,controlProps),transportControl:React.createElement(CoPresentationPanel,{room,token:'qa',studioId:'qa',roomName:'qa'}),settingsControl:React.createElement(GuestSettingsPanel,null,'Устройства')}))))));
const css=fs.readFileSync(require.resolve('@livekit/components-styles'),'utf8')+'\n'+fs.readFileSync(path.join(web,'app/globals.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'app/graphite-workspace.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'components/RoomReactions.module.css'),'utf8');
const browser=spawn(process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run',`--user-data-dir=${out}/profile`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let socket;
(async()=>{
 let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(`${out}/profile/DevToolsActivePort`,'utf8').split('\n')[0];break;}catch{}await pause(50);}assert.ok(port,'Chromium starts');
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});let sequence=0;const pending=new Map();
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(!message.id)return;const callback=pending.get(message.id);pending.delete(message.id);message.error?callback.reject(Error(JSON.stringify(message.error))):callback.resolve(message.result);};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
 const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
 await send('Page.enable');const proof=[];
 for(const [width,height] of [[320,844],[360,844],[390,844],[700,900],[844,390],[1440,900]])for(const theme of ['dark','light']){
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<=700});
  await send('Page.setDocumentContent',{frameId:(await send('Page.getFrameTree')).frameTree.frame.id,html:`<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}.qa-stage{min-height:100px}</style>${markup}</html>`});
  const info=await evaluate(`(()=>{const selectors=['[data-lk-source="microphone"]','.guest-camera-control > .lk-track-toggle','.guest-camera-effects-toggle','.castlink-chat-toggle','button[aria-label="Реакции"]','.conference-more-toggle','.guest-settings-toggle'];const rect=e=>{const r=e.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right}};return{page:document.documentElement.scrollWidth,buttons:selectors.map(selector=>({selector,...rect(document.querySelector(selector))})),uploadColor:getComputedStyle(document.querySelector('.co-presentation-file')).backgroundColor,entryColor:getComputedStyle(document.querySelector('.co-presentation-trigger')).backgroundColor}})()`);
  if(width<=700||height<=600){const row=info.buttons;assert.ok(Math.max(...row.map(button=>button.y))-Math.min(...row.map(button=>button.y))<=1,'all transport controls and settings share one row: '+JSON.stringify({width,height,row}));for(const button of row){assert.ok(button.w>=24&&button.h>=44,'usable touch control: '+JSON.stringify(button));assert.ok(button.x>=0&&button.right<=width+1,'controls fit viewport: '+JSON.stringify(button));}}
  assert.ok(info.page<=width,'no horizontal overflow');assert.equal(info.uploadColor,info.entryColor,'upload and co-presentation entry have the same blue surface');proof.push({width,height,theme,...info});
  await send('Page.captureScreenshot',{format:'png'}).then(result=>fs.writeFileSync(path.join(out,`toolbar-${theme}-${width}x${height}.png`),Buffer.from(result.data,'base64')));
 }
 fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log('PASS actual caster toolbar one row at320/360/390/700 and landscape; both themes; blue upload. Proof '+out);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();browser.kill();});
