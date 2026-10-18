const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {load}=require('./load-typescript.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-admission-'));
 Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'admission-test-secret',CASTLINK_HOSTED_ACCESS:'0'});
 try{
 const api=load('../lib/guest-admission-store.ts');const scope={studioId:'studio-default',roomAssociation:'room-a'};
 const guest=await api.startGuestAdmission(scope,{clientId:'tab-a',name:'Alice',roomVersion:'v1'});
 assert.equal(guest.session.state,'waiting');
 assert.equal(await api.admissionForPublication(guest.session.id,scope,'v1'),null,'waiting never authorizes publication');
 assert.equal((await api.verifyGuestAdmissionCapability(guest.capability,scope)).id,guest.session.id);
 assert.equal(await api.verifyGuestAdmissionCapability(guest.capability,{...scope,roomAssociation:'room-b'}),null);
 await api.changeGuestAdmission(scope,guest.session.id,'waiting','admitted');
 assert.equal((await api.admissionForPublication(guest.session.id,scope,'v1')).identity,guest.session.identity);
 assert.equal(await api.admissionForPublication(guest.session.id,scope,'changed'),null,'room access revocation invalidates admission');
 const duplicate=await api.startGuestAdmission(scope,{clientId:'tab-b',name:'Alice',roomVersion:'v1'});
 assert.notEqual(duplicate.session.id,guest.session.id,'display name cannot claim an existing session');
 const resumed=await api.startGuestAdmission(scope,{clientId:'tab-a',name:'Alice',roomVersion:'v1',capability:guest.capability});
 assert.equal(resumed.session.id,guest.session.id,'only authenticated session capability restores same admission');
 const stolen=await api.startGuestAdmission(scope,{clientId:'tab-a',name:'Alice',roomVersion:'v1'});
 assert.notEqual(stolen.session.id,guest.session.id,'client ID alone is not a credential');
 await api.changeGuestAdmission(scope,guest.session.id,'admitted','waiting');
 assert.equal(await api.admissionForPublication(guest.session.id,scope,'v1'),null,'release stops future media tokens');
 assert.equal((await api.verifyGuestAdmissionCapability(guest.capability,scope)).state,'waiting');
 const readmitted=await api.changeGuestAdmission(scope,guest.session.id,'waiting','admitted');assert.notEqual(readmitted.identity,guest.session.identity,'a released JWT cannot take over the next admitted generation');assert.equal(readmitted.generation,2);
 console.log('PASS admission: waiting deny, explicit admission, authenticated resume, duplicate tab/name isolation, room version and release');
 }finally{await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
