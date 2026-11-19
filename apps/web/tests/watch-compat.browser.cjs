// Actual built /watch page in Chromium; the viewer API returns an explicit access-denial fixture.
const assert = require('node:assert/strict');
const { chromium } = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');
const base = process.env.CASTLINK_QA_BASE_URL || 'http://127.0.0.1:3017';
let browser;
(async () => {
  try {
    browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    for (const missing of [[], ['any'], ['any', 'timeout']]) {
      const context = await browser.newContext();
      try {
        await context.addInitScript(names => {
          for (const name of names) Object.defineProperty(AbortSignal, name, { configurable: true, value: undefined });
        }, missing);
        const page = await context.newPage(), requests = [], errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('**/api/studio-viewer', async route => {
          const request = route.request();
          requests.push({ method: request.method(), body: request.postDataJSON() });
          await route.fulfill({ status: 403, contentType: 'application/json', body: JSON.stringify({ error: 'Viewer fixture access denied' }) });
        });
        await page.goto(`${base}/watch?studioId=fixture-studio&room=fixture-room#invite=fixture-invite`);
        const status = page.getByRole('status').filter({ hasText: 'Viewer fixture access denied' });
        await status.waitFor();
        assert.deepEqual(requests, [{ method: 'POST', body: { action: 'join', studioId: 'fixture-studio', room: 'fixture-room', invite: 'fixture-invite' } }]);
        assert.equal(new URL(page.url()).hash, '', 'viewer credentials are removed from the address bar');
        const retry = page.waitForResponse(response => new URL(response.url()).pathname === '/api/studio-viewer');
        await page.getByRole('button', { name: 'Повторить подключение', exact: true }).click();
        await retry;
        await status.waitFor();
        assert.equal(requests.length, 2, 'retry reaches the API in the same browser context');
        assert.deepEqual(requests[1], requests[0], 'retry retains the original scoped invite');
        assert.deepEqual(errors, [], 'no uncaught browser exceptions');
        console.log(`PASS built /watch API access and retry; missing AbortSignal methods: ${missing.join(', ') || 'none'}`);
      } finally { await context.close(); }
    }
  } finally { await browser?.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
