const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');const{load}=require('./load-typescript.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-routing-'));
 Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'slot-routing-test',CASTLINK_HOSTED_ACCESS:'0'});
 try{
 await fs.mkdir(path.join(root,'runtime'),{recursive:true});await fs.writeFile(path.join(root,'runtime/studiolink-rooms.json'),JSON.stringify({schemaVersion:1,rooms:[{name:'A',slotAssociationId:'room-a'}]}));
 const store=load('../lib/caster-slot-store.ts'),admissions=load('../lib/guest-admission-store.ts'),service=load('../lib/caster-slot-service.ts');
 const scope={studioId:'studio-default',roomAssociation:'room-a'},actor={studioId:'studio-default',kind:'studio',roomAssociation:'room-a',authorize:async()=>true};
 const participants=new Map(),removed=[];
 const live=(identity,sid,session)=>({identity,sid,name:identity,metadata:JSON.stringify({role:'guest',studioId:scope.studioId,transferSessionId:session})});
 participants.set('guest-a',live('guest-a','SID-A','session-a'));participants.set('guest-b',live('guest-b','SID-B','session-b'));
 const media={async getParticipant(room,id){if(!participants.has(id))throw Object.assign(Error('missing'),{status:404});return participants.get(id);},async removeParticipant(room,id){removed.push(id);participants.delete(id);}};
 const first=await store.createCasterSlot(scope,{name:'Host'}),second=await store.createCasterSlot(scope,{name:'Other'});
 const a=await service.adoptConnectedCaster(actor,scope,'guest-a','SID-A',media),b=await service.adoptConnectedCaster(actor,scope,'guest-b','SID-B',media);
 await service.assignCasterToSlot(actor,scope,first.id,a.id,first.revision,false,media);
 const ready=await service.confirmCasterSlot(scope,first.id,media);assert.equal(ready.phase,'assigned');assert.equal(ready.assignment.participantSid,'SID-A');
 await assert.rejects(service.assignCasterToSlot(actor,scope,first.id,b.id,ready.revision,false,media));
 const moved=await service.assignCasterToSlot(actor,scope,second.id,a.id,second.revision,false,media);assert.equal((await store.readCasterSlot(scope.studioId,first.id)).assignment,null);
 const replaced=await service.assignCasterToSlot(actor,scope,second.id,b.id,moved.revision,true,media);
 assert.equal(participants.size,2,'replacing output preserves both connected casters');assert.equal((await admissions.readGuestAdmission(scope.studioId,a.id)).state,'admitted');
 assert.equal(replaced.cameraOutputVersion,second.cameraOutputVersion);assert.equal(replaced.screenOutputVersion,second.screenOutputVersion);
 participants.set('guest-b',live('guest-b','SID-B-reconnected','session-b'));
 const reconnected=await service.confirmCasterSlot(scope,second.id,media);assert.equal(reconnected.assignment.participantSid,'SID-B-reconnected','same signed session restores output');
 participants.set('guest-b',live('guest-b','SID-impostor','other-session'));
 assert.equal((await service.confirmCasterSlot(scope,second.id,media)).phase,'disconnected','identity alone cannot take over output');
 const current=await store.readCasterSlot(scope.studioId,second.id);
 await assert.rejects(service.releaseCasterSlot({...actor,authorize:async()=>false},scope,second.id,current.revision,media));
 await assert.rejects(service.releaseCasterSlot(actor,scope,second.id,current.revision-1,media));
 await service.releaseCasterSlot(actor,scope,second.id,current.revision,media);
 assert.equal((await store.readCasterSlot(scope.studioId,second.id)).assignment,null);assert.equal((await admissions.readGuestAdmission(scope.studioId,b.id)).state,'admitted');assert.equal(participants.size,2);assert.deepEqual(removed,[],'slots never remove room participants');
 const feature=load('../lib/server-feature-store.ts');
 await feature.updateServerFeatureState('guest_admissions',scope.studioId,()=>({schemaVersion:1,sessions:{}}),data=>{
  for(let i=0;i<512;i++)data.sessions['expired-'+i]={...a,id:'expired-'+i,identity:'guest-expired-'+i,state:'closed',expiresAt:Date.now()-1,lastSeen:Date.now()-3*3600000};
  data.sessions.recent={...a,id:'recent',identity:'guest-recent',state:'closed',lastSeen:Date.now(),expiresAt:Date.now()+60000};return data;
 });
 const extra=await admissions.adoptGuestAdmission(scope,{identity:'guest-new',sid:'SID-new',name:'New',roomVersion:a.roomVersion,mediaSessionId:'new-session'});
 assert.equal(extra.identity,'guest-new','expired history cannot permanently exhaust adoption store');
 assert.equal((await admissions.readGuestAdmission(scope.studioId,a.id)).state,'admitted','active routing session retained');
 assert.equal((await admissions.readGuestAdmission(scope.studioId,'recent')).state,'closed','recent kick tombstone retained');
 console.log('PASS routing only: assign/move/replace, authenticated reconnect, release/CAS and bounded history');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
