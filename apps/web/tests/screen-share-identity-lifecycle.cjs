// Execute the actual ScreenShareButton with the SDK's pre-join empty identity.
// Real media/OS launch is deliberately replaced at the external boundary only.
const assert=require('node:assert/strict'),{Room,RoomEvent}=require('livekit-client'),{load}=require('./load-typescript.cjs');
let current,remoteCalls=[],captures=[],legacyMenus=[];
const react={
 useId:()=> 'qa-screen-identity',
 useState(initial){const scope=current,index=scope.cursor++;if(!(index in scope.hooks))scope.hooks[index]=typeof initial==='function'?initial():initial;return[scope.hooks[index],value=>{const next=typeof value==='function'?value(scope.hooks[index]):value;if(next!==scope.hooks[index]){scope.hooks[index]=next;scope.dirty=true;}}];},
 useRef(initial){return current.hooks[current.cursor++]??={current:initial};},
 useEffect(callback,deps){const scope=current,index=scope.cursor++,old=scope.hooks[index];if(!old||deps.some((value,i)=>value!==old.deps[i]))scope.effects.push(()=>{old?.cleanup?.();scope.hooks[index]={deps,cleanup:callback()};});},
};
const host={setTimeout:()=>1,clearTimeout(){},innerWidth:1280,innerHeight:720};
Object.defineProperty(global,'navigator',{configurable:true,value:{userAgent:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',mediaDevices:{getDisplayMedia(){throw Error('Unexpected actual capture');}}}});global.window=host;
const emptyView={sessions:[],sources:[],ready:true,error:false};
const panel=()=>({open:async()=>false,setSuppressed(){},setLabels(){},sync(){},dispose(){}});
const {ScreenShareButton}=load('../components/ScreenShareButton.tsx',{
 react,'react/jsx-runtime':{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})},
 '@/lib/use-remote-pc':{useRemotePc:()=>emptyView},
 '@/lib/remote-pc-client':{beginRemotePc:async(room)=>{remoteCalls.push({identity:room.localParticipant.identity,sid:room.localParticipant.sid});return{ticket:'rp1_'+'a'.repeat(43),ticketExpiresAt:Date.now()+120000,session:{id:'session',generation:'generation',revision:0,phase:'pairing',owner:{identity:room.localParticipant.identity,sid:room.localParticipant.sid}}};},remotePcRequest:async(_room,body)=>body.action==='read'?{sessions:[]}:{session:{phase:'stopped'}}},
 '@/lib/remote-pc-sources':{resolveRemotePcScreen:()=>undefined},
 './CoPresentationNavigation':{useCoPresentationNavigation:()=>undefined,ownerSurfaceMatches:()=>false},
 '@/components/I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 './I18nProvider':{useI18n:()=>({locale:'ru',t:value=>value})},
 '@/lib/i18n/workspaces':{translateWorkspaceMessage:(_,value)=>value},
 '@/lib/co-presentation-client':{isCoPresentationTrack:()=>false},
 '@/lib/co-presentation-menu':{requestCoPresentationMenu:room=>{legacyMenus.push(room);return false;}},
 '@/lib/screen-share':{enableRoomScreenShare:async(room)=>{captures.push(room);return false;},enableStudioScreenShare:async(room)=>{captures.push(room);return false;},setRoomScreenShareOutputMuted(){},stopStudioScreenShare:async()=>{}},
 '@/lib/screen-share-stop-panel':{documentPictureInPictureApi:()=>undefined,createScreenShareStopPanel:panel},
 '@/lib/desktop-stop-panel':{desktopScreenBridge:()=>undefined,createDesktopStopPanel:panel},
 '@livekit/components-react':{ScreenShareIcon:()=>null},
});
function renderer(room){const scope={hooks:[],cursor:0,effects:[],dirty:false};return{render(){let tree,passes=0;do{assert.ok(++passes<20,'Effects settle');current=scope;scope.cursor=0;scope.dirty=false;tree=ScreenShareButton({room});while(scope.effects.length)scope.effects.shift()();}while(scope.dirty);return tree;},unmount(){scope.hooks.forEach(hook=>hook?.cleanup?.());}};}
function sdkRoom(){delete global.window;const room=new Room();global.window=host;return room;}
const nodes=n=>!n||typeof n!=='object'?[]:Array.isArray(n)?n.flatMap(nodes):[n,...nodes(n.props?.children)];
const main=tree=>nodes(tree).find(n=>n.type==='button');
const settle=async()=>{for(let i=0;i<5;i++)await new Promise(setImmediate);};
function connect(room,identity,sid,event=RoomEvent.Connected){room.localParticipant.identity=identity;room.localParticipant.sid=sid;room.state='connected';room.emit(event);}
(async()=>{
 const prejoin=sdkRoom();assert.equal(prejoin.localParticipant.identity,'','SDK identity is empty before joining');const connectedBaseline=prejoin.listenerCount(RoomEvent.Connected),first=renderer(prejoin);let tree=first.render();assert.equal(main(tree).props.disabled,true);
 connect(prejoin,'guest-owner','owner-sid');tree=first.render();assert.equal(main(tree).props.disabled,false);main(tree).props.onClick();await settle();assert.equal(remoteCalls.length,1,'same Room Connected identity must enable the remote-PC begin path');assert.equal(remoteCalls[0].identity,'guest-owner');assert.equal(captures.length,0,'Windows guest never falls through to getDisplayMedia after first join');assert.equal(legacyMenus.length,0,'Windows guest never opens legacy PowerPoint controls');first.unmount();assert.equal(prejoin.listenerCount(RoomEvent.Connected),connectedBaseline,'routing refresh shares the existing cleaned-up connection listener');
 remoteCalls=[];captures=[];const joined=sdkRoom();connect(joined,'guest-owner','initial-sid');const mountedJoined=renderer(joined);tree=mountedJoined.render();main(tree).props.onClick();await settle();assert.equal(remoteCalls.length,1,'already joined Windows guest keeps the component path');mountedJoined.unmount();
 remoteCalls=[];captures=[];const reconnect=sdkRoom();connect(reconnect,'studio-panel-main','staff-sid');const reconnectView=renderer(reconnect);reconnectView.render();reconnect.state='disconnected';reconnect.localParticipant.identity='';reconnect.emit(RoomEvent.Disconnected);tree=reconnectView.render();assert.equal(main(tree).props.disabled,true);connect(reconnect,'guest-rejoined','new-owner-sid',RoomEvent.Reconnected);tree=reconnectView.render();main(tree).props.onClick();await settle();assert.equal(remoteCalls.length,1,'same Room reconnect refreshes routing from current identity');assert.equal(remoteCalls[0].sid,'new-owner-sid');assert.equal(captures.length,0);reconnectView.unmount();
 for(const value of [{ua:'Mozilla/5.0 (Macintosh; Intel Mac OS X)',identity:'guest-mac'},{ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',identity:'studio-panel-main'}]){
  remoteCalls=[];captures=[];navigator.userAgent=value.ua;const other=sdkRoom(),view=renderer(other);view.render();connect(other,value.identity,'negative-sid');tree=view.render();main(tree).props.onClick();await settle();assert.equal(remoteCalls.length,0,'non-Windows or non-guest does not gain PC ownership');assert.equal(captures.length,1,'existing ordinary browser capture remains');view.unmount();
 }
 navigator.userAgent='Mozilla/5.0 (Windows NT 10.0; Win64; x64)';remoteCalls=[];captures=[];const fallback=sdkRoom();connect(fallback,'guest-fallback','fallback-sid');const fallbackView=renderer(fallback);tree=fallbackView.render();main(tree).props.onClick();await settle();tree=fallbackView.render();const setup=nodes(tree).find(n=>typeof n.type==='function'&&n.type.name==='ScreenShareSetup');assert.ok(setup);setup.props.onCancel();await settle();tree=fallbackView.render();main(tree).props.onClick();await settle();assert.equal(remoteCalls.length,1,'explicit view-only does not restart the companion');assert.equal(captures.length,1,'explicit view-only retains browser capture');fallbackView.unmount();
 console.log('PASS actual SDK prejoin identity + ScreenShareButton Connected/reconnected routing, no browser/PPT bypass, role/platform negatives, explicit view-only and listener cleanup');
})().catch(error=>{console.error(error);process.exitCode=1});
