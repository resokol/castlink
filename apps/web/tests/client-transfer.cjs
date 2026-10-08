const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
 compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { transferDestination, restoreAcceptedTransfer, acceptedTransferPath, saveAcceptedTransfer } = require('../lib/client-transfer.ts');
const origin = 'https://my-reserve.example:8443';
const snapshot = { role: 'guest', room: 'room' };
assert.equal(new URL(transferDestination(origin, 'ticket', snapshot, undefined, [origin])).origin, origin);
for (const invalid of ['https://other.example','http://my-reserve.example','https://user@my-reserve.example','https://my-reserve.example/path','https://my-reserve.example/?next=1','https://my-reserve.example/#next']) {
 assert.throws(() => transferDestination(invalid, 'ticket', snapshot, undefined, [origin]));
}
assert.throws(() => transferDestination(origin, 'ticket', snapshot));
assert.throws(() => transferDestination(origin, 'ticket', snapshot, 'https://other.example', [origin]));
const approvedLan = 'https://192.168.53.68';
assert.equal(new URL(transferDestination(origin, 'ticket', snapshot, approvedLan, [origin, approvedLan])).origin, approvedLan);
const malicious = { role:'studio',room:'room',studioId:'evil',clientId:'evil',identity:'evil',name:'evil',entryPath:'/',settings:{fps:30} };
const accepted = {role:'studio',room:'room',studioId:'trusted',clientId:'verified-id',entryPath:'/'};
const restored = restoreAcceptedTransfer(accepted, malicious);
assert.equal(restored.clientId, 'verified-id');
assert.equal(restored.studioId, 'trusted');
assert.equal(restored.identity, undefined);
assert.equal(restored.name, undefined);
assert.equal(restored.settings.fps, 30);
assert.equal(restoreAcceptedTransfer({...accepted,clientId:undefined}, malicious).clientId, undefined);
assert.equal(new URL(acceptedTransferPath(accepted), 'https://target.example').pathname, '/');
assert.equal(new URL(acceptedTransferPath(accepted), 'https://target.example').searchParams.get('mode'), 'studio');
for(const role of ['guest','admin','moderator']) {
 const value = {...accepted,role};
 assert.equal(restoreAcceptedTransfer(value, malicious).role, role);
 assert.equal(new URL(acceptedTransferPath(value), 'https://target.example').pathname, role==='guest'?'/':`/${role}`);
}
assert.throws(() => restoreAcceptedTransfer({...accepted,role:'owner'}, malicious));
assert.throws(() => restoreAcceptedTransfer({...accepted,room:undefined}, malicious));
const values = new Map();
global.sessionStorage = {setItem:(key,value)=>values.set(key,value),getItem:key=>values.get(key),removeItem:key=>values.delete(key)};
saveAcceptedTransfer(accepted, malicious);
assert.equal(values.get('studiolink-studio-control-client-id:trusted'), 'verified-id');
saveAcceptedTransfer({...accepted,role:'admin'}, malicious);
assert.equal(values.get('castlink-control:trusted:admin:room'), 'verified-id');
console.log('PASS: authenticated origins, verified four-role handoff, root creator route and primary identity storage');
