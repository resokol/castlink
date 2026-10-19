const assert = require('node:assert/strict');
const fs = require('node:fs'), os = require('node:os'), path = require('node:path'), Module = require('node:module'), ts = require('typescript');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-creation-settings-'));
Object.assign(process.env, { CASTLINK_STORAGE_BACKEND: 'json', STUDIOLINK_DATA_DIR: dir, STUDIOLINK_ROOMS_FILE: path.join(dir, 'rooms.json'), CASTLINK_DEPLOYMENT_MODEL: 'self-hosted', CASTLINK_HOSTED_ACCESS: '0', CASTLINK_SESSION_SECRET: 'isolated-settings-session', LIVEKIT_API_SECRET: 'isolated-settings-media', ROOM_CREATION_PASSWORD: 'initial-creation-secret' });
delete process.env.ROOM_CREATION_PASSWORD_SHA256;
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...args) { return resolve.call(this, id.startsWith('@/') ? path.resolve(__dirname, '..', id.slice(2)) : id, ...args); };
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { NextRequest, NextResponse } = require('next/server');
const request = (body, cookie = '', origin = 'https://example.test') => new NextRequest('https://example.test/api/room-studio-access', { method: 'POST', headers: { host: 'example.test', origin, cookie, 'content-type': 'application/json', 'x-real-ip': '127.0.0.1' }, body: JSON.stringify(body) });
const statusRequest = cookie => new NextRequest('https://example.test/api/room-studio-access?setting=creation-password&name=mine', { headers: { cookie } });
(async () => {
 try {
  const api = require('../app/api/room-studio-access/route.ts'), store = require('../lib/room-store.ts'), access = require('../lib/access.ts');
  const created = await api.POST(request({action:'create',name:'mine',studioPassword:'studio-password',password:'guest-password',creationPassword:'initial-creation-secret'}));
  assert.equal(created.status,200); const studioCookie=created.headers.get('set-cookie').split(';')[0];
  const roomsBefore=JSON.stringify(await store.readRooms());
  const change = (currentPassword='initial-creation-secret',newPassword='Новый $ пароль # 2026',confirmation=newPassword) => ({action:'change-creation-password',name:'mine',currentPassword,newPassword,confirmation});
  const changed=await api.POST(request(change(),studioCookie));
  assert.equal(changed.status,200,'studio can change the creation password without recreating the room');
  assert.deepEqual(await changed.json(),{ok:true});
  assert.equal(JSON.stringify(await store.readRooms()),roomsBefore,'rotation leaves rooms, guest credentials and media associations unchanged');
  const credential=require('../lib/room-creation-access.ts');
  assert.equal(await credential.validRoomCreationPassword('initial-creation-secret'),false,'bootstrap password stops working');
  assert.equal(await credential.validRoomCreationPassword('Новый $ пароль # 2026'),true);
  assert.equal((await api.GET(statusRequest(studioCookie))).status,200);
  assert.deepEqual(await (await api.GET(statusRequest(studioCookie))).json(),{allowed:true,configured:true,canInitialize:false});
  const filename=path.join(dir,'runtime','room-creation-password.json'), safe=fs.readFileSync(filename,'utf8');
  for(const plaintext of ['initial-creation-secret','Новый $ пароль # 2026'])assert.ok(!safe.includes(plaintext),'only a hash is persisted');
  delete require.cache[require.resolve('../lib/room-creation-access.ts')];
  const reloaded=require('../lib/room-creation-access.ts');
  assert.equal(await reloaded.validRoomCreationPassword('Новый $ пароль # 2026'),true,'rotation survives module restart');
  const guestRecord=(await store.readRooms()).find(r=>r.name==='mine'), guest=NextResponse.json({});
  access.setAccessCookie(guest,request({}),'guest','mine',guestRecord.passwordHash);
  const guestCookie=guest.headers.get('set-cookie').split(';')[0];
  for(const cookie of ['',guestCookie]) {
   assert.equal((await api.POST(request(change('Новый $ пароль # 2026'),cookie))).status,401);
   assert.equal((await api.GET(statusRequest(cookie))).status,401);
  }
  const adminCookie='studiolink-admin='+access.signAccess({kind:'admin',room:'mine',studio:'studio-default',version:access.roomVersion(guestRecord.passwordHash)},3600);
  assert.equal((await api.POST(request(change('Новый $ пароль # 2026'),adminCookie))).status,401,'room administrator cannot rotate server credential');
  assert.equal((await api.POST(request(change('wrong-password'),studioCookie))).status,403);
  assert.equal((await api.POST(request(change('Новый $ пароль # 2026'),studioCookie,'https://evil.test'))).status,403);
  for(const value of ['', 'short', ' '.repeat(8), 'a'.repeat(257), 'line\nbreak', 'line\rbreak', 'null\0value']) {
   assert.equal((await api.POST(request(change('Новый $ пароль # 2026',value),studioCookie))).status,400);
  }
  assert.equal((await api.POST(request(change('Новый $ пароль # 2026','another-password','different-password'),studioCookie))).status,400);
  require('../lib/rate-limit.ts').resetRateLimitsForTests();
  const concurrent=await Promise.all(['next-password-one','next-password-two'].map(value=>api.POST(request(change('Новый $ пароль # 2026',value),studioCookie))));
  assert.deepEqual(concurrent.map(r=>r.status).sort(),[200,403],'two requests with the same old credential cannot both commit');
  const winner=concurrent[0].status===200?'next-password-one':'next-password-two';
  assert.equal(await reloaded.validRoomCreationPassword(winner),true);
  assert.equal((await api.POST(request({action:'login',name:'mine',studioPassword:'studio-password'}))).status,200,'existing studio login remains valid');
  fs.writeFileSync(filename,'broken-json');
  assert.equal((await api.POST(request(change(winner),studioCookie))).status,503,'corruption cannot fall back to the old bootstrap secret');
  assert.equal((await api.POST(request({action:'create',name:'blocked',studioPassword:'studio-password',creationPassword:'initial-creation-secret'}))).status,503);
  assert.equal(fs.readFileSync(filename,'utf8'),'broken-json','bad state is never overwritten');
  fs.unlinkSync(filename);delete process.env.ROOM_CREATION_PASSWORD;
  process.env.STUDIOLINK_STUDIO_PASSWORD_HASH=access.hashPassword('server-owner-password');
  const ownerCookie='studiolink-studio='+access.signAccess({kind:'studio',studio:'studio-default',version:access.roomVersion(process.env.STUDIOLINK_STUDIO_PASSWORD_HASH)},3600);
  require('../lib/rate-limit.ts').resetRateLimitsForTests();
  assert.equal((await api.POST(request(change('', 'initial-owned-password'),studioCookie))).status,401,'room creator cannot initialize a server-wide credential');
  assert.deepEqual(await (await api.GET(statusRequest(ownerCookie))).json(),{allowed:true,configured:false,canInitialize:true});
  const initial=await Promise.all(['first-owner-password','second-owner-password'].map(value=>api.POST(request(change('',value),ownerCookie))));
  assert.deepEqual(initial.map(r=>r.status).sort(),[200,403],'two owner bootstrap requests cannot both initialize');
  assert.equal((await api.POST(request(change('', 'must-not-replace-password'),ownerCookie))).status,403,'once configured, even owner must know current password');
  fs.unlinkSync(filename);process.env.ROOM_CREATION_PASSWORD_SHA256='malformed';
  assert.equal((await api.POST(request(change('', 'must-not-repair-malformed'),ownerCookie))).status,503,'malformed bootstrap config is not treated as an unset credential');
  assert.ok(!fs.existsSync(filename));
  console.log('PASS creation password settings: authenticated rotation, immediate revocation, persistent restart, CSRF/roles/validation, concurrency, unchanged rooms and fail-closed corruption');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}
})().catch(error=>{console.error(error);process.exitCode=1;});
