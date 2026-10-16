import { parseCameraTransform, type CameraTransform } from "./camera-transform";
export const GUEST_DEVICE_REQUEST_TOPIC = "castlink-guest-device-request";
export const GUEST_DEVICE_REQUEST_TTL = 60_000;
export const GUEST_DEVICE_STATE_TTL = 30_000;
export type GuestDeviceKind = "audioinput" | "videoinput" | "audiooutput";
export type GuestDevice = { kind: GuestDeviceKind; deviceId: string; label: string };
export type GuestDeviceState = {
  devices: GuestDevice[];
  selected: Partial<Record<GuestDeviceKind, string>>;
  actual: Partial<Record<GuestDeviceKind, string>>;
  microphoneEnabled: boolean;
  cameraEnabled: boolean;
  outputSupported: boolean;
  cameraTransform?: CameraTransform;
  cameraTransformSupported?: boolean;
};
export type GuestDeviceRequest = { id: string; participantSid: string; issuedAt: number; expiresAt: number; target: GuestDevice | { kind: "camera-transform"; transform: CameraTransform } };
export type GuestDeviceOutcome = "applied" | "saved" | "declined" | "failed";
export type GuestDeviceResult = { id: string; outcome: GuestDeviceOutcome; error?: string };
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
const text = (value: unknown, max: number, empty = false): value is string => typeof value === "string" && (empty || value.length > 0) && value.length <= max && !/[\u0000-\u001f]/.test(value);
const kinds: GuestDeviceKind[] = ["audioinput", "videoinput", "audiooutput"];
export function parseGuestDevice(value: unknown): GuestDevice | undefined {
  if (!object(value) || Object.keys(value).some(key => !["kind", "deviceId", "label"].includes(key)) || !kinds.includes(value.kind as GuestDeviceKind) || !text(value.deviceId, 512) || !text(value.label, 256)) return;
  return { kind: value.kind as GuestDeviceKind, deviceId: value.deviceId, label: value.label };
}
export function parseGuestControlTarget(value: unknown): GuestDeviceRequest["target"] | undefined {
  if (object(value) && value.kind === "camera-transform") {
    if (Object.keys(value).some(key => !["kind", "transform"].includes(key))) return;
    const transform = parseCameraTransform(value.transform);
    return transform ? { kind: "camera-transform", transform } : undefined;
  }
  return parseGuestDevice(value);
}
export function parseGuestDeviceState(value: unknown): GuestDeviceState | undefined {
  if (!object(value) || !Array.isArray(value.devices) || value.devices.length > 64 || !object(value.selected) || !object(value.actual) || typeof value.microphoneEnabled !== "boolean" || typeof value.cameraEnabled !== "boolean" || typeof value.outputSupported !== "boolean") return;
  const cameraTransform = value.cameraTransform === undefined ? undefined : parseCameraTransform(value.cameraTransform);
  if (value.cameraTransform !== undefined && !cameraTransform || value.cameraTransformSupported !== undefined && typeof value.cameraTransformSupported !== "boolean") return;
  const devices = value.devices.map(parseGuestDevice);
  if (devices.some(device => !device) || new Set(devices.map(device => `${device!.kind}:${device!.deviceId}`)).size !== devices.length) return;
  for (const selection of [value.selected, value.actual]) if (Object.entries(selection).some(([kind, id]) => !kinds.includes(kind as GuestDeviceKind) || !text(id, 512, true))) return;
  return { devices: devices as GuestDevice[], selected: { ...value.selected }, actual: { ...value.actual }, microphoneEnabled: value.microphoneEnabled, cameraEnabled: value.cameraEnabled, outputSupported: value.outputSupported, ...(cameraTransform ? { cameraTransform } : {}), ...(typeof value.cameraTransformSupported === "boolean" ? { cameraTransformSupported: value.cameraTransformSupported } : {}) };
}
/** Participant-origin packets and requests from another media session never open a prompt. */
export function parseGuestDeviceRequest(payload: Uint8Array, sender: unknown, topic: string | undefined, participantSid: string, now = Date.now()): GuestDeviceRequest | undefined {
  if (sender !== undefined || topic !== GUEST_DEVICE_REQUEST_TOPIC || payload.byteLength > 2048 || !participantSid) return;
  try {
    const value = JSON.parse(new TextDecoder().decode(payload));
    const target = parseGuestControlTarget(value?.target);
    if (!target || !text(value.id, 80) || !/^[A-Za-z0-9-]+$/.test(value.id) || value.participantSid !== participantSid || !Number.isSafeInteger(value.issuedAt) || !Number.isSafeInteger(value.expiresAt) || value.issuedAt > now + 5000 || value.issuedAt < now - GUEST_DEVICE_REQUEST_TTL || value.expiresAt <= now || value.expiresAt <= value.issuedAt || value.expiresAt > value.issuedAt + GUEST_DEVICE_REQUEST_TTL) return;
    return { id: value.id, participantSid, issuedAt: value.issuedAt, expiresAt: value.expiresAt, target };
  } catch { return; }
}
