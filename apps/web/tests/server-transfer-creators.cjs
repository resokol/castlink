const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const Module = require('node:module');
const ts = require('typescript');
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-transfer-creators-'));
Object.assign(process.env, {
  CASTLINK_STORAGE_BACKEND: 'json', STUDIOLINK_DATA_DIR: dir,
  STUDIOLINK_ROOMS_FILE: path.join(dir, 'rooms.json'),
  STUDIOLINK_TRANSFER_STATE_FILE: path.join(dir, 'transfer.json'),
  CASTLINK_SESSION_SECRET: 'creator-transfer-signing-secret-more-than-32-characters',
  LIVEKIT_API_KEY: 'transfer-test-key', LIVEKIT_API_SECRET: 'transfer-test-secret',
  STUDIOLINK_TRANSFER_SECRET: 'paired-transfer-secret-more-than-32-characters',
  STUDIOLINK_TRANSFER_SERVER_ID: 'source', STUDIOLINK_TRANSFER_ORIGIN: 'https://source.example',
  STUDIOLINK_TRANSFER_PEER_ORIGIN: 'https://target.example',
  STUDIOLINK_TRANSFER_TARGETS_JSON: JSON.stringify([{ id: 'target', label: 'Reserve', origin: 'https://target.example' }]),
});
delete process.env.STUDIOLINK_STUDIO_PASSWORD_HASH;
const resolve = Module._resolveFilename;
Module._resolveFilename = function(id, ...args) { return resolve.call(this, id.startsWith('@/') ? path.resolve(__dirname, '..', id.slice(2)) : id, ...args); };
require.extensions['.ts'] = (m, f) => m._compile(ts.transpileModule(fs.readFileSync(f, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText, f);
const { NextRequest, NextResponse } = require('next/server');
const sdk = require('livekit-server-sdk');
sdk.RoomServiceClient.prototype.listRooms = async () => [];
sdk.RoomServiceClient.prototype.listParticipants = async () => [];
const originalFetch = global.fetch;
let primaryJwt='',primaryClientId='';
const request = (body, cookie = '', query = '') => new NextRequest('https://source.example/api/server-transfer' + query, { method: body ? 'POST' : 'GET', headers: { host: 'source.example', origin: 'https://source.example', cookie, 'content-type': 'application/json',...(primaryJwt && body?.action==='start'?{authorization:'Bearer '+primaryJwt}:{}) }, ...(body ? { body: JSON.stringify({...body,...(body.action==='start'?{clientId:primaryClientId}:{})}) } : {}) });

(async () => {
  const creatorApi = require('../app/api/room-studio-access/route.ts');
  const transferApi = require('../app/api/server-transfer/route.ts');
  const rooms = require('../lib/room-store.ts');
  const access = require('../lib/access.ts');
  const creatorAccess = require('../lib/room-studio-access.ts');
  const create = name => creatorApi.POST(new NextRequest('https://source.example/api/room-studio-access', { method: 'POST', headers: { host: 'source.example', origin: 'https://source.example' }, body: JSON.stringify({ action: 'create', name, studioPassword: 'studio-secret', password: 'guest-secret' }) }));
  const created = await create('mine');
  const cookie = created.headers.get('set-cookie').split(';')[0];
  await create('foreign');
  const sourceRoom = (await rooms.readRooms()).find(room => room.name === 'mine');
  const sourceControl=require('../lib/studio-control.ts');primaryClientId=require('node:crypto').randomUUID();
  await sourceControl.joinStudio('mine',primaryClientId);
  const mainToken=new sdk.AccessToken(process.env.LIVEKIT_API_KEY,process.env.LIVEKIT_API_SECRET,{identity:'studio-panel-main',metadata:JSON.stringify({role:'studio-panel',studioId:'studio-default',clientId:primaryClientId,transferAuthorization:{kind:'creator',roomId:sourceRoom.creatorAccessId,creatorAccessId:sourceRoom.creatorAccessId,credentialVersion:access.roomVersion(sourceRoom.studioPasswordHash),expiresAt:Date.now()+60000}})});mainToken.addGrant({roomJoin:true,room:'mine'});primaryJwt=await mainToken.toJwt();
  const originalBytes = fs.readFileSync(process.env.STUDIOLINK_ROOMS_FILE, 'utf8');
  global.fetch = async () => { throw new Error('target unreachable'); };
  const failed = await transferApi.POST(request({ action: 'start', room: 'mine', targetId: 'target' }, cookie));
  assert.equal(failed.status, 502, 'a creator can initiate their own room transfer');
  assert.equal(fs.readFileSync(process.env.STUDIOLINK_ROOMS_FILE, 'utf8'), originalBytes, 'unavailable target must leave source room bytes unchanged');
  assert.equal((await transferApi.POST(request({ action: 'start', room: 'foreign', targetId: 'target' }, cookie))).status, 401, 'creator cannot transfer another room');
  assert.equal((await transferApi.GET(request(null, cookie, '?room=mine'))).status, 200, 'creator can inspect the configured pair for their room');
  assert.equal((await transferApi.GET(request(null, cookie, '?room=foreign'))).status, 401, 'pair catalog remains room scoped');
  const cookieName = cookie.split('=')[0];
  const claims = access.readAccess(cookie.split('=')[1]);
  const expiredCookie = cookieName + '=' + access.signAccess({ kind: claims.kind, studio: claims.studio, id: claims.id, version: claims.version }, -1);
  assert.equal((await transferApi.POST(request({ action: 'start', room: 'mine', targetId: 'target' }, expiredCookie))).status, 401);
  const response = NextResponse.json({});
  const sourceExpiry = Date.now() + 45_000;
  creatorAccess.setRoomStudioCookie(response, request(null), sourceRoom, 'studio-default', sourceExpiry);
  const carriedCookie = response.headers.get('set-cookie').split(';')[0];
  const carried = access.readAccess(carriedCookie.split('=')[1]);
  assert.ok(carried.exp <= sourceExpiry, 'transferred cookie must not extend original creator authorization');
  assert.ok(carried.exp > Date.now());
  assert.equal(carried.kind, 'room-studio');
  assert.equal(await require('../lib/studio-owner-access.ts').isStudioOwner(request(null, carriedCookie), 'studio-default'), false, 'creator receives no server-wide owner authority');
  const transfer = require('../lib/server-transfer.ts');
  const incoming = { ...sourceRoom, name: 'incoming', transferRoomId: require('node:crypto').randomUUID() };
  const authorization = { kind: 'creator', expiresAt: sourceExpiry, roomId: incoming.transferRoomId, creatorAccessId: incoming.creatorAccessId, credentialVersion: access.roomVersion(incoming.studioPasswordHash) };
  const prepare = async roomRecord => {
    const payload = { action: 'prepare', sourceOrigin: 'https://target.example', transferId: require('node:crypto').randomUUID().replaceAll('-', ''), roomRecord, authorization };
    const timestamp = String(Date.now()), nonce = require('node:crypto').randomUUID().replaceAll('-', ''), raw = JSON.stringify(payload);
    return transferApi.POST(new NextRequest('https://source.example/api/server-transfer?action=bridge', { method: 'POST', headers: { 'x-studiolink-transfer-time': timestamp, 'x-studiolink-transfer-nonce': nonce, 'x-studiolink-transfer-signature': transfer.signBridge(timestamp, nonce, raw) }, body: raw }));
  };
  const control = require('../lib/studio-control.ts');
  await rooms.updateRooms(list => [...list, incoming]);
  const activeTarget = await control.joinStudio('incoming', 'existing-target-studio-client');
  const targetBytes = fs.readFileSync(process.env.STUDIOLINK_ROOMS_FILE, 'utf8');
  assert.equal((await prepare(incoming)).status, 409, 'prepare cannot reset an already active target studio');
  assert.equal(fs.readFileSync(process.env.STUDIOLINK_ROOMS_FILE, 'utf8'), targetBytes);
  assert.equal((await control.readStudioState('incoming')).primaryClientId, 'existing-target-studio-client');
  await control.releaseStudio('incoming', 'existing-target-studio-client', activeTarget.state.epoch);
  const prepared = await prepare(incoming);
  assert.equal(prepared.status, 200);
  const ticket = (await prepared.json()).ticket;
  const accepted = await transferApi.POST(request({ action: 'accept', ticket }));
  assert.equal(accepted.status, 200);
  const acceptedState = await accepted.json();
  assert.equal(acceptedState.entryPath, '/', 'transferred creator returns to the ordinary home studio');
  assert.match(acceptedState.clientId, /^[a-zA-Z0-9_-]{12,80}$/, 'target primary ID comes from the trusted ticket');
  const secondary = await control.joinStudio('incoming', 'additional-studio-client-first');
  assert.equal(secondary.role, 'moderator', 'secondary arriving first cannot seize transferred primary');
  const main = await control.joinStudio('incoming', acceptedState.clientId);
  assert.equal(main.role, 'primary');
  await control.releaseStudio('incoming', acceptedState.clientId, main.state.epoch);
  const installed = (await rooms.readRooms()).find(room => room.name === 'incoming');
  assert.equal(installed.creatorAccessId, sourceRoom.creatorAccessId);
  assert.equal(installed.studioPasswordHash, sourceRoom.studioPasswordHash);
  const acceptedCookie = accepted.headers.get('set-cookie').split(';')[0];
  assert.match(acceptedCookie, /^castlink-room-studio-/);
  assert.equal(await creatorAccess.canHostRoom(request(null, acceptedCookie), installed, 'studio-default'), true);
  assert.equal(await creatorAccess.canHostRoom(request(null, acceptedCookie), (await rooms.readRooms()).find(room => room.name === 'foreign'), 'studio-default'), false);
  assert.equal(await require('../lib/studio-owner-access.ts').isStudioOwner(request(null, acceptedCookie), 'studio-default'), false);
  assert.equal((await transferApi.POST(request({ action: 'accept', ticket }))).status, 401, 'creator ticket is single use');
  const stalePrepared = await prepare(incoming);
  const staleTicket = (await stalePrepared.json()).ticket;
  const stalePrimary = await control.readStudioState('incoming');
  await control.releaseStudio('incoming', stalePrimary.primaryClientId, stalePrimary.epoch);
  await rooms.updateRooms(list => list.map(room => room.name === 'incoming' ? { ...room, studioPasswordHash: access.hashPassword('new-studio-password') } : room));
  assert.equal((await transferApi.POST(request({ action: 'accept', ticket: staleTicket }))).status, 401, 'target password rotation revokes a prepared creator ticket');
  await rooms.updateRooms(list => list.map(room => room.name === 'incoming' ? installed : room));
  const recreatedPrepared = await prepare(incoming);
  const recreatedTicket = (await recreatedPrepared.json()).ticket;
  const recreatedPrimary = await control.readStudioState('incoming');
  await control.releaseStudio('incoming', recreatedPrimary.primaryClientId, recreatedPrimary.epoch);
  await rooms.updateRooms(list => list.map(room => room.name === 'incoming' ? { ...room, creatorAccessId: require('node:crypto').randomUUID() } : room));
  assert.equal((await transferApi.POST(request({ action: 'accept', ticket: recreatedTicket }))).status, 401, 'recreated target cannot inherit a previous creator ticket');
  assert.equal((await prepare(incoming)).status, 409, 'matching name and transfer ID cannot replace a different immutable creator');
  // A profile verified before asynchronous readiness/remote preparation cannot
  // publish room/lease/ticket effects after connection removal has completed.
  process.env.STUDIOLINK_INSTALLATION_ID=require('node:crypto').randomUUID();
  const profiles=require('../lib/server-profiles.ts'),removal=require('../lib/server-profile-removal.ts');
  const peer={id:require('node:crypto').randomUUID(),installationId:require('node:crypto').randomUUID(),origin:'https://target.example',label:'Removable reserve',secret:'c'.repeat(64),scope:{kind:'room',roomId:sourceRoom.creatorAccessId}};
  await profiles.putServerPeer(peer);
  let resumeReady,enteredReady;
  const readyEntered=new Promise(resolve=>{enteredReady=resolve;}),readyBarrier=new Promise(resolve=>{resumeReady=resolve;});
  const previousListRooms=sdk.RoomServiceClient.prototype.listRooms;
  sdk.RoomServiceClient.prototype.listRooms=async()=>{enteredReady();return readyBarrier;};
  const pendingRecord={...sourceRoom,name:'removed-incoming',transferRoomId:sourceRoom.creatorAccessId};
  const pendingPayload={action:'prepare',sourceOrigin:peer.origin,sourceInstallationId:peer.installationId,peerId:peer.id,transferId:require('node:crypto').randomUUID().replaceAll('-',''),roomRecord:pendingRecord,authorization:{...authorization,roomId:sourceRoom.creatorAccessId}};
  const stamp=String(Date.now()),pendingNonce=require('node:crypto').randomUUID().replaceAll('-',''),pendingRaw=JSON.stringify(pendingPayload);
  const pendingIncoming=transferApi.POST(new NextRequest('https://source.example/api/server-transfer?action=bridge',{method:'POST',headers:{'x-studiolink-transfer-time':stamp,'x-studiolink-transfer-nonce':pendingNonce,'x-studiolink-transfer-signature':transfer.signBridge(stamp,pendingNonce,pendingRaw,peer.secret)},body:pendingRaw}));
  await readyEntered;
  await removal.removeUnusedRoomServerPeer(peer,sourceRoom.creatorAccessId,async()=>{});
  resumeReady([]);assert.equal((await pendingIncoming).status,409);
  sdk.RoomServiceClient.prototype.listRooms=previousListRooms;
  assert.equal((await rooms.readRooms()).find(room=>room.name===pendingRecord.name),undefined,'removed incoming profile must not install a room');
  assert.equal((await control.readStudioState(pendingRecord.name)).primaryClientId,null,'removed incoming profile must not reserve a lease');
  assert.equal(await transfer.updateTransferState(s=>s.transfers[pendingPayload.transferId]),undefined,'removed incoming profile must not issue a transfer ticket');
  await profiles.putServerPeer(peer);
  let resumeRemote,enteredRemote;const remoteEntered=new Promise(resolve=>{enteredRemote=resolve;}),remoteBarrier=new Promise(resolve=>{resumeRemote=resolve;});
  const peerRequests=require('../lib/transfer-peer.ts'),originalPeerRequest=peerRequests.sendPeerBridge;
  peerRequests.sendPeerBridge=async()=>{enteredRemote();return remoteBarrier;};
  const beforeOutgoing=fs.readFileSync(process.env.STUDIOLINK_ROOMS_FILE,'utf8');
  const pendingOutgoing=transferApi.POST(request({action:'start',room:'mine',targetId:peer.id},cookie));
  await remoteEntered;await removal.removeUnusedRoomServerPeer(peer,sourceRoom.creatorAccessId,async()=>{});
  resumeRemote({ticket:'test-ticket-'+ 'A'.repeat(32)});assert.equal((await pendingOutgoing).status,502);
  peerRequests.sendPeerBridge=originalPeerRequest;
  assert.equal(fs.readFileSync(process.env.STUDIOLINK_ROOMS_FILE,'utf8'),beforeOutgoing,'removed outgoing profile must not mutate source room');
  assert.equal(await transfer.updateTransferState(s=>s.active.mine),undefined,'removed outgoing profile must not publish an active transfer');
  console.log('PASS: creator transfer scope, unavailable target preserves source, original expiry and no global elevation');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { global.fetch = originalFetch; fs.rmSync(dir, { recursive: true, force: true }); });
