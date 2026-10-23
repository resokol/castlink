// Real guest card, image controls, React and save queue. Room/API boundaries are fixtures.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..'), req = createRequire(path.join(web, 'package.json'));
const { chromium } = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-caster-color-'));
const write = (file, text) => { const target = path.join(out, file); fs.writeFileSync(target, text); return target; };
const loader = write('ts-loader.cjs', `const ts=require(${JSON.stringify(req.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);
const cssLoader = write('css-loader.cjs', `module.exports=function(s){const prefix='qa_'+require('node:crypto').createHash('md5').update(this.resourcePath).digest('hex').slice(0,6)+'_',names={},globals=[];s=s.replace(/:global\\(([^)]+)\\)/g,(_,v)=>'__GLOBAL_'+(globals.push(v)-1)+'__').replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,v)=>'.'+(names[v]=prefix+v)).replace(/__GLOBAL_(\\d+)__/g,(_,i)=>globals[i]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names);};`);
const adapter = write('adapter.ts', `import {translate} from '@/lib/i18n';export const RoomEvent=Object.fromEntries(['ParticipantConnected','ParticipantDisconnected','ParticipantMetadataChanged','Reconnected','Disconnected'].map(k=>[k,k]));export function useI18n(){const locale=new URLSearchParams(location.search).get('locale')||'ru';return{locale,t:(s,p)=>translate(locale,s,p)}}`);
const entry = write('entry.tsx', `import React from 'react';import{createRoot}from'react-dom/client';import{GuestVideoCard}from'@/components/GuestVideoCard';import{GuestAudioMeter}from'@/components/GuestAudioMeter';import{StudioCasterImageControls}from'@/components/StudioCasterImageControls';
const listeners=new Map(),initial={zoom:1.5,panX:.2,cropLeft:.1,flipX:true,exposure:.5,contrast:1.2},participant={sid:'PA-1',metadata:JSON.stringify({studioImageTransform:initial})};
const room={remoteParticipants:new Map([['guest-one',participant]]),on(e,f){let s=listeners.get(e);if(!s)listeners.set(e,s=new Set());s.add(f);return room},off(e,f){listeners.get(e)?.delete(f);return room}};
window.colorQA={room,initial,replace(){participant.sid='PA-2';participant.metadata=JSON.stringify({studioImageTransform:{zoom:1.7,cropLeft:.15,exposure:-.5,contrast:.8}});listeners.get('ParticipantConnected')?.forEach(f=>f())}};
const noop=()=>{};createRoot(document.getElementById('root')).render(<main className="graphite-workspace studio-page"><section className="source-browser"><div className="source-deck"><GuestVideoCard guest={{identity:'guest-one',name:'Caster',resolution:'1920×1080',bitrateKbps:4000,camera:true,microphone:true,packetLoss:0,jitterMs:0,rttMs:0,stability:'Хорошая'}} roomName="fixture" outputUrl="#" copied={false} receiveBitrate={4000} preference={{audio:true,video:true,volume:75}} onCopy={noop} onQualityChange={noop} onMonitoringChange={noop} preview={<div className="guest-preview-cell"><div className="studio-guest-video-wrap"><video muted/></div></div>} meter={<GuestAudioMeter/>} mediaControls={<StudioCasterImageControls room={room} roomName="fixture" identity="guest-one"/>}/></div></section></main>);`);
let browser;
(async () => {
  const wp = req('next/dist/compiled/webpack/webpack'); wp.init();
  await new Promise((resolve, reject) => wp.webpack({ mode: 'development', entry, devtool: false,
    output: { path: out, filename: 'bundle.js' }, resolve: { extensions: ['.ts', '.tsx', '.js'], alias: { '@/components/I18nProvider$': adapter, './I18nProvider$': adapter, 'livekit-client$': adapter, '@': web }, modules: [path.join(web, 'node_modules'), 'node_modules'] },
    module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.css$/, use: cssLoader }] }, optimization: { minimize: false } },
    (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({ all: false, errors: true }))) : resolve()));
  const css = ['app/globals.css', 'app/graphite-workspace.css', '../../design-preview/new/operations-theme.css'].map(file => fs.readFileSync(path.join(web, file), 'utf8')).join('\n');
  const labels = {
    ru: ['Настройки', 'Коррекция', 'Экспозиция', 'Контраст', 'Сбросить коррекцию', 'Зум', 'Сбросить изображение'],
    en: ['Settings', 'Correction', 'Exposure', 'Contrast', 'Reset correction', 'Zoom', 'Reset image'],
    'zh-CN': ['设置', '校正', '曝光', '对比度', '重置校正', '缩放', '重置图像'],
  };
  browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const proof = [], errors = [];
  for (const locale of ['ru', 'en', 'zh-CN']) for (const theme of ['dark', 'light']) for (const width of [240, 300, 350, 440]) {
    const page = await browser.newPage({ viewport: { width: width + 40, height: 1000 } });
    page.on('pageerror', error => errors.push(error.message));
    const requests = [];
    await page.route('http://castlink.test/**', route => {
      if (route.request().url().includes('/api/participants')) {
        const body = route.request().postDataJSON(); requests.push(body);
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ transform: body.transform }) });
      }
      return route.fulfill({ contentType: 'text/html', body: `<!doctype html><html data-theme="${theme}" data-design-preview="on"><meta charset="utf-8"><style>${css}body{margin:0;padding:12px}.source-card{width:${width}px;box-sizing:border-box}</style><div id="root"></div></html>` });
    });
    await page.goto(`http://castlink.test/?locale=${locale}`);
    await page.addScriptTag({ path: path.join(out, 'bundle.js') });
    const [settings, correction, exposure, contrast, resetCorrection, zoom, resetImage] = labels[locale];
    assert.equal(await page.getByRole('meter').getAttribute('aria-valuemin'), '-90', 'production GuestAudioMeter retains the dBFS scale');
    assert.equal(await page.getByRole('meter').locator('i').count(), 30, 'production segmented meter is retained');
    await page.locator('.source-card-advanced > summary').click();
    const panel = page.locator('details').filter({ has: page.locator('summary').getByText(correction, { exact: true }) }).last();
    assert.equal(await panel.locator('input[type=range]').count(), 2, 'only exposure and contrast are added');
    assert.equal(await panel.getByRole('slider', { name: exposure, exact: true }).isVisible(), false, 'correction starts collapsed');
    if (width === 300) await page.screenshot({ path: path.join(out, `${locale}-${theme}-${width}-collapsed.png`), fullPage: true });
    await panel.locator('summary').click();
    assert.equal(await page.getByRole('spinbutton', { name: zoom, exact: true }).inputValue(), '1.5', 'existing geometry survives color panel');
    const geometry = await panel.evaluate(element => ({ width: element.clientWidth, height: element.getBoundingClientRect().height, overflow: element.scrollWidth > element.clientWidth,
      children: [...element.querySelectorAll('summary,label,button,div')].map(e=>({tag:e.tagName,height:e.getBoundingClientRect().height,padding:getComputedStyle(e).padding,gap:getComputedStyle(e).gap,font:getComputedStyle(e).fontSize})),
      ranges: [...element.querySelectorAll('input[type=range]')].map(input => ({ label: input.getAttribute('aria-label'), height: input.getBoundingClientRect().height, disabled: input.disabled })) }));
    assert.equal(geometry.overflow, false, `${locale}/${theme}/${width}: correction fits compact card`);
    if (geometry.height > 120) await page.screenshot({ path: path.join(out, 'compact-failure.png'), fullPage: true });
    assert.ok(geometry.height <= 120, `${locale}/${theme}/${width}: two slider rows stay compact: ${JSON.stringify(geometry)}; ${out}`);
    assert.ok(geometry.ranges.every(input => input.height <= 25 && !input.disabled));
    if (locale === 'en' && theme === 'dark' && width === 300) {
      const setRange = (name, value) => page.getByRole('slider', { name, exact: true }).evaluate((input, value) => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, String(value)); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true }));
      }, value);
      await setRange(exposure, 1);
      await setRange(contrast, 1.4);
      await page.waitForFunction(() => document.querySelector('.studio-caster-image-controls [role=status]')?.textContent === 'Image applied');
      assert.deepEqual(requests.at(-1).transform, { zoom: 1.5, panX: .2, flipX: true, cropLeft: .1, exposure: 1, contrast: 1.4 }, 'shared save queue carries geometry and both color values');
      const color = requests.at(-1).transform;
      await panel.getByRole('button', { name: resetCorrection, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.studio-caster-image-controls [role=status]')?.textContent === 'Image applied');
      const { exposure: _, contrast: __, ...geometryOnly } = color;
      assert.deepEqual(requests.at(-1).transform, geometryOnly, 'color reset preserves all geometry');
      await page.getByRole('button', { name: resetImage, exact: true }).click();
      await page.waitForFunction(() => document.querySelector('.studio-caster-image-controls [role=status]')?.textContent === 'Image applied');
      assert.deepEqual(requests.at(-1).transform, {}, 'existing full image reset still resets the entire image');
    }
    await page.screenshot({ path: path.join(out, `${locale}-${theme}-${width}.png`), fullPage: true });
    proof.push({ locale, theme, width, geometry });
    await page.close();
  }
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify(proof, null, 2));
  console.log('PASS caster correction: actual guest card/save queue, exposure+contrast only, geometry-preserving color reset, complete reset, 240/300/350/440px RU/EN/ZH dark/light; ' + out);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
