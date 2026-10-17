require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
Module._extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, filename);
const { RemoteStudioDevices } = require('../components/RemoteStudioDevices.tsx');
const devices = [
  { deviceId: 'camera-studio', kind: 'videoinput', label: 'Studio camera' },
  { deviceId: 'mic-studio', kind: 'audioinput', label: 'Studio microphone' },
  { deviceId: 'speaker-studio', kind: 'audiooutput', label: 'Studio speakers' },
];
const actual = { devices, videoDeviceId: 'camera-studio', audioDeviceId: 'mic-studio', outputDeviceId: 'speaker-studio', deviceRevisionApplied: 1, preview: true };
const render = (props = {}) => renderToStaticMarkup(React.createElement(RemoteStudioDevices, { actual, online: true, desired: { deviceRevision: 1 }, onChange() {}, ...props }));
const selects = html => [...html.matchAll(/<select\b([^>]*)>(.*?)<\/select>/g)];
let controls = selects(render());
assert.equal(controls.length, 3);
assert.ok(controls.every(control => !control[1].includes('disabled')));
assert.ok(controls[0][2].includes('camera-studio') && !controls[0][2].includes('mic-studio'), 'camera offers only studio video inputs');
assert.ok(controls[1][2].includes('mic-studio') && !controls[1][2].includes('speaker-studio'), 'microphone offers only studio audio inputs');
controls = selects(render({ actual: { ...actual, onAir: true } }));
assert.ok(!controls[0][1].includes('disabled') && !controls[1][1].includes('disabled'), 'stable live camera and microphone remain selectable');
assert.ok(!controls[2][1].includes('disabled'), 'live output remains selectable');
controls = selects(render({ actual: { ...actual, airBusy: true } }));
assert.ok(controls[0][1].includes('disabled') && controls[1][1].includes('disabled'), 'lock inputs during publication transition');
for (const props of [{ online: false }, { desired: { deviceRevision: 2 } }, { actual: { ...actual, deviceBusy: true } }]) {
  assert.ok(selects(render(props)).every(control => control[1].includes('disabled')), 'offline or applying controls are disabled');
}
assert.ok(render({ actual: { ...actual, deviceError: 'Device disconnected' } }).includes('role="alert">Device disconnected'));
assert.ok(render({ actual: { ...actual, preview: false } }).includes('Захват выбранной камеры'));
console.log('PASS: remote studio device kinds, selected IDs, live hot swap and transition lock, offline/pending states and device errors');
