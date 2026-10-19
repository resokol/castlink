'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const {analyzePcm}=require('./windows-process-audio-smoke.cjs');
function tone(frequencies){const b=Buffer.alloc(48000*8);for(let i=0;i<48000;i++){const x=frequencies.reduce((v,f)=>v+.1*Math.sin(2*Math.PI*f*i/48000),0);b.writeFloatLE(x,i*8);b.writeFloatLE(x,i*8+4);}return b;}
test('spectral acceptance accepts selected audio and rejects competing process audio',()=>{
  const isolated=analyzePcm(tone([440]));assert.equal(isolated.pass,true);assert.ok(isolated.amplitudes['440']>.09);assert.ok(isolated.amplitudes['880']<1e-6);
  for(const frequency of [880,1320]){const leaked=analyzePcm(tone([440,frequency]));assert.equal(leaked.pass,false);assert.ok(leaked.amplitudes[String(frequency)]>.09);}
  assert.equal(analyzePcm(tone([880])).pass,false,'missing selected source is never accepted as isolation');
  assert.equal(analyzePcm(Buffer.alloc(48000*8)).pass,false,'silence does not prove exclusion');
});
test('analysis refuses short, unaligned or invalid float PCM',()=>{
  for(const data of [Buffer.alloc(7),Buffer.alloc(800)])assert.throws(()=>analyzePcm(data),/PCM/);
  const invalid=tone([440]);invalid.writeFloatLE(NaN,0);assert.throws(()=>analyzePcm(invalid),/PCM/);
});
