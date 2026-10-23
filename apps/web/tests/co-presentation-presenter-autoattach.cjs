// Execute the component's actual per-capture launch handler; native/room I/O is inert.
const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript');
const source = ts.createSourceFile('CoPresentationPanel.tsx', fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'), 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let handler;
(function visit(node) {
  if (ts.isVariableDeclaration(node) && node.name.getText(source) === 'autoAttachSharedPowerPoint') handler = node.initializer;
  ts.forEachChild(node, visit);
})(source);
assert.ok(handler, 'a confirmed new presenter capture automatically attaches its exact PowerPoint controls');
const compile = scope => vm.runInNewContext(ts.transpileModule('(' + handler.getText(source) + ')', {compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText, scope);
function fixture() {
  const share = {track:{mediaStreamTrack:{readyState:'live'}},trackSid:'screen-a',localSid:'owner-a'}, calls = [];
  const bridge = {version:4,step(){},connectShared(){}};
  const scope = {
    locale:'ru',nativeCaptureId:()=> '10000000-0000-4000-8000-000000000001',nativeConnectionFailure:()=> 'safe failure',connectBrowserPowerPoint:async share=>{calls.push(['browser',share]);return true;},window:{}, mounted:{current:true}, connected:true, busy:false, flight:{current:false}, nativeFlight:{current:false},
    captureNativeShare:()=>share, nativeShareCurrent:value=>value === scope.captureNativeShare(),
    autoAttachAttempt:{current:undefined}, autoAttachFailure:{current:undefined},
    powerPointBridge:()=>bridge, sharedPowerPointBridge:()=>bridge, isCoPresentationTrack:()=>false,
    setError(){}, setNativeAttachFailure(value){scope.failure=value;},
    connectNative:async(...args)=>{calls.push(args);return true;},
  };
  return {share, bridge, scope, calls, run:compile(scope)};
}
(async()=>{
  let f=fixture(); await f.run(); await f.run();
  assert.equal(f.calls.length,1,'reopen/rerender never retries the same capture');
  f.scope.captureNativeShare=()=>({...f.share,track:{},trackSid:'screen-b'});
  await f.run(); assert.equal(f.calls.length,2,'a different confirmed capture can attach');
  f=fixture(); f.scope.powerPointBridge=()=>undefined; f.scope.sharedPowerPointBridge=()=>undefined;
  await f.run(); assert.equal(f.calls.length,1,'browser owner starts the scoped local component after its confirmed capture');assert.equal(f.calls[0][0],'browser');f.scope.captureNativeShare=()=>undefined;await f.run();assert.equal(f.calls.length,1,'recipient without a local capture never pairs/launches');
  f=fixture(); f.bridge.version=3; f.scope.sharedPowerPointBridge=()=>undefined;
  await f.run(); assert.equal(f.calls.length,0,'legacy bridge never blindly attaches an unrelated slideshow');
  f=fixture(); f.scope.isCoPresentationTrack=()=>true;
  await f.run(); assert.equal(f.calls.length,0,'uploaded browser PDF never launches native PowerPoint');
  f=fixture(); f.scope.connectNative=async(...args)=>{f.calls.push(args);return false;};
  await f.run(); await f.run(); assert.equal(f.calls.length,1,'failed attachment has no covert retry');
  await f.run(true); assert.equal(f.calls.length,2,'explicit Retry permits exactly one new attempt');
  console.log('PASS presenter autoattach once per exact capture, browser-owner routing, no recipient/legacy fallback and explicit retry');
})().catch(error=>{console.error(error);process.exitCode=1;});
