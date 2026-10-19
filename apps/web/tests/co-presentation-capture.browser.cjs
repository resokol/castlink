// Actual Chromium canvas -> production LocalVideoTrack capture helper -> decoded video.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),ts=require('typescript'),{chromium}=require('playwright');
const web=path.resolve(__dirname,'..');
const helper=ts.transpileModule(fs.readFileSync(path.join(web,'lib/co-presentation-client.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText.replace(/import \{([^}]+)\} from ['"]livekit-client['"];?/,'const {$1}=window.LivekitClient;');
const pdfObjects=[
 '<< /Type /Catalog /Pages 2 0 R >>',
 '<< /Type /Pages /Kids [3 0 R 6 0 R] /Count 2 >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>',
 'stream-placeholder', '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
 '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 800 450] /Resources << /Font << /F1 5 0 R >> >> /Contents 7 0 R >>', 'stream-placeholder',
];
const streams=['1 1 1 rg 0 0 640 360 re f\n1 0 0 rg 40 40 560 280 re f\n0 0 0 rg BT /F1 50 Tf 60 180 Td (VISIBLE PDF SLIDE) Tj ET','1 1 1 rg 0 0 800 450 re f\n0 0 1 rg 20 20 760 410 re f\n1 1 1 rg BT /F1 60 Tf 60 220 Td (SECOND SLIDE) Tj ET'];
for(const [index,object]of [[0,3],[1,6]])pdfObjects[object]=`<< /Length ${Buffer.byteLength(streams[index])} >>\nstream\n${streams[index]}\nendstream`;
let pdf='%PDF-1.4\n';const offsets=[0];for(let index=0;index<pdfObjects.length;index++){offsets.push(Buffer.byteLength(pdf));pdf+=`${index+1} 0 obj\n${pdfObjects[index]}\nendobj\n`;}const xref=Buffer.byteLength(pdf);pdf+=`xref\n0 8\n0000000000 65535 f \n${offsets.slice(1).map(offset=>String(offset).padStart(10,'0')+' 00000 n ').join('\n')}\ntrailer\n<< /Size 8 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
const server=http.createServer((request,response)=>{if(request.url==='/slides.pdf'){response.setHeader('content-type','application/pdf');response.end(pdf);return;}if(['/pdf.mjs','/pdf.worker.mjs'].includes(request.url)){response.setHeader('content-type','text/javascript');response.end(fs.readFileSync(path.join(web,'node_modules/pdfjs-dist/build',request.url.slice(1))));return;}if(request.url==='/capture.mjs'){response.setHeader('content-type','text/javascript');response.end(helper);}else if(request.url==='/livekit.js'){response.setHeader('content-type','text/javascript');response.end(fs.readFileSync(path.join(web,'node_modules/livekit-client/dist/livekit-client.umd.js')));}else{response.setHeader('content-type','text/html');response.end('<!doctype html><script src="/livekit.js"></script><body></body>');}});
let browser;
(async()=>{
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required']});
 const page=await browser.newPage();await page.goto(`http://127.0.0.1:${server.address().port}`);
 const result=await page.evaluate(async()=>{
  const {createCanvasPresentationCapture}=await import('/capture.mjs');
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;document.body.append(canvas);
  const pdfjs=await import('/pdf.mjs');pdfjs.GlobalWorkerOptions.workerSrc='/pdf.worker.mjs';
  const loading=pdfjs.getDocument({data:new Uint8Array(await(await fetch('/slides.pdf')).arrayBuffer()),useSystemFonts:true});const pdfDocument=await loading.promise;
  const context=canvas.getContext('2d');
  const render=async number=>{const pdfPage=await pdfDocument.getPage(number),viewport=pdfPage.getViewport({scale:1}),staged=canvas.ownerDocument.createElement('canvas');staged.width=viewport.width;staged.height=viewport.height;await pdfPage.render({canvas:staged,viewport}).promise;canvas.width=staged.width;canvas.height=staged.height;context.drawImage(staged,0,0);};
  await render(1);
  const before=Array.from(context.getImageData(100,100,1,1).data);
  await new Promise(resolve=>setTimeout(resolve,300));
  const video=document.createElement('video');video.autoplay=true;video.muted=true;document.body.append(video);
  const events=new Map(),publications=new Map(),changed=[];
  const room={state:'connected',on(event,callback){events.set(event,callback);return this;},off(event){events.delete(event);return this;},localParticipant:{getTrackPublication:source=>publications.get(source),async publishTrack(track,options){await new Promise(resolve=>setTimeout(resolve,900));publications.set(options.source,{track});video.srcObject=new MediaStream([track.mediaStreamTrack]);void video.play();},async unpublishTrack(track){for(const [key,pub]of publications)if(pub.track===track)publications.delete(key);}}};
  const capture=createCanvasPresentationCapture(room,value=>changed.push(value));
  await capture.start(canvas,()=>true);
  await new Promise(resolve=>setTimeout(resolve,1600));
  const snapshot=document.createElement('canvas');snapshot.width=640;snapshot.height=360;const sampled=snapshot.getContext('2d');if(video.videoWidth)sampled.drawImage(video,0,0,640,360);
  const textPixels=white=>{const data=sampled.getImageData(40,100,560,160).data;let count=0;for(let index=0;index<data.length;index+=4)if(data[index+3]>240&&(white?data[index]>220&&data[index+1]>220&&data[index+2]>220:data[index]<50&&data[index+1]<50&&data[index+2]<50))count++;return count;};
  const first={width:video.videoWidth,pixel:Array.from(sampled.getImageData(100,100,1,1).data),frames:video.getVideoPlaybackQuality().totalVideoFrames,textPixels:textPixels(false)};
  // A new, differently sized slide must remain visible after the completed draw.
  await render(2);
  await new Promise(resolve=>setTimeout(resolve,800));
  if(video.videoWidth)sampled.drawImage(video,0,0,640,360);
  const second={width:video.videoWidth,pixel:Array.from(sampled.getImageData(100,100,1,1).data),frames:video.getVideoPlaybackQuality().totalVideoFrames,textPixels:textPixels(true)};
  canvas.style.display='none';await new Promise(resolve=>setTimeout(resolve,800));const hiddenFrames=video.getVideoPlaybackQuality().totalVideoFrames;
  const sourcePixel=Array.from(context.getImageData(100,100,1,1).data);
  await capture.stop();const stopped=!capture.isSharing()&&publications.size===0;capture.dispose();await loading.destroy();return{before,first,second,hiddenFrames,sourcePixel,stopped,changed};
 });
 assert.deepEqual(result.before,[255,0,0,255]);assert.equal(result.first.width,640,'a slide painted before asynchronous publication must produce decoded video, not a blank initial frame');assert.ok(result.first.pixel[0]>240&&result.first.pixel[1]<15&&result.first.pixel[2]<15,'first decoded frame contains slide artwork');assert.ok(result.first.frames>=3,'static slides continue producing video frames');assert.ok(result.first.textPixels>300,'actual first PDF text reaches decoded video');assert.ok(result.second.textPixels>300,'actual next PDF text reaches decoded video');assert.ok(result.hiddenFrames>result.second.frames,'hidden inline PDF continues producing video while floating controls are open');assert.equal(result.second.width,800);assert.ok(result.second.pixel[2]>240&&result.second.pixel[0]<15,'next rendered slide reaches video');assert.deepEqual(result.sourcePixel,[0,0,255,255],'frame refresh preserves source pixels');assert.ok(result.stopped);console.log(JSON.stringify({status:'PASS',...result}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));});
