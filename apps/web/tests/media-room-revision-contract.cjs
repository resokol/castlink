const assert=require('node:assert/strict');const {randomUUID}=require('node:crypto');
const {diagnosticAssociation,deleteDiagnosticRoom,DiagnosticRoomConflict}=require('../lib/media-room-association.ts');
module.exports=async function revisionContract(store){
 const studio='studio-default';let count=0;
 for(const [label,change] of [
  ['mode',r=>({...r,studioOnly:true})],
  ['admin',r=>({...r,adminAccessVersion:randomUUID()})],
  ['transfer',r=>({...r,transferRoomId:'transfer-operator'})],
  ['operator guest invite',r=>({...r})],
  ['noop mode',r=>({...r,studioOnly:r.studioOnly})],
  ['in-place mutation',r=>{r.studioOnly=true;return r;}],
 ]){
  const record={name:'owned',guestInviteVersion:randomUUID(),viewerAccessVersion:randomUUID(),outputAccessVersion:randomUUID(),diagnosticCreationId:randomUUID(),diagnosticRevision:randomUUID()};
  await store.update(studio,()=>[{name:'legacy'},record]);const receipt=diagnosticAssociation((await store.read(studio))[1]);
  await store.update(studio,rooms=>rooms.map(r=>r.name==='owned'?change(r):r));
  const actual=(await store.read(studio))[1];
  assert.equal(actual.guestInviteVersion,record.guestInviteVersion,label+' must preserve guest credentials');
  assert.equal(actual.viewerAccessVersion,record.viewerAccessVersion,label+' must preserve viewer credentials');
  assert.equal(actual.outputAccessVersion,record.outputAccessVersion,label+' must preserve output credentials');
  await assert.rejects(store.update(studio,rooms=>deleteDiagnosticRoom(rooms,'owned',receipt)),DiagnosticRoomConflict,label+' must refuse old cleanup receipt');
  assert.equal((await store.read(studio)).length,2,label+' room must survive');count++;
 }
 const record={name:'owned',guestInviteVersion:randomUUID(),viewerAccessVersion:randomUUID(),outputAccessVersion:randomUUID(),diagnosticCreationId:randomUUID(),diagnosticRevision:randomUUID()};
 await store.update(studio,()=>[{name:'legacy'},record]);const receipt=diagnosticAssociation((await store.read(studio))[1]);
 await store.update(studio,rooms=>rooms.map(r=>r.name==='owned'?{...r,name:'away'}:r));
 await store.update(studio,rooms=>rooms.map(r=>r.name==='away'?{...r,name:'owned'}:r));
 await assert.rejects(store.update(studio,rooms=>deleteDiagnosticRoom(rooms,'owned',receipt)),DiagnosticRoomConflict);count++;
 const untouched={...record,diagnosticCreationId:randomUUID(),diagnosticRevision:randomUUID()};
 await store.update(studio,()=>[{name:'legacy'},untouched]);const cleanReceipt=diagnosticAssociation((await store.read(studio))[1]);
 await store.update(studio,current=>current); // Diagnostic invite issuance preserves exact room objects.
 assert.deepEqual(diagnosticAssociation((await store.read(studio))[1]),cleanReceipt);
 await store.update(studio,rooms=>deleteDiagnosticRoom(rooms,'owned',cleanReceipt));
 assert.deepEqual((await store.read(studio)).map(r=>r.name),['legacy']);count++;
 console.log(`PASS: ${count} diagnostic revision cases; mode/admin/transfer/noop/rename dirty, grant credentials retained, untouched receipt cleans`);
};
