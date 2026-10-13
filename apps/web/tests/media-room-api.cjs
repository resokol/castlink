const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript'),Module=require('node:module');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'media-api-'));process.env.STUDIOLINK_DATA_DIR=root;process.env.NODE_ENV='development';process.env.CASTLINK_SESSION_SECRET='local-fixture-only-secret';
const access=require('../lib/access.ts');const store=require('../lib/room-store.ts');const load=Module._load;let lifetime,signings=0;
const actor=r=>r.cookies.get('actor')?.value;
Module._load=function(id,parent,main){
 if(id==='@/lib/room-store')return store;
 if(id==='@/lib/access')return{sameOrigin:r=>r.headers.get('origin')===r.nextUrl.origin,hashPassword:x=>x,encryptRoomPassword:x=>x,signAccess:(claims,ttl)=>{lifetime=ttl;signings++;return access.signAccess(claims,ttl);}};
 if(id==='@/lib/room-admin')return{isRoomAdmin:async r=>actor(r)==='admin'};
 if(id==='@/lib/moderator-access')return{isModerator:async r=>actor(r)==='moderator',verifiedRoomModeratorSession:async()=>null};
 if(id==='@/lib/studio-control')return{readStudioState:async()=>({})};
 if(id.endsWith('/studio-owner-access'))return{isStudioOwner:async r=>actor(r)==='owner'};
 if(id.endsWith('/rate-limit'))return{consumeRateLimit:()=>({ok:true}),rateLimitHeaders:()=>({})};
 return load.call(this,id,parent,main);
};
const {NextRequest}=require('next/server');const route=require('../app/api/rooms/route.ts');const invites=require('../app/api/invites/route.ts');
const req=(actor,body)=>new NextRequest('https://fixture.invalid/api/rooms',{method:'POST',headers:{origin:'https://fixture.invalid',cookie:`actor=${actor}`},body:JSON.stringify(body)});
(async()=>{try{
for(const actor of ['admin','moderator','guest'])assert.equal((await route.POST(req(actor,{action:'create',name:'blocked',diagnostic:true}))).status,403);
const created=await route.POST(req('owner',{action:'create',name:'owned',diagnostic:true}));assert.equal(created.status,200);const receipt=await created.json();assert.equal(receipt.contract,'castlink-media-room-v2');const createdRecord=(await store.readRooms()).find(x=>x.name==='owned');
assert.equal((await invites.POST(req('owner',{action:'create',room:'owned',diagnostic:true,expectedDiagnosticAssociation:receipt.association}))).status,200);assert.equal(lifetime,600);
const granted=await invites.POST(req('owner',{action:'create',room:'owned',diagnostic:true,expectedDiagnosticAssociation:receipt.association}));const invite=decodeURIComponent((await granted.json()).path.split('#invite=')[1]);const claims=access.readAccess(invite);assert.ok(claims.exp-Date.now()<=600000);assert.ok(access.validGuestInvite(invite,'owned',createdRecord.guestInviteVersion,'studio-default'));const realNow=Date.now;Date.now=()=>realNow()+601000;try{assert.equal(access.validGuestInvite(invite,'owned',createdRecord.guestInviteVersion,'studio-default'),false);}finally{Date.now=realNow;}
assert.equal((await invites.POST(req('moderator',{action:'create',room:'owned',diagnostic:true,expectedDiagnosticAssociation:receipt.association}))).status,403);
const originalUpdate=store.updateRooms;let raced=false;store.updateRooms=async(change,studioId)=>{if(!raced){raced=true;await originalUpdate(rooms=>rooms.map(r=>r.name==='owned'?{...r,guestInviteVersion:require('node:crypto').randomUUID(),viewerAccessVersion:require('node:crypto').randomUUID(),outputAccessVersion:require('node:crypto').randomUUID()}:r),studioId);}return originalUpdate(change,studioId);};const beforeSignings=signings;try{assert.equal((await invites.POST(req('owner',{action:'create',room:'owned',diagnostic:true,expectedDiagnosticAssociation:receipt.association}))).status,409);assert.equal(signings,beforeSignings,'replacement race must not issue an invite');}finally{store.updateRooms=originalUpdate;}
assert.equal((await invites.POST(req('moderator',{action:'create',room:'owned'}))).status,200);assert.equal(lifetime,30*86400);
assert.equal((await route.POST(req('owner',{action:'delete',name:'owned',expectedDiagnosticAssociation:receipt.association}))).status,409);
const legacy=await route.POST(req('owner',{action:'create',name:'ordinary'}));assert.equal(legacy.status,200);assert.equal((await legacy.json()).association,undefined);
await route.POST(req('owner',{action:'password',name:'owned',password:'changed'}));
assert.equal((await route.POST(req('owner',{action:'delete',name:'owned',expectedDiagnosticAssociation:receipt.association}))).status,409);
assert.equal((await invites.POST(req('owner',{action:'create',room:'owned',diagnostic:true,expectedDiagnosticAssociation:receipt.association}))).status,409);
assert.ok((await store.readRooms()).some(x=>x.name==='owned'));
assert.equal((await route.POST(req('admin',{action:'delete',name:'owned',expectedDiagnosticAssociation:receipt.association}))).status,403);
assert.equal((await route.POST(req('owner',{action:'delete',name:'owned'}))).status,200);
for(const action of ['mode','rename']){const name='diagnostic-'+action;const made=await route.POST(req('owner',{action:'create',name,diagnostic:true}));const ack=await made.json();if(action==='mode')assert.equal((await route.POST(req('owner',{action:'mode',name,studioOnly:true}))).status,200);else{assert.equal((await route.POST(req('owner',{action:'rename',name,newName:name+'-away'}))).status,200);assert.equal((await route.POST(req('owner',{action:'rename',name:name+'-away',newName:name}))).status,200);}assert.equal((await route.POST(req('owner',{action:'delete',name,expectedDiagnosticAssociation:ack.association}))).status,409);assert.ok((await store.readRooms()).some(r=>r.name===name));}
assert.equal((await route.GET(new NextRequest('https://fixture.invalid/api/rooms?diagnostic=true',{headers:{cookie:'actor=guest'}}))).status,401);
assert.equal((await route.GET(new NextRequest('https://fixture.invalid/api/rooms?diagnostic=true',{headers:{cookie:'actor=owner'}}))).status,200);
console.log('PASS: owner-only diagnostic contract, association drift refusal, ordinary responses and legacy deletion preserved');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
