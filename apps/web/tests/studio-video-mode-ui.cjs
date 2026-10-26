require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const ts = require('typescript');
const jsx = require('react/jsx-runtime');
const sourceFile = require.resolve('../components/StudioWorkspace.tsx');
const source = ts.createSourceFile(sourceFile, fs.readFileSync(sourceFile, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
function initializer(name) {
  let found;
  function visit(node) { if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) found = node.initializer.getText(source); ts.forEachChild(node, visit); }
  visit(source); assert.ok(found, `real ${name} function exists`); return found;
}
function load(file, imports) {
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText;
  vm.runInNewContext(code, { module, exports: module.exports, require(name) { if (name === '@/components/I18nProvider') return require('./i18n-fixture.cjs'); if (name.startsWith('@/lib/i18n/')) return require(name); if (name in imports) return imports[name]; throw Error(name); }, RTCRtpSender: { getCapabilities: () => ({ codecs: [{ mimeType: 'video/VP8' }, { mimeType: 'video/H264' }] }) }, DOMException });
  return module.exports;
}
const quality = load(require.resolve('../lib/video-quality.ts'), { 'livekit-client': { Track: { Source: { Camera: 'camera' } } } });
const { StudioVideoModeControls } = load(require.resolve('../components/StudioVideoModeControls.tsx'), { 'react/jsx-runtime': jsx, '@/lib/video-quality': quality });
const { StudioReturnStatsPanel } = load(require.resolve('../components/StudioReturnStatsPanel.tsx'), { 'react/jsx-runtime': jsx, '@/lib/video-quality': quality, '@/components/StudioVideoModeControls': { StudioVideoModeControls } });
function elements(tree) { return !tree || typeof tree !== 'object' ? [] : Array.isArray(tree) ? tree.flatMap(elements) : [tree, ...elements(tree.props?.children)]; }
for (const codec of [undefined, 'vp8', 'vp9', 'h264', 'av1', 'h265']) {
  const select = elements(StudioVideoModeControls({videoCodec:codec,disabled:false})).find(node => node.type === 'select' && node.props['aria-label'] === 'Видеокодек студии');
  assert.equal(select.props.value,codec || 'h264','default H264 must not override an explicit current selection');
}
const props = { role: 'primary', statusText: '', hasSample: false, stats: {}, bitratePoints: '', historyLength: 0, clientReady: true, airBusy: false, fps: 60, bitrate: 12000, onQualityChange() {} };
for (const state of [{}, { onAir: true }, { airBusy: true }, { clientReady: false }]) {
  const tree = StudioReturnStatsPanel({ ...props, ...state });
  const mode = elements(tree).find(e => e.type === StudioVideoModeControls);
  assert.equal(mode.props.disabled, Boolean(state.onAir || state.airBusy || state.clientReady === false));
  const options = elements(tree).filter(e => e.type === 'option').map(e => e.props.value);
  for (const bitrate of [16000, 20000, 25000]) assert.ok(options.includes(bitrate));
}
const choices = [];
const measured = { resolution: '1920×1080', videoKbps: 6600, audioKbps: 128, fps: 60 };
const streamProps = { ...props, hasSample: true, stats: measured, graphSourceMode: 'auto', graphSource: 'watch', mainView: { status: 'live', sample: { ...measured, videoKbps: 0 } }, watchView: { status: 'live', sample: measured }, onGraphSourceChange: value => choices.push(value) };
const streamElements = elements(StudioReturnStatsPanel(streamProps));
const selector = streamElements.find(e => e.type === 'select' && e.props['aria-label'] === 'Источник измерений потока');
assert.equal(selector, undefined, 'the requested measurement selector is removed');
assert.equal(streamElements.filter(e => e.props?.className === 'return-stat-grid').length, 1, 'main/watch do not duplicate controls or stats grids');
const textOf = tree => !tree ? '' : typeof tree === 'string' || typeof tree === 'number' ? String(tree) : Array.isArray(tree) ? tree.map(textOf).join('') : textOf(tree.props?.children);
const measuredText = textOf(StudioReturnStatsPanel(streamProps));
assert.ok(measuredText.includes('1920×1080') && measuredText.includes('6600 кбит/с'), 'actual selected-source measurements remain present');
assert.doesNotMatch(measuredText, /График:|Измерено · В комнату:|Измеренный видеобитрейт основной комнаты: 0 кбит\/с/, 'only the requested redundant source paragraphs are removed');
const missingText = textOf(StudioReturnStatsPanel({ ...streamProps, hasSample: false, graphSourceMode: 'watch', watchView: { status: 'stale' } }));
assert.ok(missingText.includes('—') && !missingText.includes('6600 кбит/с'), 'missing selected-source measurements stay unavailable rather than replaying a stale value');
assert.ok(elements(StudioVideoModeControls({videoCodec:'av1', disabled:false})).some(e => e.type === 'option' && e.props.value === 'av1'), 'AV1 is selectable');
for (const supported of [false,true]) {
  const tree=elements(StudioVideoModeControls({videoCodec:'h265',disabled:false,h265Supported:supported}));
  const option=tree.find(e=>e.type==='option'&&e.props.value==='h265');
  assert.ok(option,'H265 option exists even when unavailable');
  assert.equal(option.props.disabled,!supported,'capability belongs to sender, not the controlling browser');
}
const patches = [];
const controls = elements(StudioVideoModeControls({ disabled: false, onChange: patch => patches.push(patch) })).filter(e => e.type === 'select');
assert.deepEqual(controls.map(e => e.props.value), ['h264', 'simulcast']);
controls[0].props.onChange({ target: { value: 'h264' } }); controls[1].props.onChange({ target: { value: 'single' } });
assert.equal(patches[0].videoCodec, 'h264'); assert.equal(patches[1].simulcast, false);

function harness() {
  const calls = [], errors = [];
  const ref = current => ({ current });
  const track = { readyState: 'live' };
  const context = {
    Error,studioControlErrorRef:ref(''),previewRestoreReady:true,returnAudioContextRef:ref(undefined),transferLeavingRef:ref(false),
    console: { error() {} }, studioRole: 'primary', videoModeBusyRef: ref(false), previewReadyRef: ref(true), airBusyRef: ref(false), onAirRef: ref(false),
    airRequestQueueRef: ref(Promise.resolve()), returnStreamRef: ref({ getVideoTracks: () => [track], getAudioTracks: () => [track] }),
    returnVideoCodecRef: ref('h264'), returnSimulcastRef: ref(false), returnBitrateRef: ref(25000), returnFpsRef: ref(60), returnGainRef: ref(100),
    returnPublishedRef: ref({}), returnPublicationRef: ref({}), returnSenderStatsRef: ref({}), createStudioSenderStatsState: () => ({ video: new Map(), audio: new Map() }), refreshRef: ref(() => {}),
    setReturnActive() {}, setOnAirStatus() {}, setAirBusy() {}, setOnAir() {}, setStudioControlError: e => errors.push(e),
    ...quality, Track: { Source: { Camera:'camera', Microphone: 'microphone' } }, AudioPresets: { musicHighQualityStereo: {} },
    room: { localParticipant: { trackPublications: new Map(), async publishTrack(track, options) { calls.push(['publish', options]); return { videoTrack: { codec: options.videoCodec }, track }; }, async unpublishTrack() { calls.push(['unpublish']); } } },
    persistControlPatch: async patch => { calls.push(['persist', patch]); },
    applyingControlRef: ref(false), deviceRevisionRef: ref(0), pendingOnAirRef: ref(null), studioRoleRef: ref('primary'), appliedRevisionRef: ref(0), returnActiveRef: ref(true),
    stopped: false, changeVideoMode: async patch => { assert.equal(context.onAirRef.current, false, 'OFF AIR applies before conflicting video mode'); calls.push(['mode', patch]); },
    changeQuality() {}, changeGain() {}, changePreview(value) { calls.push(["preview", value]); },
  };
  context.connectedStudioRoomRef=ref(context.room);const module = { exports: {} }; context.module = module;
  const code = ts.transpileModule(`const toggleOnAir = ${initializer('toggleOnAir')}; const applyDesired = ${initializer('applyDesired')}; module.exports = {toggleOnAir,applyDesired};`, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText;
  vm.runInNewContext(code, context); return { context, calls, errors, ...module.exports };
}
(async () => {
  const h = harness(); let unlock;
  h.context.persistControlPatch = async patch => { h.calls.push(['persist', patch]); await new Promise(resolve => { unlock = resolve; }); };
  const pending = h.toggleOnAir(true); await new Promise(resolve => setImmediate(resolve));
  assert.equal(h.calls.length, 1, 'no publication until scoped desired state locks the mode');
  assert.equal(h.calls[0][1].onAir, true); assert.equal(h.calls[0][1].videoCodec, 'h264'); assert.equal(h.calls[0][1].simulcast, false);
  unlock(); await pending;
  assert.equal(h.calls[1][1].videoCodec, 'h264'); assert.equal(h.calls[1][1].simulcast, false); assert.equal(h.calls[1][1].videoEncoding.maxBitrate, 25_000_000);
  assert.equal(h.context.onAirRef.current, true);
  h.context.room.localParticipant.trackPublications.set('video', { source:'camera', track: {} });
  await h.applyDesired({ onAir: false, videoCodec: 'vp8', simulcast: true, fps: 60, bitrate: 25000, gain: 100, preview: true }, 7);
  assert.equal(h.context.onAirRef.current, false); assert.equal(h.context.appliedRevisionRef.current, 7); assert.equal(h.calls.at(-2)[0], 'unpublish'); assert.equal(h.calls.at(-1)[0], 'mode');
  await h.applyDesired({ preview: false }, 8);assert.equal(h.context.returnActiveRef.current,true,'stale saved preview=false does not stop automatic primary preview');assert.equal(h.calls.filter(call=>call[0]==='preview').length,0);
  const rejected = harness();
  rejected.context.persistControlPatch = async patch => { rejected.calls.push(['persist', patch]); if (patch.onAir) throw Error('mode changed concurrently'); };
  await rejected.toggleOnAir(true);
  assert.equal(rejected.calls.filter(call => call[0] === 'publish').length, 0, 'concurrent mode rejection cannot publish stale settings');
  assert.equal(rejected.calls.at(-1)[1].onAir, false, 'failed activation returns desired OFF AIR');
  assert.ok(rejected.errors.some(error => error.includes('mode changed concurrently')));
  console.log('PASS: rendered studio choices/defaults/OFF AIR locks; real main publication awaits mode lock, rejects races and applies remote OFF AIR before mode changes');
})().catch(error => { console.error(error); process.exitCode = 1; });
