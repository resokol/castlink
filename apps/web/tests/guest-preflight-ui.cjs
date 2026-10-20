require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
for (const extension of ['.ts', '.tsx']) Module._extensions[extension] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, file);
Module._extensions['.css'] = module => { module.exports = { default: new Proxy({}, { get: (_, key) => key }) }; };
let cursor = 0, hooks = [], effects = [];
const react = {
  useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = typeof initial === 'function' ? initial() : initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
  useRef(initial) { const i = cursor++; return hooks[i] ||= { current: initial }; },
  useEffect(effect, deps) { const i = cursor++, old = hooks[i]; if (!old || deps.some((value, j) => value !== old.deps[j])) effects.push(() => { old?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; }); },
};
const component = () => null;
const original = Module._load;
Module._load = function(name, ...args) {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  if (name === './EntryShell') return { EntryShell: component };
  if (name === './MediaDevicePicker') return { MediaDevicePicker: component };
  if (name === './AudioMeter') return { AudioMeter: component };
  if (name === '@/lib/guest-entry-settings') return require('../lib/guest-entry-settings.ts');
  if (name === '@/lib/guest-media') return require('../lib/guest-media.ts');
  if (name === '@/lib/guest-video-codec') return { guestVideoCodec: () => 'av1' };
  if (name === '@/lib/guest-audio') return { guestAudioProfile: () => 'speech' };
  if (name === '@/lib/audio-meter') return { METER_FLOOR_DB: -90, observePcmTrack: () => () => {} };
  if (name === '@/lib/audio-device-test') return { startSpeakerTest: () => { throw Error('not requested'); } };
  return original.call(this, name, ...args);
};
const { GuestAvCheck } = require('../components/GuestAvCheck.tsx');
Module._load = original;
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const render = props => { cursor = 0; const tree = GuestAvCheck(props); while (effects.length) effects.shift()(); return tree; };
const reset = () => { for (const hook of hooks) hook?.cleanup?.(); hooks = []; effects = []; };
global.window = { isSecureContext: true };
Object.defineProperty(global, 'navigator', { configurable: true, value: { mediaDevices: { enumerateDevices: async () => [] } } });
const joins = [];
const props = { name: 'Анна', roomName: 'Вечерний эфир', entrySettings: { audioOnly: true, startMuted: true, noGuestAudio: false }, onJoin: (...args) => joins.push(args) };
(async () => {
  let tree = render(props);
  assert.ok(nodes(tree).some(node => node.type === 'h1' && node.props.children === 'Проверьте себя перед входом'), 'the preflight has one clear page heading');
  assert.ok(nodes(tree).some(node => node.type === 'h2' && node.props.children === 'Ваше имя и устройства'), 'name and devices share the same panel');
  const name = nodes(tree).find(node => node.type === 'input' && node.props.name === 'displayName');
  assert.ok(name, 'caster name is editable in the device panel');
  assert.equal(name.props.value, 'Анна');
  name.props.onChange({ target: { value: '   ' } });
  tree = render(props);
  let join = nodes(tree).find(node => node.type === 'button' && node.props.children === 'Подключиться к студии');
  assert.equal(join.props.disabled, true, 'blank names cannot request a session');
  nodes(tree).find(node => node.type === 'input' && node.props.name === 'displayName').props.onChange({ target: { value: '  София  ' } });
  tree = render(props);
  assert.equal(joins.length, 0, 'editing a name never joins or authorizes in the background');
  assert.equal(nodes(tree).find(node => node.type === 'details').props.open, undefined, 'advanced checks are collapsed initially');
  join = nodes(tree).find(node => node.type === 'button' && node.props.children === 'Подключиться к студии');
  join.props.onClick();
  await new Promise(setImmediate);
  assert.equal(joins.length, 1, 'only the explicit connect action joins');
  assert.equal(joins[0][1], 'София', 'the confirmed name is trimmed and passed with the selected devices');
  assert.equal(joins[0][0].audioEnabled, false);
  assert.equal(joins[0][0].videoEnabled, false, 'room off preferences survive the merged preflight');
  reset();
  const { preflightMessage } = require('../lib/i18n/entry-preflight.ts');
  assert.equal(preflightMessage('en', 'Подключиться к студии'), 'Connect to studio');
  assert.equal(preflightMessage('zh-CN', 'Подключиться к студии'), '连接演播室');
  console.log('PASS: merged editable name/devices, explicit connect, trimmed name, disabled inputs, collapsed diagnostics and three locales');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(reset);
