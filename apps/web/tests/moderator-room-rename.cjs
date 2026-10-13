const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const ts = require('typescript');
Module._extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);

let rooms = [{ name: 'empty-room' }, { name: 'busy-room' }, { name: 'leased-room' }];
const active = new Map([
  ['busy-room', [{ identity: 'guest-1' }]],
  ['leased-room', []],
]);
class RoomServiceClient {
  async listRooms(names) { return (names || []).filter(name => active.has(name)).map(name => ({ name })); }
  async listParticipants(room) { return active.get(room) || []; }
}
class NextResponse extends Response { static json(value, init = {}) { return new NextResponse(JSON.stringify(value), { ...init, headers: { 'content-type': 'application/json', ...init.headers } }); } }
const mocks = {
  'next/server': { NextRequest: class {}, NextResponse },
  'livekit-server-sdk': { RoomServiceClient },
  '@/lib/access': { canJoin: () => false, decryptRoomPassword: () => '', encryptRoomPassword: () => '', hashPassword: () => '', isStudio: () => false, roomVersion: () => '', sameOrigin: () => true, signAccess: () => '' },
  '@/lib/room-admin': { isRoomAdmin: async () => false },
  '@/lib/moderator-access': { isModerator: async () => true, verifiedRoomModeratorSession: async () => null },
  '@/lib/room-store': { readRooms: async () => rooms, updateRooms: async change => { rooms = change(rooms); return rooms; } },
  '@/lib/studio-control': { readStudioState: async room => room === 'leased-room' ? { primaryClientId: 'primary', leaseUntil: Date.now() + 60000 } : { primaryClientId: null, leaseUntil: 0 } },
  '../../../lib/studio-owner-access': { isStudioOwner: async () => false },
};
const originalLoad = Module._load;
Module._load = function (request, parent, isMain) { return Object.hasOwn(mocks, request) ? mocks[request] : originalLoad.call(this, request, parent, isMain); };
const route = require('../app/api/rooms/route.ts');
const request = data => ({ headers: { get: name => name === 'origin' ? 'https://studio.test' : null }, json: async () => data });

(async () => {
  let response = await route.POST(request({ action: 'rename', name: 'empty-room', newName: 'renamed-room' }));
  assert.equal(response.status, 200, 'an inactive empty room can be renamed');
  assert.ok(rooms.some(room => room.name === 'renamed-room'));
  response = await route.POST(request({ action: 'rename', name: 'busy-room', newName: 'busy-renamed' }));
  assert.equal(response.status, 409, 'a room with connected participants cannot be renamed');
  response = await route.POST(request({ action: 'rename', name: 'leased-room', newName: 'leased-renamed' }));
  assert.equal(response.status, 409, 'an active primary lease prevents rename');
  assert.ok(rooms.some(room => room.name === 'busy-room') && rooms.some(room => room.name === 'leased-room'));
  console.log('PASS: moderators can rename inactive empty rooms but cannot rename rooms with participants or a live primary lease');
})().catch(error => { console.error(error); process.exitCode = 1; });
