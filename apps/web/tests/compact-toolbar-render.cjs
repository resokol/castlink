// Render real caster controls with an offline room adapter for compact-toolbar.browser.py.
// Geometry only: this does not claim a physical camera or SFU was exercised.
const fs=require('node:fs'),path=require('node:path');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server'),{load}=require('./load-typescript.cjs');
const web=path.resolve(__dirname,'..');
const room={state:'connected',localParticipant:{identity:'guest-owner',sid:'owner',isCameraEnabled:true,isMicrophoneEnabled:true},remoteParticipants:new Map()};
const overrides={
 '@/components/I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 './I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 '@/components/ConferenceScene':{ConferenceScene:()=>React.createElement('div',{className:'qa-stage'},'Камера')},
 '@/components/RoomChat':{RoomChat:()=>null},
 '@livekit/components-react':{ScreenShareIcon:()=>React.createElement('svg',{viewBox:'0 0 24 24'},React.createElement('path',{d:'M3 4h18v14H3zM8 22h8',fill:'none',stroke:'currentColor'})),ScreenShareStopIcon:()=>null,ChatToggle:({children,...props})=>React.createElement('button',props,children),useRoomContext:()=>room,useTracks:()=>[],usePinnedTracks:()=>[],useCreateLayoutContext:()=>({widget:{state:{},dispatch(){}}}),LayoutContextProvider:({children})=>children},
};
const {RoomConference}=load('../components/RoomConference.tsx',overrides),{GuestSettingsPanel}=load('../components/GuestSettingsPanel.tsx',overrides),{GuestMicrophoneButton}=load('../components/GuestMicrophoneButton.tsx',overrides),{GuestCodecCameraButton}=load('../components/GuestCodecCameraButton.tsx',overrides),{CoPresentationPanel}=load('../components/CoPresentationPanel.tsx',overrides);
const controlProps={room,choicesRef:{current:{}},generation:{current:0},disabled:false,onError(){}};
const markup=renderToStaticMarkup(React.createElement('main',{className:'guest-room-page guest-app-shell graphite-workspace caster-workspace'},React.createElement('div',{className:'guest-main-column'},React.createElement('div',{className:'guest-conference-shell'},React.createElement('div',{className:'guest-conference-grid'},React.createElement(RoomConference,{workspaceLayout:true,studioOnly:false,onLeave(){},showLeaveButton:false,onToggleSelfPreview(){},microphoneControl:React.createElement(GuestMicrophoneButton,controlProps),cameraControl:React.createElement(GuestCodecCameraButton,controlProps),transportControl:React.createElement(CoPresentationPanel,{room,token:'qa',studioId:'qa',roomName:'qa'}),settingsControl:React.createElement(GuestSettingsPanel,null,'Устройства')}))))));
const css=fs.readFileSync(require.resolve('@livekit/components-styles'),'utf8')+'\n'+fs.readFileSync(path.join(web,'app/globals.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'app/graphite-workspace.css'),'utf8')+'\n'+fs.readFileSync(path.join(web,'components/RoomReactions.module.css'),'utf8');
fs.writeFileSync(process.argv[2],`<!doctype html><html data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}.qa-stage{min-height:100px}</style>${markup}</html>`);
