require('./i18n-fixture.cjs');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

Module._extensions['.tsx'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
}).outputText, filename);
const originalLoad = Module._load;
Module._load = function(request, parent, isMain) {
  if (request === '@/lib/telemetry-types') return { mean: () => null, sumRates: () => 0 };
  if (request === '@/lib/stats-csv') return { historyCsv: () => '', connectionsCsv: () => '', audioHistoryCsv: () => '' };
  if (request === '@/lib/stats-report') return { statisticsReport: () => '' };
  return originalLoad.call(this, request, parent, isMain);
};

const { statisticsTokenRefreshUrl } = require('../components/StatisticsDashboard.tsx');
const primary = new URL(statisticsTokenRefreshUrl('Тестовая комната', 'primary', 'client-primary-1', 42), 'https://local.example');
assert.equal(primary.pathname, '/api/token');
assert.equal(primary.searchParams.get('room'), 'Тестовая комната');
assert.equal(primary.searchParams.get('role'), 'studio-panel');
assert.equal(primary.searchParams.get('clientId'), 'client-primary-1');
assert.equal(primary.searchParams.get('epoch'), '42', 'primary refresh remains bound to the current lease epoch');

const moderator = new URL(statisticsTokenRefreshUrl('Тестовая комната', 'moderator', 'client-mod-2', 42), 'https://local.example');
assert.equal(moderator.searchParams.get('role'), 'studio-moderator');
assert.equal(moderator.searchParams.get('clientId'), 'client-mod-2');
assert.equal(moderator.searchParams.has('epoch'), false, 'moderator refresh does not request a publishing primary token');

console.log('PASS: statistics refresh requests use current primary or moderator credentials');
