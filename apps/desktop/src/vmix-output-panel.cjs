'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { buildVmixSlotJobs, nativeSlotName } = require('./vmix-output-jobs.cjs');
const { parseSlotLink } = require('./vmix-slot-tracks.cjs');
const { isClientEvent } = require('./ipc-policy.cjs');

const messages = ['waiting', 'connecting', 'source', 'unavailable', 'revoked', 'restarting', 'error'];

function validateSlots(input, origin) {
  if (!Array.isArray(input) || !input.length || input.length > 256) throw new Error('VMIX_SLOTS');
  const slots = input.map(slot => {
    if (typeof slot?.id !== 'string' || typeof slot.name !== 'string' || !slot.name.trim() || slot.name.length > 120) throw new Error('VMIX_SLOT');
    const camera = parseSlotLink(slot.cameraPath, origin);
    const screen = parseSlotLink(slot.screenPath, origin);
    if (camera.slotId !== slot.id || screen.slotId !== slot.id || camera.source !== 'camera' || screen.source !== 'screen') throw new Error('VMIX_SLOT_LINK');
    return { id: slot.id, name: slot.name, cameraPath: slot.cameraPath, screenPath: slot.screenPath,
      assignment: typeof slot.assignment === 'string' ? slot.assignment.slice(0, 120) : undefined };
  });
  if (new Set(slots.map(slot => slot.id)).size !== slots.length) throw new Error('VMIX_SLOTS');
  return slots;
}

function createVmixOutputPanel({ client, ipcMain, BrowserWindow, utilityProcess, dialog, preferences, ui,
  isLocal, protectLocal, resourcesPath, trustedOrigins, getLocale, profile }) {
  const handlers = [];
  const workers = new Map();
  let localSettings = {};
  try { if (profile && fs.statSync(profile).size <= 65_536) localSettings = JSON.parse(fs.readFileSync(profile, 'utf8')) || {}; }
  catch { /* The first run has no saved outputs. */ }
  const paths = {};
  const bundledEncoder = path.join(resourcesPath, 'vmix', 'ffmpeg.exe');
  if (fs.existsSync(bundledEncoder)) paths.srt = bundledEncoder;
  for (const mode of ['srt', 'relay', 'ndi', 'omt']) {
    const file = localSettings.paths?.[mode];
    if (typeof file === 'string' && path.isAbsolute(file) && fs.existsSync(file)) paths[mode] = file;
  }
  let panel, descriptors = [], origin, savedConfig, power = false, stopping, disposed = false;
  let statuses = {}, assignments = {};
  function status() { return { running: power || Boolean(stopping), statuses: { ...statuses }, assignments: { ...assignments } }; }
  function save() {
    if (!profile) return;
    try {
      fs.writeFileSync(`${profile}.tmp`, JSON.stringify({ paths, origin, config: savedConfig }), { mode: 0o600 });
      fs.renameSync(`${profile}.tmp`, profile);
    } catch { /* Outputs can still run if local preferences are read-only. */ }
  }
  function emit() {
    if (panel && !panel.isDestroyed()) panel.webContents.send('castlink:vmix-status', status());
  }
  function register(name, implementation) {
    handlers.push(name);
    ipcMain.handle(name, implementation);
  }
  function fromPanel(event) {
    if (disposed || !isLocal(event, panel, 'vmix-outputs.html')) throw new Error('Denied');
  }

  function stopWorker(worker) {
    return new Promise(resolve => {
      const done = () => { clearTimeout(deadline); worker.removeListener('exit', done); resolve(); };
      const kill = () => { worker.kill(); };
      const deadline = setTimeout(kill, 10_000);
      worker.once('exit', done);
      try { worker.postMessage({ action: 'stop' }); }
      catch { kill(); }
    });
  }
  function stop() {
    if (stopping) return stopping;
    power = false;
    const active = [...workers.values()];
    workers.clear();
    statuses = {};
    if (!active.length) { emit(); return Promise.resolve(); }
    stopping = Promise.all(active.map(stopWorker)).finally(() => { stopping = undefined; emit(); });
    return stopping;
  }

  register('castlink:vmix-open', (event, entries) => {
    if (disposed || !isClientEvent(event, client, trustedOrigins)) throw new Error('Denied');
    openPanel(entries, new URL(event.senderFrame.url).origin);
  });

  function openPanel(entries, requestedOrigin) {
    const requested = validateSlots(entries, requestedOrigin);
    if (stopping || (power && (requestedOrigin !== origin || !requested.some(slot => workers.has(slot.id))))) throw new Error('VMIX_BUSY');
    if (panel && !panel.isDestroyed()) { panel.show(); panel.focus(); return; }
    if (!power) {
      descriptors = requested;
      origin = requestedOrigin;
      assignments = {};
      statuses = {};
      savedConfig = localSettings.origin === origin ? localSettings.config : undefined;
    }
    const window = new BrowserWindow({ width: 1040, height: 850, minWidth: 490, minHeight: 460, parent: client,
      title: 'CastLink · vMix', backgroundColor: '#111315', autoHideMenuBar: true, webPreferences: preferences('vmix') });
    panel = window;
    window.setMenu(null);
    protectLocal(window);
    void window.loadFile(ui('vmix-outputs.html'));
    window.on('closed', () => { if (panel === window) panel = undefined; });
  }

  async function openStudio() {
    if (disposed || client.isDestroyed()) throw new Error('VMIX_STUDIO');
    const contents = client.webContents;
    const studio = new URL(contents.getURL());
    const room = studio.searchParams.get('room');
    if (!trustedOrigins.has(studio.origin) || !/^\/studio\/?$/u.test(studio.pathname) || !room) throw new Error('VMIX_STUDIO');
    const query = new URLSearchParams({ studioId: studio.searchParams.get('studioId') || 'studio-default', room });
    const endpoint = new URL('/api/caster-slots?' + query, studio.origin);
    const response = await contents.session.fetch(endpoint.href, {
      credentials: 'include', cache: 'no-store', redirect: 'error', signal: AbortSignal.timeout(7000),
    });
    if (response.status === 404) throw new Error('VMIX_SERVER');
    if (!response.ok) throw new Error('VMIX_ACCESS');
    const { slots, queue } = await response.json();
    if (disposed || client.isDestroyed() || contents.getURL() !== studio.href) throw new Error('VMIX_STUDIO');
    if (!Array.isArray(slots) || !Array.isArray(queue)) throw new Error('VMIX_SERVER');
    openPanel(slots.map(({ id, name, cameraPath, screenPath, assignment }) => ({
      id, name, cameraPath, screenPath, assignment: queue.find(caster => caster.identity === assignment?.identity)?.name,
    })), studio.origin);
  }
  register('castlink:vmix-initial', event => {
    fromPanel(event);
    return { ...status(), locale: getLocale(), paths: { ...paths }, config: savedConfig,
      slots: descriptors.map(({ id, name, assignment }) => ({ id, name, assignment, nativeName: nativeSlotName(id) })) };
  });
  register('castlink:vmix-pick', async (event, mode) => {
    fromPanel(event);
    if (power || stopping || !['srt', 'relay', 'ndi', 'omt'].includes(mode)) return null;
    const extension = ['srt', 'relay'].includes(mode) ? 'exe' : 'dll';
    const component = { srt: 'FFmpeg', relay: 'srt-live-transmit' }[mode] || mode.toUpperCase();
    const result = await dialog.showOpenDialog(panel, { properties: ['openFile'], filters: [{ name: component, extensions: [extension] }] });
    const selected = result.filePaths?.[0];
    if (result.canceled || !selected || !path.isAbsolute(selected) || path.extname(selected).toLowerCase() !== `.${extension}` ||
        !fs.statSync(selected, { throwIfNoEntry: false })?.isFile()) return null;
    paths[mode] = selected;
    save();
    return selected;
  });
  register('castlink:vmix-start', async (event, config) => {
    fromPanel(event);
    if (power || stopping) return { ok: false, error: 'VMIX_BUSY' };
    try {
      const jobs = buildVmixSlotJobs({ config, descriptors, origin, paths });
      const [{ mode, fps, bitrateKbps, config: srt }] = jobs;
      savedConfig = { mode, fps, bitrateKbps, slots: config.slots.map(({ id, source, port }) => ({ id, source, port })),
        srt: srt && { mode: srt.mode, address: srt.address, localAddress: srt.localAddress, latencyMs: srt.latencyMs,
          keyLength: srt.keyLength, encrypted: Boolean(srt.passphrase) } };
      localSettings = { origin, config: savedConfig };
      save();
      power = true;
      assignments = {};
      statuses = {};
      const readiness = [];
      for (const job of jobs) {
        const worker = utilityProcess.fork(path.join(__dirname, 'vmix-output-worker.cjs'), [], { stdio: 'ignore', serviceName: 'CastLink vMix output' });
        workers.set(job.id, worker);
        statuses[job.id] = 'connecting';
        const ready = Promise.withResolvers();
        readiness.push(ready.promise);
        const startupTimeout = setTimeout(() => { worker.kill(); ready.resolve('VMIX_START'); }, 10_000);
        const finishStartup = result => { clearTimeout(startupTimeout); ready.resolve(result); };
        worker.on('message', value => {
          if (workers.get(job.id) !== worker) return;
          if (value?.started === true) { finishStartup(true); return; }
          if (messages.includes(value?.state)) {
            statuses[job.id] = value.state;
            if (value.state === 'error') finishStartup(value.code || 'VMIX_START');
          }
          else if (value?.assignment === null || typeof value?.assignment === 'string') {
            const assignment = value.assignment?.slice(0, 120) || null;
            if (assignment === assignments[job.id]) return;
            assignments[job.id] = assignment;
          } else return;
          emit();
        });
        worker.once('exit', () => {
          finishStartup('VMIX_START');
          if (workers.get(job.id) !== worker) return;
          workers.delete(job.id);
          statuses[job.id] = 'error';
          assignments[job.id] = null;
          power = workers.size > 0;
          emit();
        });
        worker.once('spawn', () => {
          if (workers.get(job.id) === worker) worker.postMessage({ action: 'start', options: job });
        });
      }
      emit();
      const results = await Promise.all(readiness);
      return results.includes(true) && power ? { ok: true } : { ok: false, error: results.find(value => typeof value === 'string') || 'VMIX_START' };
    } catch (error) {
      await stop();
      return { ok: false, error: /^(?:SRT|VMIX)_[A-Z_]+$/u.test(error.message) ? error.message : 'VMIX_START' };
    }
  });
  register('castlink:vmix-stop', event => { fromPanel(event); return stop(); });

  return {
    openStudio,
    isRunning() { return power || Boolean(stopping); },
    reset() {
      if (panel && !panel.isDestroyed()) panel.destroy();
      descriptors = [];
      return stop();
    },
    dispose() {
      disposed = true;
      for (const name of handlers) ipcMain.removeHandler(name);
      return this.reset();
    },
  };
}

module.exports = { createVmixOutputPanel };
