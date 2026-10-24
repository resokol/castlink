'use strict';
const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const {remotePcVideoGeometry,remotePcVideoPoint}=load('../lib/remote-pc-input.ts');
const rect={left:34,top:136,width:998.11669921875,height:585};
const geometry=remotePcVideoGeometry(rect,1920,664,'contain','50% 50%');
assert.ok(geometry,'actual QA contain rect must remain usable despite multiplication roundoff');
assert.ok(geometry.left>=rect.left&&geometry.top>=rect.top,'normalized starts stay inside rendered rect');
assert.ok(geometry.left+geometry.width<=rect.left+rect.width&&geometry.top+geometry.height<=rect.top+rect.height,'normalized ends stay inside rendered rect');
const center=remotePcVideoPoint(rect,1920,664,rect.left+rect.width/2,rect.top+rect.height/2,'contain','50% 50%');
assert.ok(center&&Math.abs(center.x-.5)<=Number.EPSILON*4&&Math.abs(center.y-.5)<=Number.EPSILON*4,'actual QA centered point maps to normalized center');
console.log('PASS actual QA fractional contain geometry and safe normalized center/bounds');

for(const [x,y,expected]of [[geometry.left,geometry.top,{x:0,y:0}],[geometry.left+geometry.width,geometry.top+geometry.height,{x:1,y:1}]])assert.deepEqual(JSON.parse(JSON.stringify(remotePcVideoPoint(rect,1920,664,x,y))),expected,'actual QA source edges map to safe normalized edges');
assert.equal(remotePcVideoPoint(rect,1920,664,geometry.left-0.000001,geometry.top),undefined,'no pointer tolerance outside source left');
assert.equal(remotePcVideoPoint(rect,1920,664,geometry.left,geometry.top-0.000001),undefined,'no pointer tolerance outside source top');
assert.equal(remotePcVideoPoint(rect,1920,664,geometry.left+geometry.width+0.000001,geometry.top),undefined,'no pointer tolerance outside source right');
assert.equal(remotePcVideoPoint(rect,1920,664,geometry.left,geometry.top+geometry.height+0.000001),undefined,'no pointer tolerance outside source bottom');
const sources=[[1920,664],[986,642],[2290,793],[1920,1080],[1600,900],[640,360],[1080,1920],[1440,900]],origins=[0,34,136,-5.25,0.1,123.456,1/3,-1/3,32.0078125],widths=[998.11669921875,1000/3,1280/1.25,889.6,1133.333333333,1023.984375,586.78125],heights=[585,650/3,1080/1.5,793/1.25,642/1.75],positions=['50% 50%','0% 0%','100% 100%','25% 75%','75% 25%'];
let count=0;
for(const [width,height]of sources)for(const left of origins)for(const top of origins)for(const rw of widths)for(const rh of heights)for(const position of positions){
 const r={left,top,width:rw,height:rh},g=remotePcVideoGeometry(r,width,height,'contain',position);
 assert.ok(g,JSON.stringify({r,width,height,position}));assert.ok(g.left>=r.left&&g.top>=r.top&&g.left+g.width<=r.left+r.width&&g.top+g.height<=r.top+r.height,'strict returned bounds for every fixed natural case');count++;
}
const square={left:34.1,top:136.3,width:400.25,height:400.5},freeY=square.height-square.width*900/1600;
const negatives=[['left subpixel crop',square,1600,900,'contain','-0.000001px 50%'],['right subpixel crop',square,1600,900,'contain','0.000001px 50%'],['top subpixel crop',square,1600,900,'contain','50% -0.000001px'],['bottom subpixel crop',square,1600,900,'contain',`50% ${freeY+0.000001}px`],['bottom percentage crop',square,1600,900,'contain','50% 100.0001%'],['right percentage crop',square,1080,1920,'contain','100.0001% 50%'],['cover',square,1600,900,'cover','50% 50%'],['none',square,1600,900,'none','50% 50%'],['unsupported position',square,1600,900,'contain','calc(50% + 1px) 50%'],['extra position',square,1600,900,'contain','left top 1px'],['zero width',{...square,width:0},1600,900],['negative width',{...square,width:-1},1600,900],['zero height',{...square,height:0},1600,900],['negative height',{...square,height:-1},1600,900],['NaN origin',{...square,left:NaN},1600,900],['infinite origin',{...square,top:Infinity},1600,900],['infinite width',{...square,width:Infinity},1600,900],['zero source',square,0,900],['negative source',square,1600,-1],['infinite source',square,Infinity,900],['overflow scale',square,Number.MIN_VALUE,Number.MIN_VALUE],['underflow scale',{left:0,top:0,width:Number.MIN_VALUE,height:Number.MIN_VALUE},Number.MAX_VALUE,Number.MAX_VALUE]];
for(const [name,...args]of negatives)assert.equal(remotePcVideoGeometry(...args),undefined,name);
for(const fit of ['contain','scale-down','fill'])assert.ok(remotePcVideoGeometry(rect,1920,664,fit),'existing supported fit policy unchanged');
console.log(`PASS precision matrix: ${count} fixed fractional/aspect/origin/position cases strictly inside; ${negatives.length} real-crop/invalid negatives; normalized QA edge points`);
