const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const m={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../lib/co-presentation-controls.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{module:m,exports:m.exports,require:n=>n==='./co-presentation-toolbar'?{}:{documentPictureInPictureApi:()=>undefined},Promise,Set,Map,Number});
(async()=>{
let emit,actions=[],states=[];
const bridge={version:3,update:async s=>{states.push(s);return {visible:false}},show:async()=>({visible:true}),hide:async()=>{},onAction:cb=>{emit=cb;return()=>{}}};
const control=m.exports.createCoPresentationControls({host:{},bridge,action:a=>actions.push(a)});
const state={id:'grant',title:'Deck.pptx',controller:'Owner',page:3,pages:3,canNavigate:true,canReclaim:false,busy:false,locale:'ru',navigationMode:'powerpoint-steps-v1'};
await control.update(state);emit({id:'grant',action:'next'});await new Promise(r=>setImmediate(r));assert.equal(actions.length,1,'last slide can have more animation clicks');
const legacy={...state};delete legacy.navigationMode;await control.update(legacy);emit({id:'grant',action:'next'});await new Promise(r=>setImmediate(r));assert.equal(actions.length,1,'legacy page bounds remain');
control.dispose();console.log('PASS controls support final-slide animation steps while preserving legacy page bounds');
})().catch(e=>{console.error(e);process.exitCode=1});
