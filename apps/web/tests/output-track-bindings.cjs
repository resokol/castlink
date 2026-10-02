const assert = require("node:assert/strict");
const fs = require("node:fs"), ts = require("typescript"), Module = require("node:module");
Module._extensions['.ts'] = (mod,file) => mod._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,file);
const {createOutputTrackBindings}=require('../lib/output-track-bindings.ts');
function box(){return {element:null,replaceChildren(el){if(this.element)this.element.parentElement=null;this.element=el;el.parentElement=this;}};}
const video=box(), audio=box();
function track(kind) {
 const t={kind, attaches:0, detaches:0, stopped:false, elements:new Set(), attach(){
  this.attaches++;
  const el={srcObject:{active:true},parentElement:null,remove(){if(this.parentElement?.element===this)this.parentElement.element=null;this.parentElement=null;}};
  this.elements.add(el);return el;
 },detach(el){assert.ok(el,'never detach unrelated elements');this.detaches++;this.elements.delete(el);return [el];},stop(){this.stopped=true;}};
 return t;
}
const bind=createOutputTrackBindings(()=>video,()=>audio), camera=track('video'), mic=track('audio');
assert.equal(bind.attach(camera),true);assert.equal(bind.attach(mic),true);
const first=video.element;
for(let i=0;i<100;i++){assert.equal(bind.attach(camera),false);assert.equal(bind.attach(mic),false);}
assert.equal(camera.attaches,1);assert.equal(video.element,first);assert.equal(first.muted,true);assert.equal(first.playsInline,true);
const replacement=track('video');bind.attach(replacement);bind.detach(camera);
assert.equal(video.element.srcObject.active,true,'late unsubscribe cannot erase replacement');assert.equal(mic.detaches,0,'video replacement does not interrupt audio');
bind.clear();bind.clear();assert.equal(camera.elements.size,0);assert.equal(replacement.elements.size,0);assert.equal(mic.elements.size,0);
for(let i=0;i<100;i++){bind.attach(camera);bind.clear();}
assert.equal(camera.attaches,camera.detaches);assert.equal(camera.stopped,false,'display teardown must not stop SDK/RTP track');
console.log('PASS: 100 redundant events -> 1 attachment, 100 republish cycles leak-free, late events preserve replacement/audio');
