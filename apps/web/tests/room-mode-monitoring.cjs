require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const { RoomEvent, Track } = require('livekit-client');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
let cursor = 0, hooks = [], effects = [];
const react = {
  useSyncExternalStore(subscribe, getSnapshot) { const i = cursor++; hooks[i]?.cleanup?.(); hooks[i] = { cleanup: subscribe(() => {}) }; return getSnapshot(); },
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
  const pubs = ['audio', 'video'].map(kind => ({ kind, source: kind === 'audio' ? Track.Source.Microphone : Track.Source.Camera, isDesired: true, isSubscribed: true, track: kind === 'audio' ? audio : {}, setSubscribed(v) { this.isDesired = v; this.isSubscribed = v; } }));
  return { identity, trackPublications: new Map(pubs.map(p => [p.kind, p])), getTrackPublication: source => pubs.find(publication => publication.source === source), audio, pubs };
}
const studio = participant('studio-panel-a'), guest = participant('guest-a'), mutedGuest = participant('guest-b');
const room = new EventEmitter(); room.remoteParticipants = new Map([studio, guest, mutedGuest].map(p => [p.identity, p])); room.startAudio = async () => {};
function render(mode,gain=100) { cursor = 0; const result = usePersonalMonitoring(room, 'test', mode,undefined,false,gain); while (effects.length) effects.shift()(); return result; }
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
state=render(false,40);assert.equal(guest.audio.volume,.36,'studio output gain multiplies existing personal preferences');assert.equal(studio.audio.volume,.4);assert.equal(mutedGuest.audio.volume,0,'master output gain never overrides personal mute');state=render(true,0);assert.equal(studio.audio.volume,0);assert.equal(guest.audio.volume,0,'master output gain never bypasses studio-only isolation');
for (const hook of hooks) hook?.cleanup?.();
assert.equal(room.eventNames().length, 0);

hooks = []; effects = []; cursor = 0;
global.localStorage = { getItem: () => null, setItem() {} };
const mainStudio = participant('studio-panel-main');
const monitorRoom = new EventEmitter();
monitorRoom.remoteParticipants = new Map([[mainStudio.identity, mainStudio]]);
let audioUnlocks = 0, publishCalls = 0;
monitorRoom.startAudio = async () => { audioUnlocks++; };
monitorRoom.localParticipant = {
  trackPublications: new Map(),
  publishTrack() { publishCalls++; },
  publishData() { publishCalls++; },
};
const defaults = { 'studio-panel-main': { audio: false, video: true, volume: 100 } };
function renderListen() { cursor = 0; const result = usePersonalMonitoring(monitorRoom, 'test-listen', false, defaults); while (effects.length) effects.shift()(); return result; }
state = renderListen();
assert.equal(mainStudio.audio.volume, 0, 'studio monitor starts silent before moderator opts in');
assert.equal(mainStudio.pubs[0].isDesired, true, 'audio remains locally subscribed for an explicit listen action');
assert.equal(mainStudio.pubs[1].isDesired, true, 'main studio video remains subscribed for the preview');
state = renderListen();
assert.equal(monitorRoom.listenerCount(RoomEvent.TrackSubscribed), 1, 'stable empty defaults do not reinstall listeners on render');
state.change('studio-panel-main', { audio: true });
assert.equal(mainStudio.audio.volume, 1, 'explicit listen unmutes only the local remote-track monitor');
state.change('studio-panel-main', { video: false });
assert.equal(mainStudio.pubs[1].isDesired, false, 'moderator video control changes only its local subscription');
state.change('studio-panel-main', { video: true });
assert.equal(mainStudio.pubs[1].isDesired, true);
state.change('studio-panel-main', { volume: 35 });
assert.equal(mainStudio.audio.volume, .35, 'moderator volume is applied locally to the remote track');
assert.ok(audioUnlocks > 0, 'explicit unmute requests browser audio playback');
assert.equal(publishCalls, 0, 'moderator listen controls never publish tracks or data');
for (const hook of hooks) hook?.cleanup?.();
assert.equal(monitorRoom.eventNames().length, 0, 'remote monitoring listeners are removed on departure');
console.log('PASS: studio-only controls and moderator local listen defaults, gain, explicit audio unlock, no publication, and cleanup');

// Guest entry resets old primary-program monitoring preferences, while an
// administrator's opt-in listen default and in-session guest choices survive.
hooks=[];effects=[];cursor=0;
const stored=new Map([['studiolink-monitor:guest-entry',JSON.stringify({'studio-panel-main':{audio:false,video:false,volume:0},'studio-panel-backup':{audio:false,video:false,volume:25},'guest-other':{audio:false,video:false,volume:30}})]]);
global.localStorage={getItem:key=>stored.get(key)||null,setItem:(key,value)=>stored.set(key,value)};
function guestEntryRoom(){const entryRoom=new EventEmitter();const primary=participant('studio-panel-main'),backup=participant('studio-panel-backup'),other=participant('guest-other');entryRoom.remoteParticipants=new Map([primary,backup,other].map(p=>[p.identity,p]));entryRoom.startAudio=async()=>{};return{entryRoom,primary,backup,other};}
let entry=guestEntryRoom();
function renderGuestEntry(){cursor=0;const result=usePersonalMonitoring(entry.entryRoom,'guest-entry',false,undefined,false,100,true);while(effects.length)effects.shift()();return result;}
state=renderGuestEntry();assert.equal(entry.primary.audio.volume,1,'fresh guest entry hears Studio Return despite a saved OFF preference');assert.equal(entry.primary.pubs[1].isDesired,true,'fresh guest entry sees Studio Return despite a saved OFF preference');assert.equal(entry.backup.audio.volume,1,'all studio-panel program identities reset on entry');assert.equal(entry.backup.pubs[1].isDesired,true);assert.equal(entry.other.audio.volume,0,'other guests retain their saved personal mute');assert.equal(entry.other.pubs[1].isDesired,false);
state.change('studio-panel-main',{audio:false,video:false,volume:20});state=renderGuestEntry();entry.entryRoom.emit(RoomEvent.Reconnected);assert.equal(entry.primary.audio.volume,0,'manual OFF remains valid for the current entry after a reconnect');assert.equal(entry.primary.pubs[1].isDesired,false);const previousEntry=entry;entry=guestEntryRoom();state=renderGuestEntry();assert.equal(entry.primary.audio.volume,1,'a new guest entry enables Studio Return again');assert.equal(entry.primary.pubs[1].isDesired,true);assert.equal(previousEntry.entryRoom.eventNames().length,0,'entry replacement cleans old monitoring listeners');for(const hook of hooks)hook?.cleanup?.();
console.log('PASS: guest entry resets only Studio Return saved OFF preferences; current-entry OFF/reconnect and other-guest preferences remain intact');
