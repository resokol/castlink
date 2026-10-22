const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript'),{load}=require('./load-typescript.cjs');
const source=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let prepare;const shareNodes={};
(function visit(node){if(ts.isVariableDeclaration(node)&&node.name.getText(source)==='preparePptx')prepare=node.initializer;if(ts.isVariableDeclaration(node)&&['captureNativeShare','nativeShareCurrent'].includes(node.name.getText(source)))shareNodes[node.name.getText(source)]=node.initializer;ts.forEachChild(node,visit);})(source);
const native=load('../lib/co-presentation-native.ts'),noop=()=>{},deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
function scenario(){
 let screen={trackSid:'shared-A',isMuted:false,track:{mediaStreamTrack:{readyState:'live'}}};
 const calls=[],intent={identity:'controller',sid:'controller-sid',localSid:'host-sid',token:'jwt-in-memory',share:{trackSid:screen.trackSid,track:screen.track,localSid:'host-sid'}},session={id:'window',generation:'g',controlRevision:1,kind:'window'};
 const context={Track:{Source:{ScreenShare:'screen'}},pendingNativeShare:{current:undefined},connected:true,nativeBusy:false,busy:false,screenSharing:true,window:{location:{origin:'https://castlink.invalid',assign:url=>calls.push(['launch',new URL(url).protocol])}},launchPresentationHelper:(host,ticket)=>calls.push(['launch',new URL(load('../lib/co-presentation-helper-client.ts').presentationHelperLaunchUrl(host.location.origin,ticket)).protocol]),powerPointBridge:()=>undefined,getNativeBridge:()=>bridge,windowText:{upgrade:'upgrade'},text:{failed:'failed'},nativeText:{helperRequired:'helper',helperMissing:'missing'},pendingHelper:{current:undefined},requestedKind:{current:undefined},windowIntent:{current:intent},nativeFlight:{current:false},flight:{current:false},generation:{current:1},mounted:{current:true},helperRef:{current:undefined},nativeControl:{current:undefined},room:{state:'connected',localParticipant:{sid:'host-sid',getTrackPublication:()=>screen},remoteParticipants:new Map([['controller',{identity:'controller',sid:'controller-sid'}]])},token:'jwt-in-memory',ownRef:{current:undefined},...native};
 for(const name of ['setNativeBusy','setError','setCapturePending','setHelperPair','setPrepared'])context[name]=value=>calls.push([name,value]);
 context.cancelWindowIntent=()=>{context.windowIntent.current=undefined;calls.push(['cancel']);};
 context.binding=s=>({id:s.id,generation:s.generation,controlRevision:s.controlRevision});
 context.connectNative=async v=>{calls.push(['connectNative',v.native]);if(v.current?.()===false)return false;context.ownRef.current=session;return true;};
 context.request=async body=>{calls.push(['request',body]);return{session:{...session,controller:{identity:'controller',sid:'controller-sid'}}};};
 context.updateOwn=s=>{context.ownRef.current=s;calls.push(['own',s]);};
 context.stopNative=()=>calls.push(['stopNative']);context.closeSession=s=>calls.push(['close',s]);
 const bridge={version:3,prepare:async options=>{calls.push(['prepare',options]);return{preparedId:'p',name:'Document.pdf',kind:'window'}},start:async value=>{calls.push(['start',value]);return{id:'native',name:'Document.pdf',kind:'window'}},disconnect:async id=>calls.push(['disconnect',id])};
 for(const name of Object.keys(shareNodes))context[name]=vm.runInNewContext(ts.transpileModule('('+shareNodes[name].getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 const run=vm.runInNewContext(ts.transpileModule('('+prepare.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
 return{context,bridge,calls,run,getScreen:()=>screen,setScreen:value=>{screen=value}};
}
(async()=>{
 let t=scenario();await t.run('window');assert.equal(t.calls.filter(x=>x[0]==='start').length,1);assert.equal(t.calls.filter(x=>x[0]==='request'&&x[1].action==='delegate').length,1,'pending selection completes after local consent, no second browser click');assert.equal(t.context.windowIntent.current,undefined);assert.equal(t.calls.find(x=>x[0]==='request')[1].controllerSid,'controller-sid','pending choice carries exact expected controller SID to server');
 t=scenario();t.context.request=async()=>({session:{id:'window',kind:'window',controller:{identity:'controller',sid:'replacement-sid'}}});await t.run('window');assert.equal(t.calls.some(x=>x[0]==='close'),true,'replacement controller in an unexpected response is revoked, never accepted');
 t=scenario();let wait=deferred();t.bridge.prepare=()=>wait.promise;let pending=t.run('window');t.context.room.localParticipant.sid='new-host-sid';wait.resolve({preparedId:'p',kind:'window',name:'D.pdf'});await pending;assert.equal(t.calls.some(x=>x[0]==='start'),false,'rejoined host cannot use old intent');
 t=scenario();wait=deferred();t.bridge.prepare=()=>wait.promise;pending=t.run('window');t.context.room.remoteParticipants.get('controller').sid='new-controller-sid';wait.resolve({preparedId:'p',kind:'window',name:'D.pdf'});await pending;assert.equal(t.calls.some(x=>x[0]==='start'),false,'rejoined controller cannot inherit pending choice');
 t=scenario();wait=deferred();let entered=deferred();t.bridge.start=()=>{entered.resolve();return wait.promise;};pending=t.run('window');await entered.promise;t.context.cancelWindowIntent();wait.resolve({id:'native',kind:'window',name:'D.pdf'});await pending;assert.equal(t.calls.some(x=>x[0]==='disconnect'),true);assert.equal(t.calls.some(x=>x[0]==='connectNative'),false,'canceled consent never creates/grants');
 t=scenario();wait=deferred();entered=deferred();t.context.request=()=>{entered.resolve();return wait.promise;};pending=t.run('window');await entered.promise;t.context.cancelWindowIntent();wait.resolve({session:{id:'window',generation:'g',controlRevision:2,kind:'window'}});await pending;assert.equal(t.calls.some(x=>x[0]==='close'),true,'late grant ack after cancellation revokes exact created session');assert.equal(t.calls.some(x=>x[0]==='stopNative'),true);
 t=scenario();wait=deferred();entered=deferred();t.context.request=()=>{entered.resolve();return wait.promise;};pending=t.run('window');await entered.promise;t.context.cancelWindowIntent();wait.resolve(Promise.reject(Object.assign(new Error('lost delegate reply'),{status:503})));await pending;assert.equal(t.calls.some(x=>x[0]==='close'),true,'ambiguous delegate failure after cancellation closes known created session');assert.equal(t.calls.some(x=>x[0]==='stopNative'),true,'uncertain canceled effect disconnects native controls');
 t=scenario();t.bridge.prepare=async()=>({preparedId:'p',name:'Wrong.pptx'});await t.run('window');assert.equal(t.calls.some(x=>x[0]==='start'||x[0]==='setPrepared'),false,'wrong-kind old native response never starts PPTX');assert.equal(t.calls.some(x=>x[0]==='setError'&&x[1]==='failed'),true);
 t=scenario();t.context.powerPointBridge=()=>({version:2});t.bridge.version=2;await t.run('window');assert.equal(t.calls.some(x=>x[0]==='prepare'),false,'old desktop capability is refused before picker');
 t=scenario();t.bridge.connection=async()=>({connected:false});let pairs=0;t.bridge.pair=async()=>{pairs++;return{code:'cp2_'+'x'.repeat(43),expiresAt:Date.now()+120000}};t.context.helperRef.current=t.bridge;await t.run('window');assert.equal(pairs,1);assert.equal(t.calls.filter(x=>x[0]==='launch').length,1,'initial presentation click automatically launches client exactly once');assert.equal(t.calls.find(x=>x[0]==='launch')[1],'castlink-presenter:');
 t=scenario();t.bridge.connection=async()=>({connected:false});t.bridge.pair=async()=>{throw Error('automatic resume must not create a fresh ticket')};t.context.helperRef.current=t.bridge;await t.run('window',true);assert.equal(t.calls.some(x=>x[0]==='launch'||x[0]==='start'),false,'lost pair resume cannot relaunch/reexecute');assert.equal(t.calls.some(x=>x[0]==='setError'&&x[1]==='missing'),true);
 for(const change of ['stop','replacement','mute']) {
  t=scenario();wait=deferred();t.bridge.prepare=()=>wait.promise;
  const screen=t.getScreen();
  pending=t.run('window');
  t.setScreen(change==='stop'?undefined:change==='replacement'?{trackSid:'shared-B',isMuted:false,track:{mediaStreamTrack:{readyState:'live'}}}:{...screen,isMuted:true});
  wait.resolve({preparedId:'p',kind:'window',name:'D.pdf'});await pending;
  assert.equal(t.calls.some(x=>x[0]==='start'),false,'pending picker '+change+' cannot start native navigation or inherit a later share');
  assert.equal(t.calls.some(x=>x[0]==='request'),false);
 }
 for(const stage of ['start','delegate']) {
  t=scenario();wait=deferred();entered=deferred();
  if(stage==='start')t.bridge.start=()=>{entered.resolve();return wait.promise};
  else t.context.request=()=>{entered.resolve();return wait.promise};
  pending=t.run('window');await entered.promise;t.setScreen({trackSid:'replacement',track:{mediaStreamTrack:{readyState:'live'}}});
  wait.resolve(stage==='start'?{id:'late-native',name:'D.pdf',kind:'window'}:{session:{id:'window',generation:'g',controlRevision:2,kind:'window',controller:{identity:'controller',sid:'controller-sid'}}});await pending;
  assert.equal(t.calls.some(x=>x[0]===(stage==='start'?'disconnect':'close')),true,'late '+stage+' exact effect cleaned after share replacement');
  if(stage==='start')assert.equal(t.calls.some(x=>x[0]==='connectNative'),false);
  else assert.equal(t.calls.some(x=>x[0]==='stopNative'),true);
 }
 console.log('PASS actual window prepare/start/grant async intent, host/controller newSID cancellation, local cancel before/after consent and late grant, wrong-kind/old desktop guard');
})().catch(e=>{console.error(e);process.exitCode=1;});
