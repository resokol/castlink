const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
for (const ext of ['.ts', '.tsx']) Module._extensions[ext] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
let cursor = 0, hooks = [], effects = [], pathname = '/studio', interval;
const react = {
  useRef(initial) { const i = cursor++; return hooks[i] ||= { current: initial }; },
  useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
  useCallback(callback, deps) { const i = cursor++; const old = hooks[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) hooks[i] = { callback, deps }; return hooks[i].callback; },
  useEffect(effect, deps) { const i = cursor++; const old = hooks[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) effects.push(() => { old?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; }); },
};
process.env.NEXT_PUBLIC_APP_VERSION = 'release-a';
const originalLoad = Module._load;
Module._load = function(name, ...rest) {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }) };
  if (name === 'next/navigation') return { usePathname: () => pathname };
  if (name === '@/lib/app-update') return require('../lib/app-update.ts');
  return originalLoad.call(this, name, ...rest);
};
const { AppUpdateNotice } = require('../components/AppUpdateNotice.tsx');
Module._load = originalLoad;
const listeners = new Map(), navigations = [], requests = [];
global.window = { location: { href: 'https://studio.example/studio?room=test', host: 'studio.example', replace: url => navigations.push(url) }, addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
global.document = { visibilityState: 'visible', addEventListener: (key, fn) => listeners.set(key, fn), removeEventListener: key => listeners.delete(key) };
global.setInterval = fn => { interval = fn; return 1; }; global.clearInterval = () => { interval = undefined; };
let serverVersion = 'release-a', offline = false;
global.fetch = async (url, options) => { requests.push({ url, options }); if (offline) throw Error('offline'); return { ok: true, json: async () => ({ version: serverVersion }) }; };
const settle = () => new Promise(resolve => setImmediate(resolve));
function render() { cursor = 0; const tree = AppUpdateNotice(); while (effects.length) effects.shift()(); return tree; }
function nodes(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
function button(tree, text) { return nodes(tree).find(node => node.type === 'button' && node.props.children === text); }
(async () => {
  render(); await settle(); let tree = render();
  assert.ok(!button(tree, 'Обновить приложение'));
  assert.equal(requests[0].options.cache, 'no-store');
  serverVersion = 'release-b'; interval(); await settle(); tree = render();
  assert.ok(button(tree, 'Обновить приложение'));
  assert.deepEqual(navigations, [], 'background detection must never interrupt an active room');
  offline = true; button(tree, 'Проверить обновления').props.onClick(); await settle(); tree = render();
  assert.ok(button(tree, 'Обновить приложение'), 'network failure preserves known available update');
  button(tree, 'Обновить приложение').props.onClick();
  assert.equal(navigations.length, 1); assert.equal(new URL(navigations[0]).searchParams.get('_update'), 'release-b');
  assert.equal(new URL(navigations[0]).searchParams.get('room'), 'test');
  pathname = '/output/guest-test'; assert.equal(render(), null);
  assert.equal(interval, undefined); assert.equal(listeners.size, 0, 'clean outputs have no update overlay or polling');
  console.log('PASS: background detection without reload, explicit refresh, offline handling, output exclusion, listener cleanup');
})().catch(e => { console.error(e); process.exitCode = 1; });
