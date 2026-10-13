const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
require.extensions['.ts'] = (m,f) => m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const transfer=require('../lib/server-transfer.ts');
const {transferDestination}=require('../lib/client-transfer.ts');
const snapshot={role:'studio',room:'mine'};
const original=process.env.STUDIOLINK_TRANSFER_TARGETS_JSON;
try {
 const origin='https://192.168.8.12';
 assert.equal(new URL(transferDestination(origin,'ticket',snapshot,undefined,[origin])).origin,origin,'a server-confirmed ordinary self-host origin works');
 assert.throws(()=>transferDestination('https://foreign.example','ticket',snapshot,undefined,[origin]),undefined,'unselected origin is rejected');
 for(const bad of ['https://user:pass@peer.example','https://peer.example/path','https://peer.example/?next=other','https://peer.example/#token','http://peer.example']) {
  process.env.STUDIOLINK_TRANSFER_TARGETS_JSON=JSON.stringify([{id:'peer',label:'Peer',origin:bad}]);
  assert.throws(()=>transfer.transferTargets(),undefined,`server rejects ${bad}`);
 }
 process.env.STUDIOLINK_TRANSFER_TARGETS_JSON=JSON.stringify([{id:'peer',label:'A',origin:'https://a.example'},{id:'peer',label:'B',origin:'https://b.example'}]);
 assert.throws(()=>transfer.transferTargets(),undefined,'ambiguous duplicate target IDs are rejected');
 console.log('PASS: strict configured origins and authenticated self-host browser destination');
}finally{if(original===undefined)delete process.env.STUDIOLINK_TRANSFER_TARGETS_JSON;else process.env.STUDIOLINK_TRANSFER_TARGETS_JSON=original;}
