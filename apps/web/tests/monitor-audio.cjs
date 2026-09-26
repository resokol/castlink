const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const { TrackEvent } = require('livekit-client');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { bindMonitorAudio } = require('../lib/monitor-audio.ts');
class AudioTrack extends EventEmitter {
  elements = []; saved = undefined; gain = undefined;
  setVolume(value) { this.saved = value; this.elements.forEach(el => { el.volume = value; }); if (this.gain) this.gain.value = value; }
  attach(webAudio = false) {
    const el = { volume: 1 }; this.elements.push(el);
    this.emit(TrackEvent.ElementAttached, el);
    // Matches installed SDK: gain created after event; saved zero is skipped.
    if (webAudio) this.gain = { value: 1 };
    if (this.saved) this.setVolume(this.saved);
    return el;
  }
}
(async () => {
  const broken = new AudioTrack(); broken.setVolume(0);
  assert.equal(broken.attach().volume, 1, 'reproduce SDK zero-volume regression');
  let pref = { audio: false, volume: 70 };
  const value = () => pref.audio ? pref.volume / 100 : 0;
  const track = new AudioTrack();
  const dispose = bindMonitorAudio(track, value);
  assert.equal(track.attach().volume, 0, 'late audio element must be silent immediately');
  assert.equal(track.attach(true).volume, 0);
  await Promise.resolve(); assert.equal(track.gain.value, 0, 'WebAudio must also remain silent');
  pref = { audio: true, volume: 25 };
  assert.equal(track.attach().volume, .25, 'use latest preferences, not captured mute');
  pref = { audio: true, volume: 0 };
  assert.equal(track.attach().volume, 0, 'zero slider is preserved');
  dispose();
  assert.equal(track.listenerCount(TrackEvent.ElementAttached), 0);
  assert.equal(track.listenerCount(TrackEvent.AudioPlaybackStarted), 0);
  const replacement = new AudioTrack();
  const disposeReplacement = bindMonitorAudio(replacement, value);
  assert.equal(replacement.attach().volume, 0, 'replacement track after reconnect remains silent');
  disposeReplacement();
  replacement.saved = .8;
  await Promise.resolve(); assert.equal(replacement.saved, .8, 'queued callbacks stop after cleanup');
  console.log('PASS: reconnect mute, replacement element/track, WebAudio, live volume, zero slider, listener cleanup');
})().catch(e => { console.error(e); process.exitCode = 1; });
