const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const helper = require('../lib/saved-servers.ts');

assert.equal(helper.normalizeServerOrigin('studio.example:8443/'), 'https://studio.example:8443');
assert.equal(helper.normalizeServerOrigin('http://localhost:3000'), 'http://localhost:3000');
assert.deepEqual(helper.normalizeSavedServer(' My Studio ', 'studio.example'), { label: 'My Studio', origin: 'https://studio.example' });
for (const address of ['https://user:pass@studio.example', 'https://studio.example/path', 'https://studio.example?q=1', 'http://studio.example']) {
  assert.throws(() => helper.normalizeServerOrigin(address));
}
assert.throws(() => helper.normalizeSavedServer(' ', 'studio.example'), /Название/);

const values = new Map();
global.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
const servers = Array.from({ length: 23 }, (_, i) => ({ label: `Server ${i}`, origin: `https://server-${i}.example` }));
assert.equal(helper.writeSavedServers(servers), true);
assert.equal(helper.readSavedServers().length, 20);
values.set('castlink-saved-servers-v1', JSON.stringify([{ label: 'Bad', origin: 'http://external.example' }]));
assert.deepEqual(helper.readSavedServers(), []);
values.set('castlink-saved-servers-v1', JSON.stringify([
  { label: 'Old Lunka', origin: 'https://lunkaonline.ru' },
  { label: 'Old www Lunka', origin: 'https://www.lunkaonline.ru/' },
  { label: 'CastLink duplicate', origin: 'https://castlink.ru/' },
  { label: 'My other server', origin: 'https://other.example' },
]));
assert.deepEqual(helper.readSavedServers(), [
  { label: 'VPS CastLink', origin: 'https://castlink.ru' },
  { label: 'My other server', origin: 'https://other.example' },
], 'legacy Lunka entries migrate to CastLink and duplicate destinations collapse');
assert.deepEqual(JSON.parse(values.get('castlink-saved-servers-v1')), [
  { label: 'VPS CastLink', origin: 'https://castlink.ru' },
  { label: 'My other server', origin: 'https://other.example' },
], 'the migrated/deduplicated list is persisted');
global.localStorage = { getItem() { throw new Error('storage blocked'); }, setItem() { throw new Error('storage blocked'); } };
assert.deepEqual(helper.readSavedServers(), []);
assert.equal(helper.writeSavedServers([]), false);
console.log('saved server validation passed');
