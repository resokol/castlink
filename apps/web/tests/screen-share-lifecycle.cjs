const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { enableRoomScreenShare, enableStudioScreenShare, stopStudioScreenShare } = require('../lib/screen-share.ts');
const { LocalParticipant } = require('livekit-client');

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
  assert.deepEqual(published.options, { audio: { restrictOwnAudio: true } }, 'capture keeps display audio while requesting own-audio removal');

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

  // Exercise the installed SDK's actual createScreenTracks implementation, with a
  // microphone already published. It must only wrap getDisplayMedia's own tracks.
  const mediaTrack = kind => ({ kind, id: kind, readyState: 'live', enabled: true,
    getSettings: () => ({}), getConstraints: () => ({}), addEventListener() {}, removeEventListener() {},
    stop() { this.readyState = 'ended'; } });
  global.MediaStream = class { constructor(tracks = []) { this.tracks = tracks; } getTracks() { return this.tracks; } getAudioTracks() { return this.tracks.filter(t => t.kind === 'audio'); } getVideoTracks() { return this.tracks.filter(t => t.kind === 'video'); } };
  const displayVideo = mediaTrack('video'), displayAudio = mediaTrack('audio'), mic = mediaTrack('audio');
  let displayOptions, microphoneRequests = 0;
  Object.defineProperty(global, 'navigator', { configurable: true, value: { userAgent: 'Chrome', mediaDevices: {
    async getDisplayMedia(options) { displayOptions = options; return new MediaStream([displayVideo, displayAudio]); },
    async getUserMedia() { microphoneRequests++; throw Error('screen share must never acquire microphone'); },
  } } });
  const publications = new Map([['microphone', { track: { mediaStreamTrack: mic } }]]), sent = [];
  const participant = { sid: 'screen-owner', roomOptions: {}, logContext: () => ({}), emit() {},
    getTrackPublication: source => publications.get(source),
    async publishTrack(track) { sent.push(track); publications.set(track.source, { track }); },
    async unpublishTrack(track) { publications.delete(track.source); },
    async setScreenShareEnabled() {},
  };
  participant.createScreenTracks = options => LocalParticipant.prototype.createScreenTracks.call(participant, options);
  const studio = { state: 'connected', localParticipant: participant };
  assert.equal(await enableStudioScreenShare(studio, () => true, () => false), true);
  assert.deepEqual(sent.map(track => track.source), ['screen_share', 'screen_share_audio']);
  assert.equal(sent[1].mediaStreamTrack, displayAudio, 'shared audio is precisely the browser display-capture track');
  assert.notEqual(sent[1].mediaStreamTrack, mic, 'the separately published microphone is never reused');
  assert.equal(microphoneRequests, 0, 'screen capture never requests getUserMedia microphone access');
  assert.equal(displayOptions.audio.restrictOwnAudio, true);
  assert.equal(displayOptions.selfBrowserSurface, undefined, 'the current page remains available for PDF presentation capture');
  assert.equal(displayOptions.systemAudio, undefined, 'system audio support is preserved');
  await stopStudioScreenShare(studio);
  assert.equal(mic.readyState, 'live', 'stopping the screen share leaves the microphone untouched');
  assert.equal(mic.enabled, true);
  console.log('PASS: screen share publishes, cancels cleanly, requests optional audio, and stops late capture after disconnect');
})().catch(error => { console.error(error); process.exitCode = 1; });
