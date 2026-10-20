const assert=require('node:assert/strict'),fs=require('node:fs'),ts=require('typescript');
require.extensions['.ts']=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,f);
const {fitTileToSource:fit,resizeSourceTile:resize}=require('../lib/multiview-layout.ts');
const tile={id:'a',sourceIdentity:'caster',source:'camera',x:.1,y:.1,width:.4,height:.8,fit:'contain',muted:true};
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
for(const aspect of [16/9,9/16,1,4/3])for(const scene of [16/9,9/16,1]){
 const fitted=fit(tile,aspect,scene);close(fitted.width/fitted.height*scene,aspect);close(fitted.y+fitted.height/2,tile.y+tile.height/2);
 for(const edge of ['n','ne','e','se','s','sw','w','nw']){const next=resize(fitted,edge,.1,.05,aspect,scene);close(next.width/next.height*scene,aspect);if(edge.includes('w'))close(next.x+next.width,fitted.x+fitted.width);if(edge.includes('n'))close(next.y+next.height,fitted.y+fitted.height);}
}
assert.deepEqual(fit(tile,NaN,1),tile);assert.deepEqual(fit(tile,0,1),tile);
console.log('PASS decoded source proportions and aspect-preserving slot resize');

// Cropping masks source edges; it must not resize/recenter the slot or source.
const {tileAspectRatio,tileAspectFrame}=require('../lib/multiview-layout.ts');
const cropped={...tile,transform:{cropLeft:.25,cropRight:.125,cropTop:.1,cropBottom:.15}};
const expected=16/9;
close(tileAspectRatio(cropped,16/9),expected);
const croppedFit=fit(cropped,16/9,4/3);
close(croppedFit.width/croppedFit.height*4/3,expected);
for(const edge of ['n','ne','e','se','s','sw','w','nw']){
 const next=resize(croppedFit,edge,.1,.05,16/9,4/3);
 close(next.width/next.height*4/3,expected);
}
const cell={...cropped,x:0,y:0,width:.5,height:.5};
const frame=tileAspectFrame(cell,16/9,16/9);
assert.deepEqual(frame,cell,'Cropping leaves grid frame geometry unchanged');
assert.deepEqual(fit(cropped,16/9,4/3),{...fit(tile,16/9,4/3),transform:cropped.transform},'Cropping preserves free slot dimensions and position');
assert.ok(frame.width<=cell.width&&frame.height<=cell.height);
assert.deepEqual(tileAspectFrame(frame,16/9,16/9),frame,'Crop fitting is idempotent rather than shrinking on every render');
assert.deepEqual(tileAspectFrame({...cell,transform:{}},16/9,16/9),{...cell,transform:{}},'Uncropped source grids retain legacy cell bounds');
for(const aspectRatio of ['16:9','4:3'])close(tileAspectRatio({...cropped,aspectRatio},16/9),aspectRatio==='4:3'?4/3:16/9);
for(const source of [16/9,4/3,9/16,1])for(const scene of [16/9,4/3,9/16,1])for(const aspectRatio of ['source','16:9','4:3']){
 const uncropped={...tile,aspectRatio},masked={...uncropped,transform:cropped.transform};
 assert.deepEqual(fit(masked,source,scene),{...fit(uncropped,source,scene),transform:cropped.transform},'Crop preserves free frame across source/scene/slot formats');
 assert.deepEqual(tileAspectFrame(masked,scene),{...tileAspectFrame(uncropped,scene),transform:cropped.transform},'Crop preserves grid frame across source/scene/slot formats');
}
console.log('PASS stationary crop masks, aspect-preserving resize, explicit format precedence and grid bounds');
