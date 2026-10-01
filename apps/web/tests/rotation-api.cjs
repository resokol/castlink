const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
let role='guest',origin=true,updates=[],metadata={accessRole:'guest',keep:'unchanged'};
class NextResponse extends Response { static json(body,init){return new Response(JSON.stringify(body),init);} }
class RoomServiceClient {async getParticipant(){return {metadata:JSON.stringify(metadata),tracks:[]}} async updateParticipant(room,identity,data){updates.push({room,identity,data});metadata=JSON.parse(data.metadata);}}
const moduleValue={exports:{}};
const imports={'../../../lib/rate-limit':require('./helpers/rate-limit.cjs'),'next/server':{NextResponse},'livekit-server-sdk':{RoomServiceClient},'@/lib/access':{isStudio:()=>role==='owner',sameOrigin:()=>origin},'@/lib/room-admin':{isRoomAdmin:async(_,room)=>role==='admin'&&room==='one'},'@/lib/moderator-access':{isModerator:async(_,room)=>role==='moderator'&&room==='one'},'@/lib/room-store':{readRooms:async()=>[{name:'one'},{name:'two'}]},
'../../../lib/studio-scope':{defaultStudioId:()=> 'studio-default',validateStudioId:v=>v||'studio-default',mediaRoomName:(_s,r)=>r},
'../../../lib/studio-owner-access':{isStudioOwner:async()=>role==='owner'}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/api/participants/route.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:moduleValue,exports:moduleValue.exports,require:n=>imports[n],process:{env:{}},Response,TextEncoder});
const post=(identity='guest-one',room='one')=>moduleValue.exports.POST({headers:new Headers(),json:async()=>({action:'rotate',room,identity})});
(async()=>{assert.equal((await post()).status,401);assert.equal(updates.length,0);role='moderator';assert.equal((await post('studio-panel-main')).status,403);assert.equal((await post('studio-moderator-one')).status,403);assert.equal((await post('guest-two','two')).status,401);
for(const angle of [90,180,270,0]) {assert.equal((await post()).status,200);assert.equal(metadata.videoRotation,angle);assert.equal(metadata.accessRole,'guest');assert.equal(metadata.keep,'unchanged');}
role='admin';assert.equal((await post('studio-moderator-one')).status,200);origin=false;assert.equal((await post()).status,403);
console.log('PASS: rotation authorization, room scope, primary protection, metadata preservation, four quarter turns');})().catch(e=>{console.error(e);process.exitCode=1});
