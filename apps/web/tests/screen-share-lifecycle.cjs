const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { enableRoomScreenShare } = require('../lib/screen-share.ts');

function makeRoom() {
  const room = { state: 'connected', publication: undefined, stopped: 0, unpublished: 0, pending: undefined };
  room.localParticipant = {
    async setScreenShareEnabled(enabled, options) {
      if (enabled) {
        room.options = options;
        if (room.pending) await room.pending;
        if (!room.cancelled) room.publication = { track: { mediaStreamTrack: { readyState: 'live' }, stop() { room.stopped++; } } };
      }
    },
    getTrackPublication() { return room.publication; },
    async unpublishTrack(track) { room.unpublished++; if (room.publication?.track === track) room.publication = undefined; },
  };
  return room;
}

(async () => {
  const published = makeRoom();
  assert.equal(await enableRoomScreenShare(published, () => true), true, 'live screen capture is accepted');
  assert.deepEqual(published.options, { audio: true }, 'browser can offer screen audio');

  const chooserCancelled = makeRoom(); chooserCancelled.cancelled = true;
  assert.equal(await enableRoomScreenShare(chooserCancelled, () => true), false, 'cancelled chooser creates no active share');
  assert.equal(chooserCancelled.publication, undefined);

  const late = makeRoom();
  let resolveCapture;
  late.pending = new Promise(resolve => { resolveCapture = resolve; });
  let current = true;
  const starting = enableRoomScreenShare(late, () => current);
  await Promise.resolve();
  current = false; late.state = 'disconnected'; resolveCapture();
  assert.equal(await starting, false, 'capture completing after disconnect is rejected');
  assert.equal(late.publication, undefined, 'late screen publication is removed');
  assert.equal(late.stopped, 1, 'late media track is stopped');
  assert.equal(late.unpublished, 1, 'late publication is explicitly unpublished');
  console.log('PASS: screen share publishes, cancels cleanly, requests optional audio, and stops late capture after disconnect');
})().catch(error => { console.error(error); process.exitCode = 1; });
