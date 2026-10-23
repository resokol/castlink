const assert=require('node:assert/strict'),crypto=require('node:crypto'),{load}=require('./load-typescript.cjs');
const api=load('../lib/remote-pc-protocol.ts');
assert.equal(typeof api.remotePcInputMacPayload,'function','one browser/native canonical input wire is exported');
(async()=>{
 const key=Buffer.alloc(32,7).toString('base64url'),input={v:1,sessionId:'session',generation:'generation',captureId:'capture',grantId:'grant',revision:1,geometryRevision:1,lane:'reliable',seq:1,expiresAt:1700000000750,moveBarrier:2,event:{type:'button',button:0,down:true,x:32768,y:0}};
 const canonical=api.remotePcInputMacPayload(input),expected=crypto.createHmac('sha256',Buffer.from(key,'base64url')).update(canonical).digest('base64url');
 const frame=await api.signRemotePcInput(input,key);assert.equal(frame.mac,expected);assert.equal(await api.verifyRemotePcInput(frame,key),true);assert.equal(await api.verifyRemotePcInput({...frame,event:{...frame.event,x:0}},key),false);
 assert.equal(api.remotePcInputMacPayload({...input,event:{y:0,x:32768,down:true,button:0,type:'button'}}),canonical,'key insertion order does not affect MAC');
 for(const change of [{extra:1},{seq:0},{lane:'move'},{event:{type:'button',button:0,down:true,x:-1,y:0}},{event:{type:'key',code:'shell.exe',down:true,repeat:false}},{event:{type:'text',text:'a'.repeat(257)}}])assert.equal(api.validRemotePcInput({...frame,...change}),false,'reject malformed/unknown bounded input '+JSON.stringify(change));
 assert.equal(api.validRemotePcInput({...frame,event:{type:'heartbeat',pressedKeys:[],pressedButtons:[]}}),true);
 assert.equal(await api.verifyRemotePcInput(frame,Buffer.alloc(32,8).toString('base64url')),false);
 console.log('PASS shared remote-PC canonical HMAC, signed geometry/grant/lanes and strict bounded events');
})().catch(error=>{console.error(error);process.exitCode=1});
