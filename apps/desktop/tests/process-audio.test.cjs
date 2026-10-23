'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path');
const {EventEmitter}=require('node:events');
const {PassThrough}=require('node:stream');
const {createProcessAudioAdapter}=require('../src/process-audio.cjs');
function fixture(t,options={}){
  const resourcesPath=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-process-audio-'));t.after(()=>fs.rmSync(resourcesPath,{recursive:true,force:true}));
  const helper=path.join(resourcesPath,'process-audio','CastLink.ProcessAudio.exe');fs.mkdirSync(path.dirname(helper),{recursive:true});fs.writeFileSync(helper,'fixture');
  const children=[],calls=[];const adapter=createProcessAudioAdapter({resourcesPath,platform:'win32',spawn:(...args)=>{
    calls.push(args);const child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();child.stdin=new PassThrough();child.kill=()=>{child.killed=true;};children.push(child);return child;
  },...options});
  return {adapter,children,calls,helper};
}
function header(pid=44){const b=Buffer.alloc(24);b.write('CLPA0001');b.writeUInt32LE(48000,8);b.writeUInt16LE(2,12);b.writeUInt16LE(32,14);b.writeUInt32LE(pid,16);return b;}
function packet(samples){const b=Buffer.alloc(4+samples.length*4);b.writeUInt32LE(samples.length/2);samples.forEach((s,i)=>b.writeFloatLE(s,4+i*4));return b;}
test('only an explicit external window audio selection launches the fixed helper',t=>{
  const f=fixture(t);
  for(const sourceId of ['screen:1:0','window:0:0','window:001:0','window:123:-1','window:-1:0','window:9223372036854775808:0','window:12:0 -Command evil'])assert.throws(()=>f.adapter.start({sourceId,enabled:true}),/source/);
  assert.throws(()=>f.adapter.start({sourceId:'window:123:0',enabled:false}),/explicit/);
  assert.equal(f.calls.length,0);
  const c=f.adapter.start({sourceId:'window:123:0',enabled:true});c.ready.catch(()=>{});
  assert.equal(f.calls[0][0],f.helper);assert.deepEqual(f.calls[0][1],['--window','123']);
  assert.equal(f.calls[0][2].shell,false);assert.equal(f.calls[0][2].windowsHide,true);
  c.stop();assert.equal(f.children[0].killed,true);
});
test('fragmented native header and PCM packets produce bounded stereo float frames',async t=>{
  const f=fixture(t),frames=[];const c=f.adapter.start({sourceId:'window:123:0',enabled:true,onFrame:x=>frames.push(x)});
  const bytes=Buffer.concat([header(),packet([.25,-.25,.5,-.5])]);
  for(let i=0;i<bytes.length;i+=3)f.children[0].stdout.write(bytes.subarray(i,i+3));
  assert.deepEqual(await c.ready,{sampleRate:48000,channels:2,pid:44});assert.equal(frames.length,1);assert.equal(frames[0].frames,2);assert.equal(frames[0].pcm.readFloatLE(4),-.25);
  c.stop();f.children[0].stdout.write(packet([1,1]));assert.equal(frames.length,1,'stopped capture cannot deliver late PCM');
});
test('bad format, unbounded packets, oversized chunks and truncated exit fail closed',async t=>{
  const f=fixture(t);
  const badRate=header();badRate.writeUInt32LE(44100,8);
  const huge=Buffer.alloc(4);huge.writeUInt32LE(4801);
  for(const bytes of [badRate,Buffer.concat([header(),huge]),Buffer.alloc(131073)]){
    const errors=[];const c=f.adapter.start({sourceId:'window:123:0',enabled:true,onError:e=>errors.push(e)});const child=f.children.at(-1);child.stdout.write(bytes);
    if(bytes.length===28)await c.ready;else await assert.rejects(c.ready,/process audio/i);
    assert.equal(child.killed,true);assert.equal(errors.length,1);
  }
  const c=f.adapter.start({sourceId:'window:123:0',enabled:true});f.children.at(-1).stdout.write(header().subarray(0,4));f.children.at(-1).emit('exit',4);
  await assert.rejects(c.ready,/process audio/i);
});
test('native termination ends once and sanitized status cannot expose arbitrary stderr',async t=>{
  const f=fixture(t),ended=[],errors=[];const c=f.adapter.start({sourceId:'window:123:0',enabled:true,onEnded:()=>ended.push(true),onError:e=>errors.push(e)}),child=f.children[0];
  child.stderr.write('private-path-or-secret');child.stdout.write(header());await c.ready;child.emit('exit',4);child.emit('error',Error('secret'));
  assert.equal(ended.length,1);assert.equal(errors.length,1);assert.equal(errors[0].message,'PowerPoint process audio stopped');
});
test('startup failure and timeout cannot leave a helper or deliver audio',async t=>{
  const f=fixture(t,{startupTimeoutMs:10});
  const failed=f.adapter.start({sourceId:'window:123:0',enabled:true});f.children[0].emit('error',Error('private executable path'));
  await assert.rejects(failed.ready,/could not start/);assert.equal(f.children[0].killed,true);
  const timeout=f.adapter.start({sourceId:'window:123:0',enabled:true});
  const keepAlive=setTimeout(()=>{},50);
  try{await assert.rejects(timeout.ready,/could not start/);assert.equal(f.children[1].killed,true);}finally{clearTimeout(keepAlive);}
});
test('unsupported platform and missing helper never spawn a fallback',t=>{
  const f=fixture(t,{platform:'linux'});assert.throws(()=>f.adapter.start({sourceId:'window:123:0',enabled:true}),/Windows/);assert.equal(f.calls.length,0);
  const missing=fixture(t);fs.unlinkSync(missing.helper);assert.throws(()=>missing.adapter.start({sourceId:'window:123:0',enabled:true}),/unavailable/);assert.equal(missing.calls.length,0);
});

test('actual Aura suffix preserves only strict first HWND for process audio',t=>{const f=fixture(t);const c=f.adapter.start({sourceId:'window:123:82',enabled:true});c.ready.catch(()=>{});assert.deepEqual(f.calls[0][1],['--window','123']);c.stop();});
