'use strict';

const { EventEmitter } = require('node:events');
const { mkdtempSync, rmSync, readFileSync } = require('node:fs');
const { tmpdir } = require('node:os');
const path = require('node:path');
const assert = require('node:assert/strict');
const test = require('node:test');
const { createVmixOutputPanel } = require('../src/vmix-output-panel.cjs');

test('closing and reopening the panel keeps the running slot and refuses a new scope', async t => {
  const origin = 'https://studio.example';
  const slots = id => [{ id, name: 'Caster 1', cameraPath: `/output/slot/${id}#access=camera`,
    screenPath: `/output/slot/${id}?source=screen#access=screen` }];
  const mainFrame = { url: `${origin}/studio` };
  let studioUrl = origin + '/studio?studioId=studio-default&room=On+air';
  let requested;
  const webContents = {
    mainFrame, getURL: () => studioUrl,
    session: { fetch: async (url, options) => {
      requested = { url: new URL(url), options };
      return { ok: true, json: async () => ({ slots: slots('slot-a'), queue: [] }) };
    } },
  };
  const client = { webContents, isDestroyed: () => false };
  const trustedEvent = { sender: webContents, senderFrame: mainFrame };
  const localEvent = {};
  const handlers = new Map();
  const windows = [];
  const workers = [];
  class Window extends EventEmitter {
    constructor() { super(); windows.push(this); this.webContents = { send() {} }; }
    setMenu() {}
    loadFile() { return Promise.resolve(); }
    show() {}
    focus() {}
    isDestroyed() { return this.destroyed; }
    destroy() { this.destroyed = true; this.emit('closed'); }
  }
  const folder = mkdtempSync(path.join(tmpdir(), 'castlink-vmix-panel-'));
  t.after(() => rmSync(folder, { recursive: true, force: true }));
  const profile = path.join(folder, 'vmix.json');
  const controller = createVmixOutputPanel({ client, ipcMain: { handle: (name, callback) => handlers.set(name, callback),
    removeHandler: name => handlers.delete(name) }, BrowserWindow: Window, utilityProcess: {
    fork() {
      const worker = new EventEmitter();
      worker.postMessage = ({ action }) => { if (action === 'stop') worker.emit('exit'); else worker.emit('message', { started: true }); };
      workers.push(worker);
      queueMicrotask(() => worker.emit('spawn'));
      return worker;
    },
  }, preferences() {}, isLocal: event => event === localEvent, protectLocal() {}, ui: name => name, profile,
  resourcesPath: folder, trustedOrigins: new Set([origin]), getLocale: () => 'ru' });
  t.after(() => controller.dispose());
  const invoke = (name, event, body) => handlers.get(`castlink:vmix-${name}`)(event, body);
  assert.throws(() => invoke('open', localEvent, slots('slot-a')), /Denied/);
  await controller.openStudio();
  assert.equal(requested.url.pathname, '/api/caster-slots');
  assert.equal(requested.url.searchParams.get('room'), 'On air');
  assert.equal(requested.options.credentials, 'include');
  assert.equal(requested.options.redirect, 'error');
  studioUrl = 'https://outside.example/studio?room=On+air';
  await assert.rejects(controller.openStudio(), /VMIX_STUDIO/);
  const config = { mode: 'ndi', slots: [{ id: 'slot-a', source: 'camera' }], passphrase: 'do-not-store' };
  assert.deepEqual(await invoke('start', localEvent, config), { ok: true });
  assert.doesNotMatch(readFileSync(profile, 'utf8'), /do-not-store|#access/);
  workers[0].emit('message', { assignment: 'One' });
  windows[0].destroy();
  invoke('open', trustedEvent, slots('slot-a'));
  assert.equal(windows.length, 2);
  assert.equal(workers.length, 1);
  const model = invoke('initial', localEvent);
  assert.equal(model.running, true);
  assert.equal(model.assignments['slot-a'], 'One');
  assert.throws(() => invoke('open', trustedEvent, slots('slot-b')), /VMIX_BUSY/);
  await invoke('stop', localEvent);
  assert.equal(invoke('initial', localEvent).running, false);
});
