const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-invite-key-'));process.env.STUDIOLINK_DATA_DIR=dir;process.env.CASTLINK_SESSION_SECRET='isolated-key-test';
const access=require('../lib/access.ts');
(async()=>{try{
 const store=require('../lib/guest-invite-key.ts');
 const signed=access.signAccess({kind:'invite',studio:'studio-default',room:'private',version:'version-1',entrySettings:{noGuestAudio:true,startMuted:true,audioOnly:false}},60);
 const key=await store.createGuestInviteKey(signed);assert.match(key,/^[A-Za-z0-9_-]{32}$/);assert.notEqual(key,signed.slice(0,32),'key is independent randomness, never JWT truncation');
 assert.equal(await store.resolveGuestInviteKey(key),signed);assert.equal(await store.resolveGuestInviteKey(signed),signed,'legacy signed links remain compatible');
 const claims=access.readAccess(await store.resolveGuestInviteKey(key));assert.equal(claims.entrySettings.startMuted,true);
 assert.equal(access.validGuestInvite(await store.resolveGuestInviteKey(key),'private','version-1','studio-default'),true);
 assert.equal(access.validGuestInvite(await store.resolveGuestInviteKey(key),'other','version-1','studio-default'),false);
 assert.equal(access.validGuestInvite(await store.resolveGuestInviteKey(key),'private','version-1','other-studio'),false);
 assert.equal(access.validGuestInvite(await store.resolveGuestInviteKey(key),'private','revoked','studio-default'),false);
 assert.equal(await store.resolveGuestInviteKey(key.slice(0,31)+'!'),'');
 assert.equal(await store.resolveGuestInviteKey('A'.repeat(32)),'');
 const raw=fs.readFileSync(path.join(dir,'runtime','castlink-guest-invite-keys.json'),'utf8');assert.ok(!raw.includes(key),'store indexes keys by hash');
 const realNow=Date.now;Date.now=()=>realNow()+61000;try{assert.equal(await store.resolveGuestInviteKey(key),'','opaque lookup honors signed expiry');}finally{Date.now=realNow;}
 console.log('PASS: random 32-character invite keys preserve signed scope, expiry, revocation and legacy compatibility');
 }finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
