// Production card markup and styles in Chromium; no physical device/SFU claims.
require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const Module = require('node:module');
const ts = require('typescript');
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
Module._extensions['.css'] = module => { module.exports = { default: new Proxy({}, { get: (_, key) => key }) }; };
const originalLoad = Module._load;
Module._load = function (name, ...args) {
  if (name.startsWith('@/') && !name.startsWith('@/lib/i18n') && name !== '@/components/I18nProvider') {
    const file = path.join(__dirname, '..', name.slice(2));
    return originalLoad.call(this, fs.existsSync(file + '.tsx') ? file + '.tsx' : file + '.ts', ...args);
  }
  return originalLoad.call(this, name, ...args);
};
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { chromium } = require('playwright');
const { GuestVideoCard } = require('../components/GuestVideoCard.tsx');
const { ParticipantSourceCard } = require('../components/ParticipantSourceCard.tsx');
const noop = () => {};
const cards = Array.from({ length: 7 }, (_, index) => React.createElement(GuestVideoCard, {
  key: index, guest: { identity: 'guest-' + index, name: 'Кастер ' + index, resolution: '1920×1080', bitrateKbps: 4000, roomSendBitrateKbps: index === 0 ? 7200 : null, packetLoss: 0, jitterMs: 0, rttMs: 0, stability: 'Хорошая', camera: true, microphone: true },
  focused: index === 0, onSelect: noop, roomName: 'QA', outputUrl: '/output/qa', copied: false, receiveBitrate: 4000,
  preference: { audio: true, video: true, volume: 75 }, preview: React.createElement('div', { className: 'guest-preview-cell' }, React.createElement('div', { className: 'studio-guest-video-wrap' }, React.createElement('video', { muted: true }))),
  meter: React.createElement('div', { className: 'db-meter' }), quickControls: React.createElement('button', {}, 'Шепнуть'),
  mediaControls: React.createElement('label', {}, 'Микрофон', React.createElement('select', {}, React.createElement('option', {}, 'Устройство с длинным названием'))),
  onCopy: noop, onQualityChange: noop, onMonitoringChange: noop,
}));
cards.push(React.createElement(ParticipantSourceCard, { key: 'screen', sourceKey: 'screen:guest-0', name: 'Экран', kind: 'screen', selected: false,
  preview: React.createElement('div', { className: 'control-participant-preview source-preview' }, React.createElement('video', { muted: true })),
  advanced: React.createElement('button', {}, 'Открыть экран') }));
const markup = renderToStaticMarkup(React.createElement(React.Fragment, {}, ...cards));
const web = path.resolve(__dirname, '..');
const css = ['app/globals.css', 'app/graphite-workspace.css', '../../design-preview/new/operations-theme.css', 'components/GuestVideoCard.module.css'].map(file => fs.readFileSync(path.join(web, file), 'utf8')).join('\n');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-participants-compact-'));
let browser;
(async () => {
  browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const proof = [];
  for (const role of ['studio', 'staff']) for (const width of [320, 390, 1440, 1920, 2560]) {
    const page = await browser.newPage({ viewport: { width, height: 1000 } });
    const wrapper = role === 'studio' ? 'studio-sources-section' : 'staff-participant-content';
    await page.setContent(`<!doctype html><html data-theme="dark" data-design-preview="on"><meta charset="utf-8"><style>${css}</style><main class="graphite-workspace studio-page studio-app-shell ${role === 'staff' ? 'admin-room-page' : ''}"><aside class="studio-sidebar">CastLink</aside><div class="studio-main-column"><section class="${wrapper}" data-view="participants"><div class="source-browser" data-view="participants"><nav class="source-roster"><button>Кастер 0</button></nav><section class="studio-video-wall studio-production-wall source-deck">${markup}</section></div></section></div></main></html>`);
    const geometry = await page.evaluate(() => {
      const cards = [...document.querySelectorAll('.source-card')];
      return { pageWidth: document.documentElement.scrollWidth, cards: cards.map(card => { const r = card.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; }) };
    });
    assert.equal(geometry.cards.filter(card => card.width > 0 && card.height > 0).length, 8, `${role}/${width}: every source is visible`);
    assert.ok(geometry.cards.every(card => card.width <= 314), `${role}/${width}: cards retain compact width`);
    assert.ok(geometry.pageWidth <= width, `${role}/${width}: no horizontal page overflow`);
    const firstRow = geometry.cards.filter(card => Math.abs(card.y - geometry.cards[0].y) < 1).length;
    assert.equal(firstRow, width >= 1920 ? 5 : width >= 1440 ? 3 : 1, `${role}/${width}: responsive rows capped at five`);
    await page.evaluate(() => { window.qaCards = [...document.querySelectorAll('.source-card')]; window.qaControls = [...document.querySelectorAll('.source-card button,.source-card input,.source-card select')]; });
    assert.equal(await page.getByLabel('Битрейт участника Кастер 0').isVisible(), true, 'camera limit is visible before Settings opens');
    assert.match(await page.locator('.guest-card-bitrate output').first().innerText(), /7\s?200/, 'actual room-send value is separate from 4000 kbps card reception');
    assert.equal(await page.locator('.guest-card-bitrate output').nth(1).innerText(), '—', 'missing sender samples never fall back to receive traffic');
    const bitrateGeometry = await page.locator('.source-card').first().evaluate(card => {
      const row = card.querySelector('.guest-card-bitrate').getBoundingClientRect();
      const actions = card.querySelector('.source-card-monitor .personal-monitor-controls').getBoundingClientRect();
      const meter = card.querySelector('.guest-card-meter').getBoundingClientRect();
      const select = card.querySelector('.guest-card-bitrate select').getBoundingClientRect();
      const output = card.querySelector('.guest-card-bitrate output').getBoundingClientRect();
      return { above: row.bottom <= actions.top, belowMeter: row.top >= meter.bottom, sideBySide: select.right <= output.left + 1, selectHeight: select.height };
    });
    assert.ok(bitrateGeometry.above && bitrateGeometry.belowMeter && bitrateGeometry.sideBySide, `${role}/${width}: compact selector and actual rate sit together below the meter and above Sound/Video buttons: ${JSON.stringify(bitrateGeometry)}`);
    await page.locator('.source-card-advanced > summary').first().click();
    assert.equal(await page.getByLabel('Битрейт участника Кастер 0').isVisible(), true, 'camera quality remains visible while Settings expands');
    assert.equal(await page.getByRole('button', { name: '↻ Повернуть на 90°' }).count(), 0, 'duplicate rotation button is removed');
    const continuity = await page.evaluate(() => ({ sameCards: window.qaCards.every(card => card.isConnected), sameControls: window.qaControls.every(control => control.isConnected), overflow: [...document.querySelectorAll('.source-card')].some(card => card.scrollWidth > card.clientWidth + 1) }));
    assert.ok(continuity.sameCards && continuity.sameControls, 'opening settings preserves source/controller DOM');
    assert.equal(continuity.overflow, false, `${role}/${width}: expanded settings fit the card`);
    if (role === 'studio') {
      const overview = await page.evaluate(() => {
        const section = document.querySelector('.studio-sources-section'), browser = section.querySelector('.source-browser');
        section.dataset.view = browser.dataset.view = 'studio';
        const maxWidth = getComputedStyle(browser.querySelector('.source-deck')).maxWidth;
        section.dataset.view = browser.dataset.view = 'participants';
        return { maxWidth, sameCards: window.qaCards.every(card => card.isConnected), sameControls: window.qaControls.every(control => control.isConnected) };
      });
      assert.equal(overview.maxWidth, 'none', 'five-column cap is limited to Participants');
      assert.ok(overview.sameCards && overview.sameControls, 'view changes retain the mounted cards and settings');
    }
    proof.push({ role, width, firstRow, ...geometry, continuity });
    await page.screenshot({ path: path.join(out, `${role}-${width}.png`), fullPage: true });
    await page.close();
  }
  fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify(proof, null, 2));
  console.log('PASS compact participants: actual guest/source cards, studio/staff, 320/390/1440/1920/2560, max five columns, settings retained; proof ' + out);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); });
