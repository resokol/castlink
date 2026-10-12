const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const {createRequire} = require('node:module');
const {load, root} = require('./i18n.cjs');
const req = createRequire(path.join(root, 'package.json'));
const {chromium} = process.env.CASTLINK_PLAYWRIGHT_PATH ? require(process.env.CASTLINK_PLAYWRIGHT_PATH) : req('playwright');
const React = req('react');
const {renderToString} = req('react-dom/server');
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-i18n-browser-'));
const entry = path.join(temp, 'probe.tsx');
fs.writeFileSync(entry, `
import React, { useEffect, useState } from ${JSON.stringify(req.resolve('react'))};
import { hydrateRoot } from ${JSON.stringify(req.resolve('react-dom/client'))};
import { I18nProvider, useI18n } from "@/components/I18nProvider";
import { InlineLanguageSwitcher } from "@/components/LanguageSwitcher";
export function MediaProbe() {
  const [device] = useState("chosen-camera");
  useEffect(() => {
    window.mediaMounts = (window.mediaMounts || 0) + 1;
    return () => { window.mediaDisconnects = (window.mediaDisconnects || 0) + 1; };
  }, []);
  return <video data-device={device} muted />;
}
export function Probe() {
  const { t, locale } = useI18n();
  const [status] = useState("Соединение восстановлено.");
  const [name, setName] = useState("Страница не найдена <>&");
  return <main><h1>{t("Страница не найдена")}</h1><p id="dynamic-status">{t(status)}</p><input value={name} onChange={event=>setName(event.target.value)} /><p id="name">{name}</p><p id="locale">{locale}</p><InlineLanguageSwitcher /><MediaProbe /></main>;
}
export function App() { return <I18nProvider><Probe /></I18nProvider>; }
if (typeof window !== "undefined") hydrateRoot(document.getElementById("root"), <App />);
`);
const loader = path.join(temp, 'typescript-loader.cjs');
fs.writeFileSync(loader, `const ts = require(${JSON.stringify(req.resolve('typescript'))});module.exports = function(source) {return ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2020,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;};`);
const webpack = req('next/dist/compiled/webpack/webpack'); webpack.init();
async function main() {
  await new Promise((resolve,reject)=>webpack.webpack({ mode:'development', entry, devtool:false, output:{path:temp,filename:'bundle.js'}, resolve:{extensions:['.ts','.tsx','.js'],alias:{'@':root,'react':path.dirname(req.resolve('react')),'react-dom':path.dirname(req.resolve('react-dom'))}}, module:{rules:[{test:/\.tsx?$/,use:loader}]}, optimization:{minimize:false}},(error,stats)=>error?reject(error):stats.hasErrors()?reject(Error(stats.toString({all:false,errors:true}))):resolve()));
  const {App} = load(entry);
  const html = '<!doctype html><html lang="ru"><head><meta charset="utf-8"></head><body><div id="root">' + renderToString(React.createElement(App)) + '</div><script src="/bundle.js"></script></body></html>';
  const server = http.createServer((request,response)=>{response.setHeader('content-type',request.url==='/bundle.js'?'text/javascript; charset=utf-8':'text/html; charset=utf-8');response.end(request.url==='/bundle.js'?fs.readFileSync(path.join(temp,'bundle.js')):html);});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const origin = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM || '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
  try {
    const context = await browser.newContext(); const page = await context.newPage(); const errors=[];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',message=>{if(message.type()==='error')errors.push(message.text());});
    await page.goto(origin); await page.waitForFunction(()=>window.mediaMounts===1);
    assert.equal(await page.locator('h1').innerText(),'Страница не найдена');
    await page.evaluate(()=>{window.originalVideo=document.querySelector('video');});
    for (const [locale,heading,status] of [['en','Page not found','Connection restored.'],['zh-CN','页面未找到','连接已恢复。'],['ru','Страница не найдена','Соединение восстановлено.']]) {
      await page.locator('select').selectOption(locale);
      await page.waitForFunction(expected=>document.documentElement.lang===expected,locale);
      assert.equal(await page.locator('h1').innerText(),heading);
      assert.equal(await page.locator('#dynamic-status').innerText(),status);
      assert.equal(await page.locator('#name').innerText(),'Страница не найдена <>&');
      assert.equal(await page.evaluate(()=>document.querySelector('video')===window.originalVideo && window.mediaMounts===1 && !window.mediaDisconnects),true,'Switching must preserve the active media component and device state');
    }
    await page.locator('input').fill('My edited room'); await page.locator('select').selectOption('en');
    assert.equal(await page.locator('input').inputValue(),'My edited room');
    const second = await context.newPage(); await second.goto(origin); await second.waitForFunction(()=>document.documentElement.lang==='en');
    assert.equal(await second.locator('h1').innerText(),'Page not found','Stored language restores after Russian hydration');
    await page.locator('select').selectOption('zh-CN'); await second.waitForFunction(()=>document.documentElement.lang==='zh-CN');
    await second.reload(); await second.waitForFunction(()=>document.documentElement.lang==='zh-CN');
    assert.deepEqual(errors,[],'Hydration and switching must not produce browser errors');
    const restricted = await browser.newContext(); const privatePage=await restricted.newPage();
    await privatePage.addInitScript(()=>{Storage.prototype.getItem=function(){throw Error('Storage disabled');};Storage.prototype.setItem=function(){throw Error('Storage disabled');};});
    await privatePage.goto(origin); await privatePage.waitForFunction(()=>window.mediaMounts===1); await privatePage.locator('select').selectOption('en');
    assert.equal(await privatePage.locator('h1').innerText(),'Page not found','Switching remains functional without browser storage');
    await restricted.close(); await context.close();
    console.log('I18n browser hydration, switching, reactive statuses, persistence, tabs, restricted storage and media preservation passed');
  } finally { await browser.close(); await new Promise(resolve=>server.close(resolve)); fs.rmSync(temp,{recursive:true,force:true}); }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
