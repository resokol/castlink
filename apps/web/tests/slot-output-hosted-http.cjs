// Manual post-build proof: run next build first, then node tests/slot-output-hosted-http.cjs.
const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {spawn}=require('node:child_process'),net=require('node:net');
const {load}=require('./load-typescript.cjs');
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-slot-hosted-http-'));
 let child,spawnError,running=false,ended=Promise.resolve();
 for(const name of Object.keys(process.env)){
  if(/^(STUDIOLINK_|CASTLINK_|LIVEKIT_|NEXT_PUBLIC_|PG)|^(DATABASE_URL|NODE_ENV)$/.test(name))delete process.env[name];
 }
 Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'isolated-output-http-test-secret',LIVEKIT_API_KEY:'key',LIVEKIT_API_SECRET:'isolated-http-test-secret-at-least-32-characters',CASTLINK_HOSTED_ACCESS:'1'});
 try{
  const app=path.resolve(__dirname,'..');
  for(const dir of [app,path.resolve(app,'../..')]){
   for(const name of ['.env','.env.local','.env.production','.env.production.local']){
    let exists=false;try{await fs.access(path.join(dir,name));exists=true;}catch(error){if(error.code!=='ENOENT')throw error;}
    assert.equal(exists,false,'manual smoke requires checkout without application env files');
   }
  }
  await fs.mkdir(path.join(root,'runtime'),{recursive:true});
  await fs.writeFile(path.join(root,'runtime/studiolink-rooms.json'),JSON.stringify({schemaVersion:1,rooms:[{name:'A',slotAssociationId:'room-a'}]}));
  const slots=load('../lib/caster-slot-store.ts'),access=load('../lib/caster-slot-access.ts');
  const scope={studioId:'studio-default',roomAssociation:'room-a'},slot=await slots.createCasterSlot(scope,{name:'HTTP fixture'});
  const camera=await access.createSlotOutputAccess(scope,slot.id,'camera'),screen=await access.createSlotOutputAccess(scope,slot.id,'screen');
  const server=net.createServer();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const port=server.address().port;await new Promise(resolve=>server.close(resolve));
  child=spawn(process.execPath,[require.resolve('next/dist/bin/next'),'start','--hostname','127.0.0.1','--port',String(port)],{cwd:app,env:process.env,stdio:'ignore'});
  running=true;
  ended=new Promise(resolve=>child.once('close',()=>{running=false;resolve();}));
  child.once('error',error=>{spawnError=error;});
  const endpoint=source=>'http://127.0.0.1:'+port+'/api/caster-slot-output?slot='+slot.id+'&source='+source;
  const request=(source,key)=>fetch(endpoint(source),{signal:AbortSignal.timeout(5000),headers:key?{'x-castlink-slot-access':key}:{}});
  let ready=false;
  for(let i=0;i<60;i++){
   if(spawnError)throw spawnError;
   if(!running||child.exitCode!==null)throw new Error('Isolated Next server exited '+child.exitCode);
   try{const r=await request('camera');if(r.status===403){ready=true;break;}}catch{}
   await pause(150);
  }
  assert.ok(ready,'isolated production Next server ready');
  for(const [source,key] of [['camera',camera],['screen',screen]]){
   const response=await request(source,key);assert.equal(response.status,200,source+' capability without hosted cookies');
   const data=await response.json();assert.equal(data.snapshot.source,source);assert.equal(data.snapshot.phase,'empty');
   const claims=JSON.parse(Buffer.from(data.token.split('.')[1],'base64url'));
   assert.equal(claims.video.room,'A');assert.equal(claims.video.canPublish,false);assert.equal(claims.video.canPublishData,false);
  }
  assert.equal((await request('camera')).status,403);
  assert.equal((await request('camera','forged')).status,403);
  assert.equal((await request('screen',camera)).status,403);
  assert.equal((await request('camera',screen)).status,403);
  await slots.rotateCasterSlotOutput(scope,slot.id,slot.revision,'camera');
  assert.equal((await request('camera',camera)).status,403);
  assert.equal((await request('screen',screen)).status,200);
  console.log('PASS production HTTP: hosted without cookies, camera/screen readonly tokens, missing/forged/cross-source denied, camera rotation preserves screen');
 }finally{
  if(child&&running){
   if(child.pid)child.kill();
   let timer;try{await Promise.race([ended,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Isolated server did not close')),5000);})]);}finally{clearTimeout(timer);}
  }
  await fs.rm(root,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
