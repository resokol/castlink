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
