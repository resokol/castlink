// Production components/CSS with an HTTP fixture for guest acknowledgements.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..');
const req = createRequire(path.join(web, 'package.json'));
const tooling = process.env.CASTLINK_QA_NODE_MODULES ? createRequire(path.join(process.env.CASTLINK_QA_NODE_MODULES, 'package.json')) : req;
const { chromium } = tooling('playwright');
const out = process.env.CASTLINK_QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-audio-switch-'));
fs.mkdirSync(out, { recursive: true });
let browser, server;
(async () => {
  const entry = path.join(out, 'entry.tsx');
  fs.writeFileSync(entry, `
    import React, { useState } from 'react';
    import { createRoot } from 'react-dom/client';
    import { I18nProvider } from '@/components/I18nProvider';
    import { GuestAudioProfileSelector } from '@/components/GuestAudioProfileSelector';
    import { StudioGuestMediaControls } from '@/components/StudioGuestMediaControls';
    function App() {
      const [profile, setProfile] = useState(undefined);
      return <I18nProvider><main className="graphite-workspace" style={{ maxWidth: 500, padding: 16, margin: 'auto' }}>
        <section className="panel" data-testid="guest"><h2>Микрофон</h2><GuestAudioProfileSelector value={profile} onChange={setProfile} /></section>
        <article className="panel" data-testid="studio"><h2>Кастер · Guest</h2><StudioGuestMediaControls studioId="studio" roomName="room" identity="guest-one" name="Guest" /></article>
      </main></I18nProvider>;
    }
    createRoot(document.getElementById('root')).render(<App />);
  `);
  await tooling('esbuild').build({ entryPoints: [entry], bundle: true, outfile: path.join(out, 'bundle.js'), jsx: 'automatic', alias: { '@': web }, nodePaths: [path.join(web, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' } });
  const styles = ['globals.css', 'graphite-workspace.css'].map(file => fs.readFileSync(path.join(web, 'app', file), 'utf8')).join('\n');
  const commands = [];
  let profile = 'raw', result, fail = false;
  server = http.createServer((request, response) => {
    if (request.url.startsWith('/api/guest-media-control')) {
      response.setHeader('content-type', 'application/json');
      if (request.method === 'POST') {
        let body = ''; request.on('data', chunk => { body += chunk; });
        request.on('end', () => {
          const command = JSON.parse(body); commands.push(command);
          if (fail) { response.statusCode = 409; response.end(JSON.stringify({ error: 'Гость отключён' })); return; }
          profile = command.patch.audioProfile;
          result = { id: `cmd-${commands.length}`, ok: true };
          response.end(JSON.stringify({ command: { id: result.id, expiresAt: Date.now() + 60_000, patch: command.patch } }));
        });
      } else response.end(JSON.stringify({ participantSid: 'PA-one', state: { audioProfile: profile, noiseSuppressionState: profile === 'speech' ? 'on' : 'off', connectionRoute: 'auto' }, result }));
    } else if (request.url === '/bundle.js' || request.url === '/bundle.css') {
      response.setHeader('content-type', request.url.endsWith('.css') ? 'text/css' : 'text/javascript');
      response.end(fs.readFileSync(path.join(out, request.url.slice(1))));
    } else { response.setHeader('content-type', 'text/html'); response.end(`<!doctype html><html lang="ru"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${styles}</style><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script src="/bundle.js"></script></html>`); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY, headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = []; page.on('pageerror', error => errors.push(error.message));
  for (const width of [360, 1280]) for (const theme of ['dark', 'light']) for (const locale of ['ru', 'en', 'zh-CN']) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(`http://127.0.0.1:${server.address().port}`);
    await page.evaluate(({ theme }) => { document.documentElement.dataset.theme = theme; }, { theme });
    await page.evaluate(({ key, locale }) => { localStorage.setItem(key, locale); window.dispatchEvent(new StorageEvent('storage', { key, newValue: locale })); }, { key: require('./load-typescript.cjs').load('../lib/i18n.ts').LOCALE_STORAGE_KEY, locale });
    const guest = page.getByTestId('guest').getByRole('switch');
    const studio = page.getByTestId('studio').getByRole('switch');
    await studio.waitFor();
    await page.waitForFunction(() => !document.querySelector('[data-testid="studio"] [role="switch"]').disabled);
    for (const input of [guest, studio]) {
      const aligned = await input.evaluate(element => { const label = element.closest('label'), copy = label.firstElementChild.getBoundingClientRect(), toggle = element.getBoundingClientRect(); return toggle.left >= copy.right; });
      assert.equal(aligned, true, 'switch stays beside its label in both settings surfaces');
    }
    assert.equal(await guest.isChecked(), false);
    await guest.focus(); await page.keyboard.press('Space'); assert.equal(await guest.isChecked(), true);
    await page.keyboard.press('Space'); assert.equal(await guest.isChecked(), false);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, `${width}/${theme}/${locale} horizontal overflow`);
    if (locale === 'ru') await page.screenshot({ path: path.join(out, `${width}-${theme}.png`), fullPage: true });
  }
  const studio = page.getByTestId('studio').getByRole('switch');
  await Promise.all([page.waitForResponse(response => response.request().method() === 'POST'), studio.click()]);
  assert.deepEqual(commands.at(-1).patch, { audioProfile: 'speech' });
  assert.equal(commands.at(-1).participantSid, 'PA-one');
  await page.waitForFunction(() => { const el = document.querySelector('[data-testid="studio"] [role="switch"]'); return el.checked && !el.disabled; });
  await Promise.all([page.waitForResponse(response => response.request().method() === 'POST'), studio.click()]);
  assert.deepEqual(commands.at(-1).patch, { audioProfile: 'raw' });
  await page.waitForFunction(() => { const el = document.querySelector('[data-testid="studio"] [role="switch"]'); return !el.checked && !el.disabled; });
  fail = true;
  await Promise.all([page.waitForResponse(response => response.request().method() === 'POST'), studio.click()]);
  await page.getByRole('alert').waitFor();
  assert.equal(await studio.isChecked(), false, 'failed command restores the confirmed switch state');
  assert.deepEqual(errors, []);
  console.log(`PASS: keyboard, default off, studio on/off/ACK/error, 12 responsive theme/locale cases; screenshots: ${out}`);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server?.close(); });
