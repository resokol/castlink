'use strict';

const assert = require('node:assert/strict');
const test = require('node:test');
const { spawn } = require('node:child_process');
const { createSocket } = require('node:dgram');
const { once } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { startVmixSlot } = require('../src/vmix-output-runtime.cjs');
const { createSlotSource } = require('../src/vmix-slot-source.cjs');
const { normalizeSrt } = require('../src/vmix-output-config.cjs');

const livekitUrl = process.env.CASTLINK_TEST_LIVEKIT_URL;
const ffmpeg = process.env.CASTLINK_TEST_FFMPEG;
const hd = process.env.CASTLINK_TEST_1080P === '1';

async function eventually(predicate, describe, timeout = 9000) {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (predicate()) return;
    await delay(50);
  }
  assert.fail(`Timed out waiting for ${describe()}`);
}

test('three permanent SRT inputs carry different LiveKit sources as the lineup changes',
  { skip: !livekitUrl || !ffmpeg, timeout: 45000 }, async () => {
    const sdk = require('@livekit/rtc-node');
    const { AccessToken } = require('../../web/node_modules/livekit-server-sdk');
    const roomName = `desktop-vmix-${Date.now()}`;
    const width = 160, height = 90, fps = 30;
    const cleanups = [];
    async function token(identity, canPublish) {
      const value = new AccessToken('devkey', 'secret', { identity, name: identity,
        metadata: JSON.stringify({ role: 'guest', admissionId: identity, admissionGeneration: 1 }) });
      value.addGrant({ roomJoin: true, room: roomName, canPublish, canSubscribe: !canPublish });
      return value.toJwt();
    }
    async function publisher(identity, color, frequency) {
      const room = new sdk.Room();
      cleanups.push(() => room.disconnect());
      await room.connect(livekitUrl, await token(identity, true), { autoSubscribe: false });
      const video = new sdk.VideoSource(width, height);
      const audio = new sdk.AudioSource(48_000, 2);
      const videoTrack = sdk.LocalVideoTrack.createVideoTrack('camera', video);
      const audioTrack = sdk.LocalAudioTrack.createAudioTrack('microphone', audio);
      await room.localParticipant.publishTrack(videoTrack, new sdk.TrackPublishOptions({ source: sdk.TrackSource.SOURCE_CAMERA }));
      await room.localParticipant.publishTrack(audioTrack, new sdk.TrackPublishOptions({ source: sdk.TrackSource.SOURCE_MICROPHONE }));
      const pixels = new Uint8Array(width * height * 3 / 2).fill(128);
      pixels.fill(color, 0, width * height);
      const videoFrame = new sdk.VideoFrame(pixels, width, height, sdk.VideoBufferType.I420);
      const samples = Int16Array.from({ length: 960 }, (_, i) => Math.round(8000 * Math.sin(2 * Math.PI * frequency * Math.floor(i / 2) / 48_000)));
      const audioFrame = new sdk.AudioFrame(samples, 48_000, 2, 480);
      const timer = setInterval(() => video.captureFrame(videoFrame), 1000 / fps);
      const audioTimer = setInterval(() => void audio.captureFrame(audioFrame).catch(() => {}), 10);
      cleanups.push(async () => { clearInterval(timer); clearInterval(audioTimer); await video.close(); await audio.close(); });
      return { color, frequency, target: { identity, participantSid: room.localParticipant.sid, sessionId: identity, generation: 1 } };
    }
    async function receiver(id, initial) {
      const probe = createSocket('udp4');
      probe.bind(0, '127.0.0.1');
      await once(probe, 'listening');
      const { port } = probe.address();
      probe.close();
      await once(probe, 'close');
      const config = normalizeSrt({ mode: 'listener', address: '127.0.0.1', latencyMs: 120, slots: [{ id, port }] });
      const access = await token(`out-${id}`, false);
      let revision = 1, target = initial?.target;
      const messages = [];
      const slot = await startVmixSlot({ id, mode: 'srt', config, executable: ffmpeg, sdk,
        width: hd ? 1920 : width, height: hd ? 1080 : height, fps, bitrateKbps: hd ? 8000 : 900,
        link: { livekitUrl, source: 'camera' }, pollMs: 150, onState: state => messages.push(state), onAssignment: name => messages.push(name),
        createSource: args => createSlotSource({ ...args, requestSnapshot: async () => ({ room: roomName, token: access,
          snapshot: { revision, source: 'camera', phase: target ? 'assigned' : 'free', target } }) }),
      });
      cleanups.push(() => slot.stop());
      const process = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-probesize', '64000', '-analyzeduration', '800000', '-filter_threads', '1',
        '-i', `srt://127.0.0.1:${port}?mode=caller&latency=120000&connect_timeout=8000`,
        '-map', '0:v:0', '-vf', `scale=${width}:${height}`, '-c:v', 'rawvideo', '-threads', '1', '-f', 'rawvideo', '-pix_fmt', 'gray', 'pipe:1',
        '-map', '0:a:0', '-ac', '1', '-ar', '48000', '-f', 's16le', 'pipe:3'], { stdio: ['ignore', 'pipe', 'pipe', 'pipe'] });
      cleanups.push(() => { process.kill('SIGKILL'); });
      let errors = '', latest, signal, remaining = Buffer.alloc(0), pcm = Buffer.alloc(0);
      process.stderr.on('data', chunk => { errors += chunk; });
      process.stdout.on('data', chunk => {
        const pixels = width * height;
        remaining = Buffer.concat([remaining, chunk]);
        while (remaining.length >= pixels) {
          latest = remaining[pixels / 2];
          remaining = remaining.subarray(pixels);
        }
      });
      process.stdio[3].on('data', chunk => {
        pcm = Buffer.concat([pcm, chunk]);
        while (pcm.length >= 9600) {
          let minimum = 0, maximum = 0;
          for (let offset = 0; offset < 9600; offset += 2) {
            const sample = pcm.readInt16LE(offset);
            minimum = Math.min(minimum, sample);
            maximum = Math.max(maximum, sample);
          }
          const frequencies = [200, 400, 600, 800];
          const powers = frequencies.map(frequency => {
            let real = 0, imaginary = 0;
            for (let index = 0; index < 4800; index++) {
              const sample = pcm.readInt16LE(index * 2);
              const angle = 2 * Math.PI * frequency * index / 48_000;
              real += sample * Math.cos(angle);
              imaginary += sample * Math.sin(angle);
            }
            return real ** 2 + imaginary ** 2;
          });
          signal = { range: maximum - minimum, frequency: frequencies[powers.indexOf(Math.max(...powers))] };
          pcm = pcm.subarray(9600);
        }
      });
      return {
        set(next) { target = next?.target; revision++; },
        async expect(next) {
          const gray = next ? (next.color - 16) * 255 / 219 : 0;
          const audioMatches = () => next ? signal?.frequency === next.frequency && signal.range > 1000 : signal?.range < 100;
          await eventually(() => Math.abs(latest - gray) <= 4 && audioMatches(),
            () => `${id} color ${gray}, received ${latest}, audio ${JSON.stringify(signal)}, events ${messages.slice(-10)}, ${errors}`);
          assert.equal(process.exitCode, null);
        },
      };
    }
    try {
      const a = await publisher('anna', 45, 200);
      const b = await publisher('boris', 100, 400);
      const c = await publisher('clara', 150, 600);
      const d = await publisher('dina', 200, 800);
      const inputs = await Promise.all([receiver('first', a), receiver('second', b), receiver('third')]);
      await Promise.all(inputs.map((input, index) => input.expect([a, b, undefined][index])));
      inputs[2].set(c);
      await Promise.all(inputs.map((input, index) => input.expect([a, b, c][index])));
      inputs[1].set(d);
      inputs[2].set(undefined);
      await Promise.all(inputs.map((input, index) => input.expect([a, d, undefined][index])));
    } finally {
      for (const cleanup of cleanups.reverse()) await cleanup();
      await sdk.dispose();
    }
  });
