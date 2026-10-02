type ParticipantName = { identity: string; name?: string };
type Reservation = { name: string; expiresAt: number };
const reservations = new Map<string, Map<string, Reservation>>();
const ttlMs = 5 * 60_000;
const maxRooms = 4096, maxPendingPerRoom = 256;

/** Close the concurrent-token gap before LiveKit sees the new participant.
 * This registry is node-process-local; multi-replica web requires shared reservations.
 * The active LiveKit participant list remains the source for connected identities.
 */
export function reserveStaffDisplayName(mediaRoom: string, identity: string, label: string, requested: string, participants: ParticipantName[], now = Date.now()) {
  const manual = requested.trim().slice(0,120);
  if (manual) return manual;
  for (const [key, group] of reservations) {
    for (const [id, entry] of group) if (entry.expiresAt <= now) group.delete(id);
    if (!group.size) reservations.delete(key);
  }
  const key = JSON.stringify([mediaRoom,label]);
  let pending = reservations.get(key);
  const current = participants.find(participant => participant.identity === identity)?.name?.trim();
  if (current) return current.slice(0,120);
  const prior = pending?.get(identity);
  if (prior) return prior.name;
  if ((!pending && reservations.size >= maxRooms) || (pending && pending.size >= maxPendingPerRoom)) throw new Error("staff_name_reservations_full");
  if (!pending) { pending = new Map(); reservations.set(key,pending); }
  const used = new Set([...participants.map(participant => participant.name || ""), ...[...pending.values()].map(entry => entry.name)]);
  let index = 1;
  while (used.has(`${label} ${index}`)) index++;
  const name = `${label} ${index}`;
  pending.set(identity,{name,expiresAt:now+ttlMs});
  return name;
}
