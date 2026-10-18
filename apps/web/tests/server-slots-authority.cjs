const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const{NextRequest,NextResponse}=require('next/server'),{load}=require('./load-typescript.cjs');
(async()=>{const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-room-staff-'));Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'room-authority-test',CASTLINK_HOSTED_ACCESS:'0'});delete process.env.STUDIOLINK_STUDIO_PASSWORD_HASH;try{
 const rooms=[{name:'A',creatorAccessId:'creator-a',studioPasswordHash:'room-password-a',adminAccessVersion:'admin-a'},{name:'B',creatorAccessId:'creator-b',studioPasswordHash:'room-password-b',adminAccessVersion:'admin-b'}];
 await fs.mkdir(path.join(root,'runtime'),{recursive:true});await fs.writeFile(path.join(root,'runtime/studiolink-rooms.json'),JSON.stringify({schemaVersion:1,rooms}));
 const creator=load('../lib/room-studio-access.ts'),admin=load('../lib/room-admin.ts'),moderator=load('../lib/moderator-access.ts'),slots=load('../app/api/caster-slots/route.ts'),adminApi=load('../app/api/admin-access/route.ts'),modApi=load('../app/api/moderator-access/route.ts');
 const req=(url,cookie='',body)=>new NextRequest('https://local.example'+url,{...(body?{method:'POST',body:JSON.stringify(body)}:{}),headers:{cookie,host:'local.example',origin:'https://local.example','content-type':'application/json'}});
 const cookieFrom=response=>response.headers.get('set-cookie').split(';')[0];
 const response=NextResponse.json({});creator.setRoomStudioCookie(response,req('/'),rooms[0],'studio-default');const creatorCookie=cookieFrom(response);
 assert.equal((await(await adminApi.GET(req('/api/admin-access?room=A',creatorCookie))).json()).owner,true);
 const adminGrant=await adminApi.POST(req('/api/admin-access',creatorCookie,{action:'create',studioId:'studio-default',room:'A'}));assert.equal(adminGrant.status,200,'room studio issues admin without separate server-owner password');
 const adminPath=(await adminGrant.json()).path;assert.match(adminPath,/room=A/);assert.doesNotMatch(adminPath,/serverStaff/);
 const adminInvite=new URLSearchParams(adminPath.split('#')[1]).get('invite');
 const acceptedAdmin=await adminApi.POST(req('/api/admin-access','',{action:'accept',room:'A',invite:adminInvite}));assert.equal(acceptedAdmin.status,200);const adminCookie=cookieFrom(acceptedAdmin);
 const modGrant=await modApi.POST(req('/api/moderator-access',creatorCookie,{action:'create',room:'A',scope:'room'}));assert.equal(modGrant.status,200,'room studio issues moderator through existing API');
 const modPath=(await modGrant.json()).path;assert.match(modPath,/room=A/);const modInvite=new URLSearchParams(modPath.split('#')[1]).get('invite');
 const acceptedMod=await modApi.POST(req('/api/moderator-access','',{action:'accept',room:'A',invite:modInvite}));assert.equal(acceptedMod.status,200);const modCookie=cookieFrom(acceptedMod);
 for(const cookie of [creatorCookie,adminCookie,modCookie]){assert.equal((await slots.GET(req('/api/caster-slots?room=A',cookie))).status,200);assert.equal((await slots.GET(req('/api/caster-slots?room=B',cookie))).status,403,'room credentials never cross rooms');}
 assert.equal(await admin.isRoomAdmin(req('/',adminCookie),'A'),true);assert.equal(await moderator.isModerator(req('/',modCookie),'A'),true);
 assert.equal((await adminApi.POST(req('/api/admin-access','',{action:'create',room:'A'}))).status,403);
 assert.equal((await modApi.POST(req('/api/moderator-access','',{action:'create',room:'A',scope:'room'}))).status,403);
 assert.equal((await adminApi.POST(req('/api/admin-access',creatorCookie,{action:'create',room:'B'}))).status,403);
 const access=load('../lib/access.ts'),removedCookie='castlink-server-staff-'+access.roomVersion('studio-default').slice(0,24)+'='+access.signAccess({kind:'server-admin',studio:'studio-default',id:'old-installation',version:'old-version'});
 assert.equal(await admin.isRoomAdmin(req('/',removedCookie),'A'),false);assert.equal(await moderator.isModerator(req('/',removedCookie),'A'),false);
 assert.equal(await fs.stat(path.join(__dirname,'../app/api/server-staff-access/route.ts')).then(()=>true,()=>false),false,'removed server-owner issuer endpoint must not remain');
 console.log('PASS restored studio issuance: no owner password, real admin/moderator acceptance, scoped slots, unauthorized/cross-room denial and server issuer removed');
}finally{await fs.rm(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
