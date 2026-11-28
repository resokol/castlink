'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { spawn, spawnSync } = require('node:child_process');
const { once } = require('node:events');
const { createSocket } = require('node:dgram');
const { mkdtempSync, rmSync, writeFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const { normalizeSrt } = require('../src/vmix-output-config.cjs');
const { checkSrtEncoder, checkSrtRelay, startSrtOutput } = require('../src/vmix-srt-output.cjs');

const ffmpeg = process.env.CASTLINK_TEST_FFMPEG;
const relayExecutable = process.env.CASTLINK_TEST_SRT_RELAY;

async function ephemeralPort() {
  const probe = createSocket('udp4');
  probe.bind(0, '127.0.0.1');
  await once(probe, 'listening');
  const { port } = probe.address();
  probe.close();
  await once(probe, 'close');
  return port;
}

function verifyRecording(recording) {
  const info = spawnSync(process.env.CASTLINK_TEST_FFPROBE || 'ffprobe', ['-v', 'error', '-show_entries', 'stream=codec_name', '-of', 'json', recording], { encoding: 'utf8' });
  assert.equal(info.status, 0, info.stderr);
  assert.deepEqual(JSON.parse(info.stdout).streams.map(stream => stream.codec_name), ['h264', 'aac']);
}

for (const mode of ['listener', 'caller']) test('one SRT ' + mode + ' delivers encrypted H.264 and AAC',
  { skip: !ffmpeg, timeout: 15000 }, async () => {
  await checkSrtEncoder(ffmpeg);
  const port = await ephemeralPort();
  const directory = mkdtempSync(path.join(tmpdir(), 'castlink-srt-test-'));
  const recording = path.join(directory, 'received.ts');
  const config = normalizeSrt({ mode, address: '127.0.0.1', latencyMs: 120,
    passphrase: 'fixture&only@secret', keyLength: 16, slots: [{ id: 'slot-1', port }] });
  let output, timer, caller;
  try {
    output = await startSrtOutput({ executable: ffmpeg, config, id: 'slot-1', width: 160, height: 90, fps: 25, bitrateKbps: 900 });
    const frame = Buffer.alloc(160 * 90 * 3 / 2, 128);
    const pcm = Buffer.alloc(48_000 / 25 * 2 * 2);
    timer = setInterval(() => { output.writeVideo(frame); output.writeAudio(pcm); }, 40);
    const receiverMode = mode === 'listener' ? 'caller&connect_timeout=8000' : 'listener&listen_timeout=8000000';
    caller = spawn(ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-passphrase', config.passphrase,
      '-i', 'srt://127.0.0.1:' + port + '?mode=' + receiverMode + '&latency=120000',
      '-map', '0:v:0', '-map', '0:a:0', '-t', '1', '-c', 'copy', recording], { stdio: ['ignore', 'ignore', 'pipe'] });
    let errors = '';
    caller.stderr.on('data', data => { errors += data; });
    const [code] = await once(caller, 'exit');
    assert.equal(code, 0, errors);
    verifyRecording(recording);
  } finally {
    clearInterval(timer);
    caller?.kill();
    await output?.stop();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('two distinct addresses exchange encrypted SRT Rendezvous over the same UDP port',
  { skip: !ffmpeg || !relayExecutable || process.platform !== 'linux', timeout: 16000 }, async () => {
    await checkSrtRelay(relayExecutable);
    const port = await ephemeralPort();
    const id = 'rendezvous';
    const directory = mkdtempSync(path.join(tmpdir(), 'castlink-srt-rendezvous-'));
    const recording = path.join(directory, 'received.ts');
    const { rendezvousEndpoint } = require('../src/vmix-output-config.cjs');
    const parameters = { mode: 'rendezvous', latencyMs: 120, passphrase: 'separate&local adapters', keyLength: 16, slots: [{ id, port }] };
    const config = normalizeSrt({ ...parameters, address: '127.0.0.2', localAddress: '127.0.0.1' });
    const peer = normalizeSrt({ ...parameters, address: '127.0.0.1', localAddress: '127.0.0.2' });
    let output, timer, receiver;
    try {
      output = await startSrtOutput({ executable: ffmpeg, relayExecutable, config, id, width: 160, height: 90, fps: 25, bitrateKbps: 900 });
      const video = Buffer.alloc(160 * 90 * 3 / 2, 90), audio = Buffer.alloc(7680);
      timer = setInterval(() => { output.writeVideo(video); output.writeAudio(audio); }, 40);
      receiver = spawn(relayExecutable, ['-t:10', '-q', '-chunk:1316', rendezvousEndpoint(peer, id), 'file://con'],
        { stdio: ['ignore', 'pipe', 'pipe'] });
      let errors = '';
      receiver.stderr.on('data', data => { errors += data; });
      const chunks = [];
      let bytes = 0;
      await new Promise((resolve, reject) => {
        receiver.once('exit', code => reject(new Error('SRT receiver closed before receiving media (' + code + '): ' + errors)));
        receiver.once('error', reject);
        receiver.stdout.on('data', chunk => { chunks.push(chunk); bytes += chunk.length; if (bytes >= 4096) resolve(); });
      });
      writeFileSync(recording, Buffer.concat(chunks));
      verifyRecording(recording);
    } finally {
      clearInterval(timer);
      receiver?.kill('SIGKILL');
      await output?.stop();
      rmSync(directory, { recursive: true, force: true });
    }
  });
