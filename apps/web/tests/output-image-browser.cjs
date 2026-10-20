// Optional browser regression; run with a separately installed Playwright module.
// Exercises production CSS and image transform code without a server or physical camera.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),ts=require('typescript');
const {firefox}=require(process.env.CASTLINK_PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
const compile=file=>ts.transpileModule(fs.readFileSync(path.join(root,'lib',file),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
(async()=>{
 const browser=await firefox.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:1920,height:1080}});
  await page.setContent('<main class="output-page"><div class="output-video"><video></video></div></main><main class="slot-output"><div class="slot-output-video"><video></video></div></main>');
  await page.addStyleTag({content:fs.readFileSync(path.join(root,'app/globals.css'),'utf8')});
  const results=await page.evaluate(({image,studio})=>{
   const imageModule={exports:{}};
   new Function('module','exports',image)(imageModule,imageModule.exports);
   const studioModule={exports:{}};
   new Function('module','exports','require',studio)(studioModule,studioModule.exports,()=>imageModule.exports);
   const results=[];
   for(const selector of ['.output-video video','.slot-output-video video']){
    const video=document.querySelector(selector);
    for(const transform of [{zoom:1.35},{zoom:2,panX:.2,panY:-.1,rotation:30,cropLeft:.1,flipX:true},{}]){
     studioModule.exports.applyStudioImageTransform(video,JSON.stringify({studioImageTransform:transform}));
     const actual=getComputedStyle(video),reference=document.createElement("div"); reference.style.cssText=video.style.cssText; reference.style.width=actual.width; reference.style.height=actual.height; document.body.appendChild(reference); const expected=new DOMMatrix(getComputedStyle(reference).transform),computed=new DOMMatrix(actual.transform); reference.remove();
     results.push({selector,transform,expected:[expected.a,expected.b,expected.c,expected.d,expected.e,expected.f],actual:[computed.a,computed.b,computed.c,computed.d,computed.e,computed.f],clip:actual.clipPath,expectedClip:video.style.clipPath});
    }
   }
   return results;
  },{image:compile('multiview-image.ts'),studio:compile('studio-image-transform.ts')});
  for(const row of results){
   row.expected.forEach((n,i)=>assert.ok(Math.abs(n-row.actual[i])<.001,JSON.stringify(row)));
   assert.equal(row.clip,row.expectedClip);
  }
  console.log('PASS real Firefox CSS: legacy and slot outputs honor saved zoom, pan, rotation, crop, flip and reset (6 cases)');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
