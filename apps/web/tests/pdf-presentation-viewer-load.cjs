const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const source=ts.createSourceFile('viewer.tsx',fs.readFileSync(require.resolve('../components/PdfPresentationViewer.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);let loading;
(function visit(n){if(ts.isCallExpression(n)&&n.expression.getText(source)==='useEffect'&&n.arguments[0].getText(source).includes('getDocument('))loading=n.arguments[0];ts.forEachChild(n,visit)})(source);
const tick=()=>new Promise(r=>setImmediate(r));
(async()=>{
 const seen=[],errors=[],revoked=[],progress=[];let opened=0,destroyed=0,task;
 const pdfjs={PDFDataRangeTransport:class {constructor(length){assert.equal(length,1_500_000_000);}onDataRange(begin,data){assert.equal(begin,0);assert.equal(data.length,5);}},GlobalWorkerOptions:{},getDocument(options){opened++;assert.ok(options.range);options.range.requestDataRange(0,5);assert.equal(options.rangeChunkSize,1024*1024);task={promise:Promise.resolve({numPages:3}),destroy:async()=>{destroyed++;}};return task;}};
 const file={name:'Huge.pdf',size:1_500_000_000,arrayBuffer(){assert.fail('no upfront full file copy');},slice(begin,end){assert.equal(begin,0);assert.equal(end,5);return new Blob(['%PDF-']);}};
 const context={file,MAX_PRESENTATION_UPLOAD:1_500_000_000,URL:{createObjectURL:()=> 'blob:qa',revokeObjectURL:x=>revoked.push(x)},setDocument(){},setError(){},setRendering(){},callbacks:{current:{onLoaded:(...v)=>seen.push(v),onError:m=>errors.push(m),onProgress:(...v)=>progress.push(v)}},require:name=>{assert.equal(name,'pdfjs-dist');return pdfjs;}};
 const run=()=>vm.runInNewContext(ts.transpileModule('('+loading.getText(source)+')',{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,context)();
 const cleanup=run();await tick();assert.deepEqual(errors,[],'exact inclusive 1.5GB PDF opens');assert.equal(opened,1);assert.equal(seen[0][0],3);task.onProgress({loaded:5,total:10});assert.equal(progress[0][0],50);cleanup();assert.equal(destroyed,1);assert.deepEqual(revoked,[],'File range transport needs no object URL');
 context.file={...file,size:1_500_000_001};run();await tick();assert.equal(opened,1,'limit+1 fails before PDF loading');assert.equal(errors.length,1);
 console.log('PASS PDF inclusive limit, File range loading with no upfront arrayBuffer, progress and exact task cleanup');
})().catch(e=>{console.error(e);process.exitCode=1;});
