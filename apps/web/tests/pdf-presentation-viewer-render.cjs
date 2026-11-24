const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('PdfPresentationViewer.tsx',fs.readFileSync(require.resolve('../components/PdfPresentationViewer.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
let renderEffect, previewEffect;
(function visit(node) {
 if(ts.isCallExpression(node) && node.expression.getText(source)==='useEffect') {
  const callback=node.arguments[0];
  if(callback.getText(source).includes('doc.getPage(number)')) previewEffect=callback;
  else if(callback.getText(source).includes('document.doc.getPage(')) renderEffect=callback;
 }
 ts.forEachChild(node,visit);
})(source);
const effect=(context,callback=renderEffect)=>vm.runInNewContext(ts.transpileModule(`(${callback.getText(source)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context)();
const settle=()=>new Promise(resolve=>setImmediate(resolve));
function fixture(){
 let finish,cancelled=0;const callbacks=[];
 const makeCanvas=()=>({width:640,height:360,pixel:'previous',getContext(){return{drawImage:source=>this.pixel=source.pixel}}});
 const visible=makeCanvas();visible.ownerDocument={createElement:tag=>{assert.equal(tag,'canvas');return makeCanvas();}};
 const file={},pdfPage={getViewport:()=>({width:640,height:360}),render({canvas}){canvas.pixel='partial';return{promise:new Promise(resolve=>finish=()=>{canvas.pixel='complete';resolve();}),cancel(){cancelled++;}}}};
 const context={targetWidth:undefined,document:{file,doc:{numPages:4,getPage:async()=>pdfPage}},file,page:2,canvas:{current:visible},setCommitted(){},setError(){},callbacks:{current:{onRendered:(...args)=>callbacks.push(['rendered',...args]),onCanvasReady:(...args)=>callbacks.push(['canvas',...args]),onError:message=>assert.fail(message)}}};
 return{context,visible,callbacks,finish:()=>finish(),cancelled:()=>cancelled};
}
(async()=>{
 let f=fixture();const cleanup=effect(f.context);await settle();assert.equal(f.visible.pixel,'previous','PDF rendering must not expose a partial/blank page to the published canvas');assert.equal(f.callbacks.length,0);f.finish();await settle();assert.equal(f.visible.pixel,'complete');assert.equal(f.callbacks[0][0],'rendered');assert.equal(f.callbacks[1][0],'canvas');assert.equal(f.callbacks[1][1],f.visible,'capture remains bound to the visible canvas');cleanup();
 f=fixture();const cancel=effect(f.context);await settle();cancel();f.finish();await settle();assert.equal(f.visible.pixel,'previous','cancelled stale render never overwrites current shared slide');assert.equal(f.callbacks.length,0);assert.equal(f.cancelled(),1);
 // Invalidate a pending thumbnail exactly as replacing the file or granting
 // control unmounts its private destination. Late completion stays invisible.
 const calls=[], thumbnail={}, ready=[];
 let resolvePreview, resolvePage;
 const page={
  getViewport:({scale})=>({width:12800*scale,height:7200*scale}),
  render({canvas}) {
   assert.equal(canvas,thumbnail);
   calls.push('render');
   return {promise:new Promise(resolve=>resolvePreview=resolve),cancel:()=>calls.push('cancel')};
  },
  cleanup:()=>calls.push('cleanup'),
 };
 const preview={number:3,doc:{getPage(n){assert.equal(n,3);return new Promise(resolve=>resolvePage=resolve);}},canvas:{current:thumbnail},setReady:value=>ready.push(value)};
 let unmount=effect(preview,previewEffect);unmount();resolvePage(page);await settle();
 assert.deepEqual(calls,['cleanup'],'a stale page fetch never starts a preview render');
 calls.length=0;
 unmount=effect(preview,previewEffect);resolvePage(page);await settle();
 assert.deepEqual([thumbnail.width,thumbnail.height],[320,180]);
 unmount();resolvePreview();await settle();
 assert.deepEqual(calls,['render','cancel','cleanup']);
 assert.deepEqual(ready,[],'a cancelled thumbnail cannot reappear on handoff or replacement');
 console.log('PASS actual PDF render effect atomically commits completed slide to visible capture canvas and preserves previous slide on render cancellation');
})().catch(error=>{console.error(error);process.exitCode=1;});
