'use strict';

const { startVmixSlot } = require('./vmix-output-runtime.cjs');
const { parseSlotLink } = require('./vmix-slot-tracks.cjs');
const { net } = require('electron');

const port = process.parentPort;
let start, stopping = false;

async function shutdown() {
  if (stopping) return;
  stopping = true;
  try { await (await start)?.stop(); } catch { /* The sink may already have exited. */ }
  process.exit(0);
}

port.on('message', event => {
  const { action, options } = event.data;
  if (action === 'stop') { void shutdown(); return; }
  if (action !== 'start' || start || stopping) return;
  start = Promise.resolve().then(async () => {
    if (options.mode === 'srt') {
      const { checkSrtEncoder, checkSrtRelay } = require('./vmix-srt-output.cjs');
      await Promise.all([checkSrtEncoder(options.executable), options.config.mode === 'rendezvous' && checkSrtRelay(options.relayExecutable)]);
    }
    return startVmixSlot({
      ...options, link: parseSlotLink(options.link, options.origin),
      onState: state => port.postMessage({ state }),
      onAssignment: assignment => port.postMessage({ assignment }),
      fetcher: (url, init) => net.fetch(url, init),
    });
  });
  void start.then(() => { if (!stopping) port.postMessage({ started: true }); }, error => {
    const code = error?.code || error?.message;
    port.postMessage({ state: 'error', code: /^(?:NDI|OMT|SRT|VMIX)_[A-Z_]+$/u.test(code) ? code : 'VMIX_START' });
    void shutdown();
  });
});
