const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const vm = require('node:vm');
const { load } = require('./load-typescript.cjs');
let db, updates = 0, effect, previousDeps, cleanup, nextId = 0;
const frames = new Map();
const original = { requestAnimationFrame: global.requestAnimationFrame, cancelAnimationFrame: global.cancelAnimationFrame, AudioContext: global.AudioContext };
global.requestAnimationFrame = callback => { const id = ++nextId; frames.set(id, callback); return id; };
global.cancelAnimationFrame = id => frames.delete(id);
global.AudioContext = class { constructor() { throw Error('meter must reuse the existing audio graph'); } };
try {
  const { StudioReturnAudioMeter } = load('../components/StudioReturnAudioMeter.tsx', {
    react: { ...require('react'), useState(initial) { if (db === undefined) db = initial; return [db, value => { db = value; updates++; }]; },
      useEffect(callback, deps) { if (!previousDeps || deps.some((value, index) => value !== previousDeps[index])) { cleanup?.(); effect = callback; previousDeps = deps; } } },
    './AudioMeter': { AudioMeter: () => null },
  });
  let amplitude = .1, reads = 0;
  const analyser = { fftSize: 4, context: { state: 'running' }, getFloatTimeDomainData(samples) { reads++; samples.fill(amplitude); } };
  const analyserRef = { current: analyser };
  const render = (muted, vertical = false) => { const result = StudioReturnAudioMeter({ analyserRef, muted, label: 'Studio', vertical }); if (effect) { const run = effect; effect = undefined; cleanup = run(); } return result; };
  const frame = () => { const callbacks = [...frames.values()]; frames.clear(); callbacks.forEach(callback => callback()); };
  render(false);
  const before = updates;
  for (let i = 0; i < 60; i++) { amplitude = i % 2 ? .1 : .2; frame(); }
  assert.equal(updates - before, 60, 'only the small component state receives animation updates');
  assert.equal(render(false).props.db, -20);
  const beforeOrientation = reads, scheduledFrames = [...frames.keys()];
  assert.equal(render(false, true).props.vertical, true);
  assert.equal(reads, beforeOrientation, 'changing meter orientation does not sample or replace the capture graph');
  assert.deepEqual([...frames.keys()], scheduledFrames, 'orientation keeps the existing animation owner');
  const beforeMute = reads;
  assert.equal(render(true).props.db, -90, 'mute is reflected immediately'); frame();
  assert.equal(reads, beforeMute, 'muted meter does not sample the graph');
  render(false); analyser.context.state = 'suspended'; frame(); assert.equal(db, -90);
  analyserRef.current = { fftSize: 8, context: { state: 'running' }, getFloatTimeDomainData(samples) { assert.equal(samples.length, 8); samples.fill(.5); } };
  frame(); assert.equal(db, -6, 'a replacement capture is read without rebuilding the graph');
  analyserRef.current = undefined; frame(); assert.equal(db, -90);
  const late = [...frames.values()][0]; cleanup(); const afterStop = updates; late();
  assert.equal(updates, afterStop); assert.equal(frames.size, 0, 'unmount cancels animation and late callbacks');

  // Execute the exact diagnostic callback used by the primary Studio connection.
  const source = ts.createSourceFile('StudioWorkspace.tsx', fs.readFileSync(`${__dirname}/../components/StudioWorkspace.tsx`, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let diagnostic;
  (function visit(node) { if (ts.isCallExpression(node) && node.expression.getText(source) === 'startRoomTelemetry') diagnostic = node.arguments[6]; ts.forEachChild(node, visit); })(source);
  assert.ok(diagnostic, 'primary Studio supplies its actual capture diagnostic');
  const ref = current => ({current});
  const sourceVideo = {readyState: 'live', muted: false, enabled: true}, sourceAudio = {...sourceVideo};
  const publications = new Map([['camera', {track: {}}], ['microphone', {track: {}}]]);
  const context = { returnAudioContextRef: ref({state: 'running'}), onAirRef: ref(true), returnActiveRef: ref(true), videoSourceRef: ref('camera'), captureInputsRef: ref({source: 'camera'}),
    returnRawStreamRef: ref({ getVideoTracks: () => [sourceVideo], getAudioTracks: () => [sourceAudio] }),
    room: {localParticipant: {getTrackPublication: source => publications.get(source)}}, Track: {Source: {Camera: 'camera', Microphone: 'microphone'}} };
  const sample = vm.runInNewContext(ts.transpileModule(`(${diagnostic.getText(source)})`, {compilerOptions: {target: ts.ScriptTarget.ES2022}}).outputText, context);
  let result = JSON.parse(JSON.stringify(sample()));
  assert.deepEqual(result.video, {present: true, readyState: 'live', muted: false, enabled: true}); assert.equal(result.videoPublished, true);
  context.videoSourceRef.current = 'black';
  assert.equal(sample().source, 'camera', 'a pending or failed source switch reports the committed capture source');
  context.captureInputsRef.current = {source: 'black'};
  assert.equal(sample().source, 'black', 'a committed replacement updates the diagnostic source');
  sourceVideo.readyState = 'ended'; sourceAudio.muted = true; context.returnAudioContextRef.current.state = 'interrupted';
  result = sample(); assert.equal(result.video.readyState, 'ended'); assert.equal(result.audio.muted, true); assert.equal(result.audioContextState, 'interrupted');
  publications.clear(); context.returnRawStreamRef.current = undefined; context.captureInputsRef.current = undefined; context.videoSourceRef.current = 'camera';
  result = sample(); assert.equal(result.video.present, false); assert.equal(result.video.readyState, null); assert.equal(result.videoPublished, false);
  assert.equal(result.source, 'camera', 'without a capture the diagnostic reports the selected source');
  console.log('PASS: studio return meter owns animation, mute/replacement/disposal preserve capture; actual studio diagnostic reports source and publication state');
} finally { cleanup?.(); Object.assign(global, original); }
