const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {participantStudioImageTransform,applyStudioImageTransform}=require('../lib/studio-image-transform.ts');
assert.deepEqual(participantStudioImageTransform('broken'),{});assert.deepEqual(participantStudioImageTransform(JSON.stringify({studioImageTransform:{zoom:Infinity}})),{});
const video={style:{rotate:'90deg'}};applyStudioImageTransform(video,JSON.stringify({studioImageTransform:{zoom:2,panX:.2,rotation:30,cropLeft:.1,flipX:true}}));
assert.match(video.style.transform,/scale\(-2, 2\)/);assert.match(video.style.transform,/translate\(20%/);assert.match(video.style.clipPath,/10%/);assert.equal(video.style.rotate,'90deg','existing rotation preserved');
applyStudioImageTransform(video,'{}');assert.match(video.style.transform,/scale\(1, 1\)/);assert.equal(video.style.clipPath,'inset(0% 0% 0% 0%)');
console.log('PASS receiver-only transform applies and resets CSS without capture or track processing');

const {setStudioImagePreview,studioImagePreview,subscribeStudioImagePreview}=require('../lib/studio-image-transform.ts');
const roomA={},roomB={};let updates=0;const unsubscribe=subscribeStudioImagePreview(roomA,()=>updates++);
setStudioImagePreview(roomA,'guest','sid1',{zoom:2});assert.equal(updates,1);assert.deepEqual(studioImagePreview(roomA,'guest','sid1'),{zoom:2});assert.equal(studioImagePreview(roomA,'guest','sid2'),undefined);assert.equal(studioImagePreview(roomB,'guest','sid1'),undefined);
unsubscribe();setStudioImagePreview(roomA,'guest','sid1');assert.equal(updates,1);assert.equal(studioImagePreview(roomA,'guest','sid1'),undefined);
console.log('PASS optimistic transform isolates receiving rooms and participant sessions and cleans up listeners');
