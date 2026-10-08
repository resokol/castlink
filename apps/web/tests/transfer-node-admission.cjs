const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const crypto = require('node:crypto');
const ts = require('typescript');
const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-transfer-admission-'));
Object.assign(process.env, {
  CASTLINK_STORAGE_BACKEND: 'json', STUDIOLINK_DATA_DIR: directory,
  CASTLINK_NODE_ID: 'node-admission-fixture', CASTLINK_ENFORCE_NODE_ADMISSION: '1',
  CASTLINK_CONTROL_PLANE_URL: '', CASTLINK_SESSION_SECRET: 'fixture-session-secret-more-than-thirty-two',
  LIVEKIT_API_KEY: 'fixture-key', LIVEKIT_API_SECRET: 'fixture-livekit-secret',
  STUDIOLINK_TRANSFER_SECRET: 'fixture-transfer-secret-more-than-thirty-two',
  STUDIOLINK_TRANSFER_SERVER_ID: 'target', STUDIOLINK_TRANSFER_ORIGIN: 'https://target.example',
  STUDIOLINK_TRANSFER_PEER_ORIGIN: 'https://source.example',
});
for (const key of ['STUDIOLINK_ROOMS_FILE', 'STUDIOLINK_STUDIO_CONTROL_FILE', 'STUDIOLINK_TRANSFER_STATE_FILE', 'STUDIOLINK_INSTALLATION_ID']) delete process.env[key];
let admissionFailure = true, state = 'active', blocked = false, queries = 0;
const originalLoad = Module._load;
Module._load = function(name, ...args) {
  if (name === './control-plane-store') return { controlPlanePool: () => ({ query: async (sql, values) => {
    queries++;
    assert.match(sql, /participant_blocks/);
    assert.equal(values[0], 'node-admission-fixture');
    if (admissionFailure) throw Object.assign(Error('fixture schema unavailable'), { code: '42P01' });
    return { rows: [{ state, operational_revision: '1', blocked }] };
  } }) };
  return originalLoad.call(this, name, ...args);
};
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function(name, ...args) { return originalResolve.call(this, name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : name, ...args); };
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, file);
const { NextRequest } = require('next/server');
const sdk = require('livekit-server-sdk');
sdk.RoomServiceClient.prototype.listRooms = async () => [];
sdk.RoomServiceClient.prototype.listParticipants = async () => [];

(async () => {
  const api = require('../app/api/server-transfer/route.ts');
  const rooms = require('../lib/room-store.ts');
  const access = require('../lib/access.ts');
  const transfer = require('../lib/server-transfer.ts');
  const roomCore = require('../lib/transfer-room.ts');
  await rooms.updateRooms(() => [{ name: 'untouched', passwordHash: access.hashPassword('guest') }]);
  const before = JSON.stringify(await rooms.readRooms());
  const roomId = crypto.randomUUID();
  const record = { name: 'incoming', creatorAccessId: roomId, transferRoomId: roomId, studioPasswordHash: access.hashPassword('studio'), passwordHash: access.hashPassword('guest') };
  const prepare = async () => {
    const raw = JSON.stringify({ action: 'prepare', sourceOrigin: 'https://source.example', transferId: crypto.randomUUID().replaceAll('-', ''), roomRecord: record,
      authorization: { kind: 'creator', expiresAt: Date.now() + 60000, roomId, creatorAccessId: roomId, credentialVersion: access.roomVersion(record.studioPasswordHash) } });
    const timestamp = String(Date.now()), nonce = crypto.randomUUID().replaceAll('-', '');
    return api.POST(new NextRequest('https://target.example/api/server-transfer?action=bridge', { method: 'POST', headers: {
      'x-studiolink-transfer-time': timestamp, 'x-studiolink-transfer-nonce': nonce, 'x-studiolink-transfer-signature': transfer.signBridge(timestamp, nonce, raw),
    }, body: raw }));
  };
  const rejected = await prepare();
  assert.equal(rejected.status, 503, 'healthy LiveKit alone must not accept handoff when enforced node admission is broken');
  assert.equal((await rejected.json()).ticket, undefined);
  assert.equal(JSON.stringify(await rooms.readRooms()), before, 'failed preparation preserves target credentials');
  const durable = await transfer.updateTransferState(value => value);
  assert.equal(Object.keys(durable.transfers).length, 0);
  assert.equal(Object.keys(durable.tickets).length, 0);
  assert.equal(fs.existsSync(path.join(directory, 'runtime', 'studiolink-studio-control.json')), false, 'no primary reservation created');
  await assert.rejects(roomCore.transferredRoomStageReady('studio-default', record), /нод/);
  await assert.rejects(roomCore.installTransferredRoom('studio-default', record, crypto.randomUUID()), /нод/);
  const health = await (await api.GET(new NextRequest('https://target.example/api/server-transfer?action=health'))).json();
  assert.equal(health.liveKitReady, true);
  assert.equal(health.nodeAdmissionReady, false);
  admissionFailure = false;
  assert.equal(await roomCore.transferNodeAdmissionReady(), true);
  for (state of ['disabled', 'force_offline']) assert.equal(await roomCore.transferNodeAdmissionReady(), false);
  state = 'draining';
  assert.equal(await roomCore.transferNodeAdmissionReady(), true, 'existing admission policy allows draining sessions');
  blocked = true;
  assert.equal(await roomCore.transferNodeAdmissionReady(), false);
  process.env.CASTLINK_ENFORCE_NODE_ADMISSION = '0';
  const priorQueries = queries;
  assert.equal(await roomCore.transferNodeAdmissionReady(), true, 'legacy installation without configured admission remains supported');
  assert.equal(queries, priorQueries, 'disabled admission does not contact the control database');
  assert.equal((await prepare()).status, 200, 'legacy valid handoff remains functional');
  console.log('PASS: broken/denied enforced admission refuses handoff before room/reservation/tickets, while legacy admission behavior remains');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { fs.rmSync(directory, { recursive: true, force: true }); });
