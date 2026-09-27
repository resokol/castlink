export type ParticipantRole = "admin" | "moderator" | "guest";

type ParticipantIdentity = {
  identity: string;
  metadata?: string;
};

export function resolveParticipantRole(participant: ParticipantIdentity): ParticipantRole | undefined {
  // Auxiliary media-only identities must never appear as people or inherit staff access.
  if (participant.identity.startsWith("talkback-") || participant.identity.startsWith("stream-viewer-")) return undefined;
  let metadata: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(participant.metadata || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      metadata = parsed as Record<string, unknown>;
    }
  } catch {
    // Older participants can have empty or non-JSON metadata; identity fallbacks follow.
  }

  // Display the selected staff panel; authorization still uses verified server credentials.
  if (participant.identity.startsWith("studio-moderator-") && metadata.panelMode === "moderator") return "moderator";
  if (metadata.accessRole === "admin" || metadata.role === "admin" || metadata.roomAdmin === true) return "admin";
  if (metadata.accessRole === "moderator" || metadata.role === "moderator" || metadata.role === "studio-moderator") return "moderator";
  if (metadata.accessRole === "guest" || metadata.role === "guest") return "guest";
  if (participant.identity.startsWith("studio-moderator-")) return "moderator";
  if (participant.identity.startsWith("studio-panel-")) return "admin";
  if (participant.identity.startsWith("guest-")) return "guest";
  return undefined;
}
