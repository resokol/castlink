import { atomicWriteJson, readJson, runtimeFile } from "./persistent-storage";
import { RoomServiceClient, TrackSource } from "livekit-server-sdk";
export const PRIVATE_TALKBACK_LEASE_MS = 60_000;
export type PrivateTalkbackSession = {
  id: string; studioId: string; room: string; roomAssociation: string; parentRoom: string; roomName: string;
  clientId: string; target: string; targetSid: string; staffIdentity: string; guestIdentity: string;
  policyVersion?: 2; actorIdentity?: string; actorSid?: string;
  reply?: { id: string; active: boolean; ready?: boolean; restoreMicrophone: boolean };
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
  return Array.from(state.entries.values()).find(entry => !entry.endedAt && (entry.policyVersion !== 2 || entry.reply?.active) && entry.parentRoom === parentRoom && entry.target === identity);
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
    entry.restoreMicrophone = false; if (entry.reply) entry.reply.restoreMicrophone = false; changed = true;
  }
  if (changed) await savePrivateTalkbackSessions();
}

const missing = (error: unknown) => (error as { code?: string; status?: number }).code === "not_found" || (error as { status?: number }).status === 404;
function restrictedPermission(session: PrivateTalkbackSession) {
  const sources = session.originalPermission.canPublishSources?.length ? session.originalPermission.canPublishSources : [TrackSource.CAMERA, TrackSource.SCREEN_SHARE, TrackSource.SCREEN_SHARE_AUDIO];
  const allowed = sources.filter(source => source !== TrackSource.MICROPHONE);
  return { ...session.originalPermission, canPublish: allowed.length > 0 && session.originalPermission.canPublish !== false, canPublishSources: allowed };
}
/** Persist the reply gate before touching either microphone. Call under serializeTalkback. */
export async function beginPrivateTalkbackReply(session: PrivateTalkbackSession, replyId: string, lk: RoomServiceClient) {
  if (session.reply?.active && session.reply.ready) return session.reply.id;
  // A missing private recipient must never interrupt the programme microphone.
  await lk.getParticipant(session.roomName, session.guestIdentity);
  const participant = await lk.getParticipant(session.parentRoom, session.target);
  if (participant.sid !== session.targetSid) throw new Error("Гость переподключился");
  if (!session.reply?.active) {
    session.originalPermission = participant.permission ? { ...participant.permission } : { canPublish: true, canSubscribe: true, canPublishData: true, canPublishSources: [] };
    session.restoreMicrophone = participant.tracks.some(track => track.source === TrackSource.MICROPHONE && !track.muted);
    session.reply = { id: replyId, active: true, restoreMicrophone: session.restoreMicrophone };
  }
  await savePrivateTalkbackSessions();
  if ((await lk.getParticipant(session.parentRoom, session.target)).sid !== session.targetSid) throw new Error("Гость переподключился");
  for (const track of participant.tracks) if (track.source === TrackSource.MICROPHONE) await lk.mutePublishedTrack(session.parentRoom, session.target, track.sid, true);
  await lk.updateParticipant(session.parentRoom, session.target, { permission: restrictedPermission(session) });
  if ((await lk.getParticipant(session.parentRoom, session.target)).sid !== session.targetSid) throw new Error("Гость переподключился");
  await lk.updateParticipant(session.roomName, session.guestIdentity, { permission: { canPublish: true, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false } });
  session.reply!.ready = true; await savePrivateTalkbackSessions();
  return session.reply!.id;
}
/** End private publishing before restoring programme permission. Never server-unmute the main track. */
export async function endPrivateTalkbackReply(session: PrivateTalkbackSession, lk: RoomServiceClient, allowRestore: boolean) {
  const reply = session.reply;
  if (!reply?.active) return allowRestore && reply?.restoreMicrophone === true && !session.endedAt;
  try { await lk.updateParticipant(session.roomName, session.guestIdentity, { permission: { canPublish: false, canPublishSources: [TrackSource.MICROPHONE], canSubscribe: true, canPublishData: false } }); }
  catch (error) { if (!missing(error)) throw error; }
  let participant;
  try { participant = await lk.getParticipant(session.parentRoom, session.target); } catch (error) { if (!missing(error)) throw error; }
  if (participant?.sid === session.targetSid) await lk.updateParticipant(session.parentRoom, session.target, { permission: session.originalPermission });
  const restore = allowRestore && session.restoreMicrophone && participant?.sid === session.targetSid;
  reply.active = false; reply.restoreMicrophone = restore; session.restoreMicrophone = restore;
  await savePrivateTalkbackSessions();
  return restore;
}
/** Call under serializeTalkback so token renewal and the private API cannot race teardown. */
export async function closePrivateTalkbackSession(session: PrivateTalkbackSession, lk = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || "http://127.0.0.1:7880", process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET)) {
  if (session.endedAt) return;
  session.closing = true; await savePrivateTalkbackSessions();
  if (session.timer) clearTimeout(session.timer);
  try { await lk.deleteRoom(session.roomName); } catch (error) { if (!missing(error)) throw error; }
  if (session.policyVersion === 2) {
    if (session.reply?.active) await endPrivateTalkbackReply(session, lk, false);
  } else {
    // One-time cleanup of records from the former whole-session microphone gate.
    let participant;
    try { participant = await lk.getParticipant(session.parentRoom, session.target); } catch (error) { if (!missing(error)) throw error; }
    if (participant?.sid === session.targetSid) await lk.updateParticipant(session.parentRoom, session.target, { permission: session.originalPermission });
  }
  session.restoreMicrophone = false;
  session.endedAt = Date.now(); session.closing = false; session.timer = undefined;
  await savePrivateTalkbackSessions();
}
