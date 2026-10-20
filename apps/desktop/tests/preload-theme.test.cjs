'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
function fixture(role='client',ready=true){
 const sent=[],root={dataset:{}},document={documentElement:ready?root:null,addEventListener:(name,fn)=>{document.ready=fn;}};
 let changed,observed;
 const electron={contextBridge:{exposeInMainWorld(){},executeInMainWorld(){}},ipcRenderer:{send:(...args)=>sent.push(args)}};
 class MutationObserver{constructor(fn){changed=fn;}observe(element,options){observed={element,options};}}
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../src/preload.cjs'),'utf8'),{document,MutationObserver,require:()=>electron,process:{argv:['--castlink-role='+role]}});
 return {sent,root,document,change:()=>changed?.(),observed:()=>observed};
}
test('selected client theme reaches native UI initially and on changes without duplicate polling',()=>{
 const f=fixture();assert.deepEqual(f.sent,[]);
 f.root.dataset.theme='dark';f.change();assert.deepEqual(f.sent,[['castlink:theme','dark']]);
 f.change();assert.equal(f.sent.length,1);
 f.root.dataset.theme='light';f.change();assert.deepEqual(f.sent.at(-1),['castlink:theme','light']);
 f.root.dataset.theme='invalid';f.change();assert.equal(f.sent.length,2);
 assert.equal(f.observed().element,f.root);
 assert.deepEqual(Array.from(f.observed().options.attributeFilter),['data-theme']);
});
test('client observer waits for the root and local windows cannot publish client theme',()=>{
 const f=fixture('client',false);f.root.dataset.theme='light';f.document.documentElement=f.root;f.document.ready();
 assert.deepEqual(f.sent,[['castlink:theme','light']]);
 for(const role of ['launcher','picker','slides','stop']){const local=fixture(role);assert.equal(local.observed(),undefined);assert.deepEqual(local.sent,[]);}
});
