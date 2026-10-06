const assert=require('node:assert/strict'),fs=require('node:fs'),os=require('node:os'),path=require('node:path'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {randomUUID}=require('node:crypto');
const {JsonRoomStoreBackend}=require('../lib/room-store.ts');
const {diagnosticAssociation,deleteDiagnosticRoom,DiagnosticRoomConflict}=require('../lib/media-room-association.ts');
(async()=>{const root=fs.mkdtempSync(path.join(os.tmpdir(),'media-room-'));try{
const store=new JsonRoomStoreBackend(()=>path.join(root,'rooms.json'));
const record=()=>({name:'owned',guestInviteVersion:randomUUID(),viewerAccessVersion:randomUUID(),outputAccessVersion:randomUUID(),diagnosticCreationId:randomUUID(),diagnosticRevision:randomUUID()});
const room=record(),receipt=diagnosticAssociation(room);
await store.update('studio-default',rooms=>[...rooms,room]);
// Replacement occurs before queued conditional deletion. Compare must run inside the store mutation.
await store.update('studio-default',rooms=>rooms.map(x=>x.name==='owned'?record():x));
await assert.rejects(store.update('studio-default',rooms=>deleteDiagnosticRoom(rooms,'owned',receipt)),DiagnosticRoomConflict);
assert.equal((await store.read('studio-default')).length,2);
const replacement=(await store.read('studio-default')).find(x=>x.name==='owned');
await store.update('studio-default',rooms=>deleteDiagnosticRoom(rooms,'owned',diagnosticAssociation(replacement)));
assert.deepEqual(await store.read('studio-default'),[{name:'demo-room'}]);
assert.throws(()=>deleteDiagnosticRoom([room],'owned',receipt),/last room/);
assert.throws(()=>diagnosticAssociation({name:'legacy'}));
console.log('PASS: conditional room deletion preserves replacement, matches only current association, and keeps last-room policy');
}finally{fs.rmSync(root,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});
