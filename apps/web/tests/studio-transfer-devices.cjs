const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const file = path.resolve(__dirname, '../components/StudioWorkspace.tsx');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
let restore, snapshot;
function visit(node) {
  if (ts.isVariableDeclaration(node)) {
    if (node.name.getText(source) === 'restoreStudioInputs') restore = node.initializer;
    if (node.name.getText(source) === 'sessionTransfer') snapshot = node.initializer.arguments[0].properties.find(p => p.name.getText(source) === 'snapshot').initializer;
  }
  ts.forEachChild(node, visit);
}
visit(source);
function run(node, context) {
  return vm.runInNewContext(ts.transpileModule(`(${node.getText(source)});`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText, context)();
}
async function checkSnapshot() {
  const devices = [{kind:'videoinput', deviceId:'camera', label:'Camera'}, {kind:'audioinput', deviceId:'default', label:'Microphone'}, {kind:'audiooutput', deviceId:'default', label:'Speakers'}];
  const value = await run(snapshot, {
    navigator:{mediaDevices:{enumerateDevices:async()=>devices}}, window:{location:{origin:'https://source.example'}},
    studioId:'studio',roomName:'test',returnFps:60,returnBitrate:12000,returnVideoCodec:'av1',returnSimulcast:true,returnGain:100,onAir:true,returnActive:true,
    returnVideoDevice:'camera',returnAudioDevice:'default',returnOutputDevice:'default',returnSourceDeviceIdsRef:{current:{video:'camera',audio:'default'}},
  });
  assert.equal(value.settings.audioLabel,'Microphone','input and output default IDs must not overwrite each other');
}
async function checkRestore() {
  let active=false, available=false, stopped=0, preview=false, auto=false, choices={};
  const original={video:'Camera',audio:'Microphone'};
  const context={transferSnapshot:{settings:{onAir:true}},restoreBusy:false,studioRole:'primary',pendingStudioLabels:original,
    setRestoreBusy:()=>{},setRestoreMessage:()=>{},setRestoreAutoOnAir:v=>{auto=v;},setReturnDevices:()=>{},setReturnActive:v=>{preview=v;},
    setReturnVideoDevice:v=>{choices.video=v;},setReturnAudioDevice:v=>{choices.audio=v;},setReturnOutputDevice:()=>{},setPendingStudioLabels:v=>{context.pendingStudioLabels=v;},
    navigator:{mediaDevices:{getUserMedia:async()=>{active=true;return{getTracks:()=>[{stop(){active=false;stopped++;}}]};},enumerateDevices:async()=>available&&active ? [{kind:'videoinput',deviceId:'new-camera',label:'Camera'},{kind:'audioinput',deviceId:'new-mic',label:'Microphone'}] : []}},
  };
  await run(restore,context);
  assert.deepEqual(context.pendingStudioLabels,original,'failed matching must preserve labels for the retry button');
  assert.equal(preview,false);assert.equal(auto,false);assert.equal(stopped,1);
  available=true;
  await run(restore,context);
  assert.deepEqual(choices,{video:'new-camera',audio:'new-mic'},'enumerate while permission stream is still active');
  assert.equal(preview,true);assert.equal(auto,true);assert.equal(stopped,2);
  context.pendingStudioLabels=original;
  context.navigator.mediaDevices.enumerateDevices=async()=>{throw Error('enumeration failed');};
  await run(restore,context);
  assert.equal(stopped,3,'release temporary capture even when enumeration fails');
}
(async()=>{const results=await Promise.allSettled([checkSnapshot(),checkRestore()]);for(const result of results)if(result.status==='rejected')console.error(result.reason);assert.ok(results.every(result=>result.status==='fulfilled'));console.log('PASS: transfer device kind isolation, retry labels, active enumeration and capture cleanup');})().catch(error=>{console.error(error);process.exitCode=1;});
