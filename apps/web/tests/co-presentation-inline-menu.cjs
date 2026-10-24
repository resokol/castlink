const assert=require('node:assert/strict'),React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const {load}=require('./load-typescript.cjs');
const overrides={
 '@/components/ConferenceScene':{ConferenceScene:()=>null},
 '@/components/I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 './I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 './PdfPresentationViewer':{PdfPresentationViewer:()=>React.createElement('canvas',{'data-pdf-viewer':true})},
 '@/components/ScreenShareButton':{ScreenShareButton:()=>React.createElement('button',{'data-screen':true},'Share')},
 '@/components/RoomChat':{RoomChat:()=>null},
 '@livekit/components-react':{ChatToggle:({children})=>React.createElement('button',null,children),ChatToggle:({children})=>React.createElement('button',null,children),useRoomContext:()=>({}),useTracks:()=>[],usePinnedTracks:()=>[],useCreateLayoutContext:()=>({widget:{state:{},dispatch(){}}}),LayoutContextProvider:({children})=>children},
};
const {RoomConference}=load('../components/RoomConference.tsx',overrides);
const html=renderToStaticMarkup(React.createElement(RoomConference,{studioOnly:false,onLeave(){},workspaceLayout:true,microphoneControl:React.createElement('button',null,'Mic'),cameraControl:React.createElement('button',null,'Cam'),transportControl:React.createElement('button',{'data-presentation-entry':true},'Controls')}));
assert.match(html,/data-screen="true"[^]*?<\/button><button data-presentation-entry="true"/,'presentation entry immediately follows ScreenShare in the same transport row');
const {CoPresentationPanel}=load('../components/CoPresentationPanel.tsx',overrides);
const room={state:'connected',localParticipant:{identity:'owner',sid:'sid'},remoteParticipants:new Map()};
global.window={castlinkDesktop:{version:1,powerPoint:{connect(){},status(){},goTo(){},disconnect(){}}}};
const menu=renderToStaticMarkup(React.createElement(CoPresentationPanel,{room,token:'qa',studioId:'qa',roomName:'qa'}));
delete global.window;
assert.doesNotMatch(menu,/<button[^>]*class="co-presentation-trigger"/,'Co entry is absent before an actual share');
assert.match(menu,/>Загрузить PPTX или PDF<\/span>/);
assert.match(menu,/type="file"/,'preload remains mounted outside the closed Co menu');
assert.doesNotMatch(menu,/data-prepared-presentation/,'no file is loaded initially');
const live={...room,localParticipant:{...room.localParticipant,getTrackPublication:()=>({trackSid:'screen',track:{mediaStreamTrack:{readyState:'live'}}})}};
const liveMenu=renderToStaticMarkup(React.createElement(CoPresentationPanel,{room:live,token:'qa',studioId:'qa',roomName:'qa'}));
assert.match(liveMenu,/class="co-presentation-trigger co-presentation-owner-trigger"/,'owner has a separate presentation entry while ScreenShare toggles capture');
const stopped={...live,localParticipant:{...live.localParticipant,getTrackPublication:()=>({track:{mediaStreamTrack:{readyState:'ended'}}})}};
assert.doesNotMatch(renderToStaticMarkup(React.createElement(CoPresentationPanel,{room:stopped,token:'qa',studioId:'qa',roomName:'qa'})),/<button[^>]*class="co-presentation-trigger/,'stopped capture hides entry');
assert.match(menu,/popover="auto"/);assert.match(menu,/role="dialog"/);
const fs=require('node:fs'),ts=require('typescript'),vm=require('node:vm');
const source=ts.createSourceFile('menu.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),handlers={};
(function visit(node){if(ts.isVariableDeclaration(node)&&['rememberMenuEscape','rememberMenuClose','menuToggle'].includes(node.name.getText(source)))handlers[node.name.getText(source)]=node.initializer;ts.forEachChild(node,visit);})(source);
assert.ok(handlers.menuToggle,'closing with Escape or the close button explicitly restores the trigger focus');
let focuses=0,positions=0;const context={restoreMenuFocus:{current:false},menuInitiator:{current:undefined},trigger:{current:{focus(){focuses++;}}},prepareTrigger:{current:null},screenMenuShare:{current:undefined},captureNativeShare:()=>undefined,setMenuOpen(){},positionMenu(){positions++;}};
const handler=name=>vm.runInNewContext(ts.transpileModule(`(${handlers[name].getText(source)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const toggle=handler('menuToggle'),escape=handler('rememberMenuEscape'),close=handler('rememberMenuClose');
toggle({newState:'open'});toggle({newState:'closed'});assert.equal(focuses,0,'outside click keeps the outside target focus');
toggle({newState:'open'});escape({key:'Escape'});toggle({newState:'closed'});assert.equal(focuses,1,'Escape restores focus even when navigation temporarily disabled the focused button');assert.equal(context.restoreMenuFocus.current,false);
toggle({newState:'open'});close();toggle({newState:'closed'});assert.equal(focuses,2,'close action restores trigger focus');
toggle({newState:'open'});escape({key:'Enter'});toggle({newState:'closed'});assert.equal(focuses,2,'unrelated keyboard events do not steal outside focus');
console.log('PASS inline presentation entry follows ScreenShare; Co entry follows actual share, preload stays mounted and stopped share hides entry');
