const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const buildDir = process.env.TEST_BUILD_DIR || '.next';
const expected = fs.readFileSync(path.join(__dirname, '..', buildDir, 'BUILD_ID'), 'utf8').trim();
(async () => {
  for (const suffix of ['', '?t=123']) {
    const response = await fetch(base + '/api/version' + suffix);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/);
    assert.match(response.headers.get('cdn-cache-control'), /no-store/);
    const payload = await response.json();
    assert.equal(payload.version, expected);
    assert.equal(payload.buildId, expected);
    assert.equal(payload.productVersion, require("../../../package.json").version);
  }
  for (const route of ['/studio', '/room', '/output/guest-test', '/monitor']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('cache-control'), /no-store/, 'entry HTML must not be cached');
    assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
    assert.equal(response.headers.get('referrer-policy'), 'no-referrer');
    assert.equal(response.headers.get('x-frame-options'), 'SAMEORIGIN');
    assert.match(response.headers.get('permissions-policy') || '', /camera=\(self\)/);
    assert.match(response.headers.get('content-security-policy') || '', /frame-ancestors 'self'/);
    const html = await response.text();
    if (route === '/studio' || route === '/room') {
      assert.ok(html.includes(expected), 'SSR version must match running build');
      assert.ok(html.includes('Проверить обновления'));
    } else assert.ok(!html.includes('aria-label="Версия приложения"'), 'clean outputs stay clean');
  }
  console.log('PASS: API/build/client version agreement, uncached API and HTML, output/monitor exclusion');
})().catch(e => { console.error(e); process.exitCode = 1; });
