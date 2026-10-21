// Real production Share handler + slide controls, clicked in Chromium.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),http=require('node:http'),ts=require('typescript'),{chromium}=require('playwright');
const web=path.resolve(__dirname,'..'),source=ts.createSourceFile('panel.tsx',fs.readFileSync(path.join(web,'components/CoPresentationPanel.tsx'),'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX),handlers={};
(function visit(node){if(ts.isVariableDeclaration(node)&&['start','openControls'].includes(node.name.getText(source)))handlers[node.name.getText(source)]=node.initializer.getText(source);ts.forEachChild(node,visit);})(source);
const compile=value=>ts.transpileModule(value,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const entry=compile(`
import {createCoPresentationControls,slideControlsId} from '/co-presentation-controls.js';
const session={id:'deck',generation:'gen',controlRevision:1},controlledSessions=[session],activeControls=session,connected=true,busy=false,controlError=false;
const state={id:slideControlsId(session),title:'PDF / PPTX',controller:'You control',page:1,pages:4,canNavigate:true,canReclaim:false,busy:false,locale:'en'};
let inline=false;const setFloatingFailed=()=>{},setNativeGrant=()=>{},setSelectedControls=()=>{},setRecipientReopen=()=>{},setError=()=>{},setBusy=()=>{};
const menu={current:{showPopover(){inline=true;}}},isOwner=()=>true,presentationSharing=()=>false,controlsState=()=>state;
const mounted={current:true},generation={current:1},epoch={current:1},recipientScope={current:{}},floatingRequest={current:undefined},currentControlsGrant={current:state.id},ownRef={current:session},canvas={current:{}},fileRef={current:{}},text={failed:'Failed'};
window.qa={requests:[],publications:0,actions:[],inline:()=>inline};
const mode=new URLSearchParams(location.search).get('mode'),nativeApi=window.documentPictureInPicture;
const host=mode==='unsupported'?{}:{documentPictureInPicture:{requestWindow(size){window.qa.requests.push({active:navigator.userActivation.isActive,size});if(mode==='denied')return Promise.reject(new DOMException('Denied','NotAllowedError'));return nativeApi.requestWindow(size);}},document};
const controls={current:createCoPresentationControls({host,action:event=>window.qa.actions.push(event)})};
const capture={current:{async start(){window.qa.publications++;await new Promise(resolve=>setTimeout(resolve,350));}}};
const openControls=${handlers.openControls};const start=${handlers.start};
await controls.current.update(state);
document.querySelector('button').onclick=()=>void start();
window.qa.adapter=controls.current;window.qa.state=state;window.qa.ready=true;
`);
const server=http.createServer((request,response)=>{
 const url=new URL(request.url,'http://qa');response.setHeader('content-type',url.pathname.endsWith('.js')?'text/javascript':'text/html');
 if(url.pathname==='/entry.js')return response.end(entry);
 if(['/co-presentation-controls.js','/co-presentation-toolbar.js','/document-picture-in-picture.js'].includes(url.pathname))return response.end(compile(fs.readFileSync(path.join(web,'lib',url.pathname.slice(1).replace(/\.js$/,'.ts')),'utf8')).replace(/from '(\.\/[^']+)'/g,"from '$1.js'"));
 response.end('<!doctype html><meta charset="utf-8"><button>Show presentation</button><script type="module" src="/entry.js"></script>');
});
let browser;
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});
 const results=[];
 for(const mode of ['supported','denied','unsupported']){
  const page=await browser.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/?mode=${mode}`);await page.waitForFunction(()=>window.qa?.ready);
  await page.getByRole('button',{name:'Show presentation'}).click();
  await page.waitForFunction(mode=>mode==='supported'?!!documentPictureInPicture.window?.document.querySelector('[data-slide-toolbar]'):window.qa.inline(),mode);
  const result=await page.evaluate(mode=>({mode,requests:window.qa.requests,publications:window.qa.publications,inline:window.qa.inline(),toolbar:!!window.documentPictureInPicture?.window?.document.querySelector('[data-slide-toolbar]')}),mode);
  assert.equal(result.publications,1,'floating denial/unsupported never blocks publication');assert.deepEqual(errors,[]);
  if(mode==='supported'){
   assert.equal(result.toolbar,true);assert.equal(result.requests.length,1);assert.equal(result.requests[0].active,true,'native requestWindow receives live click activation');
   await page.evaluate(async()=>{documentPictureInPicture.window.close();await window.qa.adapter.update({...window.qa.state,page:2},true);});
   assert.equal(await page.evaluate(()=>window.qa.requests.length),1,'polling preserves dismissal');assert.equal(await page.evaluate(()=>window.qa.actions.length),0,'closing controls never issues stop/navigation');
  }else{assert.equal(result.inline,true);assert.equal(result.requests.length,mode==='denied'?1:0);}
  results.push(result);await page.close();
 }
 console.log(JSON.stringify({status:'PASS',results}));
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();await new Promise(resolve=>server.close(resolve));});
