// Private, one-shot GitHub Actions QA. Never print the secret fixture or raw errors.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import https from 'node:https';
import tls from 'node:tls';
import {isIP} from 'node:net';
import {randomBytes, X509Certificate} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {pathToFileURL} from 'node:url';

const check = value => { if (!value) throw Error('refused'); };
export function validate(c) {
  check(c && typeof c === 'object' && !Array.isArray(c));
  check(Object.keys(c).every(k => ['schemaVersion','mode','publicIp','serviceIp','origin','caPem','expectedBuildId','studioId','room','invite'].includes(k)));
  check(c.schemaVersion === 1 && ['connectivity','media'].includes(c.mode));
  for (const k of ['publicIp','serviceIp']) {
    check(typeof c[k] === 'string' && isIP(c[k]) === 4);
    const a = c[k].split('.').map(Number);
    check(a[0] !== 0 && a[0] !== 127 && a[0] < 224 && c[k] !== '255.255.255.255');
  }
  const [a,b] = c.publicIp.split('.').map(Number);
  check(c.publicIp !== c.serviceIp && !(a===10 || a===100&&b>=64&&b<=127 || a===169&&b===254 || a===172&&b>=16&&b<=31 || a===192&&b===168 || a===198&&(b===18||b===19)));
  const u = new URL(c.origin);
  check(c.origin === 'https://' + c.serviceIp && u.hostname === c.serviceIp && u.port === '' && !u.username && !u.password && !u.search && !u.hash);
  check(typeof c.caPem === 'string' && c.caPem.length < 16384 && /^\s*-----BEGIN CERTIFICATE-----\s+[A-Za-z0-9+/=\r\n]+\s+-----END CERTIFICATE-----\s*$/.test(c.caPem) && new X509Certificate(c.caPem).ca);
  check(typeof c.expectedBuildId === 'string' && /^[A-Za-z0-9._-]{7,128}$/.test(c.expectedBuildId));
  if (c.mode === 'media') {
    check(typeof c.studioId === 'string' && /^[A-Za-z0-9._:-]{6,128}$/.test(c.studioId));
    check(typeof c.room === 'string' && c.room.trim() === c.room && c.room.length > 0 && c.room.length <= 100 && !/[\x00-\x1f\x7f]/.test(c.room));
    check(typeof c.invite === 'string' && /^[A-Za-z0-9._~-]{1,4096}$/.test(c.invite));
  }
  return c;
}
function command(bin, args) {
  return execFileSync(bin, args, {stdio:['ignore','pipe','pipe'],timeout:10000,maxBuffer:65536,windowsHide:true});
}
function version(c, signal) {
  return new Promise((resolve,reject) => {
    const q = https.get(c.origin + '/api/version', {ca:c.caPem,rejectUnauthorized:true,ALPNProtocols:['http/1.1'],agent:false,signal,timeout:10000}, r => {
      if (r.statusCode !== 200) { r.resume(); reject(Error()); return; }
      let size=0; const chunks=[];
      r.on('data', b => { size+=b.length; if(size>16384) q.destroy(Error()); else chunks.push(b); });
      r.on('error',reject);r.on('end',()=>{try{const v=JSON.parse(Buffer.concat(chunks));check(v.buildId===c.expectedBuildId);resolve({httpsVerified:true,buildId:v.buildId});}catch{reject(Error());}});
    });
    q.on('timeout',()=>q.destroy(Error())); q.on('error',reject);
  });
}
function stun(c, signal) {
  return new Promise((resolve,reject) => {
    const request=Buffer.alloc(20);request.writeUInt16BE(1);request.writeUInt32BE(0x2112a442,4);randomBytes(12).copy(request,8);
    const socket=tls.connect({host:c.serviceIp,port:443,ca:c.caPem,rejectUnauthorized:true,signal});
    let bytes=Buffer.alloc(0),settled=false;
    const finish=(error)=>{if(settled)return;settled=true;socket.destroy();error?reject(Error()):resolve({turnTlsVerified:true,stunBindingVerified:true});};
    socket.setTimeout(10000,()=>finish(true));socket.on('error',()=>finish(true));
    socket.on('secureConnect',()=>{if(!socket.authorized){finish(true);return;}socket.write(request);});
    socket.on('data',b=>{bytes=Buffer.concat([bytes,b]);if(bytes.length>4096){finish(true);return;}if(bytes.length<20)return;
      const length=20+bytes.readUInt16BE(2);if(length!==40){finish(true);return;}if(bytes.length<length)return;
      finish(!(bytes.length===40&&bytes.readUInt16BE(0)===0x0101&&bytes.readUInt32BE(4)===0x2112a442&&bytes.subarray(8,20).equals(request.subarray(8,20))));
    });
    socket.on('end',()=>{if(!settled)finish(true);});
  });
}
const observePCs = () => {
  window.__qaPCs=[];window.__qaICEErrors=[];window.__qaHistory=[];
  const snapshot=async()=>{
    const peers=[];
    for(const pc of window.__qaPCs){
      try{
        const stats=[...(await pc.getStats()).values()];
        peers.push({state:pc.connectionState,iceState:pc.iceConnectionState,gatherState:pc.iceGatheringState,
          localCandidates:stats.filter(s=>s.type==='local-candidate').map(s=>({type:s.candidateType,protocol:s.protocol,relayProtocol:s.relayProtocol||null})),
          remoteCandidates:stats.filter(s=>s.type==='remote-candidate').map(s=>({type:s.candidateType,protocol:s.protocol,addressMatchesConfigured:s.address===location.hostname,port:s.port===7882?7882:s.port===7881?7881:null})),
          pairs:stats.filter(s=>s.type==='candidate-pair').map(s=>({state:s.state,nominated:s.nominated===true,bytesSent:s.bytesSent||0,bytesReceived:s.bytesReceived||0,requestsSent:s.requestsSent||0,responsesReceived:s.responsesReceived||0,requestsReceived:s.requestsReceived||0,responsesSent:s.responsesSent||0})),
          dtls:stats.filter(s=>s.type==='transport').map(s=>s.dtlsState||null)});
      }catch{}
    }
    window.__qaHistory.push(peers);if(window.__qaHistory.length>8)window.__qaHistory.shift();
  };
  window.__qaSnapshotTimer=setInterval(()=>snapshot(),1000);
  const P=window.RTCPeerConnection;
  window.RTCPeerConnection=new Proxy(P,{construct(t,args){const pc=Reflect.construct(t,args);window.__qaPCs.push(pc);pc.addEventListener('icecandidateerror',e=>{if(Number.isInteger(e.errorCode))window.__qaICEErrors.push(e.errorCode);});return pc;}});
};
const setupBrowser = () => {
  const LK=window.LivekitClient;
  window.__qa={room:new LK.Room({adaptiveStream:false,dynacast:false}),videos:[],tracks:[]};
  const q=window.__qa;
  q.room.on(LK.RoomEvent.TrackSubscribed,track=>{if(track.kind!=='video')return;const video=track.attach();video.muted=true;video.autoplay=true;video.playsInline=true;document.body.append(video);video.play().catch(()=>{});q.videos.push(video);});
  q.connect=async(origin,token)=>{
    try{await q.room.connect(origin.replace(/^https:/,'wss:'),token,{autoSubscribe:true,rtcConfig:{iceTransportPolicy:'relay'}});return {connected:true};}
    catch(error){
      const host=new URL(origin).hostname;
      const peers=window.__qaPCs.map(pc=>{
        const urls=(pc.getConfiguration().iceServers||[]).flatMap(s=>typeof s.urls==='string'?[s.urls]:s.urls||[]);
        return {state:pc.connectionState,iceState:pc.iceConnectionState,gatherState:pc.iceGatheringState,iceUrls:urls.map(value=>{
          const m=/^(turns?):([^:]+):([0-9]+)(?:[?].*)?$/.exec(value);
          return {parsed:!!m,hostMatches:m?.[2]===host,tls:m?.[1]==='turns',port:m&&['443','5349','3478'].includes(m[3])?Number(m[3]):null};
        })};
      });
      const message=typeof error?.message==='string'?error.message:'';
      return {connected:false,status:Number.isInteger(error?.status)&&error.status>=100&&error.status<=599?error.status:null,iceErrorCodes:window.__qaICEErrors,history:window.__qaHistory,pcEstablishFailure:/could not establish (?:pc|publisher|subscriber) connection/i.test(message),reason:Number.isInteger(error?.reason)&&error.reason>=0&&error.reason<=20?error.reason:null,signalFailure:/signal|websocket/i.test(message),peerFailure:/peer|ice/i.test(message),timeout:/timeout|timed out/i.test(message),peers};
    }
  };
  q.publish=async()=>{
    const canvas=document.createElement('canvas');canvas.width=640;canvas.height=360;const ctx=canvas.getContext('2d');let frame=0;
    const paint=()=>{ctx.fillStyle=`hsl(${frame++%360} 80% 40%)`;ctx.fillRect(0,0,640,360);ctx.fillStyle='white';ctx.font='32px sans-serif';ctx.fillText(String(frame),20,60);};
    paint();q.timer=setInterval(paint,67);q.stream=canvas.captureStream(15);const track=new LK.LocalVideoTrack(q.stream.getVideoTracks()[0],undefined,true);q.tracks.push(track);
    await q.room.localParticipant.publishTrack(track,{source:LK.Track.Source.Camera,videoCodec:'vp8',simulcast:false});
  };
  q.sample=async()=>{
    const media=[],pairs=[];
    for(const pc of window.__qaPCs){
      const report=await pc.getStats(),rtp=[...report.values()].filter(s=>['inbound-rtp','outbound-rtp'].includes(s.type)&&!s.isRemote&&(s.kind||s.mediaType)==='video');
      const flowing=rtp.filter(s=>(s.bytesReceived||s.bytesSent||0)>0);
      if(!flowing.length)continue;
      for(const s of flowing){
        media.push({id:s.id,direction:s.type,bytes:s.bytesReceived??s.bytesSent??0,packets:s.packetsReceived??s.packetsSent??0,frames:s.framesDecoded??s.framesEncoded??0});
        const transport=report.get(s.transportId),pair=report.get(transport?.selectedCandidatePairId),local=report.get(pair?.localCandidateId);
        pairs.push({selected:!!pair&&pair.state==='succeeded',relay:local?.candidateType==='relay',tls:local?.relayProtocol==='tls',url:local?.url||''});
      }
    }
    return {media,pairs,playing:q.videos.some(v=>v.videoWidth>0&&v.videoHeight>0&&v.getVideoPlaybackQuality().totalVideoFrames>0)};
  };
  q.stop=async()=>{clearInterval(q.timer);await q.room.disconnect();q.tracks.forEach(t=>t.stop());q.stream?.getTracks().forEach(t=>t.stop());};
};
export function verifyMedia(before,after,serviceIp) {
  check(before?.playing && after?.playing && before.media.length && after.media.length);
  const expected='turns:'+serviceIp+':443?transport=tcp';
  for(const sample of [before,after])check(sample.pairs.length>0&&sample.pairs.every(p=>p.selected&&p.relay&&p.tls&&p.url===expected));
  const deltas={};
  for(const direction of ['inbound-rtp','outbound-rtp']) {
    const b=before.media.filter(s=>s.direction===direction);
    const changes=b.map(s=>{const a=after.media.find(a=>a.id===s.id&&a.direction===direction);return a?{bytes:a.bytes-s.bytes,packets:a.packets-s.packets,frames:a.frames-s.frames}:null;}).filter(d=>d&&d.bytes>0&&d.packets>0&&d.frames>0);
    check(changes.length>0);deltas[direction==='inbound-rtp'?'received':'sent']=changes[0];
  }
  return {relayTls443Verified:true,decodedVideoVerified:true,...deltas};
}
async function media(c,signal,cleanup,progress) {
  progress("browser-dependencies");
  const req=createRequire(path.join(process.cwd(),'package.json'));
  const {chromium}=req('playwright'),sdkPath=req.resolve('livekit-client'),sdk=await fs.readFile(sdkPath,'utf8');
  const sdkVersion=JSON.parse(await fs.readFile(path.resolve(path.dirname(sdkPath),'../package.json'),'utf8')).version;
  check(sdkVersion==='2.22.3');
  progress("browser-trust");
  const home=os.homedir(),nss=path.join(home,'.pki/nssdb'),nickname='castlink-external-'+randomBytes(12).toString('hex');
  await fs.mkdir(nss,{recursive:true,mode:0o700});check((await fs.lstat(nss)).isDirectory()&&!(await fs.lstat(nss)).isSymbolicLink());
  try{await fs.lstat(path.join(nss,'cert9.db'));}catch(e){if(e.code!=='ENOENT')throw e;command('certutil',['-N','--empty-password','-d','sql:'+nss]);}
  const caFile=path.join(process.env.RUNNER_TEMP,nickname+'.crt');await fs.writeFile(caFile,c.caPem,{mode:0o600,flag:'wx'});cleanup.push(()=>fs.unlink(caFile));
  cleanup.push(()=>command('certutil',['-D','-n',nickname,'-d','sql:'+nss]));command('certutil',['-A','-n',nickname,'-t','C,,','-d','sql:'+nss,'-i',caFile]);
  check(!signal.aborted);
  progress("browser-launch");
  const browser=await chromium.launch({headless:true,timeout:20000,args:['--autoplay-policy=no-user-gesture-required']});
  cleanup.push(()=>browser.close());check(!signal.aborted);const onAbort=()=>{browser.close().catch(()=>{});};signal.addEventListener('abort',onAbort,{once:true});
  cleanup.push(()=>signal.removeEventListener('abort',onAbort));
  const pages=[];
  for(let i=0;i<2;i++){
    check(!signal.aborted);const ctx=await browser.newContext({ignoreHTTPSErrors:false});await ctx.addInitScript(observePCs);const page=await ctx.newPage();page.setDefaultTimeout(15000);page.setDefaultNavigationTimeout(15000);pages.push(page);cleanup.push(()=>page.evaluate(()=>window.__qa?.stop()));
    const networkFacts=[];
    page.on('response',r=>{try{const u=new URL(r.url());if(u.origin===c.origin&&['/rtc/validate','/rtc/v1/validate'].includes(u.pathname))networkFacts.push({route:u.pathname,status:r.status()});}catch{}});
    page.on('websocket',ws=>{try{const u=new URL(ws.url());if(u.hostname===c.serviceIp&&['/rtc','/rtc/v1'].includes(u.pathname))ws.on('socketerror',e=>{const m=/\b(401|403|404|413|429|500|502|503)\b/.exec(String(e));networkFacts.push({route:u.pathname,status:m?Number(m[1]):null,socketError:true});});}catch{}});
    progress("browser-page-"+i);
    await page.goto(c.origin,{waitUntil:'domcontentloaded'});
    progress("browser-auth-token-"+i);
    const token=await page.evaluate(async({studioId,room,invite,name})=>{
      const auth=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({kind:'guest',studioId,room,invite}),signal:AbortSignal.timeout(10000)});
      if(!auth.ok)throw Error();const query=new URLSearchParams({role:'guest',studioId,room,name,nameIntent:'join'});
      const r=await fetch('/api/token?'+query,{signal:AbortSignal.timeout(10000)});if(!r.ok)throw Error();const v=await r.json();if(!v.token||!v.identity?.startsWith('guest-')||v.connectionRoutes?.relay?.configured!==true||v.connectionRoutes.relay.transport!=='tls443')throw Error();return v.token;
    },{studioId:c.studioId,room:c.room,invite:c.invite,name:'External synthetic '+(i+1)});
    await page.addScriptTag({content:sdk});await page.evaluate(setupBrowser);progress('browser-connect-'+i);const connection=await page.evaluate(({origin,token})=>window.__qa.connect(origin,token),{origin:c.origin,token});if(!connection.connected)console.error('external connection facts='+JSON.stringify({...connection,networkFacts}));check(connection.connected);progress('browser-publish-'+i);await page.evaluate(()=>window.__qa.publish());
  }
  progress("browser-receive");
  for(const page of pages)await page.waitForFunction(()=>window.__qa.videos.some(v=>v.videoWidth>0&&v.videoHeight>0));
  progress("browser-stats");
  progress("browser-stats-before");
  const before=await Promise.all(pages.map(p=>p.evaluate(()=>window.__qa.sample())));
  await new Promise((resolve,reject)=>{const t=setTimeout(resolve,3000);signal.addEventListener('abort',()=>{clearTimeout(t);reject(Error());},{once:true});});
  progress("browser-stats-after");
  const after=await Promise.all(pages.map(p=>p.evaluate(()=>window.__qa.sample())));
  progress("browser-stats-verify");
  function safeSample(sample){return {playing:sample.playing,media:sample.media.map(s=>({direction:s.direction,bytes:s.bytes,packets:s.packets,frames:s.frames})),pairs:sample.pairs.map(p=>{const m=/^(turns?):([^:]+):([0-9]+)(?:[?](.*))?$/.exec(p.url);return {selected:p.selected,relay:p.relay,tls:p.tls,urlPresent:!!p.url,urlParsed:!!m,urlTls:m?.[1]==='turns',hostMatches:m?.[2]===c.serviceIp,port443:m?.[3]==='443',transportTcp:m?.[4]==='transport=tcp'};})};}
  try{for(let i=0;i<before.length;i++)verifyMedia(before[i],after[i],c.serviceIp);}catch{console.error('external media facts='+JSON.stringify(before.map((b,i)=>({before:safeSample(b),after:safeSample(after[i]),idsContinuous:b.media.every(s=>after[i].media.some(t=>t.id===s.id&&t.direction===s.direction))}))));throw Error('unverified');}
  return {syntheticCameraOnly:true,chromiumVersion:browser.version(),livekitClientVersion:sdkVersion,playwrightVersion:req('playwright/package.json').version,clients:before.map((b,i)=>verifyMedia(b,after[i],c.serviceIp))};
}
export async function main() {
  let stage='validation';const cleanup=[];let failure=false;const signal=AbortSignal.timeout(120000);
  try {
    check(process.platform==='linux'&&process.env.GITHUB_ACTIONS==='true'&&Number(process.versions.node.split('.')[0])===22);
    check(process.env.RUNNER_TEMP&&path.isAbsolute(process.env.RUNNER_TEMP));
    const raw=process.env.CASTLINK_WSL_EXTERNAL_QA;check(typeof raw==='string'&&raw.length<32768);const c=validate(JSON.parse(raw));delete process.env.CASTLINK_WSL_EXTERNAL_QA;
    const comment='castlink-external-'+randomBytes(12).toString('hex');
    const rule=['OUTPUT','-p','tcp','-d',c.serviceIp+'/32','--dport','443','-m','comment','--comment',comment,'-j','DNAT','--to-destination',c.publicIp+':443'];
    stage='mapping';cleanup.push(()=>command('sudo',['-n','iptables','-w','5','-t','nat','-D',...rule]));command('sudo',['-n','iptables','-w','5','-t','nat','-A',...rule]);
    stage='https';const receipt={schemaVersion:1,mode:c.mode,...await version(c,signal)};
    stage='turn-tls';Object.assign(receipt,await stun(c,signal));
    if(c.mode==='media'){stage='browser-media';Object.assign(receipt,await media(c,signal,cleanup,value=>{stage=value;}));}
    stage='receipt';check(!signal.aborted);receipt.completedAt=new Date().toISOString();await fs.writeFile(path.join(process.env.RUNNER_TEMP,'castlink-wsl-external-proof.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600,flag:'wx'});
  } catch { failure=true;console.error('external proof failed; stage='+stage+'; code=unverified'); }
  finally {for(const action of cleanup.reverse()){try{await action();}catch{failure=true;console.error('external proof cleanup failed; code=unverified');}}}
  if(failure)process.exitCode=1;else console.log('external proof complete');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await main();
