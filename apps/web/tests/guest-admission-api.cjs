const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');const{NextRequest}=require('next/server'),{load}=require('./load-typescript.cjs');
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-entry-compat-'));Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'admission-api-secret',CASTLINK_HOSTED_ACCESS:'0'});try{
 await fs.mkdir(path.join(root,'runtime'),{recursive:true});await fs.writeFile(path.join(root,'runtime/studiolink-rooms.json'),JSON.stringify({schemaVersion:1,rooms:[{name:'A',slotAssociationId:'room-a'}]}));
 const api=load('../app/api/guest-admission/route.ts'),slots=load('../app/api/caster-slots/route.ts');
 const post=data=>new NextRequest('https://local.example/api/guest-admission',{method:'POST',headers:{host:'local.example',origin:'https://local.example','content-type':'application/json'},body:JSON.stringify(data)});
 const response=await api.POST(post({action:'start',studioId:'studio-default',room:'A',clientId:'one',name:'Alice'}));assert.equal(response.status,200);const data=await response.json();assert.equal(data.state,'admitted','old open client progresses immediately without moderator');assert.ok(data.capability);
 const read=()=>api.GET(new NextRequest('https://local.example/api/guest-admission?room=A',{headers:{'x-castlink-guest-admission':data.capability}}));
 assert.equal((await(await read()).json()).state,'admitted','slot is optional');
 const confirm=post({action:'confirm',room:'A'});confirm.headers.set('x-castlink-guest-admission',data.capability);assert.deepEqual(await(await api.POST(confirm)).json(),{ready:false});
 assert.equal((await api.GET(new NextRequest('https://local.example/api/guest-admission?room=A'))).status,403);
 assert.equal((await slots.GET(new NextRequest('https://local.example/api/caster-slots?room=A'))).status,403);
 const leave=post({action:'leave',room:'A'});leave.headers.set('x-castlink-guest-admission',data.capability);assert.equal((await api.POST(leave)).status,200);assert.equal((await read()).status,403);
 const admissions=load('../lib/guest-admission-store.ts'),version=load('../lib/slot-room-scope.ts').slotRoomVersion({name:'A'});
 const old=await admissions.startGuestAdmission({studioId:'studio-default',roomAssociation:'room-a'},{clientId:'old',name:'Old tab',roomVersion:version});
 const upgraded=await api.GET(new NextRequest('https://local.example/api/guest-admission?room=A',{headers:{'x-castlink-guest-admission':old.capability}}));assert.equal((await upgraded.json()).state,'admitted','already open waiting page automatically progresses');
 console.log('PASS old-client compatibility: immediate entry, optional slot, explicit leave, scoped capability');
}finally{await fs.rm(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
