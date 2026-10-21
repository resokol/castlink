const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { load } = require('./load-typescript.cjs');
const cap = 128 * 1024;
const helper = load('../lib/presentation-upload.ts', {
  './presentation-upload-limits': { MAX_PRESENTATION_UPLOAD: cap, PRESENTATION_UPLOAD_TIMEOUT: 60_000 },
});
const form = (bytes, extra='') => Buffer.concat([Buffer.from('--fixture\r\nContent-Disposition: form-data; name="file"; filename="slides.pptx"\r\nContent-Type: application/octet-stream\r\n\r\n'), bytes, Buffer.from('\r\n--fixture--\r\n'+extra)]);
function request(raw, chunkSize=1, headers={}, abort) {
  let offset=0, cancelled=false;
  const body = new ReadableStream({
    pull(c) { if(offset===raw.length)return c.close(); c.enqueue(raw.subarray(offset, offset+=Math.min(chunkSize,raw.length-offset))); },
    cancel(){cancelled=true},
  });
  return {request:new Request('http://localhost',{method:'POST',body,duplex:'half',signal:abort?.signal,headers:{'content-type':'multipart/form-data; boundary=fixture',...headers}}),cancelled:()=>cancelled};
}
(async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-upload-test-'));
 try {
  const bytes=Buffer.alloc(cap,65); bytes.set(Buffer.from('\r\n--fixtureX'),23);
  for(const split of [1,2,13,65536]) {
   const r=request(form(bytes),split);
   const result=await helper.savePresentationUpload(r.request,dir);
   assert.equal(result.size,cap,'inclusive file cap independent of multipart framing');
   assert.deepEqual(await fs.readFile(result.path),bytes,'false boundary prefixes preserved');
   await fs.unlink(result.path);
  }
  for(const raw of [form(Buffer.alloc(cap+1)),form(Buffer.from('a'),'garbage'),form(Buffer.from('a')).subarray(0,-4),Buffer.from('bad')]) {
   await assert.rejects(helper.savePresentationUpload(request(raw,65536).request,dir), e=>e.status===(raw.length>cap?413:400));
   assert.deepEqual(await fs.readdir(dir),[],'partial owned input removed');
  }
  const encoded=form(Buffer.from('a'));
  await assert.rejects(helper.savePresentationUpload(request(encoded,3,{'content-length':String(encoded.length+1)}).request,dir),e=>e.status===400);
  const abort=new AbortController();
  let cancel=false;
  const stalled=new Request('http://localhost',{method:'POST',duplex:'half',signal:abort.signal,headers:{'content-type':'multipart/form-data; boundary=fixture'},body:new ReadableStream({cancel(){cancel=true}})});
  const pending=helper.savePresentationUpload(stalled,dir); setTimeout(()=>abort.abort(),15);
  await assert.rejects(pending,e=>e.code==='presentation-upload-cancelled');
  assert.equal(cancel,true); assert.deepEqual(await fs.readdir(dir),[]);
  const realTimer=global.setTimeout;
  global.setTimeout=(fn,ms,...args)=>realTimer(fn,ms===60_000?10:ms,...args);
  try {
   let timedCancel=false;
   const timed=new Request('http://localhost',{method:'POST',duplex:'half',headers:{'content-type':'multipart/form-data; boundary=fixture'},body:new ReadableStream({cancel(){timedCancel=true}})});
   await assert.rejects(helper.savePresentationUpload(timed,dir),e=>e.code==='presentation-upload-timeout');
   assert.equal(timedCancel,true);assert.deepEqual(await fs.readdir(dir),[]);
  }finally{global.setTimeout=realTimer}

  const fullDisk=load('../lib/presentation-upload.ts',{'node:fs/promises':{...fs,open:async()=>{throw Object.assign(Error('quota'),{code:'EDQUOT'})}}});
  const refused=request(form(Buffer.from('x')),1);
  await assert.rejects(fullDisk.savePresentationUpload(refused.request,dir),e=>e.status===507&&e.code==='presentation-storage-limit');
  assert.equal(refused.cancelled(),true);
  assert.equal(load('../lib/presentation-upload-limits.ts').MAX_PRESENTATION_UPLOAD,1_500_000_000);
  console.log('PASS streaming multipart inclusive cap, every boundary split, framing, length mismatch, abort, owned cleanup');
 }finally{await fs.rm(dir,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});
