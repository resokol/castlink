// Production components/CSS rendered with synthetic local video, without SFU/devices.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..'), req = createRequire(path.join(web, 'package.json'));
const { chromium } = req('playwright');
const out = process.env.CASTLINK_LAYOUT_QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-ui-layout-'));
fs.mkdirSync(out, { recursive: true });
const loader = path.join(out, 'ts-loader.cjs'), cssLoader = path.join(out, 'css-loader.cjs');
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(req.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);
fs.writeFileSync(cssLoader, `module.exports=function(s){const names={},globals=[];s=s.replace(/:global\\(([^)]+)\\)/g,(_,v)=>'__GLOBAL_'+(globals.push(v)-1)+'__').replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,v)=>'.'+(names[v]='qa_'+v)).replace(/__GLOBAL_(\\d+)__/g,(_,i)=>globals[i]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names);};`);
const proof = [], errors = [];
let server, browser;
async function bundle() {
  const wp = req('next/dist/compiled/webpack/webpack'); wp.init();
  await new Promise((resolve, reject) => wp.webpack({ mode: 'development', entry: path.join(__dirname, 'fixtures/ui-layout-corrections.tsx'), devtool: false, output: { path: out, filename: 'bundle.js' }, resolve: { extensions: ['.ts', '.tsx', '.js', '.mjs'], alias: { '@': web }, modules: [path.join(web, 'node_modules'), 'node_modules'] }, module: { rules: [{ test: /\.tsx?$/, use: loader }, { test: /\.css$/, use: cssLoader }] }, plugins: [new wp.webpack.DefinePlugin({ 'process.env.NEXT_PUBLIC_BUILD_ID': JSON.stringify('development'), 'process.env.NEXT_PUBLIC_APP_VERSION': JSON.stringify('development'), 'process.env.NEXT_PUBLIC_PRODUCT_VERSION': JSON.stringify('development'), 'process.env.NEXT_PUBLIC_BUILD_NUMBER': JSON.stringify('development') })], optimization: { minimize: false } }, (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({ all: false, errors: true }))) : resolve()));
}
async function capture(page, name) { await page.screenshot({ path: path.join(out, name + '.png'), fullPage: true }); }
async function scene(page, width, height, count) {
  await page.setViewportSize({ width, height });
  await page.goto(origin + '/?view=scene&count=' + count);
  await page.waitForFunction(() => window.qaSetCount && document.querySelector('[data-scene-mobile]'));
  await page.waitForFunction(() => [...document.querySelectorAll('video')].every(video => video.videoWidth === 640));
  await page.getByRole('button', { name: 'Плитка', exact: true }).click();
  await page.waitForTimeout(120);
  await page.evaluate(() => { window.qaVideos = [...document.querySelectorAll('video')].map(video => ({ video, stream: video.srcObject, track: video.srcObject.getVideoTracks()[0] })); });
  const box = await page.evaluate(() => {
    const scene = document.querySelector('[data-scene-mode]'), viewport = scene.querySelector('[tabindex="0"]');
    const tiles = [...scene.querySelectorAll('video')].map(video => { const r = video.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; });
    return { tiles, columns: tiles.filter(tile => Math.abs(tile.y - tiles[0].y) < 1).length, scroll: viewport.scrollHeight > viewport.clientHeight, separators: scene.querySelectorAll('[role="separator"]').length, scrollWidth: document.documentElement.scrollWidth };
  });
  if (width <= 700 && height >= width) {
    assert.equal(box.columns, count > 1 ? 2 : 1, 'portrait Tiles has exactly two columns');
    assert.equal(box.separators, 0, 'no mobile divider');
    if (count === 20) assert(box.scroll, 'many guests scroll vertically');
  }
  for (const tile of box.tiles) assert(Math.abs(tile.width / tile.height - 16 / 9) < .01, 'equal 16:9 tile frames');
  assert(box.scrollWidth <= width, 'no page overflow');
  await capture(page, `tiles-${width}-${count}`);
  await page.getByRole('button', { name: 'Окно', exact: true }).click();
  await page.getByRole('button', { name: 'Плитка', exact: true }).click();
  const continuity = await page.evaluate(() => window.qaVideos.every(({ video, stream, track }) => video.isConnected && video.srcObject === stream && track.readyState === 'live'));
  assert(continuity, 'mode changes keep the same live keyed video nodes');
  proof.push({ view: 'scene', width, height, count, continuity, ...box });
}
async function studio(page, width, theme, height=1000) {
  await page.setViewportSize({ width, height });
  await page.goto(origin + '/?view=studio');
  await page.locator('.source-card').first().waitFor();
  await page.waitForFunction(()=>document.querySelector('.return-preview')?.videoWidth===640);
  assert.equal(await page.locator('.studio-return-heading').textContent(),'STUDIO PLABACK');
  assert.equal(await page.locator('.studio-header h1').evaluate(e=>getComputedStyle(e).fontSize),'18px','compact studio heading gives playback more height');
  await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
  const geometry = await page.evaluate(() => {
    const rect = e => { const r = e.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return { viewportHeight: innerHeight, section: rect(document.querySelector('.studio-return-section')), heading: rect(document.querySelector('.studio-return-heading')), preview: rect(document.querySelector('.studio-return-preview-card')), picture: rect(document.querySelector('.return-preview')), meter: rect(document.querySelector('.studio-preview-meter')), invites: rect(document.querySelector('.studio-invite-compact')), sources: rect(document.querySelector('.studio-sources-section')), cards: [...document.querySelectorAll('.source-card')].map(rect), rail: rect(document.querySelector('.studio-return-rail')), screen: rect(document.querySelector('.studio-screen-share-button')), audio: rect(document.querySelector('.studio-quick-controls > button:nth-last-child(2)')), selects: [...document.querySelectorAll('.return-output-controls select')].map(rect), scrollWidth: document.documentElement.scrollWidth };
  });
  assert(geometry.meter.y >= geometry.picture.y + geometry.picture.height - 1 && geometry.invites.y >= geometry.meter.y + geometry.meter.height - 1, 'audio meter stays between playback picture and invitations');
  if (width > 960) {
    assert(Math.abs(geometry.preview.y - geometry.rail.y) < 1, 'playback and outgoing rail have aligned tops');
    assert(geometry.sources.y >= geometry.viewportHeight, 'desktop guest cards start below the first viewport');
    assert(geometry.invites.y+geometry.invites.height<=geometry.viewportHeight+1 && geometry.rail.y+geometry.rail.height<=geometry.viewportHeight+1,'playback invitations and outgoing panel fit the first desktop screen');
    assert(geometry.sources.y >= geometry.rail.y + geometry.rail.height - 1, 'guests follow the complete playback and outgoing block');
  } else {
    assert(geometry.rail.y >= geometry.invites.y + geometry.invites.height - 1, 'narrow layout keeps rail after invitations');
    assert(geometry.sources.y >= geometry.rail.y + geometry.rail.height - 1, 'narrow layout keeps guests after outgoing stream');
  }
  if(width>960){
    const visibleControls=await page.locator('.return-output-controls select').evaluateAll(selects=>selects.map(select=>{
      const r=select.getBoundingClientRect();
      return r.top>=0&&r.bottom<=innerHeight&&select.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));
    }));
    assert.equal(visibleControls.length,4,'all four output settings are present');
    assert(visibleControls.every(Boolean),'FPS, bitrate, codec and layer mode are visible without scrolling');
  }
  const columns = geometry.cards.filter(card => Math.abs(card.y - geometry.cards[0].y) < 1).length;
  if (width >= 1280) assert.equal(columns, 5, `${width}px overview shows five guest cards per row`);
  else assert(columns < 5, 'smaller viewports reduce the column count');
  assert(Math.abs(geometry.screen.width - geometry.audio.width) < 1 && Math.abs(geometry.screen.height - geometry.audio.height) < 1, 'screen/audio buttons have equal dimensions');
  for(const [a,b] of [[0,1],[2,3]]) assert(Math.abs(geometry.selects[a].y-geometry.selects[b].y)<1,'paired output controls align horizontally');
  assert(geometry.selects.every(select => Math.abs(select.width - geometry.selects[0].width) < 1 && Math.abs(select.height - geometry.selects[0].height) < 1), 'wrapped quality labels retain equal select dimensions');
  assert(geometry.scrollWidth <= width, 'studio has no page overflow');
  await page.locator('.source-card-advanced > summary').first().click();
  await page.locator('.guest-diagnostics > summary').first().click();
  assert(await page.getByLabel('Битрейт участника Александр — длинное имя').isVisible(), 'source quality stays reachable');
  assert(await page.getByText('Logitech Brio', { exact: true }).first().isVisible(), 'source device telemetry stays reachable');
  const overflow = await page.locator('.source-card').evaluateAll(cards => cards.some(card => card.scrollWidth > card.clientWidth + 1));
  assert.equal(overflow, false, 'expanded source controls and telemetry stay inside cards');
  await page.evaluate(()=>{window.qaPlaybackVideo=document.querySelector('.return-preview');window.qaPlaybackTrack=window.qaPlaybackVideo.srcObject.getVideoTracks()[0];});
  await page.evaluate(()=>window.qaSetStudioActive(false));
  await page.waitForFunction(()=>document.querySelector('.studio-return-section').hidden);
  await page.evaluate(()=>window.qaSetStudioActive(true));
  await page.waitForFunction(()=>!document.querySelector('.studio-return-section').hidden&&document.querySelector('.studio-return-section').style.getPropertyValue('--studio-playback-height'));
  assert.equal(await page.evaluate(()=>window.qaPlaybackVideo===document.querySelector('.return-preview')&&window.qaPlaybackTrack.readyState==='live'),true,'tab switch keeps the same live playback video');
  assert.equal(await page.locator('.return-preview').evaluate(e=>getComputedStyle(e).objectFit),'contain','decoded playback stays proportional');
  if(width>960)assert(Math.abs(geometry.invites.y+geometry.invites.height-geometry.rail.y-geometry.rail.height)<2,'invitations align with the bottom of outgoing rail');
  await page.evaluate(()=>scrollTo(0,0));
  if(width>960){
    await page.evaluate(()=>{const note=document.createElement('div');note.id='qa-room-notice';note.style.height='48px';document.querySelector('.studio-return-layout').before(note);});
    await page.waitForFunction(()=>{const e=document.querySelector('.studio-return-section');return Math.abs(e.getBoundingClientRect().top+e.getBoundingClientRect().height-innerHeight)<2;});
    assert(await page.locator('.return-output-controls select').evaluateAll(selects=>selects.every(e=>e.getBoundingClientRect().bottom<=innerHeight)),'settings remain in viewport after a room notice appears');
    await page.evaluate(()=>document.getElementById('qa-room-notice').remove());
    await page.waitForFunction(()=>{const e=document.querySelector('.studio-return-section');return Math.abs(e.getBoundingClientRect().top+e.getBoundingClientRect().height-innerHeight)<2;});
  }
  if(width>960){
    await page.evaluate(()=>window.qaSetModerator(true));
    await page.locator('.studio-moderator-listen').waitFor();
    const volume=page.locator('.studio-moderator-listen input[type="range"]');
    await volume.scrollIntoViewIfNeeded();
    assert(await volume.evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'moderator personal volume remains reachable');
    await page.locator('.return-stats-diagnostics').evaluate(e=>e.scrollTop=0);
    assert(await page.locator('.return-output-controls select').evaluateAll(selects=>selects.every(e=>{const r=e.getBoundingClientRect();return r.bottom<=innerHeight&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));})),'moderator settings stay visible alongside real personal monitoring controls');
    await page.evaluate(()=>{const d=document.querySelector('.return-stats-diagnostics');for(let i=0;i<3;i++){const e=document.createElement('p');e.className='studio-control-error';e.setAttribute('role','alert');e.textContent='Не удалось изменить качество эфира. Проверьте подключение к основной студии и повторите попытку.';d.append(e);}});
    const alerts=page.locator('.return-stats-diagnostics [role="alert"]');
    await alerts.last().scrollIntoViewIfNeeded();
    assert(await alerts.last().evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'last control error remains reachable by scrolling diagnostics');
    assert(await page.locator('.return-output-controls select').evaluateAll(selects=>selects.every(e=>e.getBoundingClientRect().bottom<=innerHeight)),'alerts do not displace pinned settings');
    await page.evaluate(()=>{document.querySelectorAll('.return-stats-diagnostics [role="alert"]').forEach(e=>e.remove());document.querySelector('.return-stats-diagnostics').scrollTop=0;window.qaSetModerator(false);scrollTo(0,0);});
  }
  await page.waitForFunction(()=>!document.querySelector('.studio-moderator-listen'));
  await capture(page, `studio-${theme}-${width}-${height}`);
  await page.screenshot({path:path.join(out,`studio-${theme}-${width}-${height}-viewport.png`)});
  proof.push({ view: 'studio', width, height, theme, columns, overflow, ...geometry });
}
let origin;
(async () => {
  await bundle();
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://qa.local');
    if (url.pathname.startsWith('/api/')) { response.setHeader('content-type', 'application/json'); response.end(JSON.stringify({ buildId: 'development', version: 'development' })); return; }
    const file = url.pathname === '/bundle.js' ? path.join(out, 'bundle.js') : url.pathname === '/livekit.css' ? req.resolve('@livekit/components-styles') : url.pathname === '/icon.svg' ? path.join(web, 'app/icon.svg') : url.pathname.startsWith('/new/') ? path.join(web, '../../design-preview', url.pathname) : url.pathname === '/globals.css' ? path.join(web, 'app/globals.css') : url.pathname === '/graphite.css' ? path.join(web, 'app/graphite-workspace.css') : null;
    if (file && fs.existsSync(file)) { response.setHeader('content-type', file.endsWith('.js') ? 'text/javascript' : file.endsWith('.woff2') ? 'font/woff2' : file.endsWith('.svg') ? 'image/svg+xml' : 'text/css'); response.end(fs.readFileSync(file)); return; }
    response.setHeader('content-type', 'text/html'); response.end('<!doctype html><html data-theme="dark" data-design-preview="on"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/livekit.css"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/graphite.css"><link rel="stylesheet" href="/new/live-theme.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve)); origin = 'http://127.0.0.1:' + server.address().port;
  browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
  const page = await browser.newPage(); page.on('pageerror', error => { errors.push(error.message); console.error('Browser error:', error.message); });
  for (const count of [1, 2, 3, 20]) await scene(page, 390, 844, count);
  await scene(page, 1440, 900, 6);
  for (const width of [390, 1100, 1280, 1440]) for (const theme of ['dark', 'light']) await studio(page, width, theme);
  for (const [width,height] of [[1280,720],[1440,900],[1920,1080]]) await studio(page,width,'dark',height);
  await studio(page,1440,'light',900);
  await page.setViewportSize({ width: 1440, height: 1000 }); await page.goto(origin + '/?view=preflight'); await page.getByLabel('Как вас представить').waitFor();
  await page.waitForFunction(() => [...document.images].every(image => image.complete && image.naturalWidth > 0));
  for (const theme of ['dark', 'light']) { await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme); await capture(page, 'preflight-' + theme); }
  assert.deepEqual(errors, [], 'no browser errors');
  fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify(proof, null, 2));
  console.log('PASS UI layout corrections: production components, portrait/desktop tiles, video continuity, five-column studio, equal controls, both themes; proof ' + out);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server?.close(); });
