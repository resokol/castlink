export const TALK_TO_ROOM = "__all__";

export type TalkbackTarget = {
  identity: string;
  name?: string;
  role: "admin" | "moderator" | "guest";
};

export type TrackSubscriptionPermission = {
  participantIdentity: string;
  allowAll: true;
};

/** Build an explicit SFU allowlist. An invalid/stale private target fails closed. */
export function talkbackPermissions(target: string, recipients: TalkbackTarget[]): TrackSubscriptionPermission[] {
  const eligible = recipients.filter((participant) =>
    participant.identity && ["admin", "moderator", "guest"].includes(participant.role),
  );
  if (target === TALK_TO_ROOM) {
    return eligible.map(({ identity }) => ({ participantIdentity: identity, allowAll: true }));
  }
  if (!eligible.some((participant) => participant.identity === target)) {
    throw new Error("Выбранный участник больше не подключён к комнате");
  }
  return [{ participantIdentity: target, allowAll: true }];
}

export function isVerifiedTalkback(participant: { identity: string; metadata?: string }): boolean {
  if (!participant.identity.startsWith("talkback-")) return false;
  try {
    const metadata: unknown = JSON.parse(participant.metadata || "{}");
    return !!metadata && typeof metadata === "object" && !Array.isArray(metadata) &&
      (metadata as Record<string, unknown>).role === "talkback";
  } catch {
    return false;
  }
}

export type GuestMediaCommand = { source: "microphone" | "camera"; enabled: boolean };

/** Server-originated commands have no participant sender; client data is always rejected. */
export function parseGuestMediaCommand(
  payload: Uint8Array,
  sender: unknown,
  topic: string | undefined,
): GuestMediaCommand | undefined {
  if (sender !== undefined || topic !== "castlink-media-control" || payload.byteLength > 2048) return undefined;
  try {
    const value: unknown = JSON.parse(new TextDecoder().decode(payload));
    if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
    const data = value as Record<string, unknown>;
    if ((data.kind !== "audio" && data.kind !== "video") || typeof data.enabled !== "boolean") return undefined;
    return { source: data.kind === "audio" ? "microphone" : "camera", enabled: data.enabled };
  } catch {
    return undefined;
  }
}
