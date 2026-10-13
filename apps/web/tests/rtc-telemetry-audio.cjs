const assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), Module = require('node:module');
const { EventEmitter } = require('node:events');
const original = Module._extensions['.ts'];
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,file);
const tasks = [], samples = [];
const imports = { './media-stats':require('../lib/media-stats.ts'),'./telemetry-context':require('../lib/telemetry-context.ts'),
  './audio-diagnostics':require('../lib/audio-diagnostics.ts'),'livekit-client':require('livekit-client') };
const loaded = { exports:{} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/rtc-telemetry.ts'),'utf8'),{
  compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,
  {module:loaded,exports:loaded.exports,require:name=>imports[name],Date,crypto:require('node:crypto').webcrypto,AbortSignal,
    fetch:async(_url,options)=>{samples.push(JSON.parse(options.body));return {ok:true};},
    setTimeout:(callback,ms)=>{const timer={callback,ms};tasks.push(timer);return timer;},clearTimeout:timer=>{const index=tasks.indexOf(timer);if(index>=0)tasks.splice(index,1);}});
const room = new EventEmitter();
room.localParticipant={identity:'output-audio-test',name:'Output',isLocal:true,trackPublications:new Map()};
room.remoteParticipants=new Map();room.state='connected';
let rtcAt=1000, received=1000, calls=[];
const publication=(kind,sid,getRTCStatsReport)=>({kind,source:kind==='audio'?'microphone':'camera',trackSid:sid,track:{getRTCStatsReport}});
const hungAudio=publication('audio','hung-audio',()=>{calls.push('hung-audio');return new Promise(()=>{});});
const healthy=publication('audio','healthy',async()=>{calls.push('healthy-audio');return new Map([['audio',{id:'audio',type:'inbound-rtp',timestamp:rtcAt,bytesReceived:received,packetsReceived:received,packetsLost:0,totalSamplesReceived:received,concealedSamples:0}]]);});
const hungVideo=publication('video','hung-video',()=>{calls.push('hung-video');return new Promise(()=>{});});
const participant={identity:'guest-one',name:'Guest',isLocal:false,trackPublications:new Map([['video',hungVideo],['audio-hung',hungAudio],['audio-good',healthy]])};
room.remoteParticipants.set('guest-one',participant);
(async()=>{
 const started=Date.now();const stop=loaded.exports.startRoomTelemetry(room,'media-room','malformed',undefined,'',()=>({enabled:true,paused:false,recoveryAttempts:3}));
 while(!tasks.length) await new Promise(resolve=>setTimeout(resolve,20));
 assert.ok(Date.now()-started<1500,'whole cycle is capped at 1000 ms even with multiple hanging tracks');
 assert.deepEqual(calls,['hung-audio','healthy-audio','hung-video'],'audio is sampled before video');
 assert.equal(samples[0].audioPlayback.recoveryAttempts,3,'recovery counters are recorded even when stats hang');
 assert.equal(samples[0].streams.length,1);assert.equal(samples[0].streams[0].audio.receivedSamplesDelta,null);
 // Remove the track for a complete cycle, then reinsert the same reported IDs.
 participant.trackPublications.clear();await tasks.shift().callback();
 rtcAt=3000;received=3000;participant.trackPublications.set('audio-good',healthy);await tasks.shift().callback();
 assert.equal(samples.at(-1).streams[0].audio.receivedSamplesDelta,null,'discontinued counters are pruned before reused track IDs');
 rtcAt=5000;received=5000;await tasks.shift().callback();
 assert.equal(samples.at(-1).streams[0].audio.receivedSamplesDelta,2000);
 participant.trackPublications=new Map([['hung',hungAudio]]);
 const pending=tasks.shift().callback();await Promise.resolve();stop();const afterStop=samples.length;await pending;
 assert.equal(samples.length,afterStop,'a pending stats read cannot send connected telemetry after teardown');
 assert.equal(samples.at(-1).state,'disconnected');assert.equal(tasks.length,0);
 console.log('PASS: audio-first 1000ms collection budget, hung-track playback diagnostics, pruned track counters, interval sampling, no post-stop writes');
})().finally(()=>{if(original)Module._extensions['.ts']=original;else delete Module._extensions['.ts'];})
 .catch(error=>{console.error(error);process.exitCode=1;});
