const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const card = fs.readFileSync(path.join(__dirname, '../components/GuestVideoCard.tsx'), 'utf8');
const row = card.indexOf('guest-card-bitrate');
assert.ok(row >= 0 && row < card.indexOf('{quickControls &&'), 'camera limit and actual room-send rate must be visible above Sound/Video controls');
assert.ok(row < card.indexOf('<MonitoringControls'), 'camera bitrate row must be above the personal Sound on / Video on buttons');
assert.ok(row < card.indexOf('<details className="source-card-advanced"'), 'camera bitrate row must stay visible with Settings collapsed');
assert.match(card, /guest\.roomSendBitrateKbps/, 'room-send readout must have a distinct measurement from card reception');
assert.match(card, /Приём камеры · факт.*guest\.bitrateKbps/s, 'existing receive diagnostics remain explicitly receive-only');

const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
const { guestCameraOutboundRecipients, parseGuestCameraOutbound, freshGuestCameraOutboundBitrate, watchGuestCameraOutbound } = require('../lib/guest-camera-outbound.ts');
const { RoomEvent, Track } = require('livekit-client');
const participant = (identity, role) => ({ identity, metadata: JSON.stringify({ role }) });
const primary = participant('studio-panel-main', 'studio-panel');
const admin = participant('studio-moderator-owner', 'studio-moderator');
const moderator = participant('studio-moderator-mod', 'studio-moderator');
const guest = participant('guest-other', 'guest');
const output = participant('output-source', 'output');
assert.deepEqual(guestCameraOutboundRecipients([primary, admin, moderator, guest, output, participant('guest-fake', 'studio-panel')]), [primary.identity, admin.identity, moderator.identity]);
const payload = bitrateKbps => new TextEncoder().encode(JSON.stringify({ type: 'guest-camera-outbound', bitrateKbps }));
assert.deepEqual(parseGuestCameraOutbound(payload(7200), guest), { bitrateKbps: 7200 });
assert.deepEqual(parseGuestCameraOutbound(payload(0), guest), { bitrateKbps: 0 }, 'measured zero is distinct from no measurement');
assert.deepEqual(parseGuestCameraOutbound(payload(null), guest), { bitrateKbps: null });
for (const value of [-1, 100001, '4000', {}]) assert.equal(parseGuestCameraOutbound(payload(value), guest), null);
assert.equal(parseGuestCameraOutbound(payload(4000), primary), null, 'studio cannot impersonate a guest outbound sample');
assert.equal(parseGuestCameraOutbound(payload(4000), participant('guest-fake', 'output')), null);
assert.equal(parseGuestCameraOutbound(new Uint8Array(257), guest), null);
assert.equal(freshGuestCameraOutboundBitrate(undefined, 10000), null);
assert.equal(freshGuestCameraOutboundBitrate({ bitrateKbps: 0, receivedAt: 1000 }, 2000), 0);
assert.equal(freshGuestCameraOutboundBitrate({ bitrateKbps: 4000, receivedAt: 1000 }, 11001), null, 'old samples cannot continue claiming live room-send traffic');

(async () => {
  // Real sender-delta sampler, fake only the room boundary and scheduler.
  const originalSetInterval = global.setInterval, originalClearInterval = global.clearInterval;
  let poll, cleared = false, report = [], pendingResolve;
  global.setInterval = callback => { poll = callback; return 123; };
  global.clearInterval = handle => { assert.equal(handle, 123); cleared = true; };
  try {
    const listeners = new Map(), sends = [];
    const camera = { getRTCStatsReport: async () => report };
    const publication = { track: camera, isMuted: false };
    const room = { state: 'connected', remoteParticipants: new Map([[primary.identity, primary], [guest.identity, guest]]),
      localParticipant: { sid: 'session-1', getTrackPublication: source => { assert.equal(source, Track.Source.Camera); return publication; }, publishData: async (data, options) => sends.push({ data: JSON.parse(new TextDecoder().decode(data)), options }) },
      on: (event, callback) => listeners.set(event, callback), off: event => listeners.delete(event) };
    const rtp = (id, bytes, timestamp, extra = {}) => ({ id, type: 'outbound-rtp', kind: 'video', bytesSent: bytes, timestamp, ...extra });
    const settle = () => new Promise(resolve => setImmediate(resolve));
    report = [rtp('high', 1000, 1000), rtp('low', 1000, 1000)];
    const stop = watchGuestCameraOutbound(room);
    await settle(); assert.equal(sends.length, 0, 'first stats read only establishes baselines');
    report = [rtp('high', 1_001_000, 3000), rtp('low', 251_000, 3000), { type: 'inbound-rtp', kind: 'video', bytesReceived: 999_999_999, timestamp: 3000 }, rtp('audio', 999_999_999, 3000, { kind: 'audio' })];
    poll(); await settle();
    assert.equal(sends.at(-1).data.bitrateKbps, 5000, 'all outbound camera layers summed, unrelated inbound/audio excluded');
    assert.deepEqual(sends.at(-1).options.destinationIdentities, [primary.identity], 'samples never broadcast to other casters or outputs');
    assert.equal(sends.at(-1).options.topic, 'studiolink-guest-camera-outbound');
    const count = sends.length; poll(); await settle(); assert.equal(sends.length, count, 'cached statistics do not refresh stale traffic');
    publication.isMuted = true; poll(); await settle(); assert.equal(sends.at(-1).data.bitrateKbps, null, 'camera mute clears the measured traffic');
    publication.isMuted = false; report = [rtp('high', 1000, 5000)]; poll(); await settle(); assert.equal(sends.length, count + 1, 'camera restart baselines again');
    camera.getRTCStatsReport = () => new Promise(resolve => { pendingResolve = resolve; });
    poll(); await settle(); room.localParticipant.sid = 'session-2'; pendingResolve([rtp('high', 999_999_999, 7000)]); await settle();
    assert.equal(sends.length, count + 1, 'an old session completion cannot report as the new session');
    stop(); assert.equal(cleared, true); assert.equal(listeners.size, 0);
    assert.ok(RoomEvent.Reconnected);
  } finally { global.setInterval = originalSetInterval; global.clearInterval = originalClearInterval; }
  console.log('PASS: visible camera quality controls, true outbound camera layers, scoped guest-to-staff data, missing/zero/stale measurements and media-session guards');
})().catch(error => { console.error(error); process.exitCode = 1; });
