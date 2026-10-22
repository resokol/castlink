const assert = require('node:assert/strict');
const fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript'), Module = require('node:module');
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, f);
const { validateImageTransform } = require('../lib/multiview-image.ts');
let role = 'guest', origin = true, online = true, updates = [], sent = [], remembered = [];
const originalMetadata = { role: 'guest', studioId: 'tenant-one', entrySettings: { noGuestAudio: true }, videoRotation: 90, keep: 'unchanged' };
let participant = { sid: 'PA-current', metadata: JSON.stringify(originalMetadata), tracks: [] };
class NextResponse extends Response { static json(body, init) { return new Response(JSON.stringify(body), init); } }
class RoomServiceClient {
  async getParticipant(room, identity) { assert.equal(room, 'tenant-one/one'); assert.equal(identity, 'guest-one'); if (!online) throw Error('offline'); return participant; }
  async updateParticipant(room, identity, data) { updates.push({ room, identity, data }); participant = { ...participant, metadata: data.metadata }; }
  async sendData(...args) { sent.push(args); }
}
const imports = {
  "../../../lib/guest-session-settings": { rememberGuestSessionSettings(...args) {remembered.push(args);} },
  "../../../lib/talkback-session": { privateTalkbackForGuest: () => undefined },
  '../../../lib/multiview-image': { validateImageTransform },
  '../../../lib/rate-limit': require('./helpers/rate-limit.cjs'),
  'next/server': { NextResponse }, 'livekit-server-sdk': { RoomServiceClient },
  '@/lib/access': { sameOrigin: () => origin },
  '@/lib/room-admin': { isRoomAdmin: async (_, room, studio) => role === 'admin' && room === 'one' && studio === 'tenant-one' },
  '@/lib/moderator-access': { isModerator: async () => role === 'moderator' },
  '@/lib/room-store': { readRooms: async () => [{ name: 'one' }] },
  '../../../lib/room-studio-access': { canHostNamedRoom: async (_, room, studio) => role === 'owner' && room === 'one' && studio === 'tenant-one' },
  '../../../lib/studio-scope': { defaultStudioId: () => 'tenant-one', validateStudioId: value => value || 'tenant-one', mediaRoomName: (studio, room) => `${studio}/${room}` },
};
const m = { exports: {} };
vm.runInNewContext(ts.transpileModule(fs.readFileSync(require.resolve('../app/api/participants/route.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { module: m, exports: m.exports, require: name => imports[name], process: { env: {} }, Response, TextEncoder });
const transform = { zoom: 2, panX: -.2, panY: .3, rotation: 45, flipX: true, flipY: false, cropTop: .1, cropRight: .2, cropBottom: .3, cropLeft: .4, exposure: .75, contrast: 1.3 };
const post = (extra = {}) => m.exports.POST({ headers: new Headers(), json: async () => ({ action: 'image-transform', studioId: 'tenant-one', room: 'one', identity: 'guest-one', participantSid: 'PA-current', transform, ...extra }) });
(async () => {
  assert.equal((await post()).status, 401, 'guest cannot change studio rendering');
  role = 'moderator'; assert.equal((await post()).status, 403, 'moderator cannot change studio rendering');
  role = 'owner';
  const applied = await post(); assert.equal(applied.status, 200, 'owner applies a receiver-side image transform');
  assert.deepEqual((await applied.json()).transform, transform);
  assert.deepEqual(JSON.parse(updates[0].data.metadata), { ...originalMetadata, studioImageTransform: transform }, 'other metadata and permission flags survive');
  assert.deepEqual(JSON.parse(JSON.stringify(remembered[0])),['tenant-one',{name:'one'},'guest-one',{...originalMetadata,studioImageTransform:transform}],'only confirmed current metadata including correction enters reconnect retention');
  assert.equal(sent.length, 0, 'receiver transform never sends a guest device/media command');
  role = 'admin'; assert.equal((await post({ transform: {} })).status, 200, 'administrator can reset receiver rendering');
  assert.deepEqual(JSON.parse(updates.at(-1).data.metadata).studioImageTransform, {});
  assert.equal((await post({ room: 'foreign' })).status, 401);
  assert.equal((await post({ studioId: 'tenant-two' })).status, 401);
  assert.equal((await post({ identity: 'studio-panel-main' })).status, 403);
  assert.equal((await post({ participantSid: 'PA-previous' })).status, 409, 'old SID cannot change replacement session');
  assert.equal((await post({ participantSid: '' })).status, 400);
  for (const invalid of [{ zoom: 6 }, { cropLeft: .46 }, { rotation: 181 }, { panY: -2 }, { flipX: 'yes' }, {exposure:-2.01}, {exposure:2.01}, {exposure:'1'}, {exposure:NaN}, {exposure:Infinity}, {contrast:-.01}, {contrast:2.01}, {contrast:'1'}, {contrast:null}, {contrast:NaN}, {contrast:Infinity}, null]) assert.equal((await post({ transform: invalid })).status, 400, 'invalid transform rejected');
  for (const metadata of [{ role: 'guest', studioId: 'tenant-two' }, { role: 'studio-panel', studioId: 'tenant-one' }, { role: 'guest' }, []]) {
    participant = { ...participant, metadata: JSON.stringify(metadata) }; assert.equal((await post()).status, 403, 'target requires authenticated guest studio metadata');
  }
  participant = { ...participant, metadata: JSON.stringify(originalMetadata) };
  online = false; assert.equal((await post()).status, 409, 'offline caster cannot accept stale edit'); online = true;
  origin = false; assert.equal((await post()).status, 403);
  assert.equal(updates.length, 2, 'denied actions never write metadata');
  assert.equal(remembered.length,2,'denied and stale actions never retain correction');
  assert.equal(sent.length, 0);
  console.log('PASS studio receiver image transform authorization, SID rejection, bounds, metadata preservation and no guest commands');
})().catch(error => { console.error(error); process.exitCode = 1; });
