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
    return { stage:find('.studio-playback-stage'), pictureStyle: (()=>{const s=getComputedStyle(document.querySelector('.return-preview')); return {aspect:s.aspectRatio,height:s.height,width:s.width,minHeight:s.minHeight,maxHeight:s.maxHeight,align:s.alignSelf};})(), layout:find('.studio-return-layout'), preview:find('.studio-return-preview-card'), picture:find('.return-preview'), rail:find('.studio-return-rail'), sources:find('.studio-sources-section'), deck:find('.source-browser'), firstCard:find('.source-card'), firstPicture:find('.studio-guest-video-wrap'), selects:[...document.querySelectorAll('.return-output-controls select')].map(box), diagnostics:find('.return-stats-diagnostics'),statGrid:find('.return-stat-grid'),chart:find('.bitrate-chart'),graph:find('.bitrate-chart svg'),stats:find('.return-stats'),transport:find('.studio-transport-bar'),pageWidth:document.documentElement.scrollWidth, pageHeight:document.documentElement.scrollHeight, guestScroll:document.querySelector('.source-browser').scrollHeight>document.querySelector('.source-browser').clientHeight };
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
  const cases=process.env.CASTLINK_COMPACT_PRIMARY==='1'?[[1440,900,'dark',5]]:process.env.CASTLINK_COMPACT_SMALL==='1'?[[1280,720,'dark',5]]:baseline?[[1440,900,'dark',5]]:[[1920,1080,'dark',5],[1440,900,'dark',5],[1280,720,'dark',5],[1440,900,'light',5],[1366,768,'dark',20],[1280,720,'light',20],[390,844,'dark',5],[1101,600,'dark',5],[1280,600,'dark',1],[1280,720,'dark',1,true],[1440,900,'dark',0]];
  for(const [width,height,theme,count,portrait=false] of cases) {
    const context={width,height,theme,count,portrait};const compact=width>=1101&&height>=651;const page=await browser.newPage({viewport:{width,height}});page.on('pageerror',e=>{errors.push(e.message);console.error('Page error:',e.message)});
    await page.goto(origin+'/?view=studio&count='+count+(count===20?'&long=1':'')+(portrait?'&portrait=1':''));
    await page.waitForFunction(expected=>document.querySelector('.return-preview')?.videoWidth===expected,portrait?360:640);
    await page.waitForFunction(()=>[...document.querySelectorAll('.studio-guest-video-wrap video')].every(e=>e.dataset.qaFrame==='ready'));
    await page.waitForTimeout(120);
    await page.evaluate(theme=>document.documentElement.dataset.theme=theme,theme);
    await page.waitForTimeout(150);
    const g=await geometry(page);results.push({...context,...g});
    check(g.pageWidth<=width+1,'no horizontal page overflow',context);
    check(Math.abs(g.picture.width / g.picture.height - 1.6) < .015,'playback window stays 16:10 at every viewport',context);
    check(await page.locator('.return-preview').evaluate(e=>getComputedStyle(e).objectFit==='contain'),'playback contains source without stretching or cropping',context);
    if(compact) {
      check(g.layout.bottom<=height+1,'workspace fits viewport',context);
      check(count===0||g.firstPicture.y>=g.preview.bottom-1&&g.firstPicture.bottom<=height+1,'guest preview visible beside studio and stats',context);
      check(g.picture.height>=160,'studio picture remains readable',context);
      check(await page.locator('.bitrate-chart svg').evaluate(e=>{const r=e.getBoundingClientRect();return r.height>=64&&e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'measured bitrate graph visible without scrolling',context);
      check(g.rail.bottom<=height+1,'operating rail fits viewport',context);
      check(g.selects.length===4&&g.selects.every(s=>s.bottom<=height+1&&s.height>=30),'four output selectors visible',context);
      check(await page.locator('.return-preview').evaluate(e=>getComputedStyle(e).objectFit==='contain'),'studio source keeps contain',context);
      await page.evaluate(()=>window.qaMedia=[...document.querySelectorAll('video')].map(video=>({video,stream:video.srcObject,track:video.srcObject.getVideoTracks()[0]})));
      await page.locator('.source-browser').evaluate(e=>e.scrollTop=e.scrollHeight);
      const after=await geometry(page);
      check(Math.abs(after.preview.y-g.preview.y)<1&&Math.abs(after.rail.y-g.rail.y)<1,'guest scrolling keeps studio and controls fixed',context);
      check(await page.evaluate(()=>window.qaMedia.every(({video,stream,track})=>video.isConnected&&video.srcObject===stream&&track.readyState==='live')),'guest scrolling preserves live media nodes',context);
      await page.locator('.source-browser').evaluate(e=>e.scrollTop=0);
    }
    await screenshot(page,`studio-${theme}-${width}x${height}${portrait?'-portrait-source':count===0?'-empty':count===20?'-20-guests':''}`);
    if(!baseline&&width===1440&&theme==='dark'&&count>0) {
      await page.getByRole('button',{name:'Настройки',exact:true}).click();
      check(await page.locator('#studio-settings').isVisible(),'device settings open',context);
      await page.locator('.return-output-controls select').last().scrollIntoViewIfNeeded();
      check(await page.locator('.return-output-controls select').last().evaluate(e=>{const r=e.getBoundingClientRect();return e.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2))}),'output settings remain reachable with devices open',context);
      await page.locator('.studio-return-rail').evaluate(e=>e.scrollTop=0);
      check((await geometry(page)).preview.y===g.preview.y,'settings keep playback position',context);
      await screenshot(page,'studio-dark-1440x900-settings');
      await page.getByRole('button',{name:'Настройки',exact:true}).click();
      await page.evaluate(()=>{const note=document.createElement('p');note.className='studio-only-notice room-mode-notice';note.textContent='Студия включила только свой просмотр';document.querySelector('.studio-return-layout').before(note);});
      await page.waitForTimeout(150);const notice=await geometry(page);
      check(notice.layout.bottom<=height+1,'notice above workspace recomputes available height',context);
      await page.evaluate(()=>document.querySelector('.studio-only-notice').remove());
      await page.getByRole('button',{name:'Участники',exact:true}).click();
      await page.getByRole('button',{name:'Студия',exact:true}).click();
      check(await page.evaluate(()=>window.qaMedia.every(({video,stream,track})=>video.isConnected&&video.srcObject===stream&&track.readyState==='live')),'tabs retain live keyed video nodes',context);
    }
    if(portrait) {
      await page.evaluate(()=>{const video=document.querySelector('.return-preview');const empty=document.createElement('div');empty.className='studio-preview-placeholder';empty.textContent='Ожидание источника STUDIO PLAYBACK';video.replaceWith(empty);});
      check(await page.locator('.studio-preview-placeholder').evaluate(e=>{const r=e.getBoundingClientRect();return Math.abs(r.width/r.height-1.6)<.015;}),'waiting playback keeps same 16:10 frame',context);
      await screenshot(page,'studio-dark-1280x720-waiting');
    }
    await page.close();
  }
  check(errors.length===0,'no browser errors',{errors});fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({baseline,results,failures,errors},null,2));
  console.log(JSON.stringify({out,cases:results.length,failures,errors},null,2));assert.equal(failures.length,0,'compact studio browser proof');
})().catch(error=>{console.error(error);process.exitCode=1}).finally(async()=>{await browser?.close();server?.close()});
