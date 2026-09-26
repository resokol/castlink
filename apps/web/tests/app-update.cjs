const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { availableVersion, updateUrl } = require('../lib/app-update.ts');
assert.equal(availableVersion('v1', { version: 'v1' }), null);
assert.equal(availableVersion('v1', { version: 'v2' }), 'v2');
assert.equal(availableVersion('v2', { version: 'v1' }), 'v1', 'rollback is an update too');
for (const response of [null, {}, { version: '' }, { version: 123 }, '<html>']) assert.throws(() => availableVersion('v1', response));
const url = new URL(updateUrl('https://studio.example/room?name=room%20one&moved=1&_update=old#settings', 'new-version'));
assert.equal(url.origin, 'https://studio.example'); assert.equal(url.pathname, '/room');
assert.equal(url.searchParams.get('name'), 'room one'); assert.equal(url.searchParams.get('moved'), '1');
assert.deepEqual(url.searchParams.getAll('_update'), ['new-version']); assert.equal(url.hash, '#settings');
console.log('PASS: current/new/rollback releases, invalid API responses, cache busting with preserved room URL');
