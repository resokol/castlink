// Browser CSS regression over the actual Next/RoomConference DOM snapshot.
// Keep nested LK toggle/menu wrappers; screenshots also verified against live React render.
// No SFU, device, phone or media transport claims.
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),{spawn}=require('node:child_process'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../..');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-guest-controls-'));
const chrome=spawn(process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run',`--user-data-dir=${out}/profile`,'--remote-debugging-port=0','about:blank'],{stdio:'ignore'});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));let ws;
(async()=>{let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(`${out}/profile/DevToolsActivePort`,'utf8').split('\n')[0];break}catch{}await sleep(50)}if(!port)throw Error('Chromium unavailable');
 const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((r,j)=>{ws.onopen=r;ws.onerror=j});let id=0;const pending=new Map();ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.method==='Runtime.exceptionThrown')console.error('RENDER_ERROR',JSON.stringify(m.params.exceptionDetails));if(m.id){const p=pending.get(m.id);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result)}};
 const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;const timer=setTimeout(()=>{pending.delete(n);reject(Error(`CDP timeout ${method}`))},10000);pending.set(n,{resolve:x=>{clearTimeout(timer);resolve(x)},reject:e=>{clearTimeout(timer);reject(e)}});ws.send(JSON.stringify({id:n,method,params}))});
 const evalJS=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value};
 await send('Page.enable');await send('Runtime.enable');await send('Page.setBypassCSP',{enabled:true});
 const results=[];
 for(const width of [320,390,591,1440]){
  const height=width===1440?900:844;
  await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:width<700});
  const css=fs.readFileSync(`${root}/apps/web/node_modules/@livekit/components-styles/dist/general/index.css`,'utf8')+'\n'+fs.readFileSync(`${root}/apps/web/app/globals.css`,'utf8');
  const markup=fs.readFileSync(path.join(__dirname,'guest-controls-rendered.html'),'utf8');
  const html=`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>${markup}`;
  await send('Page.setDocumentContent',{frameId:(await send('Page.getFrameTree')).frameTree.frame.id,html});
  const info=await evalJS(`(()=>{const rect=e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom}};return {viewport:innerWidth,pageWidth:document.documentElement.scrollWidth,footer:rect(document.querySelector('footer')),row:rect(document.querySelector('.guest-control-row')),wrapper:rect(document.querySelector('.lk-scroll-layout-wrapper')),leave:rect(document.querySelector('.room-leave-button')),leavePosition:getComputedStyle(document.querySelector('.room-leave-button')).position,groups:[...document.querySelectorAll('.lk-button-group')].map(rect),buttons:[...document.querySelectorAll('.guest-control-row button')].filter(e=>getComputedStyle(e).display!=='none').map(rect)}})()`);
  const screenshot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true});fs.writeFileSync(`${out}/guest-${width}.png`,Buffer.from(screenshot.data,'base64'));
  const failures=[];if(info.pageWidth>width+1)failures.push('horizontal overflow');for(const b of info.buttons){if(b.h<30||b.h>64)failures.push('stretched/tiny control');if(b.x<info.footer.x-1||b.right>info.footer.right+1||b.y<info.footer.y-1||b.bottom>info.footer.bottom+1)failures.push('control outside footer')};if(info.wrapper.h<100)failures.push('controls consumed video area');if(width<700&&info.leavePosition==='fixed')failures.push('exit overlays page');results.push({width,failures:[...new Set(failures)],...info});
 }
 fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({out,results}));assert(results.every(r=>!r.failures.length),'guest controls must remain compact, inside footer, with usable video and in-flow exit');
})().catch(e=>{console.error(e.message);process.exitCode=1}).finally(async()=>{ws?.close();chrome.kill();await sleep(150)});
