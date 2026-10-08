const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-transfer-staff-'));
Object.assign(process.env,{CASTLINK_STORAGE_BACKEND:'json',STUDIOLINK_DATA_DIR:dir,STUDIOLINK_ROOMS_FILE:path.join(dir,'rooms.json'),STUDIOLINK_TRANSFER_STATE_FILE:path.join(dir,'transfer.json'),CASTLINK_SESSION_SECRET:'staff-transfer-signing-secret-at-least32',LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:'test-secret',STUDIOLINK_TRANSFER_SECRET:'staff-transfer-pair-secret-at-least32',STUDIOLINK_TRANSFER_SERVER_ID:'source',STUDIOLINK_TRANSFER_ORIGIN:'https://source.example',STUDIOLINK_TRANSFER_PEER_ORIGIN:'https://target.example',STUDIOLINK_TRANSFER_TARGETS_JSON:JSON.stringify([{id:'target',label:'Reserve',origin:'https://target.example'}])});
const resolve=Module._resolveFilename;Module._resolveFilename=function(id,...args){return resolve.call(this,id.startsWith('@/')?path.resolve(__dirname,'..',id.slice(2)):id,...args)};
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {NextRequest,NextResponse}=require('next/server'),sdk=require('livekit-server-sdk'),crypto=require('node:crypto');
const req=(body,cookie='',jwt='')=>new NextRequest('https://source.example/api/server-transfer'+(body?'':'?room=mine'),{method:body?'POST':'GET',headers:{host:'source.example',origin:'https://source.example',cookie,...(jwt?{authorization:'Bearer '+jwt}:{})},...(body?{body:JSON.stringify(body)}:{})});
const cookieFrom=write=>{const response=NextResponse.json({});write(response);return response.headers.get('set-cookie').split(';')[0]};
const originalFetch=global.fetch;let participants=[],bridges=[];
sdk.RoomServiceClient.prototype.listRooms=async()=>[];sdk.RoomServiceClient.prototype.listParticipants=async()=>participants;
global.fetch=async(_url,options)=>{const body=JSON.parse(options.body);bridges.push(body);return{ok:true,status:200,json:async()=>({ticket:'x'.repeat(48)})}};
(async()=>{
 const rooms=require('../lib/room-store.ts'),access=require('../lib/access.ts'),creator=require('../lib/room-studio-access.ts'),admin=require('../lib/room-admin.ts'),moderator=require('../lib/moderator-access.ts'),transfer=require('../lib/server-transfer.ts'),api=require('../app/api/server-transfer/route.ts'),tokenApi=require('../app/api/token/route.ts');
 const id=crypto.randomUUID(),record={name:'mine',creatorAccessId:id,transferRoomId:id,studioPasswordHash:access.hashPassword('studio-secret'),adminAccessVersion:crypto.randomUUID()};
 await rooms.updateRooms(()=>[record,{name:'foreign'}]);
 const expiry=Date.now()+90_000;
 const creatorCookie=cookieFrom(response=>creator.setRoomStudioCookie(response,req(null),record,'studio-default',expiry));
 const adminCookie=cookieFrom(response=>admin.setRoomAdminCookie(response,req(null),'mine',record.adminAccessVersion,expiry));
 const invite=await moderator.createRoomModeratorInvite('mine');
 const session=await moderator.acceptRoomModeratorInvite('mine',invite.id,expiry,'studio-default',id);
 const modCookie=cookieFrom(response=>moderator.setRoomModeratorCookie(response,req(null),'mine',session.id,expiry));
 const sessions=[
  {identity:'studio-moderator-secondary',cookie:creatorCookie,kind:'creator',role:'studio',version:access.roomVersion(record.studioPasswordHash)},
  {identity:'studio-moderator-admin',cookie:adminCookie,kind:'admin',role:'admin',version:record.adminAccessVersion},
  {identity:'studio-moderator-scoped',cookie:modCookie,kind:'moderator',role:'moderator',version:session.id},
 ];
 for(const item of sessions){
  item.clientId=crypto.randomUUID();item.authorization={kind:item.kind,roomId:id,creatorAccessId:id,credentialVersion:item.version,expiresAt:expiry};
  const issued=await tokenApi.GET(new NextRequest('https://source.example/api/token?room=mine&role=studio-moderator&clientId='+item.clientId+'&name='+item.kind,{headers:{cookie:item.cookie}}));
  assert.equal(issued.status,200);
  const issuedClaims=await new sdk.TokenVerifier(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET).verify((await issued.json()).token);
  const issuedMetadata=JSON.parse(issuedClaims.metadata);
  assert.equal(issuedMetadata.transferAuthorization?.kind,item.kind,'token producer carries verified logical authority for capture');
  assert.ok(issuedMetadata.transferAuthorization.expiresAt<=expiry);
  item.metadata={role:'studio-moderator',studioId:'studio-default',clientId:item.clientId,transferAuthorization:item.authorization,...(item.kind==='admin'?{roomAdmin:true,adminAccessVersion:item.version,accessRole:'admin'}:item.kind==='moderator'?{roomModeratorRoom:'mine',roomModeratorSessionId:item.version,accessRole:'room-moderator'}:{})};
  const token=new sdk.AccessToken(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET,{identity:item.identity,name:item.kind,ttl:'5m',metadata:JSON.stringify(item.metadata)});token.addGrant({roomJoin:true,room:'mine',canSubscribe:true});item.jwt=await token.toJwt();
  participants.push({identity:item.identity,name:item.kind,metadata:JSON.stringify(item.metadata)});
 }
 const primaryId=crypto.randomUUID();await require('../lib/studio-control.ts').joinStudio('mine',primaryId);
 const main=new sdk.AccessToken(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET,{identity:'studio-panel-main',metadata:JSON.stringify({role:'studio-panel',studioId:'studio-default',clientId:primaryId,transferAuthorization:{kind:'creator',roomId:id,creatorAccessId:id,credentialVersion:access.roomVersion(record.studioPasswordHash),expiresAt:expiry}})});main.addGrant({roomJoin:true,room:'mine'});const mainJwt=await main.toJwt();
 assert.equal((await api.POST(req({action:'start',room:'mine',targetId:'target',clientId:crypto.randomUUID()},creatorCookie,mainJwt))).status,403,'secondary creator cannot seize transfer primary');
 assert.equal((await api.POST(req({action:'start',room:'mine',targetId:'target',clientId:primaryId},creatorCookie,mainJwt))).status,200);
 for(const item of sessions){
  const response=await api.GET(req(null,item.cookie,item.jwt));assert.equal(response.status,200,`${item.kind} session can follow a transfer`);
  const result=await response.json();assert.equal(result.role,item.role);assert.equal(typeof result.ticket,'string');
  const payload=bridges.at(-1);assert.equal(payload.authorization.kind,item.kind);assert.ok(payload.authorization.expiresAt<=expiry,'source authorization lifetime is preserved');
 }
 await rooms.updateRooms(list=>list.map(room=>room.name==='mine'?{...room,adminAccessVersion:crypto.randomUUID()}:room));
 const revokedAdmin=await api.GET(req(null,adminCookie,sessions[1].jwt));assert.ok(revokedAdmin.status===403||!('ticket'in(await revokedAdmin.json())),'revoked administrator cannot acquire a target ticket');
 await moderator.revokeRoomModeratorSession('mine',session.id);
 const revokedMod=await api.GET(req(null,modCookie,sessions[2].jwt));assert.ok(revokedMod.status===403||!('ticket'in(await revokedMod.json())),'revoked moderator cannot acquire a target ticket');
 console.log('PASS: captured additional studio/admin/moderator sessions preserve role/expiry and enforce current revocation');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(()=>{global.fetch=originalFetch;fs.rmSync(dir,{recursive:true,force:true})});
