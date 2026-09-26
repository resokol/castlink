const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
let cursor = 0, hooks = [], effects = [];
const react = {
  useState(initial) { const i = cursor++; if (!(i in hooks)) hooks[i] = initial; return [hooks[i], value => { hooks[i] = typeof value === 'function' ? value(hooks[i]) : value; }]; },
  useEffect(effect, deps) { const i = cursor++; const old = hooks[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) effects.push(() => { old?.cleanup?.(); hooks[i] = { deps, cleanup: effect() }; }); },
};
const originalLoad = Module._load;
Module._load = function(name, ...rest) {
  if (name === 'react') return react;
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
  return originalLoad.call(this, name, ...rest);
};
const { GuestAccessGate } = require('../components/GuestAccessGate.tsx');
Module._load = originalLoad;
const requests = [], history = [], entered = [];
global.window = { location: { href: 'https://studio.example/room?name=locked' }, history: { replaceState: (_a, _b, url) => history.push(url.toString()) } };
global.fetch = async (url, options) => {
  const body = options.body ? JSON.parse(options.body) : null; requests.push({ url, body });
  const ok = body?.invite === 'valid-invite' || body?.password === 'correct-password';
  return { ok, json: async () => ok ? { allowed: true } : { error: 'Неверный пароль', allowed: false } };
};
let props = { initialRoom: 'locked', invite: '', resume: false, children: room => { entered.push(room); return 'name-and-devices'; } };
function render() { cursor = 0; const tree = GuestAccessGate(props); while (effects.length) effects.shift()(); return tree; }
function nodes(node) { if (!node || typeof node !== 'object') return []; if (Array.isArray(node)) return node.flatMap(nodes); return [node, ...nodes(node.props?.children)]; }
function reset() { for (const hook of hooks) hook?.cleanup?.(); cursor = 0; hooks = []; effects = []; requests.length = 0; entered.length = 0; }
const settle = () => new Promise(resolve => setImmediate(resolve));
(async () => {
  let tree = render();
  assert.equal(nodes(tree).filter(n => n.type === 'input').length, 2, 'room and password fields shown together');
  assert.equal(requests.length, 0, 'normal entry does not silently trust a cached studio/guest session');
  nodes(tree).find(n => n.type === 'input' && n.props.type === 'password').props.onChange({ target: { value: 'wrong-password' } });
  tree = render(); await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); tree = render();
  assert.equal(entered.length, 0); assert.ok(nodes(tree).some(n => n.props?.role === 'alert'));
  assert.equal(requests.at(-1).body.password, 'wrong-password');
  nodes(tree).find(n => n.type === 'input' && n.props.type === 'password').props.onChange({ target: { value: 'correct-password' } });
  tree = render(); await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} }); render();
  assert.deepEqual(entered, ['locked']); assert.equal(new URL(history.at(-1)).searchParams.get('name'), 'locked');
  reset(); props = { ...props, invite: 'valid-invite' };
  render(); await settle(); tree = render();
  assert.equal(nodes(tree).filter(n => n.type === 'input').length, 0, 'valid invitation bypasses password form');
  assert.deepEqual(entered, ['locked']); assert.equal(requests[0].body.invite, 'valid-invite'); assert.equal(requests[0].body.password, undefined);
  props = { ...props, initialRoom: 'other', invite: 'invalid-invite' };
  render(); await settle(); tree = render();
  assert.equal(nodes(tree).filter(n => n.type === 'input').length, 2, 'invalid replacement invite cannot retain previous authorized room');
  reset();
  console.log('PASS: two-field guest entry, no cookie auto-bypass, wrong/correct passwords, invitation bypass and invalid-link fallback');
})().catch(e => { console.error(e); process.exitCode = 1; });
