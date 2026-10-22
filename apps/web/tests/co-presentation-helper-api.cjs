'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
const load=(file,imports,extra={})=>{const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve(file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:n=>{assert.ok(n in imports,n);return imports[n]},process:{env:{LIVEKIT_API_KEY:'key',LIVEKIT_API_SECRET:'secret'}},Date,Map,Set,Buffer,URL,Response,...extra});return module.exports};
(async()=>{
 assert.ok(fs.existsSync(require('node:path').join(__dirname,'../app/api/co-presentation-helper/route.ts')),'paired helper route exists');
 let association='a',sid='SID',admitted=true;
 const access=load('../lib/co-presentation-access.ts',{'livekit-server-sdk':{TokenVerifier:class{async verify(t){if(t!=='owner')throw Error();return{sub:'guest-owner',video:{room:'studio/room',canPublish:true},metadata:JSON.stringify({role:'guest',studioId:'studio',roomDisplayName:'room',roomChatAssociation:'a',transferSessionId:'t'})}}},RoomServiceClient:class{async getParticipant(){return{identity:'guest-owner',sid,metadata:JSON.stringify({role:'guest',studioId:'studio',roomChatAssociation:association,transferSessionId:'t'})}}}},'./access':{sameOrigin:r=>!r.headers.get('origin')||new URL(r.headers.get('origin')).host==='test.example'},'./room-store':{readRooms:async()=>[{name:'room',creatorAccessId:association}]},'./guest-admission-store':{managedGuestIdentity:async()=>({state:admitted?'admitted':'closed',expiresAt:Date.now()+1e8})},'./studio-scope':{validateStudioId:s=>s,mediaRoomName:(s,r)=>s+'/'+r}});
 const broker=load('../lib/co-presentation-helper.ts',{'node:crypto':crypto});
 class NextResponse extends Response{static json(b,i){return new Response(JSON.stringify(b),i)}}
 const api=load('../app/api/co-presentation-helper/route.ts',{'next/server':{NextResponse},'@/lib/access':{sameOrigin:r=>!r.headers.get('origin')||new URL(r.headers.get('origin')).host==='test.example'},'@/lib/co-presentation-access':access,'@/lib/co-presentation-helper':broker,'@/lib/studio-scope':{validateStudioId:s=>s},'@/lib/rate-limit':{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})}});
 const post=(data,token='owner',origin='https://test.example')=>api.POST({url:'https://test.example/api/co-presentation-helper',headers:new Headers({authorization:'Bearer '+token,...(origin?{origin}:{}),host:'test.example'}),text:async()=>JSON.stringify(data)});
 const owner=data=>post({studioId:'studio',room:'room',...data});
 assert.equal((await post({action:'pair',studioId:'studio',room:'room'},'owner','')).status,403);
 assert.equal((await post({action:'pair',studioId:'studio',room:'room'},'owner','https://evil.example')).status,403);
 assert.equal((await post({action:'pair',studioId:'studio',room:'room'},'forged')).status,401);
 assert.equal((await post({action:'pair',code:'cp2_'+'a'.repeat(43)},'','http://test.example')).status,403,'native Origin must match trusted HTTPS origin exactly');
 const pairing=await (await owner({action:'pair'})).json();assert.ok(pairing.code);
 let response=await post({action:'pair',code:pairing.code},'','');assert.equal(response.status,200,await response.clone().text());
 const native=await response.json();
 assert.equal((await post({action:'poll',connectionId:native.connectionId},native.token,'https://evil.example')).status,403);
 assert.equal((await post({action:'poll',connectionId:native.connectionId},native.token,'')).status,200);
 assert.equal((await post({action:'request',connectionId:native.connectionId,method:'prepare',args:{}},native.token,'')).status,400);
 assert.equal((await owner({action:'request',clientRequestId:crypto.randomUUID(),method:'prepare',args:{url:'https://private.example'}})).status,400);
 assert.equal((await owner({action:'request',clientRequestId:crypto.randomUUID(),method:'prepare',args:{},extra:'x'.repeat(4096)})).status,413);
 admitted=false;assert.equal((await post({action:'poll',connectionId:native.connectionId},native.token,'')).status,401);admitted=true;
 assert.equal((await owner({action:'state'})).status,200);
 console.log('PASS helper route real admission/JWT fixture, explicit owner Origin, scoped native bearer, payload bounds, no arbitrary args');
})().catch(e=>{console.error(e);process.exitCode=1});
