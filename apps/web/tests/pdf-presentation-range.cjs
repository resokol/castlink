const assert=require('node:assert/strict'),{pathToFileURL}=require('node:url');
(async()=>{
 const pdfjs=await import(pathToFileURL(require.resolve('pdfjs-dist/legacy/build/pdf.mjs')).href);
 let text='%PDF-1.7\n';const offsets=[0],ranges=[];
 const obj=value=>{offsets.push(text.length);text+=(offsets.length-1)+' 0 obj\n'+value+'\nendobj\n';};
 obj('<< /Type /Catalog /Pages 2 0 R >>');obj('<< /Type /Pages /Kids [3 0 R] /Count 1 >>');
 obj('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 640 360] /Contents 4 0 R >>');obj('<< /Length 0 >>\nstream\n\nendstream');
 text+='%'+ 'x'.repeat(8*1024*1024)+'\n';
 const xref=text.length;text+='xref\n0 5\n0000000000 65535 f \n'+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+'trailer\n<< /Root 1 0 R /Size 5 >>\nstartxref\n'+xref+'\n%%EOF\n';
 const file=new File([text],'Range.pdf');
 class Range extends pdfjs.PDFDataRangeTransport{requestDataRange(begin,end){ranges.push([begin,end]);void file.slice(begin,end).arrayBuffer().then(data=>this.onDataRange(begin,new Uint8Array(data)));}}
 const task=pdfjs.getDocument({range:new Range(file.size,new Uint8Array(0)),disableStream:true,disableAutoFetch:true,rangeChunkSize:1024*1024});
 try{
  const doc=await task.promise;assert.equal(doc.numPages,1);const page=await doc.getPage(1);assert.equal(page.getViewport({scale:1}).width,640);
  assert(ranges.length>0);assert(ranges.reduce((total,[begin,end])=>total+end-begin,0)<file.size,'actual PDF.js opens first page without reading the complete File');
  console.log('PASS actual PDF.js File range transport: first page opens from bounded slices and retains original page geometry');
 }finally{await task.destroy();}
})().catch(error=>{console.error(error);process.exitCode=1;});
