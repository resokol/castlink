import { randomUUID } from 'node:crypto';
import { getIncomingServerPeer, listRoomServerProfiles, serverProfileIdentity, type ServerPeer } from './server-profiles';
import { requestServerPeer } from './server-peer-request';
import { signBridge, verifyBridge, transferTargets, peerOriginAllowed, transferSecret, type TransferTarget } from './server-transfer';
export type RoomTransferTarget = TransferTarget & { peer?: ServerPeer };
export async function roomTransferTargets(roomId: string): Promise<RoomTransferTarget[]> {
  const profiles = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(roomId) && process.env.STUDIOLINK_INSTALLATION_ID ? await listRoomServerProfiles(roomId) : [];
  return [...profiles.map(peer => ({ id: peer.id, label: peer.label, origin: peer.origin, peer })), ...transferTargets().filter(t => !profiles.some(p => p.id === t.id))];
}
export async function transferIdentity() {
  try { return await serverProfileIdentity(); } catch { return { id: process.env.STUDIOLINK_TRANSFER_SERVER_ID || '', label: process.env.STUDIOLINK_TRANSFER_SERVER_LABEL || '', installationId: '', origin: process.env.STUDIOLINK_TRANSFER_ORIGIN || '' }; }
}
export async function targetRequest(target: RoomTransferTarget, pathname: string, options: { method?: string; body?: string; headers?: Record<string,string>; timeoutMs?: number } = {}) {
  return target.peer ? requestServerPeer(target.peer, pathname, options) : fetch(target.origin + pathname, { method: options.method, body: options.body, headers: options.headers, cache:'no-store', redirect:'error', signal:AbortSignal.timeout(options.timeoutMs || 7000) });
}
export async function sendPeerBridge(target: RoomTransferTarget, payload: Record<string,unknown>, route = '/api/server-transfer') {
  const identity = await transferIdentity();
  const body = JSON.stringify({ ...payload, sourceOrigin: target.peer ? identity.origin : process.env.STUDIOLINK_TRANSFER_ORIGIN || '', ...(target.peer ? { peerId: target.peer.id, sourceInstallationId: identity.installationId } : {}) });
  const timestamp = String(Date.now()), nonce = randomUUID().replaceAll('-','');
  const response = await targetRequest(target, route+'?action=bridge', {method:'POST', body, timeoutMs:7000, headers: {'content-type':'application/json','x-studiolink-transfer-time':timestamp,'x-studiolink-transfer-nonce':nonce,'x-studiolink-transfer-signature':signBridge(timestamp,nonce,body,target.peer?.secret)}});
  const data = await response.json().catch(()=>({}));
  if (!response.ok) throw Object.assign(new Error(data.error || `Целевой сервер ответил ${response.status}`), {status:response.status});
  return data;
}
export async function verifyPeerBridge(data: any, raw: string, headers: Headers): Promise<{peer?:ServerPeer}|null> {
  const peer = typeof data.peerId === 'string' ? await getIncomingServerPeer(data.peerId) : undefined;
  if (data.peerId && (!peer || peer.origin !== data.sourceOrigin || peer.installationId !== data.sourceInstallationId || peer.scope.kind === 'room' && peer.scope.roomId !== (data.roomId || data.roomRecord?.transferRoomId || data.authorization?.roomId))) return null;
  if (!peer && (!transferSecret() || !peerOriginAllowed(data.sourceOrigin))) return null;
  return verifyBridge(headers.get('x-studiolink-transfer-time') || '', headers.get('x-studiolink-transfer-nonce') || '',raw,headers.get('x-studiolink-transfer-signature') || '',peer?.secret) ? {peer:peer || undefined} : null;
}
