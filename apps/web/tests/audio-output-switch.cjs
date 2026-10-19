require('./i18n-fixture.cjs');
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
 const locked=render({...base,disabledOutput:true});
 assert.equal(nodes(locked).find(node=>node.type==='select'&&node.props['aria-label']==='Наушники / динамики').props.disabled,true,'remote confirmation locks local output selection');
 assert.equal(observer,undefined,'old output observer is paused during remote device mutation');
 await applyAudioOutput(room,'confirmed-remote',[remote,local],true);
 room.emit(RoomEvent.Reconnected);await sleep(20);
 assert.equal(remote.sinkId,'confirmed-remote','old picker choice cannot overwrite the confirmed remote mutation');
 render({...base,headphonesId:'confirmed-remote',disabledOutput:false});await sleep(30);
 assert.equal(local.sinkId,'confirmed-remote','picker resumes with the committed remote choice');
 reset();
 const fastRemote=new MediaElement('SDK rapid'),fastLocal=new MediaElement('local rapid'),fastRoom=new MockRoom(fastRemote),fastStatuses=[];fastRoom.emitInsertion=false;mediaElements=[fastRemote,fastLocal];
 const fast={...base,room:fastRoom,onOutputStatus:(id,error)=>fastStatuses.push({id,error})};render({...fast,headphonesId:'A'});render({...fast,headphonesId:'A'});await sleep(1);render({...fast,headphonesId:'B'});render({...fast,headphonesId:'C'});await sleep(60);
 assert.equal(fastRemote.sinkId,'C');assert.equal(fastLocal.sinkId,'C');assert.equal(fastRoom.options.audioOutput.deviceId,'C','an old failed SDK operation cannot restore default over the new selection');assert.deepEqual(fastStatuses,[{id:'C',error:''}],'only the newest choice reports completion');
 assert.equal(await applyAudioOutput(fastRoom,'default',[fastRemote,fastLocal],false),false,'an old auxiliary observer cannot restore default after the latest explicit selection');assert.equal(fastRemote.sinkId,'C');assert.equal(fastLocal.sinkId,'C');
 assert.ok(!fastRemote.calls.includes('B'),'obsolete queued choices do not temporarily play through another device');
 fastRemote.fail=Object.assign(new Error('The operation could not be performed and was aborted'),{name:'AbortError'});render({...fast,headphonesId:'broken'});await sleep(40);assert.match(fastStatuses.at(-1).error,/Проверьте подключение устройства/,'a genuine current AbortError stays visible with actionable guidance');assert.equal(fastRoom.options.audioOutput.deviceId,'C');
 reset();
 const localOnly=new MediaElement('local only');mediaElements=[localOnly];
 const old=applyAudioOutput(undefined,'old-device',[localOnly]);await sleep(1);const latest=applyAudioOutput(undefined,'latest-device',[localOnly]);
 assert.equal(await old,false,'superseded in-flight routes do not report a false success');assert.equal(await latest,true);assert.equal(localOnly.sinkId,'latest-device');
 assert.equal(await applyAudioOutput(undefined,'default',[localOnly],false),false);assert.equal(localOnly.sinkId,'latest-device','stale local-only DOM/reconnect work preserves the current selected output');
 const detached=new MediaElement('detached monitor');detached.isConnected=false;await applyAudioOutput(undefined,'chosen',[detached]);assert.deepEqual(detached.calls,[],'removed elements are not given late sink writes');
 const localFailure=new MediaElement('local genuine failure');localFailure.fail=Object.assign(new Error('no output access'),{name:'NotAllowedError'});await assert.rejects(applyAudioOutput(undefined,'denied',[localFailure]),/no output access/,'permission errors remain real failures');
 assert.equal(localFailure.calls.length,1,'permission failures are not retried');
 const interruptedLocal=new MediaElement('Studio Return source change'),nativeLocalSet=interruptedLocal.setSinkId.bind(interruptedLocal);let changeSourceOnce=true;
 interruptedLocal.setSinkId=id=>{const pending=nativeLocalSet(id);if(changeSourceOnce){changeSourceOnce=false;setTimeout(()=>{const request=interruptedLocal.pending;interruptedLocal.pending=undefined;request.reject(Object.assign(new Error('source replacement aborted switch'),{name:'AbortError'}));},1);}return pending;};
 assert.equal(await applyAudioOutput(undefined,'return-headphones',[interruptedLocal]),true);assert.equal(interruptedLocal.sinkId,'return-headphones');assert.deepEqual(interruptedLocal.calls,['return-headphones','return-headphones'],'source replacement gets one confirmed native retry');
 // Native errors can arrive from a different JavaScript realm.
 const foreignAbort=require('node:vm').runInNewContext(`Object.assign(new Error('The operation could not be performed and was aborted'),{name:'AbortError'})`);
 assert.equal(foreignAbort instanceof Error,false);
 const foreignLocal=new MediaElement('foreign interrupted native output'),nativeForeign=foreignLocal.setSinkId.bind(foreignLocal);let interruptForeign=true;
 foreignLocal.setSinkId=id=>{foreignLocal.fail=interruptForeign?foreignAbort:null;interruptForeign=false;return nativeForeign(id);};
 assert.equal(await applyAudioOutput(undefined,'foreign-headphones',[foreignLocal]),true,'foreign native AbortError must receive the same bounded recovery');
 assert.equal(foreignLocal.sinkId,'foreign-headphones');assert.equal(foreignLocal.calls.length,2);
 const foreignRemote=new MediaElement('foreign interrupted SDK output'),foreignRoom=new MockRoom(foreignRemote),nativeForeignRemote=foreignRemote.setSinkId.bind(foreignRemote);let interruptRemote=true;
 foreignRemote.setSinkId=id=>{foreignRemote.fail=interruptRemote?foreignAbort:null;interruptRemote=false;return nativeForeignRemote(id);};
 assert.equal(await applyAudioOutput(foreignRoom,'foreign-sdk-headphones',[foreignRemote]),true);
 assert.equal(foreignRoom.getActiveDevice('audiooutput'),'foreign-sdk-headphones');assert.equal(foreignRemote.calls.length,2);
 const foreignDenied=new MediaElement('foreign denied output');foreignDenied.fail=require('node:vm').runInNewContext(`Object.assign(new Error('permission denied'),{name:'NotAllowedError'})`);
 await assert.rejects(applyAudioOutput(undefined,'denied',[foreignDenied]),error=>error===foreignDenied.fail);assert.equal(foreignDenied.calls.length,1);
 const foreignPersistent=new MediaElement('persistent foreign native interruption');foreignPersistent.fail=foreignAbort;mediaElements=[foreignPersistent];
 render({...base,room:undefined,headphonesId:'persistent-foreign'});render({...base,room:undefined,headphonesId:'persistent-foreign'});await sleep(40);
 const foreignAlert=nodes(render({...base,room:undefined,headphonesId:'persistent-foreign'})).find(node=>node.props?.role==='alert');
 assert.ok(foreignAlert,'persistent native abort remains a visible failure');assert.match(JSON.stringify(foreignAlert),/Проверьте подключение устройства/,'native AbortError gives an actionable translated message');
 assert.equal(foreignPersistent.calls.length,2);assert.equal(foreignPersistent.sinkId,'default','no false routing success');reset();
 const abortedLocal=new MediaElement('current persistent interruption');abortedLocal.fail=Object.assign(new Error('persistent abort'),{name:'AbortError'});
 await assert.rejects(applyAudioOutput(undefined,'unavailable',[abortedLocal]),/persistent abort/);assert.equal(abortedLocal.calls.length,2,'current AbortError has one bounded retry and then stays visible');
 const dishonestLocal=new MediaElement('native operation resolves with wrong sink');dishonestLocal.setSinkId=async()=>{};
 await assert.rejects(applyAudioOutput(undefined,'unconfirmed',[dishonestLocal]),/не подтвердил/,'native promise success alone is not routing confirmation');
 const supersededAbort=new MediaElement('old aborted route'),nativeSuperseded=supersededAbort.setSinkId.bind(supersededAbort);
 supersededAbort.setSinkId=id=>{supersededAbort.fail=id==='old'?Object.assign(new Error('old interruption'),{name:'AbortError'}):null;return nativeSuperseded(id);};
 const oldAbort=applyAudioOutput(undefined,'old',[supersededAbort]);await sleep(1);const newAfterAbort=applyAudioOutput(undefined,'new',[supersededAbort]);
 assert.equal(await oldAbort,false);assert.equal(await newAfterAbort,true);assert.deepEqual(supersededAbort.calls,['old','new'],'superseded interruptions do not retry an obsolete output');
 const removedDuringSwitch=new MediaElement('removed during native switch'),nativeRemoved=removedDuringSwitch.setSinkId.bind(removedDuringSwitch);
 removedDuringSwitch.setSinkId=id=>{const pending=nativeRemoved(id);setTimeout(()=>{removedDuringSwitch.isConnected=false;const request=removedDuringSwitch.pending;removedDuringSwitch.pending=undefined;request.reject(Object.assign(new Error('element removed'),{name:'AbortError'}));},1);return pending;};
 await applyAudioOutput(undefined,'chosen',[removedDuringSwitch]);assert.equal(removedDuringSwitch.calls.length,1,'teardown never starts a late retry on a removed element');
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
 // Studio's renderer may re-attach while a speaker selection is in flight.
 // The installed SDK attach method starts its own unawaited native sink call.
 global.HTMLVideoElement=class extends MediaElement{};
 global.MediaStream=class{constructor(){this.tracks=[];}getTracks(){return this.tracks;}getAudioTracks(){return this.tracks.filter(t=>t.kind==='audio');}getVideoTracks(){return this.tracks.filter(t=>t.kind==='video');}addTrack(t){this.tracks.push(t);}removeTrack(t){this.tracks=this.tracks.filter(x=>x!==t);}};
 const reattached=new MediaElement('Studio renderer reattach');reattached.play=()=>Promise.resolve();
 const reattachTrack=new sdk.RemoteAudioTrack({kind:'audio',id:'studio-remote-audio',enabled:true},'TR_audio',undefined);
 const attachLogs=[];reattachTrack.log={error:(...args)=>attachLogs.push(args)};
 reattachTrack.attachedElements=[reattached];reattachTrack.setVolume(.2);
 const reattachPublication={track:reattachTrack,kind:sdk.Track.Kind.Audio},reattachParticipant=Object.create(sdk.RemoteParticipant.prototype);
 Object.assign(reattachParticipant,{trackPublications:new Map([['audio',reattachPublication]]),audioTrackPublications:new Map([['audio',reattachPublication]])});
 const reattachRoom=new EventEmitter();let attachOnce=true;
 Object.assign(reattachRoom,{state:'connected',options:{webAudioMix:false,audioOutput:{deviceId:'default'}},remoteParticipants:new Map([['guest',reattachParticipant]]),localParticipant:{activeDeviceMap:new Map([['audiooutput','default']])},getActiveDevice(kind){return this.localParticipant.activeDeviceMap.get(kind);},switchActiveDevice(kind,id){const pending=sdk.Room.prototype.switchActiveDevice.call(this,kind,id);if(attachOnce){attachOnce=false;setTimeout(()=>reattachTrack.attach(reattached),1);}return pending;}});
 mediaElements=[reattached];const reattachStatuses=[],reattachProps={...base,room:reattachRoom,headphonesId:'studio-headphones',onOutputStatus:(id,error)=>reattachStatuses.push({id,error})};
 render(reattachProps);render(reattachProps);await sleep(60);
 assert.equal(reattached.sinkId,'studio-headphones','SDK reattach actually routes audio to the requested sink');
 assert.equal(reattachStatuses.at(-1).error,'','a successful SDK reattach must not leave Studio reporting aborted output');
 assert.equal(reattachRoom.getActiveDevice('audiooutput'),'studio-headphones','actual routing and SDK active-device bookkeeping agree after reattach');
 assert.equal(reattachRoom.options.audioOutput.deviceId,'studio-headphones');assert.equal(reattached.volume,.2);reset();
 assert.deepEqual(reattached.calls,['studio-headphones','studio-headphones','studio-headphones'],'installed SDK selection, asynchronous attach, and one bounded SDK retry');assert.equal(attachLogs.length,1,'SDK catches its interrupted fire-and-forget attach setter');
 const wrongRemote=new MediaElement('second SDK audio with unconfirmed routing');wrongRemote.setSinkId=async()=>{};
 const wrongTrack=Object.create(sdk.RemoteAudioTrack.prototype);Object.assign(wrongTrack,{kind:sdk.Track.Kind.Audio,attachedElements:[wrongRemote]});
 const wrongPublication={track:wrongTrack,kind:sdk.Track.Kind.Audio};reattachParticipant.trackPublications.set('second',wrongPublication);reattachParticipant.audioTrackPublications.set('second',wrongPublication);
 await assert.rejects(applyAudioOutput(reattachRoom,'new-headphones',[reattached,wrongRemote]),/не подтвердил/,'all SDK remote sinks must agree, not only the element whose output changed');
 reattachParticipant.trackPublications.delete('second');reattachParticipant.audioTrackPublications.delete('second');
 reattached.fail=Object.assign(new Error('SDK persistent abort'),{name:'AbortError'});const beforeAbort=reattached.calls.length;
 await assert.rejects(applyAudioOutput(reattachRoom,'failed-headphones',[reattached]),/SDK persistent abort/);assert.equal(reattached.calls.length-beforeAbort,2,'installed SDK persistent abort retries once and remains a real failure');
 console.log('PASS: installed SDK asynchronous reattach RED regression, bounded interrupted-switch recovery with actual sink and SDK state confirmation, multiple-remote verification, latest routing, monitor volume retained, persistent AbortError/permission/mismatched-sink failures visible, detached cleanup and explicit default');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(reset);
