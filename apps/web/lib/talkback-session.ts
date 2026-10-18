import { atomicWriteJson, readJson, runtimeFile } from "./persistent-storage";
import { RoomServiceClient, type TrackSource } from "livekit-server-sdk";
export const PRIVATE_TALKBACK_LEASE_MS = 60_000;
export type PrivateTalkbackSession = {
  id: string; studioId: string; room: string; roomAssociation: string; parentRoom: string; roomName: string;
  clientId: string; target: string; targetSid: string; staffIdentity: string; guestIdentity: string;
  staffName: string; restoreMicrophone: boolean; expiresAt: number; closing?: boolean; endedAt?: number;
  originalPermission: { canPublish?: boolean; canSubscribe?: boolean; canPublishData?: boolean; canPublishSources?: TrackSource[]; canUpdateMetadata?: boolean };
  timer?: ReturnType<typeof setTimeout>;
};
const stateKey = Symbol.for("castlink.private-talkback-sessions");
const shared = globalThis as typeof globalThis & { [stateKey]?: { entries: Map<string, PrivateTalkbackSession>; queue: Promise<unknown>; loaded?: Promise<void> } };
const state: { entries: Map<string, PrivateTalkbackSession>; queue: Promise<unknown>; loaded?: Promise<void> } = shared[stateKey] ||= { entries: new Map<string, PrivateTalkbackSession>(), queue: Promise.resolve() };
export const privateTalkbackSessions = state.entries;
export function serializeTalkback<T>(operation: () => Promise<T>): Promise<T> {
  const result = state.queue.then(operation, operation); state.queue = result.catch(() => undefined); return result;
}
/** Until teardown succeeds, renewed main tokens also deny microphone publication. */
export function privateTalkbackForGuest(parentRoom: string, identity: string) {
  return Array.from(state.entries.values()).find(entry => !entry.endedAt && entry.parentRoom === parentRoom && entry.target === identity);
}

const sessionFile = () => runtimeFile("castlink-private-talkback-sessions.json");
/** Durable gates prevent a web restart from reopening a public microphone mid-conversation. */
export async function loadPrivateTalkbackSessions(): Promise<void> {
  if (!state.loaded) state.loaded = (async () => {
    let value: unknown;
    try { value = await readJson(sessionFile()); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error; }
    if (!value || typeof value !== "object" || !Array.isArray((value as { sessions?: unknown }).sessions)) throw new Error("Invalid private conversation storage");
    for (const session of (value as { sessions: PrivateTalkbackSession[] }).sessions) {
      if (!session || typeof session.id !== "string" || typeof session.parentRoom !== "string" || typeof session.target !== "string" || typeof session.roomName !== "string" || !session.originalPermission || !Number.isFinite(session.expiresAt)) throw new Error("Invalid private conversation record");
      state.entries.set(session.id, session);
    }
  })();
  await state.loaded;
}
export async function savePrivateTalkbackSessions(): Promise<void> {
  await atomicWriteJson(sessionFile(), { schemaVersion: 1, sessions: Array.from(state.entries.values()).map(({ timer: _timer, ...session }) => session) });
}

/** An explicit later studio mute cancels every matching restore, including an already closed session. */
export async function rememberPrivateTalkbackMute(parentRoom: string, identity: string, participantSid: string) {
  let changed = false;
  for (const entry of state.entries.values()) if (entry.parentRoom === parentRoom && entry.target === identity && entry.targetSid === participantSid && entry.restoreMicrophone) {
    entry.restoreMicrophone = false; changed = true;
  }
  if (changed) await savePrivateTalkbackSessions();
}

/** Call under serializeTalkback so token renewal and the private API cannot race teardown. */
export async function closePrivateTalkbackSession(session: PrivateTalkbackSession, lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET)) {
  if (session.endedAt) return;
  session.closing = true;
  await savePrivateTalkbackSessions();
  if (session.timer) clearTimeout(session.timer);
  try { await lk.deleteRoom(session.roomName); }
  catch (error) { if ((error as { code?: string; status?: number }).code !== "not_found" && (error as { status?: number }).status !== 404) throw error; }
  let participant;
  try { participant = await lk.getParticipant(session.parentRoom, session.target); }
  catch (error) { if ((error as { code?: string; status?: number }).code !== "not_found" && (error as { status?: number }).status !== 404) throw error; }
  if (participant?.sid === session.targetSid) await lk.updateParticipant(session.parentRoom, session.target, { permission: session.originalPermission });
  session.restoreMicrophone = session.restoreMicrophone && participant?.sid === session.targetSid;
  session.endedAt = Date.now(); session.closing = false; session.timer = undefined;
  await savePrivateTalkbackSessions();
}
