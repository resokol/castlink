const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),Module=require('node:module');
Module._extensions['.ts']=(mod,file)=>mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {reserveStaffDisplayName:name}=require('../lib/staff-display-name.ts');
(async()=>{
 const names=await Promise.all(Array.from({length:20},(_,index)=>Promise.resolve().then(()=>name('room-a','staff-'+index,'Moderator','',[],1000))));
 assert.equal(new Set(names).size,20,'parallel token requests reserve distinct numbers before LiveKit join');assert.equal(names[0],'Moderator 1');assert.equal(names[19],'Moderator 20');
 assert.equal(name('room-a','staff-0','Moderator','',[],1001),'Moderator 1','retry preserves identity');
 assert.equal(name('room-b','staff-a','Moderator','',[],1001),'Moderator 1','other rooms have their own numbering');
 assert.equal(name('room-a','admin-a','Admin','',[],1001),'Admin 1','other roles have their own numbering');
 assert.equal(name('room-a','staff-new','Moderator','Manual name',[],1001),'Manual name');
 assert.equal(name('room-a','staff-live','Moderator','',[{identity:'staff-live',name:'Existing name'}],1001),'Existing name');
 assert.equal(name('room-a','staff-expired','Moderator','',[{identity:'another',name:'Moderator 1'}],301001),'Moderator 2','expired reservations released, live names respected');
 console.log('PASS: 20 simultaneous staff logins, stable retry, room/role isolation, manual names and expiry');
})().catch(e=>{console.error(e);process.exitCode=1;});
