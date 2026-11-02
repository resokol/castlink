'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {createProcessAudioAdapter}=require('../src/process-audio.cjs');
function fixture(t,options={}){
  const resourcesPath=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-mac-audio-'));
  t.after(()=>fs.rmSync(resourcesPath,{recursive:true,force:true}));
  const helper=path.join(resourcesPath,'process-audio','CastLink.ProcessAudio');
  fs.mkdirSync(path.dirname(helper),{recursive:true});fs.writeFileSync(helper,'transport fixture',{mode:0o755});
  const calls=[],children=[];
  const spawn=(...args)=>{calls.push(args);const child=new EventEmitter();child.stdin=new PassThrough();child.stdout=new PassThrough();child.stderr=new PassThrough();child.signals=[];child.kill=signal=>{child.killed=true;child.signals.push(signal);return true;};children.push(child);return child;};
  return {resourcesPath,helper,calls,children,spawn,adapter:createProcessAudioAdapter({resourcesPath,platform:'darwin',spawn,...options})};
}
function header(pid=44){const b=Buffer.alloc(24);b.write('CLPA0001');b.writeUInt32LE(48000,8);b.writeUInt16LE(2,12);b.writeUInt16LE(32,14);b.writeUInt32LE(pid,16);return b;}
function packet(samples=[.25,-.25]){const b=Buffer.alloc(4+samples.length*4);b.writeUInt32LE(samples.length/2);samples.forEach((sample,index)=>b.writeFloatLE(sample,index*4+4));return b;}
const identity={windowId:'123',pid:44,processStartTime:1710000000123};
test('darwin dispatch requires opt-in and a strict CGWindowID without a system audio fallback',t=>{
  const f=fixture(t);
  for(const sourceId of ['screen:1:0','window:0:0','window:001:0','window:4294967296:0','window:12:-1','window:12:0;evil'])assert.throws(()=>f.adapter.start({sourceId,enabled:true}),/source/i);
  assert.throws(()=>f.adapter.start({sourceId:'window:123:0',enabled:false}),/explicit/);
  assert.equal(f.calls.length,0);
  const c=f.adapter.start({sourceId:'window:123:82',enabled:true});c.ready.catch(()=>{});
  assert.equal(f.calls[0][0],f.helper);assert.deepEqual(f.calls[0][1],['--window','123']);assert.equal(f.calls[0][2].shell,false);c.stop();
});
test('trusted source identity is validated and forwarded as data, never retargeted',t=>{
  const f=fixture(t);
  for(const sourceIdentity of [{...identity,windowId:'124'},{...identity,pid:0},{...identity,processStartTime:NaN},{...identity,processStartTime:'x'},{...identity,pid:'44'}])assert.throws(()=>f.adapter.start({sourceId:'window:123:0',sourceIdentity,enabled:true}),/identity/i);
  assert.equal(f.calls.length,0);
  const c=f.adapter.start({sourceId:'window:123:0',sourceIdentity:identity,enabled:true});c.ready.catch(()=>{});
  assert.deepEqual(f.calls[0][1],['--window','123','--pid','44','--started','1710000000123']);c.stop();
});
test('transport parser accepts fragmented CLPA0001 and delivers exact stereo float packets',async t=>{
  const f=fixture(t),frames=[];
  const c=f.adapter.start({sourceId:'window:123:0',sourceIdentity:identity,enabled:true,onFrame:frame=>frames.push(frame)});
  const bytes=Buffer.concat([header(),packet([.25,-.25,.5,-.5])]);
  for(let i=0;i<bytes.length;i+=3)f.children[0].stdout.write(bytes.subarray(i,i+3));
  assert.deepEqual(await c.ready,{sampleRate:48000,channels:2,pid:44});assert.equal(frames.length,1);assert.equal(frames[0].frames,2);assert.equal(frames[0].pcm.readFloatLE(4),-.25);
  c.stop();f.children[0].stdout.write(packet());assert.equal(frames.length,1);
});
test('a changed PID in the native response refuses the pinned source before audio delivery',async t=>{
  const f=fixture(t),frames=[],errors=[],ended=[];
  const c=f.adapter.start({sourceId:'window:123:0',sourceIdentity:identity,enabled:true,onFrame:x=>frames.push(x),onError:e=>errors.push(e),onEnded:()=>ended.push(true)});
  f.children[0].stdout.write(Buffer.concat([header(45),packet()]));
  await assert.rejects(c.ready,/source/i);assert.equal(frames.length,0);assert.equal(errors.length,1);assert.equal(ended.length,1);assert.equal(f.children[0].killed,true);
});
test('malformed headers, packets, nonfinite PCM and oversized input fail closed',async t=>{
  const f=fixture(t);const badRate=header();badRate.writeUInt32LE(44100,8);const invalidLength=Buffer.alloc(4);invalidLength.writeUInt32LE(4801);
  for(const bytes of [badRate,Buffer.concat([header(),invalidLength]),Buffer.concat([header(),Buffer.alloc(4)]),Buffer.concat([header(),packet([NaN,0])]),Buffer.concat([header(),packet([Infinity,0])]),Buffer.alloc(131073)]){
    const errors=[],frames=[];const c=f.adapter.start({sourceId:'window:123:0',enabled:true,onError:e=>errors.push(e),onFrame:x=>frames.push(x)});c.ready.catch(()=>{});
    f.children.at(-1).stdout.write(bytes);await Promise.resolve();
    assert.equal(errors.length,1);assert.equal(frames.length,0);assert.equal(f.children.at(-1).killed,true);c.stop();
  }
});
test('stdout EOF ends immediately and truncated native data reports a sanitized failure',async t=>{
  const f=fixture(t);
  for(const bytes of [Buffer.alloc(0),header().subarray(0,12),Buffer.concat([header(),packet().subarray(0,5)]),header()]){
    const errors=[],ended=[];const c=f.adapter.start({sourceId:'window:123:0',enabled:true,onError:e=>errors.push(e),onEnded:()=>ended.push(true)});c.ready.catch(()=>{});
    const child=f.children.at(-1);child.stdout.end(bytes);await new Promise(resolve=>setImmediate(resolve));
    assert.equal(ended.length,1);assert.equal(errors.length,bytes.length===24?0:1);assert.equal(child.killed,true);child.emit('exit',4);assert.equal(ended.length,1);
  }
});
test('native disconnect and error cannot leak diagnostics or deliver late frames',async t=>{
  const f=fixture(t),errors=[],frames=[],ended=[];
  const c=f.adapter.start({sourceId:'window:123:0',enabled:true,onFrame:x=>frames.push(x),onError:e=>errors.push(e),onEnded:()=>ended.push(true)});const child=f.children[0];
  child.stdout.write(header());await c.ready;child.stderr.write('/Users/private/secret.pptx');child.emit('exit',4);child.emit('error',Error('private-path'));child.stdout.write(packet());
  assert.equal(errors.length,1);assert.equal(errors[0].message,'PowerPoint process audio stopped');assert.equal(ended.length,1);assert.equal(frames.length,0);
});
test('startup timeout and independent stop terminate once and escalate an unresponsive child',async t=>{
  const f=fixture(t,{startupTimeoutMs:10,terminationTimeoutMs:10});const keepAlive=setTimeout(()=>{},100);
  try{
    const c=f.adapter.start({sourceId:'window:123:0',enabled:true});await assert.rejects(c.ready,/could not start/);
    await new Promise(resolve=>setTimeout(resolve,20));assert.deepEqual(f.children[0].signals,['SIGTERM','SIGKILL']);
    const ended=[];const d=f.adapter.start({sourceId:'window:123:0',enabled:true,onEnded:()=>ended.push(true)});d.ready.catch(()=>{});d.stop();d.stop();assert.equal(ended.length,1);
  }finally{clearTimeout(keepAlive);}
});
test('a failing frame consumer ends capture and callback exceptions cannot prevent cleanup',async t=>{
  const f=fixture(t);const c=f.adapter.start({sourceId:'window:123:0',enabled:true,onFrame:()=>{throw Error('private');},onError:()=>{throw Error('private');},onEnded:()=>{throw Error('private');}});
  f.children[0].stdout.write(header());await c.ready;assert.doesNotThrow(()=>f.children[0].stdout.write(packet()));assert.equal(f.children[0].killed,true);
});
test('missing helper and symbolic helper never start a fallback',t=>{
  const f=fixture(t);fs.unlinkSync(f.helper);assert.throws(()=>f.adapter.start({sourceId:'window:123:0',enabled:true}),/unavailable/);
  fs.writeFileSync(path.join(f.resourcesPath,'other'),'fixture');fs.symlinkSync('../other',f.helper);assert.throws(()=>f.adapter.start({sourceId:'window:123:0',enabled:true}),/unavailable/);assert.equal(f.calls.length,0);
});
test('native availability verifies bounded versioned protocol output rather than just file existence',async t=>{
  const {probeMacProcessAudio}=require('../src/macos-process-audio.cjs');const f=fixture(t);
  const good=probeMacProcessAudio({resourcesPath:f.resourcesPath,platform:'darwin',spawn:f.spawn});assert.deepEqual(f.calls.at(-1)[1],['--self-test']);
  f.children.at(-1).stdout.end(JSON.stringify({protocol:'CLPA0001',sampleRate:48000,channels:2,maxPacketFrames:4800}));f.children.at(-1).emit('exit',0);assert.equal(await good,true);
  const bad=probeMacProcessAudio({resourcesPath:f.resourcesPath,platform:'darwin',spawn:f.spawn});f.children.at(-1).stdout.end(JSON.stringify({protocol:'other'}));f.children.at(-1).emit('exit',0);assert.equal(await bad,false);
  const oversized=probeMacProcessAudio({resourcesPath:f.resourcesPath,platform:'darwin',spawn:f.spawn});f.children.at(-1).stdout.write(Buffer.alloc(4097));assert.equal(await oversized,false);
  assert.equal(await probeMacProcessAudio({resourcesPath:f.resourcesPath,platform:'linux',spawn:f.spawn}),false);
});

test('owned QA startup failure preserves bounded stderr, exit code and signal after stream closure',async()=>{
  const {toneReady}=require('../../../native/macos-process-audio/smoke.cjs');
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();
  const ready=toneReady(child,{frequency:440,timeoutMs:100});
  child.stderr.write('qa-stage:window\n');child.emit('exit',4,null);child.stderr.write('qa-refused:launch-identity\n');child.emit('close',4,null);
  await assert.rejects(ready,error=>{assert.equal(error.diagnostics.exitCode,4);assert.equal(error.diagnostics.signal,null);assert.equal(error.diagnostics.frequency,440);assert.match(error.diagnostics.stderr,/qa-refused:launch-identity/);return true;});
  const crashed=new EventEmitter();crashed.stdout=new PassThrough();crashed.stderr=new PassThrough();const failure=toneReady(crashed,{frequency:880,timeoutMs:100});
  crashed.stderr.write('qa-stage:output\n'+'x'.repeat(10000));crashed.emit('exit',null,'SIGABRT');crashed.emit('close',null,'SIGABRT');
  await assert.rejects(failure,error=>{assert.equal(error.diagnostics.signal,'SIGABRT');assert.equal(error.diagnostics.exitCode,null);assert.ok(Buffer.byteLength(error.diagnostics.stderr)<=8192);assert.equal(error.diagnostics.stderrTruncated,true);return true;});
});
test('owned QA only classifies explicit no-output evidence as unavailable',async()=>{
  const {toneReady,NotVerified}=require('../../../native/macos-process-audio/smoke.cjs');
  for(const [stderr,unavailable]of [['qa-no-output\n',true],['qa-error:decode:3\n',false]]){
    const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();const ready=toneReady(child,{timeoutMs:100});child.stderr.write(stderr);child.emit('close',3,null);
    await assert.rejects(ready,error=>{assert.equal(error instanceof NotVerified,unavailable);return true;});
  }
  const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();const ready=toneReady(child,{timeoutMs:10});
  await assert.rejects(ready,error=>{assert.equal(error instanceof NotVerified,false);assert.equal(error.diagnostics.timedOut,true);return true;});
});

test('native smoke preserves measured spectral failure evidence without changing acceptance',()=>{
  const {assessNativeCapture}=require('../../../native/macos-process-audio/smoke.cjs');
  function pcm(frequencies){const data=Buffer.alloc(48000*8);for(let frame=0;frame<48000;frame++){const value=frequencies.reduce((sum,hz)=>sum+.05*Math.sin(2*Math.PI*hz*frame/48000),0);data.writeFloatLE(value,frame*8);data.writeFloatLE(value,frame*8+4);}return data;}
  assert.equal(assessNativeCapture(pcm([440])).pass,true);
  for(const data of [pcm([440,880]),pcm([440,1320]),Buffer.alloc(48000*8)])assert.throws(()=>assessNativeCapture(data),error=>{
    assert.equal(error.message,'Real ScreenCaptureKit spectral isolation failed');assert.equal(error.diagnostics.stage,'spectral-isolation');assert.equal(error.diagnostics.analysis.pass,false);
    assert.equal(error.diagnostics.pcm.totalFrames,48000);assert.equal(error.diagnostics.pcm.peak.length,2);assert.equal(error.diagnostics.pcm.rms.length,2);
    assert.deepEqual(Object.keys(error.diagnostics.analysis.amplitudes),['440','880','1320']);assert.ok(JSON.stringify(error.diagnostics).length<8192);return true;
  });
});
test('tone readiness refuses the wrong rendered marker instead of assuming argv selected it',async()=>{
  const {toneReady}=require('../../../native/macos-process-audio/smoke.cjs');const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();const ready=toneReady(child,{frequency:440,timeoutMs:100});
  child.stdout.write(JSON.stringify({ready:true,windowId:'123',pid:44,processStartTime:1710000000123,frequency:880})+'\n');
  await assert.rejects(ready,/Invalid QA readiness/);
});
