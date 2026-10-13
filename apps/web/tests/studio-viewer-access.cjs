const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript'), Module = require('node:module');
Module._extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
process.env.CASTLINK_SESSION_SECRET='viewer-test-signing-secret';
const {signAccess,readAccess}=require('../lib/access.ts');
const {studioViewingRoom,studioViewerVersion,verifiedStudioViewerInvite,issueTransferredViewerInvite}=require('../lib/studio-viewer-access.ts');
const room={name:'room',passwordHash:'guest-secret-hash',viewerAccessVersion:'viewer-v1',transferRoomId:'immutable-room'};
const identity='stream-viewer-550e8400-e29b-41d4-a716-446655440000';
const expiresAt=Date.now()+60000;
const value=issueTransferredViewerInvite('studio-default',room,identity,expiresAt);
assert.equal(readAccess(value).exp,expiresAt,'handoff cannot extend original access expiry');
assert.equal(verifiedStudioViewerInvite(value,'studio-default',room).id,identity);
assert.equal(verifiedStudioViewerInvite(value,'another-studio',room),null);
assert.equal(verifiedStudioViewerInvite(value,'studio-default',{...room,name:'another-room'}),null);
assert.equal(verifiedStudioViewerInvite(value,'studio-default',{...room,viewerAccessVersion:'viewer-v2'}),null,'target rotation invalidates transferred invitation');
assert.equal(verifiedStudioViewerInvite(value+'tampered','studio-default',room),null,'real signature is verified');
for (const kind of ['guest','admin','moderator','studio']) {
 const forged=signAccess({kind,studio:'studio-default',room:room.name,version:studioViewerVersion(room),id:identity},60);
 assert.equal(verifiedStudioViewerInvite(forged,'studio-default',room),null,'viewer helper never accepts another role');
}
assert.throws(()=>issueTransferredViewerInvite('studio-default',room,'studio-panel-main',expiresAt));
assert.throws(()=>issueTransferredViewerInvite('studio-default',room,'stream-viewer-fake',expiresAt));
assert.throws(()=>issueTransferredViewerInvite('studio-default',room,identity,Date.now()-1));
assert.equal(verifiedStudioViewerInvite(signAccess({kind:'studio-viewer',room:room.name,version:'viewer-v1'},-1),'studio-default',room),null);
assert.equal(studioViewingRoom('studio-default',room).startsWith('castlink-view-'),true);
assert.notEqual(studioViewingRoom('studio-default',room),studioViewingRoom('another-studio',room));
assert.notEqual(studioViewingRoom('studio-default',room),studioViewingRoom('studio-default',{...room,passwordHash:'changed'}));
assert.notEqual(studioViewingRoom('studio-default',room),room.name);
console.log('PASS: real signed viewer handoff retains expiry, identity, studio/version scope and isolated namespace');
