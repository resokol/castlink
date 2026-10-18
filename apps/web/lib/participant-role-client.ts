export type ParticipantStaffRole = 'admin' | 'moderator';
export type ParticipantRoleOffer = { id: string; role: ParticipantStaffRole; expiresAt: number };
export function parseParticipantRoleOffer(value: unknown, now = Date.now()): ParticipantRoleOffer | undefined {
  const offer = (value as { offer?: Partial<ParticipantRoleOffer> } | undefined)?.offer;
  if (!offer || typeof offer.id !== 'string' || !offer.id || offer.id.length > 200 || !['admin', 'moderator'].includes(offer.role || '') || !Number.isSafeInteger(offer.expiresAt) || offer.expiresAt! <= now) return;
  return { id: offer.id, role: offer.role!, expiresAt: offer.expiresAt! };
}
export async function acceptParticipantRoleOffer({ token, studioId, roomName, offer, origin }: {
  token: string; studioId: string; roomName: string; offer: ParticipantRoleOffer; origin: string;
}) {
  const response = await fetch('/api/participant-role', { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` }, body: JSON.stringify({ action: 'accept', studioId, room: roomName, id: offer.id }), credentials: 'same-origin', signal: AbortSignal.timeout(10000) });
  const data = await response.json();
  if (!response.ok || data.allowed !== true) throw new Error(data.error || 'Не удалось принять назначение.');
  let panel: URL;
  try { panel = new URL(data.panelPath, origin); } catch { throw new Error('Некорректный адрес панели.'); }
  if (data.role !== offer.role || panel.origin !== origin || panel.pathname !== (offer.role === 'admin' ? '/admin' : '/moderator') || panel.searchParams.get('studioId') !== studioId || panel.searchParams.get('room') !== roomName || panel.hash) throw new Error('Некорректный адрес панели.');
  return `${panel.pathname}${panel.search}`;
}
