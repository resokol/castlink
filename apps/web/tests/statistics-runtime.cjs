require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');
let history, stateIndex = 0, localCalls = 0;
const state = [];
const original = Module._load;
Module._extensions['.tsx'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
}).outputText, file);
Module._load = function(name, ...args) {
  if (name === 'react') return { ...React, useState(initial) {
    const i = stateIndex++, value = i === 5 ? history : i in state ? state[i] : initial;
    return [value, next => { state[i] = typeof next === 'function' ? next(state[i]) : next; }];
  }, useRef: value => ({ current: value }), useEffect() {} };
  if (name === '@/lib/telemetry-types') return { mean: () => null, sumRates: () => null };
  if (name === '@/lib/stats-csv') return {};
  if (name === '@/lib/stats-report') return {};
  if (name === '@/lib/browser-runtime-diagnostics') return { localRuntimeDiagnosticReport: () => {
    localCalls++; return { schemaVersion: 1, savedAt: 123, previous: { runtime: { events: [] } } };
  } };
  return original.call(this, name, ...args);
};
const { runtimeHistoryJson, StatisticsDashboard } = require('../components/StatisticsDashboard.tsx');
const props = { roomName: 'room', identity: 'owner', studioRole: 'primary', studioClientId: 'client', studioEpoch: 1 };
const render = () => { stateIndex = 0; return StatisticsDashboard(props); };
const nodes = node => !node || typeof node !== 'object' ? [] : Array.isArray(node) ? node.flatMap(nodes) : [node, ...nodes(node.props?.children)];
const page = (samples, nextCursor = null, limited = false) => ({ from: 100, to: 200, samples, nextCursor, limited });
const respond = value => ({ ok: true, json: async () => value });

(async () => {
  const requests = [];
  const report = await runtimeHistoryJson('/api/super-admin/history?studioId=tenant&nodeId=node&room=media-room&minutes=60&role=studio&participant=owner&session=selected', async (url, options) => {
    const parsed = new URL(url, 'https://test'); requests.push(parsed);
    assert.equal(options.credentials, 'same-origin');
    return respond(requests.length === 1 ? page([{ at: 101 }], 'next', true) : page([{ at: 102 }]));
  });
  assert.equal(requests.length, 2);
  for (const request of requests) {
    for (const [key, value] of Object.entries({ studioId: 'tenant', nodeId: 'node', room: 'media-room', minutes: '60', role: 'studio', participant: 'owner', session: 'selected', diagnostics: 'runtime', limit: '2000' }))
      assert.equal(request.searchParams.get(key), value);
  }
  assert.equal(requests[0].searchParams.has('to'), false);
  assert.equal(requests[1].searchParams.get('to'), '200', 'subsequent pages use a fixed cutoff');
  assert.equal(requests[1].searchParams.get('cursor'), 'next');
  assert.deepEqual(JSON.parse(report.content).samples, [{ at: 101 }, { at: 102 }]);
  assert.equal(report.partial, false, 'a server page limit with continuation does not truncate the report');
  let samplePage = 0;
  const sampleLimit = await runtimeHistoryJson('/api/stats?to=200', async () => respond(page(Array.from({ length: 2000 }, (_, at) => ({ at })), String(++samplePage), true)));
  assert.equal(sampleLimit.count, 50000); assert.equal(sampleLimit.partial, true);
  const byteLimit = await runtimeHistoryJson('/api/stats', async () => respond(page(Array.from({ length: 12 }, () => ({ name: '中'.repeat(1024 * 1024) })))));
  assert.equal(byteLimit.partial, true);
  assert.ok(Buffer.byteLength(byteLimit.content) <= 20 * 1024 * 1024, 'actual UTF-8 JSON file respects the byte limit');
  assert.equal(JSON.parse(byteLimit.content).samples.length, byteLimit.count);
  let emptyPages = 0;
  const scanLimit = await runtimeHistoryJson('/api/stats', async () => respond(page([], String(++emptyPages), true)));
  assert.equal(emptyPages, 100, 'sparse history cannot cause unbounded requests');
  assert.equal(scanLimit.partial, true);
  await assert.rejects(runtimeHistoryJson('/api/stats', async () => respond(page([], 'same', true))), /не продолжил/);
  let pages = 0;
  await assert.rejects(runtimeHistoryJson('/api/stats', async () => respond({ ...page([], pages++ ? null : 'next', true), to: 200 + pages })), /некорректную/);

  const tree = render();
  const buttons = nodes(tree).filter(node => node.type === 'button');
  const localButton = buttons.find(node => node.props.children === 'Журнал этой вкладки → JSON');
  assert.ok(localButton && !localButton.props.disabled, 'local export is available without loaded server history');
  assert.equal(buttons.find(node => node.props.children === 'Диагностика студии → JSON').props.disabled, true);
  let downloaded, blob;
  global.fetch = async () => { throw Error('local report must not fetch history'); };
  global.document = { createElement: () => ({ click() { downloaded = this.download; }, remove() {} }), body: { appendChild() {} } };
  URL.createObjectURL = value => { blob = value; return 'blob:test'; }; URL.revokeObjectURL = () => {};
  await localButton.props.onClick();
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(localCalls, 1); assert.match(downloaded, /^castlink-tab-runtime-/);
  assert.equal(JSON.parse(await blob.text()).previous.runtime.events.length, 0);

  history = { from: 100, to: 200, retainedFrom: null, connections: [{ session: 's', name: '<img src=x onerror=alert(1)>', identity: 'studio', role: 'studio', lastSeen: 100,
    latest: { state: 'connected', runtime: { browser: '<script>bad</script>', environment: 'browser', visibility: 'hidden', events: [], errors: 0, rejections: 0 } } }] };
  const html = renderToStaticMarkup(render());
  assert.match(html, /&lt;img/); assert.match(html, /&lt;script&gt;bad/); assert.doesNotMatch(html, /<img|<script/);
  assert.match(html, /Нет свежих замеров/); assert.match(html, /Скрыта/);
  console.log('PASS: runtime export preserves filters and cutoff, paginates within sample/UTF-8 limits, marks partial results, rejects stalled paging, and local export works without history');
})().catch(error => { console.error(error); process.exitCode = 1; });
