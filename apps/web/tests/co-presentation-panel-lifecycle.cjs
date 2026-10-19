const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('CoPresentationPanel.tsx',fs.readFileSync(require.resolve('../components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),nodes={};
(function visit(node){if(ts.isVariableDeclaration(node)&&['create','load'].includes(node.name.getText(source)))nodes[node.name.getText(source)]=node.initializer;ts.forEachChild(node,visit)})(source);
const expression=(name,context)=>vm.runInNewContext(ts.transpileModule(`(${nodes[name].getText(source)})`,{compilerOptions:{target:ts.ScriptTarget.ES2022}}).outputText,context);
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:v=>resolve(v)}};
function fixture(){
 const file={name:'Deck.pdf',size:42},closed=[],updates=[],errors=[],held=deferred();
 const context={studioId:'studio-default',roomName:'qa-only',token:'qa-only',controls:{current:{clear(){}}},fileRef:{current:file},flight:{current:false},connected:true,generation:{current:1},epoch:{current:0},mounted:{current:true},ownRef:{current:undefined},canvas:{current:{}},abort:{current:undefined},stopNative(){},nativeFault:{current:false},capture:{current:{stop:async()=>{}}},request:()=>held.promise,closeSession:s=>closed.push(s),updateOwn:s=>updates.push(s),setBusy(){},setControlError(){},setFile(){},setPainted(){},setPages(){},setPage(){},setError:e=>errors.push(e),setController(){},setConverting(){},text:{size:'size error',error:'open error'},translateWorkspaceMessage:(_,text)=>text,t:text=>text,AbortController,AbortSignal,URLSearchParams,FormData,File};
 return{file,closed,updates,errors,held,context};
}
(async()=>{
 for(const reason of ['file','disconnect','unmount']){
  const f=fixture(),create=expression('create',f.context),pending=create(f.file,4);f.context.generation.current++;
  if(reason==='file')f.context.fileRef.current={name:'new.pdf'};if(reason==='disconnect')f.context.connected=false;if(reason==='unmount')f.context.mounted.current=false;
  f.held.resolve({session:{id:'stale'}});await pending;assert.deepEqual(f.closed,[{id:'stale'}],reason+' closes stale server session');assert.equal(f.updates.length,0,'no late state applied');
 }
 let f=fixture(),load=expression('load',f.context);await load({name:'old.ppt',size:200});assert.ok(f.errors.includes('size error'),'unsupported binary PPT rejected');assert.equal(f.context.fileRef.current,undefined);
 f=fixture();const converted=deferred();f.context.fetch=()=>converted.promise;load=expression('load',f.context);const pending=load(new File(['pptx'],'Slides.pptx'));await new Promise(r=>setImmediate(r));f.context.generation.current++;f.context.fileRef.current={name:'new.pdf'};converted.resolve({ok:true,blob:async()=>new Blob(['%PDF-1.7'],{type:'application/pdf'})});await pending;assert.equal(f.context.fileRef.current.name,'new.pdf','late converted file cannot replace selection');
 f=fixture();f.context.fetch=async()=>({ok:false,status:413,json:async()=>({error:'PPTX должен быть не больше 25 МБ.'})});load=expression('load',f.context);await load(new File(['pptx'],'Slides.pptx'));assert.ok(f.errors.includes('PPTX должен быть не больше 25 МБ.'),'safe server error is visible instead of a generic open error');
 f=fixture();f.context.fetch=async()=>({ok:false,status:502,json:async()=>{throw Error('not JSON')}});load=expression('load',f.context);await load(new File(['pptx'],'Slides.pptx'));assert.ok(f.errors.includes('open error (HTTP 502)'),'non-JSON upstream error still includes the useful response status');
 console.log('PASS actual panel start cancellation after file/disconnect/unmount, stale session revocation, unsupported PPT and late conversion isolation');
})().catch(error=>{console.error(error);process.exitCode=1;});
