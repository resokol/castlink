const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {peakDbfs,meterRelease,observePcmTrack}=require('../lib/audio-meter.ts');
const {startSpeakerTest}=require('../lib/audio-device-test.ts');
let amplitude=.1,frames=new Map(),frameId=0,contexts=[],audioElements=[],listeners=new Map(),sinkPending,sinkError,playError,waitForSamples=false;
const node=()=>({connections:[],disconnects:0,connect(target){this.connections.push(target);},disconnect(){this.disconnects++;}});
class MockContext{
 constructor(){this.state='running';this.currentTime=10;this.closed=0;this.destination=node();contexts.push(this);}
 createAnalyser(){const value={...node(),smoothingTimeConstant:.8,getFloatTimeDomainData(samples){samples.fill(amplitude);}};this.analyser=value;return value;}
 createMediaStreamSource(stream){this.source={...node(),stream};return this.source;}
 createGain(){const value={...node(),gain:{value:1,setValueAtTime(){},linearRampToValueAtTime(){}}};this.gain=value;return value;}
 createMediaStreamDestination(){const track={stops:0,stop(){this.stops++;}};this.streamDestination={...node(),stream:{track,getTracks:()=>[track]}};return this.streamDestination;}
 createOscillator(){const value={...node(),frequency:{value:0},starts:0,stopAt:null,start(at){this.starts++;this.startAt=at;audioElements.at(-1).receivedSamples?.();},stop(at){this.stopAt=at;}};this.oscillator=value;return value;}
 resume(){this.state='running';this.resumes=(this.resumes||0)+1;return Promise.resolve();}
 close(){this.closed++;this.state='closed';return Promise.resolve();}
}
class MockAudio{
 constructor(){this.pauses=0;this.playCalls=0;audioElements.push(this);}
 async setSinkId(id){this.sinkId=id;if(sinkError)throw sinkError;if(sinkPending)await sinkPending;}
 async play(){this.playCalls++;if(playError)throw playError;if(waitForSamples)await new Promise(resolve=>this.receivedSamples=resolve);}
 pause(){this.pauses++;}
}
global.AudioContext=MockContext;global.Audio=MockAudio;
global.MediaStream=class{constructor(tracks){this.tracks=tracks;}};
global.document={addEventListener(type,callback){listeners.set(type,callback);},removeEventListener(type,callback){if(listeners.get(type)===callback)listeners.delete(type);}};
global.requestAnimationFrame=callback=>{const id=++frameId;frames.set(id,callback);return id;};
global.cancelAnimationFrame=id=>frames.delete(id);
const tick=at=>{const [id,callback]=frames.entries().next().value;frames.delete(id);callback(at);};
const settle=()=>new Promise(resolve=>setImmediate(resolve));
(async()=>{
 assert.equal(peakDbfs([0,0]),-90);assert.equal(meterRelease(-10,-90,33),-90,'zero PCM clears in one update, without a several-second decay');
 assert.ok(Math.abs(peakDbfs([.0001]) + 80)<1e-7,'quiet nonzero samples retain their true measured amplitude');
 assert.equal(meterRelease(-80,-20,33),-20,'attack is immediate');assert.equal(meterRelease(-20,-80,100),-29);
 const levels=[],track={readyState:'live',muted:false,stops:0,stop(){this.stops++;}};
 const stop=observePcmTrack(track,value=>levels.push(value));const pcm=contexts.at(-1);
 assert.equal(pcm.analyser.smoothingTimeConstant,0);assert.equal(pcm.analyser.fftSize,2048);assert.equal(pcm.gain.gain.value,0,'measurement is connected to a silent sink, never acoustic monitoring');
 tick(33);assert.equal(levels.at(-1),-20);amplitude=0;tick(66);assert.equal(levels.at(-1),-90,'actual PCM silence clears at next 33ms tick');
 amplitude=.0001;tick(99);assert.equal(levels.at(-1),-80,'quiet speech is not gated');
 track.muted=true;tick(132);assert.equal(levels.at(-1),-90);track.muted=false;amplitude=.2;tick(165);assert.equal(levels.at(-1),-14);
 track.readyState='ended';tick(198);assert.equal(levels.at(-1),-90);stop();stop();assert.equal(frames.size,0);assert.equal(listeners.size,0);assert.equal(pcm.closed,1);assert.equal(track.stops,0,'observer never stops a remote track owned by LiveKit');
 assert.equal(pcm.source.disconnects,1);assert.equal(pcm.analyser.disconnects,1);assert.equal(pcm.gain.disconnects,1);
 let test=startSpeakerTest('chosen-speakers');await settle();let ctx=contexts.at(-1),element=audioElements.at(-1);
 assert.equal(element.sinkId,'chosen-speakers');assert.equal(element.playCalls,1);assert.equal(ctx.oscillator.starts,1);assert.equal(ctx.oscillator.frequency.value,440);assert.ok(Math.abs(ctx.oscillator.stopAt-ctx.oscillator.startAt-.7)<1e-8);
 assert.ok(ctx.gain.connections.includes(ctx.streamDestination));assert.equal(ctx.gain.connections.includes(ctx.destination),false,'selected output receives tone; context default destination remains disconnected');
 ctx.oscillator.onended();await test.finished;assert.equal(ctx.closed,1);assert.equal(element.srcObject,null);assert.equal(element.pauses,1);assert.equal(ctx.streamDestination.stream.track.stops,1);
 waitForSamples=true;test=startSpeakerTest('sample-driven-output');await settle();ctx=contexts.at(-1);
 try { assert.equal(ctx.oscillator?.starts,1,'a MediaStream play promise waiting for samples cannot block starting its routed source');ctx.oscillator.onended();await test.finished; }
 finally { test.stop();waitForSamples=false; }
 let release;sinkPending=new Promise(resolve=>release=resolve);test=startSpeakerTest('pending-output');ctx=contexts.at(-1);element=audioElements.at(-1);test.stop();await test.finished;release();await settle();sinkPending=undefined;
 assert.equal(ctx.closed,1);assert.equal(element.playCalls,0);assert.equal(ctx.oscillator,undefined,'cancel during sink selection cannot start a later tone');
 sinkError=new Error('selected output unavailable');test=startSpeakerTest('missing-output');await assert.rejects(test.finished,/selected output unavailable/);ctx=contexts.at(-1);assert.equal(ctx.closed,1);assert.equal(ctx.streamDestination.stream.track.stops,1);sinkError=undefined;
 playError=new Error('autoplay denied');test=startSpeakerTest('chosen-speakers');await assert.rejects(test.finished,/autoplay denied/);ctx=contexts.at(-1);assert.equal(ctx.closed,1);assert.equal(ctx.oscillator.disconnects,1,'failed playback releases the source created to provide MediaStream samples');playError=undefined;
 const withSink=MockAudio.prototype.setSinkId;delete MockAudio.prototype.setSinkId;
 test=startSpeakerTest('explicit-output');await assert.rejects(test.finished,/не поддерживает/);assert.equal(contexts.at(-1).closed,1,'unsupported selected output fails instead of silently playing through another device');
 test=startSpeakerTest('default');await settle();ctx=contexts.at(-1);assert.equal(ctx.oscillator.starts,1,'default output works without setSinkId');test.stop();await test.finished;assert.equal(ctx.closed,1);MockAudio.prototype.setSinkId=withSink;
 console.log('PASS: PCM silence clears in one tick, quiet signals/attack/time release, mute/end behavior, frame/listener/context disposal without remote track stop, chosen speaker sink/tone duration, no default-output leakage, cancel during sink setup, routing/autoplay errors and unsupported output cleanup');
})().catch(error=>{console.error(error);process.exitCode=1;});
