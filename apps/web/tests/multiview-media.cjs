const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
function load(file){const p=path.resolve(__dirname,'../lib/'+file+'.ts'); const m=new Module(p,module);m.filename=p;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,p);return m.exports;}
assert.ok(fs.existsSync(path.resolve(__dirname,'../lib/multiview-media.ts')),'multiview binding not implemented');
const {bindMultiviewVideo,uniqueMultiviewAudio}=load('multiview-media');
const element={srcObject:null,hidden:true};let available=false;
function track(){return {mediaStreamTrack:{readyState:'live'},attaches:0,detaches:0,attach(e){this.attaches++;e.srcObject=this;},detach(e){this.detaches++;e.srcObject=null;}};}
const a=track(),b=track(),bind=bindMultiviewVideo(element,v=>available=v);
bind.update({track:a,isMuted:false});assert.equal(available,true);assert.equal(a.attaches,1);
bind.update({track:a,isMuted:false});assert.equal(a.attaches,1);
bind.update(undefined);assert.equal(available,false);assert.equal(element.srcObject,null,'missing source transparent, no frozen frame');
bind.update({track:b,isMuted:false});assert.equal(available,true);assert.equal(element.srcObject,b,'same slot recovers replacement track');
bind.update({track:b,isMuted:true});assert.equal(available,false);assert.equal(element.srcObject,null);
bind.update({track:b,isMuted:false});assert.equal(available,true);
b.mediaStreamTrack.readyState='ended';bind.update({track:b,isMuted:false});assert.equal(available,false);bind.clear();
const tiles=[{sourceIdentity:'guest-a',source:'camera',muted:false},{sourceIdentity:'guest-a',source:'camera',muted:false},{sourceIdentity:'guest-a',source:'screen',muted:false},{sourceIdentity:'guest-b',source:'camera',muted:true}];
assert.equal(uniqueMultiviewAudio(tiles).length,2,'duplicate slot audio plays once');assert.deepEqual(uniqueMultiviewAudio([{sourceIdentity:'',source:'camera',muted:false}]),[]);
console.log('PASS: transparent missing/muted/ended video, replacement recovery, idempotent attachment, distinct audio sources');

// Render the production component with decoded video dimensions. Cropping must
// mask source pixels without moving/resizing the source or scene frame.
const {EventEmitter}=require('node:events');
let cursor=0,hooks=[],effects=[],componentTree;
const video={style:{},videoWidth:320,videoHeight:180,srcObject:null,listeners:new Map(),addEventListener(k,f){this.listeners.set(k,f);},removeEventListener(k){this.listeners.delete(k);}};
const react={useRef(initial){const i=cursor++;return hooks[i]??=( {current:initial});},useState(initial){const i=cursor++;hooks[i]??={value:initial};return[hooks[i].value,next=>hooks[i].value=typeof next==='function'?next(hooks[i].value):next];},useEffect(fn,deps){const i=cursor++,old=hooks[i];if(old&&deps.every((dep,j)=>dep===old.deps[j]))return;effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:fn()};});}};
const events=Object.fromEntries(['TrackSubscribed','TrackUnsubscribed','TrackPublished','TrackUnpublished','TrackMuted','TrackUnmuted','ParticipantConnected','ParticipantDisconnected','Reconnecting','Reconnected','Disconnected'].map(k=>[k,k]));
const nativeLoad=Module._load;
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,f);
Module._load=function(name,...args){
 if(name==='react')return react;
 if(name==='react/jsx-runtime')return{jsx,jsxs:jsx};
 if(name==='livekit-client')return{RoomEvent:events,Track:{Source:{Camera:'camera',ScreenShare:'screen'}}};
 if(name==='@/components/I18nProvider')return{useI18n:()=>({locale:'en'})};
 if(name.startsWith('@/lib/'))return nativeLoad.call(this,path.resolve(__dirname,'..',name.slice(2)+'.ts'),...args);
 return nativeLoad.call(this,name,...args);
};
function jsx(type,props){if(type==='video'&&props.ref)props.ref.current=video;return{type,props};}
const componentPath=path.resolve(__dirname,'../components/multiview/MultiviewMedia.tsx'),compiled=new Module(componentPath,module);compiled.filename=componentPath;compiled.paths=module.paths;
compiled._compile(ts.transpileModule(fs.readFileSync(componentPath,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,componentPath);
const Media=compiled.exports.default;
Module._load=nativeLoad;
const room=new EventEmitter();room.state='connected';room.remoteParticipants=new Map([['guest-a',{getTrackPublication:()=>({track:a,isMuted:false})}]]);
const croppedTile={id:'crop',sourceIdentity:'guest-a',source:'camera',fit:'contain',muted:true,x:0,y:0,width:1,height:1,transform:{cropLeft:.3,cropRight:.1,cropTop:.1,cropBottom:.2}};
let reports=[];const onDimensions=(...args)=>reports.push(args);
function renderMedia(tile=croppedTile,editor=false){cursor=0;componentTree=Media({room,tile,onDimensions,editor});while(effects.length)effects.shift()();return componentTree;}
function find(tree,predicate){if(!tree||typeof tree!=='object')return; if(predicate(tree))return tree;for(const child of [tree.props?.children].flat(Infinity)){const found=find(child,predicate);if(found)return found;}}
try{
 renderMedia();video.listeners.get('loadedmetadata')();renderMedia();
 const renderedVideo=find(componentTree,node=>node.type==='video');
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
 near(parseFloat(renderedVideo.props.style.width),100);
 near(parseFloat(renderedVideo.props.style.height),100);
 assert.equal(renderedVideo.props.style.left,undefined,'Crop must not offset the original source');
 assert.equal(renderedVideo.props.style.transformOrigin,'center','Crop must not move the rotation/zoom pivot');
 const frame=find(componentTree,node=>node.props?.['data-multiview-aspect']);
 assert.deepEqual(frame.props.style,{position:'absolute',inset:0,containerType:'size'},'Crop preserves the original source frame');
 assert.ok(reports.some(args=>args[2]===320&&args[3]===180));
 room.state='reconnecting';room.emit(events.Reconnecting);assert.equal(video.srcObject,null,'Reconnect drops the frozen source');
 room.state='connected';room.remoteParticipants.set('guest-a',{getTrackPublication:()=>({track:b,isMuted:false})});b.mediaStreamTrack.readyState='live';room.emit(events.Reconnected);assert.equal(video.srcObject,b,'Reconnect binds the replacement source');
 video.videoWidth=180;video.videoHeight=320;video.listeners.get('resize')();renderMedia();
 const nextFrame=find(componentTree,node=>node.props?.['data-multiview-aspect']);
 assert.deepEqual(nextFrame.props.style,frame.props.style,'Replacement dimensions update the source mask without moving the frame');
 for(const fit of ['contain','cover'])for(const aspectRatio of ['source','16:9','4:3'])for(const transform of [{},{zoom:1.7,panX:.15,panY:-.1,rotation:33,flipX:true},{rotation:90,flipY:true}]){
  const originalTile={...croppedTile,fit,aspectRatio,transform};
  renderMedia(originalTile);
  const originalVideo=find(componentTree,node=>node.type==='video').props.style;
  const originalFrame=find(componentTree,node=>node.props?.['data-multiview-aspect']).props.style;
  const maskedTile={...originalTile,transform:{...transform,...croppedTile.transform}};
  renderMedia(maskedTile);
  const maskedVideo=find(componentTree,node=>node.type==='video').props.style;
  const maskedFrame=find(componentTree,node=>node.props?.['data-multiview-aspect']).props.style;
  assert.deepEqual(maskedFrame,originalFrame,'Crop preserves explicit/source frame geometry');
  for(const key of ['width','height','left','top','transform','transformOrigin','objectFit'])assert.equal(maskedVideo[key],originalVideo[key],'Crop preserves '+key);
  assert.notEqual(maskedVideo.clipPath,originalVideo.clipPath,'Crop changes the source mask');
  renderMedia(maskedTile,true);
  assert.deepEqual(find(componentTree,node=>node.type==='video').props.style,maskedVideo,'Editor and clean output use the same crop geometry');
 }
 console.log('PASS production multiview stationary source crop, transform/editor-output parity and replacement dimensions after reconnect');
}finally{for(const hook of hooks)hook?.cleanup?.();}
