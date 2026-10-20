const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseServerInput, isTrustedFrame, canNavigate, settingsForDisk } = require('../src/server-policy.cjs');

test('launch preserves invitation only in memory and saves exact origins', () => {
  const input = parseServerInput('https://studio.example/room?invite=secret#access', false);
  assert.equal(input.launchUrl, 'https://studio.example/room?invite=secret#access');
  assert.equal(input.origin, 'https://studio.example');
  assert.deepEqual(settingsForDisk(input, ['https://reserve.example'], 'ru'), {
    serverOrigin: 'https://studio.example', reserveOrigins: ['https://reserve.example'], locale: 'ru',
  });
});
test('rejects unsafe URLs, credentials, malformed inputs and HTTP LAN', () => {
  for (const url of ['', 'studio.example', 'file:///tmp/a', 'javascript:alert(1)', 'https://user:secret@example.com', 'http://192.168.1.2', 'https://example.com\\@evil.com']) {
    assert.throws(() => parseServerInput(url, false), url);
  }
  assert.throws(() => parseServerInput('http://localhost:3000', false));
  assert.equal(parseServerInput('http://127.0.0.1:3000', true).origin, 'http://127.0.0.1:3000');
  assert.equal(parseServerInput('http://[::1]:3000', true).origin, 'http://[::1]:3000');
});
test('native access is exact-origin and main-frame only', () => {
  const trustedOrigins = new Set(['https://studio.example', 'https://reserve.example']);
  assert.equal(isTrustedFrame({ frameUrl: 'https://studio.example/room', isMainFrame: true, trustedOrigins }), true);
  for (const frameUrl of ['https://studio.example.evil.test', 'https://studio.example:444', 'http://studio.example', 'file:///tmp/a', 'https://unknown.example']) {
    assert.equal(isTrustedFrame({ frameUrl, isMainFrame: true, trustedOrigins }), false, frameUrl);
    assert.equal(canNavigate(frameUrl, trustedOrigins), false, frameUrl);
  }
  assert.equal(isTrustedFrame({ frameUrl: 'https://studio.example', isMainFrame: false, trustedOrigins }), false);
  assert.equal(canNavigate('https://reserve.example/transfer', trustedOrigins), true);
});
test('disk settings cannot persist an invitation in reserve URLs', () => {
  assert.throws(() => settingsForDisk(parseServerInput('https://studio.example'), ['https://reserve.example/room?key=secret'], 'ru'));
  assert.throws(() => settingsForDisk(parseServerInput('https://studio.example'), [], 'unknown'));
});

test('caster entry opens the room gate for server-only URLs and preserves full invitations',()=>{
  const {parseLaunchInput}=require('../src/server-policy.cjs');
  assert.equal(parseLaunchInput('https://studio.example','caster').launchUrl,'https://studio.example/room');
  for(const input of ['https://studio.example/room?name=Show#invite=secret','https://studio.example/join#access=secret','https://studio.example/?name=Show&mode=guest#invite=secret']) assert.equal(parseLaunchInput(input,'caster').launchUrl,input);
  assert.equal(parseLaunchInput('https://studio.example','studio').launchUrl,'https://studio.example/?mode=studio');
  for(const input of ['https://studio.example/room?name=Show','https://studio.example/?name=Show&mode=guest#invite=secret','https://studio.example/#access=secret'])assert.equal(parseLaunchInput(input,'studio').launchUrl,input);
  assert.throws(()=>parseLaunchInput('https://studio.example','admin'));
});
