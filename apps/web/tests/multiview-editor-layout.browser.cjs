const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..'), req = createRequire(path.join(web, 'package.json'));
const { chromium } = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');
const { build } = require(process.env.CASTLINK_QA_ESBUILD || 'esbuild');
const out = process.env.CASTLINK_MULTIVIEW_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-multiview-layout-'));
fs.mkdirSync(out, { recursive: true });
const baseline = process.env.CASTLINK_MULTIVIEW_BASELINE === '1';
const results = [], failures = [], errors = [];
const requests = [];
let browser, server;
const scene = { id: 'scene-1', name: 'Сцена 1', width: 1920, height: 1080, revision: 1, tiles: Array.from({ length: 16 }, (_, i) => ({ id: `tile-${i + 1}`, sourceIdentity: i < 4 ? `guest-${i + 1}` : '', source: 'camera', x: (i % 4) / 4, y: Math.floor(i / 4) / 4, width: .25, height: .25, fit: 'contain', muted: true })) };
const check = (value, message, context) => { if (!value) failures.push({ message, ...context }); };
async function geometry(page) {
  return page.evaluate(() => {
    const styles = window.qaStyles;
    const box = name => { const e = document.querySelector('.' + styles[name]); if (!e) return null; const r = e.getBoundingClientRect(), s = getComputedStyle(e); return { x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom, padding:s.padding, scrollHeight:e.scrollHeight, clientHeight:e.clientHeight }; };
    return Object.fromEntries(['backdrop', 'editor', 'header', 'toolbar', 'templatebar', 'workspace', 'stage', 'canvasArea', 'canvas', 'stageHelp', 'stageButtons', 'footer', 'sources', 'properties'].map(name => [name, box(name)]));
  });
}
(async () => {
  await build({ entryPoints:[path.join(__dirname, 'fixtures/multiview-editor-layout.tsx')], outfile:path.join(out, 'bundle.js'), bundle:true, platform:'browser', format:'iife', target:'es2022', jsx:'automatic', alias:{ '@':web }, nodePaths:[path.join(web, 'node_modules')], loader:{ '.css':'local-css' }, define:{ 'process.env':JSON.stringify({ NODE_ENV:'production', NEXT_PUBLIC_BUILD_ID:'preview', NEXT_PUBLIC_BUILD_NUMBER:'preview', NEXT_PUBLIC_PRODUCT_VERSION:'preview' }) } });
  server = http.createServer(async (request, response) => {
    const url = new URL(request.url, 'http://fixture.local');
    if (url.pathname.startsWith('/api/')) {
      response.setHeader('content-type', 'application/json');
      if (url.pathname === '/api/multiview') {
        if (request.method === 'PUT' || request.method === 'POST') { let body = ''; for await (const chunk of request) body += chunk; const data = JSON.parse(body); requests.push(data); response.end(JSON.stringify({ scene:{ ...data.scene, revision:2 } })); return; }
        if (url.searchParams.has('sceneId')) { response.end(JSON.stringify({ scene })); return; }
        response.end(JSON.stringify({ scenes:[scene] })); return;
      }
      response.end(JSON.stringify({ buildId:'preview', version:'preview' })); return;
    }
    const file = url.pathname === '/bundle.js' || url.pathname === '/bundle.css' ? path.join(out, url.pathname.slice(1)) : url.pathname === '/icon.svg' ? path.join(web, 'app/icon.svg') : url.pathname === '/livekit.css' ? req.resolve('@livekit/components-styles') : url.pathname === '/globals.css' ? path.join(web, 'app/globals.css') : url.pathname === '/graphite.css' ? path.join(web, 'app/graphite-workspace.css') : url.pathname.startsWith('/new/') ? path.join(web, '../../design-preview', url.pathname) : null;
    if (file && fs.existsSync(file)) { response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.svg') ? 'image/svg+xml' : file.endsWith('.woff2') ? 'font/woff2' : 'text/css'); response.end(fs.readFileSync(file)); return; }
    if (url.pathname !== '/') { response.statusCode = 404; response.end(); return; }
    response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html data-theme="dark" data-design-preview="on"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/livekit.css"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/graphite.css"><link rel="stylesheet" href="/new/live-theme.css"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({ executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless:true, args:['--no-sandbox', '--disable-dev-shm-usage', '--autoplay-policy=no-user-gesture-required'] });
  const cases = baseline ? [[1280,600,'dark']] : [[1280,540,'dark'], [1280,600,'light'], [1440,900,'dark'], [1440,900,'light'], [1024,600,'dark'], [853,500,'light'], [390,844,'dark'], [1280,600,'dark']];
  for (const [width,height,theme] of cases) {
    const context = { width,height,theme }, page = await browser.newPage({ viewport:{width,height} }); page.setDefaultTimeout(15000); page.on('pageerror', error => errors.push(error.message));
    await page.goto('http://127.0.0.1:' + server.address().port); await page.waitForFunction(() => window.qaStyles && document.querySelectorAll('[aria-label^="Ячейка "]').length === 16); await page.waitForTimeout(150);
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const g = await geometry(page); results.push({ ...context, ...g });
    await page.screenshot({ path:path.join(out, `multiview-${theme}-${width}x${height}.png`), fullPage:true });
    if (!baseline) {
      check(Math.abs(g.canvas.width / g.canvas.height - 16/9) < .01, 'canvas retains scene aspect', context);
      if (width > 760) {
        const availableWidth = g.canvasArea.width - 16, availableHeight = g.canvasArea.height - 16;
        check(g.canvas.width >= Math.min(availableWidth, availableHeight * 16/9) - 2, 'preview fills available central area proportionally', context);
        check(g.canvas.y >= g.canvasArea.y - 1 && g.canvas.bottom <= g.canvasArea.bottom + 1, 'canvas stays inside available area', context);
        if (width >= 1024 && height >= 500) check(g.footer.bottom <= height + 1 && g.workspace.height >= 180, 'workspace and apply footer stay usable', context);
        else {
          check(g.canvas.width >= 300, 'zoomed window retains an operable scene instead of shrinking to a thumbnail', context);
          await page.locator('footer').filter({has:page.getByRole('button',{name:'Применить',exact:true})}).scrollIntoViewIfNeeded();
          check(await page.getByRole('button',{name:'Применить',exact:true}).evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}), 'zoomed window keeps apply footer reachable through editor scroll', context);
          await page.locator('[data-design-surface="multiview"]').evaluate(e=>e.scrollTop=0);
        }
      }
      check(await page.getByRole('button', { name:'Закрыть', exact:true }).evaluate(e => { const r=e.getBoundingClientRect(); return r.x>=0 && r.right<=innerWidth && e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2)); }), 'close command visible', context);
      if (width === 1280 && height === 600 && theme === 'dark') {
        check(g.canvas.width >= 350, 'desktop canvas substantially larger than reproduced 93px regression', context);
        const sidebar = await page.locator('.studio-sidebar').boundingBox();
        check(g.backdrop.x === sidebar.x + sidebar.width, 'editor aligns with actual console sidebar', context);
        await page.waitForFunction(() => [...document.querySelectorAll('video')].filter(e => e.videoWidth > 0).length >= 4);
        await page.evaluate(() => { window.qaMedia = [...document.querySelectorAll('video')].map(video => ({ video, stream:video.srcObject })); });
        const stable = () => page.evaluate(() => window.qaMedia.every(({video,stream}) => video.isConnected && video.srcObject === stream));
        await page.getByRole('button', { name:'Показать сетку', exact:true }).click();
        check(await page.locator('svg[data-grid-step]').count() === 1, 'grid preference remains operational', context);
        await page.getByLabel('Шаг сетки', { exact:true }).selectOption('40');
        check(await page.locator('svg[data-grid-step="40"]').count() === 1, 'grid spacing remains operational', context);
        await page.getByRole('button', { name:'Свободно', exact:true }).click();
        const tile = page.locator('[aria-label^="Ячейка 1:"]'); await tile.focus();
        const beforeMove = await tile.boundingBox(); await page.keyboard.press('ArrowRight');
        check((await tile.boundingBox()).x > beforeMove.x, 'free layout keyboard movement works', context);
        await page.getByTitle('Отменить', { exact:true }).click();
        check(Math.abs((await tile.boundingBox()).x - beforeMove.x) < 1, 'undo restores slot position', context);
        await page.getByTitle('Повторить', { exact:true }).click();
        check((await tile.boundingBox()).x > beforeMove.x, 'redo restores movement', context);
        const afterRedo = await tile.boundingBox(); await page.keyboard.down('Alt');
        await page.mouse.move(afterRedo.x + afterRedo.width/2, afterRedo.y + afterRedo.height/2); await page.mouse.down(); await page.mouse.move(afterRedo.x + afterRedo.width/2 + 24, afterRedo.y + afterRedo.height/2 + 12, { steps:4 }); await page.mouse.up(); await page.keyboard.up('Alt');
        check((await tile.boundingBox()).x > afterRedo.x + 10, 'pointer move retains scene geometry interaction', context);
        const handle = page.locator('[class*="handle_se"]').first(); const hb = await handle.boundingBox(), beforeResize = await tile.boundingBox();
        await page.keyboard.down('Alt'); await page.mouse.move(hb.x + hb.width/2, hb.y + hb.height/2); await page.mouse.down(); await page.mouse.move(hb.x + hb.width/2 + 15, hb.y + hb.height/2 + 10, {steps:4}); await page.mouse.up(); await page.keyboard.up('Alt');
        check((await tile.boundingBox()).width > beforeResize.width, 'resize handles remain usable', context);
        check(await stable(), 'grid, selection, move, resize and history preserve mounted video/streams', context);
        await page.getByRole('button', { name:'Применить', exact:true }).click(); await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(e => e.textContent.includes('Сцена применена')));
        check(requests.at(-1)?.studioId === 'studio-default' && requests.at(-1)?.room === 'tester' && requests.at(-1)?.expectedRevision === 1, 'apply retains original API scope and revision guard', context);
        await page.getByRole('button', {name:'4:3',exact:true}).click(); check(Math.abs((await geometry(page)).canvas.width / (await geometry(page)).canvas.height - 4/3) < .01, 'format changes preserve aspect-bound canvas', context);
        await page.getByRole('button', {name:'Вернуть сохранённое',exact:true}).click(); await page.waitForFunction(() => document.querySelector('button[aria-pressed="true"]') && [...document.querySelectorAll('button')].some(e => e.textContent==='16:9' && e.getAttribute('aria-pressed')==='true'));
        const download = page.waitForEvent('download'); await page.getByRole('button', {name:'Экспорт',exact:true}).click(); const exported = await download; const exportedPath = await exported.path(); const payload = JSON.parse(fs.readFileSync(exportedPath, 'utf8'));
        check(!JSON.stringify(payload).includes('fixture-view-token') && !JSON.stringify(payload).includes('guest-1'), 'portable export retains removal of access and source identities', context);
        await page.locator('input[accept=".json,application/json"]').setInputFiles({name:'layout.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify(payload))});
        await page.waitForFunction(() => [...document.querySelectorAll('[role="status"]')].some(e => e.textContent.includes('Сцена импортирована')));
        check(await page.locator('[aria-label^="Ячейка "]').count() === 16, 'import retains scene slots', context);
        await page.getByRole('button', {name:'Закрыть',exact:true}).click();
        check(await page.locator('[data-design-surface="multiview"]').count() === 0, 'close returns to underlying workspace', context);
      }
    }
    await page.close();
  }
  fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ baseline, results, failures, errors }, null, 2));
  console.log(JSON.stringify({ out, cases:results.length, failures, errors }));
  if (!baseline) { assert.deepEqual(errors, []); assert.deepEqual(failures, []); }
})().finally(async () => { await browser?.close(); await new Promise(resolve => server ? server.close(resolve) : resolve()); }).catch(error => { console.error(error); process.exitCode = 1; });
