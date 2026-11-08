// Production UI components and CSS with local test media; no SFU or live room.
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const { createRequire } = require('node:module');
const web = path.resolve(__dirname, '..'), req = createRequire(path.join(web, 'package.json'));
const { chromium } = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');
const { build } = require(process.env.CASTLINK_QA_ESBUILD || 'esbuild');
const baseline = process.env.CASTLINK_COMPACT_BASELINE === '1';
const out = process.env.CASTLINK_COMPACT_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-studio-compact-'));
fs.mkdirSync(out, { recursive: true });
let server, browser; const results = [], failures = [], errors = [];
const check = (condition, message, context) => { if (!condition) failures.push({ message, ...context }); };
async function geometry(page) {
  return page.evaluate(() => {
    const box = e => { const r = e.getBoundingClientRect(); return { x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom }; };
    const find = s => { const e=document.querySelector(s);return e?box(e):null; };
    return { meter:find('.studio-preview-meter'), monitor:find('.studio-playback-monitor'), controls:find('.studio-playback-controls'),invites:find('.studio-invite-compact'),viewerCount:find('.invite-extra'), stage:find('.studio-playback-stage'), pictureStyle: (()=>{const s=getComputedStyle(document.querySelector('.return-preview')); return {aspect:s.aspectRatio,height:s.height,width:s.width,minHeight:s.minHeight,maxHeight:s.maxHeight,align:s.alignSelf};})(), layout:find('.studio-return-layout'), preview:find('.studio-return-preview-card'), picture:find('.return-preview'), rail:find('.studio-return-rail'), sources:find('.studio-sources-section'), deck:find('.source-browser'), firstCard:find('.source-card'), firstPicture:find('.studio-guest-video-wrap'), selects:[...document.querySelectorAll('.return-output-controls select')].map(box), diagnostics:find('.return-stats-diagnostics'),statGrid:find('.return-stat-grid'),chart:find('.bitrate-chart'),graph:find('.bitrate-chart svg'),stats:find('.return-stats'),transport:find('.studio-transport-bar'),footer:find('.workspace-footer'),pageWidth:document.documentElement.scrollWidth, pageHeight:document.documentElement.scrollHeight, guestScroll:document.querySelector('.source-browser').scrollHeight>document.querySelector('.source-browser').clientHeight };
  });
}
async function screenshot(page, name) { await page.screenshot({ path:path.join(out,name+'.png') }); }
(async()=>{
  await build({entryPoints:[path.join(__dirname,'fixtures/studio-compact.tsx')],outfile:path.join(out,'bundle.js'),bundle:true,platform:'browser',format:'iife',target:'es2022',jsx:'automatic',alias:{'@':web},nodePaths:[path.join(web,'node_modules')],loader:{'.css':'local-css'},define:{'process.env':JSON.stringify({NODE_ENV:'production',NEXT_PUBLIC_BUILD_ID:'preview',NEXT_PUBLIC_APP_VERSION:'preview',NEXT_PUBLIC_PRODUCT_VERSION:'preview',NEXT_PUBLIC_BUILD_NUMBER:'preview'})}});
  server=http.createServer((request,response)=>{
    const url=new URL(request.url,'http://fixture.local');
    if(url.pathname.startsWith('/api/')) { response.setHeader('content-type','application/json'); response.end(JSON.stringify({buildId:'preview',version:'preview',url:'https://example.invalid/test-invitation'})); return; }
    let file = url.pathname==='/bundle.js'?path.join(out,'bundle.js'):url.pathname==='/bundle.css'?path.join(out,'bundle.css'):url.pathname==='/livekit.css'?req.resolve('@livekit/components-styles'):url.pathname==='/globals.css'?path.join(baseline?'/tmp/castlink-studio-baseline':path.join(web,'app'),'globals.css'):url.pathname==='/graphite.css'?path.join(baseline?'/tmp/castlink-studio-baseline':path.join(web,'app'),'graphite-workspace.css'):url.pathname==='/preview-faces.webp'?process.env.CASTLINK_COMPACT_FACES:url.pathname==='/icon.svg'?path.join(web,'app/icon.svg'):url.pathname.startsWith('/new/')?path.join(web,'../../design-preview',url.pathname):null;
    if(file&&fs.existsSync(file)) { response.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':file.endsWith('.woff2')?'font/woff2':'text/css');response.end(fs.readFileSync(file));return; }
    if(url.pathname!=='/') { response.statusCode=404;response.end();return; }
    response.setHeader('content-type','text/html');response.end('<!doctype html><html data-theme="dark" data-design-preview="on"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/livekit.css"><link rel="stylesheet" href="/globals.css"><link rel="stylesheet" href="/graphite.css"><link rel="stylesheet" href="/new/live-theme.css"><link rel="stylesheet" href="/bundle.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const origin='http://127.0.0.1:'+server.address().port;
  browser=await chromium.launch({executablePath:process.env.CASTLINK_QA_CHROMIUM_BINARY||'/usr/bin/chromium',headless:true,args:['--no-sandbox','--disable-dev-shm-usage','--autoplay-policy=no-user-gesture-required','--use-fake-device-for-media-stream','--use-fake-ui-for-media-stream']});
  const cases=process.env.CASTLINK_COMPACT_APPROVED_CONFIRM==='1'?[[1440,900,'dark',5],[1440,900,'light',5],[1920,1080,'dark',5]]:process.env.CASTLINK_COMPACT_LOW_RED==='1'?[[1280,600,'dark',5]]:[[1280,540,'dark',1],[1280,540,'dark',5],[1280,540,'dark',20],[1280,560,'dark',5],[1280,560,'light',20],[1280,600,'dark',5],[1280,600,'light',5],[1280,600,'dark',20],[1440,900,'dark',5],[1440,900,'light',5],[1920,1080,'dark',5],[1024,600,'dark',5],[1024,700,'dark',20],[1280,600,'dark',0],[1280,600,'dark',1,true]];
  for(const [width,height,theme,count,portrait=false] of cases){
    const context={width,height,theme,count,portrait},page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>errors.push(e.message));
    await page.goto(origin+'/?view=studio&count='+count+(count===20?'&long=1':'')+(portrait?'&portrait=1':''));
    await page.waitForFunction(expected=>document.querySelector('.return-preview')?.videoWidth===expected,portrait?360:640);
    await page.waitForFunction(()=>[...document.querySelectorAll('.studio-guest-video-wrap video')].every(e=>e.dataset.qaFrame==='ready'));
    await page.waitForTimeout(180);await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);await page.waitForTimeout(100);
    const g=await geometry(page);results.push({...context,...g});
    check(g.pageWidth<=width+1&&g.pageHeight<=height+1,'console including real footer fits actual viewport',context);
    check(Math.abs(g.picture.width/g.picture.height-1.6)<.015,'program is16:10',context);
    check(g.picture.height>=110,'program stays readable',context);
    check(g.meter.x>=g.picture.right+4&&g.meter.width<=45&&Math.abs(g.meter.height-g.picture.height)<1,'vertical meter remains immediately beside picture',context);
    check(g.sources.x>=g.monitor.right+12&&g.sources.y<=g.preview.y,'approved A places guests beside program',context);
    check(g.footer&&g.footer.bottom<=height+1,'actual footer portal stays visible',context);
    check(g.selects.length===4&&await page.locator('.return-output-controls select').evaluateAll(es=>es.every(e=>{const r=e.getBoundingClientRect();if(r.y<0||r.bottom>innerHeight)return false;for(let p=e.parentElement;p;p=p.parentElement){const a=p.getBoundingClientRect(),s=getComputedStyle(p);if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.y<a.y-1||r.bottom>a.bottom+1))return false;}return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))})),'all four real codec/quality selectors are visible and unobstructed',context);
    if(width>=1180&&count>=5){check(await page.locator('.source-deck').evaluate(e=>getComputedStyle(e).gridTemplateColumns.split(' ').length===3),'approved A uses three guest columns at standard desktop widths',context);}
    if(count>0){
      check(await page.locator('.studio-guest-video-wrap').first().evaluate(e=>{const r=e.getBoundingClientRect();if(r.height<80||r.y<0||r.bottom>innerHeight)return false;for(let p=e.parentElement;p;p=p.parentElement){const s=getComputedStyle(p),a=p.getBoundingClientRect();if(/auto|scroll|hidden|clip/.test(s.overflowY)&&(r.y<a.y-1||r.bottom>a.bottom+1))return false;}return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'actual first guest picture >=80px fully inside every clipping ancestor',context);
      check(await page.locator('.guest-card-meter [role=meter]').first().evaluate(e=>{const r=e.getBoundingClientRect();return r.width>r.height}),'guest meter stays horizontal',context);
    }
    await page.evaluate(()=>{window.qaMedia=[...document.querySelectorAll('video')].map(video=>({video,stream:video.srcObject,track:video.srcObject?.getVideoTracks()[0]}));window.qaDevices=document.querySelector('#studio-settings .media-device-picker')});
    await screenshot(page,`console-a-${theme}-${width}x${height}-${count}-guests${portrait?'-portrait':''}`);
    if(width===1280&&height===600&&theme==='dark'&&count===5){
      const unchanged=()=>page.evaluate(()=>window.qaMedia.every(({video,stream,track})=>video.isConnected&&video.srcObject===stream&&track?.readyState==='live'));
      await page.getByRole('button',{name:'Устройства',exact:true}).click();
      check(await page.locator('#studio-settings').evaluate(e=>e.matches(':popover-open')),'actual device owner opens in native disclosure',context);
      check(await page.locator('#studio-settings').evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight}),'devices disclosure bounded',context);
      await screenshot(page,'console-a-devices-1280x600');await page.keyboard.press('Escape');
      check(await page.getByRole('button',{name:'Устройства',exact:true}).evaluate(e=>document.activeElement===e),'device Escape returns focus to real trigger',context);
      check(await page.evaluate(()=>window.qaDevices===document.querySelector('#studio-settings .media-device-picker')),'closing devices retains the same device controller DOM',context);
      await page.getByRole('button',{name:'Пригласить',exact:true}).click();check(await page.locator('#studio-access button').count()>=4,'actual guest/stream invite actions retained',context);await page.keyboard.press('Escape');
      await page.locator('.studio-settings-navigation').click();check(await page.locator('#studio-room-settings').evaluate(e=>e.matches(':popover-open')),'actual room-management form stays reachable',context);await page.keyboard.press('Escape');
      const mic=page.locator('.guest-card-heading button[aria-pressed]').first();const previous=await mic.getAttribute('aria-pressed');await mic.click();check((await mic.getAttribute('aria-pressed'))!==previous,'real card dispatches quick microphone callback',context);
      await page.locator('.guest-card-heading button[popoverTarget]').first().click();
      const menu=page.locator('[data-console-compact] > [popover]:popover-open');check(await menu.count()===1,'compact card opens native advanced surface',context);
      check(await menu.locator('.guest-card-bitrate select').count()===1&&await menu.locator('.personal-monitor-controls input[type=range]').count()===1&&await menu.locator('.guest-output-open').count()===1,'quality monitoring and output actions remain inside advanced surface',context);
      await menu.locator('.guest-card-bitrate select').selectOption('2000');check(await menu.locator('.guest-card-bitrate select').inputValue()==='2000','real quality callback updates selected bitrate',context);
      await menu.locator('.source-card-actions button').first().click();
      await screenshot(page,'console-a-guest-settings-1280x600');await page.keyboard.press('Escape');check(await unchanged(),'menus and actual quick controls retain live media nodes',context);
      await page.evaluate(()=>window.qaBusy(true));await page.waitForFunction(()=>document.querySelector(".air-toggle")?.disabled);check(await mic.isDisabled()&&await page.locator('.air-toggle').isDisabled(),'busy gates remain active on compact actions',context);await page.evaluate(()=>window.qaBusy(false));
      await page.getByRole('button',{name:'Участники',exact:true}).click();check(await page.locator('[data-console-compact=true]').count()===0,'participants use default card presentation',context);
      check(await page.locator('.source-card-advanced').first().count()===1,'default advanced details remain present',context);
      check(await page.locator('.source-card').first().evaluate(e=>{const a=e.querySelector('.source-card-advanced'),v=e.querySelector('.studio-guest-video-wrap');const controls=[...e.querySelectorAll('.guest-preview-actions,.source-card-actions')];return a&&v&&a.getBoundingClientRect().top>=Math.max(v.getBoundingClientRect().bottom,...controls.map(c=>c.getBoundingClientRect().bottom))-1}),'default Participants settings summary stays below guest picture',context);
      const defaultMicIcons=await page.locator('.source-card-actions button[aria-pressed] svg').evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect();return{width:r.width,height:r.height}}));results.at(-1).defaultMicIcons=defaultMicIcons;
      check(defaultMicIcons.length>0&&defaultMicIcons.every(r=>r.width<=24&&r.height<=24),'default primary microphone SVG stays within24px',context);
      await screenshot(page,'console-a-participants-default-1280x600');
      await page.getByRole('button',{name:'Студия',exact:true}).click();await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(100);await page.setViewportSize({width,height});await page.waitForTimeout(100);
      check(await unchanged(),'tabs and resize preserve every live keyed media node',context);
    }
    if(width===1920){
      await page.locator('.guest-card-heading button[popoverTarget]').nth(2).click();
      const menu=page.locator('[data-console-compact] > [popover]:popover-open');
      await menu.getByRole('button',{name:'Закрыть',exact:true}).focus();
      for(const target of [{width:1280,height:600},{width:1024,height:600}]){
        await page.setViewportSize(target);await page.waitForTimeout(80);
        check(await menu.evaluate(e=>{const r=e.getBoundingClientRect();return r.x>=0&&r.y>=0&&r.right<=innerWidth+1&&r.bottom<=innerHeight+1&&e.contains(document.activeElement)}),'open third guest popup clamps after resize and retains focus',{...context,target});
      }
      await page.keyboard.press('Escape');await page.setViewportSize({width,height});
      check(await page.evaluate(()=>window.qaMedia.every(({video,stream,track})=>video.isConnected&&video.srcObject===stream&&track?.readyState==='live')),'open popup resize preserves live media',context);
    }
    if(count===20){const before=await geometry(page);await page.locator('.source-browser').evaluate(e=>e.scrollTop=e.scrollHeight);const after=await geometry(page);check(Math.abs(after.picture.y-before.picture.y)<1&&Math.abs(after.rail.y-before.rail.y)<1,'only guest deck scrolls for additional guests',context);await page.locator('.source-browser').evaluate(e=>e.scrollTop=0);}
    if(portrait){await page.evaluate(()=>{const v=document.querySelector('.return-preview'),p=document.createElement('div');p.className='studio-preview-placeholder';p.textContent='Ожидание источника STUDIO PLAYBACK';v.replaceWith(p)});check(await page.locator('.studio-preview-placeholder').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-1.6)<.015}),'waiting placeholder keeps program aspect',context);}
    await page.close();
  }
  check(errors.length===0,'no browser errors',{errors});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({baseline,results,failures,errors},null,2));
  console.log(JSON.stringify({out,cases:results.length,failures,errors},null,2));assert.equal(failures.length,0,'compact studio browser proof');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close()});
