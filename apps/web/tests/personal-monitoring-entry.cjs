const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { RoomEvent, Track, TrackEvent } = require('livekit-client');
const { load } = require('./load-typescript.cjs');

// Follow real hook dependencies so a source update can reinstall subscriptions
// without simulating a new room entry or discarding the user's current choices.
let cursor = 0, hooks = [], effects = [], sources = [];
const changed = (previous, next) => !previous || next.some((value, index) => value !== previous[index]);
const react = {
  useRef(initial) { return hooks[cursor++] ||= { current: initial }; },
  useState(initial) {
    const index = cursor++;
    if (!(index in hooks)) hooks[index] = initial;
    return [hooks[index], value => { hooks[index] = typeof value === 'function' ? value(hooks[index]) : value; }];
  },
  useCallback(callback, deps) {
    const index = cursor++, old = hooks[index];
    if (changed(old?.deps, deps)) hooks[index] = { callback, deps };
    return hooks[index].callback;
  },
  useEffect(effect, deps) {
    const index = cursor++, old = hooks[index];
    if (changed(old?.deps, deps)) effects.push(() => {
      old?.cleanup?.();
      hooks[index] = { deps, cleanup: effect() };
    });
  },
};
const { usePersonalMonitoring } = load('../lib/personal-monitoring.ts', {
  react,
  './use-remote-pc': { useRemotePc: () => ({ sources }) },
});
const saved = new Map();
global.localStorage = { getItem: key => saved.get(key) || null, setItem: (key, value) => saved.set(key, value) };
const preference = { audio: false, video: false, volume: 20 };
saved.set('studiolink-monitor:entry', JSON.stringify({ 'studio-panel-main': preference, 'guest-other': preference }));

function participant(identity) {
  const track = new EventEmitter();
  track.setVolume = value => { track.volume = value; };
  const publications = [Track.Kind.Audio, Track.Kind.Video].map(kind => ({
    kind, isDesired: true, track: kind === Track.Kind.Audio ? track : undefined,
    setSubscribed(value) { this.isDesired = value; },
  }));
  return { identity, track, publications, trackPublications: new Map(publications.map(pub => [pub.kind, pub])), getTrackPublication: () => undefined };
}
function makeRoom() {
  const room = new EventEmitter(), studio = participant('studio-panel-main'), other = participant('guest-other');
  room.remoteParticipants = new Map([studio, other].map(person => [person.identity, person]));
  room.startAudio = async () => {};
  return { room, studio, other };
}
let entry = makeRoom(), roomName = 'entry';
function render() {
  cursor = 0;
  const value = usePersonalMonitoring(entry.room, roomName, false, undefined, false, 100, true);
  while (effects.length) effects.shift()();
  return value;
}
function assertMuted(message) {
  assert.equal(entry.studio.track.volume, 0, message);
  assert.equal(entry.studio.publications[1].isDesired, false, message);
  assert.equal(render().preferences['studio-panel-main'].volume, 20, message);
}
let state = render();
assert.equal(entry.studio.track.volume, 1, 'actual guest entry resets saved studio OFF');
assert.equal(entry.other.track.volume, 0, 'other guests retain their saved choices');
state.change('studio-panel-main', preference);
state = render();
assertMuted('manual studio OFF applies during this entry');

sources = [{ helper: { identity: 'remote-pc-other', sid: 'PA_other' } }];
render();
assertMuted('an unrelated Remote PC source starting must preserve studio OFF');
sources = [];
render();
entry.room.emit(RoomEvent.Reconnecting);
entry.room.emit(RoomEvent.Reconnected);
assertMuted('source removal and reconnect must preserve studio OFF');
assert.equal(entry.studio.track.listenerCount(TrackEvent.ElementAttached), 1, 'source changes keep one live audio binding');

const old = entry;
entry = makeRoom();
render();
assert.equal(entry.studio.track.volume, 1, 'a replacement room is a new entry and resets studio OFF');
assert.equal(old.room.eventNames().length, 0, 'replacement room removes old listeners');
assert.equal(old.studio.track.eventNames().length, 0, 'replacement room removes old audio bindings');
state = render();
state.change('studio-panel-main', preference);
roomName = 'other-entry';
render();
assert.equal(entry.studio.track.volume, 1, 'a different room storage scope starts a fresh entry');
for (const hook of hooks) hook?.cleanup?.();
assert.equal(entry.room.eventNames().length, 0);
assert.equal(entry.studio.track.eventNames().length, 0);
console.log('PASS: Remote PC source changes preserve in-session studio OFF; real room entries reset saved studio OFF and dispose listeners');
