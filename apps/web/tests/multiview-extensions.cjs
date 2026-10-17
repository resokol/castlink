const assert=require('node:assert/strict');
require('./multiview-layout.cjs');
const {validateMultiviewScene}=require('../lib/multiview.ts');
const {duplicateScene,moveSourceToSlot}=require('../lib/multiview-layout.ts');
const {imageTransformStyle}=require('../lib/multiview-image.ts');
const tile={id:'a',sourceIdentity:'caster-a',source:'camera',x:0,y:0,width:.5,height:1,fit:'contain',muted:true};
const scene={id:'s',name:'Main',width:1920,height:1080,revision:3,tiles:[{...tile,transform:{zoom:2}},{...tile,id:'b',x:.5,sourceIdentity:'caster-b'}],absence:{mode:'black'}};
const valid=validateMultiviewScene(scene);assert.equal(valid.tiles[0].transform.zoom,2);assert.equal(valid.absence.mode,'black');
assert.throws(()=>validateMultiviewScene({...scene,absence:{mode:'image',image:'data:image/svg+xml;base64,PHN2Zz4='}}));
assert.throws(()=>validateMultiviewScene({...scene,tiles:[{...tile,transform:{zoom:Infinity}}]}));
assert.throws(()=>validateMultiviewScene({...scene,tiles:[{...tile,transform:{cropLeft:.8}}]}));
const moved=moveSourceToSlot(valid,'a',2,'swap');assert.equal(moved.tiles[1].sourceIdentity,'caster-a');assert.equal(moved.tiles[0].sourceIdentity,'caster-b');assert.equal(moved.tiles[1].x,.5);
const replaced=moveSourceToSlot(valid,'a',2,'replace');assert.equal(replaced.tiles[0].sourceIdentity,'');
const copy=duplicateScene(valid,'new','Copy',()=> 'new-slot');assert.equal(copy.revision,0);assert.notEqual(copy.id,valid.id);copy.tiles[0].transform.zoom=3;assert.equal(valid.tiles[0].transform.zoom,2);assert.equal(new Set(copy.tiles.map(t=>t.id)).size,2);
assert.match(imageTransformStyle({zoom:2,flipX:true}).transform,/scale\(-2, 2\)/);
console.log('PASS: multiview transform validation, absence policy, independent copy, numbered slot swap/replace');

const png='data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLbtAAAAABJRU5ErkJggg==';
assert.equal(validateMultiviewScene({...scene,absence:{mode:'image',image:png,transform:{zoom:2}}}).absence.image,png);
assert.throws(()=>validateMultiviewScene({...scene,absence:{mode:'image',image:'data:image/png;base64,A'}}));
assert.throws(()=>validateMultiviewScene({...scene,absence:{mode:'image',image:png+'A'.repeat(96000)}}));
const oversized=Buffer.from(png.slice(22),'base64');oversized.writeUInt32BE(90000,16);assert.throws(()=>validateMultiviewScene({...scene,absence:{mode:'image',image:'data:image/png;base64,'+oversized.toString('base64')}}));
const withImage=validateMultiviewScene({...scene,absence:{mode:'image',image:png,transform:{zoom:2}}});const independent=duplicateScene(withImage,'copy','Copy');independent.absence.transform.zoom=4;assert.equal(withImage.absence.transform.zoom,2);
console.log('PASS: bounded raster-only placeholder and deeply independent placeholder transform');

const {croppedImageStyle}=require('../lib/multiview-image.ts');
for(const transform of [{},{cropLeft:.25,cropRight:.125,cropTop:.1,cropBottom:.15},{cropLeft:.45,cropRight:.45,cropTop:.45,cropBottom:.45}]){
 const style=croppedImageStyle(transform);
 const left=transform.cropLeft||0,right=transform.cropRight||0,top=transform.cropTop||0,bottom=transform.cropBottom||0;
 const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
 // The retained source edges must land on the four viewport edges, rather
 // than leaving transparent cropped margins inside the selectable frame.
 near(parseFloat(style.left)+left*parseFloat(style.width),0);
 near(parseFloat(style.left)+(1-right)*parseFloat(style.width),100);
 near(parseFloat(style.top)+top*parseFloat(style.height),0);
 near(parseFloat(style.top)+(1-bottom)*parseFloat(style.height),100);
}
assert.match(croppedImageStyle({cropLeft:.25,zoom:2,flipX:true}).transform,/scale\(-2, 2\)/);
assert.equal(croppedImageStyle({cropLeft:.25}).transformOrigin,'62.5% 50%','Zoom/flip rotate around the cropped viewport centre');
console.log('PASS crop source edges fill the actual viewport, including asymmetric and maximum cuts');
