// Real component owner setup handler; room/native effects are inert.
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let node,openComponent;(function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='connectBrowserPowerPoint')node=n.initializer;if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='openOwnerComponent')openComponent=n.initializer;ts.forEachChild(n,visit)})(source);
assert.ok(node,'confirmed browser presenter capture starts its scoped local component automatically');
assert.ok(openComponent,'owner can launch the same pending component ticket synchronously when browser policy requires a click');
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
function fixture(states){
 const share={track:{},trackSid:'screen-a',localSid:'owner-a'},calls=[],errors=[];let current=share;
 const bridge={connection:async()=>states.shift()||{connected:true,ready:true,browserControl:true},pair:async()=>{calls.push('pair');return{code:'cp2_'+'a'.repeat(43),expiresAt:Date.now()+120000}},dispose(){calls.push('dispose')}};
 const scope={window:{setTimeout:done=>{done();return 1}},locale:'en',token:'owner-token',studioId:'qa',roomName:'qa',mounted:{current:true},generation:{current:1},epoch:{current:0},flight:{current:false},pendingNativeShare:{current:undefined},browserHelper:{current:undefined},autoAttachFailure:{current:undefined},nativeShareCurrent:value=>value===current,createHelperPowerPointBridge:()=>{calls.push('create');return bridge},launchPresentationHelper:()=>calls.push('launch'),nativeConnectionFailure:(_locale,stage,cause)=>stage+':'+cause?.code,setError:error=>{if(error)errors.push(error)},setBusy(){},setNativeAttachFailure(){},setBrowserPair:value=>scope.browserPair=value,connectNative:async(_provided,_resume,expected,shared,helper)=>{assert.equal(expected,share);assert.equal(shared,true);assert.equal(helper,bridge);calls.push('connectBrowser');return true;},Date,Promise};
 const run=vm.runInNewContext(ts.transpileModule('('+node.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
 return{scope,bridge,share,calls,errors,run:()=>run(share),replace:()=>{current={...share,track:{},trackSid:'replacement'};scope.generation.current++;}};
}
(async()=>{
 let f=fixture([{connected:false},{connected:true,ready:false},{connected:true,ready:true,browserControl:true}]);assert.equal(await f.run(),true);assert.deepEqual(f.calls,['create','pair','launch','connectBrowser'],'one OS launch; attach only after actual component approval/capability');
 f=fixture([{connected:true,ready:true,browserControl:true}]);await f.run();assert.deepEqual(f.calls,['create','connectBrowser'],'running approved component needs no repeated pairing or OS launch');
 f=fixture([{connected:true,ready:true,browserControl:false}]);assert.equal(await f.run(),false);assert.equal(f.calls.includes('connectBrowser'),false);assert.ok(f.errors.some(e=>e==='bridge:POWERPOINT_NATIVE_UNAVAILABLE'),'old component gets actionable update stage, no legacy fallback');
 f=fixture([{connected:true,ready:false},{connected:false,ready:false}]);assert.equal(await f.run(),false,'lost/declined local setup requires explicit retry');assert.equal(f.calls.includes('pair'),false,'do not pair again after local setup disappears');assert.equal(f.calls.includes('connectBrowser'),false);
 for(const stage of ['state','pair']){
  f=fixture([{connected:false}]);const held=deferred();if(stage==='state')f.bridge.connection=()=>held.promise;else f.bridge.pair=()=>held.promise;
  const pending=f.run();await new Promise(r=>setImmediate(r));f.replace();held.resolve(stage==='state'?{connected:false}:{code:'cp2_'+'a'.repeat(43),expiresAt:Date.now()+120000});assert.equal(await pending,false);assert.equal(f.calls.includes('launch'),false,'late '+stage+' cannot launch for a replacement capture');assert.equal(f.calls.includes('connectBrowser'),false);
 }
 f=fixture([]);f.scope.browserHelper.current={bridge:f.bridge,share:f.share};f.scope.browserPair={code:'cp2_'+'a'.repeat(43),expiresAt:Date.now()+120000,bridge:f.bridge,share:f.share};const launch=vm.runInNewContext(ts.transpileModule('('+openComponent.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,f.scope);launch();launch();assert.deepEqual(f.calls,['launch','launch'],'explicit launch remains synchronous and reuses ticket without pairing/RPC');f.replace();launch();assert.equal(f.calls.length,2,'stale/recipient capture cannot launch prior owner ticket');
 console.log('PASS browser owner only: single pairing/launch, approved-ready capability, running component reuse and stale state/pair cancellation');
})().catch(error=>{console.error(error);process.exitCode=1});
