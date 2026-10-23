'use strict';
const assert=require('node:assert/strict');
const {test}=require('node:test');
const {load}=require('../../web/tests/load-typescript.cjs');
const wire=load('../lib/remote-pc-protocol.ts');
const {createInputGate,canonical,validEvent}=require('../src/remote-pc-input-gate.cjs');
const key=Buffer.alloc(32,7).toString('base64url');
const unsigned=(event,seq=2)=>({v:1,sessionId:'session',generation:'generation',captureId:'capture',grantId:'grant',revision:1,geometryRevision:1,lane:event.type==='move'?'move':'reliable',seq,expiresAt:20500,moveBarrier:0,event});
const empty={type:'heartbeat',pressedKeys:[],pressedButtons:[]};

test('actual browser signatures and native gate agree across typed input and key order',async()=>{
 for(const event of [empty,{type:'move',x:65535,y:0},{type:'button',button:0,down:true,x:0,y:65535},{type:'wheel',x:1,y:2,deltaX:0,deltaY:-120},{type:'key',code:'ControlRight',down:true,repeat:false},{type:'text',text:'Тест 中文 🙂'},{type:'releaseAll'}]){
  const delivered=[],released=[];
  const gate=createInputGate({input:value=>delivered.push(value),releaseAll:()=>released.push(true),now:()=>100,wall:()=>10000});
  gate.authorize({sessionId:'session',generation:'generation',captureId:'capture',grantId:'grant',revision:1,geometryRevision:1,controller:{sid:'PA_controller'},inputKey:key,deadline:850,receivedAt:100,serverTime:20000,leaseSerial:1});
  const first=await wire.signRemotePcInput(unsigned(empty,1),key);
  assert.equal(gate.receive({senderSid:'PA_controller',topic:wire.REMOTE_PC_RELIABLE_TOPIC,bytes:Buffer.from(JSON.stringify(first))}),true);
  await gate.settled();delivered.length=0;
  const value=unsigned(event);
  assert.equal(wire.remotePcInputMacPayload(value),canonical(value));
  const frame=await wire.signRemotePcInput(value,key);
  const reordered=Object.fromEntries(Object.entries(frame).reverse());
  assert.equal(gate.receive({senderSid:'PA_controller',topic:value.lane==='move'?wire.REMOTE_PC_MOVE_TOPIC:wire.REMOTE_PC_RELIABLE_TOPIC,bytes:Buffer.from(JSON.stringify(reordered))}),true,event.type);
  await gate.settled();
  if(event.type==='releaseAll'){assert.equal(released.length,1);assert.equal(delivered.length,0);}
  else{assert.equal(delivered.length,1,event.type);assert.deepEqual(delivered[0].event,event);}
 }
});

test('browser and native share the same rejection boundary for unsafe or unknown event shapes',()=>{
 for(const event of [{type:'text',text:'control\u0001'},{type:'text',text:'a'.repeat(257)},{type:'key',code:'ShellCommand',down:true,repeat:false},{type:'heartbeat',pressedKeys:['ShellCommand'],pressedButtons:[]},{type:'heartbeat',pressedKeys:['KeyA','KeyA'],pressedButtons:[]},{type:'button',button:3,down:true,x:1,y:2},{type:'move',x:1,y:2,extra:true}]){
  assert.equal(wire.validRemotePcInput(unsigned(event),false),false,JSON.stringify(event));
  assert.equal(validEvent(event),false,JSON.stringify(event));
 }
});
