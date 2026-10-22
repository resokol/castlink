'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
(async()=>{
 const file=require('node:path').join(__dirname,'../lib/co-presentation-helper-client.ts');assert.ok(fs.existsSync(file),'browser helper client exists');
 let requests=[],polls=0,result;
 const fetch=async(url,init)=>{assert.equal(url,'/api/co-presentation-helper');assert.equal(init.redirect,'error');const body=JSON.parse(init.body);requests.push(body);if(body.action==='state')return Response.json({connected:polls>0});if(body.action==='pair')return Response.json({code:'cp2_code',expiresAt:Date.now()+120000});if(body.action==='request'){result=body;return Response.json({operationId:'operation',done:false})}if(body.action==='result'){polls++;return Response.json({done:true,result:result.method==='prepare'?{preparedId:'opaque',name:'Deck.pptx'}:{id:'native',name:'Deck.pptx',page:1,pages:2}})}return Response.json({connected:false})};
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:()=>({}),fetch,crypto,AbortController,setTimeout,clearTimeout,Date,Promise});
 const bridge=module.exports.createHelperPowerPointBridge({token:'owner',studioId:'studio',room:'room'});assert.equal(bridge.version,2);
 assert.equal((await bridge.connection()).connected,false);
 assert.ok((await bridge.pair()).code);
 assert.equal((await bridge.prepare()).preparedId,'opaque');
 assert.equal((await bridge.connection()).connected,true);
 await assert.rejects(bridge.goTo({id:'native',page:2}));assert.equal(requests.filter(r=>r.method==='goTo').length,0);
 bridge.dispose();await assert.rejects(bridge.prepare());
 console.log('PASS virtual browser bridge actual connection, fixed RPC, opaque prepare, no legacy page transport and disposed work rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
