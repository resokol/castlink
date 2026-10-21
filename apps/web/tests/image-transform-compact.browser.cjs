// Render actual controls with the production global/theme cascade in Chromium.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..');
const qa = createRequire(path.resolve(web, '../../.qa/tools/package.json'));
const { chromium } = qa('playwright');
const esbuild = qa('esbuild');
const out = path.resolve(web, '../../.qa/image-transform-compact');
fs.mkdirSync(out, { recursive: true });
const entry = path.join(out, 'entry.tsx');
fs.writeFileSync(entry, `import React,{useState} from 'react';import{createRoot}from'react-dom/client';import Controls from '@/components/multiview/ImageTransformControls';function App(){const[value,setValue]=useState({});return <main className="graphite-workspace studio-page"><section className="source-browser"><article className="source-card"><Controls compact value={value} onChange={setValue}/><output>{JSON.stringify(value)}</output></article></section></main>}createRoot(document.getElementById('root')).render(<App/>);`);
(async () => {
 await esbuild.build({entryPoints:[entry],outfile:path.join(out,'bundle.js'),bundle:true,jsx:'automatic',platform:'browser',format:'iife',alias:{'@':web},nodePaths:[path.join(web,'node_modules')],define:{'process.env.NODE_ENV':'"production"'}});
 const css = fs.readFileSync(path.join(out,'bundle.css'),'utf8') + '\n' + ['app/globals.css','app/graphite-workspace.css','../../design-preview/new/operations-theme.css'].map(file=>fs.readFileSync(path.join(web,file),'utf8')).join('\n');
 const browser = await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox']});
 try {for(const theme of ['dark','light']) for(const width of [240,300,440]) {
  const page=await browser.newPage({viewport:{width:width+40,height:650}});
  await page.setContent(`<!doctype html><html data-theme="${theme}" data-design-preview="on"><meta charset="utf-8"><style>${css}body{margin:0}.source-card{width:${width}px;box-sizing:border-box}</style><div id="root"></div></html>`);
  await page.addScriptTag({path:path.join(out,'bundle.js')});
  const zoom=page.getByRole('spinbutton',{name:'Зум',exact:true});await zoom.waitFor();
  const geometry=await zoom.evaluate(e=>({height:e.getBoundingClientRect().height,padding:getComputedStyle(e).padding,fontSize:getComputedStyle(e).fontSize,overflows:e.closest('[role=group]').scrollWidth>e.closest('[role=group]').clientWidth}));
  assert.equal(geometry.height,25,`${theme}/${width}: numeric control must fit 25px field row (${JSON.stringify(geometry)})`);
  assert.equal(geometry.fontSize,'11px');assert.equal(geometry.overflows,false);
  await zoom.fill('2');await zoom.press('Tab');assert.match(await page.locator('output').textContent(),/"zoom":2/);
  const rotation=page.getByRole('spinbutton',{name:'Поворот',exact:true});await rotation.fill('45');await rotation.press('Tab');assert.match(await page.locator('output').textContent(),/"rotation":45/);
  await page.getByText('Кадрирование',{exact:true}).click();assert.equal(await page.getByRole('spinbutton',{name:'Сверху',exact:true}).isVisible(),true);
  await page.screenshot({path:path.join(out,`${theme}-${width}.png`),fullPage:true});await page.close();
 }} finally {await browser.close()}
 console.log('PASS compact transform controls: real CSS cascade, 240/300/440px, dark/light, zoom/rotation/crop; '+out);
})().catch(error=>{console.error(error);process.exitCode=1});
