const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),{EventEmitter}=require('node:events');
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,f);
let cursor=0,hooks=[],effects=[],observer,mediaElements=[];
const react={useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],value=>hooks[i]=typeof value==='function'?value(hooks[i]):value];},useRef(initial){const i=cursor++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];},useMemo(fn){cursor++;return fn();},useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,j)=>value!==old.deps[j]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:effect()};});}};
class MediaElement{
 constructor(label){this.label=label;this.sinkId='default';this.calls=[];this.isConnected=true;this.pending=undefined;this.fail=null;this.volume=.2;this.muted=false;}
 matches(){return true;}querySelectorAll(){return[];}
 setSinkId(id){this.calls.push(id);if(this.pending)this.pending.reject(Object.assign(new Error('The operation could not be performed and was aborted'),{name:'AbortError'}));return new Promise((resolve,reject)=>{const request={reject};this.pending=request;setTimeout(()=>{if(this.pending!==request)return;this.pending=undefined;if(this.fail){reject(this.fail);return;}this.sinkId=id;resolve();},8);});}
}
global.Element=MediaElement;global.HTMLMediaElement=MediaElement;
global.document={body:{},querySelectorAll:()=>mediaElements,createElement:()=>new MediaElement('support probe')};
global.MutationObserver=class{constructor(callback){this.callback=callback;observer=this;}observe(){}disconnect(){if(observer===this)observer=undefined;}};
Object.defineProperty(global,'navigator',{configurable:true,value:{userAgent:'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124.0.0.0 Safari/537.36',mediaDevices:{enumerateDevices:async()=>[],addEventListener(){},removeEventListener(){}}}});
const RoomEvent={Connected:'connected',Reconnected:'reconnected',LocalTrackPublished:'local-track-published'};
const load=Module._load;
Module._load=function(name,...args){if(name==='react')return react;if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};if(name==='livekit-client')return{RoomEvent};if(name==='@/lib/audio-output')return require('../lib/audio-output.ts');return load.call(this,name,...args);};
const {MediaDevicePicker}=require('../components/MediaDevicePicker.tsx');
const {AudioOutputSelect}=require('../components/AudioOutputSelect.tsx');Module._load=load;
const {applyAudioOutput}=require('../lib/audio-output.ts');
const render=(props,component=MediaDevicePicker)=>{cursor=0;const tree=component(props);while(effects.length)effects.shift()();return tree;};
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const reset=()=>{for(const hook of hooks)hook?.cleanup?.();hooks=[];effects=[];cursor=0;observer=undefined;};
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
class MockRoom extends EventEmitter{
 constructor(remote){super();this.state='connected';this.options={audioOutput:{deviceId:'default'}};this.active='default';this.remoteParticipants=new Map([['guest',{trackPublications:new Map([['audio',{kind:'audio',track:{attachedElements:[remote]}}]])}]]);this.remote=remote;this.calls=[];this.emitInsertion=true;}
 getActiveDevice(){return this.active;}
 async switchActiveDevice(kind,id){this.calls.push(id);const before=this.active;this.options.audioOutput.deviceId=id;const pending=this.remote.setSinkId(id);if(this.emitInsertion){this.emitInsertion=false;queueMicrotask(()=>observer?.callback([{addedNodes:[this.remote]}]));}try{await pending;this.active=id;return true;}catch(error){this.options.audioOutput.deviceId=before;throw error;}}
}
(async()=>{
 const remote=new MediaElement('SDK remote audio'),local=new MediaElement('local monitor video'),room=new MockRoom(remote),statuses=[];mediaElements=[remote,local];
 const base={room,headphonesId:'headphones-one',autoRequestPermissions:false,onChange(){},onOutputStatus:(id,error)=>statuses.push({id,error})};
 render(base);render(base);await sleep(40);
 assert.equal(statuses.at(-1).error,'','SDK attach + DOM observer must not turn a successful sink selection into an AbortError');
 assert.deepEqual(remote.calls,['headphones-one'],'only the SDK writes SDK-owned remote elements');assert.equal(local.sinkId,'headphones-one');assert.equal(remote.volume,.2,'output routing preserves personal monitor volume');
 reset();
 const fastRemote=new MediaElement('SDK rapid'),fastLocal=new MediaElement('local rapid'),fastRoom=new MockRoom(fastRemote),fastStatuses=[];fastRoom.emitInsertion=false;mediaElements=[fastRemote,fastLocal];
 const fast={...base,room:fastRoom,onOutputStatus:(id,error)=>fastStatuses.push({id,error})};render({...fast,headphonesId:'A'});render({...fast,headphonesId:'A'});await sleep(1);render({...fast,headphonesId:'B'});render({...fast,headphonesId:'C'});await sleep(60);
 assert.equal(fastRemote.sinkId,'C');assert.equal(fastLocal.sinkId,'C');assert.equal(fastRoom.options.audioOutput.deviceId,'C','an old failed SDK operation cannot restore default over the new selection');assert.deepEqual(fastStatuses,[{id:'C',error:''}],'only the newest choice reports completion');
 assert.equal(await applyAudioOutput(fastRoom,'default',[fastRemote,fastLocal],false),false,'an old auxiliary observer cannot restore default after the latest explicit selection');assert.equal(fastRemote.sinkId,'C');assert.equal(fastLocal.sinkId,'C');
 assert.ok(!fastRemote.calls.includes('B'),'obsolete queued choices do not temporarily play through another device');
 fastRemote.fail=Object.assign(new Error('The operation could not be performed and was aborted'),{name:'AbortError'});render({...fast,headphonesId:'broken'});await sleep(40);assert.match(fastStatuses.at(-1).error,/aborted/,'a genuine current AbortError stays visible');assert.equal(fastRoom.options.audioOutput.deviceId,'C');
 reset();
 const localOnly=new MediaElement('local only');mediaElements=[localOnly];
 const old=applyAudioOutput(undefined,'old-device',[localOnly]);await sleep(1);const latest=applyAudioOutput(undefined,'latest-device',[localOnly]);
 assert.equal(await old,false,'superseded in-flight routes do not report a false success');assert.equal(await latest,true);assert.equal(localOnly.sinkId,'latest-device');
 assert.equal(await applyAudioOutput(undefined,'default',[localOnly],false),false);assert.equal(localOnly.sinkId,'latest-device','stale local-only DOM/reconnect work preserves the current selected output');
 const detached=new MediaElement('detached monitor');detached.isConnected=false;await applyAudioOutput(undefined,'chosen',[detached]);assert.deepEqual(detached.calls,[],'removed elements are not given late sink writes');
 const localFailure=new MediaElement('local genuine failure');localFailure.fail=Object.assign(new Error('no output access'),{name:'NotAllowedError'});await assert.rejects(applyAudioOutput(undefined,'denied',[localFailure]),/no output access/,'permission errors remain real failures');
 const standalone=new MediaElement('auxiliary monitor');standalone.sinkId='existing-headphones';mediaElements=[standalone];
 render({},AudioOutputSelect);render({},AudioOutputSelect);await sleep(20);assert.equal(standalone.sinkId,'existing-headphones','mounting auxiliary default chooser does not redirect an existing selection');
 let tree=render({},AudioOutputSelect);nodes(tree).find(node=>node.type==='select').props.onChange({target:{value:'explicit-headphones'}});render({},AudioOutputSelect);await sleep(20);
 tree=render({},AudioOutputSelect);nodes(tree).find(node=>node.type==='select').props.onChange({target:{value:'default'}});render({},AudioOutputSelect);await sleep(20);assert.equal(standalone.sinkId,'default','an explicit user choice can return from headphones to system default');reset();
 // Exercise the installed SDK methods, not only the small deterministic model above.
 const sdk=require('livekit-client'),actualRemote=new MediaElement('actual SDK element'),actualLocal=new MediaElement('actual local'),track=Object.create(sdk.RemoteAudioTrack.prototype);
 Object.assign(track,{kind:sdk.Track.Kind.Audio,attachedElements:[actualRemote]});
 const publication={track,kind:sdk.Track.Kind.Audio},participant=Object.create(sdk.RemoteParticipant.prototype);
 Object.assign(participant,{trackPublications:new Map([['audio',publication]]),audioTrackPublications:new Map([['audio',publication]])});
 const sdkRoom=new EventEmitter();Object.assign(sdkRoom,{state:'connected',options:{webAudioMix:false,audioOutput:{deviceId:'default'}},remoteParticipants:new Map([['guest',participant]]),localParticipant:{activeDeviceMap:new Map([['audiooutput','default']])},getActiveDevice(kind){return this.localParticipant.activeDeviceMap.get(kind);},switchActiveDevice(kind,id){const pending=sdk.Room.prototype.switchActiveDevice.call(this,kind,id);queueMicrotask(()=>observer?.callback([{addedNodes:[actualRemote]}]));return pending;}});
 mediaElements=[actualRemote,actualLocal];const sdkStatuses=[],sdkProps={...base,room:sdkRoom,headphonesId:'actual-headphones',onOutputStatus:(id,error)=>sdkStatuses.push({id,error})};render(sdkProps);render(sdkProps);await sleep(50);
 assert.equal(sdkStatuses.at(-1).error,'');assert.equal(sdkRoom.getActiveDevice('audiooutput'),'actual-headphones');assert.deepEqual(actualRemote.calls,['actual-headphones'],'installed Room → RemoteParticipant → RemoteAudioTrack owns each remote sink call');assert.equal(actualLocal.sinkId,'actual-headphones');reset();
 console.log('PASS: SDK attach/observer race with installed SDK methods, single remote owner, rapid/latest/coalesced routing and actual status, monitor volume retained, genuine AbortError/permission errors visible, removed-element cleanup, auxiliary mount preserves chosen output and explicit default works');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(reset);
