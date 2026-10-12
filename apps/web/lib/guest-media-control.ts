import type { GuestAudioProfile } from "./guest-audio";
import type { GuestConnectionRoute } from "./connection-route";

export const GUEST_MEDIA_SETTINGS_TOPIC = "castlink-guest-settings";
export type GuestMediaSettingsPatch = { audioProfile?: GuestAudioProfile; connectionRoute?: GuestConnectionRoute };
export type GuestMediaSettingsState = { audioProfile: GuestAudioProfile; connectionRoute: GuestConnectionRoute; activeRoute?: "normal" | "relay" };
export type GuestMediaSettingsCommand = { id: string; participantSid: string; issuedAt: number; expiresAt: number; patch: GuestMediaSettingsPatch };

export function parseGuestMediaSettingsPatch(value: unknown): GuestMediaSettingsPatch | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const data = value as Record<string, unknown>;
  if (!Object.keys(data).length || Object.keys(data).some(key => key !== "audioProfile" && key !== "connectionRoute")) return;
  if (data.audioProfile !== undefined && data.audioProfile !== "speech" && data.audioProfile !== "raw") return;
  if (data.connectionRoute !== undefined && !["auto", "normal", "relay"].includes(String(data.connectionRoute))) return;
  return { ...(data.audioProfile !== undefined ? { audioProfile: data.audioProfile as GuestAudioProfile } : {}), ...(data.connectionRoute !== undefined ? { connectionRoute: data.connectionRoute as GuestConnectionRoute } : {}) };
}

export function parseGuestMediaSettingsState(value: unknown): GuestMediaSettingsState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const data = value as Record<string, unknown>;
  if (data.audioProfile !== "speech" && data.audioProfile !== "raw" || !["auto", "normal", "relay"].includes(String(data.connectionRoute))) return;
  if (data.activeRoute !== undefined && data.activeRoute !== "normal" && data.activeRoute !== "relay") return;
  return { audioProfile: data.audioProfile, connectionRoute: data.connectionRoute as GuestConnectionRoute, ...(data.activeRoute ? { activeRoute: data.activeRoute as "normal" | "relay" } : {}) };
}

/** Only server packets for this exact current media session may change settings. */
export function parseGuestMediaSettingsCommand(payload: Uint8Array, sender: unknown, topic: string | undefined, participantSid: string, now = Date.now()): GuestMediaSettingsCommand | undefined {
  if (sender !== undefined || topic !== GUEST_MEDIA_SETTINGS_TOPIC || payload.byteLength > 2048) return;
  try {
    const data = JSON.parse(new TextDecoder().decode(payload));
    const patch = parseGuestMediaSettingsPatch(data?.patch);
    if (!patch || typeof data.id !== "string" || !/^[A-Za-z0-9-]{1,80}$/.test(data.id) || !participantSid || data.participantSid !== participantSid) return;
    if (!Number.isSafeInteger(data.issuedAt) || !Number.isSafeInteger(data.expiresAt) || data.issuedAt > now + 5000 || data.expiresAt <= now || data.expiresAt > data.issuedAt + 60000) return;
    return { id: data.id, participantSid, issuedAt: data.issuedAt, expiresAt: data.expiresAt, patch };
  } catch { return; }
}
