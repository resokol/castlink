const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript'),Module=require('node:module');const {randomUUID}=require('node:crypto');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'media-studio-'));process.env.STUDIOLINK_DATA_DIR=root;process.env.NODE_ENV='development';const store=require('../lib/room-store.ts'),studio=require('../lib/studio-control.ts');const {diagnosticAssociation,deleteDiagnosticRoom,DiagnosticRoomConflict}=require('../lib/media-room-association.ts');
const load=Module._load,actor=r=>r.cookies.get('actor')?.value;
Module._load=function(id,parent,main){if(id==='@/lib/room-store')return store;if(id==='@/lib/studio-control')return studio;if(id==='@/lib/access')return{sameOrigin:r=>r.headers.get('origin')===r.nextUrl.origin};if(id==='@/lib/room-admin')return{isRoomAdmin:async r=>actor(r)==='admin'};if(id==='@/lib/moderator-access')return{isModerator:async r=>actor(r)==='moderator'};if(id.endsWith('/studio-owner-access'))return{isStudioOwner:async r=>actor(r)==='owner'};if(id.endsWith('/rate-limit'))return{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})};return load.call(this,id,parent,main);};
const {NextRequest}=require('next/server'),route=require('../app/api/studio-control/route.ts'),clientId='operator-client-1234';
const request=(room,action,extra={},role='owner')=>new NextRequest('https://fixture.invalid/api/studio-control',{method:'POST',headers:{origin:'https://fixture.invalid',cookie:'actor='+role},body:JSON.stringify({room,action,clientId,...extra})});
async function create(name){const room={name,diagnosticCreationId:randomUUID(),diagnosticRevision:randomUUID()};await store.updateRooms(rooms=>[...rooms,room]);return diagnosticAssociation(room);}
(async()=>{try{
let cases=0;
for(const action of ['join','claim','command','release']){const name='diag-'+action,receipt=await create(name);let epoch=1;if(action==='command'||action==='release')epoch=(await studio.joinStudio(name,clientId)).state.epoch;const response=await route.POST(request(name,action,{epoch,patch:{gain:110}}));assert.equal(response.status,200,action);await assert.rejects(store.updateRooms(rooms=>deleteDiagnosticRoom(rooms,name,receipt)),DiagnosticRoomConflict,action+' must dirty cleanup');assert.ok((await store.readRooms()).some(r=>r.name===name));if(action==='join')assert.equal((await studio.readStudioState(name)).primaryClientId,clientId,'refused cleanup must preserve primary lease');cases++;}
const readonly='diag-readonly',clean=await create(readonly);assert.equal((await route.POST(request(readonly,'join',{},'admin'))).status,200);assert.deepEqual(diagnosticAssociation((await store.readRooms()).find(r=>r.name===readonly)),clean);assert.equal((await route.POST(request(readonly,'join',{},'guest'))).status,401);assert.deepEqual(diagnosticAssociation((await store.readRooms()).find(r=>r.name===readonly)),clean);assert.equal((await route.GET(new NextRequest(`https://fixture.invalid/api/studio-control?room=${readonly}&clientId=${clientId}`,{headers:{cookie:'actor=owner'}}))).status,200);assert.deepEqual(diagnosticAssociation((await store.readRooms()).find(r=>r.name===readonly)),clean);cases++;
for(const outcome of ['deleted','replaced']){const name='race-'+outcome;await create(name);const original=store.invalidateDiagnosticReceipts;store.invalidateDiagnosticReceipts=async(...args)=>{await store.updateRooms(rooms=>outcome==='deleted'?rooms.filter(r=>r.name!==name):rooms.map(r=>r.name===name?{name,diagnosticCreationId:randomUUID(),diagnosticRevision:randomUUID()}:r));return original(...args);};try{assert.equal((await route.POST(request(name,'join'))).status,409);assert.equal((await studio.readStudioState(name)).primaryClientId,null,'association race must block activation');}finally{store.invalidateDiagnosticReceipts=original;}cases++;}
// Capability stays visible for an owner while the primary lease is active;
// room staff never receive a takeover capability, even after release.
const capabilityRoom = 'claim-capability'; await create(capabilityRoom);
const first = await (await route.POST(request(capabilityRoom, 'join'))).json();
assert.equal(first.canClaim, true);
const secondClient = 'second-operator-1234';
const getState = role => route.GET(new NextRequest(`https://fixture.invalid/api/studio-control?room=${capabilityRoom}&clientId=${secondClient}`, {headers:{cookie:'actor='+role}}));
let available = await (await getState('owner')).json();
assert.equal(available.canClaim, true); assert.equal(available.primaryOnline, true);
assert.equal((await route.POST(request(capabilityRoom, 'claim', {clientId: secondClient}))).status, 409);
for (const role of ['admin', 'moderator']) {
  assert.equal((await (await getState(role)).json()).canClaim, false);
  assert.equal((await route.POST(request(capabilityRoom, 'claim', {clientId: secondClient}, role))).status, 403);
}
assert.equal((await route.POST(request(capabilityRoom, 'release', {epoch:first.epoch}))).status, 200);
available = await (await getState('owner')).json();
assert.equal(available.canClaim, true); assert.equal(available.primaryOnline, false);
assert.equal((await route.POST(request(capabilityRoom, 'claim', {clientId: secondClient}))).status, 200);
assert.equal((await route.POST(request(capabilityRoom, 'heartbeat', {epoch:first.epoch}))).status, 409);
cases++;
console.log(`PASS: ${cases} actual studio-state cases; primary writes dirty receipts, readonly/denied access unchanged, deleted/replaced room activation refused`);
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(error=>{console.error(error);process.exitCode=1;});
