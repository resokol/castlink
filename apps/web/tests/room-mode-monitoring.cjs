const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const { RoomEvent } = require('livekit-client');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
let cursor = 0, hooks = [], effects = [];
const react = {
  useRef(initial) { const i = cursor++; return hooks[i] ||= { current: initial }; },
  useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
  useCallback(callback, deps) { const i = cursor++; const old = hooks[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) hooks[i] = { callback, deps }; return hooks[i].callback; },
  useEffect(effect, deps) { const i = cursor++; const old = hooks[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) effects.push(() => { old?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; }); },
};
const originalLoad = Module._load;
Module._load = function(name, ...rest) { return name === 'react' ? react : originalLoad.call(this, name, ...rest); };
const { usePersonalMonitoring } = require('../lib/personal-monitoring.ts');
Module._load = originalLoad;
global.localStorage = { getItem: () => JSON.stringify({ 'guest-b': { audio: false, video: false, volume: 25 } }), setItem() {} };
function participant(identity) {
  const audio = new EventEmitter(); audio.setVolume = value => { audio.volume = value; };
  const pubs = ['audio', 'video'].map(kind => ({ kind, isDesired: true, isSubscribed: true, track: kind === 'audio' ? audio : {}, setSubscribed(v) { this.isDesired = v; this.isSubscribed = v; } }));
  return { identity, trackPublications: new Map(pubs.map(p => [p.kind, p])), audio, pubs };
}
const studio = participant('studio-panel-a'), guest = participant('guest-a'), mutedGuest = participant('guest-b');
const room = new EventEmitter(); room.remoteParticipants = new Map([studio, guest, mutedGuest].map(p => [p.identity, p])); room.startAudio = async () => {};
function render(mode) { cursor = 0; const result = usePersonalMonitoring(room, 'test', mode); while (effects.length) effects.shift()(); return result; }
let state = render(false);
assert.equal(guest.audio.volume, 1); assert.equal(mutedGuest.audio.volume, 0); assert.equal(mutedGuest.pubs[1].isDesired, false);
state = render(true);
assert.equal(guest.audio.volume, 0); assert.ok(guest.pubs.every(p => !p.isDesired));
assert.equal(studio.audio.volume, 1); assert.ok(studio.pubs.every(p => p.isDesired));
state.change('guest-a', { audio: true, video: true, volume: 90 });
assert.equal(guest.audio.volume, 0); assert.ok(guest.pubs.every(p => !p.isDesired), 'personal controls cannot override studio-only mode');
const late = participant('guest-late'); room.remoteParticipants.set(late.identity, late); room.emit(RoomEvent.TrackPublished);
assert.equal(late.audio.volume, 0); assert.ok(late.pubs.every(p => !p.isDesired), 'new guests are also blocked');
state = render(false);
assert.equal(guest.audio.volume, .9); assert.ok(guest.pubs.every(p => p.isDesired));
assert.equal(mutedGuest.audio.volume, 0); assert.equal(mutedGuest.pubs[1].isDesired, false, 'saved personal video mute survives mode changes');
for (const hook of hooks) hook?.cleanup?.();
assert.equal(room.eventNames().length, 0);
console.log('PASS: studio-only audio/video, late guests, personal controls, restored preferences, cleanup');
