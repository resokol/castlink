const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto'),path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const transpile=file=>ts.transpileModule(fs.readFileSync(path.resolve(root,file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
let now=Date.now(),records=[{name:'room',creatorAccessId:'room-uuid',studioPasswordHash:'owner-hash',passwordHash:'guest-hash'}],origin=true,online=true;
const overrides={};
const participants={ 'guest-owner':{sid:'PA-owner',metadata:JSON.stringify({role:'guest',studioId:'tenant'})},'guest-controller':{sid:'PA-controller',metadata:JSON.stringify({role:'guest',studioId:'tenant'})},'guest-other':{sid:'PA-other',metadata:JSON.stringify({role:'guest',studioId:'tenant'})}};
class NextResponse extends Response{static json(body,init){return new Response(JSON.stringify(body),init)}}
class TokenVerifier{async verify(token){if(!participants[token])throw Error('bad token');return overrides[token]||{sub:token,video:{room:'tenant/room'},metadata:participants[token].metadata}}}
class RoomServiceClient{async getParticipant(room,identity){assert.equal(room,'tenant/room');if(!online||!participants[identity])throw Error('gone');return participants[identity]}}
const modules={};function load(file,imports={}){const m={exports:{}};vm.runInNewContext(transpile(file),{module:m,exports:m.exports,require:name=>{if(name in imports)return imports[name];if(name==='node:crypto')return crypto;throw Error('Unexpected import '+name)},Date:{now:()=>now},Map,Symbol,globalThis:{},Buffer,Number,Response,TextEncoder,process:{env:{}}});return m.exports}
// The public route must not load credentials, live media or the retained
// implementation at all. Old tabs/helpers receive Gone before reading input.
const disabled={exports:{}};
vm.runInNewContext(transpile('apps/web/app/api/presentation-control/route.ts'),{module:disabled,exports:disabled.exports,require:name=>{assert.equal(name,'next/server','disabled route imported active presentation dependencies');return{NextResponse};}});
const protocol=load('apps/web/lib/presentation-control.ts');
const store=load('apps/web/lib/presentation-control-state.ts',{'./presentation-control':protocol});
const imports={'next/server':{NextResponse},'livekit-server-sdk':{TokenVerifier,RoomServiceClient},'@/lib/access':{sameOrigin:()=>origin},'@/lib/room-store':{readRooms:async()=>records},'@/lib/studio-scope':{defaultStudioId:()=> 'tenant',validateStudioId:s=>s,mediaRoomName:(s,r)=>s+'/'+r},'@/lib/rate-limit':{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})},'@/lib/presentation-control-state':store,'@/lib/presentation-control':protocol};
const api=load('apps/web/lib/optional/presentation-control-handler.ts',imports);
const post=(action,extra={},token='guest-owner')=>api.POST({headers:new Headers({authorization:'Bearer '+token}),text:async()=>JSON.stringify({action,studioId:'tenant',room:'room',...extra})});
const json=async response=>{assert.equal(response.status,200,await response.clone().text());return response.json()};
(async()=>{
 for(const action of ['pair','connect','poll','read','delegate','command','revoke']){
  const request={get headers(){throw Error('disabled route read headers for '+action)},text(){throw Error('disabled route read body for '+action)}};
  const response=await disabled.exports.POST(request);assert.equal(response.status,410,action);assert.equal(response.headers.get('cache-control'),'no-store');
  assert.deepEqual(await response.json(),{error:'Presentation control is temporarily disabled',disabled:true});
 }
 assert.equal((await post('pair',{},'forged')).status,401);origin=false;assert.equal((await post('pair',{kind:'pdf'})).status,403);origin=true;
 assert.equal((await post('pair',{kind:'shell'})).status,400);
 overrides['guest-other']={sub:'guest-other',video:{room:'tenant/room'},metadata:JSON.stringify({role:'studio',studioId:'tenant'})};
 assert.equal((await post('pair',{kind:'pdf'},'guest-other')).status,403,'a signed token with another role cannot pair');
 overrides['guest-other']={sub:'guest-other',video:{room:'other-tenant/room'},metadata:JSON.stringify({role:'guest',studioId:'other-tenant'})};
 assert.equal((await post('pair',{kind:'pdf'},'guest-other')).status,403,'a signed token from another tenant cannot pair');delete overrides['guest-other'];

 const pair=await json(await post('pair',{kind:'pdf'}));assert.ok(pair.pairToken);const connectionId=crypto.randomUUID();
 assert.equal((await post('connect',{connectionId},pair.pairToken+'bad')).status,401);
 const linked=await json(await post('connect',{connectionId},pair.pairToken));assert.ok(linked.sessionToken);assert.notEqual(linked.sessionToken,pair.pairToken);
 assert.equal((await post('connect',{connectionId},pair.pairToken)).status,401,'pairing is single use');
 const id=pair.sessionId,status={title:'Local.pdf',page:1,pages:5,ready:true};
 await json(await post('poll',{connectionId,status},linked.sessionToken));
 let state=await json(await post('read',{},'guest-other'));assert.equal(state.sessions.length,1);assert.equal(state.sessions[0].status.title,'Local.pdf');assert.equal(JSON.stringify(state).includes(linked.sessionToken),false);
 assert.equal((await post('command',{sessionId:id,direction:'next'},'guest-other')).status,403);
 assert.equal((await post('delegate',{sessionId:id,controllerIdentity:'guest-controller'},'guest-other')).status,403);
 await json(await post('delegate',{sessionId:id,controllerIdentity:'guest-controller'}));
 assert.equal((await post('command',{sessionId:id,direction:'exec'},'guest-controller')).status,400);
 assert.equal((await post('command',{sessionId:id,direction:'next',room:'other'},'guest-controller')).status,403);
 const requested=await json(await post('command',{sessionId:id,direction:'next'},'guest-controller'));
 assert.equal((await post('command',{sessionId:id,direction:'next'},'guest-controller')).status,409,'one command at a time');
 let poll=await json(await post('poll',{connectionId,status},linked.sessionToken));assert.equal(poll.command.id,requested.command.id);
 assert.equal(protocol.acceptPresentationCommand(poll.command,connectionId,0,now).direction,'next');assert.equal(protocol.acceptPresentationCommand(poll.command,connectionId,poll.command.seq,now),undefined);
 assert.equal((await json(await post('poll',{connectionId,status},linked.sessionToken))).command,undefined,'lost response never replays');
 assert.equal((await post('poll',{connectionId,result:{seq:999,ok:true}},linked.sessionToken)).status,409);
 await json(await post('poll',{connectionId,status:{...status,page:2},result:{seq:poll.command.seq,ok:true}},linked.sessionToken));
 state=await json(await post('read'));assert.equal(state.sessions[0].status.page,2);assert.equal(state.sessions[0].result.ok,true);
 assert.equal((await post('poll',{connectionId:crypto.randomUUID()},linked.sessionToken)).status,409,'another connection cannot inherit commands');
 await json(await post('command',{sessionId:id,direction:'previous'}));now+=5000;
 poll=await json(await post('poll',{connectionId,status},linked.sessionToken));assert.equal(poll.command,undefined,'reconnect gap drops pending navigation');
 await json(await post('command',{sessionId:id,direction:'next'}));now+=3001;
 poll=await json(await post('poll',{connectionId,status},linked.sessionToken));assert.equal(poll.command,undefined,'expired navigation is never delivered');
 participants['guest-controller'].sid='PA-rejoined';assert.equal((await post('command',{sessionId:id,direction:'next'},'guest-controller')).status,403,'delegation does not migrate to another media session');
 await json(await post('delegate',{sessionId:id,controllerIdentity:'guest-owner'}));assert.equal((await post('command',{sessionId:id,direction:'next'},'guest-controller')).status,403);
 records=[{...records[0],creatorAccessId:'replacement-room'}];assert.equal((await post('poll',{connectionId,status},linked.sessionToken)).status,401,'recreated room cannot inherit pairing');
 records=[{...records[0],creatorAccessId:'room-uuid'}];const pair2=await json(await post('pair',{kind:'powerpoint'}));now+=120001;assert.equal((await post('connect',{connectionId},pair2.pairToken)).status,401,'pair token expires');
 const pair3=await json(await post('pair',{kind:'pdf'}));const linked3=await json(await post('connect',{connectionId},pair3.pairToken));await json(await post('revoke',{sessionId:pair3.sessionId}));assert.equal((await post('poll',{connectionId},linked3.sessionToken)).status,401,'owner revoke stops helper');
 const rotated=await json(await post('pair',{kind:'pdf'}));const rotatedLink=await json(await post('connect',{connectionId},rotated.pairToken));
 records=[{...records[0],passwordHash:'changed-guest-password'}];assert.equal((await post('poll',{connectionId},rotatedLink.sessionToken)).status,401,'credential rotation invalidates helper');
 const timed=await json(await post('pair',{kind:'pdf'}));const timedLink=await json(await post('connect',{connectionId},timed.pairToken));now+=30*60000+1;assert.equal((await post('poll',{connectionId},timedLink.sessionToken)).status,401,'helper token expires after thirty minutes');
 const pair4=await json(await post('pair',{kind:'pdf'}));const linked4=await json(await post('connect',{connectionId},pair4.pairToken));participants['guest-owner'].sid='PA-owner-new';assert.equal((await post('poll',{connectionId},linked4.sessionToken)).status,401,'owner reconnect needs explicit new pairing');
 console.log('PASS: public presentation API disabled with 410 before input/state access; retained offline pairing/scope/expiry/replay security regressions');
})().catch(error=>{console.error(error);process.exitCode=1});
