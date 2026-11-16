const assert = require('node:assert/strict');
const fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, file);
let observer = {};
try { observer = require('../lib/room-outbound-stats.ts'); } catch (error) { if (error.code !== 'MODULE_NOT_FOUND') throw error; }
assert.equal(typeof observer.subscribeRoomOutboundStats, 'function', 'already-collected sender reports must reach the guest channel without extra reads');
const { startRoomTelemetry } = require('../lib/rtc-telemetry.ts');
const { watchGuestCameraOutbound, parseGuestCameraOutbound, freshGuestUplink } = require('../lib/guest-camera-outbound.ts');
const { EventEmitter } = require('node:events');
const { Track, RoomEvent } = require('livekit-client');
const { harness } = require('./studio-guest-render.cjs');
const { load } = require('./load-typescript.cjs');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const original = { fetch: global.fetch, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout, setInterval: global.setInterval, clearInterval: global.clearInterval, Date: global.Date };
const flush = async () => { for (let i = 0; i < 60; i++) await Promise.resolve(); };
(async () => {
 let stopWatch, stopTelemetry, studio;
 try {
  let now = 1000, reads = 0, sent = 1000, lost = 0, rr = 1, videoActive = false;
  const timeouts = new Set(), intervals = new Set(), messages = [];
  global.Date = class extends original.Date { static now() { return now; } };
  global.setTimeout = (fn, ms) => { const timer = { fn, ms }; timeouts.add(timer); return timer; };
  global.clearTimeout = timer => timeouts.delete(timer);
  global.setInterval = fn => { intervals.add(fn); return fn; }; global.clearInterval = fn => intervals.delete(fn);
  global.fetch = async () => ({ ok: true });
  const primary = { identity: 'studio-panel-main', metadata: JSON.stringify({ role: 'studio-panel' }) };
  const report = kind => new Map([
   ['out', { id: 'out', type: 'outbound-rtp', kind, ssrc: 1, remoteId: 'rr', timestamp: now, bytesSent: sent * 100, packetsSent: sent }],
   ['rr', { id: 'rr', type: 'remote-inbound-rtp', kind, ssrc: 1, localId: 'out', timestamp: now, packetsLost: kind === 'audio' ? lost : 0, reportsReceived: rr, jitter: .002, roundTripTime: .025 }],
  ]);
  const mic = { source: Track.Source.Microphone, kind: Track.Kind.Audio, isMuted: false, track: { getRTCStatsReport: async () => { reads++; return report('audio'); } } };
  const camera = { source: Track.Source.Camera, kind: Track.Kind.Video, isMuted: false, track: { getRTCStatsReport: async () => { reads++; return report('video'); } } };
  const pubs = new Map([[Track.Source.Microphone, mic]]);
  const local = { identity: 'guest-test', sid: 'PA_test', isLocal: true, name: 'Guest', trackPublications: pubs, getTrackPublication: source => pubs.get(source),
   publishData: async (bytes, options) => { messages.push({ bytes, options }); } };
  const room = Object.assign(new EventEmitter(), { state: 'connected', localParticipant: local, remoteParticipants: new Map([[primary.identity, primary]]) });
  primary.trackPublications = new Map();
  studio = harness(); await flush();
  studio.room.remoteParticipants.clear();
  Object.assign(studio.participant, { identity: local.identity, sid: local.sid, metadata: JSON.stringify({ role: 'guest' }) });
  studio.room.remoteParticipants.set(local.identity, studio.participant);
  studio.camera.isMuted = true;
  studio.microphone.track.getRTCStatsReport = async () => new Map([['in', { id: 'in', type: 'inbound-rtp', kind: 'audio', timestamp: now, packetsReceived: sent, packetsLost: 0, bytesReceived: sent * 100, jitter: .002 }], ['pair', { id: 'pair', type: 'candidate-pair', nominated: true, state: 'succeeded', currentRoundTripTime: .025 }]]);
  studio.time(now); await studio.context.refreshRef.current();
  stopWatch = watchGuestCameraOutbound(room); await flush();
  stopTelemetry = startRoomTelemetry(room, 'room', 'malformed'); await flush();
  assert.equal(intervals.size, 1, 'only the original guest message timer exists');
  assert.equal(reads, 1, 'audio-only loss measurement uses precisely the original telemetry read');
  const tick = async (at, sentValue, lostValue, reports) => {
   now = at; sent = sentValue; lost = lostValue; rr = reports;
   const pending = [...timeouts].filter(timer => timer.ms === 2000); pending.forEach(timer => { timeouts.delete(timer); timer.fn(); });
   await flush();
   for (const fn of intervals) fn(); await flush();
   studio.time(now);
   // Exercise the real Studio data-handler authentication/SID guard and roster refresh.
   for (const message of messages.slice(-2)) studio.room.emit(RoomEvent.DataReceived, message.bytes, studio.participant, undefined, message.options.topic);
   await studio.context.refreshRef.current();
   return parseGuestCameraOutbound(messages.at(-1).bytes, { ...local, metadata: JSON.stringify({ role: 'guest' }) });
  };
  let parsed = await tick(3000, 1100, 10, 2);
  assert.equal(parsed.uplink.audio.currentLoss.percent, 10, 'real telemetry collector→directed message carries caster uplink losses');
  assert.equal(parsed.uplink.audio.active, true);
  assert.equal(parsed.uplink.video.active, false);
  assert.equal(reads, 2, 'no extra getStats was introduced');
  assert.deepEqual(messages.at(-1).options.destinationIdentities, [primary.identity]);
  const { GuestMiniStats } = load('../components/GuestMiniStats.tsx');
  const guest = studio.guests()[0];
  assert.equal(guest.currentLoss.percent, 0, 'real Studio receiver leg measures zero loss');
  assert.equal(guest.uplink.audio.currentLoss.percent, 10, 'real Studio handler preserves sender feedback');
  const topic = messages.at(-1).options.topic;
  const deliver = value => studio.room.emit(RoomEvent.DataReceived, new TextEncoder().encode(JSON.stringify(value)), studio.participant, undefined, topic);
  const acceptedWire = JSON.parse(new TextDecoder().decode(messages.at(-1).bytes));
  acceptedWire.sequence = 2;
  deliver(acceptedWire);
  const accepted = studio.context.guestCameraOutboundRef.current[local.identity];
  const oldWire = structuredClone(acceptedWire); oldWire.sequence = 1;
  oldWire.uplink.audio.currentLoss = { packets: 0, percent: 0 }; oldWire.uplink.audio.totalLoss = { packets: 0, percent: 0 };
  now = 3500; studio.time(now); deliver(oldWire);
  assert.equal(studio.context.guestCameraOutboundRef.current[local.identity], accepted, 'older healthy uplink cannot replace newer bad loss, history or freshness');
  deliver(acceptedWire);
  assert.equal(studio.context.guestCameraOutboundRef.current[local.identity], accepted, 'duplicate uplink cannot extend freshness');
  deliver({ type: 'guest-camera-outbound', bitrateKbps: 123 });
  const compact = studio.context.guestCameraOutboundRef.current[local.identity];
  assert.equal(compact.uplinkSequence, 2, 'legacy bitrate companion preserves the uplink sequence');
  assert.equal(compact.uplinkReceivedAt, accepted.uplinkReceivedAt, 'legacy companion cannot refresh feedback age');
  assert.equal(compact.uplink.audio.currentLoss.percent, 10);
  studio.room.emit(RoomEvent.SignalReconnecting);
  assert.equal(studio.context.guestCameraOutboundRef.current[local.identity], undefined, 'signal reconnect clears displayed metrics');
  deliver(oldWire);
  assert.equal(studio.context.guestCameraOutboundRef.current[local.identity], undefined, 'same-SID old report remains rejected after metrics are cleared');
  deliver(acceptedWire);
  assert.equal(studio.context.guestCameraOutboundRef.current[local.identity], undefined, 'same-SID duplicate remains rejected after metrics are cleared');
  studio.room.emit(RoomEvent.Reconnected);
  deliver(oldWire);
  assert.equal(studio.context.guestCameraOutboundRef.current[local.identity], undefined, 'reconnected metric clear does not discard sequence watermark');
  for (const sequence of [undefined, 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.equal(parseGuestCameraOutbound(new TextEncoder().encode(JSON.stringify({ ...acceptedWire, sequence })), studio.participant), null, 'versioned uplink requires a positive safe integer sequence');
  }
  const html = renderToStaticMarkup(React.createElement(GuestMiniStats, { guest }));
  assert.match(html, /data-quality="bad"/, 'healthy downstream must not hide bad caster upload');
  assert.match(html, /10% \/ 10 пак/);
  assert.match(html, /Кастер → сервер/);
  pubs.set(Track.Source.Camera, camera);
  const beforeVideoReads = reads;
  await tick(5000, 1200, 20, 3);
  parsed = await tick(7000, 1300, 30, 4);
  assert.equal(reads - beforeVideoReads, 6, 'two media kinds retain exactly two telemetry reads plus the existing camera bitrate read per tick');
  assert.equal(parsed.uplink.video.currentLoss.percent, 0);
  assert.equal(parsed.uplink.audio.currentLoss.percent, 10, 'bad audio cannot hide behind healthy uploaded video');
  const mixedHtml = renderToStaticMarkup(React.createElement(GuestMiniStats, { guest: studio.guests()[0] }));
  assert.match(mixedHtml, /data-quality="bad"/);
  parsed = await tick(21000, 1500, 30, 4);
  assert.equal(freshGuestUplink({ ...parsed, receivedAt: now }, now).audio.currentLoss, null, 'repeated messages cannot freshen cached RTCP');
  const missing = renderToStaticMarkup(React.createElement(GuestMiniStats, { guest: { ...guest, networkSampledAtRef: { current: now }, uplink: undefined } }));
  assert.match(missing, /data-quality="unknown"/, 'legacy client uplink absence must not claim full-path good');
  const lastSequence = JSON.parse(new TextDecoder().decode(messages.at(-1).bytes)).sequence;
  stopWatch(); stopWatch = watchGuestCameraOutbound(room); await flush();
  await tick(23000, 1600, 30, 5);
  assert.ok(JSON.parse(new TextDecoder().decode(messages.at(-1).bytes)).sequence > lastSequence, 'sender sequence survives watcher remount for the same Room/SID');
  local.sid = 'PA_new_session'; studio.participant.sid = local.sid;
  await tick(25000, 100, 0, 1);
  const newSession = studio.context.guestCameraOutboundRef.current[local.identity];
  assert.equal(newSession.uplinkSequence, 1, 'new SID accepts sequence1 independently of the old session');
  assert.equal(newSession.uplink.audio.totalLoss.packets, 0, 'new SID does not carry old session loss history');
  console.log('PASS actual telemetry→directed guest message→UI pipeline, audio upload loss with zero downstream loss, cached RR, privacy and unchanged read/timer counts');
 } finally { studio?.stop(); stopWatch?.(); stopTelemetry?.(); Object.assign(global, original); }
})().catch(error => { console.error(error); process.exitCode = 1; });
