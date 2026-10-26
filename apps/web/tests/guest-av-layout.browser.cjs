// Render the production preflight and its CSS. Media lifecycle is covered by guest-audio-profile-ui.cjs.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const ts = require('typescript');
const web = path.resolve(__dirname, '..');
const req = Module.createRequire(`${web}/package.json`);
const React = req('react');
const { renderToStaticMarkup } = req('react-dom/server');
const { chromium } = process.env.CASTLINK_QA_PLAYWRIGHT ? require(process.env.CASTLINK_QA_PLAYWRIGHT) : req('playwright');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-guest-preflight-'));
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
Module._extensions['.css'] = module => { module.exports = { default: new Proxy({}, { get: (_, key) => key }) }; };
const { workspacesMessages } = require('../lib/i18n/workspaces.ts');
let locale = 'ru';
const t = source => locale === 'ru' ? source : workspacesMessages[source]?.[locale === 'en' ? 0 : 1] || source;
const original = Module._load;
Module._load = function(name, ...args) {
  if (name === '@/components/I18nProvider' || name === './I18nProvider') return { useI18n: () => ({ locale, t, setLocale() {} }) };
  if (name === './AppChrome' || name === '@/components/AppChrome') return { AppFooterSlot: () => null };
  if (name.startsWith('@/')) return req(path.join(web, name.slice(2)));
  return original.call(this, name, ...args);
};
const { GuestAvCheck } = require('../components/GuestAvCheck.tsx');
Module._load = original;
const css = ['app/globals.css', 'components/EntryFlow.module.css', 'components/AudioMeter.module.css', 'components/GuestPreflight.module.css'].map(file => fs.readFileSync(path.join(web, file), 'utf8').replace(/:global\(([^)]+)\)/g, '$1')).join('\n');
let browser;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const page = await browser.newPage();
  const results = [];
  for (const selectedLocale of ['ru', 'en', 'zh-CN']) {
    locale = selectedLocale;
    const html = renderToStaticMarkup(React.createElement(GuestAvCheck, { name: 'Анна', roomName: 'Вечерний эфир', entrySettings: { audioOnly: true, startMuted: true, noGuestAudio: false }, onBack() {}, onJoin() {} }));
    for (const width of [1440, 1080, 760, 390, 320]) for (const theme of ['dark', 'light']) for (const advanced of [false, true]) {
      await page.setViewportSize({ width, height: 900 });
      await page.setContent(`<!doctype html><html lang="${locale}" data-theme="${theme}"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style>${html}</html>`);
      if (advanced) await page.locator('.preflight .advanced').evaluate(element => { element.open = true; });
      const info = await page.evaluate(() => {
        const rect = element => { const r = element.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
        const panel = document.querySelector('.devices');
        const preview = document.querySelector('.preview');
        const join = document.querySelector('.guest-av-join-actions button');
        const tests = [...document.querySelectorAll('.guest-av-check-actions button')];
        const cameraSelects = [...document.querySelectorAll('.cameraSetting select')];
        return {
          pageWidth: document.documentElement.scrollWidth,
          viewport: innerWidth,
          headingCount: document.querySelectorAll('h1').length,
          nameInPanel: panel.contains(document.querySelector('input[name="displayName"]')),
          preview: rect(preview), panel: rect(panel), join: rect(join),
          joinDisabled: join.disabled,
          testRects: tests.map(rect),
          cameraControls: cameraSelects.map(element => ({...rect(element),value:element.value,options:[...element.options].map(option=>option.value),label:element.closest("label").textContent})),
          overflow: [...document.querySelectorAll('.preflight button, .preflight input, .preflight select')].filter(element => element.getClientRects().length && element.scrollWidth > element.clientWidth + 2).map(element => element.textContent),
        };
      });
      const failures = [];
      if (info.pageWidth > width + 1) failures.push('page overflow');
      if (info.headingCount !== 1) failures.push('page heading count');
      if (!info.nameInPanel) failures.push('name is separated from devices');
      if (info.join.height < 44 || info.joinDisabled) failures.push('connect action is inaccessible');
      if (Math.abs(info.join.width - (info.panel.width - 42)) > 2) failures.push('connect action is not full panel width');
      if (info.overflow.length) failures.push('control contents overflow');
      if (width > 600 && info.panel.x < info.preview.right + 20) failures.push('desktop columns overlap');
      if (width <= 600 && info.panel.y <= info.preview.bottom) failures.push('mobile panel is not below preview');
      if (advanced && info.testRects.some(rect => rect.height < 44)) failures.push('advanced controls too short');
      if (info.cameraControls.length !== 2 || info.cameraControls.some(control => control.value !== 'auto')) failures.push('camera defaults missing');
      if (JSON.stringify(info.cameraControls[0]?.options) !== JSON.stringify(['auto','720p','1080p'])) failures.push('resolution options missing');
      if (JSON.stringify(info.cameraControls[1]?.options) !== JSON.stringify(['auto','15','30','50','60'])) failures.push('FPS options missing');
      if (advanced && info.cameraControls.some(control => control.height < 40 || control.x < info.panel.x || control.right > info.panel.right)) failures.push('camera select geometry');
      results.push({ locale, width, theme, advanced, failures, ...info });
      if ([1080, 390].includes(width) && locale === 'ru') await page.screenshot({ path: `${out}/${theme}-${width}${advanced ? '-advanced' : ''}.png`, fullPage: true });
    }
  }
  fs.writeFileSync(`${out}/results.json`, JSON.stringify(results, null, 2));
  console.log(JSON.stringify({ out, cases: results.length, failures: results.filter(result => result.failures.length).slice(0, 10) }));
  assert.ok(results.every(result => !result.failures.length), 'preflight remains usable across viewports, locales, themes and advanced settings');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
