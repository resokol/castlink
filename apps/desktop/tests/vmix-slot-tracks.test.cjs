'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { parseSlotLink, selectSlotPublications } = require('../src/vmix-slot-tracks.cjs');

const sources = { camera: 1, microphone: 2, screen: 3, screenAudio: 4 };
const participant = (name, sid, session, videoSid) => ({ identity: name, sid,
  metadata: JSON.stringify({ role: 'guest', admissionId: session, admissionGeneration: 3 }),
  trackPublications: new Map([['video', { sid: videoSid, source: 1 }], ['audio', { sid: `a-${videoSid}`, source: 2 }]]) });
const a = participant('guest-a', 'PA_A', 'A', 'TR_A');
const b = participant('guest-b', 'PA_B', 'B', 'TR_B');
const c = participant('guest-c', 'PA_C', 'C', 'TR_C');
const guests = new Map([a, b, c].map(guest => [guest.identity, guest]));
const snapshot = (guest, session) => ({ phase: 'assigned', source: 'camera', target: {
  identity: guest.identity, participantSid: guest.sid, sessionId: session, generation: 3,
} });

test('adding and replacing a third caster preserves the other two independent assignments', () => {
  const first = snapshot(a, 'A');
  const second = snapshot(b, 'B');
  const third = snapshot(c, 'C');
  assert.equal(selectSlotPublications(first, guests, sources).video.sid, 'TR_A');
  assert.equal(selectSlotPublications(second, guests, sources).audio.sid, 'a-TR_B');
  assert.equal(selectSlotPublications(third, guests, sources).video.sid, 'TR_C');
  assert.deepEqual(selectSlotPublications({ ...third, phase: 'disconnected' }, guests, sources), {});
  assert.equal(selectSlotPublications(snapshot(c, 'C'), guests, sources).video.sid, 'TR_C');
  assert.equal(selectSlotPublications(first, guests, sources).video.sid, 'TR_A');
});

test('old participant SID and generation cannot keep playing after replacement', () => {
  const stale = { ...snapshot(a, 'A') };
  stale.target.participantSid = 'PA_OLD';
  assert.deepEqual(selectSlotPublications(stale, guests, sources), {});
  const prior = snapshot(a, 'A');
  prior.target.generation = 2;
  assert.deepEqual(selectSlotPublications(prior, guests, sources), {});
});

test('a remote screen is limited to the assigned helper and exact publication SIDs', () => {
  const shared = { sid: 'TR_SCREEN', source: 3 };
  const audio = { sid: 'TR_AUDIO_1', source: 4 };
  const other = { sid: 'TR_AUDIO_2', source: 4 };
  const helper = { identity: 'remote-pc-helper', sid: 'PA_HELPER', trackPublications: new Map([shared, audio, other].map(track => [track.sid, track])) };
  const source = { owner: { identity: a.identity, sid: a.sid }, helper: { identity: helper.identity, sid: helper.sid }, videoTrackSid: shared.sid, audioTrackSid: audio.sid };
  const assigned = { ...snapshot(a, 'A'), source: 'screen', remotePcSource: source };
  assert.deepEqual(selectSlotPublications(assigned, new Map([...guests, [helper.identity, helper]]), sources), { video: shared, audio });
});

test('slot URLs stay on the approved server and split the capability out of the URL', () => {
  const origin = 'https://node2.example.test';
  const url = `${origin}/output/slot/slot-a?studioId=studio-default&source=screen#access=fixture-secret`;
  const link = parseSlotLink(url, origin);
  assert.equal(link.slotId, 'slot-a');
  assert.equal(link.access, 'fixture-secret');
  assert.equal(link.source, 'screen');
  assert.equal(link.livekitUrl, 'wss://node2.example.test');
  assert.equal(link.apiUrl.href, `${origin}/api/caster-slot-output?studioId=studio-default&slot=slot-a&source=screen`);
  assert.throws(() => parseSlotLink(url.replace(origin, 'https://elsewhere.example.test'), origin), /VMIX_SLOT_LINK/);
});
