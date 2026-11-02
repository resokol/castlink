'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),crypto=require('node:crypto');
(async()=>{
 const file=require('node:path').join(__dirname,'../lib/co-presentation-helper-client.ts');assert.ok(fs.existsSync(file),'browser helper client exists');
 let requests=[],polls=0,result;
 const fetch=async(url,init)=>{assert.equal(url,'/api/co-presentation-helper');assert.equal(init.redirect,'error');const body=JSON.parse(init.body);requests.push(body);if(body.action==='state')return Response.json({connected:polls>0});if(body.action==='pair')return Response.json({code:'cp2_code',expiresAt:Date.now()+120000});if(body.action==='request'){result=body;return Response.json({operationId:'operation',done:false})}if(body.action==='result'){polls++;return Response.json({done:true,result:result.method==='prepare'?{preparedId:'opaque',name:'Deck.pptx'}:{id:'native',name:'Deck.pptx',page:1,pages:2}})}return Response.json({connected:false})};
 const module={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module,exports:module.exports,require:name=>name.endsWith('session-http-bearer')?require('./load-typescript.cjs').load('../lib/session-http-bearer.ts'):({}),fetch,crypto,URL,AbortController,setTimeout,clearTimeout,Date,Promise});
 const bridge=module.exports.createHelperPowerPointBridge({token:'owner',studioId:'studio',room:'room'});assert.equal(bridge.version,2);
 assert.equal((await bridge.connection()).connected,false);
 assert.ok((await bridge.pair()).code);
 assert.equal((await bridge.prepare()).preparedId,'opaque');
 assert.equal((await bridge.connection()).connected,true);
 await bridge.prepare({kind:'window'});
 assert.deepEqual(requests.filter(r=>r.method==='prepare').at(-1).args,{kind:'window'},'window selection crosses only the typed kind argument');
 const ticket='cp2_'+'a'.repeat(43),launch=module.exports.presentationHelperLaunchUrl('https://castlink.ru',ticket),parsed=new URL(launch);
 assert.equal(parsed.protocol,'castlink-presenter:');assert.equal(parsed.hostname,'connect');assert.equal(parsed.searchParams.get('server'),'https://castlink.ru');assert.equal(parsed.hash,'#'+ticket);assert.equal(parsed.searchParams.has('ticket'),false);
 for(const origin of ['http://castlink.ru','https://user:secret@castlink.ru','https://castlink.ru/path','https://castlink.ru?x=1'])assert.throws(()=>module.exports.presentationHelperLaunchUrl(origin,ticket));
 assert.throws(()=>module.exports.presentationHelperLaunchUrl('https://castlink.ru','invalid'));

 await assert.rejects(bridge.goTo({id:'native',page:2}));assert.equal(requests.filter(r=>r.method==='goTo').length,0);
 bridge.dispose();await assert.rejects(bridge.prepare());
 console.log('PASS virtual browser bridge actual connection, fixed RPC, opaque prepare, no legacy page transport and disposed work rejection');
})().catch(e=>{console.error(e);process.exitCode=1});
