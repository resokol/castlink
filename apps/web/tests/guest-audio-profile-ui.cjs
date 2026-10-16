require('./i18n-fixture.cjs');
const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
for(const extension of ['.ts','.tsx'])Module._extensions[extension]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
const audio=require('../lib/guest-audio.ts'),media=require('../lib/guest-media.ts'),video=require('../lib/guest-video-codec.ts');
let cursor=0,hooks=[],effects=[],meterStops=0;
const react={
 useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],value=>hooks[i]=typeof value==='function'?value(hooks[i]):value];},
 useRef(initial){const i=cursor++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];},
 useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,j)=>value!==old.deps[j]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:effect()};});},
};
const tones=[],meters=[];const AudioMeter=()=>null,MediaDevicePicker=()=>null;
const originalLoad=Module._load;
Module._load=function(name,...args){
 if(name==='@/lib/guest-entry-settings')return require('../lib/guest-entry-settings.ts');
 if(name==='react')return react;
 if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
 if(name==='./MediaDevicePicker')return{MediaDevicePicker};if(name==='./AudioMeter')return{AudioMeter};
 if(name==='@/lib/guest-video-codec')return video;
 if(name==='@/lib/guest-media')return media;if(name==='@/lib/guest-audio')return audio;
 if(name==='@/lib/audio-meter')return{METER_FLOOR_DB:-90,observePcmTrack(track,onLevel){meters.push({track,onLevel});return()=>meterStops++;}};
 if(name==='@/lib/audio-device-test')return{startSpeakerTest(output){let finish;const test={output,stops:0,finished:new Promise(resolve=>finish=resolve),stop(){this.stops++;finish();}};tones.push(test);return test;}};
 return originalLoad.call(this,name,...args);
};
const {GuestAvCheck}=require('../components/GuestAvCheck.tsx');Module._load=originalLoad;
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const render=props=>{cursor=0;const tree=GuestAvCheck(props);while(effects.length)effects.shift()();return tree;};
const reset=()=>{for(const hook of hooks)hook?.cleanup?.();hooks=[];effects=[];cursor=0;};
const button=(tree,label)=>nodes(tree).find(node=>node.type==='button'&&node.props.children===label);
const picker=tree=>nodes(tree).find(node=>node.type===MediaDevicePicker);
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const pending=[],captured=[],joined=[];
function stream(id){const track={stopped:0,stop(){this.stopped++;},getSettings:()=>({deviceId:id})};return{track,getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]};}
global.window={isSecureContext:true};Object.defineProperty(global,'navigator',{configurable:true,value:{mediaDevices:{getUserMedia(constraints){captured.push(constraints);return new Promise(resolve=>pending.push(resolve));},enumerateDevices:async()=>[]}}});
(async()=>{
 const props={name:'Guest',onJoin:value=>joined.push(value)};
 let tree=render(props);assert.equal(nodes(tree).some(node=>String(node.type?.name).includes('GuestAudioProfileSelector')),false,'prejoin never exposes the studio-controlled audio profile');
 button(tree,'Проверить микрофон').props.onClick();assert.equal(captured[0].video,false,'microphone-only test never requests the camera');assert.equal(captured[0].audio.noiseSuppression,true);
 tree=render(props);button(tree,'Войти без микрофона').props.onClick();const stale=stream('old-mic');pending.shift()(stale);await settle();assert.equal(stale.track.stopped,1,'changed choices release an in-flight capture');
 tree=render(props);assert.equal(button(tree,'Проверить микрофон').props.disabled,true,'disabled microphones cannot be enabled by testing');
 button(tree,'Микрофон отключён ✓').props.onClick();tree=render(props);button(tree,'Проверить микрофон').props.onClick();const preview=stream('preview-mic');pending.shift()(preview);await settle();
 assert.equal(captured[1].video,false);assert.equal(meters.length,1);meters[0].onLevel(-12);tree=render(props);assert.equal(nodes(tree).find(node=>node.type===AudioMeter).props.db,-12,'actual meter measurements are visible');
 picker(tree).props.onChange({microphoneId:'new-mic'});assert.equal(preview.track.stopped,1);assert.equal(meterStops,1,'device change disposes the PCM context observer');
 tree=render(props);picker(tree).props.onChange({headphonesId:'chosen-output'});tree=render(props);button(tree,'Проверить наушники / динамики').props.onClick();assert.equal(tones[0].output,'chosen-output');assert.equal(captured.length,2,'speaker test never opens a capture device');
 tree=render(props);picker(tree).props.onChange({headphonesId:'other-output'});await settle();assert.equal(tones[0].stops,1,'changing output cancels the prior tone');
 tree=render(props);button(tree,'Проверить наушники / динамики').props.onClick();assert.equal(tones[1].output,'other-output');
 tree=render(props);button(tree,'Войти в конференцию').props.onClick();assert.equal(tones[1].stops,1,'joining stops test playback');const joinedStream=stream('new-mic');pending.shift()(joinedStream);await settle();assert.equal(joinedStream.track.stopped,1);assert.equal(joined[0].audioProfile,'speech');reset();
 const before=captured.length,savedRaw={height:720,micGain:80,listenGain:90,audioEnabled:false,videoEnabled:false,audioProfile:'raw',connectionRoute:'normal',videoCodec:'av1'};
 tree=render({...props,initialChoices:savedRaw});await new Promise(resolve=>setTimeout(resolve,5));await settle();assert.equal(joined.at(-1).audioProfile,'raw');assert.equal(joined.at(-1).connectionRoute,'normal');assert.equal(joined.at(-1).videoCodec,'av1','accepted transfer preserves codec selection while camera is off');assert.equal(joined.at(-1).audioEnabled,false);assert.equal(joined.at(-1).videoEnabled,false);assert.equal(captured.length,before,'receive-only restoration does not open disabled devices');reset();
 tree=render({...props,initialChoices:{...savedRaw,audioProfile:undefined,videoCodec:'invalid-saved-codec'}});await new Promise(resolve=>setTimeout(resolve,5));await settle();assert.equal(joined.at(-1).audioProfile,'speech','legacy choices retain the speech default');assert.equal(joined.at(-1).videoCodec,'vp8','absent or invalid transfer codec preserves legacy VP8 default');reset();
 tree=render({...props,initialChoices:{...savedRaw,audioEnabled:true}});await new Promise(resolve=>setTimeout(resolve,5));assert.equal(captured.at(-1).video,false);assert.equal(captured.at(-1).audio.noiseSuppression,false,'hidden saved raw choices still govern microphone capture');const restored=stream('restored-raw');pending.shift()(restored);await settle();assert.equal(joined.at(-1).audioProfile,'raw');assert.equal(restored.track.stopped,1);reset();
 tree=render(props);button(tree,'Проверить микрофон').props.onClick();const unmounted=stream('unmounted');reset();pending.shift()(unmounted);await settle();assert.equal(unmounted.track.stopped,1,'leaving releases a late permission response');
 console.log('PASS: no guest profile selector, microphone-only capture and actual level, disabled/stale/unmounted capture disposal, chosen-output speaker test and stop on change/join, raw/legacy receive-only and captured transfer restoration');
})().catch(error=>{console.error(error);process.exitCode=1;});
