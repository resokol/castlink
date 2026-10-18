import { randomUUID } from "node:crypto";
export type ParticipantRoleOffer = {
  id: string; studioId: string; room: string; association: string; identity: string; participantSid: string;
  role: "admin" | "moderator"; expiresAt: number; grantExpiresAt: number; ownerVersion?: string;
};
const key = Symbol.for("castlink.participant-role-offers");
const shared = globalThis as typeof globalThis & { [key]?: Map<string, ParticipantRoleOffer> };
const offers = shared[key] ||= new Map<string, ParticipantRoleOffer>();
function prune() { for (const [id, offer] of offers) if (offer.expiresAt <= Date.now()) offers.delete(id); }
export function createParticipantRoleOffer(value: Omit<ParticipantRoleOffer, "id" | "expiresAt">) {
  prune();
  for (const [id, offer] of offers) if (offer.studioId === value.studioId && offer.room === value.room && offer.identity === value.identity) offers.delete(id);
  if (offers.size >= 512) throw new Error("Слишком много ожидающих назначений");
  const offer = { ...value, id: randomUUID(), expiresAt: Math.min(Date.now() + 90_000, value.grantExpiresAt) };
  offers.set(offer.id, offer); return offer;
}
export function readParticipantRoleOffer(id: string) { prune(); return offers.get(id); }
export function findParticipantRoleOffer(studioId: string, room: string, identity: string, participantSid: string) {
  prune(); return Array.from(offers.values()).find(offer => offer.studioId === studioId && offer.room === room && offer.identity === identity && offer.participantSid === participantSid);
}
/** Consume synchronously before asynchronous credential writes. */
export function consumeParticipantRoleOffer(id: string) { const offer = readParticipantRoleOffer(id); if (offer) offers.delete(id); return offer; }
