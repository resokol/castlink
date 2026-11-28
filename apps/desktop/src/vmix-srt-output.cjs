'use strict';

const { execFile, spawn } = require('node:child_process');
const { once } = require('node:events');
const { createServer } = require('node:net');
const { promisify } = require('node:util');
const { srtEndpoint, rendezvousEndpoint } = require('./vmix-output-config.cjs');

async function checkSrtEncoder(executable) {
  const run = promisify(execFile);
  try {
    const inspect = command => run(executable, ['-hide_banner', command], { timeout: 4000, windowsHide: true });
    const [protocols, encoders] = await Promise.all([inspect('-protocols'), inspect('-encoders')]);
    if (!/^\s+srt\s*$/m.test(protocols.stdout) || !/^\s*V[.A-Z]{5}\s+libx264\s/m.test(encoders.stdout) || !/^\s*A[.A-Z]{5}\s+aac\s/m.test(encoders.stdout)) throw new Error();
  } catch { throw new Error('VMIX_FFMPEG'); }
}

async function checkSrtRelay(executable) {
  try {
    const { stdout, stderr } = await promisify(execFile)(executable, ['-version'], { timeout: 4000, windowsHide: true });
    if (!/SRT Library version:\s*\d/u.test(stdout + stderr)) throw new Error();
  } catch { throw new Error('VMIX_SRT_RENDEZVOUS'); }
}

async function startChild(executable, args, stdio, errorCode) {
  const process = spawn(executable, args, { stdio, windowsHide: true });
  const closed = new Promise(resolve => process.once('close', (code, signal) => resolve({ code, signal })));
  try { await once(process, 'spawn'); } catch { await closed; throw new Error(errorCode); }
  return { process, closed, stop() { if (process.exitCode === null && process.signalCode === null) process.kill('SIGKILL'); } };
}

function loopbackInput() {
  let client;
  const server = createServer(socket => {
    if (client) { socket.destroy(); return; }
    client = socket;
    client.on('error', () => {});
    client.setNoDelay(true);
    server.close();
  });
  return {
    async open() {
      server.listen(0, '127.0.0.1');
      await once(server, 'listening');
      return `tcp://127.0.0.1:${server.address().port}`;
    },
    write(frame) {
      if (!client?.writable || client.writableNeedDrain) return false;
      client.write(frame);
      return true;
    },
    close() {
      if (server.listening) server.close();
      client?.destroy();
    },
  };
}

async function startSrtOutput({ executable, relayExecutable, config, id, width, height, fps, bitrateKbps }) {
  if (![width, height].every(value => Number.isInteger(value) && value > 0 && value <= 4096 && value % 2 === 0) ||
      !Number.isInteger(fps) || fps < 1 || fps > 120 || !Number.isInteger(bitrateKbps) || bitrateKbps < 100 || bitrateKbps > 50_000) {
    throw new Error('SRT_ENCODING');
  }
  const rendezvous = config.mode === 'rendezvous';
  if (rendezvous && !relayExecutable) throw new Error('VMIX_SRT_RENDEZVOUS');
  const destination = rendezvous ? rendezvousEndpoint(config, id) : srtEndpoint(config, id, false);
  const slot = config.slots.find(candidate => candidate.id === id);
  const video = loopbackInput();
  const audio = loopbackInput();
  let encoder, relay;
  const release = () => { video.close(); audio.close(); encoder?.stop(); relay?.stop(); };
  try {
    const [videoUrl, audioUrl] = await Promise.all([video.open(), audio.open()]);
    const args = [
      '-hide_banner', '-loglevel', 'error', '-nostdin',
      '-thread_queue_size', '8', '-probesize', '32', '-analyzeduration', '0',
      '-f', 'rawvideo', '-pixel_format', 'yuv420p', '-video_size', `${width}x${height}`, '-framerate', String(fps), '-i', videoUrl,
      '-thread_queue_size', '32', '-probesize', '32', '-analyzeduration', '0',
      '-f', 's16le', '-ar', '48000', '-ac', '2', '-i', audioUrl,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'libx264', '-preset', 'ultrafast', '-tune', 'zerolatency',
      '-b:v', `${bitrateKbps}k`, '-maxrate', `${bitrateKbps}k`, '-bufsize', `${bitrateKbps}k`, '-g', String(fps),
      '-c:a', 'aac', '-profile:a', 'aac_low', '-b:a', '192k', '-f', 'mpegts', '-muxdelay', '0', '-muxpreload', '0',
    ];
    if (rendezvous) {
      relay = await startChild(relayExecutable, ['-q', '-t:12', '-tm:1', '-chunk:1316', 'file://con', destination],
        ['pipe', 'ignore', 'ignore'], 'VMIX_SRT_RENDEZVOUS');
      relay.process.stdin.on('error', () => {});
      args.push('-flush_packets', '1', 'pipe:1');
    } else {
      if (config.passphrase) args.push('-passphrase', config.passphrase, '-pbkeylen', String(config.keyLength));
      if (slot.streamId && config.mode !== 'listener') args.push('-srt_streamid', slot.streamId);
      const connectOption = config.mode === 'listener' ? 'listen_timeout=12000000' : 'connect_timeout=5000';
      args.push(destination + '&' + connectOption + '&timeout=6000000');
    }
    encoder = await startChild(executable, args, rendezvous ? ['ignore', 'pipe', 'ignore'] : 'ignore', 'SRT_ENCODER_UNAVAILABLE');
    if (relay) encoder.process.stdout.pipe(relay.process.stdin);
    const children = [encoder.closed, ...(relay ? [relay.closed] : [])];
    const closed = Promise.race(children).then(async result => {
      release();
      await Promise.all(children);
      return result;
    });
    return {
      closed,
      writeVideo: video.write,
      writeAudio: audio.write,
      async stop() {
        release();
        await closed;
      },
    };
  } catch (error) {
    release();
    await Promise.all([encoder?.closed, relay?.closed]);
    throw error;
  }
}

module.exports = { checkSrtEncoder, checkSrtRelay, startSrtOutput };
