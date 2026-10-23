const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const {createHelperPowerPointBridge}=load('../lib/co-presentation-helper-client.ts');
(async()=>{
 const previous=global.fetch,calls=[];let error,release;
 global.fetch=async(_url,options)=>{const body=JSON.parse(options.body);calls.push(body);if(body.action==='state')return Response.json({connected:true,ready:true,browserControl:true,pairingId:'10000000-0000-4000-8000-000000000001'});if(body.action==='pair')return new Promise(resolve=>release=()=>resolve(Response.json({code:'cp2_'+'a'.repeat(43),expiresAt:Date.now()+120000,pairingId:'10000000-0000-4000-8000-000000000002'})));if(body.action==='request')return Response.json({operationId:'operation'});if(body.action==='result')return Response.json({done:true,result:error?{error}:{id:'native',name:'Effects.pptx',pages:3,page:1}});return Response.json({connected:false})};
 try {
  let bridge=createHelperPowerPointBridge({token:'presenter',studioId:'qa',room:'qa'});assert.deepEqual(await bridge.connection(),{connected:true,ready:true,browserControl:true});await bridge.connectBrowser();
  const command=calls.find(call=>call.action==='request');assert.equal(command.method,'connectBrowser');assert.deepEqual(command.args,{});
  for(const code of ['POWERPOINT_DECLINED','POWERPOINT_COM_UNAVAILABLE','PRIVATE_PATH_TOKEN']){error=code;await assert.rejects(bridge.connectBrowser(),cause=>cause.code===(code==='PRIVATE_PATH_TOKEN'?'POWERPOINT_UNAVAILABLE':code));}
  bridge.dispose();await new Promise(resolve=>setImmediate(resolve));
  const start=calls.length;bridge=createHelperPowerPointBridge({token:'presenter',studioId:'qa',room:'qa'});const pairing=bridge.pair();bridge.dispose();release();await pairing;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(calls.slice(start).filter(call=>call.action==='disconnect'&&call.pairingId==='10000000-0000-4000-8000-000000000002').length,1,'late pair response after capture cancellation revokes only its exact pairing');
 } finally {global.fetch=previous;}
 console.log('PASS browser helper fixed connectBrowser RPC, approved capability, finite error codes and late-pair cleanup');
})().catch(error=>{console.error(error);process.exitCode=1});
