'use strict';
const assert=require('node:assert/strict'),{EventEmitter}=require('node:events');
const {load}=require('./load-typescript.cjs');
let current,captures=0,stops=0,nativeLaunches=0,resolveCapture;
const react={
 useId:()=> 'screen-test',
 useRef(value){const i=current.cursor++;return current.hooks[i]??={current:value};},
 useState(value){const s=current,i=s.cursor++;if(!(i in s.hooks))s.hooks[i]=value;return[s.hooks[i],next=>{if(s.hooks[i]!==next){s.hooks[i]=next;s.dirty=true;}}];},
 useEffect(fn,deps){const s=current,i=s.cursor++,old=s.hooks[i];if(!old||deps.some((v,j)=>old.deps[j]!==v))s.effects.push(()=>{old?.cleanup?.();s.hooks[i]={deps,cleanup:fn()};});},
};
const panel=()=>({open:async()=>false,sync(){},dispose(){},setLabels(){},setSuppressed(){}});
const events=new Proxy({},{get:(_,key)=>key});
Object.defineProperty(global,'navigator',{configurable:true,value:{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',mediaDevices:{getDisplayMedia(){}}}});
global.window={setTimeout:()=>1,clearTimeout(){},dispatchEvent:()=>false};
const {ScreenShareButton}=load('../components/ScreenShareButton.tsx',{
 react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 'livekit-client':{RoomEvent:events,Track:{Source:{ScreenShare:'screen_share'}}},
 '@livekit/components-react':{ScreenShareIcon(){},ScreenShareStopIcon(){}},
 '@/components/I18nProvider':{useI18n:()=>({locale:'ru',t:v=>v})},
 '@/lib/i18n/workspaces':{translateWorkspaceMessage:(_,v)=>v},
 '@/lib/use-remote-pc':{useRemotePc:()=>({sessions:[],sources:[]})},
 '@/lib/remote-pc-client':{beginRemotePc:async()=>{nativeLaunches++;throw Error('Native launch must not handle ordinary screen sharing');}},
 '@/lib/remote-pc-sources':{resolveRemotePcScreen:()=>undefined},
 './RemotePcControls':{RemotePcControls(){}},'./ScreenShareSetup':{ScreenShareSetup(){}},
 './CoPresentationNavigation':{useCoPresentationNavigation:()=>undefined,ownerSurfaceMatches:()=>false},
 '@/lib/co-presentation-client':{isCoPresentationTrack:()=>false},
 '@/lib/desktop-stop-panel':{desktopScreenBridge:()=>undefined},
 '@/lib/screen-share-stop-panel':{documentPictureInPictureApi:()=>undefined,createScreenShareStopPanel:panel},
 '@/lib/screen-share':{
  async enableRoomScreenShare(room,isCurrent){captures++;await new Promise(resolve=>resolveCapture=resolve);if(!isCurrent())return false;room.track={mediaStreamTrack:{readyState:'live',addEventListener(){},removeEventListener(){}}};room.emit(events.LocalTrackPublished);return true;},
  enableStudioScreenShare:()=>{throw Error('Guest must use room capture');},setRoomScreenShareOutputMuted(){},stopStudioScreenShare:async()=>{},
 },
});
const nodes=value=>!value||typeof value!=='object'?[]:Array.isArray(value)?value.flatMap(nodes):[value,...nodes(value.props?.children)];
const mainButton=tree=>nodes(tree).find(node=>node.type==='button');
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
(async()=>{
 const room=new EventEmitter();room.state='connected';room.localParticipant={identity:'guest-test',sid:'PA_test',getTrackPublication:()=>room.track?{track:room.track}:undefined,async setScreenShareEnabled(value){assert.equal(value,false);stops++;room.track=undefined;room.emit(events.LocalTrackUnpublished);}};
 const scope={hooks:[],effects:[]};const render=()=>{let tree,cycles=0;do{assert.ok(++cycles<20);current=scope;scope.cursor=0;scope.dirty=false;tree=ScreenShareButton({room,toolbar:true});while(scope.effects.length)scope.effects.shift()();}while(scope.dirty);return tree;};
 let tree=render();assert.equal(mainButton(tree).props.disabled,false);
 mainButton(tree).props.onClick();await settle();
 assert.equal(captures,1,'Windows browser guest must open the browser source picker on the first click');
 assert.equal(nativeLaunches,0,'ordinary screen sharing must never launch the PC component');
 mainButton(render()).props.onClick();assert.equal(captures,1,'pending picker cannot be opened twice');
 resolveCapture();await settle();tree=render();assert.equal(mainButton(tree).props['aria-pressed'],true,'successful capture activates the button');
 mainButton(tree).props.onClick();await settle();tree=render();assert.equal(stops,1,'second click stops sharing directly');assert.equal(mainButton(tree).props['aria-pressed'],false);
 for(const hook of scope.hooks)hook?.cleanup?.();
 console.log('PASS Windows browser: first click opens capture, no native launch, no duplicate picker, active indicator, second click stops');
})().catch(error=>{console.error(error);process.exitCode=1;});
