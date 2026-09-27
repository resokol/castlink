const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { shouldSubscribeToWatchTrack, togglePlaybackIntent, isPlaybackIntentCurrent } = require('../lib/watch-subscriptions.ts');

assert.equal(shouldSubscribeToWatchTrack('audio', false, true), false, 'video-only mode does not receive audio');
assert.equal(shouldSubscribeToWatchTrack('video', false, true), true, 'video-only mode keeps video subscribed');
assert.equal(shouldSubscribeToWatchTrack('audio', true, false), true, 'audio remains subscribed with video disabled');
assert.equal(shouldSubscribeToWatchTrack('video', true, false), false, 'audio-only mode unsubscribes video');
assert.equal(shouldSubscribeToWatchTrack('video', false, false), false, 'both controls off stays off after track republication');
assert.equal(shouldSubscribeToWatchTrack('audio', true, true), true, 'enabled choices can be re-applied after reconnect');
assert.equal(shouldSubscribeToWatchTrack('data', true, true), false, 'non-media publications are never subscribed');
const initial = { generation: 0, enabled: false };
const startPending = togglePlaybackIntent(initial);
const userTurnsOffBeforeStartCompletes = togglePlaybackIntent(startPending);
assert.equal(isPlaybackIntentCurrent(userTurnsOffBeforeStartCompletes, startPending.generation, true), false, 'late startAudio/play completion cannot override a newer off choice');
assert.equal(userTurnsOffBeforeStartCompletes.enabled, false, 'the newer off choice remains authoritative');
console.log('PASS: watch audio/video subscription choices are independent, reattach-safe, and cancel stale audio starts');
