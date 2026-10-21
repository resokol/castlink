// Pixel proof of real output -> composed-frame mixer adapter -> real WatchPage.
// SFU/control-plane, external vMix/OBS + Studio Return, locale/transfer are adapters.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), os = require('node:os'), http = require('node:http');
const {createRequire} = require('node:module'), web = path.resolve(__dirname, '..'), req = createRequire(path.join(web, 'package.json'));
const {chromium} = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright'), {PNG} = require('pngjs');
const out = process.env.CASTLINK_IMAGE_QA_OUT || fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-image-pipeline-'));
fs.mkdirSync(out, {recursive: true});
const loader = path.join(out, 'ts-loader.cjs'), cssLoader = path.join(out, 'css-loader.cjs');
fs.writeFileSync(loader, `const ts=require(${JSON.stringify(req.resolve('typescript'))});module.exports=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext,jsx:ts.JsxEmit.ReactJSX,esModuleInterop:true}}).outputText;`);
fs.writeFileSync(cssLoader, `module.exports=function(s){const names={},globals=[];s=s.replace(/:global\\(([^)]+)\\)/g,(_,v)=>'__GLOBAL_'+(globals.push(v)-1)+'__').replace(/\\.([a-zA-Z_][\\w-]*)/g,(_,v)=>'.'+(names[v]='image_qa_'+v)).replace(/__GLOBAL_(\\d+)__/g,(_,i)=>globals[i]);return 'const style=document.createElement("style");style.textContent='+JSON.stringify(s)+';document.head.append(style);export default '+JSON.stringify(names);};`);
let browser, server;
const center = image => [...image.data.slice((Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) * 4, (Math.floor(image.height / 2) * image.width + Math.floor(image.width / 2)) * 4 + 4)];
const gray = (pixel, expected, label) => { for (const channel of pixel.slice(0, 3)) assert.ok(Math.abs(channel - expected) <= 3, `${label}: expected gray ${expected}±3; got RGBA ${pixel}`); assert.equal(pixel[3], 255, label + ' is opaque video'); };
(async () => {
  const adapter = path.join(__dirname, 'fixtures/image-correction-pipeline-adapter.ts'), wp = req('next/dist/compiled/webpack/webpack'); wp.init();
  const plugins = process.env.CASTLINK_IMAGE_QA_TRANSFORM_MODULE ? [new wp.webpack.NormalModuleReplacementPlugin(/(?:^|\/)multiview-image(?:\.ts)?$/, process.env.CASTLINK_IMAGE_QA_TRANSFORM_MODULE)] : [];
  await new Promise((resolve, reject) => wp.webpack({mode: 'development', entry: path.join(__dirname, 'fixtures/image-correction-pipeline.tsx'), devtool: false,
    output: {path: out, filename: 'bundle.js'}, resolve: {extensions: ['.ts', '.tsx', '.js'], alias: {'@': web, 'next/navigation$': adapter, 'livekit-client$': adapter, '@/components/I18nProvider$': adapter, '@/components/LanguageSwitcher$': adapter, '@/lib/livekit-url$': adapter, '@/lib/client-transfer$': adapter, '@/lib/use-session-transfer$': adapter}, modules: [path.join(web, 'node_modules'), 'node_modules']},
    module: {rules: [{test: /\.tsx?$/, use: loader}, {test: /\.css$/, use: cssLoader}]}, plugins, optimization: {minimize: false}},
    (error, stats) => error ? reject(error) : stats.hasErrors() ? reject(Error(stats.toString({all: false, errors: true}))) : resolve()));
  server = http.createServer((request, response) => {
    const file = request.url.startsWith('/bundle.js') ? path.join(out, 'bundle.js') : request.url.startsWith('/globals.css') ? path.join(web, 'app/globals.css') : null;
    response.setHeader('content-type', file ? file.endsWith('.js') ? 'text/javascript' : 'text/css' : 'text/html');
    response.end(file ? fs.readFileSync(file) : '<!doctype html><html><meta charset="utf-8"><link rel="stylesheet" href="/globals.css"><div id="root"></div><script src="/bundle.js"></script></html>');
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  browser = await chromium.launch({executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required']});
  const origin = `http://127.0.0.1:${server.address().port}`, errors = [], proof = [];
  const output = await browser.newPage({viewport: {width: 640, height: 360}}), viewer = await browser.newPage({viewport: {width: 1280, height: 900}});
  for (const page of [output, viewer]) page.on('pageerror', error => errors.push(error.message));
  await output.goto(`${origin}/output/slot/slot-a?studioId=studio-a&source=camera#access=test-output`);
  await output.waitForFunction(() => window.imageCorrectionQA);
  const transparent = async (page, name) => { const png = PNG.sync.read(await page.screenshot({omitBackground: true, path: path.join(out, name + '.png')})); let opaque = 0; for (let i = 3; i < png.data.length; i += 4) if (png.data[i]) opaque++; assert.equal(opaque, 0, name + ' has no painted pixels'); proof.push({name, opaquePixels: opaque}); };
  await transparent(output, 'camera-empty');
  await output.evaluate(() => window.imageCorrectionQA.assign());
  await output.waitForFunction(() => document.querySelector('video')?.videoWidth === 640);
  await viewer.goto(`${origin}/watch?room=room-a&studioId=studio-a#invite=test-viewer`);
  await viewer.waitForFunction(() => document.querySelector('video')?.videoWidth === 640);
  const initialAttachments = await output.evaluate(() => window.imageCorrectionQA.attachments());
  for (const test of [
    {name: 'neutral', value: {}, expected: 96},
    {name: 'exposure-plus-one', value: {exposure: 1}, expected: 192},
    {name: 'contrast-half', value: {contrast: .5}, expected: 112},
    {name: 'both', value: {exposure: 1, contrast: .5}, expected: 160},
    {name: 'reset', value: {}, expected: 96},
  ]) {
    await output.evaluate(value => window.imageCorrectionQA.image(value), test.value);
    await output.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
    const buffer = await output.locator('video').screenshot({path: path.join(out, 'output-' + test.name + '.png')}), outputPixel = center(PNG.sync.read(buffer));
    gray(outputPixel, test.expected, 'slot output ' + test.name);
    const outputFilter = await output.locator('video').evaluate(element => getComputedStyle(element).filter);
    if (test.name === 'neutral' || test.name === 'reset') assert.equal(outputFilter, 'none', test.name + ' clears the previous filter');
    assert.equal(await output.evaluate(() => window.imageCorrectionQA.attachments()), initialAttachments, 'metadata correction keeps the same decoder attached');
    // Feed the actual composed screenshot, never the raw source or filter CSS,
    // into the external-mixer/Studio Return adapter received by actual /watch.
    await viewer.evaluate(dataURL => window.imageCorrectionQA.mixerFrame(dataURL), 'data:image/png;base64,' + buffer.toString('base64'));
    await viewer.waitForFunction(expected => {
      const video = document.querySelector('video'), canvas = document.createElement('canvas'); canvas.width = 1; canvas.height = 1;
      const context = canvas.getContext('2d'); context.drawImage(video, video.videoWidth / 2, video.videoHeight / 2, 1, 1, 0, 0, 1, 1);
      return Math.abs(context.getImageData(0, 0, 1, 1).data[0] - expected) <= 3;
    }, test.expected);
    const watchFilter = await viewer.locator('video').evaluate(element => getComputedStyle(element).filter);
    assert.equal(watchFilter, 'none', '/watch does not apply the caster correction twice');
    const watchPixel = center(PNG.sync.read(await viewer.locator('video').screenshot({path: path.join(out, 'watch-' + test.name + '.png')})));
    gray(watchPixel, test.expected, 'watch receives composed ' + test.name);
    proof.push({name: test.name, metadata: test.value, expected: test.expected, outputPixel, outputFilter, watchPixel, watchFilter});
  }
  assert.ok((await viewer.evaluate(() => window.imageCorrectionQA.requests)).some(request => request.url === '/api/studio-viewer' && request.action === 'join'), 'real WatchPage joins through its control-plane boundary');
  await viewer.getByRole('button', {name: 'Выключить видео', exact: true}).click();
  await viewer.waitForFunction(() => !document.querySelector('video').srcObject);
  await viewer.getByRole('button', {name: 'Включить видео', exact: true}).click();
  await viewer.waitForFunction(() => document.querySelector('video')?.videoWidth === 640 && document.querySelector('video').srcObject);
  assert.equal(await viewer.locator('video').evaluate(element => getComputedStyle(element).filter), 'none');
  const viewerSubscriptions = await viewer.evaluate(() => window.imageCorrectionQA.subscriptions);
  assert.ok(viewerSubscriptions.some(subscription => subscription.identity === 'studio-panel-main' && subscription.enabled));
  assert.equal(viewerSubscriptions.some(subscription => subscription.identity === 'raw-caster' && subscription.enabled), false, 'WatchPage never subscribes to the available raw caster');
  proof.push({name: 'watch-subscriptions', viewerSubscriptions});
  await output.evaluate(() => window.imageCorrectionQA.leave());
  await transparent(output, 'camera-departed');
  const screen = await browser.newPage({viewport: {width: 640, height: 360}}); screen.on('pageerror', error => errors.push(error.message));
  await screen.goto(`${origin}/output/slot/slot-a?studioId=studio-a&source=screen#access=test-output`);
  await screen.waitForFunction(() => window.imageCorrectionQA);
  await screen.evaluate(() => { window.imageCorrectionQA.image({exposure: 1, contrast: .5}); window.imageCorrectionQA.assign(); });
  await screen.waitForFunction(() => document.querySelector('video')?.videoWidth === 640);
  const screenPixel = center(PNG.sync.read(await screen.locator('video').screenshot({path: path.join(out, 'screen-uncorrected.png')})));
  gray(screenPixel, 96, 'screen output ignores camera correction');
  assert.equal(await screen.locator('video').evaluate(element => getComputedStyle(element).filter), 'none');
  await screen.evaluate(() => window.imageCorrectionQA.leave()); await transparent(screen, 'screen-departed');
  proof.push({name: 'screen-uncorrected', screenPixel, filter: 'none'});
  assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(out, 'proof.json'), JSON.stringify({adapters: ['SFU/control-plane', 'external vMix/OBS + Studio Return canvas.captureStream', 'locale/transfer'], proof}, null, 2));
  console.log('PASS pixels: actual slot camera metadata exposure/contrast/reset; screenshot-composed mixer -> actual WatchPage without double filter; screen unchanged; empty output transparent; proof ' + out);
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => { await browser?.close(); server?.close(); });
