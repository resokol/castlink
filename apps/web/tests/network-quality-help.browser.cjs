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
const { build } = require(process.env.CASTLINK_QA_ESBUILD || '/workspace/scratch/castlink-preview-tools/node_modules/esbuild');
const out = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-network-help-proof-'));
let server, browser;
async function checkStatsLayout(page) {
  const layouts = await page.locator('.studio-caster-card dl:has([data-network-help-toggle])').evaluateAll(elements => elements.filter(element => element.getBoundingClientRect().width > 0).map(element => {
    const [video, audio, network] = [...element.children].map(row => ({ box: row.getBoundingClientRect(), label: row.querySelector('dt').getBoundingClientRect(), value: row.querySelector('dd').getBoundingClientRect() }));
    return {
      paired: Math.abs(video.box.top - audio.box.top) < 1 && Math.abs(video.box.width - audio.box.width) < 1,
      aligned: Math.abs(video.label.top - audio.label.top) < 1 && Math.abs(video.value.top - audio.value.top) < 1,
      networkBelow: network.box.top >= Math.max(video.box.bottom, audio.box.bottom),
      networkGap: network.value.left - network.label.right,
      fits: element.scrollWidth <= element.clientWidth + 1,
      divider: getComputedStyle(element.children[1]).borderInlineStartWidth,
    };
  }));
  assert.ok(layouts.length, 'actual guest statistics are visible');
  for (const layout of layouts) {
    assert.ok(layout.paired && layout.aligned, 'video and audio keep equal aligned columns in the first row');
    assert.ok(layout.networkBelow, 'network keeps its own second row');
    assert.ok(layout.networkGap >= 5 && layout.networkGap <= 8, 'network label and grade stay grouped');
    assert.ok(layout.fits, 'statistics fit the card');
    assert.equal(layout.divider, '1px', 'a restrained divider separates the two bitrate columns');
  }
  return layouts;
}
async function main() {
  await build({ entryPoints: [path.join(__dirname, 'fixtures/guest-mini-stats-refresh.tsx')], outfile: path.join(out, 'bundle.js'), bundle: true, platform: 'browser', format: 'iife', target: 'es2022', jsx: 'automatic', alias: { '@': web }, nodePaths: [path.join(web, 'node_modules')], loader: { '.css': 'local-css' }, define: { 'process.env': JSON.stringify({ NODE_ENV: 'production', NEXT_PUBLIC_BUILD_ID: 'preview-eaa94d193230', NEXT_PUBLIC_APP_VERSION: '1.0.1-preview', NEXT_PUBLIC_PRODUCT_VERSION: '1.0.1', NEXT_PUBLIC_BUILD_NUMBER: 'preview' }) } });
  let documentRequests = 0, versionRequests = 0;
  const audioProfiles = new Map(), audioResults = new Map(), audioCommands = [];
  let failAudioCommand = false;
  server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://preview.local');
    if (url.pathname === '/api/version') {
      versionRequests++;
      response.setHeader('content-type', 'application/json');
      response.end(JSON.stringify({ version: 'preview-eaa94d193230', buildId: 'preview-eaa94d193230' })); return;
    }
    if (url.pathname === '/api/guest-media-control') {
      response.setHeader('content-type', 'application/json');
      if (request.method === 'POST') {
        let body = ''; request.on('data', chunk => { body += chunk; });
        request.on('end', () => {
          const command = JSON.parse(body); audioCommands.push(command);
          if (failAudioCommand) { response.statusCode = 409; response.end(JSON.stringify({ error: 'Тест: гость отключён' })); return; }
          const id = `audio-${audioCommands.length}`;
          audioProfiles.set(command.identity, command.patch.audioProfile);
          audioResults.set(command.identity, { id, ok: true });
          response.end(JSON.stringify({ command: { id, expiresAt: Date.now() + 60_000, patch: command.patch } }));
        });
      } else {
        const identity = url.searchParams.get('identity'), audioProfile = audioProfiles.get(identity) || 'raw';
        response.end(JSON.stringify({ participantSid: `PA-${identity}`, state: { audioProfile, noiseSuppressionState: audioProfile === 'speech' ? 'on' : 'off', connectionRoute: 'auto', micGain: 100, listenGain: 100, videoCodec: 'vp8', supportedVideoCodecs: ['vp8'] }, result: audioResults.get(identity) }));
      }
      return;
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

  const errors = [], cases = [];
  for (const [width,height,theme] of (process.env.CASTLINK_NETWORK_AUDIO_ONLY ? [] : [[1440,900,'dark'],[1440,900,'light'],[1280,540,'dark'],[360,873,'dark']])) {
    for (const locale of ['ru','en','zh-CN']) {
      const page = await browser.newPage({viewport:{width,height}});
      page.on('pageerror', error=>errors.push(error.message));
      await page.clock.install();
      await page.goto(`http://127.0.0.1:${server.address().port}/?view=studio&count=5`);
      await page.waitForFunction(()=>document.querySelectorAll('video').length===6&&[...document.querySelectorAll('video')].every(v=>v.videoWidth>0));
      await page.evaluate(({theme,locale})=>{document.documentElement.dataset.theme=theme;window.qaSetLocale(locale);document.body.setAttribute('data-freeze-stats','');},{theme,locale});
      await page.waitForTimeout(80);
      const statsLayouts = await checkStatsLayout(page);
      const toggles=page.locator('[data-network-help-toggle]');
      assert.equal(await toggles.count(),5,'all five guests have help triggers');
      const controls=await toggles.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),a=e.querySelector('svg').getBoundingClientRect(),t=e.querySelector('span').getBoundingClientRect();return{height:r.height,arrowWidth:a.width,arrowHeight:a.height,arrowAfterText:a.x>=t.right,grade:e.parentElement.dataset.quality};}));
      for(const control of controls){assert.equal(control.height,24,'24px pointer target');assert.equal(control.arrowWidth,10,'10px chevron');assert.equal(control.arrowHeight,10);assert.equal(control.arrowAfterText,true,'chevron on right of grade');}
      assert.equal(controls.at(-1).grade,'unknown','unknown guest also has chevron');
      const geometry=await page.evaluate(()=>({width:innerWidth,height:innerHeight,pageWidth:document.documentElement.scrollWidth,pageHeight:document.documentElement.scrollHeight,cards:[...document.querySelectorAll('.studio-caster-card')].map(e=>{const r=e.getBoundingClientRect(),s=e.querySelector('dl').getBoundingClientRect();return{height:r.height,bottom:r.bottom,statsBottom:s.bottom,statsHeight:s.height};})}));
      const name=`${width}x${height}-${theme}-${locale}`;
      await page.screenshot({path:path.join(out,`${name}-closed.png`),fullPage:width<1280});
      if(width>=1280){
        assert.ok(geometry.pageWidth<=width+1,'desktop no horizontal overflow');
        assert.ok(geometry.pageHeight<=height+1,'desktop console fits height');
        const reachable = await page.locator('.source-browser').evaluate(element => {
          const last = element.querySelector('.studio-caster-card:last-child dl');
          element.scrollTop = element.scrollHeight;
          const bounds = element.getBoundingClientRect(), stats = last.getBoundingClientRect();
          const fits = stats.top >= bounds.top && stats.bottom <= bounds.bottom + 1;
          element.scrollTop = 0;
          return fits;
        });
        assert.ok(reachable, 'short consoles keep the last statistics reachable inside the source scroll panel');
      }
      const baseline=await page.addStyleTag({content:'[data-network-help-toggle]{height:auto!important;min-height:0!important;margin:0!important}[data-network-help-toggle] svg{display:none!important}'});
      const legacyHeights=await page.locator('.studio-caster-card').evaluateAll(es=>es.map(e=>e.getBoundingClientRect().height));
      await baseline.evaluate(e=>e.remove());
      const heightDeltas=geometry.cards.map((c,i)=>c.height-legacyHeights[i]);
      // All grade variants, including No Data, must open their own native surface.
      for(const index of [0,1,2,4]) {
        const toggle=toggles.nth(index);
        await toggle.click();
        const id=await toggle.getAttribute('aria-controls');
        const popup=page.locator(`[data-network-help][id="${id}"]`);
        await page.waitForFunction(id=>{const p=document.getElementById(id);return p?.matches(':popover-open')&&p.contains(document.activeElement);},id,{timeout:2000});
        assert.equal(await page.locator('[data-network-help]:popover-open').count(),1);
        const fit=await popup.evaluate(e=>{const r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+20,r.y+20);return{x:r.x,y:r.y,right:r.right,bottom:r.bottom,width:r.width,scrollWidth:e.scrollWidth,clientWidth:e.clientWidth,viewportWidth:innerWidth,viewportHeight:innerHeight,topLayerHit:hit?.closest('[data-network-help]')===e,focusInside:e.contains(document.activeElement)};});
        assert.ok(fit.x>=0&&fit.y>=0&&fit.right<=width+1&&fit.bottom<=height+1,`${name}: popup within viewport ${JSON.stringify(fit)}`);
        assert.ok(fit.scrollWidth<=fit.clientWidth+1,`${name}: help text fits`);
        assert.ok(fit.topLayerHit&&fit.focusInside,`native top layer and close focus ${name}/${index}: ${JSON.stringify(fit)}`);
        assert.equal(await popup.locator('[data-network-help-grade]').count(),3);
        assert.equal(await popup.locator('[data-network-help-close]').evaluate(e=>e.getBoundingClientRect().height),24,'24px close target');
        assert.match(await popup.innerText(),/≤ 2/);assert.match(await popup.innerText(),/31–60/);assert.match(await popup.innerText(),/> 300/);
        if(index===0)await page.clock.runFor(150);
        if(index===0)await page.screenshot({path:path.join(out,`${name}-open.png`)});
        if(index===1){await popup.locator('[data-network-help-close]').click();}
        else if(index===2){await page.mouse.click(2,2);}
        else await page.keyboard.press('Escape');
        await page.waitForFunction(id=>!document.getElementById(id)?.matches(':popover-open'),id);
        await page.waitForFunction(id=>document.activeElement===document.querySelector(`[data-network-help-toggle][aria-controls="${id}"]`),id,{timeout:2000}).catch(async error=>{console.log(JSON.stringify({focusFailure:{name,index,active:await page.evaluate(()=>document.activeElement?.outerHTML)}}));throw error;});
      }
      if(width===1440&&theme==='dark'&&locale==='ru'){
        await toggles.first().click();
        const popup=page.locator('[data-network-help]:popover-open');
        await page.waitForFunction(()=>{const p=document.querySelector('[data-network-help]:popover-open');return p&&p.contains(document.activeElement);});
        await page.evaluate(()=>{window.qaHelpMedia=[...document.querySelectorAll('video')].map(video=>({video,stream:video.srcObject,tracks:video.srcObject.getTracks()}));window.qaHelpFocus=document.activeElement;window.qaHelpPopup=document.querySelector('[data-network-help]:popover-open');window.qaHelpUnmounts=JSON.stringify(window.qaRefresh.unmounts);document.body.removeAttribute('data-freeze-stats');});
        const before=await toggles.first().innerText();await page.clock.runFor(1100);
        assert.notEqual(await toggles.first().innerText(),before,'grade changes while help is open');
        await page.evaluate(()=>document.body.setAttribute('data-freeze-stats',''));await page.clock.runFor(12000);
        assert.match(await toggles.first().innerText(),/Нет данных/);
        assert.ok(await page.evaluate(()=>window.qaHelpPopup.matches(':popover-open')&&document.activeElement===window.qaHelpFocus&&JSON.stringify(window.qaRefresh.unmounts)===window.qaHelpUnmounts&&window.qaHelpMedia.every(o=>o.video.isConnected&&o.video.srcObject===o.stream&&o.tracks.every((t,i)=>o.stream.getTracks()[i]===t&&t.readyState==='live'))),'changes and expiry retain popup/focus/video owners');
        await page.keyboard.press('Escape');
      }
      cases.push({name,controls,geometry,heightDeltas,statsLayouts});await page.close();
    }
  }
  const expandedCases = [];
  if (!process.env.CASTLINK_NETWORK_AUDIO_ONLY) for (const width of [360, 1440]) for (const theme of ['dark', 'light']) for (const locale of ['ru', 'en', 'zh-CN']) {
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/?view=studio&count=1`);
    await page.waitForFunction(() => typeof window.qaSetStudioActive === 'function');
    await page.evaluate(({ theme, locale }) => { document.documentElement.dataset.theme = theme; window.qaSetLocale(locale); window.qaSetStudioActive(false); document.body.setAttribute('data-freeze-stats', ''); }, { theme, locale });
    const statsLayouts = await checkStatsLayout(page);
    const name = `expanded-${width}-${theme}-${locale}`;
    await page.screenshot({ path: path.join(out, `${name}.png`), fullPage: true });
    expandedCases.push({ name, statsLayouts });
    await page.close();
  }
  const cardCaptures = [];
  if (!process.env.CASTLINK_NETWORK_AUDIO_ONLY) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    await page.goto(`http://127.0.0.1:${server.address().port}/?view=studio&count=1`);
    await page.waitForFunction(() => document.querySelector('video')?.videoWidth > 0);
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; document.body.setAttribute('data-freeze-stats', ''); }, theme);
    await checkStatsLayout(page);
    const card = page.locator('.studio-caster-card').first();
    const box = await card.boundingBox();
    assert.ok(Math.abs(box.width - 340) < 1, 'single-source overview exercises the 340px card');
    const screenshot = path.join(out, `card-340-${theme}.png`);
    await card.screenshot({ path: screenshot });
    cardCaptures.push({ width: box.width, theme, screenshot });
    await page.close();
  }
  const audioCases = [];
  for (const width of [320, 360, 1280, 1440]) for (const theme of ['dark', 'light']) {
    audioProfiles.clear(); audioResults.clear(); failAudioCommand = false;
    const page = await browser.newPage({ viewport: { width, height: 900 } });
    page.on('pageerror', error => errors.push(error.message));
    await page.clock.install();
    await page.goto(`http://127.0.0.1:${server.address().port}/?view=studio&count=5`);
    await page.waitForFunction(() => document.querySelectorAll('video').length === 6 && [...document.querySelectorAll('video')].every(v => v.videoWidth > 0));
    await page.evaluate(theme => { document.documentElement.dataset.theme = theme; window.qaSetLocale('ru'); }, theme);
    await checkStatsLayout(page);
    if (width === 320) {
      const card = page.locator('.studio-caster-card').first(), box = await card.boundingBox();
      const screenshot = path.join(out, `card-narrow-${theme}.png`);
      await card.screenshot({ path: screenshot });
      cardCaptures.push({ width: box.width, theme, screenshot });
    }
    const settingsTrigger = page.locator('.guest-card-heading button[popovertarget]').first();
    await settingsTrigger.click();
    const menu = page.locator('.studio-caster-card > [popover]:not([data-network-help]):popover-open');
    await menu.locator('.guest-card-settings > summary').click();
    const audioSwitch = menu.getByRole('switch');
    await page.waitForFunction(() => { const input = document.querySelector('.studio-caster-card > [popover]:not([data-network-help]):popover-open [role="switch"]'); return input && !input.disabled; });
    await audioSwitch.scrollIntoViewIfNeeded();
    const size = await audioSwitch.evaluate(e => { const r = e.getBoundingClientRect(), label = e.closest('label').getBoundingClientRect(); return { width: r.width, height: r.height, right: r.right, labelRight: label.right }; });
    assert.equal(size.width, 44, 'combined card menu switch width44'); assert.equal(size.height, 26, 'combined card menu switch height26');
    assert.ok(size.right <= size.labelRight + 1, 'switch remains beside its copy');
    assert.equal(await audioSwitch.isChecked(), false, 'combined default is raw/off');
    await page.evaluate(() => { window.qaCombined = { videos: [...document.querySelectorAll('video')].map(video => ({ video, stream: video.srcObject, tracks: video.srcObject.getTracks() })), unmounts: JSON.stringify(window.qaRefresh.unmounts), menu: document.querySelector('.studio-caster-card > [popover]:not([data-network-help]):popover-open') }; });
    const unchanged = () => page.evaluate(() => window.qaCombined.videos.every(o => o.video.isConnected && o.video.srcObject === o.stream && o.tracks.every((t, i) => o.stream.getTracks()[i] === t && t.readyState === 'live')) && JSON.stringify(window.qaRefresh.unmounts) === window.qaCombined.unmounts);
    await Promise.all([page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/api/guest-media-control')), audioSwitch.click()]);
    assert.deepEqual(audioCommands.at(-1).patch, { audioProfile: 'speech' });
    assert.equal(audioCommands.at(-1).participantSid, 'PA-guest-0');
    await page.clock.runFor(2100);
    await page.waitForFunction(() => { const input = document.querySelector('.studio-caster-card > [popover]:not([data-network-help]):popover-open [role="switch"]'); return input.checked && !input.disabled; });
    await audioSwitch.focus();
    const statsBefore = await page.locator('[data-network-help-toggle]').first().innerText();
    const bitrateBefore = await page.locator('.studio-caster-card').first().locator('dl dd').first().innerText();
    await page.clock.runFor(1100);
    assert.notEqual(await page.locator('.studio-caster-card').first().locator('dl dd').first().innerText(), bitrateBefore, 'measured values really change while audio menu stays open');
    assert.ok(await menu.evaluate(e => e.matches(':popover-open')), 'metric updates retain actual audio menu');
    assert.equal(await audioSwitch.evaluate(e => document.activeElement === e), true, 'metric updates retain audio-switch focus');
    assert.ok(await unchanged(), 'audio command and stats retain media owners');
    await page.screenshot({ path: path.join(out, `combined-audio-${width}-${theme}.png`) });
    await Promise.all([page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/api/guest-media-control')), audioSwitch.click()]);
    assert.deepEqual(audioCommands.at(-1).patch, { audioProfile: 'raw' });
    await page.clock.runFor(2100);
    await page.waitForFunction(() => { const input = document.querySelector('.studio-caster-card > [popover]:not([data-network-help]):popover-open [role="switch"]'); return !input.checked && !input.disabled; });
    failAudioCommand = true;
    await Promise.all([page.waitForResponse(r => r.request().method() === 'POST' && r.url().includes('/api/guest-media-control')), audioSwitch.click()]);
    await menu.getByRole('alert').waitFor();
    assert.equal(await audioSwitch.isChecked(), false, 'failed audio command retains confirmed off value');
    failAudioCommand = false;
    // Native auto surfaces replace each other without stealing media ownership.
    const networkTrigger = page.locator('[data-network-help-toggle]').first();
    await networkTrigger.click();
    await page.waitForFunction(() => { const p = document.querySelector('[data-network-help]:popover-open'); return p && p.contains(document.activeElement); });
    assert.equal(await page.locator('.studio-caster-card > [popover]:not([data-network-help]):popover-open').count(), 0, 'network help closes audio menu');
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => document.activeElement === document.querySelector('[data-network-help-toggle]'));
    await networkTrigger.click();
    await settingsTrigger.click();
    await page.waitForFunction(() => { const p = document.querySelector('.studio-caster-card > [popover]:not([data-network-help]):popover-open'); return p && p.contains(document.activeElement); });
    assert.equal(await page.locator('[data-network-help]:popover-open').count(), 0, 'audio menu closes network help');
    assert.ok(await unchanged(), 'switching auto popovers retains every video track');
    audioCases.push({ width, theme, switch: size, ackAndError: true, autoPopoverSwitching: true, retainedVideos: 6, statsBefore });
    await page.close();
  }
  assert.deepEqual(errors,[]);
  const evidence={result:'PASS',note:'Actual Console A JSX/CSS and actual audio controls; synthetic local media, sample metrics and HTTP acknowledgements, no production room',cases,expandedCases,cardCaptures,audioCases,errors,screenshots:out};
  fs.writeFileSync(path.join(out,'results.json'),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify({result:'PASS',cases:cases.length,expandedCases:expandedCases.length,audioCases:audioCases.length,heightDeltas:cases.map(c=>({name:c.name,deltas:c.heightDeltas})),errors,evidencePath:path.join(out,'results.json'),screenshots:out}));
}
main().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close();});
