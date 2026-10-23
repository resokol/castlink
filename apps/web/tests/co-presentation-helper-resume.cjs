// Retains cancellation coverage from the former helper-resume route on the
// presenter-only, exact-capture native attachment which replaces it.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{load}=require('./load-typescript.cjs');
const source=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes={};
(function visit(node){if(ts.isVariableDeclaration(node)&&['connectNative','captureNativeShare','nativeShareCurrent'].includes(node.name.getText(source)))nodes[node.name.getText(source)]=node.initializer;ts.forEachChild(node,visit)})(source);
const api=load('../lib/co-presentation-native.ts'),deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
function fixture(){
 const captureId='10000000-0000-4000-8000-000000000001',native={id:'native-a',name:'Effects.pptx',pages:3,page:1};
 let screen={trackSid:'screen-a',isMuted:false,track:{mediaStreamTrack:{readyState:'live',castlinkCaptureId:captureId}}};
 const calls=[],errors=[],controls=[];
 const bridge={version:4,connect:()=>assert.fail('never use unbound legacy connect'),connectShared:async value=>{calls.push(['native',value]);return native},step(){},status(){},goTo(){},disconnect:async id=>calls.push(['disconnect',id])};
 const scope={...api,window:{castlinkDesktop:{version:1,powerPoint:bridge}},locale:'en',Track:{Source:{ScreenShare:'screen'}},pendingNativeShare:{current:undefined},autoAttachFailure:{current:undefined},cancelWindowIntent(){scope.pendingNativeShare.current=undefined},controls:{current:{clear(){}}},nativeFault:{current:false},stopNative(){},setController(){},fileRef:{current:{name:'Prepared.pdf'}},getNativeBridge:()=>bridge,connected:true,busy:false,generation:{current:1},epoch:{current:0},flight:{current:false},mounted:{current:true},room:{state:'connected',localParticipant:{identity:'host',sid:'host-sid',getTrackPublication:()=>screen}},text:{failed:'failed'},ownRef:{current:undefined},nativeControl:{current:undefined},request:async body=>{calls.push(['request',body]);return{session:{id:'server-a',generation:'gen-a',controlRevision:0,kind:'powerpoint'}}},createNativePresentationControl:options=>{controls.push(options);return{stop(){}}},updateOwn:value=>scope.ownRef.current=value,failNative(){},closeSession:session=>{if(session)calls.push(['close',session])},setNative(){},setSelectedControls(){},setNativeAttachFailure(){},setControlError(){},setError:value=>{if(value)errors.push(value)},setBusy(){}};
 const compile=name=>vm.runInNewContext(ts.transpileModule('('+nodes[name].getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
 scope.captureNativeShare=compile('captureNativeShare');scope.nativeShareCurrent=compile('nativeShareCurrent');
 return{scope,bridge,native,calls,errors,controls,run:helper=>compile('connectNative')(undefined,false,scope.captureNativeShare(),true,helper),provided:value=>compile('connectNative')({bridge,native:value},false,scope.captureNativeShare()),setScreen:value=>screen=value,getScreen:()=>screen};
}
(async()=>{
 let f=fixture();assert.equal(await f.run(),true);assert.deepEqual(JSON.parse(JSON.stringify(f.calls.find(c=>c[0]==='native')[1])),{captureId:'10000000-0000-4000-8000-000000000001'});assert.equal(f.calls.find(c=>c[0]==='request')[1].navigationMode,'powerpoint-steps-v1','animations never use slide-jump fallback');assert.equal(f.scope.fileRef.current.name,'Prepared.pdf');assert.equal(f.controls[0].current(),true);
 for(const change of ['stop','replacement','mute','newSID','unmount','generation','capture-token']){
  f=fixture();const held=deferred();f.bridge.connectShared=()=>held.promise;const pending=f.run(),screen=f.getScreen();
  if(change==='stop')f.setScreen(undefined);
  if(change==='replacement')f.setScreen({...screen,trackSid:'screen-b',track:{mediaStreamTrack:{readyState:'live',castlinkCaptureId:'10000000-0000-4000-8000-000000000002'}}});
  if(change==='mute')screen.isMuted=true;
  if(change==='newSID')f.scope.room.localParticipant.sid='replacement-sid';
  if(change==='unmount')f.scope.mounted.current=false;
  if(change==='generation')f.scope.generation.current++;
  if(change==='capture-token')screen.track.mediaStreamTrack.castlinkCaptureId='10000000-0000-4000-8000-000000000002';
  held.resolve(f.native);assert.equal(await pending,false,change);assert.equal(f.calls.some(c=>c[0]==='request'),false,'no late server create after '+change);assert.equal(f.calls.some(c=>c[0]==='disconnect'&&c[1]==='native-a'),true,'disconnect exact late native result');assert.equal(f.scope.ownRef.current,undefined);assert.equal(f.scope.fileRef.current.name,'Prepared.pdf');
 }
 f=fixture();const held=deferred(),entered=deferred();f.scope.request=()=>{entered.resolve();return held.promise};const pending=f.run();await entered.promise;f.setScreen({...f.getScreen(),trackSid:'replacement'});held.resolve({session:{id:'late-server',generation:'late-g',kind:'powerpoint'}});assert.equal(await pending,false);assert.ok(f.calls.some(c=>c[0]==='close'&&c[1].id==='late-server'));assert.ok(f.calls.some(c=>c[0]==='disconnect'&&c[1]==='native-a'));
 for(const stage of ['native','native-response','server-create']){
  f=fixture();if(stage==='native')f.bridge.connectShared=async()=>{throw{code:'POWERPOINT_COM_UNAVAILABLE',message:'PRIVATE'}};
  if(stage==='native-response')f.bridge.connectShared=async()=>({id:'bad',name:'Bad',pages:0,page:0});
  if(stage==='server-create')f.scope.request=async()=>{throw{status:503,message:'PRIVATE'}};
  assert.equal(await f.run(),false);assert.ok(f.errors.some(message=>message.includes(stage+':')),stage+' visible safe diagnostic');assert.equal(f.errors.some(message=>message.includes('PRIVATE')),false);assert.ok(f.scope.autoAttachFailure.current,'explicit retry stays available for this exact live share');assert.equal(f.getScreen().track.mediaStreamTrack.readyState,'live','failure retains media');
 }
 for(const mode of ['direct','browser']){f=fixture();const wrong={id:'wrong-window',name:'Document.pdf',kind:'window'};f.bridge.connectShared=async()=>wrong;const helper=mode==='browser'?{...f.bridge,connectBrowser:async()=>wrong}:undefined;assert.equal(await f.run(helper),false,mode+' PowerPoint autoattach rejects a window response');assert.equal(f.calls.some(c=>c[0]==='request'),false,'wrong-kind response creates no server session');assert.ok(f.calls.some(c=>c[0]==='disconnect'&&c[1]==='wrong-window'));assert.ok(f.errors.some(e=>e.includes('native-response:INVALID_RESPONSE')))}
 f=fixture();f.scope.request=async body=>{f.calls.push(['request',body]);return{session:{id:'window',generation:'g',kind:'window'}}};assert.equal(await f.provided({id:'prepared-window',name:'Document.pdf',kind:'window'}),true,'explicitly prepared legacy window control remains available');assert.equal(f.calls.find(c=>c[0]==='request')[1].kind,'window');
 console.log('PASS direct native exact capture/token/SID/generation cancellation, late create revoke, animation steps and safe failure stages without media stop');
})().catch(error=>{console.error(error);process.exitCode=1});
