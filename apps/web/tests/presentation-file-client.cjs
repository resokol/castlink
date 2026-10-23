const assert=require('node:assert/strict'),{load}=require('./load-typescript.cjs');
const {validPresentationFile,convertPresentationFile}=load('../lib/presentation-file-client.ts');
const {MAX_PRESENTATION_UPLOAD}=load('../lib/presentation-upload-limits.ts');
class XHR{
 constructor(){XHR.last=this;this.upload={};this.headers={};}
 open(...args){this.opened=args;}setRequestHeader(k,v){this.headers[k]=v;}send(body){this.body=body;}abort(){this.aborted=true;this.onabort?.();}
}
(async()=>{
 for(const name of ['Deck.pdf','Deck.PPTX']){assert.equal(validPresentationFile({name,size:MAX_PRESENTATION_UPLOAD}),true);assert.equal(validPresentationFile({name,size:MAX_PRESENTATION_UPLOAD+1}),false);}
 for(const file of [{name:'d.ppt',size:2},{name:'d.pdf',size:0}])assert.equal(validPresentationFile(file),false);
 const progress=[],cancel=new AbortController();
 const pending=convertPresentationFile({file:new File(['ppt'],'Deck.pptx'),endpoint:'/api/presentation-file',token:'qa',signal:cancel.signal,onProgress:p=>progress.push(p),createRequest:()=>new XHR()});
 const xhr=XHR.last;assert.equal(xhr.headers.authorization,'Bearer qa');assert(xhr.timeout>=45*60_000);
 xhr.upload.onprogress({lengthComputable:true,loaded:5,total:10});assert.equal(progress.at(-1).percent,50);assert.equal(progress.at(-1).phase,'uploading');
 xhr.upload.onload();assert.equal(progress.at(-1).phase,'converting');
 xhr.onprogress({lengthComputable:false,loaded:7,total:0});assert.equal(progress.at(-1).phase,'receiving');assert.equal(progress.at(-1).percent,undefined);
 xhr.status=200;xhr.response=new Blob(['%PDF-1.7'],{type:'application/pdf'});xhr.onload();assert.equal((await pending).type,'application/pdf');
 const aborted=convertPresentationFile({file:new File(['x'],'Deck.pptx'),endpoint:'/',token:'qa',signal:cancel.signal,createRequest:()=>new XHR()});cancel.abort();await assert.rejects(aborted,e=>e.name==='AbortError');assert.equal(XHR.last.aborted,true);
 const failed=convertPresentationFile({file:new File(['x'],'Deck.pptx'),endpoint:'/',token:'qa',signal:new AbortController().signal,createRequest:()=>new XHR()});XHR.last.status=413;XHR.last.response=new Blob([JSON.stringify({error:'Too large',code:'upload-limit'})],{type:'application/json'});XHR.last.onload();await assert.rejects(failed,e=>e.status===413&&e.code==='upload-limit'&&e.message==='Too large');
 const invalid=convertPresentationFile({file:new File(['x'],'Deck.pptx'),endpoint:'/',token:'qa',signal:new AbortController().signal,createRequest:()=>new XHR()});XHR.last.status=200;XHR.last.response=new Blob(['bad'],{type:'text/plain'});XHR.last.onload();await assert.rejects(invalid,e=>e.code==='invalid-output');
 console.log('PASS client inclusive PDF/PPTX limit, conversion upload/download progress, cancellation, precise server error and invalid output');
})().catch(e=>{console.error(e);process.exitCode=1;});
