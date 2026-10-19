const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createPermissionPolicy } = require('../src/permissions.cjs');
const trusted = { frameUrl: 'https://studio.example/room', isMainFrame: true };
test('media requires native consent and never grants unknown permissions', async () => {
  let prompts = 0;
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: async () => { prompts++; return true; } });
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), true);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), true);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['video'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'clipboard-read' }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'], isMainFrame: false }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'], frameUrl: 'https://evil.example' }), false);
  assert.equal(prompts, 1);
});
test('navigation invalidates pending consent and clears grants', async () => {
  let decide;
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: () => new Promise(r => decide = r) });
  const pending = policy.request({ ...trusted, permission: 'media', mediaTypes: ['video'] });
  policy.reset(); decide(true);
  assert.equal(await pending, false);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['video'] }), false);
});
test('denial and empty/unknown media types cannot grant capture', async () => {
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: async () => false });
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: [] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['unknown'] }), false);
});
test('Electron getDisplayMedia empty mediaTypes receives display-only consent', async () => {
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']), ask: async () => true });
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: [] }), true);
  assert.equal(policy.check({ ...trusted, permission: 'display-capture' }), true);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['audio'] }), false);
  assert.equal(policy.check({ ...trusted, permission: 'media', mediaTypes: ['video'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media', mediaTypes: ['unknown'] }), false);
  assert.equal(await policy.request({ ...trusted, permission: 'media' }), false);
});
