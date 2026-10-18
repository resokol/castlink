// Actual React-rendered GuestAvCheck with production CSS; no capture permissions or media transport.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),Module=require('node:module'),ts=require('typescript');
const web=path.resolve(__dirname,'..'),req=Module.createRequire(`${web}/package.json`),React=req('react'),{renderToStaticMarkup}=req('react-dom/server'),{chromium}=req('playwright');
const out=fs.mkdtempSync(path.join(os.tmpdir(),'castlink-guest-av-layout-'));
for(const ext of ['.ts','.tsx'])Module._extensions[ext]=(module,file)=>module._compile(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,file);
Module._extensions['.css']=module=>{module.exports={default:new Proxy({},{get:(_target,key)=>key})};};
const {workspacesMessages}=require('../lib/i18n/workspaces.ts');let locale='ru';
const t=source=>locale==='ru'?source:workspacesMessages[source]?.[locale==='en'?0:1]||source;
const load=Module._load;Module._load=function(name,...args){if(name==='@/components/I18nProvider')return{useI18n:()=>({locale,t})};if(name.startsWith('@/'))return req(path.join(web,name.slice(2)));return load.call(this,name,...args);};const {GuestAvCheck}=require('../components/GuestAvCheck.tsx');Module._load=load;
let browser;
(async()=>{
 browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage']});const page=await browser.newPage();const results=[];
 for(const selectedLocale of ['ru','en','zh-CN']){locale=selectedLocale;const html=renderToStaticMarkup(React.createElement(GuestAvCheck,{name:'Caster',onJoin(){}}));
  for(const width of [1440,760,390,320])for(const theme of ['dark','light'])for(const active of [false,true]){
   await page.setViewportSize({width,height:900});await page.setContent(`<!doctype html><html data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${fs.readFileSync(`${web}/app/globals.css`,'utf8')}\n${fs.readFileSync(`${web}/components/AudioMeter.module.css`,'utf8')}</style>${html}</html>`);
   const labels=['Проверить микрофон','Проверить камеру','Проверить наушники / динамики'].map(t),stopLabels=['Остановить тест микрофона','Остановить тест камеры','Остановить тест звука'].map(t),joinLabel=t('Войти в конференцию');
   const info=await page.evaluate(({labels,stopLabels,joinLabel,active})=>{
    const rect=element=>{const r=element.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,right:r.right,bottom:r.bottom};};const buttons=[...document.querySelectorAll('button')],tests=labels.map(label=>buttons.find(b=>b.textContent===label)),join=buttons.find(b=>b.textContent===joinLabel);if(active)tests.forEach((b,i)=>{b.textContent=stopLabels[i];b.setAttribute('aria-pressed','true');});const sameParent=tests.every(b=>b.parentElement===tests[0].parentElement);return{pageWidth:document.documentElement.scrollWidth,panel:rect(document.querySelector('.av-check')),sameParent,testRects:tests.map(rect),join:rect(join),joinParent:rect(join.parentElement),testOverflow:tests.map(b=>b.scrollWidth>b.clientWidth+1||b.scrollHeight>b.clientHeight+1)};
   },{labels,stopLabels,joinLabel,active});
   const failures=[];if(!info.sameParent)failures.push('test buttons split across action groups');if(info.pageWidth>width+1)failures.push('horizontal page overflow');if(info.testOverflow.some(Boolean))failures.push('button text overflows');const [a,b,c]=info.testRects;if(width>=760&&Math.max(a.y,b.y,c.y)-Math.min(a.y,b.y,c.y)>1)failures.push('desktop test buttons not one row');if(Math.max(a.w,b.w,c.w)-Math.min(a.w,b.w,c.w)>1)failures.push('test columns unequal');if(Math.max(a.h,b.h,c.h)-Math.min(a.h,b.h,c.h)>1)failures.push('test buttons not equal height');if(Math.min(a.h,b.h,c.h)<44)failures.push('test touch targets too short');if(info.join.y<Math.max(a.bottom,b.bottom,c.bottom)+7)failures.push('join not below all tests');if(Math.abs(info.join.w-info.joinParent.w)>1)failures.push('join not full action width');results.push({locale,width,theme,active,failures,...info});
   if(width===390&&selectedLocale==='ru'&&!active)await page.screenshot({path:`${out}/${theme}-390.png`,fullPage:true});
  }
 }
 fs.writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({out,cases:results.length,failures:results.filter(r=>r.failures.length).slice(0,8).map(({locale,width,theme,active,failures})=>({locale,width,theme,active,failures}))}));assert.ok(results.every(r=>!r.failures.length),'guest AV tests form equal aligned columns with join fullwidth below at every locale/theme/viewport/state');
})().catch(error=>{console.error(error);process.exitCode=1;}).finally(async()=>{await browser?.close();});
