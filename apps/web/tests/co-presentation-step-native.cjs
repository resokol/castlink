const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/co-presentation-native.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:()=>({}),Error,Number,Date,Map,Set});
const native={id:'local-id',name:'Deck.pptx',pages:3,page:2};
const command={id:'command-1',seq:1,direction:'next',issuedAt:Date.now(),expiresAt:Date.now()+3000,generation:'gen',controlRevision:0};
const session={id:'session',generation:'gen',controlRevision:0,kind:'powerpoint',navigationMode:'powerpoint-steps-v1',pages:3,page:1,renderedPage:1,revision:1,renderedRevision:0,command};
(async()=>{
let effects=0,goTo=0,requests=[],failed=0,temporary=true;
const bridge={version:2,status:async()=>({...native}),step:async r=>{effects++;assert.equal(r.commandId,command.id);return {commandId:r.commandId,status:{...native}};},goTo:async()=>{goTo++;throw Error('must never undo manual input')},disconnect:async()=>{}};
const control=m.exports.createNativePresentationControl({bridge,native,current:()=>true,request:async body=>{requests.push(body);if(temporary)throw Object.assign(Error('network'),{status:503});return {session:{...session,command:undefined}};},changed:()=>{},failed:()=>failed++,unavailable:()=>{}});
await control.tick(session);assert.equal(effects,1);assert.equal(goTo,0);assert.equal(requests[0].action,'step-ack');assert.equal(requests[0].page,2,'report actual owner position, never server expected page');
temporary=false;await control.tick(session);assert.equal(effects,1,'lost acknowledgement never replays a click');assert.equal(requests.at(-1).commandId,command.id);
const after={...session,command:undefined,revision:2,renderedRevision:2,page:1};
await control.tick(after);assert.equal(goTo,0);assert.equal(requests.at(-1).action,'sync');assert.equal(requests.at(-1).page,2);
await control.tick({...session,command:{...command,id:'expired',expiresAt:Date.now()-1}});assert.equal(effects,1);
assert.equal(failed,0);
control.stop();await control.tick(session);assert.equal(effects,1);
console.log('PASS PPTX adapter: same-slide command ACK, owner manual position authoritative, ACK retry without effect replay, expired command and stop');
})().catch(e=>{console.error(e);process.exitCode=1});
