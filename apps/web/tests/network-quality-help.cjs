const assert = require('node:assert/strict');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
const { load } = require('./load-typescript.cjs');
const { GuestMiniStats } = load('../components/GuestMiniStats.tsx');
const guest = { name: 'Test guest', camera: true, microphone: true, receiveVideoKbps: 4000, receiveAudioKbps: 128, statsSampledAt: Date.now(), networkMeasured: true, packetLoss: 3000, currentLoss: { percent: 0, packets: 0 }, totalLoss: { percent: .03, packets: 3000 }, jitterMs: 38, rttMs: 170 };
const grades = ['Хорошая', 'Средняя', 'Плохая'];
const html = renderToStaticMarkup(React.createElement(React.Fragment, null, ...grades.map((stability, index) => React.createElement(GuestMiniStats, { key: index, guest: { ...guest, stability } })), React.createElement(GuestMiniStats, { key: 'unknown', guest: { ...guest, stability: 'Хорошая', networkMeasured: false } })));
assert.equal((html.match(/data-network-help-toggle="true"/g) || []).length, 4, 'every grade, including missing data, has its own disclosure');
assert.equal((html.match(/data-network-help="true"/g) || []).length, 4, 'each guest has a native top-layer help surface');
const targets = [...html.matchAll(/popovertarget="([^"]+)"/gi)].map(match => match[1]);
assert.equal(new Set(targets).size, 4, 'guest menus do not share ids');
for (const target of targets) assert.ok(html.includes(`id="${target}"`), 'trigger references its own menu');
assert.match(html, /Срабатывает худший из трёх показателей/);
assert.match(html, /Потери &lt; 1%/);
assert.match(html, /джиттер ≤ 30 мс/);
assert.match(html, /RTT ≤ 150 мс/);
assert.match(html, /Потери 1–&lt;5%/);
assert.match(html, /джиттер &gt;30–60 мс/);
assert.match(html, /RTT &gt;150–300 мс/);
assert.match(html, /Потери ≥ 5%/);
assert.match(html, /джиттер &gt; 60 мс/);
assert.match(html, /RTT &gt; 300 мс/);
assert.match(html, /за последние 10 секунд/);
assert.match(html, /За сессию участника/);
assert.match(html, /0% \/ 0 пак/);
assert.match(html, /0,03% \/ 3 000 пак/);
assert.doesNotMatch(html, /Потери &gt; 10 пак|за всё время трека/);
assert.match(html, /не скорость интернета/);
assert.match(html, /Нет свежего замера соединения/);

const { translate } = load('../lib/i18n.ts');
for (const [locale, current, history] of [
  ['ru', '0% / 0 пак.', '0,03% / 3\u00a0000 пак.'],
  ['en', '0% / 0 packets', '0.03% / 3,000 packets'],
  ['zh-CN', '0% / 0 个包', '0.03% / 3,000 个包'],
]) {
  const { GuestMiniStats: LocalizedStats } = load('../components/GuestMiniStats.tsx', { './I18nProvider': { useI18n: () => ({ locale, t: (text, params) => translate(locale, text, params) }) } });
  const localized = renderToStaticMarkup(React.createElement(LocalizedStats, { guest: { ...guest, stability: 'Хорошая' } }));
  assert.ok(localized.includes(current), `${locale}: current loss is percent first, then numeric packet count`);
  assert.ok(localized.includes(history), `${locale}: cumulative loss is separately percent first`);
}

const stale = renderToStaticMarkup(React.createElement(GuestMiniStats, { guest: { ...guest, stability: 'Хорошая', statsSampledAtRef: { current: Date.now() }, networkSampledAtRef: { current: Date.now() - 7000 } } }));
assert.match(stale, /data-quality="unknown"/, 'fresh audio must not keep a stale camera network measurement alive');
assert.match(stale, /Нет свежего замера соединения/);
assert.match(stale, /0,03% \/ 3\u00a0000 пак/, 'historical losses remain visible when the current camera measurement expires');
console.log('PASS: per-guest disclosures, percentage thresholds, current/session history, RU/EN/zh percent-first copy and independent six-second camera freshness');
