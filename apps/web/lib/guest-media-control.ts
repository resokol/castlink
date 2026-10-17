import type { GuestAudioProfile } from "./guest-audio";
import type { GuestConnectionRoute } from "./connection-route";
import type { StudioVideoCodec } from "./video-quality";

export const GUEST_MEDIA_SETTINGS_TOPIC = "castlink-guest-settings";
export type GuestMediaSettingsPatch = { audioProfile?: GuestAudioProfile; connectionRoute?: GuestConnectionRoute; videoCodec?: StudioVideoCodec; micGain?: number; listenGain?: number; screenShareEnabled?: false };
export type GuestMediaSettingsState = { audioProfile: GuestAudioProfile; connectionRoute: GuestConnectionRoute; activeRoute?: "normal" | "relay"; noiseSuppressionState?: "on" | "off" | "unavailable" | "pending"; videoCodec?: StudioVideoCodec; actualVideoCodec?: StudioVideoCodec; videoEnabled?: boolean; supportedVideoCodecs?: StudioVideoCodec[]; micGain?: number; listenGain?: number; screenShareEnabled?: boolean };
const validGain = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 200;
const validListenGain = (value: unknown) => validGain(value) && value <= 100;
const validCodec = (value: unknown): value is StudioVideoCodec => value === "vp8" || value === "h264" || value === "av1";
export type GuestMediaSettingsCommand = { id: string; participantSid: string; issuedAt: number; expiresAt: number; patch: GuestMediaSettingsPatch };

export function parseGuestMediaSettingsPatch(value: unknown): GuestMediaSettingsPatch | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const data = value as Record<string, unknown>;
  if (!Object.keys(data).length || Object.keys(data).some(key => key !== "audioProfile" && key !== "connectionRoute" && key !== "videoCodec" && key !== "micGain" && key !== "listenGain" && key !== "screenShareEnabled")) return;
  if (data.micGain !== undefined && !validGain(data.micGain) || data.listenGain !== undefined && !validListenGain(data.listenGain) || data.screenShareEnabled !== undefined && data.screenShareEnabled !== false) return;
  if (data.videoCodec !== undefined && !validCodec(data.videoCodec)) return;
  if (data.audioProfile !== undefined && data.audioProfile !== "speech" && data.audioProfile !== "raw") return;
  if (data.connectionRoute !== undefined && !["auto", "normal", "relay"].includes(String(data.connectionRoute))) return;
  return { ...(data.micGain !== undefined ? { micGain: data.micGain as number } : {}), ...(data.listenGain !== undefined ? { listenGain: data.listenGain as number } : {}), ...(data.screenShareEnabled !== undefined ? { screenShareEnabled: data.screenShareEnabled as false } : {}), ...(data.videoCodec !== undefined ? { videoCodec: data.videoCodec as StudioVideoCodec } : {}), ...(data.audioProfile !== undefined ? { audioProfile: data.audioProfile as GuestAudioProfile } : {}), ...(data.connectionRoute !== undefined ? { connectionRoute: data.connectionRoute as GuestConnectionRoute } : {}) };
}

export function parseGuestMediaSettingsState(value: unknown): GuestMediaSettingsState | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const data = value as Record<string, unknown>;
  if (data.micGain !== undefined && !validGain(data.micGain) || data.listenGain !== undefined && !validListenGain(data.listenGain) || data.screenShareEnabled !== undefined && typeof data.screenShareEnabled !== "boolean") return;
  if (data.audioProfile !== "speech" && data.audioProfile !== "raw" || !["auto", "normal", "relay"].includes(String(data.connectionRoute))) return;
  if (data.activeRoute !== undefined && data.activeRoute !== "normal" && data.activeRoute !== "relay") return;
  if (data.noiseSuppressionState !== undefined && !["on", "off", "unavailable", "pending"].includes(String(data.noiseSuppressionState))) return;
  if (data.videoCodec !== undefined && !validCodec(data.videoCodec) || data.actualVideoCodec !== undefined && !validCodec(data.actualVideoCodec) || data.videoEnabled !== undefined && typeof data.videoEnabled !== "boolean") return;
  if (data.supportedVideoCodecs !== undefined && (!Array.isArray(data.supportedVideoCodecs) || data.supportedVideoCodecs.length > 3 || data.supportedVideoCodecs.some(value => !validCodec(value)))) return;
  return { ...(data.micGain !== undefined ? { micGain: data.micGain as number } : {}), ...(data.listenGain !== undefined ? { listenGain: data.listenGain as number } : {}), ...(data.screenShareEnabled !== undefined ? { screenShareEnabled: data.screenShareEnabled as boolean } : {}), ...(data.videoCodec !== undefined ? { videoCodec: data.videoCodec as StudioVideoCodec } : {}), ...(data.actualVideoCodec !== undefined ? { actualVideoCodec: data.actualVideoCodec as StudioVideoCodec } : {}), ...(data.videoEnabled !== undefined ? { videoEnabled: data.videoEnabled as boolean } : {}), ...(data.supportedVideoCodecs !== undefined ? { supportedVideoCodecs: [...data.supportedVideoCodecs as StudioVideoCodec[]] } : {}), ...(data.noiseSuppressionState ? { noiseSuppressionState: data.noiseSuppressionState as GuestMediaSettingsState["noiseSuppressionState"] } : {}), audioProfile: data.audioProfile, connectionRoute: data.connectionRoute as GuestConnectionRoute, ...(data.activeRoute ? { activeRoute: data.activeRoute as "normal" | "relay" } : {}) };
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
