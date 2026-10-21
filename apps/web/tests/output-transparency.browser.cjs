// Actual page, controller, bindings and CSS; only navigation/i18n/SFU are adapted.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const {createRequire} = require('node:module'), web = path.resolve(__dirname, '..'), req = createRequire(path.join(web, 'package.json'));
const {chromium} = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');
const {PNG} = require('pngjs');
const out = process.env.CASTLINK_OUTPUT_QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-output-alpha-'));
fs.mkdirSync(out, {recursive: true});
const loader = path.join(out, 'ts-loader.cjs'), cssLoader = path.join(out, 'css-loader.cjs');
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(req.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);
fs.writeFileSync(cssLoader, `module.exports=function(s){const names={},globals=[];s=s.replace(/:global\\(([^)]+)\\)/g,(_,v)=>'__GLOBAL_'+(globals.push(v)-1)+'__').replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,v)=>'.'+(names[v]='output_qa_'+v)).replace(/__GLOBAL_(\\d+)__/g,(_,i)=>globals[i]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names);};`);
let browser, server;
(async () => {
  const adapter = path.join(__dirname, 'fixtures/output-transparency-adapter.ts');
  const wp = req('next/dist/compiled/webpack/webpack'); wp.init();
  await new Promise((resolve, reject) => wp.webpack({mode: 'development', entry: path.join(__dirname, 'fixtures/output-transparency.tsx'), devtool: false,
    output: {path: out, filename: 'bundle.js'}, resolve: {extensions: ['.ts', '.tsx', '.js'], alias: {'@': web, 'next/navigation$': adapter, 'livekit-client$': adapter, '@/components/I18nProvider$': adapter, '@/lib/livekit-url$': adapter}, modules: [path.join(web, 'node_modules'), 'node_modules']},
    module: {rules: [{test: /\.tsx?$/, use: loader}, {test: /\.css$/, use: cssLoader}]}, optimization: {minimize: false}},
    (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({all: false, errors: true}))) : resolve()));
  server = http.createServer((request, response) => {
    const file = request.url.startsWith('/bundle.js') ? path.join(out, 'bundle.js') : request.url.startsWith('/globals.css') ? path.join(web, 'app/globals.css') : null;
    response.setHeader('content-type', file ? file.endsWith('.js') ? 'text/javascript' : 'text/css' : 'text/html');
    response.end(file ? fs.readFileSync(file) : '<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/globals.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']});
  const errors = [], proof = [];
  for (const source of ['camera', 'screen']) for (const theme of ['dark', 'light']) {
    const page = await browser.newPage({viewport: {width: 1280, height: 720}});
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(`http://127.0.0.1:${server.address().port}/output/slot/slot-a?studioId=studio-a&source=${source}#access=test-only`);
    await page.waitForFunction(() => window.outputQA);
    await page.evaluate(theme => document.documentElement.dataset.theme = theme, theme);
    const alpha = async phase => {
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const image = PNG.sync.read(await page.screenshot({omitBackground: true, path: path.join(out, `${source}-${theme}-${phase}.png`)}));
      let opaque = 0; for (let i = 3; i < image.data.length; i += 4) if (image.data[i] !== 0) opaque++;
      if(opaque) console.error({phase,pixel:[...image.data.slice(0,4)],styles:await page.evaluate(()=>[document.documentElement,document.body,document.querySelector('main')].map(e=>({class:e.className,background:getComputedStyle(e).background,colorScheme:getComputedStyle(e).colorScheme,transition:getComputedStyle(e).transition}))) });
      assert.equal(opaque, 0, `${source}/${theme}/${phase} must contain only transparent pixels`);
      proof.push({source, theme, phase, opaquePixels: opaque});
    };
    await alpha('waiting');
    await page.evaluate(() => window.outputQA.assign());
    await page.waitForFunction(() => document.querySelector('video')?.videoWidth === 640);
    assert.equal(await page.locator('video').count(), 1);
    const active = PNG.sync.read(await page.screenshot({omitBackground: true, path: path.join(out, `${source}-${theme}-assigned.png`)}));
    assert.equal(active.data[(360 * active.width + 640) * 4 + 3], 255, 'assigned source is visible');
    await page.evaluate(() => { window.outputQA.leave(); if (document.querySelector('video')) throw Error('departed track remains before next poll'); });
    await alpha('departed');
    await page.evaluate(() => window.outputQA.reconnect());
    await page.waitForFunction(() => document.querySelector('video')?.videoWidth === 640);
    await page.evaluate(() => window.outputQA.idle());
    await page.waitForFunction(() => !document.querySelector('video'));
    await alpha('released');
    await page.evaluate(() => window.outputQA.invalidate());
    await page.waitForFunction(() => document.querySelector('[role=status]')?.textContent === 'Ссылка выхода недействительна');
    assert.equal(await page.locator('[role=status]').evaluate(element => getComputedStyle(element).clipPath), 'none', 'authorization errors remain visible');
    await page.evaluate(() => window.outputQA.unmount());
    assert.equal(await page.evaluate(() => document.documentElement.classList.contains('studiolink-output-document')), false);
    await page.close();
  }
  assert.deepEqual(errors, []); fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify(proof, null, 2));
  console.log('PASS actual slot output: RGBA waiting/departed/released, immediate track cleanup, assigned media, reconnect, document cleanup; camera/screen, dark/light; proof ' + out);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server?.close(); });
