const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),path=require('node:path'),os=require('node:os');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-output-api-'));process.env.STUDIOLINK_STUDIO_CONTROL_FILE=path.join(dir,'state.json');
const control=require('../lib/studio-control.ts');let actor='admin';
class NextResponse extends Response {static json(body,init){return new Response(JSON.stringify(body),init);}}
const imports={
 '../../../lib/reserve-source':{sourceSessionMoved:async()=>false},'../../../lib/media-room-association':{DiagnosticRoomConflict:class extends Error{}},'next/server':{NextResponse},
 '@/lib/access':{sameOrigin:()=>true},'@/lib/room-admin':{isRoomAdmin:async()=>actor==='admin'},'@/lib/moderator-access':{isModerator:async()=>actor==='moderator'},
 '@/lib/room-store':{readRooms:async()=>[{name:'test'}],invalidateDiagnosticReceipts:async()=>{}},'@/lib/studio-control':control,
 '../../../lib/studio-scope':{defaultStudioId:()=> 'studio-default',validateStudioId:v=>v,mediaRoomName:(_,v)=>v},
 '../../../lib/rate-limit':{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})},'../../../lib/room-studio-access':{canHostNamedRoom:async()=>actor==='owner'}
};const mod={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.resolve(__dirname,'../app/api/studio-control/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:mod,exports:mod.exports,require:n=>{assert.ok(imports[n],n);return imports[n];},Response,Date,console});
(async()=>{try{const {state}=await control.joinStudio('test','primary-client-123');const post=patch=>mod.exports.POST({headers:new Headers(),text:async()=>JSON.stringify({action:'command',studioId:'studio-default',room:'test',clientId:'admin-client-123',epoch:state.epoch,patch})});
 assert.equal((await post({videoSource:'black',outputMuted:true})).status,200);
 let next=await control.readStudioState('test');assert.equal(next.desired.outputMuted,true);assert.equal(next.desired.videoSource,'black');assert.equal(next.primaryClientId,'primary-client-123');
 actor='moderator';assert.equal((await post({outputMuted:false})).status,403);
 actor='guest';assert.equal((await post({outputMuted:false})).status,401);
 actor='admin';assert.equal((await post({videoSource:'invalid'})).status,400);
 console.log('PASS studio output API admin authorization, restricted denial, primary lease retained');
}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
