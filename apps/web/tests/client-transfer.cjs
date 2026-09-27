const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { transferDestination } = require('../lib/client-transfer.ts');
const snapshot = { role: 'guest', room: 'Пробная комната' };
const canonical = 'https://castlink.ru';
const legacySslip = 'https://79-120-36-254.sslip.io';
const currentCanonical = 'https://caster.em.studio';
assert.equal(new URL(transferDestination(currentCanonical, 'ticket', snapshot, 'https://192.168.53.68')).origin, 'https://192.168.53.68');
assert.throws(() => transferDestination(currentCanonical, 'ticket', snapshot, 'https://192.168.53.69'));
assert.throws(() => transferDestination('https://lunkaonline.ru', 'ticket', snapshot), undefined,
  'old Lunka origin is no longer a transfer destination');

assert.equal(new URL(transferDestination(currentCanonical, 'ticket', snapshot)).origin, currentCanonical,
  'the stable caster domain is an approved canonical destination');
assert.equal(new URL(transferDestination(currentCanonical, 'ticket', snapshot, currentCanonical)).origin, currentCanonical,
  'same-origin client route for caster.em.studio is accepted');

assert.equal(new URL(transferDestination(canonical, 'ticket', snapshot)).origin, canonical,
  'CastLink is an approved canonical destination');
assert.equal(new URL(transferDestination(canonical, 'ticket', snapshot, canonical)).origin, canonical,
  'same-origin client route is accepted');
assert.equal(new URL(transferDestination(legacySslip, 'ticket', snapshot)).origin, legacySslip,
  'old sslip links remain compatible');
assert.equal(new URL(transferDestination(legacySslip, 'ticket', snapshot, 'https://192.168.53.68')).origin,
  'https://192.168.53.68', 'the configured HTTPS LAN route is used');
assert.equal(new URL(transferDestination(legacySslip, 'ticket', snapshot, undefined)).origin, legacySslip,
  'missing client route falls back to canonical destination');

for (const override of [
  'https://attacker.example',
  'http://192.168.53.68',
  'https://user@192.168.53.68',
  'https://192.168.53.68:444',
  'https://192.168.53.68/other',
  'https://192.168.53.68/?next=attacker',
]) {
  assert.throws(() => transferDestination(legacySslip, 'ticket', snapshot, override), undefined, `reject ${override}`);
}
assert.throws(() => transferDestination('https://other.example', 'ticket', snapshot, 'https://192.168.53.68'),
  undefined, 'LAN override only applies to the canonical sslip target');
assert.throws(() => transferDestination(legacySslip, 'ticket', snapshot, 'https://192.168.53.68:8443'),
  undefined, 'non-default LAN port is rejected');

const projectRoot = require('node:path').join(__dirname, '..');
const guestPicker = fs.readFileSync(require('node:path').join(projectRoot, 'components/GuestServerPicker.tsx'), 'utf8');
const studioPicker = fs.readFileSync(require('node:path').join(projectRoot, 'components/StudioRoomPicker.tsx'), 'utf8');
const transferPage = fs.readFileSync(require('node:path').join(projectRoot, 'app/transfer/page.tsx'), 'utf8');
assert.match(guestPicker, /Локальный сервер", origin: "https:\/\/caster\.em\.studio"/,
  'guest picker defaults local destination to caster.em.studio');
assert.doesNotMatch(guestPicker, /lunkaonline\.ru|Lunka Online/i, 'guest picker never lists Lunka');
assert.match(studioPicker, /Локальный сервер", origin: "https:\/\/caster\.em\.studio"/,
  'studio picker defaults local destination to caster.em.studio');
assert.doesNotMatch(studioPicker, /lunkaonline\.ru|Lunka Online/i, 'studio picker never lists Lunka');
assert.match(transferPage, /"castlink\.ru"/, 'transfer return source allows CastLink');
assert.doesNotMatch(transferPage, /lunkaonline\.ru|Lunka Online/i, 'transfer return allowlist omits Lunka');

console.log('PASS: client transfer routing keeps canonical fallback and restricts LAN overrides');
