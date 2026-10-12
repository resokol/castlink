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

(async () => {
  const host=box();const b=createOutputTrackBindings(()=>null,()=>host);const t=track('audio');
  assert.equal(b.inspectAudio().subscribed,false);
  assert.equal(b.inspectAudio().paused,null,'missing playback evidence is not a measured pause');
  t.mediaStreamTrack={readyState:'live'};
  b.attach(t);const el=host.element;let plays=0;el.paused=true;
  el.muted=false;el.readyState=4;el.currentTime=1.25;
  assert.equal(b.inspectAudio().trackState,'live');assert.equal(b.inspectAudio().paused,true);
  assert.equal(b.inspectAudio().currentTime,1.25);assert.equal(b.inspectAudio().recoveryAttempts,0);
  el.play=async()=>{plays++;el.paused=false;};
  assert.equal(typeof b.resumeAudio,'function','paused subscribed audio requires playback recovery');
  assert.equal(await b.resumeAudio(),'playing');assert.equal(plays,1);assert.equal(host.element,el,'playback recovery preserves media element');assert.equal(t.attaches,1,'recovery does not reattach healthy RTP track');
  assert.equal(b.inspectAudio().recoveryAttempts,1);assert.equal(b.inspectAudio().lastRecoveryReason,'paused');
  assert.ok(b.inspectAudio().lastRecoveryAt>0);assert.equal(b.inspectAudio().paused,false);
  await b.resumeAudio();assert.equal(plays,1,'healthy playback is not restarted');
  assert.equal(b.inspectAudio().recoveryAttempts,1,'observing or checking healthy audio does not manufacture recoveries');
  let release;el.paused=true;el.play=()=>{plays++;return new Promise(resolve=>release=()=>{el.paused=false;resolve();});};
  const first=b.resumeAudio(),second=b.resumeAudio();await Promise.resolve();assert.equal(plays,2,'only one play attempt may be in flight');release();assert.equal(await first,'playing');assert.equal(await second,'playing');
  el.paused=true;el.play=async()=>{plays++;throw Object.assign(new Error('autoplay blocked'),{name:'NotAllowedError'});};
  for(let i=0;i<6;i++)assert.equal(await b.resumeAudio(),'blocked');assert.equal(plays,5,'blocked playback retries stop after three attempts');
  assert.equal(await b.resumeAudio(true),'blocked');assert.equal(plays,6,'explicit recovery event can renew retry budget');
  assert.equal(b.inspectAudio().lastRecoveryReason,'autoplay-blocked');assert.equal(b.inspectAudio().recoveryAttempts,6);
  el.play=()=>new Promise(resolve=>release=resolve);const pending=b.resumeAudio(true);await Promise.resolve();b.clear();release();assert.equal(await pending,'idle','pending playback completion cannot resurrect released binding');assert.equal(host.element,null);
  assert.equal(b.inspectAudio().subscribed,false);assert.equal(b.inspectAudio().recoveryAttempts,7,'track replacement retains session recovery history');
  b.attach(t);const hung=host.element;hung.paused=true;let hungPlays=0,resolveLate;
  hung.play=()=>{hungPlays++;return new Promise(resolve=>resolveLate=resolve);};const started=Date.now();
  assert.equal(await b.resumeAudio(),'failed','pending play reaches a deadline');assert.ok(Date.now()-started>=1400&&Date.now()-started<4000);
  assert.equal(b.inspectAudio().lastRecoveryReason,'play-timeout');
  hung.play=async()=>{hungPlays++;throw new Error('playback failed');};await b.resumeAudio();await b.resumeAudio();await b.resumeAudio();assert.equal(hungPlays,3,'timeout consumes one of three retry attempts');
  hung.play=async()=>{hungPlays++;hung.paused=false;};assert.equal(await b.resumeAudio(true,'manual'),'playing','deadline releases inflight slot for explicit retry');resolveLate();await Promise.resolve();assert.equal(await b.resumeAudio(),'playing','late completion cannot overwrite recovered playback');assert.equal(hungPlays,4);
  assert.equal(b.inspectAudio().lastRecoveryReason,'manual');assert.equal(b.inspectAudio().recoveryAttempts,11);b.clear();
  console.log('PASS: paused playback recovery, healthy no-restart, one inflight play, three-attempt bound, retry reset, cleanup race');
  console.log('PASS: hanging play deadline, bounded retry budget, retry after timeout, harmless late completion');
})().catch(e=>{console.error(e);process.exitCode=1;});
