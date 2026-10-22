'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('panel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let effect,close;
(function visit(n){
 if(ts.isCallExpression(n)&&n.expression.getText(source)==='useEffect'&&n.arguments[0]?.getText(source).includes('helperDialog.current'))effect=n.arguments[0];
 if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='closeHelperPair')close=n.initializer;
 ts.forEachChild(n,visit);
})(source);
assert.ok(effect,'pair dialog must open in the native top layer with a scoped lifecycle');
function fixture(){
 let open=false,focuses=0,selected=0,triggerFocus=0,state='open',listeners=new Map();
 const input={focus(){focuses++},select(){selected++}};
 const node={matches:()=>open,showPopover(){open=true},hidePopover(){open=false},querySelector:()=>input,addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:(n,f)=>{assert.equal(listeners.get(n),f);listeners.delete(n)}};
 const scope={cancelWindowIntent(){},helperPair:{code:'fixture-only'},helperDialog:{current:node},prepareTrigger:{current:{isConnected:true,focus(){triggerFocus++}}},restoreHelperFocus:{current:false},setHelperPair:v=>{state=v}};
 const run=n=>vm.runInNewContext(ts.transpileModule('('+n.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,scope);
 scope.closeHelperPair=run(close);
 const cleanup=run(effect)();
 return{scope,cleanup,listeners,get open(){return open},get state(){return state},get focuses(){return focuses},get selected(){return selected},get triggerFocus(){return triggerFocus}};
}
let f=fixture();assert.equal(f.open,true);assert.equal(f.focuses,1);assert.equal(f.selected,0,'connection retry receives focus without exposing manual code input');
let prevented=0,stopped=0;f.listeners.get('keydown')({key:'Escape',preventDefault(){prevented++},stopPropagation(){stopped++}});
assert.equal(prevented,1);assert.equal(stopped,1,'Escape does not close the ancestor mobile More menu');assert.equal(f.state,undefined);
f.cleanup();assert.equal(f.open,false);assert.equal(f.listeners.size,0);assert.equal(f.triggerFocus,1,'Escape returns focus to Load PPTX');
f=fixture();f.scope.closeHelperPair();f.cleanup();assert.equal(f.triggerFocus,1,'Close returns focus to Load PPTX');
f=fixture();f.cleanup();assert.equal(f.triggerFocus,0,'outside dismissal keeps outside target focus');
f=fixture();f.scope.closeHelperPair();f.scope.prepareTrigger.current.isConnected=false;f.cleanup();assert.equal(f.triggerFocus,0,'unmount never focuses a detached trigger');
console.log('PASS helper pairing top-layer lifecycle, connection retry focus, Escape isolation, Close focus and cleanup');
