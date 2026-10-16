const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),Module=require('node:module'),ts=require('typescript');
Module._extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-entry-store-'));process.env.STUDIOLINK_DATA_DIR=dir;
const {readGuestEntrySettings,saveGuestEntrySettings}=require('../lib/guest-entry-store.ts');
(async()=>{
 const first={name:'first',guestInviteVersion:'same-empty-password-version'},second={name:'second',guestInviteVersion:'same-empty-password-version'};
 const restricted={noGuestAudio:true,startMuted:true,audioOnly:true},normal={noGuestAudio:false,startMuted:false,audioOnly:false};
 await Promise.all([saveGuestEntrySettings('studio-default',first,restricted),saveGuestEntrySettings('studio-default',second,normal)]);
 assert.deepEqual(await readGuestEntrySettings('studio-default',first),restricted);assert.deepEqual(await readGuestEntrySettings('studio-default',second),normal);
 assert.deepEqual(await readGuestEntrySettings('other-studio',first),normal);
 await saveGuestEntrySettings('studio-default',{name:'old',creatorAccessId:'creator-1'},restricted);
 assert.deepEqual(await readGuestEntrySettings('studio-default',{name:'renamed',creatorAccessId:'creator-1'}),restricted,'immutable creator preserves defaults across rename');
 assert.deepEqual(await readGuestEntrySettings('studio-default',{name:'old',creatorAccessId:'creator-2'}),normal,'recreated room does not inherit defaults');
 await saveGuestEntrySettings('studio-default',{name:'legacy',transferRoomId:'immutable',guestInviteVersion:'old'},restricted);
 assert.deepEqual(await readGuestEntrySettings('studio-default',{name:'renamed',transferRoomId:'immutable',guestInviteVersion:'new',passwordHash:'changed'}),restricted,'transfer identity survives invite/password rotation and rename');
 assert.deepEqual(await readGuestEntrySettings('studio-default',{name:'legacy',transferRoomId:'recreated',guestInviteVersion:'old'}),normal,'legacy recreation cannot inherit old defaults');
 console.log('GUEST_ENTRY_STORE_ROOM_ISOLATION_PASS');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>fs.rmSync(dir,{recursive:true,force:true}));
