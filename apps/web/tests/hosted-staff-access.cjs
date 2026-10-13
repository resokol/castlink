const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');

const resolve = Module._resolveFilename;
Module._resolveFilename = function (id, ...args) {
  return resolve.call(this, id.startsWith('@/') ? path.resolve(__dirname, '..', id.slice(2)) : id, ...args);
};
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(
  fs.readFileSync(filename, 'utf8'),
  { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } },
).outputText, filename);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-hosted-staff-'));
process.env.CASTLINK_STORAGE_BACKEND = 'json';
process.env.STUDIOLINK_DATA_DIR = dir;
process.env.STUDIOLINK_ROOMS_FILE = path.join(dir, 'rooms.json');
process.env.STUDIOLINK_MODERATOR_ACCESS_FILE = path.join(dir, 'moderators.json');
process.env.CASTLINK_HOSTED_TOKEN_FILE = path.join(dir, 'tokens.json');
process.env.CASTLINK_SESSION_SECRET = 'isolated-hosted-staff-test-secret';

const { NextRequest, NextResponse } = require('next/server');
const gate = require('../lib/hosted-access.ts');
const admin = require('../lib/room-admin.ts');
const moderator = require('../lib/moderator-access.ts');
const studioId = 'studio-default', room = 'hosted-staff-room';
const adminVersion = 'admin-version', moderatorVersion = 'moderator-version', scopedId = 'scoped-session';
const token = 'clt_' + crypto.randomBytes(32).toString('base64url');
const tokenRecord = {
  id: crypto.randomBytes(16).toString('hex'),
  tokenHash: crypto.createHash('sha256').update(token).digest('hex'),
  expiresAt: Date.now() + 86400000,
};
const writeTokens = () => fs.writeFileSync(process.env.CASTLINK_HOSTED_TOKEN_FILE,
  JSON.stringify({ schemaVersion: 1, tokens: [tokenRecord] }));
const request = cookie => new NextRequest('https://example.test/api/token', {
  headers: { cookie: cookie || '' },
});
const staffCookie = response => {
  const cookie = response.cookies.getAll()[0];
  return `${cookie.name}=${cookie.value}`;
};

(async () => {
  try {
    fs.writeFileSync(process.env.STUDIOLINK_ROOMS_FILE,
      JSON.stringify({ schemaVersion: 1, rooms: [{ name: room, adminAccessVersion: adminVersion }] }));
    fs.writeFileSync(process.env.STUDIOLINK_MODERATOR_ACCESS_FILE,
      JSON.stringify({ schemaVersion: 1, version: moderatorVersion,
        versions: { [studioId]: moderatorVersion }, scopedInvites: {},
        scopedSessions: { [`${studioId}\0${room}`]: { [scopedId]: { studioId, room, inviteId: 'invite-id' } } } }));
    writeTokens();
    const expiry = Date.now() + 3600000;
    const adminResponse = NextResponse.json({});
    admin.setRoomAdminCookie(adminResponse, request(), room, adminVersion, expiry, studioId);
    const moderatorResponse = NextResponse.json({});
    moderator.setModeratorCookie(moderatorResponse, request(), moderatorVersion, expiry, studioId);
    const scopedResponse = NextResponse.json({});
    moderator.setRoomModeratorCookie(scopedResponse, request(), room, scopedId, expiry, studioId);
    const actors = [
      { name: 'room admin', cookie: staffCookie(adminResponse), allowed: req => admin.isRoomAdmin(req, room, studioId) },
      { name: 'global moderator', cookie: staffCookie(moderatorResponse), allowed: req => moderator.isModerator(req, undefined, studioId) },
      { name: 'room moderator', cookie: staffCookie(scopedResponse), allowed: req => moderator.isModerator(req, room, studioId) },
    ];
    const hostedCookie = `${gate.hostedCookieName}=${gate.signHostedSession(tokenRecord)}`;
    for (const actor of actors) {
      process.env.CASTLINK_HOSTED_ACCESS = '0';
      assert.equal(await actor.allowed(request(actor.cookie)), true, `${actor.name} works while gate is off`);
      process.env.CASTLINK_HOSTED_ACCESS = '1';
      assert.equal(await actor.allowed(request(actor.cookie)), false, `${actor.name} requires hosted access`);
      assert.equal(await actor.allowed(request(`${actor.cookie}; ${hostedCookie}`)), true, `${actor.name} works with hosted access`);
    }
    tokenRecord.revokedAt = Date.now();
    writeTokens();
    for (const actor of actors) {
      assert.equal(await actor.allowed(request(`${actor.cookie}; ${hostedCookie}`)), false,
        `${actor.name} loses authority after registry revocation`);
    }
    console.log('PASS: staff cookies require live hosted access only when hosted mode is enabled');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
