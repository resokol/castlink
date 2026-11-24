// Run against a locally built CastLink server with CASTLINK_QA_BASE_URL set.
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { chromium } = require(process.env.CASTLINK_QA_PLAYWRIGHT || 'playwright');

const base = new URL(process.env.CASTLINK_QA_BASE_URL || 'http://127.0.0.1:3017');
const { slideDeck } = require('./fixtures/slide-deck.cjs');
const shareTab = process.argv.includes('--share-tab');
const slidesTitle = 'CastLink QA slide show';
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(base.hostname), 'Use a loopback CastLink test server');
const parent = process.env.CASTLINK_QA_OUTPUT || os.tmpdir();
fs.mkdirSync(parent, { recursive: true });
const out = fs.mkdtempSync(path.join(parent, 'self-recording-'));
const audioFile = path.join(out, 'tone.wav');
const videoFile = path.join(out, 'green-camera.y4m');
const pdfFile = path.join(out, 'slides.pdf');

function ffmpeg(args) {
  return execFileSync('ffmpeg', ['-nostdin', '-v', 'error', '-threads', '1', '-filter_threads', '1', ...args], { maxBuffer: 32 * 1024 * 1024 });
}

function makeFixtures() {
  ffmpeg(['-f', 'lavfi', '-i', 'color=c=0x00d95f:s=640x360:r=15', '-frames:v', '4', '-pix_fmt', 'yuv420p', '-f', 'yuv4mpegpipe', videoFile]);
  ffmpeg(['-f', 'lavfi', '-i', 'sine=frequency=440:sample_rate=48000:duration=2', '-c:a', 'pcm_s16le', audioFile]);

  fs.writeFileSync(pdfFile, slideDeck(['0.94 0.07 0.07', '0.05 0.12 0.94', '1 1 0']));
}

function validateRecording(file) {
  const probe = JSON.parse(execFileSync('ffprobe', ['-v', 'error', '-show_streams', '-of', 'json', file], { encoding: 'utf8' }));
  const video = probe.streams.filter(s => s.codec_type === 'video');
  const audio = probe.streams.filter(s => s.codec_type === 'audio');
  assert.equal(video.length, 1, 'one composited video track');
  assert.equal(audio.length, 1, 'one microphone track');
  assert.deepEqual([video[0].width, video[0].height], [1920, 1080]);
  const pcm = ffmpeg(['-i', file, '-map', '0:a:0', '-ac', '1', '-ar', '8000', '-f', 's16le', 'pipe:1']);
  let sum = 0;
  for (let i = 0; i < pcm.length; i += 2) sum += pcm.readInt16LE(i) ** 2;
  const audioRms = Math.sqrt(sum / (pcm.length / 2));
  assert.ok(pcm.length > 32000 && audioRms > 40, 'recording contains audible microphone samples');

  const width = 128, height = 72, frameBytes = width * height * 3;
  const raw = ffmpeg(['-i', file, '-map', '0:v:0', '-vf', 'fps=4,scale=128:72:flags=area', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']);
  const frames = raw.length / frameBytes;
  assert.ok(Number.isInteger(frames) && frames >= 8, 'recording decodes into multiple frames');
  const redSlides = [], blueSlides = [], greenCameras = [];
  for (let frame = 0; frame < frames; frame++) {
    // The yellow third slide is visible privately during slide two. Even a
    // small exported overlay would introduce a block of yellow pixels.
    for (let i = frame * frameBytes; i < (frame + 1) * frameBytes; i += 3) {
      assert.ok(!(raw[i] > 200 && raw[i + 1] > 200 && raw[i + 2] < 50), 'private slide three stays out of the download');
    }
    let red = 0, blue = 0, green = 0, slidePixels = 0, cameraPixels = 0;
    for (let y = 23; y < 49; y++) {
      for (let x = 16; x < 122; x++) {
        const i = frame * frameBytes + (y * width + x) * 3;
        const [r, g, b] = raw.subarray(i, i + 3);
        if (x < 82) {
          slidePixels++;
          if (r > 120 && r > g * 1.5 && r > b * 1.5) red++;
          if (b > 120 && b > r * 1.5 && b > g * 1.5) blue++;
        } else if (x >= 104 && y >= 33 && y < 39) {
          cameraPixels++;
          if (g > 80 && g > r * 1.5 && g > b * 1.25) green++;
        }
      }
    }
    if (red > slidePixels * 0.65) redSlides.push(frame);
    if (blue > slidePixels * 0.65) blueSlides.push(frame);
    if (green > cameraPixels * 0.60) greenCameras.push(frame);
  }
  assert.ok(redSlides.length >= 2 && blueSlides.length >= 2 && redSlides.at(-1) < blueSlides[0],
    'decoded video shows the red slide followed by the blue slide');
  assert.ok(redSlides.some(n => greenCameras.includes(n)) && blueSlides.some(n => greenCameras.includes(n)),
    'the green camera appears beside both slides in the exported file');
  return { width: video[0].width, height: video[0].height, videoCodec: video[0].codec_name,
    audioCodec: audio[0].codec_name, audioRms: Math.round(audioRms), framesAt4Fps: frames,
    redFrames: redSlides.length, blueFrames: blueSlides.length, greenCameraFrames: greenCameras.length };
}

async function run() {
  makeFixtures();
  const browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM_BINARY || '/usr/bin/chromium',
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-networking',
      '--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream',
      '--auto-select-tab-capture-source-by-title=' + slidesTitle,
      '--use-file-for-fake-video-capture=' + videoFile, '--use-file-for-fake-audio-capture=' + audioFile] });
  const context = await browser.newContext({ locale: 'ru-RU', permissions: ['camera', 'microphone'], acceptDownloads: true,
    viewport: { width: 1440, height: 960 }, serviceWorkers: 'block' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  const forbidden = [], errors = [];
  let recordingPage = false;
  const button = name => page.getByRole('button', { name, exact: true });
  const download = async prefix => {
    const event = page.waitForEvent('download');
    await button('Скачать видео').click();
    const item = await event;
    const file = path.join(out, prefix + path.extname(item.suggestedFilename()));
    await item.saveAs(file);
    assert.equal(await item.failure(), null);
    return file;
  };
  try {
    page.on('pageerror', error => errors.push(error.message));
    page.on('websocket', ws => {
      const u = new URL(ws.url());
      if (recordingPage && !u.pathname.startsWith('/_next/')) forbidden.push('WebSocket ' + u.pathname);
    });
    await context.route(/^https?:/, route => {
      const req = route.request(), url = new URL(req.url());
      const versionCheck = req.method() === 'GET' && url.pathname === '/api/version';
      if (url.origin !== base.origin || (recordingPage && !versionCheck &&
          (url.pathname.startsWith('/api/') || !['GET', 'HEAD'].includes(req.method())))) {
        forbidden.push(req.method() + ' ' + url.origin + url.pathname);
        return route.abort();
      }
      return route.continue();
    });
    await page.goto(base.origin, { waitUntil: 'domcontentloaded' });
    const entry = page.getByRole('link', { name: 'Записать выступление', exact: true });
    assert.equal(new URL(await entry.getAttribute('href'), base).pathname, '/record');
    recordingPage = true;
    await entry.click();
    await page.waitForURL(url => url.pathname === '/record');
    await button('Включить камеру и микрофон').click();
    let slides;
    if (shareTab) {
      slides = await context.newPage();
      await slides.setContent('<title>' + slidesTitle + '</title><body style="background:#ef1414"></body>');
      await page.bringToFront();
      await button('Показать окно или вкладку').click();
      await button('Убрать презентацию').waitFor();
    } else {
      const chooser = page.waitForEvent('filechooser');
      await button('Открыть PDF').click();
      await (await chooser).setFiles(pdfFile);
      await page.getByText(/Слайд 1 из 3/).waitFor();
      const preview = page.locator('canvas[aria-label="Предпросмотр слайда 2"]');
      await preview.waitFor({ state: 'visible' });
      assert.equal(await page.locator('.pdf-presentation-frame canvas').evaluate(canvas => canvas.width), 1485, 'PDF is rasterized at its width in the recorded frame');
      const rgb = await preview.evaluate(canvas => [...canvas.getContext('2d').getImageData(50, 50, 1, 1).data]);
      assert.ok(rgb[2] > 220 && rgb[0] < 35, 'speaker can see the upcoming blue slide');
    }
    await button('Начать запись').click();
    await button('Остановить запись').waitFor();
    // Each slide needs real elapsed media time to survive encoding and independent decoding.
    await page.waitForTimeout(2600);
    if (slides) {
      await slides.bringToFront();
      await slides.evaluate(() => { document.body.style.background = '#1020ef'; });
    } else {
      await button('Следующий слайд').click();
      await page.getByText(/Слайд 2 из 3/).waitFor();
      const preview = page.locator('canvas[aria-label="Предпросмотр слайда 3"]');
      await preview.waitFor({ state: 'visible' });
      assert.deepEqual(await preview.evaluate(canvas => [...canvas.getContext('2d').getImageData(50, 50, 1, 1).data]), [255, 255, 0, 255]);
    }
    await page.waitForTimeout(2600);
    await page.bringToFront();
    await button('Остановить запись').click();
    const original = await download('original');
    const measured = validateRecording(original);
    await page.reload({ waitUntil: 'domcontentloaded' });
    const restored = await download('after-reload');
    const sha = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex');
    assert.equal(sha(restored), sha(original), 'reload restores exactly the previously downloaded take');
    await button('Посмотреть').click();
    await page.waitForFunction(() => {
      const video = document.querySelector('video[controls]');
      return video?.videoWidth === 1920 && video.videoHeight === 1080;
    });
    page.once('dialog', dialog => dialog.accept());
    await button('Удалить').click();
    await button('Скачать видео').waitFor({ state: 'detached' });

    if (!shareTab) {
      await button('Включить камеру и микрофон').click();
      await button('Начать запись').click();
      await button('Остановить запись').waitFor();
      await page.waitForTimeout(3600);
      const other = await context.newPage();
      await other.goto(new URL('/record', base).href);
      await other.getByRole('button', { name: 'Открыть PDF' }).waitFor();
      const locks = await other.evaluate(() => navigator.locks.query());
      assert.ok(locks.held.some(lock => lock.name.startsWith('castlink-self-recordings:')));
      assert.equal(await other.getByRole('button', { name: 'Скачать видео' }).count(), 0, 'active take stays private to its recorder');
      await page.close({ runBeforeUnload: false });
      await other.reload();
      await other.getByText(/Запись прервалась. Доступна сохранённая часть/).waitFor();
      const downloaded = other.waitForEvent('download');
      await other.getByRole('button', { name: 'Скачать видео' }).click();
      const prefix = await downloaded;
      const recovered = path.join(out, 'interrupted' + path.extname(prefix.suggestedFilename()));
      await prefix.saveAs(recovered);
      const dimensions = execFileSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', recovered], { encoding: 'utf8' }).trim();
      assert.equal(dimensions, '1920,1080', 'camera-only take is Full HD even with a lower-resolution camera');
      const rgb = ffmpeg(['-i', recovered, '-vf', 'scale=1:1:flags=area', '-frames:v', '1', '-pix_fmt', 'rgb24', '-f', 'rawvideo', 'pipe:1']);
      assert.ok(rgb[1] > 140 && rgb[1] > 1.5 * rgb[0], 'recovered camera-only take shows the camera full frame');
    }
    assert.deepEqual(forbidden, [], 'local recording makes no uploads, external requests, or room connections');
    assert.deepEqual(errors, [], 'no uncaught browser errors');
    const result = { measured, restoredSha256: sha(restored), forbiddenRequests: forbidden, directory: out };
    fs.writeFileSync(path.join(out, 'result.json'), JSON.stringify(result, null, 2));
    console.log(JSON.stringify(result));
  } catch (error) {
    console.error('Recording evidence:', out, 'requests:', forbidden, 'browser errors:', errors);
    await page.screenshot({ path: path.join(out, 'failure.png') }).catch(() => undefined);
    throw error;
  } finally {
    await browser.close();
  }
}
run().catch(err => { console.error(err); process.exitCode = 1; });
