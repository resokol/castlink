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
assert.equal((markup.match(/class="caster-toolbar-caption"/g)||[] ).length,9,'eight desktop captions plus mobile-only camera effects caption');
assert.match(markup,/caster-toolbar-exit/,'footer contains the exit action');
const readonlyMarkup=renderToStaticMarkup(React.createElement(RoomConference,{workspaceLayout:true,readOnly:true,studioOnly:false,onLeave(){},settingsControl:React.createElement(GuestSettingsPanel,null,'Устройства')}));
assert.doesNotMatch(readonlyMarkup,/class="caster-more-toggle"/,'read-only workspace has no empty More trigger');
assert.doesNotMatch(readonlyMarkup,/class="caster-toolbar-exit"/,'read-only workspace has no leave action');
const studioMarkup=renderToStaticMarkup(React.createElement(RoomConference,{workspaceLayout:true,studioOnly:true,onLeave(){},microphoneControl:React.createElement(GuestMicrophoneButton,controlProps),cameraControl:React.createElement(GuestCodecCameraButton,controlProps)}));
assert.doesNotMatch(studioMarkup,/class="castlink-chat-toggle"/,'studio-only workspace has no chat action');
// Portal slots require client hydration. Reuse the hydrated desktop proof instead
// of assigning mobile geometry to static markup before matchMedia can run.
process.env.CASTLINK_TOOLBAR_DESKTOP_ONLY='1';
require('./caster-toolbar-interactions.browser.cjs');
