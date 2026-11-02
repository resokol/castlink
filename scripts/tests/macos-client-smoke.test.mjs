import test from 'node:test';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import https from 'node:https';
import {connectCdp,isPackagedPage,readMacUriHandlers,verifyMacUriRegistration,claimHelperProfile,createUriRejectionFixture} from '../macos-client-smoke.mjs';
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
function directory(t,temporaryRoot=os.tmpdir()){const root=fs.realpathSync(fs.mkdtempSync(path.join(temporaryRoot,'castlink-uri-smoke-test-')));t.after(()=>fs.rmSync(root,{recursive:true,force:true}));return root;}
test('URI registration requires every declaration and native default handler to identify the exact candidate',async t=>{
 const root=directory(t),bundle=path.join(root,'CastLink.app'),alias=path.join(root,'candidate-alias.app');fs.mkdirSync(bundle);fs.symlinkSync(bundle,alias);
 const schemes=['castlink','castlink-remote','castlink-presenter','castlink-share'],calls=[];
 const run=(file,args,options)=>{calls.push({file,args,options});return JSON.stringify(file==='/usr/bin/plutil'?[{CFBundleURLSchemes:schemes}]:Object.fromEntries(schemes.map(scheme=>[scheme,alias])));};
 assert.equal((await verifyMacUriRegistration({bundle,run})).status,'PASS');assert.equal(calls[1].file,'/usr/bin/osascript');assert.match(calls[1].args[3],/URLForApplicationToOpenURL/);
 assert.ok(calls.every(call=>call.options.shell===false&&call.options.timeout===10000&&call.options.killSignal==='SIGKILL'));
 for(const corruption of ['missing','duplicate','wrong-handler'])await assert.rejects(verifyMacUriRegistration({bundle,run:(file)=>{
  if(file==='/usr/bin/plutil')return JSON.stringify([{CFBundleURLSchemes:corruption==='missing'?schemes.slice(1):corruption==='duplicate'?[...schemes,'castlink']:schemes}]);
  return JSON.stringify(Object.fromEntries(schemes.map(scheme=>[scheme,root])));
 }}),/declarations|handler/,corruption);
});
test('URI mapping diagnostics preserve the actual selected path without weakening exact candidate matching',async t=>{
 const root=directory(t),bundle=path.join(root,'Applications/CastLink Client Development.app'),staged=path.join(root,'mac/CastLink Client Development.app');fs.mkdirSync(bundle,{recursive:true});fs.mkdirSync(staged,{recursive:true});
 const schemes=['castlink','castlink-remote','castlink-presenter','castlink-share'];
 const run=file=>JSON.stringify(file==='/usr/bin/plutil'?[{CFBundleURLSchemes:schemes}]:Object.fromEntries(schemes.map(scheme=>[scheme,staged])));
 await assert.rejects(verifyMacUriRegistration({bundle,run}),error=>{
  assert.match(error.message,/does not resolve to this candidate/);const diagnostic=JSON.parse(error.message.slice(error.message.indexOf('{')));
  assert.equal(diagnostic.expectedPath,bundle);assert.equal(diagnostic.actualPath,staged);assert.equal(diagnostic.canonicalActualPath,staged);assert.equal(diagnostic.actualResolved,true);assert.equal(diagnostic.canonicalPathMatches,false);assert.equal(diagnostic.actualBasename,path.basename(staged));assert.ok(error.message.length<2000);return true;
 });
 const missing=await readMacUriHandlers({run:()=>JSON.stringify(Object.fromEntries(schemes.map(scheme=>[scheme,null])))});assert.ok(Object.values(missing).every(value=>value===null));
 await assert.rejects(readMacUriHandlers({run:()=>JSON.stringify({castlink:42})}),/Invalid native URI handler mapping/);
 const original=Error('native mapping query failed');await assert.rejects(readMacUriHandlers({run:()=>{throw original;}}),error=>error===original,'native query failures must not become invented empty mappings');
});
test('URI diagnostics stay canonical when the temporary directory is reached through a symlink alias',async t=>{
 const parent=directory(t),physical=path.join(parent,'physical'),alias=path.join(parent,'temp-alias');fs.mkdirSync(physical);fs.symlinkSync(physical,alias);
 const root=directory(t,alias),aliasRoot=path.join(alias,path.basename(root));assert.equal(root,fs.realpathSync(aliasRoot));assert.notEqual(root,aliasRoot);
 const bundle=path.join(root,'Applications/CastLink.app'),other=path.join(root,'mac/CastLink.app');fs.mkdirSync(bundle,{recursive:true});fs.mkdirSync(other,{recursive:true});
 const aliasBundle=path.join(aliasRoot,'Applications/CastLink.app'),aliasOther=path.join(aliasRoot,'mac/CastLink.app'),schemes=['castlink','castlink-remote','castlink-presenter','castlink-share'];
 const run=selected=>file=>JSON.stringify(file==='/usr/bin/plutil'?[{CFBundleURLSchemes:schemes}]:Object.fromEntries(schemes.map(scheme=>[scheme,selected])));
 assert.equal((await verifyMacUriRegistration({bundle:aliasBundle,run:run(aliasBundle)})).status,'PASS');
 await assert.rejects(verifyMacUriRegistration({bundle:aliasBundle,run:run(aliasOther)}),error=>{
  const diagnostic=JSON.parse(error.message.slice(error.message.indexOf('{')));assert.equal(diagnostic.expectedPath,bundle);assert.equal(diagnostic.actualPath,aliasOther);assert.equal(diagnostic.canonicalActualPath,other);assert.equal(diagnostic.canonicalPathMatches,false);return true;
 });
});
test('helper profiles are claimed only when absent and cleaned only with intact ownership',t=>{
 const root=directory(t),owned=path.join(root,'owned'),cleanup=claimHelperProfile(owned);fs.mkdirSync(path.join(owned,'session'));cleanup();assert.equal(fs.existsSync(owned),false);
 const existing=path.join(root,'existing');fs.mkdirSync(existing);fs.writeFileSync(path.join(existing,'user-data'),'retain');
 assert.throws(()=>claimHelperProfile(existing),/already exists/);assert.equal(fs.readFileSync(path.join(existing,'user-data'),'utf8'),'retain');
 const linked=path.join(root,'linked');fs.symlinkSync(path.join(root,'missing'),linked);assert.throws(()=>claimHelperProfile(linked),/already exists/);assert.equal(fs.lstatSync(linked).isSymbolicLink(),true);
 const changed=path.join(root,'changed'),refuseCleanup=claimHelperProfile(changed);fs.writeFileSync(path.join(changed,'.castlink-packaged-smoke-owner'),'changed');
 assert.throws(refuseCleanup,/ownership changed/);assert.equal(fs.existsSync(changed),true);
});
test('owned TLS fixture rejects exact one-use bootstrap requests and detects any extra authority action',async t=>{
 const fixture=await createUriRejectionFixture({directory:directory(t)});t.after(()=>fixture.close());
 const send=(endpoint,body)=>new Promise((resolve,reject)=>{
  const request=https.request(fixture.origin+endpoint,{method:'POST',ca:fs.readFileSync(fixture.certificate),headers:{'content-type':'application/json'}},response=>{response.resume();response.once('end',()=>resolve(response.statusCode));});
  request.once('error',reject);request.end(JSON.stringify(body));
 });
 for(const scheme of ['castlink-remote','castlink-share','castlink-presenter']){
  const uri=new URL(fixture.arm(scheme)),presenter=scheme==='castlink-presenter';assert.equal(uri.searchParams.get('server'),fixture.origin);
  assert.equal(await send(presenter?'/api/co-presentation-helper':'/api/remote-pc-control',presenter?{action:'pair',code:uri.hash.slice(1)}:{purpose:'remote-pc-v1',action:'pair',ticket:uri.hash.slice(1)}),401);
  assert.equal(fixture.observed(scheme),true);assert.equal(fixture.verify(scheme).rejected,true);assert.equal(fixture.verify(scheme).successfulOperation,'NOT VERIFIED');
 }
 assert.equal(await send('/api/co-presentation-helper',{action:'poll'}),400);
 assert.throws(()=>fixture.verify('castlink-presenter'),/one exact trusted TLS pairing rejection/);
});
