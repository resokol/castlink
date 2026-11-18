const assert = require('node:assert/strict');
const fs = require('node:fs');
const { EventEmitter } = require('node:events');
const { load } = require('./load-typescript.cjs');
assert.ok(fs.existsSync(require('node:path').join(__dirname, '../lib/video-diagnostics.ts')), 'video diagnostics collector must exist');
const { sanitizeVideoDiagnostic, videoDiagnostic, telemetryBody } = load('../lib/video-diagnostics.ts');
assert.equal(sanitizeVideoDiagnostic(undefined), undefined);
assert.equal(sanitizeVideoDiagnostic([]), undefined);
const clean = sanitizeVideoDiagnostic({framesDecoded:0,framesDropped:-1,totalDecodeTime:Infinity,framesSent:'3',trackSid:'TR_test',
  publicationMuted:false,mediaTrackEnabled:true,mediaTrackReadyState:'live',token:'secret',deviceId:'secret',sdp:'secret'});
assert.equal(clean.framesDecoded,0);assert.equal(clean.framesDropped,null);assert.equal(clean.totalDecodeTime,null);assert.equal(clean.framesSent,null);
assert.equal(clean.publicationMuted,false);assert.equal(clean.mediaTrackEnabled,true);assert.equal(clean.mediaTrackReadyState,'live');
assert.equal(JSON.stringify(clean).includes('secret'),false);
const source={type:'media-source',kind:'video',frames:120,framesPerSecond:60};
const raw={timestamp:3000,framesEncoded:115,framesSent:110,totalEncodeTime:0.8,nackCount:3,pliCount:1,freezeCount:2,totalFreezesDuration:2.2};
const diag=videoDiagnostic(raw,source,{availableOutgoingBitrate:8000000},{trackSid:'TR_source',publicationMuted:false});
assert.equal(diag.statsAt,3000);assert.equal(diag.captureFrames,120);assert.equal(diag.captureFps,60);
assert.equal(diag.framesEncoded,115);assert.equal(diag.totalFreezesDuration,2.2);assert.equal(diag.availableOutgoingBitrate,8000000);
assert.equal(diag.trackSid,'TR_source');assert.equal(diag.framesDecoded,null);
assert.equal(videoDiagnostic(raw,{...source,kind:'audio'}).captureFrames,null);
assert.equal(videoDiagnostic(raw,{...source,type:'inbound-rtp'}).captureFrames,null);
assert.equal(typeof telemetryBody,'function','optional enrichment must respect the telemetry request budget');
const crowded={room:'test',session:'crowded-session',streams:Array.from({length:120},(_,i)=>({id:'video-'+i,participant:'guest-'+i,
 name:'Кастер 🐻',direction:'in',kind:'video',source:'camera',codec:'video/AV1',bitrateKbps:8000,lossPct:0,lostPackets:0,
 jitterMs:5,rttMs:10,fps:60,width:1920,height:1080,bytes:1000,freezes:1,protocol:'udp',candidateType:'srflx',qualityLimitation:null,video:diag})),runtime:{errors:0}};
crowded.streams.unshift({id:'audio',direction:'in',kind:'audio',audio:{concealedPct:0}});
assert.ok(Buffer.byteLength(JSON.stringify(crowded))>100000,'fixture must exercise actual request limit');
const boundedBody=telemetryBody(crowded),bounded=JSON.parse(boundedBody);
assert.ok(Buffer.byteLength(boundedBody)<=100000,'new counters must not cause the whole telemetry POST to be rejected');
assert.equal(bounded.streams.length,crowded.streams.length);assert.deepEqual(bounded.streams[0],crowded.streams[0]);
assert.deepEqual(bounded.runtime,crowded.runtime);assert.equal(bounded.videoDiagnosticsLimited,true);
assert.ok(bounded.streams.some(s=>s.video),'retain as much detailed diagnostics as fits');
assert.equal(crowded.streams.filter(s=>s.video).length,120,'serialization must not mutate collected stats');
assert.deepEqual(JSON.parse(telemetryBody({streams:[{kind:'video',video:diag}]})),{streams:[{kind:'video',video:diag}]});

const originals={fetch:global.fetch,setTimeout:global.setTimeout,clearTimeout:global.clearTimeout};
const samples=[],timers=[];let reads=0;
const {startRoomTelemetry}=load('../lib/rtc-telemetry.ts');
const report=(direction)=>new Map([
 ['rtp',{...raw,id:direction,type:direction==='out'?'outbound-rtp':'inbound-rtp',bytesSent:1000,bytesReceived:1000,
  packetsSent:10,packetsReceived:10,packetsLost:0,mediaSourceId:'capture',framesReceived:105,framesDecoded:100,framesDropped:5,totalDecodeTime:0.2}],
 ['capture',source],
]);
const publication=(sid,direction)=>({kind:'video',source:'camera',trackSid:sid,isMuted:false,track:{isMuted:false,
 mediaStreamTrack:{enabled:true,muted:false,readyState:'live'},getRTCStatsReport:async()=>{reads++;return report(direction);}}});
const local=publication('TR_local','out'),remote=publication('TR_remote','in');
const room=Object.assign(new EventEmitter(),{state:'connected',localParticipant:{identity:'guest-local',name:'Local',isLocal:true,
 trackPublications:new Map([['local',local]])},remoteParticipants:new Map([['studio',{identity:'studio-panel-main',name:'Studio',isLocal:false,trackPublications:new Map([['remote',remote]])}]])});
const settle=async()=>{for(let i=0;i<40;i++)await Promise.resolve();};
(async()=>{let stop;try{
 global.fetch=async(_url,options)=>{samples.push(JSON.parse(options.body));return{ok:true};};
 global.setTimeout=(callback,ms)=>{const t={callback,ms};timers.push(t);return t;};global.clearTimeout=t=>{const i=timers.indexOf(t);if(i>=0)timers.splice(i,1);};
 stop=startRoomTelemetry(room,'one','malformed');await settle();
 assert.equal(samples.length,1);assert.equal(reads,2,'one existing RTC report read per publication');
 const out=samples[0].streams.find(s=>s.direction==='out'),incoming=samples[0].streams.find(s=>s.direction==='in');
 assert.equal(out.video.framesEncoded,115);assert.equal(out.video.captureFrames,120);assert.equal(out.video.trackSid,'TR_local');
 assert.equal(incoming.video.framesDecoded,100);assert.equal(incoming.video.totalDecodeTime,0.2);
 assert.equal(incoming.video.captureFrames,null,'receiver must not claim local capture data');
 assert.equal(incoming.video.mediaTrackReadyState,'live');assert.equal(timers.length,1);
 local.trackSid='TR_replacement';await timers.pop().callback();
 assert.equal(samples.at(-1).streams.find(s=>s.direction==='out').video.trackSid,'TR_replacement','publication changes remain distinguishable');
 stop();stop=undefined;assert.equal(samples.at(-1).state,'disconnected');
 console.log('PASS video counters/nulls, allowlisted diagnostics, linked capture and actual outbound/inbound collection without extra RTC reads');
}finally{stop?.();Object.assign(global,originals);}})().catch(error=>{console.error(error);process.exitCode=1;});
