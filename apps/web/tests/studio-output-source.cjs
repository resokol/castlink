const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript'),os=require('node:os'),path=require('node:path');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'studio-output-'));process.env.STUDIOLINK_STUDIO_CONTROL_FILE=path.join(dir,'state.json');
(async()=>{try{
 const c=require('../lib/studio-control.ts');const {state}=await c.joinStudio('room','studio-output-client');
 assert.equal(state.desired.outputMuted,false);assert.equal(state.desired.videoSource,'camera');
 assert.ok(await c.updateStudioDesired('room',state.epoch,{videoSource:'black',outputMuted:true}));
 assert.equal(await c.updateStudioDesired('room',state.epoch,{videoSource:'unknown'}),null);
 assert.equal(await c.updateStudioDesired('room',state.epoch,{outputMuted:1}),null);
 await c.updateStudioDesired('room',state.epoch,{onAir:true});
 assert.equal(await c.updateStudioDesired('room',state.epoch,{videoSource:'camera'}),null,'source switch must not stop active capture');
 assert.ok(await c.updateStudioDesired('room',state.epoch,{outputMuted:false}),'mute allowed while on air');
 const {studioCaptureConstraints,connectStudioOutputAudio}=require('../lib/studio-output-source.ts');
 assert.equal(studioCaptureConstraints('black','cam','mic',30).video,false);
 assert.ok(studioCaptureConstraints('camera','cam','mic',30).video);
 const edges=[],node=name=>({name,gain:{value:1},connect(n){edges.push([name,n.name]);}});
 const input=node('input'),meter=node('meter'),monitor=node('monitor');let i=0;
 const context={createGain:()=>node('mute'),createMediaStreamDestination:()=>({...node('output'),stream:{id:'out'}})};
 const result=connectStudioOutputAudio(context,input,meter,monitor,true);
 assert.equal(result.gain.gain.value,0);assert.deepEqual(edges,[['input','meter'],['input','monitor'],['input','mute'],['mute','output']]);
 result.gain.gain.value=1;assert.equal(input.gain.value,1,'mute must not change source gain');
 console.log('PASS studio source validation, camera-free black capture, independent output mute');
}finally{fs.rmSync(dir,{recursive:true,force:true});}})().catch(e=>{console.error(e);process.exitCode=1;});

// Execute the real transition handler while its save request is held.
const vm=require('node:vm');const sourceFile=path.resolve(__dirname,'../components/StudioWorkspace.tsx');const source=ts.createSourceFile(sourceFile,fs.readFileSync(sourceFile,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let handler;
(function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='changeVideoSource')handler=n.initializer;ts.forEachChild(n,visit);})(source);
let release;const saved=new Promise(r=>release=r);const state={onAirRef:{current:false},airBusyRef:{current:false},videoModeBusyRef:{current:false},videoSourceRef:{current:'camera'},previewReadyRef:{current:true},studioRoleRef:{current:'primary'},setVideoModeBusy:()=>{},setPreviewReady:()=>{},setVideoSource:()=>{},persistControlPatch:()=>saved};
const change=vm.runInNewContext(ts.transpileModule(`(${handler.getText(source)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,state);
const pending=change('black');assert.equal(state.videoModeBusyRef.current,true,'block ON AIR while source command waits');release();pending.then(()=>{assert.equal(state.videoModeBusyRef.current,false);assert.equal(state.previewReadyRef.current,false,'keep publication blocked until new preview is ready');assert.equal(state.videoSourceRef.current,'black');console.log('PASS source transition blocks ON AIR until new capture ready');}).catch(e=>{console.error(e);process.exitCode=1;});
