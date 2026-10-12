const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
for (const extension of ['.ts','.tsx']) Module._extensions[extension]=(module,filename)=>module._compile(ts.transpileModule(fs.readFileSync(filename,'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX},
}).outputText,filename);
const audio=require('../lib/guest-audio.ts');
const media=require('../lib/guest-media.ts');
let cursor=0,hooks=[],effects=[];
const react={
  useState(initial){const i=cursor++;if(!(i in hooks))hooks[i]=typeof initial==='function'?initial():initial;return[hooks[i],value=>{hooks[i]=typeof value==='function'?value(hooks[i]):value;}];},
  useRef(initial){const i=cursor++;if(!(i in hooks))hooks[i]={current:initial};return hooks[i];},
  useEffect(effect,deps){const i=cursor++,old=hooks[i];if(!old||deps.some((value,j)=>value!==old.deps[j]))effects.push(()=>{old?.cleanup?.();hooks[i]={deps,cleanup:effect()};});},
};
const originalLoad=Module._load;
let GuestAudioProfileSelector;
Module._load=function(name,...rest){
  if(name==='react')return react;
  if(name==='react/jsx-runtime')return{jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})};
  if(name==='./MediaDevicePicker')return{MediaDevicePicker:()=>null};
  if(name==='@/lib/guest-media')return media;
  if(name==='@/lib/guest-audio')return audio;
  if(name==='./GuestAudioProfileSelector')return{GuestAudioProfileSelector};
  return originalLoad.call(this,name,...rest);
};
({GuestAudioProfileSelector}=require('../components/GuestAudioProfileSelector.tsx'));
const {GuestAvCheck}=require('../components/GuestAvCheck.tsx');
Module._load=originalLoad;
const nodes=node=>!node||typeof node!=='object'?[]:Array.isArray(node)?node.flatMap(nodes):[node,...nodes(node.props?.children)];
const render=props=>{cursor=0;const tree=GuestAvCheck(props);while(effects.length)effects.shift()();return tree;};
const reset=()=>{for(const hook of hooks)hook?.cleanup?.();hooks=[];effects=[];cursor=0;};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
const pending=[];
const captured=[];
function stream(label){
  const track={stopped:0,stop(){this.stopped++;},getSettings:()=>({deviceId:label})};
  return{track,getTracks:()=>[track],getAudioTracks:()=>[track],getVideoTracks:()=>[]};
}
global.window={isSecureContext:true};
Object.defineProperty(global,'navigator',{configurable:true,value:{mediaDevices:{
  getUserMedia(constraints){captured.push(constraints);return new Promise(resolve=>pending.push(resolve));},
  enumerateDevices:async()=>[],
}}});
global.AudioContext=class{close(){return Promise.resolve();}createAnalyser(){return{fftSize:256,frequencyBinCount:8,getByteFrequencyData:samples=>samples.fill(20)};}createMediaStreamSource(){return{connect(){}};}};
global.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
global.requestAnimationFrame=()=>1;
global.cancelAnimationFrame=()=>{};

(async()=>{
  let chosen;
  let selector=GuestAudioProfileSelector({onChange:profile=>{chosen=profile;}});
  const select=nodes(selector).find(node=>node.type==='select');
  assert.equal(select.props.value,'speech');
  assert.deepEqual(nodes(selector).filter(node=>node.type==='option').map(node=>node.props.value),['speech','raw']);
  select.props.onChange({target:{value:'raw'}});assert.equal(chosen,'raw');
  selector=GuestAudioProfileSelector({value:'raw',onChange(){},busy:true});
  assert.equal(nodes(selector).find(node=>node.type==='select').props.disabled,true);
  assert.ok(nodes(selector).some(node=>node.props?.role==='status'));
  assert.ok(nodes(selector).some(node=>node.type==='p'&&String(node.props.children).includes('наушники')));

  const joined=[];
  const props={name:'Guest',onJoin:choices=>joined.push(choices)};
  let tree=render(props);
  assert.equal(nodes(tree).find(node=>node.type===GuestAudioProfileSelector).props.value,'speech');
  nodes(tree).find(node=>node.type==='button'&&node.props.children==='Проверить устройства').props.onClick();
  assert.equal(captured.length,1);assert.equal(captured[0].audio.noiseSuppression,true);
  tree=render(props);
  nodes(tree).find(node=>node.type===GuestAudioProfileSelector).props.onChange('raw');
  tree=render(props);
  assert.equal(nodes(tree).find(node=>node.type===GuestAudioProfileSelector).props.value,'raw');
  const oldStream=stream('old-mic');pending.shift()(oldStream);await settle();
  assert.equal(oldStream.track.stopped,1,'changing mode invalidates/stops an in-flight preview capture');
  assert.equal(joined.length,0);
  tree=render(props);
  nodes(tree).find(node=>node.type==='button'&&node.props.children==='Проверить устройства').props.onClick();
  assert.equal(captured[1].audio.noiseSuppression,false);assert.equal(captured[1].audio.voiceIsolation,false);
  const rawPreview=stream('raw-mic');pending.shift()(rawPreview);await settle();tree=render(props);
  nodes(tree).find(node=>node.type==='button'&&node.props.children==='Войти в конференцию').props.onClick();
  assert.equal(rawPreview.track.stopped,1,'joining releases preflight preview');
  assert.equal(captured[2].audio.autoGainControl,false);assert.equal(captured[2].audio.deviceId.exact,'raw-mic');
  const liveChoice=stream('raw-mic');pending.shift()(liveChoice);await settle();
  assert.equal(joined[0].audioProfile,'raw');assert.equal(joined[0].audioDeviceId,'raw-mic');assert.equal(liveChoice.track.stopped,1);
  reset();

  const savedRaw={height:720,micGain:80,listenGain:90,audioEnabled:false,videoEnabled:false,audioProfile:'raw',connectionRoute:'normal'};
  tree=render({...props,initialChoices:savedRaw});await new Promise(resolve=>setTimeout(resolve,5));await settle();
  assert.equal(joined.at(-1).audioProfile,'raw','transfer restoration keeps original-sound selection');
  assert.equal(joined.at(-1).connectionRoute,'normal','transfer restoration retains the chosen connection route');
  assert.equal(joined.at(-1).audioEnabled,false);assert.equal(joined.at(-1).videoEnabled,false);
  assert.equal(captured.length,3,'receive-only restoration does not acquire devices for a selected profile');
  reset();
  tree=render({...props,initialChoices:{...savedRaw,audioProfile:undefined}});await new Promise(resolve=>setTimeout(resolve,5));await settle();
  assert.equal(joined.at(-1).audioProfile,'speech','legacy saved choices restore the speech default');
  reset();
  console.log('PASS: guest profile selector, matching raw preview, stale capture cleanup, joined choices, and muted/legacy session restoration');
})().catch(error=>{console.error(error);process.exitCode=1;});
