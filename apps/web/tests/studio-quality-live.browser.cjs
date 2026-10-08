// Opt-in proof using a task-owned localhost LiveKit server and real Chromium WebRTC.
// CASTLINK_STUDIO_QUALITY_QA_FIXTURE points to private JSON: {url,apiKey,apiSecret}.
// Run with node; this test never starts/stops containers or connects to remote servers.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const crypto = require('node:crypto');
const fixturePath = process.env.CASTLINK_STUDIO_QUALITY_QA_FIXTURE;
if (!fixturePath) {
  console.log('SKIP studio quality live proof: set CASTLINK_STUDIO_QUALITY_QA_FIXTURE');
  process.exit(0);
}
const fixture = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
const signaling = new URL(fixture.url);
assert.ok(['ws:', 'wss:'].includes(signaling.protocol));
assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(signaling.hostname), 'QA must use a task-owned localhost SFU');
assert.ok(fixture.apiKey && fixture.apiSecret);
const { chromium } = require('playwright');
const { AccessToken } = require('livekit-server-sdk');
const ts = require('typescript');
const sdk = fs.readFileSync(require.resolve('livekit-client'), 'utf8');
const helper = ts.transpileModule(fs.readFileSync(path.resolve(__dirname, '../lib/video-quality.ts'), 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const browserHelper = `(function(){const exports={};const require=id=>{if(id==='livekit-client')return window.LivekitClient;throw Error(id)};${helper}\nwindow.quality=exports;})();`;

const browserHarness = async () => {
  const LK = window.LivekitClient;
  const Q = window.quality;
  window.qa = {
    capabilities: () => RTCRtpSender.getCapabilities('video').codecs.map(c => c.mimeType),
    async connect(url, token, publish) {
      this.room = new LK.Room({ adaptiveStream: false, dynacast: false });
      if (!publish) this.room.on(LK.RoomEvent.TrackSubscribed, (track, publication) => {
        if (track.kind !== LK.Track.Kind.Video) return;
        this.remote = track;
        publication.setVideoQuality(LK.VideoQuality.HIGH);
        const video = track.attach();
        video.muted = true;
        video.autoplay = true;
        video.style.width = '960px';
        document.body.appendChild(video);
        video.play().catch(() => {});
      });
      await this.room.connect(url, token, { autoSubscribe: !publish });
    },
    async publish(codec, simulcast, bitrate) {
      Q.assertStudioVideoCodecSupported(codec);
      const canvas = document.createElement('canvas');
      canvas.width = 1920;
      canvas.height = 1080;
      const ctx = canvas.getContext('2d');
      let frame = 0;
      this.paint = () => {
        ctx.fillStyle = `hsl(${frame % 360} 55% 30%)`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        for (let i = 0; i < 48; i++) {
          ctx.fillStyle = `hsl(${(i * 17 + frame) % 360} 80% 60%)`;
          ctx.fillRect((i * 43 + frame * 7) % 1920, (i * 71 + frame * 3) % 1080, 160, 90);
        }
        ctx.font = '60px sans-serif';
        ctx.fillStyle = 'white';
        ctx.fillText(`${codec} ${simulcast ? '3 encodings' : '1 encoding'} frame ${frame++}`, 40, 100);
        this.animation = requestAnimationFrame(this.paint);
      };
      this.paint();
      this.stream = canvas.captureStream(60);
      this.track = new LK.LocalVideoTrack(this.stream.getVideoTracks()[0], undefined, true);
      this.publication = await this.room.localParticipant.publishTrack(this.track, Q.studioVideoPublishOptions(bitrate, 60, codec, simulcast));
      Q.assertPublishedStudioVideoCodec(this.track, codec);
      this.originalSender = this.track.sender;
      await Q.applyStudioSenderQuality(this.track.sender, bitrate, 60);
      return { sid: this.publication.trackSid, sdkCodec: this.track.codec };
    },
    async quality(bitrate) {
      await Q.applyStudioSenderQuality(this.track.sender, bitrate, 60);
      return this.track.sender === this.originalSender;
    },
    async sending() {
      if (!this.track?.sender) return null;
      const stats = await this.track.sender.getStats();
      const outbound = [...stats.values()].filter(s => s.type === 'outbound-rtp' && (s.kind || s.mediaType) === 'video' && s.framesEncoded > 0);
      return {
        sid: this.publication.trackSid,
        sdkCodec: this.track.codec,
        encodings: this.track.sender.getParameters().encodings.map(e => ({ rid: e.rid, active: e.active, maxBitrate: e.maxBitrate, maxFramerate: e.maxFramerate })),
        outbound: outbound.map(s => ({
          codec: stats.get(s.codecId)?.mimeType, framesEncoded: s.framesEncoded, framesPerSecond: s.framesPerSecond,
          width: s.frameWidth, height: s.frameHeight, bytesSent: s.bytesSent,
          qualityLimitationReason: s.qualityLimitationReason, encoderImplementation: s.encoderImplementation,
          powerEfficientEncoder: s.powerEfficientEncoder,
        })),
      };
    },
    async receiving() {
      if (!this.remote?.receiver) return [];
      const stats = await this.remote.receiver.getStats();
      return [...stats.values()].filter(s => s.type === 'inbound-rtp' && (s.kind || s.mediaType) === 'video' && s.framesDecoded > 0)
        .map(s => ({ codec: stats.get(s.codecId)?.mimeType, framesDecoded: s.framesDecoded, width: s.frameWidth, height: s.frameHeight }));
    },
    async stop() {
      cancelAnimationFrame(this.animation);
      await this.room?.disconnect();
      this.stream?.getTracks().forEach(t => t.stop());
    },
  };
};

function assertCeiling(state, encodings, bitrate) {
  assert.equal(state.encodings.length, encodings, 'actual RTCRtpSender encoding count');
  assert.equal(state.encodings.reduce((sum, e) => sum + e.maxBitrate, 0), bitrate * 1000, 'aggregate sender ceiling');
  assert.ok(state.encodings.every(e => e.maxFramerate === 60));
}
async function waitFor(read, matches, label) {
  const deadline = Date.now() + 20000;
  let last;
  do {
    last = await read();
    if (matches(last)) return last;
    await new Promise(resolve => setTimeout(resolve, 200));
  } while (Date.now() < deadline);
  throw Error(`${label} timed out: ${JSON.stringify(last)}`);
}
async function token(room, identity, publish) {
  const access = new AccessToken(fixture.apiKey, fixture.apiSecret, { identity, ttl: '5m' });
  access.addGrant({ roomJoin: true, room, canPublish: publish, canSubscribe: !publish, canPublishData: false });
  return access.toJwt();
}

(async () => {
  let browser;
  const errors = [];
  const results = [];
  const server = http.createServer((request, response) => {
    response.setHeader('Cache-Control', 'no-store');
    if (request.url === '/sdk.js' || request.url === '/quality.js') {
      response.setHeader('Content-Type', 'application/javascript');
      response.end(request.url === '/sdk.js' ? sdk : browserHelper);
    } else {
      response.setHeader('Content-Type', 'text/html');
      response.end('<!doctype html><title>Local quality proof</title><script src="/sdk.js"></script><script src="/quality.js"></script>');
    }
  });
  try {
    await new Promise((resolve, reject) => { server.once('error', reject); server.listen(0, '127.0.0.1', resolve); });
    const origin = `http://127.0.0.1:${server.address().port}`;
    browser = await chromium.launch({ executablePath: process.env.CASTLINK_QA_CHROMIUM || '/usr/bin/chromium', headless: true, args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    const probe = await browser.newPage();
    await probe.goto(origin);
    await probe.evaluate(browserHarness);
    const capabilities = await probe.evaluate(() => window.qa.capabilities());
    await probe.close();
    console.log('Browser video codec capabilities:', [...new Set(capabilities)].join(', '));
    const codecs = ['vp8'];
    if (capabilities.some(c => c.toLowerCase() === 'video/h264')) codecs.push('h264');
    else console.log('H264 SKIP: this Chromium build does not advertise an H264 encoder');
    for (const codec of codecs) for (const simulcast of [false, true]) {
      const context = await browser.newContext();
      const publisher = await context.newPage();
      const subscriber = await context.newPage();
      for (const page of [publisher, subscriber]) {
        page.on('pageerror', e => errors.push(e.message));
        await page.goto(origin);
        await page.evaluate(browserHarness);
      }
      try {
        const room = `quality-${crypto.randomUUID()}`;
        await subscriber.evaluate(async ({ url, jwt }) => window.qa.connect(url, jwt, false), { url: fixture.url, jwt: await token(room, 'subscriber', false) });
        await publisher.evaluate(async ({ url, jwt }) => window.qa.connect(url, jwt, true), { url: fixture.url, jwt: await token(room, 'publisher', true) });
        const published = await publisher.evaluate(async ({ codec, simulcast }) => window.qa.publish(codec, simulcast, 20000), { codec, simulcast });
        const expected = `video/${codec === 'vp8' ? 'VP8' : 'H264'}`;
        let state = await waitFor(() => publisher.evaluate(() => window.qa.sending()), s => s?.outbound.length === (simulcast ? 3 : 1), 'all publisher encodings producing real outbound RTP');
        const received = await waitFor(() => subscriber.evaluate(() => window.qa.receiving()), s => s.length > 0, 'subscriber decoded video');
        assert.ok(state.outbound.every(s => s.codec?.toLowerCase() === expected.toLowerCase()), 'actual negotiated outbound codec');
        assert.ok(received.every(s => s.codec?.toLowerCase() === expected.toLowerCase()), 'actual decoded subscriber codec');
        assertCeiling(state, simulcast ? 3 : 1, 20000);
        for (const bitrate of [25000, 20000]) {
          assert.equal(await publisher.evaluate(b => window.qa.quality(b), bitrate), true, 'live bitrate update retains the sender');
          state = await publisher.evaluate(() => window.qa.sending());
          assertCeiling(state, simulcast ? 3 : 1, bitrate);
          assert.equal(state.sid, published.sid, 'live bitrate update does not republish');
        }
        results.push({ codec, simulcast, encodingCount: state.encodings.length, testedCeilingsMbps: [20, 25], outbound: state.outbound, received });
        console.log(`Verified ${codec.toUpperCase()} ${simulcast ? 'main simulcast' : 'single stream / watch'}: negotiated and decoded ${expected}, ${state.encodings.length} encoding(s), live 20→25→20 Mbps ceilings`);
      } finally {
        await Promise.allSettled([publisher.evaluate(() => window.qa.stop()), subscriber.evaluate(() => window.qa.stop())]);
        await context.close();
      }
    }
    assert.deepEqual(errors, []);
    console.log('PASS: real LiveKit codec negotiation, single/simulcast RTP layers and live bitrate ceilings');
    console.log('Actual WebRTC evidence:', JSON.stringify(results));
    console.log('Limits: ceilings are not throughput promises. Synthetic cloud video does not prove a physical camera, hardware encoder, or sustained 1080p60 on the user’s PC.');
  } finally {
    await browser?.close();
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
