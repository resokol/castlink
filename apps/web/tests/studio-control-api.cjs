const assert = require('node:assert/strict');
const base = process.env.TEST_BASE_URL || 'http://127.0.0.1:3001';
const jars = { studio: '', admin: '', moderator: '' };
async function req(route, { method = 'GET', body, actor = true, origin } = {}) {
  const headers = { 'content-type': 'application/json' };
  const jar = actor === true ? 'studio' : typeof actor === 'string' ? actor : '';
  if (jar && jars[jar]) headers.cookie = jars[jar];
  if (origin) headers.origin = origin;
  const response = await fetch(base + route, { method, headers, ...(body !== undefined ? { body: JSON.stringify(body) } : {}) });
  const cookie = response.headers.get('set-cookie'); if (jar && cookie) jars[jar] = cookie.split(';')[0];
  return response;
}
const post = (body, options = {}) => req('/api/studio-control', { method: 'POST', body, ...options });
(async () => {
  const room = `test-control-${Date.now()}`;
  const unicodeRoom = `Комната с пробелом ${Date.now()}`;
  const specialRooms = [room, unicodeRoom, '__proto__', 'constructor'];
  try {
  assert.equal((await post({ action: 'join', room, clientId: 'client-primary-1234' })).status, 401);
  assert.equal((await req(`/api/token?room=${room}&role=studio-panel&clientId=client-primary-1234&epoch=1`, { actor: false })).status, 401, 'unauthenticated primary token attempt');
  assert.equal((await req('/api/auth?kind=studio')).status, 200);
  assert.equal((await req('/api/auth', { method: 'POST', body: { kind: 'studio', password: process.env.TEST_STUDIO_PASSWORD || 'test-studio-password' } })).status, 200);
  for (const name of specialRooms) assert.equal((await req('/api/rooms', { method: 'POST', body: { action: 'create', name } })).status, 200);
  const adminGrant = await (await req('/api/admin-access', { method: 'POST', body: { action: 'create', room } })).json();
  const adminInvite = decodeURIComponent(adminGrant.path.split('#invite=')[1]);
  assert.equal((await req('/api/admin-access', { method: 'POST', body: { action: 'accept', room, invite: adminInvite }, actor: 'admin' })).status, 200);
  const moderatorGrant = await (await req('/api/moderator-access', { method: 'POST', body: { action: 'create', room } })).json();
  const moderatorInvite = decodeURIComponent(moderatorGrant.path.split('#invite=')[1]);
  assert.equal((await req('/api/moderator-access', { method: 'POST', body: { action: 'accept', room, invite: moderatorInvite }, actor: 'moderator' })).status, 200);
  const primaryId = 'client-primary-1234', moderatorId = 'client-moderator-1234';
  let response = await post({ action: 'join', room, clientId: primaryId }); assert.equal(response.status, 200);
  let snapshot = await response.json(); assert.equal(snapshot.role, 'primary'); assert.equal(snapshot.revision, 0); assert.deepEqual(snapshot.desired, { fps: 60, bitrate: 12000, gain: 100, onAir: false, preview: false, videoDeviceId: null, audioDeviceId: null, outputDeviceId: null, deviceRevision: 0 });
  response = await post({ action: 'join', room, clientId: moderatorId }); assert.equal(response.status, 200);
  snapshot = await response.json(); assert.equal(snapshot.role, 'moderator'); assert.equal(snapshot.primaryOnline, true); assert.equal('primaryClientId' in snapshot, false);
  assert.equal((await post({ action: 'claim', room, clientId: moderatorId })).status, 409);
  assert.equal((await req(`/api/token?room=${room}&role=studio-panel&clientId=${moderatorId}&epoch=${snapshot.epoch}`)).status, 403, 'moderator cannot mint publishing primary token');
  const epoch = snapshot.epoch;
  const devices = [
    { deviceId: 'cam-main', label: 'Camera', kind: 'videoinput' },
    { deviceId: 'mic-main', label: 'Microphone', kind: 'audioinput' },
    { deviceId: 'sink-main', label: 'Speakers', kind: 'audiooutput' },
    { deviceId: 'default', label: 'System output', kind: 'audiooutput' },
  ];
  assert.equal((await post({ action: 'heartbeat', room, clientId: primaryId, epoch, actual: { devices, onAir: false } })).status, 200);
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { videoDeviceId: 'cam-main' } }, { actor: 'admin' })).status, 200, 'room admin can select a listed primary camera');
  snapshot = await (await req(`/api/studio-control?room=${room}&clientId=${moderatorId}`)).json();
  snapshot = await (await req(`/api/studio-control?room=${room}&clientId=${moderatorId}`, { actor: 'studio' })).json();
  assert.equal(snapshot.desired.videoDeviceId, 'cam-main', 'owner sees selected primary device');
  snapshot = await (await req(`/api/studio-control?room=${room}&clientId=${moderatorId}`, { actor: 'admin' })).json();
  assert.equal(snapshot.desired.videoDeviceId, 'cam-main', 'room admin sees selected primary device');
  snapshot = await (await req(`/api/studio-control?room=${room}&clientId=${moderatorId}`, { actor: 'moderator' })).json();
  assert.equal(snapshot.desired.videoDeviceId, null, 'moderator never receives selected device IDs');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { outputDeviceId: 'sink-main' } }, { actor: 'moderator' })).status, 403, 'moderator cannot command primary devices');
  assert.equal((await req(`/api/studio-control?room=${room}&clientId=${moderatorId}`, { actor: false })).status, 401, 'guest cannot read primary device state');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { outputDeviceId: 'sink-main' } }, { actor: false })).status, 401, 'guest cannot command primary devices');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { videoDeviceId: 'mic-main' } })).status, 400, 'device IDs cannot cross device kinds');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { audioDeviceId: 'missing' } })).status, 400, 'device must be in current primary device list');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { outputDeviceId: 'default' } })).status, 200, 'supported system output can be selected');
  assert.equal((await post({ action: 'heartbeat', room, clientId: primaryId, epoch, actual: { devices, onAir: true } })).status, 200);
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { audioDeviceId: 'mic-main' } })).status, 400, 'microphone switching is blocked while on air');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { outputDeviceId: 'sink-main' } }, { actor: 'admin' })).status, 200, 'room admin can switch output while on air');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { audioDeviceId: null } })).status, 400, 'null device IDs are rejected');
  assert.equal((await post({ action: 'heartbeat', room, clientId: primaryId, epoch, actual: { devices, onAir: false, airBusy: true } })).status, 200);
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { audioDeviceId: 'mic-main' } })).status, 400, 'input switch is blocked while the air transition is busy');
  assert.equal((await post({ action: 'heartbeat', room, clientId: primaryId, epoch, actual: { devices, onAir: false, airBusy: false } })).status, 200);
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { onAir: true, audioDeviceId: 'mic-main' } })).status, 400, 'mixed on-air and input command is rejected');
  assert.equal((await post({ action: 'command', room, clientId: primaryId, epoch: snapshot.epoch, patch: { bitrate: 12000 } })).status, 200, '12,000 kbps is accepted');
  assert.equal((await post({ action: 'command', room, clientId: primaryId, epoch: snapshot.epoch, patch: { bitrate: 13000 } })).status, 400, '13,000 kbps is rejected');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch: snapshot.epoch, patch: { fps: 60, bitrate: 8500, gain: 125, onAir: true, preview: true } })).status, 200);
  snapshot = await (await req(`/api/studio-control?room=${room}&clientId=${moderatorId}`)).json();
  assert.equal(snapshot.revision, 5); assert.deepEqual(snapshot.desired, { fps: 60, bitrate: 8500, gain: 125, onAir: true, preview: true, videoDeviceId: null, audioDeviceId: null, outputDeviceId: 'sink-main', deviceRevision: 3 });
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch: snapshot.epoch, patch: { fps: 24 } })).status, 400);
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch: snapshot.epoch, patch: { onAir: 'yes' } })).status, 400);
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch: snapshot.epoch, patch: { unknown: true } })).status, 400);
  assert.equal((await req('/api/studio-control', { method: 'POST', body: { action: 'command', room, clientId: moderatorId, epoch: snapshot.epoch, patch: { fps: 30 } }, origin: 'https://evil.example' })).status, 403);
  const oversized = await fetch(base + '/api/studio-control', { method: 'POST', headers: { 'content-type': 'application/json', cookie: jars.studio }, body: JSON.stringify({ action: 'command', room, clientId: moderatorId, epoch: snapshot.epoch, patch: { preview: true }, filler: 'x'.repeat(17000) }) });
  assert.equal(oversized.status, 413);
  const main = await (await req(`/api/token?room=${room}&role=studio-panel&clientId=${primaryId}&epoch=${snapshot.epoch}`)).json();
  const moderator = await (await req(`/api/token?room=${room}&role=studio-moderator&clientId=${moderatorId}&identity=studio-panel-forged`)).json();
  const claims = token => JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
  assert.equal(main.identity, 'studio-panel-main'); assert.equal(claims(main.token).video.canPublish, true); assert.equal(JSON.parse(claims(main.token).metadata).clientId, undefined);
  assert.ok(moderator.identity.startsWith('studio-moderator-') && moderator.identity.endsWith(`-${moderatorId}`)); assert.equal(claims(moderator.token).video.canPublish, true); assert.deepEqual(claims(moderator.token).video.canPublishSources, ['microphone', 'camera', 'screen_share', 'screen_share_audio']);
  assert.equal(claims(moderator.token).video.canPublishData, false);
  response = await post({ action: 'heartbeat', room, clientId: primaryId, epoch }); assert.equal(response.status, 200);
  response = await post({ action: 'release', room, clientId: primaryId, epoch }); assert.equal(response.status, 200);
  response = await post({ action: 'claim', room, clientId: moderatorId }); assert.equal(response.status, 200);
  const takeover = await response.json(); assert.equal(takeover.role, 'primary'); assert.ok(takeover.epoch > epoch); assert.equal(takeover.desired.onAir, false); assert.equal(takeover.desired.preview, false); assert.equal(takeover.desired.videoDeviceId, null); assert.equal(takeover.desired.audioDeviceId, null); assert.equal(takeover.desired.outputDeviceId, null); assert.equal(takeover.desired.deviceRevision, 0); assert.equal(takeover.actual, null);
  assert.equal((await post({ action: 'heartbeat', room, clientId: primaryId, epoch })).status, 409, 'old primary is fenced after takeover');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { fps: 30 } })).status, 409, 'stale command epoch is rejected');
  assert.equal((await post({ action: 'command', room, clientId: moderatorId, epoch, patch: { videoDeviceId: 'cam-main' } })).status, 409, 'stale device command epoch is rejected');
  assert.equal((await post({ action: 'join', room: '__proto__', clientId: primaryId })).status, 200, 'prototype key room is safe');
  } finally {
    for (const name of specialRooms) await req('/api/rooms', { method: 'POST', body: { action: 'delete', name } }).catch(() => {});
  }
  console.log('PASS: studio primary lease, moderator command authorization, validation, bounded requests, and non-publishing moderator token');
})().catch(error => { console.error(error); process.exitCode = 1; });
