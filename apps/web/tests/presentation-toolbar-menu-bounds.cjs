const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('toolbar.ts',fs.readFileSync(require.resolve('../lib/co-presentation-toolbar.ts'),'utf8'),ts.ScriptTarget.Latest,true);let node;
(function visit(n){if(ts.isVariableDeclaration(n)&&n.name.getText(source)==='positionMenu')node=n.initializer;ts.forEachChild(n,visit)})(source);
for(const viewport of [340,420]){
 const anchor={left:128,right:viewport===340?278:327,top:62},menu={style:{},getBoundingClientRect:()=>({width:300})},c={menuOpen:true,bar:{getBoundingClientRect:()=>({bottom:112})},menu,control:{getBoundingClientRect:()=>anchor},win:{innerWidth:viewport,innerHeight:340},surface:{}};
 vm.runInNewContext(ts.transpileModule('('+node.getText(source)+')',{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,c)();
 const left=Number.parseFloat(menu.style.left)+anchor.left;
 assert.ok(Number.isFinite(left)&&left>=8&&left+300<=viewport-8,'expanded menu must fit viewport at '+viewport);
 assert.equal(Number.parseFloat(menu.style.top)+anchor.top,124,'menu stays below complete toolbar/Stop');
}
console.log('PASS actual toolbar menu positioning:340/420 viewport clamp, preserved vertical Stop clearance');
