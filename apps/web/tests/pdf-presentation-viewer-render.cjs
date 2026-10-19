const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('PdfPresentationViewer.tsx',fs.readFileSync(require.resolve('../components/PdfPresentationViewer.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let renderEffect;
(function visit(node){if(ts.isCallExpression(node)&&node.expression.getText(source)==='useEffect'&&node.arguments[0].getText(source).includes('getPage('))renderEffect=node.arguments[0];ts.forEachChild(node,visit)})(source);
const effect=context=>vm.runInNewContext(ts.transpileModule(`(${renderEffect.getText(source)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context)();
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 let finish,cancelled=0;const callbacks=[];
 const makeCanvas=()=>({width:640,height:360,pixel:'previous',getContext(){return{drawImage:source=>this.pixel=source.pixel}}});
 const visible=makeCanvas();visible.ownerDocument={createElement:tag=>{assert.equal(tag,'canvas');return makeCanvas();}};
 const file={},pdfPage={getViewport:()=>({width:640,height:360}),render({canvas}){canvas.pixel='partial';return{promise:new Promise(resolve=>finish=()=>{canvas.pixel='complete';resolve();}),cancel(){cancelled++;}}}};
 const context={document:{file,doc:{numPages:4,getPage:async()=>pdfPage}},file,page:2,canvas:{current:visible},setRendering(){},setError(){},callbacks:{current:{onRendered:(...args)=>callbacks.push(['rendered',...args]),onCanvasReady:(...args)=>callbacks.push(['canvas',...args]),onError:message=>assert.fail(message)}}};
 return{context,visible,callbacks,finish:()=>finish(),cancelled:()=>cancelled};
}
(async()=>{
 let f=fixture();const cleanup=effect(f.context);await settle();assert.equal(f.visible.pixel,'previous','PDF rendering must not expose a partial/blank page to the published canvas');assert.equal(f.callbacks.length,0);f.finish();await settle();assert.equal(f.visible.pixel,'complete');assert.equal(f.callbacks[0][0],'rendered');assert.equal(f.callbacks[1][0],'canvas');assert.equal(f.callbacks[1][1],f.visible,'capture remains bound to the visible canvas');cleanup();
 f=fixture();const cancel=effect(f.context);await settle();cancel();f.finish();await settle();assert.equal(f.visible.pixel,'previous','cancelled stale render never overwrites current shared slide');assert.equal(f.callbacks.length,0);assert.equal(f.cancelled(),1);
 console.log('PASS actual PDF render effect atomically commits completed slide to visible capture canvas and preserves previous slide on render cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
