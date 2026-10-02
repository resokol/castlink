const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, f);
process.env.CASTLINK_SESSION_SECRET = 'transfer-session-unit-secret-at-least-32-characters';
process.env.STUDIOLINK_STUDIO_PASSWORD_HASH = 'unit-test-hash';
process.env.STUDIOLINK_DEFAULT_STUDIO_ID = 'studio-default';
process.env.CASTLINK_CONTROL_PLANE_URL = '';
process.env.CASTLINK_NODE_ID = 'node-local-test';
process.env.CASTLINK_NODE_SECRET = 'local-node-secret-at-least-32-characters';
let localReads = 0;
const load = Module._load;
Module._load = function(name, ...args) {
  if (name === './control-plane-store') return {
    studioOwnerAccessVersion: async () => { localReads++; return 'current-version'; },
    resolveStudioRoute: async () => ({ ok: true, nodeId: 'node-local-test' }),
  };
  return load.call(this, name, ...args);
};
const client = require('../lib/control-plane-client.ts');
const owner = require('../lib/studio-owner-access.ts');
const access = require('../lib/access.ts');
Module._load = load;
const request = values => ({ cookies: { get: name => values[name] ? { value: values[name] } : undefined } });
(async () => {
  assert.equal(await client.currentStudioOwnerAccessVersion('studio-default'), 'current-version');
  assert.equal(localReads, 1, 'own node identity without remote URL still uses local control DB');
  const token = access.signAccess({ kind: 'studio', version: access.roomVersion('unit-test-hash') }, 3600);
  const expires = access.readAccess(token).exp;
  assert.equal(await owner.studioOwnerSessionExpiresAt(request({ 'studiolink-studio': token }), 'studio-default'), expires);
  assert.equal(await owner.studioOwnerSessionExpiresAt(request({}), 'studio-default'), null);
  assert.equal(await owner.studioOwnerSessionExpiresAt(request({ 'studiolink-studio': token + 'x' }), 'studio-default'), null);
  const scope = 'studio-other';
  const name = 'castlink-studio-owner-' + access.roomVersion(scope).slice(0, 24);
  const scoped = access.signAccess({ kind: 'studio-owner', studio: scope, version: 'current-version' }, 1800);
  assert.equal(await owner.studioOwnerSessionExpiresAt(request({ [name]: scoped }), scope), access.readAccess(scoped).exp);
  const revoked = access.signAccess({ kind: 'studio-owner', studio: scope, version: 'revoked-version' }, 1800);
  assert.equal(await owner.studioOwnerSessionExpiresAt(request({ [name]: revoked }), scope), null);
  assert.equal(await owner.studioOwnerSessionExpiresAt(request({ [name]: scoped }), 'studio-another'), null);
  const stale = access.signAccess({ kind: 'studio', version: access.roomVersion('unit-test-hash') }, -1);
  assert.equal(await owner.studioOwnerSessionExpiresAt(request({ 'studiolink-studio': stale }), 'studio-default'), null);
  process.env.CASTLINK_CONTROL_PLANE_URL = 'https://control.example';
  process.env.CASTLINK_NODE_SECRET = '';
  await assert.rejects(client.currentStudioOwnerAccessVersion(scope), /configuration is incomplete/);
  console.log('PASS: local node control mode and verified owner lifetime across hot-swap, including revoked/wrong-scope/expired sessions');
})().catch(error => { console.error(error); process.exitCode = 1; });
