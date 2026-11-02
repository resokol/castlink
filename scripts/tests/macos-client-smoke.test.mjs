import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {connectCdp,isPackagedPage} from '../macos-client-smoke.mjs';
class FakeSocket extends EventTarget{
 static instances=[];
 constructor(url){super();this.url=String(url);this.sent=[];this.closed=false;FakeSocket.instances.push(this);queueMicrotask(()=>this.dispatchEvent(new Event('open')));}
 send(value){this.sent.push(JSON.parse(value));}
 reply(value){this.dispatchEvent(new MessageEvent('message',{data:JSON.stringify(value)}));}
 close(){if(!this.closed){this.closed=true;this.dispatchEvent(new Event('close'));}}
}
const target={webSocketDebuggerUrl:'ws://127.0.0.1:9222/devtools/page/owned-page'};
async function session(t,{timeoutMs=500}={}){
 const client=await connectCdp(target,9222,{WebSocketImpl:FakeSocket,timeoutMs});t.after(()=>client.close());return {client,socket:FakeSocket.instances.at(-1)};
}
test('CDP requests use distinct IDs and resolve out of order without matching events',async t=>{
 const {client,socket}=await session(t),first=client.request('Page.enable'),second=client.request('Runtime.enable');
 assert.deepEqual(socket.sent.map(value=>value.id),[1,2]);socket.reply({method:'Runtime.executionContextCreated',params:{}});
 socket.reply({id:2,result:{second:true}});socket.reply({id:1,result:{first:true}});
 assert.deepEqual(await first,{first:true});assert.deepEqual(await second,{second:true});
});
test('renderer evaluations await promises and reject JavaScript exceptions',async t=>{
 const {client,socket}=await session(t),value=client.evaluate('Promise.resolve(42)');
 const command=socket.sent.at(-1);assert.equal(command.method,'Runtime.evaluate');
 assert.equal(command.params.awaitPromise,true);assert.equal(command.params.returnByValue,true);
 socket.reply({id:command.id,result:{result:{value:42}}});assert.equal(await value,42);
 const failure=client.evaluate('missing()');socket.reply({id:socket.sent.at(-1).id,result:{exceptionDetails:{text:'ReferenceError'}}});
 await assert.rejects(failure,/Renderer evaluation failed/);
});
test('CDP command failures, socket closure and malformed output reject pending work',async t=>{
 for(const failure of ['command','closed','malformed','null']){
  const {client,socket}=await session(t),pending=client.request('Page.enable');
  if(failure==='command')socket.reply({id:socket.sent.at(-1).id,error:{message:'denied'}});
  if(failure==='closed')socket.close();
  if(failure==='malformed')socket.dispatchEvent(new MessageEvent('message',{data:'invalid json'}));
  if(failure==='null')socket.reply(null);
  await assert.rejects(pending,/Debugger command failed|Debugger closed|Malformed debugger response/);
 }
});
test('an unanswered CDP request times out and a late reply cannot resolve it',async t=>{
 const {client,socket}=await session(t,{timeoutMs:25});
 await assert.rejects(client.request('Page.enable'),/Debugger command timeout/);
 socket.reply({id:1,result:{late:true}});const next=client.request('Runtime.enable');
 assert.equal(socket.sent.at(-1).id,2);socket.reply({id:2,result:{ok:true}});assert.deepEqual(await next,{ok:true});
});
test('debugger connections reject endpoints outside the owned loopback port',async()=>{
 for(const url of ['ws://example.com:9222/devtools/page/x','ws://127.0.0.1:9333/devtools/page/x','wss://127.0.0.1:9222/devtools/page/x','ws://user:password@127.0.0.1:9222/devtools/page/x'])await assert.rejects(connectCdp({webSocketDebuggerUrl:url},9222,{WebSocketImpl:FakeSocket}),/Unexpected debugger endpoint/);
});
test('target matching requires the exact local UI inside the candidate bundle',()=>{
 const bundle='/tmp/CastLink Client.app',url=pathToFileURL(bundle+'/Contents/Resources/app.asar/ui/macos-setup.html').href;
 assert.equal(isPackagedPage({type:'page',url},bundle,'macos-setup.html'),true);
 for(const change of [{type:'worker',url},{type:'page',url:url+'?other'},{type:'page',url:url.replace('/tmp/','/other/')},{type:'page',url:'https://example.com/ui/macos-setup.html'},{type:'page',url:'invalid'}])assert.equal(isPackagedPage(change,bundle,'macos-setup.html'),false);
});
