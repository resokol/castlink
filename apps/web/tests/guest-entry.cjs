require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
let cursor = 0, hooks = [], effects = [];
let searchParams = new URLSearchParams();
const react = {
  useState(initial) { const state = hooks, i = cursor++; if (!(i in state)) state[i] = initial; return [state[i], value => { state[i] = typeof value === 'function' ? value(state[i]) : value; }]; },
  useEffect(effect, deps) { const state = hooks, i = cursor++; const old = state[i]; if (!old || deps.some((d, j) => d !== old.deps[j])) effects.push(() => { old?.cleanup?.(); state[i] = { deps, cleanup: effect() }; }); },
};
const originalLoad = Module._load;
Module._load = function(name, ...rest) {
  if (name === './GuestServerPicker') return { GuestServerPicker: () => null };
  if (name === 'react') return react;
  if (name === 'next/navigation') return { useSearchParams: () => searchParams };
  if (name === '@/components/GuestAccessGate') return { GuestAccessGate };
  if (name === 'react/jsx-runtime') return { jsx: (type, props) => ({ type, props }), jsxs: (type, props) => ({ type, props }), Fragment: 'fragment' };
  return originalLoad.call(this, name, ...rest);
};
const { GuestAccessGate } = require('../components/GuestAccessGate.tsx');
// Exercise the production wrapper without loading unrelated LiveKit/media components.
const pagePath = require.resolve('../app/room/page.tsx');
const pageSource = ts.createSourceFile(pagePath, fs.readFileSync(pagePath, 'utf8'), ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const protectedRoom = pageSource.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'ProtectedRoom');
assert.ok(protectedRoom, 'production ProtectedRoom exists');
const wrapperModule = new Module(pagePath, module);
wrapperModule.paths = module.paths;
wrapperModule._compile(ts.transpileModule(`const { useState, useEffect } = require('react');
const { useSearchParams } = require('next/navigation');
const { useI18n } = require('@/components/I18nProvider');
const { GuestAccessGate } = require('@/components/GuestAccessGate');
${protectedRoom.getText(pageSource)}
exports.ProtectedRoom = ProtectedRoom;`, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX } }).outputText, pagePath);
const { ProtectedRoom } = wrapperModule.exports;
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
  const gateFetch = global.fetch;
  let completeInvite;
  global.fetch = (url, options) => {
    requests.push({ url, body: JSON.parse(options.body), signal: options.signal });
    return new Promise(resolve => { completeInvite = () => resolve({ ok: true, json: async () => ({ allowed: true }) }); });
  };
  const parentHooks = [];
  function renderProtected() {
    const gateHooks = hooks;
    hooks = parentHooks; cursor = 0;
    const result = ProtectedRoom();
    while (effects.length) effects.shift()();
    hooks = gateHooks;
    return result;
  }
  window.location.href = 'https://studio.example/room?studioId=studio-default&name=locked#invite=valid-invite';
  window.history.replaceState = (_a, _b, url) => {
    window.location.href = new URL(url, window.location.href).href;
    history.push(window.location.href);
    // Next's History API integration refreshes useSearchParams after sanitization.
    searchParams = new URL(window.location.href).searchParams;
  };
  searchParams = new URL(window.location.href).searchParams;
  renderProtected();
  let wrapper = renderProtected();
  props = { ...wrapper.props, children: room => { entered.push(room); return 'name-and-devices'; } };
  render();
  wrapper = renderProtected();
  props = { ...wrapper.props, children: props.children };
  render();
  assert.equal(requests.length, 1, 'sanitization does not restart the invite request');
  assert.equal(requests[0].signal.aborted, false, 'sanitization must not abort the in-flight invite authorization');
  assert.equal(props.invite, 'valid-invite', 'wrapper retains the captured fragment after URL sanitization');
  assert.equal(new URL(window.location.href).hash, '', 'secret fragment is removed from the browser URL');
  completeInvite(); await settle(); tree = render();
  assert.deepEqual(entered, ['locked'], 'fragment invite reaches name/device entry after server authorization');
  global.fetch = gateFetch;
  window.location.href += '#invite=invalid-invite';
  searchParams = new URL(window.location.href).searchParams;
  renderProtected(); wrapper = renderProtected();
  props = { ...wrapper.props, children: props.children };
  render(); await settle(); tree = render();
  assert.equal(props.invite, 'invalid-invite', 'a replacement fragment overrides the captured invitation');
  assert.equal(nodes(tree).filter(n => n.type === 'input').length, 2, 'invalid replacement cannot retain authorized entry');
  searchParams = new URLSearchParams('studioId=studio-default&name=other');
  assert.equal(renderProtected().props.invite, '', 'room navigation must not pass the previous invite to the new room');
  wrapper = renderProtected();
  assert.equal(wrapper.props.invite, '', 'captured invite cannot leak to another room');
  searchParams = new URLSearchParams('studioId=studio-other&name=locked');
  assert.notEqual(renderProtected().type, GuestAccessGate, 'studio navigation must not render the previous entry for the new studio');
  wrapper = renderProtected();
  assert.equal(wrapper.props.invite, '', 'captured invite cannot leak to another studio');
  reset();
  // Reconcile the gate as React does: a parent fallback unmounts all child hooks.
  function renderEntry() {
    const parent = renderProtected();
    if (parent.type !== GuestAccessGate) {
      for (const hook of hooks) hook?.cleanup?.();
      hooks = [];
      return parent;
    }
    props = { ...parent.props, children: room => { entered.push(room); return 'name-and-devices'; } };
    return render();
  }
  for (const initialName of ['', 'original-room']) {
    parentHooks.length = 0;
    window.location.href = `https://studio.example/room?studioId=studio-default${initialName ? `&name=${initialName}` : ''}`;
    searchParams = new URL(window.location.href).searchParams;
    renderEntry(); tree = renderEntry();
    nodes(tree).find(n => n.type === 'input' && !n.props.type).props.onChange({ target: { value: 'locked' } });
    nodes(tree).find(n => n.type === 'input' && n.props.type === 'password').props.onChange({ target: { value: 'correct-password' } });
    tree = renderEntry();
    await nodes(tree).find(n => n.type === 'form').props.onSubmit({ preventDefault() {} });
    renderEntry(); tree = renderEntry();
    assert.equal(nodes(tree).filter(n => n.type === 'input').length, 0, `successful manual password entry survives name URL update from '${initialName}'`);
    assert.ok(entered.includes('locked'), 'server-authorized manual entry reaches name/device stage');
    assert.equal(new URL(window.location.href).searchParams.get('name'), 'locked');
    reset();
  }
  console.log('PASS: two-field guest entry, password/invite authorization, fragment sanitization without aborted auth, room/studio isolation and manual password URL transitions');
})().catch(e => { console.error(e); process.exitCode = 1; });
