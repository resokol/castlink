// Render real settings components; device/media behavior is tested separately.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { createRequire } = require('node:module');
const req = createRequire(path.resolve(__dirname, '../package.json'));
const React = req('react'), { renderToStaticMarkup } = req('react-dom/server');
const { chromium } = req('playwright');
const { load } = require('./load-typescript.cjs');
let locale = 'ru';
const i18n = { useI18n: () => ({ locale, t: source => source }) };
const { GuestSettingsPanel } = load('../components/GuestSettingsPanel.tsx', {
  '@/components/I18nProvider': i18n, './I18nProvider': i18n,
  './CoPresentationNavigation': { useCoPresentationNavigation: () => ({ autoAccept: true, preferencesReady: true, setAutoAccept() {} }) },
});
const css = ['../app/globals.css', '../app/graphite-workspace.css', '../components/native-pptx.css'].map(file => fs.readFileSync(path.resolve(__dirname, file), 'utf8')).join('\n');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-entry-settings-'));
let browser;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY, headless: true });
  const page = await browser.newPage();
  let cases = 0;
  for (locale of ['ru', 'en', 'zh-CN']) for (const width of [390, 1440]) for (const theme of ['dark', 'light']) {
    await page.setViewportSize({ width, height: 900 });
    const markup = renderToStaticMarkup(React.createElement(GuestSettingsPanel, null, React.createElement('p', null, 'CastLink')));
    await page.setContent('<!doctype html><html data-theme="' + theme + '"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><style>' + css + '</style><main class="media-page guest-room-page guest-app-shell graphite-workspace caster-workspace">' + markup + '</main></html>');
    assert.equal(await page.locator('.screen-share-settings').isVisible(), false, 'preference stays inside the closed menu');
    await page.locator('.guest-settings-toggle').click();
    await page.locator('.screen-share-settings').waitFor({ state: 'visible' });
    const sizes = await page.locator('.screen-share-settings').evaluate(section => {
      const input = section.querySelector('input'), label = section.querySelector('label'), r = section.getBoundingClientRect(), checkbox = input.getBoundingClientRect();
      return { count: document.querySelectorAll('.screen-share-settings').length, width: checkbox.width, height: checkbox.height, target: label.getBoundingClientRect().height, display: getComputedStyle(label).display, labelTop: label.querySelector('span').getBoundingClientRect().top, inputTop: checkbox.top, left: r.left, right: r.right, viewport: innerWidth, overflow: section.scrollWidth > section.clientWidth + 1 };
    });
    assert.equal(sizes.count, 1);
    assert.equal(sizes.display, 'flex', 'checkbox and caption stay in one row under workspace CSS');
    assert.ok(Math.abs(sizes.labelTop - sizes.inputTop) < 12, 'caption stays beside the checkbox');
    assert.equal(sizes.width, 18);
    assert.equal(sizes.height, 18);
    assert.ok(sizes.target >= 44, 'small checkbox retains a comfortable touch target');
    assert.ok(sizes.left >= 0 && sizes.right <= sizes.viewport && !sizes.overflow, JSON.stringify(sizes));
    if (locale === 'ru') await page.screenshot({ path: path.join(out, theme + '-' + width + '.png') });
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('.screen-share-settings').isVisible(), false);
    cases++;
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ cases, failures: [] }));
  console.log(JSON.stringify({ out, cases, failures: [] }));
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
