const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {NextRequest}=require('next/server'),{load}=require('./load-typescript.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-invite-delete-'));
 Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'invite-delete-test-secret',CASTLINK_HOSTED_ACCESS:'0',LIVEKIT_API_KEY:''});
 try{
  const store=load('../lib/caster-slot-store.ts'),access=load('../lib/caster-slot-access.ts');
  const scope={studioId:'studio-default',roomAssociation:'room-a'},other={...scope,roomAssociation:'room-b'};
  const invite=await store.createPersonalCasterInvite(scope),key=await access.personalCasterInviteKey(invite);
  assert.ok(await access.resolvePersonalCasterInvite(key,scope.studioId));
  await assert.rejects(store.deletePersonalCasterInvite(other,invite.id),/Приглашение недействительно/);
  await assert.rejects(store.deletePersonalCasterInvite({...scope,studioId:'other-studio'},invite.id),/Приглашение недействительно/);
  await assert.rejects(store.deletePersonalCasterInvite(scope,'__proto__'),/Приглашение недействительно/);
  await assert.rejects(store.deletePersonalCasterInvite(scope,invite.id,async()=>{throw Error('Actor revoked');}),/Actor revoked/);
  assert.ok(await access.resolvePersonalCasterInvite(key,scope.studioId),'rejected deletion preserves access');
  const slot=await store.createCasterSlot(scope,{name:'Keep',inviteId:invite.id});
  const output=await access.createSlotOutputAccess(scope,slot.id,'camera');
  await assert.rejects(store.deletePersonalCasterInvite(scope,invite.id),/Приглашение связано со слотом/);
  assert.equal(await access.verifySlotOutputAccess(output,scope,slot.id,'camera'),true,'bound invite rejection preserves permanent output');
  const standalone=await store.createPersonalCasterInvite(scope),standaloneKey=await access.personalCasterInviteKey(standalone);
  await store.deletePersonalCasterInvite(scope,standalone.id);
  assert.equal(await access.resolvePersonalCasterInvite(standaloneKey,scope.studioId),null,'deleted link no longer admits guests');
  assert.equal((await store.listPersonalCasterInvites(scope)).some(i=>i.id===standalone.id),false);
  assert.equal(await store.readPersonalCasterInvite(scope.studioId,standalone.id),null,'removed entries do not consume invitation capacity');
  assert.ok(await access.resolvePersonalCasterInvite(key,scope.studioId),'unrelated invitations survive');
  const raced=await store.createPersonalCasterInvite(scope);
  const results=await Promise.allSettled([store.createCasterSlot(scope,{name:'Race',inviteId:raced.id}),store.deletePersonalCasterInvite(scope,raced.id)]);
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1,'binding and deleting serialize in the same transaction');
  const after=await store.readCasterSlotData(scope.studioId);
  assert.ok(Object.values(after.slots).every(s=>after.invites[s.inviteId]?.enabled),'no slot can retain a deleted invitation');
  let allowed=true,guarded=0;
  const api=load('../app/api/caster-slots/route.ts',{
   '@/lib/hosted-access':{hasHostedAccess:()=>true},
   '@/lib/room-store':{readRooms:async()=>[{name:'A',slotAssociationId:'room-a'}]},
   '@/lib/room-studio-access':{canHostRoom:async()=>allowed},
   '@/lib/room-admin':{isRoomAdmin:async()=>false},'@/lib/moderator-access':{isModerator:async()=>false},
   '@/lib/slot-room-scope':{ensureSlotRoomScope:async()=>({scope}),slotRoomAssociation:()=>scope.roomAssociation,roomForSlotScope:async()=>null},
   '@/lib/guest-admission':{resolveSlotActor:async()=>({role:'studio'}),requireSlotActor:async()=>{guarded++;if(!allowed)throw Error('Actor revoked');}},
  });
  const post=(id,origin='https://local.example')=>new NextRequest('https://local.example/api/caster-slots',{method:'POST',headers:{host:'local.example',origin,'content-type':'application/json'},body:JSON.stringify({action:'delete-invite',studioId:scope.studioId,room:'A',id})});
  const apiInvite=await store.createPersonalCasterInvite(scope),apiKey=await access.personalCasterInviteKey(apiInvite);
  allowed=false;assert.equal((await api.POST(post(apiInvite.id))).status,403,'guest/unauthorized actor cannot revoke invitations');
  allowed=true;assert.equal((await api.POST(post(apiInvite.id,'https://other.example'))).status,403,'cross-origin mutation rejected');
  assert.equal((await api.POST(post(invite.id))).status,409,'stale UI cannot delete an invitation newly bound to a slot');
  const response=await api.POST(post(apiInvite.id));assert.equal(response.status,200);assert.ok(guarded>=2,'server revalidates actor in mutation transaction');
  assert.equal((await response.json()).invites.some(i=>i.id===apiInvite.id),false);assert.equal(await access.resolvePersonalCasterInvite(apiKey,scope.studioId),null);
  console.log('PASS standalone invitation deletion: scope, authorization, CSRF, transactional binding race, permanent outputs and signed-link revocation');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
