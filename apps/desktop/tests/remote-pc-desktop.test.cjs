'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),{EventEmitter}=require('node:events');
const file=path.join(__dirname,'../src/remote-pc-desktop.cjs');
test('built-in host binds only the existing selected capture',()=>assert.ok(fs.existsSync(file),'built-in host missing'));
if(fs.existsSync(file)){
 const {createRemotePcDesktop}=require(file);
 function fixture(options={}){
  const handlers=new Map(),calls=[],sessions=[],wc=new EventEmitter();wc.mainFrame={url:'https://castlink.test/room'};wc.send=(...args)=>calls.push(['send',...args]);
  const client={isDestroyed:()=>false,webContents:wc},event={sender:wc,senderFrame:wc.mainFrame};let shared={id:'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee',ready:true,name:'Selected',target:{kind:'window',hwnd:'123'}};
  const host=createRemotePcDesktop({client,ipcMain:{handle:(n,f)=>handlers.set(n,f),removeHandler:n=>handlers.delete(n)},trustedOrigins:new Set(['https://castlink.test']),resourcesPath:'/absent',supported:()=>true,getSharedSource:()=>shared,post:async()=>{},schedule:()=>({unref(){}}),cancel(){},createSession:args=>{
   const s={args,pair:async()=>({context:{sessionId:'s',generation:'g',owner:{identity:'owner',sid:'PA_o'}}}),captured:async v=>calls.push(['captured',v]),published:async v=>calls.push(['published',v]),lease:async()=>{},stop:async()=>calls.push(['stop',sessions.indexOf(s)]),geometry:async v=>calls.push(['geometry',v]),observedState:async()=>{},receive:v=>{calls.push(['receive',v]);return true;}};sessions.push(s);return s;
  },createInput:()=>({bind:async v=>calls.push(['bind',v]),geometry:async()=>({geometry:{revision:1},ready:true,pointerReady:true}),releaseAll:async()=>calls.push(['release']),retireAuthority:async()=>calls.push(['retire-authority']),stop:async()=>calls.push(['stop-capture-input'])}),...options});
  host.selectCapture(shared);
  const invoke=(method,v,e=event)=>handlers.get('castlink:remote-control-'+method)(e,v);
  const value={ticket:'rp1_'+'x'.repeat(43),captureId:shared.id,ownerSid:'PA_o',videoTrackSid:'TR_v',audioTrackSid:'TR_a',width:800,height:600};
  return{host,event,wc,invoke,value,calls,sessions,replace:v=>shared=v};
 }
 test('attach keeps target and credentials in main and publishes existing owner tracks',async()=>{
  const f=fixture();const result=await f.invoke('attach',f.value);assert.deepEqual(result,{captureId:f.value.captureId,sessionId:'s',generation:'g'});
  assert.equal(f.sessions[0].args.publicationMode,'client-owned');assert.deepEqual(f.calls.find(v=>v[0]==='published')[1],{captureId:f.value.captureId,helperSid:'PA_o',videoTrackSid:'TR_v',audioTrackSid:'TR_a'});
  assert.equal(f.calls.find(v=>v[0]==='captured')[1].target.hwnd,'123');assert.equal(JSON.stringify(result).includes('123'),false);
  await f.invoke('stop',{captureId:f.value.captureId,sessionId:'s',generation:'g',reason:'finish'});assert.equal(f.calls.filter(v=>v[0]==='stop').length,1);f.host.dispose();
 });
 test('untrusted frame, extra target, stale capture, oversized data denied before session work',async()=>{
  const f=fixture();for(const [v,e] of [[f.value,{...f.event,senderFrame:{url:f.wc.mainFrame.url}}],[{...f.value,target:{hwnd:'2'}},f.event],[{...f.value,captureId:'bbbbbbbb-bbbb-4ccc-8ddd-eeeeeeeeeeee'},f.event]])await assert.rejects(async()=>f.invoke('attach',v,e),/Denied/);
  assert.equal(f.sessions.length,0);await f.invoke('attach',f.value);await assert.rejects(async()=>f.invoke('receive',{captureId:f.value.captureId,senderSid:'PA_c',topic:'castlink.remote-pc.input.v1',bytes:new Uint8Array(8193)}),/Denied/);f.host.dispose();
 });
 test('identical geometry polling preserves gate; old cleanup cannot stop replacement',async()=>{
  const f=fixture();await f.invoke('attach',f.value);await f.invoke('geometry',{captureId:f.value.captureId,width:800,height:600});assert.equal(f.calls.some(v=>v[0]==='geometry'),false);
  await f.invoke('attach',{...f.value,ticket:'rp1_'+'y'.repeat(43)});await assert.rejects(async()=>f.invoke('stop',{captureId:f.value.captureId,sessionId:'old',generation:'old',reason:'finish'}),/Denied/);assert.equal(f.calls.filter(v=>v[0]==='stop').length,1);f.host.dispose();
 });
 test('pending pair cannot revive after navigation',async()=>{
  let resolve;const f=fixture({createSession:()=>({pair:()=>new Promise(r=>resolve=r),stop:async()=>{},captured:async()=>assert.fail('late capture'),published:async()=>assert.fail('late publish')})});const attach=f.invoke('attach',f.value);await new Promise(setImmediate);f.host.reset();resolve({context:{sessionId:'s',generation:'g',owner:{identity:'owner',sid:'PA_o'}}});await assert.rejects(attach,/stale/i);f.host.dispose();
 });
 test('toolbar intents reject replaced scopes, expired requests, and foreign participant SID',async()=>{
  let callback,clock=1000;const f=fixture({now:()=>clock,toolbar:{updateRemoteControl:(_v,cb)=>callback=cb,clearRemoteControl(){}}});await f.invoke('attach',f.value);
  const snapshot={captureId:f.value.captureId,sessionId:'s',generation:'g',revision:1,sequence:1,expiresAt:2000,locale:'ru',status:'ready',busy:false,participants:[{identity:'guest',sid:'PA_c',name:'<b>Гость</b>'}],requests:[{id:'req',requester:{identity:'guest',sid:'PA_c',name:'Guest'},expiresAt:1500}]};await f.invoke('updateToolbar',snapshot);
  const base={captureId:f.value.captureId,sessionId:'s',generation:'g',revision:1,sequence:1,action:'decide-request',requestId:'req',decision:'approve'};
  assert.equal(callback(base),true);assert.equal(callback({...base,generation:'stale'}),false);assert.equal(callback({...base,action:'delegate',participant:{identity:'guest',sid:'PA_wrong'}}),false);
  clock=1501;assert.equal(callback(base),false);clock=2001;assert.equal(callback({...base,action:'revoke'}),false);f.host.dispose();
 });
 test('capability checks fixed resource version without spawning native process',()=>{
  const os=require('node:os'),{nativeResourceAvailable,RESOURCE}=require(file);const root=fs.mkdtempSync(path.join(os.tmpdir(),'native-cap-'));fs.mkdirSync(path.join(root,'remote-input'));const exe=path.join(root,'remote-input/CastLink.RemoteInput.exe');try{fs.writeFileSync(exe,'old executable');assert.equal(nativeResourceAvailable(root,'win32'),false);fs.writeFileSync(exe,Buffer.from(RESOURCE,'utf16le'));assert.equal(nativeResourceAvailable(root,'win32'),true);assert.equal(nativeResourceAvailable(root,'linux'),false);}finally{fs.rmSync(root,{recursive:true,force:true});}
 });
 test('source switch during native capture registration cannot publish old tracks',async()=>{
  let resolve,captured=false;const f=fixture({createSession:()=>({pair:async()=>({context:{sessionId:'s',generation:'g',owner:{identity:'owner',sid:'PA_o'}}}),captured:()=>{captured=true;return new Promise(r=>resolve=r);},published:async()=>assert.fail('stale publication'),stop:async()=>{}})});
  const pending=f.invoke('attach',f.value);await new Promise(setImmediate);assert.equal(captured,true);f.replace({id:'new-capture',ready:true,target:{kind:'window',hwnd:'456'}});resolve();await assert.rejects(pending,/Stale/);f.host.dispose();
 });
 test('picker binds dormant target once; finish retires authority and fresh attach retains source',async()=>{
  const f=fixture();await new Promise(setImmediate);assert.equal(f.calls.filter(c=>c[0]==='bind').length,1);assert.equal(f.calls.some(c=>c[0]==='published'),false);
  await f.invoke('attach',f.value);await f.invoke('stop',{captureId:f.value.captureId,sessionId:'s',generation:'g',reason:'finish'});assert.equal(f.calls.some(c=>c[0]==='stop-capture-input'),false);
  await f.invoke('attach',f.value);assert.equal(f.calls.filter(c=>c[0]==='bind').length,1,'never rebind HWND after capture selection');await f.host.releaseCapture(f.value.captureId);assert.equal(f.calls.filter(c=>c[0]==='stop-capture-input').length,1);f.host.dispose();
 });
 test('real client-owned session finish retains dormant native process and terminal loss forbids rebind',async()=>{
  const effects=[];let onState;
  const f=fixture({createSession:require('../src/remote-pc-session.cjs').createRemoteSession,post:async body=>body.action==='pair'?{nativeId:'native',nativeToken:'rn1_'+'a'.repeat(43),expiresAt:Date.now()+3600000,serverTime:Date.now(),context:{purpose:'remote-pc-v1',mode:'client-owned',sessionId:'s',generation:'g',owner:{identity:'owner',sid:'PA_o'}}}:{},createInput:options=>{onState=options.onState;return {bind:async()=>effects.push('bind'),geometry:async()=>({geometry:{revision:2},ready:true,pointerReady:true}),releaseAll:async()=>effects.push('release'),retireAuthority:async()=>effects.push('retire'),stop:async()=>effects.push('stop')};}});
  await f.invoke('attach',f.value);await f.invoke('stop',{captureId:f.value.captureId,sessionId:'s',generation:'g',reason:'finish'});assert.ok(effects.includes('retire'));assert.equal(effects.includes('stop'),false);
  await f.invoke('attach',f.value);onState({stopped:true});await new Promise(setImmediate);await assert.rejects(f.invoke('attach',f.value),/Native unavailable/);assert.equal(effects.filter(v=>v==='bind').length,1);assert.equal(f.invoke('capabilities').supported,false);await f.host.releaseCapture(f.value.captureId);f.host.dispose();
 });
 test('late unpaired cleanup cannot clear newer native toolbar scope',async()=>{
  let firstResolve,count=0,shown;const f=fixture({toolbar:{updateRemoteControl:v=>shown=v,clearRemoteControl:scope=>{if(!scope||shown&&scope.generation===shown.generation)shown=undefined;}},createSession:()=>{const n=++count;return{pair:()=>n===1?new Promise(r=>firstResolve=r):Promise.resolve({context:{sessionId:'new',generation:'new',owner:{identity:'owner',sid:'PA_o'}}}),captured:async()=>{},published:async()=>{},lease:async()=>{},stop:async()=>{}};}});
  const old=f.invoke('attach',f.value);await new Promise(setImmediate);await f.invoke('attach',f.value);const snapshot={captureId:f.value.captureId,sessionId:'new',generation:'new',revision:1,sequence:1,expiresAt:Date.now()+10000,locale:'en',participants:[],requests:[],status:'ready',busy:false};await f.invoke('updateToolbar',snapshot);
  firstResolve({context:{sessionId:'old',generation:'old',owner:{identity:'owner',sid:'PA_o'}}});await assert.rejects(old,/Stale/);assert.equal(shown?.generation,'new');f.host.dispose();
 });
 test('oversized owner and publication SIDs reject before pair or additional native work',async()=>{
  const f=fixture();try{await new Promise(setImmediate);const baseline=f.calls.length;
   for(const field of ['ownerSid','videoTrackSid','audioTrackSid']){const prefix=field==='ownerSid'?'PA_':'TR_';await assert.rejects(f.invoke('attach',{...f.value,[field]:prefix+'a'.repeat(254)}),/Denied/);}
   assert.equal(f.sessions.length,0,'invalid SID must not create/pair a control registration');assert.equal(f.calls.length,baseline,'invalid IPC must not touch dormant native binding');
  }finally{f.host.dispose();}
 });
 test('oversized sender SID rejects before input gate forwarding',async()=>{
  const f=fixture();try{await f.invoke('attach',f.value);const baseline=f.calls.length;assert.throws(()=>f.invoke('receive',{captureId:f.value.captureId,senderSid:'PA_'+'a'.repeat(254),topic:'castlink.remote-pc.input.v1',bytes:new Uint8Array(1)}),/Denied/);assert.equal(f.calls.length,baseline);}finally{f.host.dispose();}
 });
 test('toolbar SID bounds reject roster, controller and requester before clone or native toolbar effects',async()=>{
  let painted=0;const f=fixture({toolbar:{updateRemoteControl:()=>painted++,clearRemoteControl(){}}});await f.invoke('attach',f.value);
  const person={identity:'guest',sid:'PA_'+'a'.repeat(253),name:'Guest'},oversized={...person,sid:person.sid+'a'};
  const snapshot={captureId:f.value.captureId,sessionId:'s',generation:'g',revision:1,sequence:1,expiresAt:Date.now()+10000,locale:'en',participants:[person],controller:person,requests:[{id:'req',requester:person,expiresAt:Date.now()+10000}],status:'ready',busy:false};
  const clone=global.structuredClone;let clones=0;global.structuredClone=value=>{clones++;return clone(value);};
  try{for(const value of [{...snapshot,participants:[oversized]},{...snapshot,controller:oversized},{...snapshot,requests:[{...snapshot.requests[0],requester:oversized}]}])assert.throws(()=>f.invoke('updateToolbar',value),/Denied/);
   assert.equal(clones,0);assert.equal(painted,0);assert.equal(f.invoke('updateToolbar',snapshot),true,'256-character participant SID remains compatible');assert.equal(clones,1);assert.equal(painted,1);
  }finally{global.structuredClone=clone;f.host.dispose();}
 });
 test('256-character owner, publication and sender SIDs remain valid at IPC boundary',async()=>{
  const maxSid='PA_'+'a'.repeat(253),maxTrack='TR_'+'a'.repeat(253);let publication,received;
  const f=fixture({createSession:()=>({pair:async()=>({context:{sessionId:'s',generation:'g',owner:{identity:'owner',sid:maxSid}}}),captured:async()=>{},published:async value=>publication=value,lease:async()=>{},stop:async()=>{},receive:value=>{received=value;return true;}})});
  try{await f.invoke('attach',{...f.value,ownerSid:maxSid,videoTrackSid:maxTrack,audioTrackSid:maxTrack});assert.equal(publication.helperSid,maxSid);assert.equal(publication.videoTrackSid,maxTrack);assert.equal(publication.audioTrackSid,maxTrack);assert.equal(f.invoke('receive',{captureId:f.value.captureId,senderSid:maxSid,topic:'castlink.remote-pc.input.v1',bytes:new Uint8Array(1)}),true);assert.equal(received.senderSid,maxSid);}finally{f.host.dispose();}
 });
}
