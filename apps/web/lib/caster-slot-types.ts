export type SlotScope = { studioId: string; roomAssociation: string };
export type CasterSession = { sessionId: string; identity: string; generation?: number; participantSid?: string; legacy?:boolean };
export type CasterSlot = { id: string; scope: SlotScope; name: string; inviteId: string; revision: number; assignment: CasterSession | null; phase: "empty" | "preparing" | "assigned" | "disconnected"; transition?: "assign"|"release"; previousAssignment?: CasterSession|null; outputVersions: {camera: string; screen: string} };
export type PersonalCasterInvite = { id: string; scope: SlotScope; version: string; enabled: boolean };
export class CasterSlotConflict extends Error { readonly status = 409; }
export function sameSlotScope(a: SlotScope, b: SlotScope) { return a.studioId === b.studioId && a.roomAssociation === b.roomAssociation; }
