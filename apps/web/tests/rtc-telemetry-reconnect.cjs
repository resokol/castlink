const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load } = require('./load-typescript.cjs');
const { RoomEvent } = require('livekit-client');
const { startRoomTelemetry } = load('../lib/rtc-telemetry.ts');
const original = { fetch: global.fetch, setTimeout: global.setTimeout, clearTimeout: global.clearTimeout };
const samples = [];
const settle = async () => { for (let i = 0; i < 30; i++) await Promise.resolve(); };
const room = Object.assign(new EventEmitter(), { state: 'connected', localParticipant: { identity: 'guest-one', name: 'Guest', trackPublications: new Map() }, remoteParticipants: new Map() });
(async () => {
 let stop;
 try {
  global.fetch = async (url, options) => { samples.push(JSON.parse(options.body)); return { ok: true }; };
  global.setTimeout = () => 1; global.clearTimeout = () => {};
  stop = startRoomTelemetry(room, 'one', 'malformed'); await settle();
  const first = samples.at(-1);
  room.emit(RoomEvent.SignalReconnecting); room.emit(RoomEvent.Reconnecting); room.emit(RoomEvent.Reconnecting); room.emit(RoomEvent.Reconnected);
  stop(); stop = undefined; await settle();
  assert.equal(samples.at(-1).reconnects, 1, 'signal resume escalating to full restart is one recovery episode');
  stop = startRoomTelemetry(room, 'one', 'malformed'); await settle();
  assert.notEqual(samples.at(-1).session, first.session, 'explicit stop/start remains a distinct raw connection session');
  assert.equal(samples.at(-1).reconnects, 0, 'a fresh raw connection does not guess a network failure');
  room.emit(RoomEvent.Reconnecting); room.emit(RoomEvent.Reconnected);
  room.emit(RoomEvent.SignalReconnecting); room.emit(RoomEvent.Reconnected);
  room.emit(RoomEvent.Reconnecting); room.emit(RoomEvent.Disconnected);
  room.emit(RoomEvent.Reconnecting);
  stop(); stop = undefined; await settle();
  assert.equal(samples.at(-1).reconnects, 4, 'reconnected and terminal disconnected each close the previous recovery episode');
  assert.equal(room.listenerCount(RoomEvent.Reconnecting), 0);
  console.log('PASS reconnect episode deduplication, separate raw sessions, repeated recovery and teardown');
 } finally { stop?.(); Object.assign(global, original); }
})().catch(error => { console.error(error); process.exitCode = 1; });
