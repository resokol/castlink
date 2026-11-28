'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createSlotSource } = require('../src/vmix-slot-source.cjs');

const delay = () => new Promise(resolve => setImmediate(resolve));

test('a new assignment changes subscriptions and cannot leak frames buffered by the previous caster', async () => {
  const controllers = {};
  const video = (id, value) => {
    const track = new ReadableStream({ start(controller) { controllers[id] = controller; } });
    return { track, source: 1, setSubscribed() {}, value };
  };
  const a = video('a', 24);
  const b = video('b', 87);
  const participant = (id, publication) => ({ sid: `PA_${id}`, identity: id, metadata: JSON.stringify({ role: 'guest', admissionId: id, admissionGeneration: 1 }), trackPublications: new Map([['video', publication]]) });
  const wanted = (id, revision) => ({ revision, phase: 'assigned', source: 'camera', target: { identity: id, participantSid: `PA_${id}`, sessionId: id, generation: 1 } });
  let snapshot = wanted('a', 1);
  const states = [];
  let latest;
  class Room extends EventEmitter {
    remoteParticipants = new Map([['a', participant('a', a)], ['b', participant('b', b)]]);
    async connect() { this.isConnected = true; }
    async disconnect() { this.isConnected = false; }
  }
  const sdk = {
    Room, RoomEvent: { TrackSubscribed: 'subscribed' },
    TrackSource: { SOURCE_CAMERA: 1, SOURCE_MICROPHONE: 2, SOURCE_SCREENSHARE: 3, SOURCE_SCREENSHARE_AUDIO: 4 },
    VideoBufferType: { I420: 5 }, VideoStream: class { constructor(track) { return track; } },
  };
  const source = createSlotSource({ sdk, link: { livekitUrl: 'wss://example.test', source: 'camera' },
    requestSnapshot: async () => ({ snapshot, token: 'fixture', room: 'scene' }),
    frames: { video(frame) { latest = frame.data[0]; }, clearVideo() { latest = undefined; }, clearAudio() {} },
    onState: value => states.push(value),
  });
  try {
    await source.refresh();
    controllers.a.enqueue({ frame: { type: 5, data: [a.value] } });
    await delay();
    assert.equal(latest, a.value);
    controllers.a.enqueue({ frame: { type: 5, data: [255] } });
    snapshot = wanted('b', 2);
    await source.refresh();
    assert.equal(latest, undefined);
    controllers.b.enqueue({ frame: { type: 5, data: [b.value] } });
    await delay();
    assert.equal(latest, b.value);
    snapshot = { revision: 3, phase: 'disconnected', source: 'camera', target: null };
    await source.refresh();
    assert.equal(latest, undefined);
    assert.equal(states.at(-1), 'waiting');
  } finally { await source.stop(); }
});
