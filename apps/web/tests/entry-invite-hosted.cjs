const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {NextRequest}=require('next/server'),{load}=require('./load-typescript.cjs');
(async()=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-hosted-invite-entry-'));
 Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,CASTLINK_STORAGE_BACKEND:'json',CASTLINK_SESSION_SECRET:'isolated-hosted-invite-entry',CASTLINK_HOSTED_ACCESS:'1'});
 try {
  await fs.mkdir(path.join(root,'runtime'),{recursive:true});
  const access=load('../lib/access.ts');
  await fs.writeFile(path.join(root,'runtime/studiolink-rooms.json'),JSON.stringify({schemaVersion:1,rooms:[{name:'Private',passwordHash:access.hashPassword('guest-password'),slotAssociationId:'association-one'}]}));
  const scope={studioId:'studio-default',roomAssociation:'association-one'};
  const store=load('../lib/caster-slot-store.ts');
  const invite=await store.createPersonalCasterInvite(scope);
  const key=await load('../lib/caster-slot-access.ts').personalCasterInviteKey(invite);
  const api=load('../app/api/guest-admission/route.ts');
  const post=(body,origin='https://local.example')=>new NextRequest('https://local.example/api/guest-admission',{method:'POST',headers:{host:'local.example',origin,'content-type':'application/json'},body:JSON.stringify(body)});
  const response=await api.POST(post({action:'resolve',studioId:'studio-default',invite:key}));
  assert.equal(response.status,200,'valid personal guest invite must resolve without staff hosted token');
  const data=await response.json();assert.equal(data.room,'Private');assert.deepEqual(data.entrySettings,{audioOnly:false,startMuted:false,noGuestAudio:false});
  assert.equal((await api.POST(post({action:'resolve',studioId:'another',invite:key}))).status,403,'another studio cannot resolve invite');
  assert.equal((await api.POST(post({action:'resolve',invite:key},'https://evil.example'))).status,403,'same-origin remains mandatory');
  assert.equal((await api.POST(post({action:'start',room:'Private',clientId:'unknown',name:'Unknown'}))).status,403,'private room still needs signed guest proof');
  const start=await api.POST(post({action:'start',studioId:'studio-default',invite:key,clientId:'one',name:'Alice'}));assert.equal(start.status,200,'validated invite can start guest session');
  assert.ok((await start.json()).capability);
  await store.transactCasterSlots('studio-default',data=>{data.invites[invite.id].enabled=false;});
  assert.equal((await api.POST(post({action:'resolve',studioId:'studio-default',invite:key}))).status,403,'revocation is checked on each resolve');
  console.log('PASS hosted invite entry: personal guest can resolve/start without staff token, settings agree, private scope/origin/revocation remain enforced');
 } finally {await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
