const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { guestCaptureConstraints, guestClientInfoRecipients, parseGuestClientInfo, outputQualityRecipients } = require('../lib/guest-media.ts');
const base = { height: 720, micGain: 100, listenGain: 100, audioDeviceId: 'mic', videoDeviceId: 'cam' };
assert.equal(guestCaptureConstraints({...base, audioEnabled:false, videoEnabled:false}), null, 'receive-only entry must not call getUserMedia');
const audioOnly = guestCaptureConstraints({...base, videoEnabled:false});
assert.equal(audioOnly.video, false); assert.deepEqual(audioOnly.audio, {deviceId:{exact:'mic'}});
const videoOnly = guestCaptureConstraints({...base, audioEnabled:false});
assert.equal(videoOnly.audio, false); assert.equal(videoOnly.video.deviceId.exact, 'cam');
assert.equal(videoOnly.video.width, undefined, 'guest capture must not force a 16:9 width/crop');
assert.equal(videoOnly.video.height.ideal, 720);
assert.equal(videoOnly.video.resizeMode.ideal, 'none');
const hd = guestCaptureConstraints({...base, height:1080, audioEnabled:false});
assert.equal(hd.video.width, undefined); assert.equal(hd.video.height.ideal, 1080);
const defaults = guestCaptureConstraints(base); assert.ok(defaults.audio); assert.ok(defaults.video);
const primary = { identity: 'studio-panel-main', metadata: JSON.stringify({ role:'studio-panel', accessRole:'admin' }) };
const admin = { identity: 'studio-moderator-owner-client', metadata: JSON.stringify({ role:'studio-moderator', accessRole:'admin' }) };
const moderator = { identity: 'studio-moderator-mod-client', metadata: JSON.stringify({ role:'studio-moderator', accessRole:'moderator' }) };
assert.deepEqual(guestClientInfoRecipients([primary, admin, moderator, { identity:'guest-other', metadata:'{"role":"guest"}' }]), ['studio-panel-main','studio-moderator-owner-client']);
assert.deepEqual(guestClientInfoRecipients([{ identity:'studio-panel-main', metadata:'{"role":"guest"}' }]), [], 'spoofed client metadata cannot gain a technical recipient');
const info = { type:'guest-client-info', camera:'Camera', cpu:'8 threads', gpu:'GPU', platform:'Linux', sampleRate:48000 };
const payload = new TextEncoder().encode(JSON.stringify(info));
assert.deepEqual(parseGuestClientInfo(payload, 'guest-random-id', '{"role":"guest"}'), { camera:'Camera', cpu:'8 threads', gpu:'GPU', platform:'Linux', sampleRate:48000 });
assert.equal(parseGuestClientInfo(payload, 'guest-random-id', '{"role":"admin"}'), null, 'non-guest metadata is ignored');
assert.equal(parseGuestClientInfo(new TextEncoder().encode('{"type":"guest-client-info","camera":{},"cpu":"","gpu":"","platform":"","sampleRate":0}'), 'guest-random-id', '{"role":"guest"}'), null, 'object-valued display fields are rejected');
assert.equal(parseGuestClientInfo(new Uint8Array(2049), 'guest-random-id', '{"role":"guest"}'), null, 'oversized data messages are rejected');
assert.deepEqual(outputQualityRecipients([
  { identity:'output-a', metadata:'{"role":"output","outputTarget":"guest-source"}' },
  { identity:'output-b', metadata:'{"role":"output","outputTarget":"guest-other"}' },
  { identity:'guest-source', metadata:'{"role":"guest","outputTarget":"guest-source"}' },
], 'guest-source'), ['output-a'], 'output settings go only to the output client bound to this exact source');
console.log('PASS: guest device constraints, admin-only client-info recipients, bounded payload validation, and output-target data privacy');
