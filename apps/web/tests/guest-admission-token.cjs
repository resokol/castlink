const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const{NextRequest}=require('next/server'),{load}=require('./load-typescript.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-direct-token-'));
 Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'direct-entry-test-secret',LIVEKIT_API_KEY:'test-key',LIVEKIT_API_SECRET:'test-secret-with-at-least-32-characters',CASTLINK_HOSTED_ACCESS:'0'});
 try{
  await fs.mkdir(path.join(root,'runtime'),{recursive:true});
  await fs.writeFile(path.join(root,'runtime/studiolink-rooms.json'),JSON.stringify({schemaVersion:1,rooms:[{name:'A',slotAssociationId:'room-a'},{name:'Private',passwordHash:'protected',slotAssociationId:'private-room'}]}));
  const api=load('../app/api/token/route.ts');
  const request=(headers={},identity='',room='A')=>new NextRequest('https://local.example/api/token?studioId=studio-default&room='+room+'&role=guest&name=Alice'+(identity?'&identity='+identity:''),{headers});
  const fresh=await api.GET(request());assert.equal(fresh.status,200,'normal guest enters without a slot or moderator confirmation');
  const first=await fresh.json(),second=await(await api.GET(request())).json();assert.notEqual(first.identity,second.identity,'fresh entries are independent');
  const claims=jwt=>JSON.parse(Buffer.from(jwt.split('.')[1],'base64url'));
  assert.equal(claims(first.token).video.canPublish,true);assert.equal(claims(first.token).video.room,'A');
  const retention=load('../lib/guest-session-settings.ts');
  retention.rememberGuestSessionSettings('studio-default',{name:'A',slotAssociationId:'room-a'},first.identity,{videoHeight:720,videoMaxBitrateKbps:2500});
  const renewed=await api.GET(request({authorization:'Bearer '+first.token},first.identity));assert.equal(renewed.status,200);
  const next=await renewed.json();assert.equal(next.identity,first.identity);assert.equal(JSON.parse(claims(next.token).metadata).transferSessionId,JSON.parse(claims(first.token).metadata).transferSessionId);
  assert.equal(JSON.parse(claims(next.token).metadata).videoHeight,720,'renewal restores staff camera height in signed metadata');
  assert.equal(next.guestSettings.metadata.videoHeight,720,'renewal response restores camera height alongside bitrate');
  assert.equal(JSON.parse(claims(next.token).metadata).videoMaxBitrateKbps,2500);
  assert.equal((await api.GET(request({},'','Private'))).status,401,'room password protection remains');
  assert.equal((await api.GET(request({'x-castlink-caster-invite':'forged'},'','Private'))).status,401);
  const slots=load('../lib/caster-slot-store.ts'),access=load('../lib/caster-slot-access.ts');
  const privateSlot=await slots.createCasterSlot({studioId:'studio-default',roomAssociation:'private-room'},{name:'Private caster'});
  const invite=await slots.readPersonalCasterInvite('studio-default',privateSlot.inviteId),key=await access.personalCasterInviteKey(invite);
  const personalResponse=await api.GET(request({'x-castlink-caster-invite':key},'','Private'));assert.equal(personalResponse.status,200,'personal invite enters immediately without assignment');
  const personal=await personalResponse.json();
  const basic='Basic '+Buffer.from('private-site:fixture-shared-password').toString('base64');
  const basicInviteResponse=await api.GET(request({authorization:basic,'x-castlink-caster-invite':key},'','Private'));
  assert.equal(basicInviteResponse.status,200,'cached website Basic credentials must not become a guest renewal JWT');
  assert.equal(claims((await basicInviteResponse.json()).token).video.room,'Private','personal invitation still scopes fresh entry');
  assert.equal((await api.GET(request({authorization:basic},'','Private'))).status,401,'Basic alone never authorizes protected room entry');
  assert.equal((await api.GET(request({authorization:'Basic malformed'},'','Private'))).status,401,'malformed Basic is not a room access grant');
  for(const authorization of ['Bearer malformed','Bearer malformed extra','Bearer','Bearer ']){
    const rejected=await api.GET(request({authorization,'x-castlink-caster-invite':key},'','Private'));
    assert.equal(rejected.status,401,'invalid or empty real Bearer must fail even with valid invitation');
    assert.equal((await rejected.json()).error,'Недействительный токен продления');
  }
  const wrongStudio=new(require('livekit-server-sdk').AccessToken)(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET,{identity:first.identity,metadata:JSON.stringify({role:'guest',studioId:'foreign-studio'})});
  wrongStudio.addGrant({roomJoin:true,room:'A'});
  assert.equal((await api.GET(request({authorization:'Bearer '+await wrongStudio.toJwt()},first.identity))).status,403,'renewal cannot cross studio scope');
  const validBearer='Bearer '+first.token;
  assert.equal((await api.GET(request({authorization:validBearer},first.identity,'Private'))).status,403,'renewal cannot cross room scope');
  assert.equal((await api.GET(request({authorization:validBearer},'guest-other'))).status,403,'renewal cannot change identity');
  const outputRequest=request({authorization:validBearer},first.identity);
  outputRequest.nextUrl.searchParams.set('role','output');
  outputRequest.nextUrl.searchParams.set('identity','output-other');
  assert.equal((await api.GET(outputRequest)).status,403,'guest bearer cannot renew an output role');

  await slots.rotateCasterSlotInvite({studioId:'studio-default',roomAssociation:'private-room'},privateSlot.id,privateSlot.revision);
  assert.equal((await api.GET(request({'x-castlink-caster-invite':key},'','Private'))).status,401,'revoked invitation cannot issue a fresh identity');
  assert.equal((await api.GET(request({authorization:'Bearer '+personal.token},personal.identity,'Private'))).status,200,'invitation rotation preserves existing same-identity session');
  await fs.writeFile(path.join(root,'runtime/studiolink-rooms.json'),JSON.stringify({schemaVersion:1,rooms:[{name:'A',slotAssociationId:'room-a'},{name:'Private',passwordHash:'protected',slotAssociationId:'recreated-private-room'}]}));
  assert.equal((await api.GET(request({authorization:'Bearer '+personal.token},personal.identity,'Private'))).status,401,'delete/recreate cannot revive old personal session');
  assert.equal((await api.GET(request({'x-castlink-guest-admission':'forged'},'','Private'))).status,401,'routing capability cannot bypass room access');
  const admissions=load('../lib/guest-admission-store.ts'),service=load('../lib/caster-slot-service.ts'),roomScope=load('../lib/slot-room-scope.ts');
  const scope={studioId:'studio-default',roomAssociation:'room-a'},old=await admissions.startGuestAdmission(scope,{clientId:'legacy-tab',name:'Legacy',roomVersion:roomScope.slotRoomVersion({name:'A'})});
  const admitted=await admissions.changeGuestAdmission(scope,old.session.id,'waiting','admitted'),slot=await slots.createCasterSlot(scope,{name:'Legacy'});
  await slots.mutateCasterSlot(scope,slot.id,slot.revision,s=>({...s,phase:'assigned',assignment:{sessionId:admitted.id,identity:admitted.identity,generation:admitted.generation,participantSid:'SID-old'}}));
  const {AccessToken}=require('livekit-server-sdk'),legacy=new AccessToken(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET,{identity:admitted.identity,metadata:JSON.stringify({role:'guest',studioId:scope.studioId,admissionId:admitted.id,admissionGeneration:admitted.generation,transferSessionId:'legacy-session'})});
  legacy.addGrant({roomJoin:true,room:'A'});const refreshed=await api.GET(request({authorization:'Bearer '+await legacy.toJwt()},admitted.identity));assert.equal(refreshed.status,200);
  const legacyMetadata=claims((await refreshed.json()).token).metadata;assert.equal(JSON.parse(legacyMetadata).admissionId,admitted.id,'old open tab retains signed assignment marker');
  const restored=await service.confirmCasterSlot(scope,slot.id,{getParticipant:async()=>({identity:admitted.identity,sid:'SID-new',metadata:legacyMetadata}),removeParticipant:async()=>{throw Error('must not remove')}});
  assert.equal(restored.phase,'assigned');assert.equal(restored.assignment.participantSid,'SID-new');
  console.log('PASS direct entry, password/invitation, stable renewal and old assigned session reconnect');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
