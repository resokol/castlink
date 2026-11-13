// Real React controls and browser capture; offline room, Chromium's synthetic microphone.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { createRequire } = require('node:module'), { spawn } = require('node:child_process');
const web = path.resolve(__dirname, '..'), req = createRequire(path.join(web, 'package.json'));
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-media-menus-'));
const write = (name, value) => { const file = path.join(out, name); fs.writeFileSync(file, value); return file; };
const loader = write('loader.cjs', `const ts=require(${JSON.stringify(req.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);
const cssLoader = write('css-loader.cjs', `module.exports=s=>{const names=Object.fromEntries([...s.matchAll(/\\.([a-zA-Z_][\\w-]*)/g)].map(m=>[m[1],m[1]]));return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names)};`);
const i18n = write('i18n.ts', `export const useI18n=()=>({locale:'ru',t:(value:string)=>value});`);
const entry = write('entry.tsx', `
import React,{useState} from 'react';import {createRoot} from 'react-dom/client';import {RoomEvent} from 'livekit-client';
import {GuestMicrophoneButton} from '@/components/GuestMicrophoneButton';import {GuestCodecCameraButton} from '@/components/GuestCodecCameraButton';import {MediaDevicePicker} from '@/components/MediaDevicePicker';import {GuestNoiseSuppressionControl} from '@/components/GuestNoiseSuppressionControl';
const listeners=new Map();const room:any={state:'connected',localParticipant:{isCameraEnabled:false,isMicrophoneEnabled:false,getTrackPublication:()=>undefined},on(e:any,f:any){const set=listeners.get(e)||new Set();set.add(f);listeners.set(e,set);return room},off(e:any,f:any){listeners.get(e)?.delete(f);return room}};
const captures:any[]=[];const native=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);navigator.mediaDevices.getUserMedia=async(c:any)=>{const stream=await native(c);captures.push({constraints:c,stream});if(window.qa.delay)await new Promise(resolve=>window.qa.release=resolve);return stream};
const generation={current:0};window.qa={captures,enabled(value:boolean){room.localParticipant.isCameraEnabled=value;room.localParticipant.isMicrophoneEnabled=value;for(const fn of listeners.get(RoomEvent.TrackMuted)||[])fn({source:"microphone"},room.localParticipant)},muted:()=>!room.localParticipant.isMicrophoneEnabled};
function App(){const [choices,setChoices]=useState<any>({height:1080,micGain:100,listenGain:100,audioProfile:'raw'});const choicesRef={current:choices};const [error,setError]=useState('');const picker=(kinds:any)=><MediaDevicePicker kinds={kinds} autoRequestPermissions={false} permissionInputs={{audio:false,video:false}} onChange={change=>setChoices((v:any)=>({...v,...change}))}/>;
return <main className="guest-room-page guest-app-shell graphite-workspace caster-workspace"><div className="caster-toolbar-main"><div className="guest-control-row"><GuestMicrophoneButton room={room} choicesRef={choicesRef} generation={generation} disabled={false} onError={setError} menuContent={<>{picker(['audioinput','audiooutput'])}<GuestNoiseSuppressionControl asButton profile={choices.audioProfile} state="pending" confirmed={false} busy={false} disabled={false} onChange={audioProfile=>setChoices((v:any)=>({...v,audioProfile}))}/></>}/><GuestCodecCameraButton room={room} choicesRef={choicesRef} generation={generation} disabled={false} onError={setError} menuContent={picker(['videoinput'])}/></div></div>{error&&<p role="alert">{error}</p>}</main>};createRoot(document.getElementById('root')!).render(<App/>);
`);
let server, chrome, socket;
const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  const webpack = req('next/dist/compiled/webpack/webpack'); webpack.init();
  await new Promise((resolve, reject) => webpack.webpack({ mode: 'development', entry, devtool: false, output: { path: out, filename: 'bundle.js' }, resolve: { extensions: ['.ts','.tsx','.js','.mjs'], modules: [path.join(web, 'node_modules'), 'node_modules'], alias: { '@': web, [path.join(web, 'components/I18nProvider.tsx')]: i18n } }, module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.css$/, use: cssLoader }] }, optimization: { minimize: false } }, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({ all: false, errors: true }))) : resolve()));
  server = http.createServer((request, response) => {
    const files = { '/bundle.js': path.join(out, 'bundle.js'), '/globals.css': path.join(web, 'app/globals.css'), '/graphite.css': path.join(web, 'app/graphite-workspace.css'), '/livekit.css': req.resolve('@livekit/components-styles') };
    const file = files[request.url];
    response.setHeader('content-type', file ? (file.endsWith('.js') ? 'text/javascript' : 'text/css') : 'text/html');
    response.end(file ? fs.readFileSync(file) : '<!doctype html><html data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/livekit.css"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/graphite.css"><style>body{margin:0}.caster-workspace{display:block!important;min-height:100vh!important;padding-top:calc(100vh - 80px)!important}.guest-control-row{justify-content:center!important}</style><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  chrome = spawn(process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', ['--headless', '--no-sandbox', '--disable-dev-shm-usage', '--no-first-run', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required', `--user-data-dir=${out}/profile`, '--remote-debugging-port=0', 'about:blank'], { stdio: 'ignore' });
  let port;
  for (let i=0; i<100; i++) { try { port=fs.readFileSync(`${out}/profile/DevToolsActivePort`, 'utf8').split('\n')[0]; break; } catch {} await pause(50); }
  assert.ok(port, 'Chromium starts');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  socket=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject;});
  let sequence=0; const pending=new Map(), errors=[];
  socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);if(!message.id)return;const held=pending.get(message.id);pending.delete(message.id);message.error?held.reject(Error(JSON.stringify(message.error))):held.resolve(message.result);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));});
  const evaluate=async expression=>{const result=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));return result.result.value;};
  const until=async(expression,label)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(30);}throw Error('Timeout: '+label);};
  const click=async selector=>{const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return{x:r.x+r.width/2,y:r.y+r.height/2}})()`);assert.ok(box,selector);await send('Input.dispatchMouseEvent',{type:'mousePressed',...box,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',...box,button:'left',clickCount:1});await pause(80);};
  await send('Page.enable'); await send('Runtime.enable');
  const mic='.guest-microphone-control button[aria-haspopup]', camera='.guest-camera-control button[aria-haspopup]';
  const menu='.guest-media-menu:popover-open';
  for(const [width,height] of [[320,844],[844,390],[1440,900]])for(const theme of ['dark','light']){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
    await send('Page.navigate',{url:`http://127.0.0.1:${server.address().port}`});
    await until(`!!document.querySelector(${JSON.stringify(mic)})`,'React mounted');
    await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
    assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('[data-muted] > button')).map(e=>getComputedStyle(e).backgroundColor)`),Array(4).fill('rgb(180, 35, 50)'),'both halves of muted controls are fully red');
    for(const [trigger,fields] of [[mic,['Микрофон','Наушники / динамики']],[camera,['Камера']]]){
      await click(trigger); await until(`!!document.querySelector('${menu}')`,'menu opens');
      assert.equal(await evaluate(`document.querySelector(${JSON.stringify(trigger)}).getAttribute('aria-expanded')`),'true');
      assert.deepEqual(await evaluate(`Array.from(document.querySelectorAll('${menu} select')).map(e=>e.getAttribute('aria-label'))`),fields,'each menu owns its device selectors');
      assert.equal(await evaluate(`Array.from(document.querySelectorAll('${menu} button')).some(e=>e.textContent.trim()==='Закрыть')`),false);
      if(trigger===mic){assert.deepEqual(await evaluate(`(()=>{const s=getComputedStyle(document.querySelector('${menu} [role="switch"]'));return [s.width,s.height]})()`),['44px','26px'],'processing switch keeps its full track size inside the real menu');assert.equal(await evaluate(`document.querySelector('${menu} [role="switch"]').checked`),false);await click(`${menu} [role="switch"]`);assert.equal(await evaluate(`document.querySelector('${menu} [role="switch"]').checked`),true);await click(`${menu} [role="switch"]`);}
      assert.equal(await evaluate(`(()=>{const r=document.querySelector('${menu}').getBoundingClientRect();return r.x>=0&&r.right<=innerWidth&&r.y>=0&&r.bottom<=innerHeight})()`),true,'menu fits viewport');
      fs.writeFileSync(path.join(out,`${trigger===mic?'microphone':'camera'}-${theme}-${width}.png`),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));
      await click(trigger); await until(`!document.querySelector('${menu}')`,'same arrow closes');
    }
    await click(mic); await click(camera);
    assert.equal(await evaluate(`document.querySelectorAll('${menu}').length`),1,'opening the camera dismisses the microphone menu');
    assert.equal(await evaluate(`document.querySelector('${menu}').getAttribute('aria-label')`),'Настройки камеры');
    await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
    await until(`!document.querySelector('${menu}')`,'Escape closes');
    await click(mic); await send('Input.dispatchMouseEvent',{type:'mousePressed',x:5,y:5,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:5,y:5,button:'left',clickCount:1}); await until(`!document.querySelector('${menu}')`,'outside click closes');
    await evaluate('window.qa.enabled(true)');await until(`!document.querySelector('[data-muted="true"]')`,'enabled state updates');
    await until(`getComputedStyle(document.querySelector('[data-lk-source="microphone"]')).backgroundColor!=='rgb(180, 35, 50)'`,'enabled surface restores');
    await evaluate('window.qa.enabled(false)');
    if(width===1440&&theme==='dark'){
      await click(mic); await click('.guest-microphone-test button');
      await until('window.qa.captures.length===1','local microphone capture');
      assert.equal(await evaluate('window.qa.muted()'),true,'test never unmutes the conference');
      assert.equal(await evaluate('window.qa.captures[0].constraints.video'),false,'test never opens camera');
      await until(`document.querySelector('${menu} [role="meter"]')?.getAttribute('aria-valuenow') > -90`,'meter receives real PCM');
      await click(mic); await until(`window.qa.captures[0].stream.getTracks().every(t=>t.readyState==='ended')`,'closing stops local capture');
      await click(mic);assert.equal(await evaluate(`document.querySelector('.guest-microphone-test button').getAttribute('aria-pressed')`),'false','reopening starts with test stopped');
      await evaluate('window.qa.delay=true');await click('.guest-microphone-test button');await until('window.qa.captures.length===2 && !!window.qa.release','pending capture');
      await click(mic);await evaluate('window.qa.release()');await until(`window.qa.captures[1].stream.getTracks().every(t=>t.readyState==='ended')`,'late permission result after closing is stopped');
    }
  }
  assert.deepEqual(errors,[],'no browser exceptions');
  console.log('PASS: native arrow toggle, device scopes, independent menus, outside/Escape dismissal, mute surfaces, bounds in both themes, real local PCM and capture cleanup. Proof '+out);
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{socket?.close();chrome?.kill();server?.close();});
