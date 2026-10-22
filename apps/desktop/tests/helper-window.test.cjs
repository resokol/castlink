'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {createHelperSession}=require('../src/presentation-helper.cjs');
test('window preparation stays typed and foreground refusal is recoverable without repeating the operation',async()=>{
 let op,result,calls=0,prepared,confirmation;
 const context={room:'Own room',ownerIdentity:'caster',ownerName:'Presenter'};
 const session=createHelperSession({controller:{prepare:async value=>{prepared=value;return{preparedId:'prepared',name:'PDF',kind:'window'}},start:async()=>({id:'pdf',name:'PDF',kind:'window'}),step:async()=>{calls++;throw Object.assign(Error('foreground'),{code:'WINDOW_SLIDES_FOREGROUND'})},dispose(){}},confirm:async(method,args)=>{confirmation={method,args};return true},post:async body=>{
  if(body.action==='pair')return{token:'ch2_'+'a'.repeat(43),connectionId:'11111111-1111-4111-8111-111111111111',expiresAt:Date.now()+3600000,context};
  if(body.action==='poll')return{operation:op};if(body.action==='result')result=body.result;return{ok:true};
 }});
 assert.deepEqual((await session.pair('cp2_'+'a'.repeat(43))).context,context);
 const run=async(method,args)=>{op={operationId:require('node:crypto').randomUUID(),method,args,expiresAt:Date.now()+2000};await session.poll();await new Promise(r=>setImmediate(r));};
 await run('prepare',{kind:'window'});assert.deepEqual(prepared,{kind:'window'});assert.equal(result.kind,'window');
 await run('start',{preparedId:'prepared'});assert.deepEqual(confirmation,{method:'start',args:{preparedId:'prepared'}});
 await run('step',{id:'pdf',commandId:'next',direction:'next',expiresAt:Date.now()+2000});assert.deepEqual(result,{error:'WINDOW_SLIDES_FOREGROUND'});
 await session.poll();await new Promise(r=>setImmediate(r));assert.equal(calls,1);await session.disconnect();
});
