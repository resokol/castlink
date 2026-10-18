const assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path'),{randomUUID}=require('node:crypto'),{Pool}=require('pg'),{load}=require('./load-typescript.cjs');
(async()=>{const url=process.env.TEST_DATABASE_URL;if(!url||new URL(url).hostname!=='127.0.0.1'||!new URL(url).pathname.endsWith('/slotsqa'))throw Error('Separate local slotsqa TEST_DATABASE_URL required');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'castlink-pg-slots-')),installationId=randomUUID(),pool=new Pool({connectionString:url});
 Object.assign(process.env,{STUDIOLINK_DATA_DIR:root,STUDIOLINK_INSTALLATION_ID:installationId,CASTLINK_STORAGE_BACKEND:'postgres',DATABASE_URL:url,CASTLINK_SESSION_SECRET:'local-postgres-test'});
 try{
  const dir=path.resolve(__dirname,'../../../infrastructure/postgres');for(let pass=0;pass<2;pass++)for(const name of(await fs.readdir(dir)).filter(n=>n.endsWith('.sql')).sort())await pool.query(await fs.readFile(path.join(dir,name),'utf8'));
  const backend=load('../lib/postgres-room-store.ts');const rooms=new backend.PostgresRoomStoreBackend(pool,installationId);const association=randomUUID();await rooms.update('studio-default',()=>[{name:'A',slotAssociationId:association}]);await rooms.validate();assert.equal((await rooms.read('studio-default'))[0].slotAssociationId,association);
  const store=load('../lib/caster-slot-store.ts'),scope={studioId:'studio-default',roomAssociation:association};const slot=await store.createCasterSlot(scope,{name:'Caster'});
  const results=await Promise.allSettled([store.updateCasterSlot(scope,slot.id,slot.revision,{name:'A'}),store.updateCasterSlot(scope,slot.id,slot.revision,{name:'B'})]);assert.equal(results.filter(r=>r.status==='fulfilled').length,1);
  const current=await store.readCasterSlot(scope.studioId,slot.id);await assert.rejects(store.mutateCasterSlot(scope,slot.id,current.revision,()=>{throw Error('rollback');}));assert.deepEqual(await store.readCasterSlot(scope.studioId,slot.id),current);
  assert.equal((await store.readCasterSlots({...scope,studioId:'other-studio'})).length,0);
  const access=load('../lib/caster-slot-access.ts'),key=await access.createSlotOutputAccess(scope,slot.id,'camera');await rooms.update('studio-default',()=>[{name:'Renamed',slotAssociationId:association}]);assert.equal(await access.createSlotOutputAccess(scope,slot.id,'camera'),key);
  await rooms.update('studio-default',()=>[{name:'A',slotAssociationId:randomUUID()}]);assert.equal(await load('../lib/slot-room-scope.ts').roomForSlotScope(scope),null);
  console.log('PASS PostgreSQL: migrations twice, stable room association, concurrent CAS, rollback, tenant isolation, deleted room, role revocation');
 }finally{await pool.end();const shared=globalThis[Symbol.for('castlink.server-feature-storage')];if(shared?.pool){await shared.pool.end();delete shared.pool;}await fs.rm(root,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
