// Real React controls with an offline room/API and the shipped PDF renderer and canvas track.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),http=require('node:http'),{createRequire}=require('node:module');
const web=path.resolve(__dirname,'..'),req=createRequire(path.join(web,'package.json'));
const out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-browser-routing-'));let browser,server;
const write=(name,text)=>{const file=path.join(out,name);fs.writeFileSync(file,text);return file;};
const loader=write('loader.cjs',`const ts=require(${JSON.stringify(require.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);

const { slideDeck } = require('./fixtures/slide-deck.cjs');
const pdfBytes = slideDeck(['1 0 0', '0 0 1']);
const entry=write('entry.tsx',`
import React from 'react';import {createRoot} from 'react-dom/client';import {RoomEvent,Track,LocalVideoTrack} from 'livekit-client';
import {ScreenShareButton} from '@/components/ScreenShareButton';import {CoPresentationPanel} from '@/components/CoPresentationPanel';import {CoPresentationNavigationProvider} from '@/components/CoPresentationNavigation';
const renderer = { attempts: 0, draws: 0 };
const NativeWorker = window.Worker;
window.Worker = class extends NativeWorker {
 constructor(url, options) {
  const isRenderer = String(url).endsWith('/pdfjs/pdf.renderer.min.mjs');
  if (isRenderer) {
   renderer.attempts++;
   if (new URLSearchParams(location.search).has('fallback')) throw new Error('Simulated unavailable renderer');
  }
  super(url, options);
  if (isRenderer) {
   const send = this.postMessage.bind(this);
   this.postMessage = (...args) => {
    if (args[0]?.action === 'ExecuteOperatorList') renderer.draws++;
    return send(...args);
   };
  }
 }
};
const pipMode = new URLSearchParams(location.search).get('pip');
if (!pipMode) Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:undefined});
else if (pipMode === 'denied') Object.defineProperty(window,'documentPictureInPicture',{configurable:true,value:{
 requestWindow: () => Promise.reject(new DOMException('Denied', 'NotAllowedError'))
}});
const remoteScreen = {trackSid:'peer-screen',isMuted:false,track:{mediaStreamTrack:{readyState:'live'}}};
let sequence=0;const listeners=new Map(),publications=new Map();const room:any={state:'connected',remoteParticipants:new Map([['guest-peer',{identity:'guest-peer',sid:'peer-sid',name:'Анна',metadata:'{"role":"guest"}',getTrackPublication(source){return pipMode==='recipient' && source===Track.Source.ScreenShare ? remoteScreen : undefined}}]]),on(event:any,fn:any){const set=listeners.get(event)||new Set();set.add(fn);listeners.set(event,set);return room},off(event:any,fn:any){listeners.get(event)?.delete(fn);return room}};
const emit=(event:any,...args:any[])=>{for(const fn of listeners.get(event)||[])fn(...args)};room.localParticipant={identity:'guest-owner',sid:'owner-sid',name:'Вы',getTrackPublication:(source:any)=>publications.get(source),async publishTrack(track:any,options:any){const pub={track,trackSid:'screen-'+(++sequence),isMuted:false,source:options.source};publications.set(options.source,pub);emit(RoomEvent.LocalTrackPublished,pub);return pub},async unpublishTrack(track:any){let removed;for(const [source,pub] of publications)if(pub.track===track){removed=pub;publications.delete(source)}if(removed)emit(RoomEvent.LocalTrackUnpublished,removed)},async setScreenShareEnabled(enabled:boolean){if(enabled){await window.qa.plain();return;}if(!enabled){for(const source of [Track.Source.ScreenShare,Track.Source.ScreenShareAudio]){publications.get(source)?.track.stop();publications.delete(source)}emit(RoomEvent.LocalTrackUnpublished)}}};
const helperCalls:any[]=[];let session:any=null;const nativeFetch=window.fetch.bind(window);window.fetch=async(input:any,options:any)=>{if(String(input).includes('/api/co-presentation-helper')){const body=JSON.parse(options.body);helperCalls.push(body.action);return new Response(JSON.stringify(body.action==='state'?{connected:false}:body.action==='pair'?{code:'cp2_'+ 'a'.repeat(43),pairingId:'offline-pair',expiresAt:Date.now()+120000}:{}),{status:200,headers:{'content-type':'application/json'}})}if(!String(input).includes('/api/co-presentations'))return nativeFetch(input,options);const body=JSON.parse(options.body);window.qa.controlCalls.push(body.action);if(body.action==='create')session={id:'offline-deck',generation:'offline-generation',kind:'pdf',name:body.name,pages:body.pages,page:1,revision:1,renderedRevision:0,renderedPage:0,controlRevision:0,owner:{identity:'guest-owner',sid:'owner-sid'}};if(session&&body.action==='ack'){session.renderedRevision=session.revision;session.renderedPage=body.page}if(session&&body.action==='navigate'){session.page=Math.max(1,Math.min(session.pages,session.page+(body.direction==='next'?1:-1)));session.revision++}if(session&&body.action==='delegate'){session.controller={identity:body.controllerIdentity,sid:'peer-sid'};if(body.requireAcceptance)throw Error('Unexpected slide confirmation');session.controllerAccepted=true;session.controlRevision++}if(session&&body.action==='revoke'){if(body.close)session=null;else{delete session.controller;delete session.controllerAccepted;session.controlRevision++}}return new Response(JSON.stringify({session,sessions:session?[session]:[]}),{status:200,headers:{'content-type':'application/json'}})};
if (pipMode === 'recipient') {
 localStorage.setItem('castlink.presentation.autoAccept','false');
 session={id:'remote-deck',generation:'remote-generation',kind:'pdf',name:'remote.pdf',pages:2,page:1,revision:1,renderedRevision:1,renderedPage:1,controlRevision:1,
   owner:{identity:'guest-peer',sid:'peer-sid'},controller:{identity:'guest-owner',sid:'owner-sid'},controllerAccepted:true};
}
window.qa={renderer,track:()=>publications.get(Track.Source.ScreenShare)?.track.mediaStreamTrack,helperCalls,controlCalls:[],hasNative:()=>!!window.castlinkDesktop,sharing:()=>publications.has(Track.Source.ScreenShare),page:()=>session?.page,controller:()=>session?.controller?.identity,async plain(){const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const native=canvas.captureStream(5).getVideoTracks()[0];Object.defineProperty(native,'label',{value:'Экран проверки'});await room.localParticipant.publishTrack(new LocalVideoTrack(native),{source:Track.Source.ScreenShare})}};
createRoot(document.getElementById('root')!).render(<CoPresentationNavigationProvider><div className="guest-room-page guest-app-shell graphite-workspace caster-workspace"><div className="caster-toolbar-main"><div className="guest-control-row"><ScreenShareButton room={room} toolbar/><CoPresentationPanel room={room} token="offline" studioId="offline" roomName="offline"/></div></div></div></CoPresentationNavigationProvider>);
`);
(async()=>{
 const webpack=req('next/dist/compiled/webpack/webpack');await new Promise((resolve,reject)=>webpack.webpack({mode:'development',entry,devtool:false,output:{path:out,filename:'bundle.js'},resolve:{extensions:['.ts','.tsx','.js','.mjs'],modules:[path.join(web,'node_modules'),'node_modules'],alias:{'@':web}},module:{rules:[{test:/\.tsx?$/,use:loader}]},optimization:{minimize:false}},(error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
 server=http.createServer((request,response)=>{const files={'/bundle.js':path.join(out,'bundle.js'),'/globals.css':path.join(web,'app/globals.css'),'/graphite.css':path.join(web,'app/graphite-workspace.css'),'/livekit.css':req.resolve('@livekit/components-styles')};const url=request.url;
 const pdfAsset = /^\/pdfjs\/(pdf\.(?:worker|renderer)\.min\.mjs)$/.exec(url);
 const chunk = /^\/([\w.-]+\.js)$/.exec(url);
 const file=files[url] || (pdfAsset ? path.join(web,'public/pdfjs',pdfAsset[1]) : chunk ? path.join(out,chunk[1]) : undefined);if(file){response.setHeader('content-type',file.endsWith('.css')?'text/css':'text/javascript');response.end(fs.readFileSync(file));return;}response.setHeader('content-type','text/html');response.end('<!doctype html><html data-theme="dark"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/livekit.css"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/graphite.css"><style>body{margin:0;padding:24px}.caster-workspace{min-height:70vh!important;padding-top:50vh!important;display:block!important}.co-presentation-file-content canvas{max-width:100%}</style><div id="root"></div><script src="/bundle.js"></script></html>');});await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));

 const {spawn}=require('node:child_process'),chrome=process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium';
 const child=spawn(chrome,['--headless=new','--no-sandbox','--disable-dev-shm-usage','--no-first-run',`--user-data-dir=${out}/profile`,'--remote-debugging-port=0','about:blank'],{stdio:['ignore','ignore','pipe']});child.stderr.on('data',data=>fs.appendFileSync(path.join(out,'chrome.log'),data));child.on('error',error=>fs.writeFileSync(path.join(out,'chrome-error.log'),String(error)));browser={close:async()=>child.kill()};
 const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(path.join(out,'profile','DevToolsActivePort'),'utf8').split('\n')[0];break}catch{}await pause(50)}assert.ok(port,'test-only Chrome starts '+out+' '+(fs.existsSync(path.join(out,'chrome.log'))?fs.readFileSync(path.join(out,'chrome.log'),'utf8'):''));
 const tabs=await(await fetch('http://127.0.0.1:'+port+'/json/list')).json(),socket=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{socket.onopen=resolve;socket.onerror=reject});let id=0;const waiting=new Map(),errors=[];
 socket.onmessage=event=>{const message=JSON.parse(event.data);if(message.method==='Runtime.exceptionThrown')errors.push(message.params.exceptionDetails);if(!message.id)return;const held=waiting.get(message.id);waiting.delete(message.id);message.error?held.reject(Error(JSON.stringify(message.error))):held.resolve(message.result)};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const next=++id;const timer=setTimeout(()=>{waiting.delete(next);reject(Error('CDP timeout '+method))},10000);waiting.set(next,{resolve:value=>{clearTimeout(timer);resolve(value)},reject:error=>{clearTimeout(timer);reject(error)}});socket.send(JSON.stringify({id:next,method,params}))});
 const evaluate=async expression=>{const response=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(response.exceptionDetails)throw Error(JSON.stringify(response.exceptionDetails));return response.result.value};
 const until=async(expression,label)=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await pause(50)}throw Error('Timeout '+label)};
 const click=async selector=>{const box=await evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)return null;e.scrollIntoView({block:'nearest'});const r=e.getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2,hit:document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)?.closest('button')?.className}})()`);assert.ok(box,'button exists '+selector);await send('Input.dispatchMouseEvent',{type:'mousePressed',x:box.x,y:box.y,button:'left',clickCount:1});await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:box.x,y:box.y,button:'left',clickCount:1});await pause(150);return box};
 await send('Page.enable');await send('Runtime.enable');await send('Emulation.setDeviceMetricsOverride',{width:1440,height:900,deviceScaleFactor:1,mobile:false});
 const origin='http://127.0.0.1:'+server.address().port,proof=[];
 const startDeck = async () => {
   await evaluate(`(()=>{const input=document.querySelector('input[type=file]'),dt=new DataTransfer();dt.items.add(new File([Uint8Array.from(${JSON.stringify([...pdfBytes])})],'e-pass(75).pdf',{type:'application/pdf'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}))})()`);
   await until("document.querySelector('.presentation-file-menu')?.matches(':popover-open') && !document.querySelector('.presentation-file-menu button').disabled",'prepared browser PDF');await click('.presentation-file-menu button');await until('window.qa.sharing()','shared canvas PDF');
 };
 for(const [width,theme] of [[390,'dark'],[390,'light'],[1440,'dark'],[1440,'light']]){await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:width<700});for(const scenario of ['uncontrolled-screen','uploaded-pdf']){
  await send('Page.navigate',{url:origin+'/?scenario='+scenario+(theme==='light'?'&fallback=1':'')});await until("!!document.querySelector('.native-pptx-prepare')",'mounted React');assert.equal(await evaluate('window.qa.hasNative()'),false);await evaluate(`document.documentElement.dataset.theme=${JSON.stringify(theme)}`);
  if(scenario==='uploaded-pdf'){
   await startDeck();
   await evaluate("document.querySelector('.co-presentation-popover').hidePopover()");
  } else {
   await click('.guest-screen-share-button');
   await until("window.qa.sharing() && !!document.querySelector('.co-presentation-owner-trigger')",'confirmed owner capture');
  }
  const ownerTrigger = '.co-presentation-owner-trigger';
  assert.equal(await evaluate("document.querySelectorAll('.co-presentation-trigger').length"),1,'owner has one presentation controls entry');
  assert.equal(await evaluate("window.qa.helperCalls.includes('pair')"),false,'capture alone does not launch the helper');
  const hit=await click(ownerTrigger);
  await until("document.querySelector('.co-presentation-popover')?.matches(':popover-open')",'owner opens controls');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await until("!document.querySelector('.co-presentation-popover')?.matches(':popover-open')",'Escape closes controls');
  assert.equal(await evaluate("document.activeElement?.classList.contains('co-presentation-owner-trigger')"),true,'restore focus to initiating owner button');
  await send('Input.dispatchKeyEvent',{type:'keyDown',key:'Enter',code:'Enter',windowsVirtualKeyCode:13,text:'\r',unmodifiedText:'\r'});
  await send('Input.dispatchKeyEvent',{type:'keyUp',key:'Enter',code:'Enter',windowsVirtualKeyCode:13});
  await until("document.querySelector('.co-presentation-popover')?.matches(':popover-open')",'Enter reopens controls');
  await click('.co-presentation-heading button[aria-label="Закрыть управление"]');
  await until("document.activeElement?.classList.contains('co-presentation-owner-trigger') && !document.querySelector('.co-presentation-popover')?.matches(':popover-open')",'Close returns focus to the owner button');
  await click(ownerTrigger);
  await until("document.querySelector('.co-presentation-popover')?.matches(':popover-open')",'owner reopens controls');
  if (scenario === 'uploaded-pdf') {
   await until("document.querySelector('.co-presentation-popover figure')?.hidden === false" , 'private preview');
   const pixels = await evaluate(`(async () => {
     const thumbnail = document.querySelector('.co-presentation-popover figure canvas');
     const video = document.createElement('video');
     video.muted = true;
     video.srcObject = new MediaStream([window.qa.track()]);
     await video.play();
     await new Promise(resolve => video.requestVideoFrameCallback(resolve));
     const frame = document.createElement('canvas');
     frame.width = 64; frame.height = 36;
     const context = frame.getContext('2d'); context.drawImage(video, 0, 0, 64, 36);
     const preview = [...thumbnail.getContext('2d').getImageData(16, 16, 1, 1).data];
     const shared = [...context.getImageData(16, 16, 1, 1).data];
     video.pause(); video.srcObject = null;
     return { preview, shared };
   })()`);
   const renderer = await evaluate('window.qa.renderer');
   assert.equal(renderer.attempts, 1, 'one renderer worker per document');
   if (theme === 'dark') assert.ok(renderer.draws >= 2, 'PDF.js drew both pages in the local renderer worker');
   else assert.equal(renderer.draws, 0, 'ordinary canvas rendering works with a denied renderer worker');
   assert.deepEqual(pixels.preview, [0, 0, 255, 255], 'only the caster sees the blue next page');
   assert.ok(pixels.shared[0] > 240 && pixels.shared[2] < 15, 'the LiveKit screen track still carries the red current page');
  }
  const state=await evaluate(`({renderer:window.qa.renderer,helperCalls:[...window.qa.helperCalls],helper:!!document.querySelector('.native-pptx-pair:popover-open'),title:document.querySelector('.co-presentation-popover h2')?.textContent,page:document.querySelector('.co-presentation-popover output')?.textContent,text:document.querySelector('.co-presentation-popover')?.innerText,sharing:window.qa.sharing()})`);
  fs.writeFileSync(path.join(out,scenario+'-'+width+'-'+theme+'.png'),Buffer.from((await send('Page.captureScreenshot',{format:'png'})).data,'base64'));proof.push({width,theme,scenario,hit,...state});
  assert.equal(state.helper,false,'first primary click does not display native pairing');assert.equal(state.helperCalls.includes('pair'),false,'opening or reopening the menu leaves the helper idle');assert.equal(state.sharing,true,'opening UI preserves media');
  if(scenario==='uploaded-pdf'){assert.equal(state.title,'e-pass(75).pdf');assert.match(state.page,/1\s*\/\s*2/);assert.match(state.text,/Остановить презентацию/);await click('.co-presentation-delegation > summary');await click('.co-presentation-casters button[role=radio]');await until("window.qa.controller()==='guest-peer'",'real PDF grant');await until("!document.querySelector('.co-presentation-popover figure')",'handoff clears the private preview');assert.equal(await evaluate("window.qa.controlCalls.filter(x=>x==='delegate').length"),1);await click('.co-presentation-stop');await until('!window.qa.sharing()','owned PDF Stop');}
  else {
   assert.equal(state.page,undefined,'unbound browser capture has no invented page count');
   assert.ok(await evaluate("!!document.querySelector('.co-presentation-native-connect')"),'offer explicit PowerPoint connection');
   assert.equal(await evaluate("window.qa.controlCalls.includes('delegate')"),false,'an unbound screen cannot delegate navigation');
   await click('.co-presentation-native-connect');
   await until("window.qa.helperCalls.includes('pair')",'explicit owner Connect requests its local component');
   assert.equal(await evaluate("window.qa.helperCalls.filter(call=>call==='pair').length"),1);
   await click('.co-presentation-heading button[aria-label="Закрыть управление"]');
   await click(ownerTrigger);
   assert.equal(await evaluate("window.qa.helperCalls.filter(call=>call==='pair').length"),1,'reopening preserves the pending pairing');
   await click('.co-presentation-stop');await until('!window.qa.sharing()','independent unbound Stop');
  }
 }}
 const inline = "document.querySelector('.co-presentation-popover').matches(':popover-open')";
 const toolbar = "window.documentPictureInPicture?.window?.document.querySelector('[data-slide-toolbar]')";
 const owner = '.co-presentation-owner-trigger';
 const labelMatches = value => [owner, '.co-presentation-delegation summary'].map(selector =>
   `document.querySelector(${JSON.stringify(selector)}).textContent === ${JSON.stringify(value)}`).join(' && ');
 for (const mode of ['supported','denied']) {
   await send('Page.navigate',{url:origin+'/?pip='+mode});
   await until("!!document.querySelector('.native-pptx-prepare')",'mounted PDF controls');
   await startDeck();
   const next = '.co-presentation-navigation button[aria-label="Вперёд"]';
   if (mode === 'denied') {
     await until(inline,'inline fallback after denied PiP');
     await click('.co-presentation-heading button[aria-label="Поверх других окон"]');
     assert.equal(await evaluate(inline),true,'explicit floating failure retains inline controls');
     await click(next);
     await until('window.qa.page()===2','navigation after denial');
   } else {
     await until(`${toolbar} && !${inline}`,'reserved PiP takes over from inline');
     await evaluate('window.qa.firstWindow=documentPictureInPicture.window; window.qa.firstTrack=window.qa.track()');
     await click(owner);
     assert.equal(await evaluate(inline),false,'reopening the owner controls focuses the floating toolbar');
     const pipClick = selector => evaluate(`(${toolbar}).querySelector(${JSON.stringify(selector)}).click()`);
     await pipClick('[data-action=menu]');
     await pipClick('[data-identity=guest-peer]');
     await until(labelMatches('Управляет: Анна'),'immediate grant labels');
     await until(`(${toolbar}).querySelector('[data-action=menu]').getAttribute('aria-label') === 'Управляет: Анна'`,'floating controller label');
     await click(owner);
     assert.equal(await evaluate(inline),false,'a revised grant still owns exactly one toolbar');
     assert.equal(await evaluate('documentPictureInPicture.window === window.qa.firstWindow'),true);
     assert.equal(await evaluate("documentPictureInPicture.window.document.querySelector('[data-pip-slot=stop]').hidden"),true,'the new grant still covers the separate Stop row');
     await pipClick('[data-action=next]');
     await until('window.qa.page()===2','navigation from the updated PiP');
     await evaluate('documentPictureInPicture.window.close()');
     await until('!documentPictureInPicture.window','PiP closed');
     await click(owner);
     await until(inline,'inline accessible again after closing PiP');
     assert.equal(await evaluate("window.qa.controller()==='guest-peer' && window.qa.firstTrack===window.qa.track() && window.qa.track().readyState==='live'"),true,'closing only changes control visibility');
     await click('.co-presentation-delegation > summary');
     await click('.co-presentation-reclaim');
     await until("document.querySelector('.co-presentation-owner-trigger').textContent==='Совместная презентация' && document.querySelector('.co-presentation-delegation summary').textContent==='Кто будет управлять'",'reclaimed controls show their original labels');
     await click('.co-presentation-heading button[aria-label="Поверх других окон"]');
     await until(`${toolbar} && !${inline}`,'explicit floating request hands off the inline menu');
   }
   proof.push({scenario:'one-owner-toolbar',mode,sharing:await evaluate('window.qa.sharing()')});
 }
 await send('Page.navigate',{url:origin+'/?pip=recipient'});
 const card = "document.querySelector('.recipient-slide-controls')?.matches(':popover-open')";
 const recipientNext = '.recipient-slide-controls button[aria-label="Следующий слайд"]';
 await until(`${card} && !document.querySelector(${JSON.stringify(recipientNext)}).disabled`,'recipient immediately gets inline controls');
 assert.equal(await evaluate("localStorage.getItem('castlink.presentation.autoAccept')"),'false','stored legacy preference is off');
 assert.equal(await evaluate("document.querySelector('.recipient-slide-acceptance') === null"),true,'the grant needs no recipient confirmation UI');
 await click('.recipient-slide-controls button[aria-label="Показать поверх других окон"]');
 await until(`${toolbar} && !${card}`,'recipient float takes over from inline');
 await click('.co-presentation-trigger');
 assert.equal(await evaluate(card),false,'recipient entry reuses the open PiP');
 await evaluate('documentPictureInPicture.window.close()');
 await until(card,'recipient regains inline controls after closing PiP');
 assert.equal(await evaluate("window.qa.controlCalls.includes('accept-control')"),false,'no confirmation RPC');
 await click(recipientNext);
 await until('window.qa.page()===2','the same recipient grant can still navigate');
 assert.equal(await evaluate("window.qa.controlCalls.includes('release-control')"),false);
 proof.push({scenario:'one-recipient-toolbar',legacyAutoAccept:false,navigated:true});
 assert.deepEqual(errors,[]);fs.writeFileSync(path.join(out,'proof.json'),JSON.stringify(proof,null,2));console.log(JSON.stringify({result:'PASS',out,proof}));socket.close();
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close()});
