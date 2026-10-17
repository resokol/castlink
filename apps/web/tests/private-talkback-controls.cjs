require('./i18n-fixture.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),{EventEmitter}=require('node:events');
let context;const noop=()=>{},component=()=>null,t=(key,args)=>args?key.replace('{value0}',args.value0):key;
const react={
 useState(initial){const scope=context,index=scope.cursor++;if(!(index in scope.hooks))scope.hooks[index]=typeof initial==='function'?initial():initial;return[scope.hooks[index],value=>{scope.hooks[index]=typeof value==='function'?value(scope.hooks[index]):value;}];},
 useRef(initial){const i=context.cursor++;return context.hooks[i]||=( {current:initial});},
 useMemo(fn,deps){const scope=context,i=scope.cursor++,old=scope.hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))scope.hooks[i]={deps,value:fn()};return scope.hooks[i].value;},
 useCallback(fn,deps){return react.useMemo(()=>fn,deps);},
 useEffect(fn,deps){const scope=context,i=scope.cursor++,old=scope.hooks[i];if(!old||deps.some((v,n)=>v!==old.deps[n]))scope.effects.push(()=>{old?.cleanup?.();scope.hooks[i]={deps,cleanup:fn()};});},
};
function renderer(fn){const scope={cursor:0,hooks:[],effects:[]};return{render(props){context=scope;scope.cursor=0;const result=fn(props);while(scope.effects.length)scope.effects.shift()();return result;},unmount(){for(const hook of scope.hooks)hook?.cleanup?.();}};}
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const settle=async()=>{for(let i=0;i<8;i++)await new Promise(resolve=>setImmediate(resolve));};
const calls=[],rooms=[],timers=new Set();
const RoomEvent=new Proxy({}, {get:(_,key)=>key}),Track={Source:{Microphone:'microphone',Camera:'camera'},Kind:{Audio:'audio',Video:'video'}};
class Room extends EventEmitter{constructor(){super();rooms.push(this);this.state='connected';this.remoteParticipants=new Map();this.localParticipant={identity:'local',getTrackPublication:()=>undefined,setTrackSubscriptionPermissions:(...args)=>calls.push(['permissions',this,...args]),publishTrack:async track=>calls.push(['publish',this,track]),unpublishTrack:async track=>calls.push(['unpublish',this,track]),setMicrophoneEnabled:async enabled=>calls.push(['main-mic',enabled])};}async connect(url,token,options){calls.push(['connect',this,token,options]);}async disconnect(){this.state='disconnected';calls.push(['disconnect',this]);this.emit(RoomEvent.Disconnected);}getActiveDevice(){return 'headphones';}async switchActiveDevice(kind,id){calls.push(['output',this,kind,id]);}}
const createLocalAudioTrack=async()=>{calls.push(['capture']);return{stop(){calls.push(['stop-track']);},mute(){calls.push(['private-mute']);},unmute(){calls.push(['private-unmute']);}};};
const requests=[];let active=true;
global.fetch=async(url,options={})=>{const body=options.body?JSON.parse(options.body):undefined;requests.push({url,method:options.method||'GET',body});return{ok:true,json:async()=>options.method==='DELETE'?{}:{active,sessionId:'private-session',token:'private-token',staffName:'Studio',restoreMicrophone:true}};};
global.navigator={mediaDevices:{enumerateDevices:async()=>[]}};global.window={addEventListener:noop,removeEventListener:noop};global.document={addEventListener:noop,removeEventListener:noop,visibilityState:'visible'};
const mocked={'@/lib/guest-audio-gain':{setGuestMicrophoneGain:async(room,gain)=>{calls.push(['private-gain',room,gain]);return true;}},react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},'livekit-client':{Room,RoomEvent,Track,createLocalAudioTrack},'@/components/I18nProvider':{useI18n:()=>({t,locale:'ru'})},'@/lib/i18n/workspaces':{translateWorkspaceMessage:(_,value)=>value},'@/lib/video-rotation':{useVideoRotation:noop},'@/components/AudioOutputSelect':{AudioOutputSelect:component},'@/components/ScreenShareButton':{ScreenShareButton:component},'@/lib/livekit-url':{getLiveKitUrl:()=> 'wss://test'},'@/lib/participant-role':{resolveParticipantRole:()=> 'guest'},'@/lib/private-talkback-audio':{bindPrivateTalkbackAudio:()=>{calls.push(['bind-private-playback']);return()=>calls.push(['dispose-private-playback']);}},'@/lib/guest-audio':{guestAudioCaptureOptions:choices=>({deviceId:choices.audioDeviceId}),setGuestMicrophoneEnabled:async(room,enabled,_choices,isCurrent)=>{if(isCurrent())await room.localParticipant.setMicrophoneEnabled(enabled);}}};
const original=Module._load;Module._load=function(name,...args){if(name in mocked)return mocked[name];return original.call(this,name,...args);};
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
mocked['@/lib/talkback-policy']=require('../lib/talkback-policy.ts');
const {TalkbackControls}=require('../components/TalkbackControls.tsx'),{GuestPrivateTalkback}=require('../components/GuestPrivateTalkback.tsx');Module._load=original;
const originalInterval=global.setInterval,originalClear=global.clearInterval;global.setInterval=fn=>{timers.add(fn);return fn;};global.clearInterval=id=>timers.delete(id);
(async()=>{
 const main=new Room();main.remoteParticipants.set('guest-selected',{identity:'guest-selected',name:'Guest'});
 const props={room:main,roomName:'qa',studioId:'studio',clientId:'client',connected:true,allowStaff:false,mediaControls:false,onPrivateActiveChange:active=>calls.push(['program-private-gate',active])};
 const staff=renderer(TalkbackControls);let tree=staff.render(props);
 nodes(tree).find(node=>node.type==='select'&&node.props['aria-label']==='Кому говорить').props.onChange({target:{value:'guest-selected'}});
 tree=staff.render(props);nodes(tree).find(node=>node.type==='button'&&node.props.children==='Говорить приватно').props.onClick();await settle();
 assert.ok(calls.findIndex(c=>c[0]==='program-private-gate'&&c[1]===true)<calls.findIndex(c=>c[0]==='capture'),'primary program gate is held before staff microphone capture');
 assert.equal(nodes(tree).some(node=>node.type==='button'&&node.props.children==='Включить камеру в комнате'),false,'main studio talkback cannot republish its program camera');
 assert.ok(requests.some(req=>req.url==='/api/talkback'&&req.method==='POST'&&req.body.target==='guest-selected'),'selected guest starts server-authorized isolated session');
 assert.equal(requests.some(req=>req.url.startsWith('/api/token')),false,'private talk never mints parent-room talkback token');
 const staffPrivate=rooms.at(-1);assert.notEqual(staffPrivate,main);assert.equal(calls.find(c=>c[0]==='connect')[3].autoSubscribe,true,'staff subscribes to private reply');
 assert.equal(calls.filter(c=>c[0]==='publish'&&c[1]===main).length,0,'staff talk never publishes into program room');
 tree=staff.render(props);nodes(tree).find(node=>node.type==='button'&&node.props.children==='Завершить разговор').props.onClick();await settle();
 assert.ok(requests.some(req=>req.method==='DELETE'&&req.body.sessionId==='private-session'));assert.equal(staffPrivate.state,'disconnected');assert.ok(calls.findLastIndex(c=>c[0]==='program-private-gate'&&c[1]===false)>calls.findLastIndex(c=>c[0]==='stop-track'),'program output resumes only after private microphone has stopped');staff.unmount();
 calls.length=0;requests.length=0;active=true;
 const guestProps={room:main,roomName:'qa',studioId:'studio',token:'guest-main-token',microphoneId:'mic',micGain:35};
 const guest=renderer(GuestPrivateTalkback);guest.render(guestProps);await settle();tree=guest.render(guestProps);
 assert.ok(nodes(tree).some(node=>node.props?.children==='Приватная связь со студией'),'guest visibly sees private mode');
 nodes(tree).find(node=>node.type==='button'&&node.props.children==='Ответить приватно').props.onClick();await settle();
 assert.ok(calls.findIndex(c=>c[0]==='main-mic'&&c[1]===false)<calls.findIndex(c=>c[0]==='capture'),'main microphone stops before private reply capture');
 assert.equal(calls.filter(c=>c[0]==='publish'&&c[1]===main).length,0,'guest reply never enters program room');
 assert.ok(calls.findIndex(c=>c[0]==='private-mute')<calls.findIndex(c=>c[0]==='publish'),'new reply stays muted until its gain is configured');assert.equal(calls.find(c=>c[0]==='private-gain')[2],35);assert.ok(calls.findIndex(c=>c[0]==='private-gain')<calls.findIndex(c=>c[0]==='private-unmute'),'requested input gain is applied before transmitting first private samples');
 tree=guest.render(guestProps);assert.ok(nodes(tree).some(node=>node.props?.children==='Вы отвечаете приватно. Другие гости и эфир вас не слышат.'));
 active=false;for(const timer of timers)timer();await settle();assert.ok(calls.some(c=>c[0]==='main-mic'&&c[1]===true),'server-closed session restores previously enabled public microphone');
 assert.equal(guest.render(guestProps),null);guest.unmount();
 console.log('PRIVATE_TALKBACK_CONTROLS_PASS');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{global.setInterval=originalInterval;global.clearInterval=originalClear;});
