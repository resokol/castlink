const assert=require('node:assert/strict');
require('./multiview-layout.cjs');
const {validateMultiviewScene}=require('../lib/multiview.ts');
const {MULTIVIEW_SCENE_FORMATS,tileAspectRatio,tileAspectFrame,fitTileToSource,resizeSourceTile,gridScene}=require('../lib/multiview-layout.ts');
const {exportMultiviewScene,importMultiviewScene}=require('../lib/multiview-portable.ts');
assert.ok(MULTIVIEW_SCENE_FORMATS?.some(format=>format.label==='4:3'&&format.width===1440&&format.height===1080),'Scene toolbar must offer 4:3 at 1440×1080');
const tile={id:'slot',sourceIdentity:'guest',source:'camera',x:.1,y:.1,width:.4,height:.4,fit:'cover',muted:true};
const scene={id:'scene',name:'Four by three',width:1440,height:1080,revision:0,tiles:[tile]};
const near=(a,b)=>assert.ok(Math.abs(a-b)<1e-8,`${a} != ${b}`);
assert.deepEqual(validateMultiviewScene(scene),scene,'Legacy scenes keep the missing aspect field and geometry');
for(const aspectRatio of ['source','16:9','4:3']){
 const chosen={...tile,aspectRatio};const value={...scene,tiles:[chosen]};
 assert.equal(validateMultiviewScene(value).tiles[0].aspectRatio,aspectRatio);
 assert.equal(importMultiviewScene(exportMultiviewScene(value)).tiles[0].aspectRatio,aspectRatio);
}
for(const aspectRatio of [null,16/9,'1:1','16/9',['4:3'],{},true])assert.throws(()=>validateMultiviewScene({...scene,tiles:[{...tile,aspectRatio}]}));
near(tileAspectRatio(tile,9/16),9/16);near(tileAspectRatio({...tile,aspectRatio:'source'},4/3),4/3);
assert.equal(tileAspectRatio(tile,NaN),undefined);
for(const aspectRatio of ['16:9','4:3'])for(const sceneAspect of [16/9,4/3,9/16,1]){
 const expected=aspectRatio==='16:9'?16/9:4/3;
 for(const decoded of [9/16,1,4/3,16/9,undefined])near(tileAspectRatio({...tile,aspectRatio},decoded),expected);
 const chosen={...tile,aspectRatio};
 const fitted=fitTileToSource(chosen,9/16,sceneAspect);near(fitted.width/fitted.height*sceneAspect,expected);
 near(fitTileToSource(fitted,1,sceneAspect).height,fitted.height);
 for(const edge of ['n','ne','e','se','s','sw','w','nw']){
  const resized=resizeSourceTile(fitted,edge,.07,.03,1,sceneAspect);near(resized.width/resized.height*sceneAspect,expected);assert.equal(resized.fit,'cover');
 }
 const grid=gridScene({...scene,width:1920,height:1920/sceneAspect,tiles:[chosen]},3,2,()=> 'new');
 const cell=grid.tiles[0],frame=tileAspectFrame(cell,sceneAspect);
 near(frame.width/frame.height*sceneAspect,expected);
 assert.ok(frame.x>=cell.x-1e-9&&frame.y>=cell.y-1e-9&&frame.x+frame.width<=cell.x+cell.width+1e-9&&frame.y+frame.height<=cell.y+cell.height+1e-9,'Format frame stays inside its grid cell');
 near(frame.x+frame.width/2,cell.x+cell.width/2);near(frame.y+frame.height/2,cell.y+cell.height/2);
 assert.deepEqual(tileAspectFrame({...cell,aspectRatio:'source'},sceneAspect),{...cell,aspectRatio:'source'},'Source mode retains legacy fixed grid cells');
 const switched=tileAspectFrame({...cell,aspectRatio:aspectRatio==='16:9'?'4:3':'16:9'},sceneAspect);
 assert.ok(switched.width<=cell.width+1e-9&&switched.height<=cell.height+1e-9);
 assert.deepEqual(tileAspectFrame(cell,sceneAspect),frame,'Rendering a format never shrinks stored grid geometry');
 const narrowCell=gridScene({...scene,tiles:[chosen]},1,4,()=> 'new').tiles[0];
 const promoted=tileAspectFrame(narrowCell,4/3);
 const free=fitTileToSource(promoted,9/16,4/3);
 near(free.width,promoted.width);near(free.height,promoted.height);near(free.x,promoted.x);near(free.y,promoted.y);
 assert.ok(free.height<=narrowCell.height+1e-9,'Promoting a fixed grid frame to free layout preserves its visible size');
}
console.log('PASS: 4:3 scene preset, strict persisted slot formats, portable round trips, free ratio lock and bounded grid frames');
