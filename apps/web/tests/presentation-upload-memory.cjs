// Retained heap must stay bounded even when an uploader yields individual bytes.
if (typeof global.gc !== 'function') {
  const result = require('node:child_process').spawnSync(process.execPath, ['--expose-gc', __filename], {stdio:'inherit'});
  process.exit(result.status ?? 1);
}
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {load}=require('./load-typescript.cjs');
const client=load('../lib/presentation-upload.ts',{'./presentation-upload-limits':{MAX_PRESENTATION_UPLOAD:200000,PRESENTATION_UPLOAD_TIMEOUT:600000}});
(async()=>{
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-tiny-chunks-'));
 let cursor=0,first,last;
 const data=Buffer.concat([Buffer.from('--x\r\nContent-Disposition: form-data; name="file"; filename="slides.pptx"\r\n\r\n'),Buffer.alloc(125000),Buffer.from('\r\n--x--\r\n')]);
 const body=new ReadableStream({pull(c){
  if(cursor===15000){global.gc();first=process.memoryUsage().heapUsed}
  if(cursor===115000){global.gc();last=process.memoryUsage().heapUsed}
  if(cursor===data.length)return c.close();
  c.enqueue(data.subarray(cursor,cursor+1));cursor++;
 }});
 try{
  const result=await client.savePresentationUpload(new Request('http://localhost',{method:'POST',body,duplex:'half',headers:{'content-type':'multipart/form-data; boundary=x'}}),directory);
  assert.equal(result.size,125000);const retainedGrowth=last-first;console.log(JSON.stringify({tinyChunks:125000,retainedHeapGrowthBytes:retainedGrowth}));
  assert.ok(retainedGrowth<8*1024*1024,'waiting deadline must not retain one promise reaction per completed body chunk');
 }finally{await fs.rm(directory,{recursive:true,force:true})}
})().catch(e=>{console.error(e);process.exitCode=1});