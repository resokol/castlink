const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (mod, filename) => mod._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const { TALK_TO_ROOM, talkbackPermissions, isVerifiedTalkback, parseGuestMediaCommand } = require('../lib/talkback-policy.ts');
const recipients = [
  { identity: 'guest-one', name: 'Guest', role: 'guest' },
  { identity: 'studio-panel-main', name: 'Host', role: 'admin' },
  { identity: 'studio-moderator-abc', name: 'Moderator', role: 'moderator' },
];

assert.deepEqual(talkbackPermissions('guest-one', recipients), [{ participantIdentity: 'guest-one', allowAll: true }], 'private talk grants only the selected guest');
assert.deepEqual(talkbackPermissions(TALK_TO_ROOM, recipients).map(item => item.participantIdentity), recipients.map(item => item.identity), 'room talk explicitly allows current guests and staff');
assert.throws(() => talkbackPermissions('guest-gone', recipients), /больше не подключён/, 'stale private target fails closed');
assert.equal(isVerifiedTalkback({ identity: 'talkback-random', metadata: '{"role":"talkback"}' }), true);
assert.equal(isVerifiedTalkback({ identity: 'guest-talkback', metadata: '{"role":"talkback"}' }), false, 'a guest cannot opt into talkback exemption');
assert.equal(isVerifiedTalkback({ identity: 'talkback-random', metadata: '{"role":"guest"}' }), false, 'identity prefix alone is not trusted');

const command = new TextEncoder().encode(JSON.stringify({ kind: 'audio', enabled: false }));
assert.deepEqual(parseGuestMediaCommand(command, undefined, 'castlink-media-control'), { source: 'microphone', enabled: false });
assert.deepEqual(parseGuestMediaCommand(new TextEncoder().encode('{"kind":"video","enabled":true}'), undefined, 'castlink-media-control'), { source: 'camera', enabled: true });
assert.equal(parseGuestMediaCommand(command, { identity: 'studio-panel-main' }, 'castlink-media-control'), undefined, 'only server-originated commands are accepted');
assert.equal(parseGuestMediaCommand(command, undefined, 'other-topic'), undefined);
assert.equal(parseGuestMediaCommand(new TextEncoder().encode('{"kind":"camera","enabled":true}'), undefined, 'castlink-media-control'), undefined);
assert.equal(parseGuestMediaCommand(new Uint8Array(2049), undefined, 'castlink-media-control'), undefined, 'oversized payloads are ignored');
console.log('talkback policy and server-only guest media command checks passed');
