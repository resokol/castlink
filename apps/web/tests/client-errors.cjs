const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),ts=require("typescript");
require.extensions[".ts"]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
const {sanitizeClientError}=require("../lib/client-error-report.ts");
const {createBrowserErrorReporter,installBrowserErrorListeners}=require("../lib/browser-errors.ts");

test("crash reports keep standard failure kind and bundle frame while omitting URLs, JWT, passwords and arbitrary messages",()=>{
 const report=sanitizeClientError({kind:"error",at:Date.now(),route:"studio",build:"rc9-123",
 name:"TypeError",message:"Cannot read properties of undefined (reading 'secretPassword')",
 stack:"TypeError: password=plain-secret eyJabc.defghi.abcdef\n at render (https://castlink.ru/_next/static/chunks/123-abc.js:8:12)\n at call (https://castlink.ru/studio/private?invite=invite-secret#password)\n at https://castlink.ru/_next/static/chunks/789-def.js?token=private:10:2"});
 assert.equal(report.message,"Cannot read properties of undefined");
 assert.deepEqual(report.frames,["/_next/static/chunks/123-abc.js:8:12"]);
 assert.doesNotMatch(JSON.stringify(report),/plain-secret|secretPassword|eyJabc|invite-secret|private|password/i);
 assert.equal(sanitizeClientError({kind:"rejection",message:"my password is plain-value"}).message,"Message omitted");
 assert.equal(sanitizeClientError({kind:"boundary",message:"Minified React error #310; visit https://react.dev/errors/310?args[]=secret"}).message,"Minified React error #310");
});

test("server sanitization preserves the client's finite classifications",()=>{
 for(const message of ["Loading chunk abc-123 failed.", "thing is not a function", "thing is not defined", "Minified React error #310; URL", "Cannot read properties of undefined (reading secret)", "Cannot read properties of null", "Maximum update depth exceeded", "Rendered more hooks than during the previous render", "Rendered fewer hooks than expected", "Invalid hook call", "Maximum call stack size exceeded", "Too much recursion", "ResizeObserver loop", "Failed to fetch dynamically imported module", "private arbitrary content"]){
 const once=sanitizeClientError({kind:"error",message});assert.deepEqual(sanitizeClientError(once),once);
 }
});
test("sanitizer ignores extras, bounds all fields and tolerates hostile thrown objects",()=>{
 const evil={get message(){throw Error("getter");},get stack(){throw Error("getter");}};
 assert.doesNotThrow(()=>sanitizeClientError(evil));
 const report=sanitizeClientError({kind:"global-boundary",at:Infinity,route:"/studio/secret?token=foo",build:"private?token=secret",frames:Array.from({length:500},(_,i)=>"/_next/static/chunks/a.js:"+(i+1)+":2"),secret:"password"});
 assert.equal(report.route,"other");assert.equal(report.build,"unknown");assert.equal(report.frames.length,12);
 assert.equal("secret" in report,false);assert.ok(Number.isSafeInteger(report.at));
 const jwt="eyJhbGciOiJIUzI1NiJ9.eyJzZXNzaW9uIjoiU0VDUkVUIn0.fakeSignature";
 assert.doesNotMatch(JSON.stringify(sanitizeClientError({build:jwt,name:jwt,message:jwt,route:jwt})),/eyJ/);
});

test("reporter deduplicates a crash, bounds bursts and never rejects or reloads",async()=>{
 let now=1000;const sent=[];const reporter=createBrowserErrorReporter(body=>{sent.push(JSON.parse(body));return Promise.reject(Error("network"));},()=>now,()=>({route:"studio",build:"rc9-123"}));
 const error=new TypeError("Cannot read properties of undefined");
 for(let i=0;i<1000;i++)reporter("error",error);
 await Promise.resolve();assert.equal(sent.length,1);
 for(let i=0;i<20;i++)reporter("rejection",new Error("unknown"+i),"/_next/static/chunks/a.js:"+(i+1)+":2");
 assert.equal(sent.length,5);
 now+=60001;reporter("error",error);assert.equal(sent.length,6);
 assert.doesNotThrow(()=>reporter("error",{get name(){throw Error("hostile");}}));
 for(let minute=0;minute<20;minute++){now+=60001;for(let i=0;i<10;i++)reporter("error",error,"/_next/static/chunks/a.js:"+(i+1)+":1");}assert.equal(sent.length,20);
});


test("real browser transport sends no session credentials or referrer and swallows rejected fetch",async()=>{
 const oldWindow=global.window,oldFetch=global.fetch,calls=[];
 global.window={location:{pathname:"/studio/private-room?invite=PRIVATE"}};
 global.fetch=(url,options)=>{calls.push({url,options});return Promise.reject(Error("offline"));};
 try{
  const {reportBrowserError}=require("../lib/browser-errors.ts");
  for(let i=0;i<1000;i++)reportBrowserError("boundary",new TypeError("Cannot read properties of null"));
  await Promise.resolve();await Promise.resolve();
  assert.equal(calls.length,1);assert.equal(calls[0].url,"/api/client-errors");
  assert.equal(calls[0].options.credentials,"omit");assert.equal(calls[0].options.referrerPolicy,"no-referrer");
  assert.equal(calls[0].options.keepalive,true);assert.doesNotMatch(calls[0].options.body,/PRIVATE|private-room|invite/);
 }finally{global.window=oldWindow;global.fetch=oldFetch;}
});

test("window observers report without cancelling errors and fully remove listeners",()=>{
 const target=new EventTarget(),reported=[];const cleanup=installBrowserErrorListeners(target,(...args)=>reported.push(args));
 const error=new Event("error",{cancelable:true});Object.defineProperties(error,{error:{value:new TypeError("x")},filename:{value:"https://host/_next/static/chunks/a.js"},lineno:{value:9},colno:{value:2}});
 target.dispatchEvent(error);assert.equal(error.defaultPrevented,false);assert.equal(reported[0][0],"error");
 const rejected=new Event("unhandledrejection",{cancelable:true});Object.defineProperty(rejected,"reason",{value:{get message(){throw Error("no");}}});
 assert.doesNotThrow(()=>target.dispatchEvent(rejected));assert.equal(rejected.defaultPrevented,false);
 cleanup();target.dispatchEvent(error);assert.equal(reported.length,2);
});


test("API permits at most four pending bodies and releases capacity after completion",async()=>{
 const {NextRequest}=require("next/server"),{POST}=require("../app/api/client-errors/route.ts");
 const controls=[],pending=[],old=console.error;console.error=()=>{};
 try{
  for(let i=0;i<4;i++){
   const body=new ReadableStream({start(controller){controls.push(controller);}});
   const req=new NextRequest("https://castlink.ru/api/client-errors",{method:"POST",headers:{origin:"https://castlink.ru","content-type":"application/json","x-forwarded-for":"pending-"+i},body,duplex:"half"});
   pending.push(POST(req));
  }
  const refused=await POST(new NextRequest("https://castlink.ru/api/client-errors",{method:"POST",headers:{origin:"https://castlink.ru","content-type":"application/json"},body:"{}"}));
  assert.equal(refused.status,429);
  for(const c of controls){c.enqueue(new TextEncoder().encode('{"kind":"error"}'));c.close();}
  assert.deepEqual((await Promise.all(pending)).map(r=>r.status),[202,202,202,202]);
 }finally{console.error=old;for(const c of controls){try{c.close();}catch{}}}
});


test("API cancels stalled bodies at its deadline and releases reader capacity",async()=>{
 const {NextRequest}=require("next/server"),{POST}=require("../app/api/client-errors/route.ts");
 const oldTimeout=global.setTimeout;let cancelled=false;
 global.setTimeout=(fn,ms,...args)=>oldTimeout(fn,ms===2000?5:ms,...args);
 try{
  const body=new ReadableStream({cancel(){cancelled=true;}});
  const response=await POST(new NextRequest("https://castlink.ru/api/client-errors",{method:"POST",headers:{origin:"https://castlink.ru","content-type":"application/json","x-forwarded-for":"stalled"},body,duplex:"half"}));
  assert.equal(response.status,408);await Promise.resolve();assert.equal(cancelled,true);
 }finally{global.setTimeout=oldTimeout;}
});

test("API enforces origin, streamed body bound, source/global limits and server sanitization",async()=>{
 const {NextRequest}=require("next/server"),{POST}=require("../app/api/client-errors/route.ts");
 const logs=[],old=console.error;console.error=line=>logs.push(JSON.parse(line));
 const payload={kind:"boundary",at:Date.now(),route:"studio",build:"rc9-123",message:"my password is PRIVATE",frames:["/_next/static/chunks/a.js:2:3"],extra:"SECRET"};
 const req=(body=JSON.stringify(payload),origin="https://castlink.ru",ip="10.0.0.1")=>new NextRequest("https://castlink.ru/api/client-errors",{method:"POST",headers:{"content-type":"application/json",origin,"x-forwarded-for":ip},body});
 try{
  assert.equal((await POST(req(undefined,"https://other.example"))).status,403);
  assert.equal((await POST(req("x".repeat(9000)))).status,413);
  assert.equal((await POST(req("{"))).status,400);
  assert.equal((await POST(req())).status,202);
  assert.equal(logs.length,1);assert.equal(logs[0].event,"browser.crash");
  assert.doesNotMatch(JSON.stringify(logs),/PRIVATE|SECRET|password/);
  assert.ok(logs[0].ts);assert.ok(logs[0].serverBuild);
  for(let i=0;i<5;i++)await POST(req());
  assert.equal((await POST(req())).status,429);
  let limited=false;
  for(let i=0;i<125;i++){if((await POST(req(undefined,undefined,"source-"+i))).status===429){limited=true;break;}}
  assert.equal(limited,true);
 }finally{console.error=old;}
});

test("React fallbacks retain alert actions; global fallback works without I18n/context and never auto resets",()=>{
 const React=require("react"),Module=require("module"),oldLoad=Module._load;
 require.extensions[".tsx"]=(m,f)=>m._compile(ts.transpileModule(fs.readFileSync(f,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX,target:ts.ScriptTarget.ES2022,esModuleInterop:true}}).outputText,f);
 const effects=[];let fallbackLocale="ru";Module._load=function(name,...rest){if(name==="react")return {...React,useEffect:fn=>effects.push(fn),useState:()=>[fallbackLocale,()=>{}]};if(name==="@/components/I18nProvider")return {useI18n:()=>({t:s=>s,locale:"ru"})};if(name.startsWith("@/"))return oldLoad.call(this,path.join(__dirname,"..",name.slice(2)),...rest);return oldLoad.call(this,name,...rest);};
 try{
  let resets=0;const props={error:new Error("PRIVATE"),reset:()=>resets++};
  const ErrorPage=require("../app/error.tsx").default,GlobalError=require("../app/global-error.tsx").default;
  const {renderToStaticMarkup}=require("react-dom/server");
  const html=renderToStaticMarkup(ErrorPage(props)),global=renderToStaticMarkup(GlobalError(props));
  assert.match(html,/role="alert"/);assert.match(global,/<html/);assert.match(global,/button/);
  assert.doesNotMatch(html+global,/PRIVATE/);assert.equal(resets,0);assert.equal(effects.length,2);
  fallbackLocale="en";assert.match(renderToStaticMarkup(GlobalError(props)),/Try again/);
  fallbackLocale="zh-CN";assert.match(renderToStaticMarkup(GlobalError(props)),/重试/);
 }finally{Module._load=oldLoad;}
});
