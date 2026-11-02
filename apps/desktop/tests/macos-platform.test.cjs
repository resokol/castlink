'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { createMacPermissionAdapter } = require('../src/macos-platform.cjs');
const { createPermissionPolicy } = require('../src/permissions.cjs');

test('only documented macOS permission kinds are accepted', async () => {
  const adapter = createMacPermissionAdapter({});
  for (const kind of ['media', 'audio', 'video', '__proto__', '', null, undefined, {}]) {
    assert.throws(() => adapter.status(kind), TypeError);
    await assert.rejects(adapter.request(kind), TypeError);
  }
});

test('media status is read from the OS each time and only granted grants access', () => {
  let value = 'granted';
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus(kind) { assert.equal(kind, 'camera'); return value; },
  } });
  assert.deepEqual(adapter.status('camera'), { granted: true, reason: null });
  for (const status of ['denied', 'restricted', 'not-determined', 'unknown']) {
    value = status;
    assert.deepEqual(adapter.status('camera'), { granted: false, reason: `camera-${status}` });
  }
  value = 'unexpected';
  assert.deepEqual(adapter.status('camera'), { granted: false, reason: 'camera-unknown' });
});

for (const kind of ['microphone', 'camera']) {
  test(`${kind} requests use the actual Electron media API and respect denial`, async () => {
    const adapter = createMacPermissionAdapter({ systemPreferences: {
      getMediaAccessStatus(type) { assert.equal(type, kind); return 'not-determined'; },
      async askForMediaAccess(type) { assert.equal(type, kind); return false; },
    } });
    assert.deepEqual(await adapter.request(kind), { granted: false, reason: `${kind}-denied` });
  });

  test(`${kind} OS approval does not need a settings redirect`, async () => {
    const adapter = createMacPermissionAdapter({ systemPreferences: {
      getMediaAccessStatus() { return 'not-determined'; },
      async askForMediaAccess() { return true; },
    }, openSettings() { assert.fail('approved request must not open settings'); } });
    assert.deepEqual(await adapter.request(kind), { granted: true, reason: null });
  });
}

test('already granted media never reprompts', async () => {
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus() { return 'granted'; },
    askForMediaAccess() { assert.fail('already granted'); },
  } });
  assert.deepEqual(await adapter.request('microphone'), { granted: true, reason: null });
});

test('denied camera uses its fixed settings pane and opening it never grants access', async () => {
  const urls = [];
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus() { return 'denied'; },
    askForMediaAccess() { assert.fail('denied media cannot reprompt'); },
  }, openSettings: async url => urls.push(url) });
  assert.deepEqual(await adapter.request('camera'), { granted: false, reason: 'camera-denied' });
  assert.deepEqual(urls, ['x-apple.systempreferences:com.apple.preference.security?Privacy_Camera']);
});

test('restricted media stays denied without a prompt', async () => {
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus() { return 'restricted'; },
    askForMediaAccess() { assert.fail('restricted'); },
  }, openSettings() { assert.fail('restricted'); } });
  assert.deepEqual(await adapter.request('microphone'), { granted: false, reason: 'microphone-restricted' });
});

test('screen requests use Screen Recording settings, never the microphone/camera prompt API', async () => {
  let current = 'denied';
  const urls = [];
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus(kind) { assert.equal(kind, 'screen'); return current; },
    askForMediaAccess() { assert.fail('Electron cannot request screen with askForMediaAccess'); },
  }, openSettings: async url => urls.push(url) });
  assert.deepEqual(await adapter.request('screen'), { granted: false, reason: 'screen-denied' });
  assert.deepEqual(urls, ['x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture']);
  current = 'granted';
  assert.deepEqual(adapter.status('screen'), { granted: true, reason: null });
});

test('accessibility checks do not prompt and requests use the Electron trust prompt', async () => {
  let trusted = false;
  const prompts = [];
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    isTrustedAccessibilityClient(prompt) { prompts.push(prompt); return trusted; },
  } });
  assert.deepEqual(adapter.status('accessibility'), { granted: false, reason: 'accessibility-denied' });
  assert.deepEqual(await adapter.request('accessibility'), { granted: false, reason: 'accessibility-denied' });
  assert.deepEqual(prompts, [false, false, true]);
  trusted = true;
  assert.deepEqual(adapter.status('accessibility'), { granted: true, reason: null });
});

test('Automation cannot be granted by a general settings visit or Electron API', async () => {
  const urls = [];
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus() { assert.fail('Automation is not a media permission'); },
    isTrustedAccessibilityClient() { assert.fail('Accessibility is not Automation'); },
  }, openSettings: async url => urls.push(url) });
  assert.deepEqual(adapter.status('automation'), { granted: false, reason: 'automation-target-required' });
  assert.deepEqual(await adapter.request('automation'), { granted: false, reason: 'automation-target-required' });
  assert.deepEqual(urls, ['x-apple.systempreferences:com.apple.preference.security?Privacy_Automation']);
});

test('missing OS APIs never imply permission', async () => {
  const adapter = createMacPermissionAdapter({});
  for (const kind of ['camera', 'microphone', 'screen', 'accessibility']) {
    assert.deepEqual(adapter.status(kind), { granted: false, reason: `${kind}-api-unavailable` });
    assert.deepEqual(await adapter.request(kind), { granted: false, reason: `${kind}-api-unavailable` });
  }
});

test('missing media request API is a denial with an explicit reason', async () => {
  const adapter = createMacPermissionAdapter({ systemPreferences: { getMediaAccessStatus: () => 'not-determined' } });
  assert.deepEqual(await adapter.request('camera'), { granted: false, reason: 'camera-api-unavailable' });
});

test('native API and settings failures return denials without leaking exception text', async () => {
  const statusError = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus() { throw new Error('private error'); },
  } });
  assert.deepEqual(statusError.status('screen'), { granted: false, reason: 'screen-status-failed' });
  const requestError = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus: () => 'not-determined',
    askForMediaAccess: async () => { throw new Error('private error'); },
  } });
  assert.deepEqual(await requestError.request('camera'), { granted: false, reason: 'camera-request-failed' });
  const settingsError = createMacPermissionAdapter({ systemPreferences: { getMediaAccessStatus: () => 'denied' },
    openSettings: async () => { throw new Error('private error'); },
  });
  assert.deepEqual(await settingsError.request('screen'), { granted: false, reason: 'screen-settings-failed' });
  const noSettings = createMacPermissionAdapter({ systemPreferences: { getMediaAccessStatus: () => 'denied' } });
  assert.deepEqual(await noSettings.request('screen'), { granted: false, reason: 'screen-settings-unavailable' });
});

test('malformed truthy OS replies never grant access', async () => {
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus: () => 'not-determined',
    askForMediaAccess: async () => 'granted',
    isTrustedAccessibilityClient: () => 'yes',
  } });
  assert.equal((await adapter.request('camera')).granted, false);
  assert.equal(adapter.status('accessibility').granted, false);
  assert.equal((await adapter.request('accessibility')).granted, false);
});

test('a late OS approval after the app policy is reset cannot authorize capture', async () => {
  let decide;
  const adapter = createMacPermissionAdapter({ systemPreferences: {
    getMediaAccessStatus: () => 'not-determined',
    askForMediaAccess: () => new Promise(resolve => { decide = resolve; }),
  } });
  const policy = createPermissionPolicy({ trustedOrigins: new Set(['https://studio.example']),
    ask: async () => (await adapter.request('camera')).granted,
  });
  const request = { frameUrl: 'https://studio.example/room', isMainFrame: true, permission: 'media', mediaTypes: ['video'] };
  let captureStarted = false;
  const pending = policy.request(request).then(granted => { if (granted) captureStarted = true; return granted; });
  policy.reset();
  decide(true);
  assert.equal(await pending, false);
  assert.equal(captureStarted, false);
  assert.equal(policy.check(request), false);
});
