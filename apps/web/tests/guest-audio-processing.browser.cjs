// Local Chromium + real LiveKit LocalAudioTrack, with a deterministic fake WAV
// microphone. Proves native processing, not physical device/OS driver behaviour.
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),os=require('node:os'),path=require('node:path'),{spawn}=require('node:child_process'),ts=require('typescript');
const web=path.resolve(__dirname,'..'),out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-native-audio-'));
const rate=48000,seconds=12,data=Buffer.alloc(rate*seconds*2);let seed=1703;
for(let i=0;i<rate*seconds;i++){
  seed=(Math.imul(seed,1664525)+1013904223)>>>0;const noise=(seed/4294967296*2-1)*.095,t=i/rate;
  const voice=t>=6?(Math.sin(2*Math.PI*135*t)+.5*Math.sin(2*Math.PI*675*t)+.35*Math.sin(2*Math.PI*1215*t))*(.3+.7*Math.sin(2*Math.PI*2.4*t)**2)*.09:0;
  data.writeInt16LE(Math.round(Math.max(-.95,Math.min(.95,noise+voice))*32767),i*2);
}
const header=Buffer.alloc(44);header.write('RIFF');header.writeUInt32LE(data.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(rate,24);header.writeUInt32LE(rate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(data.length,40);fs.writeFileSync(`${out}/input.wav`,Buffer.concat([header,data]));
const audioModule=ts.transpileModule(fs.readFileSync(`${web}/lib/guest-audio.ts`,'utf8'),{compilerOptions:{module:ts.ModuleKind.ES2022,target:ts.ScriptTarget.ES2022}}).outputText;
const server=http.createServer((request,response)=>{
  if(request.url==='/livekit.js'){response.setHeader('content-type','text/javascript');response.end(fs.readFileSync(`${web}/node_modules/livekit-client/dist/livekit-client.umd.js`));}
  else if(request.url==='/audio.mjs'){response.setHeader('content-type','text/javascript');response.end(audioModule);}
  else response.end('<!doctype html><script src="/livekit.js"></script><title>Native guest processing QA</title>');
});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));let chrome,ws;
(async()=>{
  await new Promise((resolve,reject)=>{server.on('error',reject);server.listen(0,'127.0.0.1',resolve);});
  chrome=spawn(process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',['--headless','--no-sandbox','--disable-dev-shm-usage','--no-first-run','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream',`--use-file-for-fake-audio-capture=${out}/input.wav`,'--autoplay-policy=no-user-gesture-required',`--user-data-dir=${out}/profile`,'--remote-debugging-port=0',`http://127.0.0.1:${server.address().port}`],{stdio:'ignore'});
  let port;for(let i=0;i<100;i++){try{port=fs.readFileSync(`${out}/profile/DevToolsActivePort`,'utf8').split('\n')[0];break;}catch{}await sleep(50);}assert.ok(port,'Chromium started');
  const tabs=await(await fetch(`http://127.0.0.1:${port}/json/list`)).json();ws=new WebSocket(tabs.find(tab=>tab.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});let id=0;const pending=new Map();ws.onmessage=event=>{const message=JSON.parse(event.data);if(message.id){const done=pending.get(message.id);pending.delete(message.id);message.error?done.reject(Error(JSON.stringify(message.error))):done.resolve(message.result);}};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id;pending.set(n,{resolve,reject});ws.send(JSON.stringify({id:n,method,params}));});
  const result=await send('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
    const h=await import('/audio.mjs');for(let i=0;i<250&&!window.LivekitClient?.createLocalAudioTrack;i++)await new Promise(resolve=>setTimeout(resolve,20));const sdk=window.LivekitClient;
    const raw={audioProfile:'raw'},noise={audioProfile:'speech'};
    const track=await sdk.createLocalAudioTrack(h.guestAudioCaptureOptions(raw));track.source=sdk.Track.Source.Microphone;
    let publication={track,options:h.guestAudioPublishOptions(raw,track.getSourceTrackSettings())};const calls=[];
    const room={state:'connected',localParticipant:{getTrackPublication:()=>publication,async unpublishTrack(target,stop){if(target!==track||stop!==false)throw Error('wrong scoped unpublish');calls.push({event:'unpublish',muted:track.isMuted});publication=undefined;track.sender=undefined;},async publishTrack(target,options){if(target!==track)throw Error('different SDK track');if(track.isMuted&&track.mediaStreamTrack.enabled)throw Error('muted capture published enabled');publication={track,options};calls.push({event:'publish',muted:track.isMuted,enabled:track.mediaStreamTrack.enabled,settings:track.getSourceTrackSettings()});return publication;}}};
    async function sample(){
      const settings=track.getSourceTrackSettings(),ctx=new AudioContext();await ctx.resume();const source=ctx.createMediaStreamSource(new MediaStream([track.mediaStreamTrack])),processor=ctx.createScriptProcessor(1024,1,1);let position=0,noiseSum=0,noiseCount=0,voiceSum=0,voiceCount=0;
      processor.onaudioprocess=event=>{const samples=event.inputBuffer.getChannelData(0);for(const value of samples){const t=position++/ctx.sampleRate;if(t>=1&&t<4){noiseSum+=value*value;noiseCount++;}if(t>=7&&t<10){voiceSum+=value*value;voiceCount++;}}};source.connect(processor);processor.connect(ctx.destination);
      await new Promise(resolve=>setTimeout(resolve,11000));source.disconnect();processor.disconnect();await ctx.close();return{settings,noiseRms:Math.sqrt(noiseSum/noiseCount),voicedRms:Math.sqrt(voiceSum/voiceCount)};
    }
    const original=await sample();
    await track.applyConstraints(h.guestAudioProcessingOptions(noise));const legacyApply={constraints:track.constraints,settings:track.getSourceTrackSettings()};
    if(!await h.switchGuestMicrophoneProfile(room,raw,noise))throw Error('noise mode not applied');const suppressed=await sample();
    if(!await h.switchGuestMicrophoneProfile(room,noise,raw))throw Error('raw mode not restored');const restored=await sample();
    await track.mute();if(!await h.switchGuestMicrophoneProfile(room,raw,noise))throw Error('muted mode failed');const muted={isMuted:track.isMuted,enabled:track.mediaStreamTrack.enabled,settings:track.getSourceTrackSettings()};
    track.stop();return{userAgent:navigator.userAgent,original,legacyApply,suppressed,restored,muted,calls};
  })()`});
  if(result.exceptionDetails)throw Error(JSON.stringify(result.exceptionDetails));const value=result.result.value;
  value.noiseReductionDb=20*Math.log10(value.suppressed.noiseRms/value.original.noiseRms);value.rawRoundtripDb=20*Math.log10(value.restored.noiseRms/value.original.noiseRms);
  fs.writeFileSync(`${out}/results.json`,JSON.stringify(value,null,2));
  assert.equal(value.original.settings.noiseSuppression,false);assert.equal(value.suppressed.settings.noiseSuppression,true);assert.equal(value.suppressed.settings.autoGainControl,false);assert.equal(value.restored.settings.noiseSuppression,false);
  assert.ok(value.noiseReductionDb < -8,`native NS must reduce stationary noise: ${value.noiseReductionDb.toFixed(2)} dB`);
  assert.ok(value.suppressed.voicedRms > value.suppressed.noiseRms*2,'voiced signal remains above suppressed background');
  assert.ok(Math.abs(value.rawRoundtripDb)<2,'returning to raw restores original background instead of gating it');
  assert.equal(value.muted.isMuted,true);assert.equal(value.muted.enabled,false);
  console.log(JSON.stringify({out,noiseReductionDb:value.noiseReductionDb,rawRoundtripDb:value.rawRoundtripDb,rawNoise:value.original.noiseRms,suppressedNoise:value.suppressed.noiseRms,suppressedVoiced:value.suppressed.voicedRms,legacyApplyActualNS:value.legacyApply.settings.noiseSuppression,muted:value.muted}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{ws?.close();chrome?.kill();server.close();});
