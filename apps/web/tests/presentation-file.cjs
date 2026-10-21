const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { load } = require('./load-typescript.cjs');
const { NextRequest } = require('next/server');
const input=Buffer.from('PK\x03\x04ordinary PPTX with SVG/fonts/charts');
const pdf=Buffer.from('%PDF-1.7\nconverted');
const upload=(body=input,name='slides.pptx',signal)=>{const form=new FormData();form.append('file',new Blob([body]),name);return new Request('http://localhost',{method:'POST',body:form,signal})};
let mode='ok',calls=0,captured,port;
const before=()=>fs.readdirSync(os.tmpdir()).filter(x=>x.startsWith('castlink-upload-'));
const initial=before();
const client=load('../lib/presentation-file.ts',{
 'node:http':{...http,request(options,callback){assert.equal(options.socketPath,'/run/castlink-converter/converter.sock');return http.request({...options,socketPath:undefined,host:'127.0.0.1',port},callback)}},
 'node:child_process':{spawn(){throw Error('web must never spawn LibreOffice')}},
});
const server=http.createServer(async(req,res)=>{
 calls++;
 if(mode==='early-busy'){
  res.writeHead(429,{'content-type':'application/json'});
  res.write('{"code":');
  setTimeout(()=>res.end('"presentation-converter-busy"}'),15);
  return;
 }
 const chunks=[];for await(const chunk of req)chunks.push(chunk);captured=Buffer.concat(chunks);
 const status=mode==='busy'?429:mode==='invalid'?422:mode==='storage'?507:200;
 const body=mode==='busy'?Buffer.from('{"code":"presentation-converter-busy"}'):mode==='invalid'?Buffer.from('{"code":"presentation-encrypted"}'):mode==='fake'?Buffer.from('not PDF'):pdf;
 if(mode==='hang')return;
 res.writeHead(status,{'content-type':mode==='html'?'text/html':status===200?'application/pdf':'application/json','content-length':mode==='large'?'1500000001':String(body.length)});
 res.end(body);
});
const consume=async(result)=>Buffer.from(await new Response(result.body).arrayBuffer());
const expectStatus=(operation,status,code)=>assert.rejects(operation,e=>e.status===status&&(!code||e.code===code));
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));port=server.address().port;
 try {
  assert.deepEqual(await consume(await client.convertPresentationFile(upload())),pdf);
  assert.deepEqual(captured,input);
  for(const [failure,status,code] of [['busy',429,'presentation-converter-busy'],['invalid',422,'presentation-encrypted'],['storage',507,'presentation-storage-limit'],['html',502],['fake',502],['large',502]]) {
   mode=failure;await expectStatus(client.convertPresentationFile(upload()),status,code);
  }
  mode='early-busy';await expectStatus(client.convertPresentationFile(upload(Buffer.alloc(8*1024*1024))),429,'presentation-converter-busy');
  mode='ok';
  const beforeCalls=calls;
  await expectStatus(client.convertPresentationFile(upload(input,'slides.pdf')),400);
  await expectStatus(client.convertPresentationFile(new Request('http://localhost',{method:'POST',body:'x',headers:{'content-length':'1500016385'}})),413);
  assert.equal(calls,beforeCalls);
  const held=await client.convertPresentationFile(upload());
  await expectStatus(client.convertPresentationFile(upload()),429);
  await held.body.cancel();
  assert.deepEqual(await consume(await client.convertPresentationFile(upload())),pdf,'cancel frees single job');
  const realTimer=global.setTimeout;
  global.setTimeout=(fn,ms,...args)=>realTimer(fn,ms===20*60_000?30:ms,...args);
  mode='hang';
  try{await expectStatus(client.convertPresentationFile(upload()),504,'presentation-conversion-timeout')}finally{global.setTimeout=realTimer}
  mode='ok';assert.deepEqual(await consume(await client.convertPresentationFile(upload())),pdf);
  const abort=new AbortController();mode='hang';
  const pending=client.convertPresentationFile(upload(input,'slides.pptx',abort.signal));setTimeout(()=>abort.abort(),20);
  await expectStatus(pending,408,'presentation-upload-cancelled');
  assert.deepEqual(before().sort(),initial.sort(),'only owned temporary job directories removed');
  const diskFull=load('../lib/presentation-file.ts',{'node:fs/promises':{...require('node:fs/promises'),mkdtemp:async()=>{throw Object.assign(Error('disk full'),{code:'ENOSPC'})}}});
  await expectStatus(diskFull.convertPresentationFile(upload()),507,'presentation-storage-limit');
  let authorized=false,conversions=0,scope;
  const api=load('../app/api/presentation-file/route.ts',{
   '@/lib/co-presentation-access':{presentationGuest:async(_r,studioId,room)=>{scope={studioId,room};return authorized?{identity:'guest-one',sid:'PA_one'}:null}},
   '@/lib/presentation-file':{PresentationFileError:client.PresentationFileError,convertPresentationFile:async request=>{conversions++;assert.equal(request.bodyUsed,false);return{body:new ReadableStream({start(c){c.enqueue(pdf);c.close()}}),size:pdf.length}}},
  });
  const req=()=>new NextRequest('http://localhost/api/presentation-file?studioId=studio-two&room=Room2',{method:'POST',body:'auth first'});
  const denied=req();assert.equal((await api.POST(denied)).status,403);assert.equal(denied.bodyUsed,false);assert.equal(conversions,0);
  assert.deepEqual(scope,{studioId:'studio-two',room:'Room2'});authorized=true;
  const response=await api.POST(req());assert.equal(response.status,200);assert.equal(response.headers.get('content-type'),'application/pdf');assert.equal(response.headers.get('content-length'),String(pdf.length));assert.equal(response.headers.get('cache-control'),'no-store');assert.equal(response.headers.get('x-content-type-options'),'nosniff');assert.deepEqual(Buffer.from(await response.arrayBuffer()),pdf);
  console.log('PASS actual streamed HTTP worker bytes/output, service errors, PDF validation, timeout, cancel, single job/cleanup, route auth-before-body');
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
