// Real Console A components with changing test metrics and synthetic local media.
// This fixture intentionally rerenders its parent; it does not connect to an SFU.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..');
const repo = path.resolve(web, '../..');
const req = createRequire(path.join(web, 'package.json'));
const { chromium } = require(process.env.CASTLINK_QA_PLAYWRIGHT || '/opt/codex/runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const { build } = require(process.env.CASTLINK_QA_ESBUILD || '/tmp/castlink-preview-tools/node_modules/esbuild');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-refresh-proof-'));
let server, browser;
async function main() {
  await build({ entryPoints: [path.join(__dirname, 'fixtures/guest-mini-stats-refresh.tsx')], outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic', alias: { '@': web }, nodePaths: [path.join(web, 'node_modules')], loader: { '.css': 'local-css' }, define: { 'process.env': JSON.stringify({ NODE_ENV: 'production', NEXT_PUBLIC_BUILD_ID: 'preview-eaa94d193230', NEXT_PUBLIC_APP_VERSION: '1.0.1-preview', NEXT_PUBLIC_PRODUCT_VERSION: '1.0.1', NEXT_PUBLIC_BUILD_NUMBER: 'preview' }) } });
  let documentRequests = 0, versionRequests = 0;
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://preview.local');
    if (url.pathname === '/api/version') {
      versionRequests++;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ version: 'preview-newer-build', buildId: 'preview-newer-build' })); return;
    }
    if (url.pathname.startsWith('/api/')) { response.setHeader('content-type', 'application/json'); response.end('{}'); return; }
    const file = url.pathname === '/bundle.js' ? path.join(out, 'bundle.js') : url.pathname === '/bundle.css' ? path.join(out, 'bundle.css') : url.pathname === '/livekit.css' ? req.resolve('@livekit/components-styles') : url.pathname === '/globals.css' ? path.join(web, 'app/globals.css') : url.pathname === '/graphite.css' ? path.join(web, 'app/graphite-workspace.css') : url.pathname.startsWith('/new/') ? path.resolve(repo, 'design-preview', '.' + url.pathname) : url.pathname === '/icon.svg' ? path.join(web, 'app/icon.svg') : null;
    if (file && fs.existsSync(file)) { response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.woff2') ? 'font/woff2' : 'text/css'); response.end(fs.readFileSync(file)); return; }
    if (url.pathname !== '/') { response.statusCode = 404; response.end(); return; }
    documentRequests++;
    response.setHeader('content-type', 'text/html');
    response.end('<!doctype html><html lang="ru" data-theme="dark" data-design-preview="on"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/livekit.css"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/graphite.css"><link rel="stylesheet" href="/new/live-theme.css"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const errors = [];
  let navigations = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('framenavigated', frame => { if (frame === page.mainFrame()) navigations++; });
  await page.clock.install();
  await page.goto(`http://127.0.0.1:${server.address().port}/?view=studio&count=5`);
  await page.waitForFunction(() => document.querySelectorAll('video').length === 6 && [...document.querySelectorAll('video')].every(v => v.videoWidth > 0));
  await page.locator('.guest-card-heading button[popovertarget]').first().click();
  const menu = page.locator('[data-console-compact] > [popover]:popover-open');
  await menu.getByRole('button', { name: 'Закрыть', exact: true }).focus();
  await page.evaluate(() => {
    window.qaProof = {
      document, marker: crypto.randomUUID(),
      videos: [...document.querySelectorAll('video')].map(video => ({ video, stream: video.srcObject, tracks: video.srcObject.getTracks(), ended: 0 })),
      cards: [...document.querySelectorAll('.studio-caster-card')],
      stats: [...document.querySelectorAll('dl[aria-label="Статистика соединения"]')],
      program: document.querySelector('.studio-console-program'),
      popup: document.querySelector('[data-console-compact] > [popover]:popover-open'),
      focus: document.activeElement,
      mounts: { ...window.qaRefresh.mounts }, unmounts: { ...window.qaRefresh.unmounts },
    };
    window.qaProof.videos.forEach(owner => owner.tracks.forEach(track => track.addEventListener('ended', () => owner.ended++)));
  });
  const snapshots = [];
  async function inspect(label) {
    const result = await page.evaluate(() => {
      const p = window.qaProof;
      return {
        ticks: window.qaRefresh.ticks, renders: window.qaRefresh.renders,
        guest: [...document.querySelectorAll('dl[aria-label="Статистика соединения"]')].map(e => e.innerText),
        guestFields: [...document.querySelector('dl[aria-label="Статистика соединения"]').querySelectorAll('dd')].map(e => e.innerText),
        program: document.querySelector('.studio-console-stats').innerText,
        videos: p.videos.length,
        stableMedia: p.document === document && p.videos.every(o => o.video.isConnected && o.video.srcObject === o.stream && o.stream.getTracks().length === o.tracks.length && o.tracks.every((t, i) => o.stream.getTracks()[i] === t && t.readyState === 'live') && o.ended === 0),
        stableCards: p.cards.every((node, i) => node === document.querySelectorAll('.studio-caster-card')[i]),
        stableStats: p.stats.every((node, i) => node === document.querySelectorAll('dl[aria-label="Статистика соединения"]')[i]),
        stableProgram: p.program === document.querySelector('.studio-console-program'),
        popupRetained: p.popup.isConnected && p.popup.matches(':popover-open'),
        focusRetained: document.activeElement === p.focus,
        mounts: window.qaRefresh.mounts, unmounts: window.qaRefresh.unmounts,
        baselineMounts: p.mounts, baselineUnmounts: p.unmounts,
        navigationEntries: performance.getEntriesByType('navigation').length,
      };
    });
    for (const key of ['stableMedia', 'stableCards', 'stableStats', 'stableProgram', 'popupRetained', 'focusRetained']) assert.equal(result[key], true, `${label}: ${key}`);
    assert.deepEqual(result.mounts, result.baselineMounts, `${label}: no child remount`);
    assert.deepEqual(result.unmounts, result.baselineUnmounts, `${label}: no child cleanup`);
    // Playwright's mocked clock may omit PerformanceNavigationTiming entries;
    // server HTML requests and main-frame navigation events are counted outside it.
    snapshots.push({ label, ticks: result.ticks, renders: result.renders, guest: result.guest[0], program: result.program });
    return result;
  }
  let previous = await inspect('initial');
  for (let step = 1; step <= 5; step++) {
    await page.clock.runFor(2100);
    const next = await inspect(`change-${step}`);
    assert.ok(next.ticks > previous.ticks, 'fixture actually supplied new data');
    assert.ok(next.renders > previous.renders, 'parent React rerender is exercised');
    assert.notEqual(next.guest[0], previous.guest[0], 'guest video/audio/network text changes');
    for (const [index, name] of ['video', 'audio', 'network'].entries()) assert.notEqual(next.guestFields[index], previous.guestFields[index], `${name} field actually changes`);
    assert.notEqual(next.program, previous.program, 'program statistics change');
    previous = next;
  }
  await page.evaluate(() => document.body.setAttribute('data-identical-stats', ''));
  await page.clock.runFor(12000);
  const identical = await inspect('identical-fresh-no-parent-update');
  assert.ok(identical.ticks >= previous.ticks + 12, 'identical samples really refreshed their refs');
  assert.equal(identical.renders, previous.renders, 'identical fresh metrics do not rerender parent');
  assert.equal(identical.guest[0], previous.guest[0], 'old numeric timestamp cannot expire fresh ref-based measurements');
  await page.evaluate(() => document.body.setAttribute('data-freeze-stats', ''));
  await page.clock.runFor(12000);
  const stale = await inspect('expired');
  assert.ok(stale.guest.every(text => text.includes('Нет данных') && !text.includes('кбит/с')), 'all guest measurements expire');
  assert.equal(stale.renders, identical.renders, 'expiry is local to statistics children');
  await page.evaluate(() => document.body.removeAttribute('data-freeze-stats'));
  await page.clock.runFor(4200);
  const recovered = await inspect('recovered');
  assert.match(recovered.guest[0], /кбит\/с/);
  assert.equal(recovered.renders, identical.renders, 'ref-only recovery needs no parent update');
  assert.equal(recovered.guest[0], identical.guest[0], 'same bitrate values recover through current ref only');
  await page.evaluate(() => document.body.removeAttribute('data-identical-stats'));
  // Cross the actual AppUpdateNotice 60-second poll while data keeps changing.
  await page.clock.runFor(40000);
  const final = await inspect('past-version-poll');
  assert.ok(versionRequests >= 2, 'actual AppUpdateNotice fetched again after60s');
  assert.equal(await page.locator('.app-update-banner').count(), 1, 'different version shows notice without automatic reload');
  assert.equal(navigations, 1, 'one main-frame navigation over all data updates');
  assert.equal(documentRequests, 1, 'one HTML request over all data updates');
  assert.deepEqual(errors, []);
  const evidence = { result: 'PASS', source: 'actual current Console A components with changing synthetic metrics/local media; no live SFU', normalUpdateChecks: 5, identicalFreshTicks: identical.ticks - previous.ticks, identicalExpiryRecoveryParentRenders: recovered.renders - previous.renders, ticks: final.ticks, parentRenders: final.renders, retainedVideos: final.videos, retainedChildOwners: Object.keys(final.mounts).length, childUnmounts: final.unmounts, documentRequests, navigations, versionRequests, snapshots, errors };
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify(evidence, null, 2));
  console.log(JSON.stringify({ ...evidence, snapshots: undefined, evidencePath: path.join(out, 'results.json') }));
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server?.close(); });
