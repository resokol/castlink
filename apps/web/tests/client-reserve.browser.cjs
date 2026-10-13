// Real Chromium and HTTP requests for the browser capability transport.
// API responses are a fixture; full application/LiveKit acceptance is separate.
const assert = require('node:assert/strict');
const http = require('node:http');
const fs = require('node:fs'); const path = require('node:path'); const ts = require('typescript');
const {chromium} = require('playwright');
const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const close = server => new Promise(resolve => server.close(resolve));
const modules = ['transfer-origin','client-transfer','client-reserve'];
const bundle = `const modules={${modules.map(name=>`${JSON.stringify('./'+name)}:(module,exports,require)=>{${ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib',name+'.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText}\n}`).join(',')}};const cache={};function require(name){if(cache[name])return cache[name].exports;const module={exports:{}};cache[name]=module;modules[name](module,module.exports,require);return module.exports;}window.ReserveClient=require('./client-reserve').ReserveClient;`;
(async()=>{
 let sourceOrigin, reserveOrigin, prepared, committed=false, loseResponse=true;
 const requests=[];
 const reserve = http.createServer(async(req,res)=>{
  res.setHeader('Access-Control-Allow-Origin',sourceOrigin);res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Allow-Headers','authorization,content-type');res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');
  if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
  let raw='';for await(const chunk of req)raw+=chunk;
  const body=JSON.parse(raw);requests.push({body,cookie:req.headers.cookie,origin:req.headers.origin,authorization:req.headers.authorization});
  assert.equal(req.headers.origin,sourceOrigin);assert.equal(req.headers.authorization,'Bearer browser-own-grant');assert.equal(req.headers.cookie,undefined);
  if(body.action==='activate'){committed=true;if(loseResponse){loseResponse=false;res.destroy();return;}}
  res.setHeader('content-type','application/json');res.end(JSON.stringify(body.action==='status'?{status:committed?'committed':'armed',operationId:committed?'committed-op':undefined,cohortId:'cohort',armGeneration:1}:{status:'committed',operationId:'committed-op',ticket:'one-use-browser-ticket',targetUrl:reserveOrigin}));
 });
 const source = http.createServer((req,res)=>{
  if(req.url.startsWith('/api/server-reserve')){res.setHeader('content-type','application/json');res.end(JSON.stringify({armed:true,prepared}));}
  else{res.setHeader('content-type','text/html');res.end(`<meta charset="utf-8"><title>Reserve transport fixture</title><script>${bundle}</script>`);}
 });
 let browser;
 try{
  await listen(reserve);await listen(source);
  sourceOrigin=`http://127.0.0.1:${source.address().port}`;reserveOrigin=`http://localhost:${reserve.address().port}`;
  prepared={peerId:'peer',targetId:'reserve',label:'Reserve',targetUrl:reserveOrigin,cohortId:'cohort',armGeneration:1,revision:1,snapshotAt:Date.now(),readyUntil:Date.now()+299000,grant:'browser-own-grant',role:'studio'};
  browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  const context=await browser.newContext();await context.addCookies([{name:'source-session',value:'source-cookie',url:sourceOrigin},{name:'reserve-session',value:'reserve-cookie',url:reserveOrigin}]);
  const page=await context.newPage();await page.goto(sourceOrigin);
  await page.evaluate(async()=>{
   window.states=[];window.handoffs=[];window.timeOffset=0;
   window.client=new window.ReserveClient({studioId:'studio',room:'room',token:'source-jwt',clientId:'primary',canActivate:true,now:()=>Date.now()+window.timeOffset,onChange:value=>window.states.push(value),onHandoff:async value=>window.handoffs.push(value)});
   await window.client.refresh();await window.client.poll();
  });
  assert.equal(await page.evaluate(()=>window.client.view.phase),'ready', await page.evaluate(()=>window.client.view.error));assert.equal(requests.some(request=>request.body.action==='activate'),false);
  await close(source);
  await page.evaluate(async()=>{await window.client.refresh();await window.client.poll();});
  assert.equal(await page.evaluate(()=>window.handoffs.length),0,'stopped source does not trigger transfer');
  await page.evaluate(async()=>{await Promise.all([window.client.activate(),window.client.activate()]);await window.client.poll();});
  assert.equal(new Set(requests.filter(request=>request.body.action==='activate').map(request=>request.body.operationId)).size,1,'duplicate clicks and browser HTTP retries share one operation');
  assert.equal(await page.evaluate(()=>window.handoffs.length),1,'lost response recovered by direct reserve polling');
  assert.equal(await page.evaluate(()=>window.handoffs[0].ticket),'one-use-browser-ticket');
  await page.evaluate(async()=>{window.timeOffset=400000;await window.client.poll();});
  assert.equal(await page.evaluate(()=>window.client.view.phase),'stale');
  console.log('PASS: Chromium exact CORS/bearer transport omits both servers cookies; offline source stays manual; duplicate click and lost response converge; readiness expires');
 }finally{if(browser)await browser.close();if(source.listening)await close(source);if(reserve.listening)await close(reserve);}
})().catch(error=>{console.error(error);process.exitCode=1});
