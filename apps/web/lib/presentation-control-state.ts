import { createHash, randomBytes, randomUUID } from "node:crypto";
import { PRESENTATION_COMMAND_TTL, PRESENTATION_HEARTBEAT_TTL, type PresentationCommand, type PresentationKind, type PresentationResult, type PresentationSession, type PresentationStatus } from "./presentation-control";
export type PresentationPrincipal = { identity: string; sid: string };
export type PresentationBinding = { studioId: string; room: string; version: string };
export type PresentationEntry = {
  id: string; binding: PresentationBinding; kind: PresentationKind; owner: PresentationPrincipal; controller: PresentationPrincipal;
  pairHash?: string; pairUntil: number; tokenHash?: string; expiresAt: number; connectionId?: string; heartbeatAt: number;
  seq: number; pending?: PresentationCommand; inFlight?: PresentationCommand; status?: PresentationStatus; result?: PresentationResult;
};
// Live presentation grants intentionally disappear on server restart and transfer.
const key = Symbol.for("castlink.presentation-control.v1");
const shared = globalThis as typeof globalThis & { [key: symbol]: Map<string, PresentationEntry> | undefined };
const entries = shared[key] ||= new Map<string, PresentationEntry>();
const digest = (value: string) => createHash("sha256").update(value).digest("hex");
const secret = (prefix: string) => prefix + randomBytes(32).toString("base64url");
function prune() { const now = Date.now(); for (const [id, e] of entries) if (e.expiresAt <= now || !e.tokenHash && e.pairUntil <= now) entries.delete(id); }
export function createPresentation(binding: PresentationBinding, owner: PresentationPrincipal, kind: PresentationKind) {
  prune();
  for (const [id, e] of entries) if (e.binding.studioId === binding.studioId && e.binding.room === binding.room && e.owner.identity === owner.identity) entries.delete(id);
  if (entries.size >= 512) throw new Error("Presentation capacity reached");
  const pairToken = secret("cp_"), now = Date.now();
  const e: PresentationEntry = { id: randomUUID(), binding, kind, owner, controller: owner, pairHash: digest(pairToken), pairUntil: now + 120_000, expiresAt: now + 30 * 60_000, heartbeatAt: 0, seq: 0 };
  entries.set(e.id, e); return { sessionId: e.id, pairToken, expiresAt: e.pairUntil };
}
export function presentationById(id: string) { prune(); return entries.get(id); }
export function presentationByToken(token: string, pairing: boolean) {
  prune(); if (!(pairing ? /^cp_[\w-]{43}$/ : /^cs_[\w-]{43}$/).test(token)) return;
  const hash = digest(token); return [...entries.values()].find(e => pairing ? e.pairHash === hash && e.pairUntil > Date.now() : e.tokenHash === hash);
}
export function connectPresentation(e: PresentationEntry, connectionId: string) {
  if (!e.pairHash || e.pairUntil <= Date.now()) return;
  const sessionToken = secret("cs_"); e.pairHash = undefined; e.tokenHash = digest(sessionToken); e.connectionId = connectionId; e.heartbeatAt = 0;
  return { sessionId: e.id, sessionToken, connectionId, expiresAt: e.expiresAt };
}
export function dropPresentation(e: PresentationEntry) { entries.delete(e.id); }
export function presentationEntries(studioId: string, room: string) { prune(); return [...entries.values()].filter(e => e.binding.studioId === studioId && e.binding.room === room); }
export function refreshPresentation(e: PresentationEntry) {
  const now = Date.now();
  if (e.pending && (e.pending.expiresAt <= now || e.heartbeatAt < now - PRESENTATION_HEARTBEAT_TTL)) e.pending = undefined;
  if (e.inFlight && e.inFlight.expiresAt <= now) { e.result = { seq: e.inFlight.seq, ok: false, error: "Presentation command was not confirmed" }; e.inFlight = undefined; }
}
export function presentationSnapshot(e: PresentationEntry): PresentationSession {
  refreshPresentation(e);
  return { id: e.id, kind: e.kind, ownerIdentity: e.owner.identity, controllerIdentity: e.controller.identity, connected: !!e.connectionId && e.heartbeatAt > Date.now() - PRESENTATION_HEARTBEAT_TTL, expiresAt: e.expiresAt, ...(e.status ? { status: e.status } : {}), ...(e.result ? { result: e.result } : {}) };
}
export function issuePresentationCommand(e: PresentationEntry, direction: "next" | "previous") {
  refreshPresentation(e);
  if (!e.connectionId || e.heartbeatAt <= Date.now() - PRESENTATION_HEARTBEAT_TTL || !e.status?.ready || e.pending || e.inFlight) return;
  const now = Date.now(); const command: PresentationCommand = { id: randomUUID(), seq: ++e.seq, direction, issuedAt: now, expiresAt: now + PRESENTATION_COMMAND_TTL, connectionId: e.connectionId };
  e.pending = command; e.result = undefined; return command;
}
export function pollPresentation(e: PresentationEntry, status?: PresentationStatus, result?: PresentationResult) {
  if (result) {
    if (!e.inFlight || e.inFlight.seq !== result.seq) return { conflict: true as const };
    e.result = result; e.inFlight = undefined;
  }
  refreshPresentation(e);
  e.heartbeatAt = Date.now(); if (status) e.status = status;
  // Remove BEFORE returning. A lost HTTP response must not repeat an animation.
  const command = e.pending; e.pending = undefined; if (command) e.inFlight = command;
  return { ...(command ? { command } : {}), expiresAt: e.expiresAt };
}
