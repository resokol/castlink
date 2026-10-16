const assert=require('node:assert/strict');
const fs=require('node:fs'),ts=require('typescript'),Module=require('node:module'),path=require('node:path');
function load(file){const p=path.resolve(__dirname,'../lib/'+file+'.ts'); const m=new Module(p,module);m.filename=p;m.paths=module.paths;m._compile(ts.transpileModule(fs.readFileSync(p,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,p);return m.exports;}
assert.ok(fs.existsSync(path.resolve(__dirname,'../lib/multiview-media.ts')),'multiview binding not implemented');
const {bindMultiviewVideo,uniqueMultiviewAudio}=load('multiview-media');
const element={srcObject:null,hidden:true};let available=false;
function track(){return {mediaStreamTrack:{readyState:'live'},attaches:0,detaches:0,attach(e){this.attaches++;e.srcObject=this;},detach(e){this.detaches++;e.srcObject=null;}};}
const a=track(),b=track(),bind=bindMultiviewVideo(element,v=>available=v);
bind.update({track:a,isMuted:false});assert.equal(available,true);assert.equal(a.attaches,1);
bind.update({track:a,isMuted:false});assert.equal(a.attaches,1);
bind.update(undefined);assert.equal(available,false);assert.equal(element.srcObject,null,'missing source transparent, no frozen frame');
bind.update({track:b,isMuted:false});assert.equal(available,true);assert.equal(element.srcObject,b,'same slot recovers replacement track');
bind.update({track:b,isMuted:true});assert.equal(available,false);assert.equal(element.srcObject,null);
bind.update({track:b,isMuted:false});assert.equal(available,true);
b.mediaStreamTrack.readyState='ended';bind.update({track:b,isMuted:false});assert.equal(available,false);bind.clear();
const tiles=[{sourceIdentity:'guest-a',source:'camera',muted:false},{sourceIdentity:'guest-a',source:'camera',muted:false},{sourceIdentity:'guest-a',source:'screen',muted:false},{sourceIdentity:'guest-b',source:'camera',muted:true}];
assert.equal(uniqueMultiviewAudio(tiles).length,2,'duplicate slot audio plays once');assert.deepEqual(uniqueMultiviewAudio([{sourceIdentity:'',source:'camera',muted:false}]),[]);
console.log('PASS: transparent missing/muted/ended video, replacement recovery, idempotent attachment, distinct audio sources');
