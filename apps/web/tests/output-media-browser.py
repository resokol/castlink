# Real loopback WebRTC + installed LiveKit RemoteVideoTrack; synthetic camera only.
# No production calls, STUN servers, microphone, camera or media settings changes.
from pathlib import Path
import os, json, tempfile, subprocess
from selenium import webdriver
from selenium.webdriver.firefox.service import Service
root=Path(__file__).resolve().parents[3]
out=Path(tempfile.mkdtemp(prefix='castlink-output-media-'))
compiled=subprocess.run(['node','-e',"const fs=require('fs'),ts=require('typescript');process.stdout.write(ts.transpileModule(fs.readFileSync('lib/output-track-bindings.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText)"],cwd=root/'apps/web',capture_output=True,text=True,check=True).stdout
bundle=(root/'apps/web/node_modules/livekit-client/dist/livekit-client.umd.js').as_uri()
js=r"""
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const wait=async(fn,timeout=10000)=>{const until=performance.now()+timeout;while(!fn()){if(performance.now()>until)throw Error('timeout');await sleep(40);}};
window.run=async()=>{
 const started=performance.now(),source=document.createElement('canvas');source.width=640;source.height=360;
 const painter=source.getContext('2d');
 const checksum=value=>{let crc=0;for(let byte=0;byte<3;byte++){crc^=(value>>>(byte*8))&255;for(let bit=0;bit<8;bit++)crc=((crc<<1)^((crc&128)?7:0))&255;}return crc;};
 const paint=()=>{
  const time=Math.floor(performance.now()-started);
  painter.fillStyle='#314265';painter.fillRect(0,0,640,360);painter.fillStyle='#ffff00';painter.fillRect((time/4)%550,80,80,200);
  const marker=[0xa5,time&255,(time>>>8)&255,(time>>>16)&255,checksum(time)];
  for(let bit=0;bit<40;bit++){painter.fillStyle=(marker[Math.floor(bit/8)]>>>(bit%8))&1?'white':'black';painter.fillRect(bit*12,0,12,24);}
 };
 paint();const paintTimer=setInterval(paint,1000/30),stream=source.captureStream(30);
 const tx=new RTCPeerConnection({iceServers:[]}),rx=new RTCPeerConnection({iceServers:[]});
 let remote;
 tx.onicecandidate=event=>{if(event.candidate)rx.addIceCandidate(event.candidate).catch(()=>{});};
 rx.onicecandidate=event=>{if(event.candidate)tx.addIceCandidate(event.candidate).catch(()=>{});};
 rx.ontrack=event=>{remote=new LivekitClient.RemoteVideoTrack(event.track,'qa-video',event.receiver);};
 tx.addTrack(stream.getVideoTracks()[0],stream);
 const box=document.querySelector('#video'),audio=document.querySelector('#audio');
 const frameCanvas=document.createElement('canvas');frameCanvas.width=480;frameCanvas.height=1;
 const pixels=frameCanvas.getContext('2d',{willReadFrequently:true});
 const results=[];
 const snapshot=async()=>{
  const report=await rx.getStats(),values=[...report.values()];
  const inbound=values.find(s=>s.type==='inbound-rtp'&&s.kind==='video');
  const transport=values.find(s=>s.type==='transport'&&s.selectedCandidatePairId);
  const pair=transport?report.get(transport.selectedCandidatePairId):values.find(s=>s.type==='candidate-pair'&&s.state==='succeeded'&&s.nominated);
  return {at:performance.now(),ssrc:inbound?.ssrc,bytes:inbound?.bytesReceived||0,frames:inbound?.framesDecoded||0,drops:inbound?.framesDropped||0,packets:inbound?.packetsReceived||0,lost:inbound?.packetsLost||0,jitterMs:inbound?.jitter===undefined?null:inbound.jitter*1000,jitterDelay:inbound?.jitterBufferDelay,emitted:inbound?.jitterBufferEmittedCount,decodeTime:inbound?.totalDecodeTime,rttMs:pair?.currentRoundTripTime===undefined?null:pair.currentRoundTripTime*1000};
 };
 const averageDelta=(end,start,sum,count)=>Number.isFinite(end[sum])&&Number.isFinite(start[sum])&&end[count]>start[count]?1000*(end[sum]-start[sum])/(end[count]-start[count]):null;
 try {
  await tx.setLocalDescription(await tx.createOffer());await rx.setRemoteDescription(tx.localDescription);
  await rx.setLocalDescription(await rx.createAnswer());await tx.setRemoteDescription(rx.localDescription);
  await wait(()=>remote&&rx.connectionState==='connected');
  for(const mode of ['legacy','optimized','optimized','legacy']){
   const bindings=exports.createOutputTrackBindings(()=>box,()=>audio);
   let attaches=0,attachMs=0,blank=0,rejected=0;const ages=[];
   const attach=()=>{
    const before=performance.now();
    if(mode==='optimized'){if(bindings.attach(remote))attaches++;}
    else {const el=remote.attach();el.muted=true;el.autoplay=true;el.playsInline=true;box.replaceChildren(el);attaches++;}
    attachMs+=performance.now()-before;
   };
   attach();await wait(()=>box.querySelector('video')?.readyState>=2);await sleep(1000);
   const begin=await snapshot();
   // Deliberately repeated subscription/restoration callbacks, not normal event frequency.
   for(let index=0;index<60;index++){
    if(index%5===0)attach();
    await sleep(100);
    const el=box.querySelector('video');
    if(!el||el.readyState<2){blank++;continue;}
    pixels.drawImage(el,0,8,480,1,0,0,480,1);
    const data=pixels.getImageData(0,0,480,1).data, marker=[0,0,0,0,0];
    for(let bit=0;bit<40;bit++)if(data[(bit*12+6)*4]>127)marker[Math.floor(bit/8)]|=1<<(bit%8);
    const timestamp=marker[1]|(marker[2]<<8)|(marker[3]<<16),age=performance.now()-started-timestamp;
    if(marker[0]===0xa5&&marker[4]===checksum(timestamp)&&age>=0&&age<5000)ages.push(age);else rejected++;

   }
   const end=await snapshot(),ordered=ages.sort((a,b)=>a-b),quantile=q=>ordered.length?ordered[Math.min(ordered.length-1,Math.floor(q*ordered.length))]:null;
   const retained=remote.attachedElements.length;
   bindings.clear();remote.detach().forEach(el=>{el.srcObject=null;el.remove();});box.replaceChildren();
   const result={mode,attaches,retainedElements:retained,attachMs,blankSamples:blank,markerRejected:rejected,ageSamples:ages.length,frameAgeP50Ms:quantile(.5),frameAgeP95Ms:quantile(.95),decodedFps:1000*(end.frames-begin.frames)/(end.at-begin.at),bitrateKbps:8*(end.bytes-begin.bytes)/(end.at-begin.at),framesDropped:end.drops-begin.drops,packetsLost:end.lost-begin.lost,packetsReceived:end.packets-begin.packets,jitterMs:end.jitterMs,rttMs:end.rttMs,jitterBufferMs:averageDelta(end,begin,'jitterDelay','emitted'),decodeMs:averageDelta(end,begin,'decodeTime','frames'),sameSSRC:begin.ssrc===end.ssrc,trackLive:remote.mediaStreamTrack.readyState==='live'};
   if(!result.trackLive||!result.sameSSRC||result.decodedFps<5)throw Error('media stopped '+JSON.stringify(result));
   if(mode==='optimized'&&(attaches!==1||retained!==1))throw Error('attachment regression');
   results.push(result);
  }
  return {scope:'same-machine loopback; synthetic 640x360@30; Firefox; actual LiveKit RemoteVideoTrack; no SFU/WAN/phone',results};
 }finally{clearInterval(paintTimer);remote?.detach().forEach(el=>el.remove());stream.getTracks().forEach(t=>t.stop());tx.close();rx.close();}
};
"""
fixture=out/'fixture.html';fixture.write_text('<meta charset=utf-8><div id=video></div><div id=audio></div><script src="'+bundle+'"></script><script>var exports={};'+compiled+js+'</script>',encoding='utf-8')
options=webdriver.FirefoxOptions();options.add_argument('-headless');options.binary_location=os.environ['CASTLINK_QA_FIREFOX_BINARY']
options.set_preference('media.autoplay.default',0)
driver=webdriver.Firefox(service=Service(os.environ['CASTLINK_QA_GECKODRIVER']),options=options)
driver.set_page_load_timeout(15);driver.set_script_timeout(90)
try:
 driver.get(fixture.as_uri())
 result=driver.execute_async_script('const done=arguments[0];window.run().then(done).catch(error=>done({error:String(error),stack:error.stack}));')
 (out/'results.json').write_text(json.dumps(result,indent=2),encoding='utf-8')
 print(json.dumps({'output':str(out),'result':result}),flush=True)
 assert 'error' not in result,result
finally:driver.quit()
