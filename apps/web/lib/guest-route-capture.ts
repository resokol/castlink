import { RoomEvent, Track, type LocalVideoTrack, type Room } from "livekit-client";
import { guestCameraSource } from "./guest-camera-source";
import { telemetryContext } from "./telemetry-context";
import { parseGuestCameraCapture, parseActualCameraCapture, type GuestCameraPreferences } from "./guest-capture-settings";
import type { GuestChoices } from "./guest-media";

type Snapshot = { intent: string; preferences: string; identity: string; constraints: MediaTrackConstraints };
type RouteState = { source: string; snapshot?: Snapshot };
const states = new WeakMap<Room, RouteState>();
const listeners = new WeakMap<Room, () => void>();
function intent(metadata?: string) {
  try { const data = JSON.parse(metadata || "{}"); const capture = parseGuestCameraCapture(data.cameraCapture); return JSON.stringify([capture ? [capture.mode, capture.resolution, capture.frameRate] : null, data.videoHeight ?? null]); }
  catch { return "invalid"; }
}
function preferences(value?: GuestCameraPreferences & { videoDeviceId?: string }) {
  return JSON.stringify([value?.cameraResolution || "auto", value?.cameraFrameRate || "auto", value?.videoDeviceId || ""]);
}
export function clearGuestRouteCapture(room: Room) {
  const state = states.get(room);
  if (state) state.snapshot = undefined;
}
export function guestRouteCaptureConstraints(room: Room, choices?: GuestCameraPreferences & { videoDeviceId?: string }) {
  const snapshot = states.get(room)?.snapshot;
  if (!snapshot) return;
  const track = room.localParticipant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
  const actualDevice = track ? guestCameraSource(track).getSettings().deviceId : undefined;
  const retainedDevice = (snapshot.constraints.deviceId as ConstrainDOMStringParameters | undefined)?.exact;
  if (actualDevice && retainedDevice && actualDevice !== retainedDevice) { clearGuestRouteCapture(room); return; }
  if (snapshot.identity !== room.localParticipant.identity || snapshot.intent !== intent(room.localParticipant.metadata) || snapshot.preferences !== preferences(choices)) {
    clearGuestRouteCapture(room); return;
  }
  return snapshot.constraints;
}
export function bindGuestRouteCaptureSource(room: Room, source: string) {
  if (states.get(room)?.source !== source) states.set(room, { source });
}

/** Renew while the old participant still exists: the server carries current staff intent into the new join. */
export async function prepareGuestRouteChange(room: Room, settings: {
  sourceToken: string; bearer: string; studioId: string; roomName: string;
  choices: () => GuestChoices; isCurrent: () => boolean;
}) {
  bindGuestRouteCaptureSource(room, settings.sourceToken);
  const participant = room.localParticipant, sid = participant.sid, identity = participant.identity;
  const beforeIntent = intent(participant.metadata), beforePreferences = preferences(settings.choices());
  const valid = () => settings.isCurrent() && room.state === "connected" && participant.sid === sid && participant.identity === identity;
  const response = await fetch(`/api/token?room=${encodeURIComponent(settings.roomName)}&studioId=${encodeURIComponent(settings.studioId)}&identity=${encodeURIComponent(identity)}&role=guest`, {
    headers: { authorization: `Bearer ${settings.bearer}` }, cache: "no-store", signal: AbortSignal.timeout(5000),
  });
  if (!response.ok) throw new Error("Не удалось подготовить смену маршрута. Текущее подключение сохранено.");
  const data = await response.json();
  if (!valid() || typeof data.token !== "string" || data.identity !== identity) throw new Error("Смена маршрута отменена: сессия изменилась.");
  let renewedMetadata: string;
  try {
    const part = data.token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const claims = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")), ch => ch.charCodeAt(0))));
    if (claims.sub !== identity || claims.video?.room !== telemetryContext(settings.bearer, room.name).mediaRoom || typeof claims.metadata !== "string") throw new Error("scope");
    const metadata = JSON.parse(claims.metadata);
    if (metadata.role !== "guest" || metadata.studioId !== settings.studioId) throw new Error("scope");
    renewedMetadata = claims.metadata;
  } catch { throw new Error("Сервер не подтвердил текущую сессию гостя."); }
  // Do not replay an obsolete staff selection if it changed during renewal.
  if (intent(participant.metadata) !== beforeIntent || intent(renewedMetadata) !== beforeIntent || preferences(settings.choices()) !== beforePreferences) {
    throw new Error("Настройки камеры изменились. Повторите смену маршрута.");
  }
  const track = participant.getTrackPublication(Track.Source.Camera)?.track as LocalVideoTrack | undefined;
  const source = track ? guestCameraSource(track) : undefined;
  const actual = source && participant.isCameraEnabled ? parseActualCameraCapture(source.getSettings()) : undefined;
  const snapshot = actual ? {
    identity, intent: beforeIntent, preferences: beforePreferences,
    constraints: { ...(source?.getSettings().deviceId ? { deviceId: { exact: source.getSettings().deviceId } } : {}), width: { ideal: actual.width }, height: { ideal: actual.height }, frameRate: { ideal: actual.frameRate }, resizeMode: { ideal: "none" } } as MediaTrackConstraints,
  } : undefined;
  const commit = (accept: () => boolean = () => true) => {
    if (!valid() || intent(participant.metadata) !== beforeIntent || preferences(settings.choices()) !== beforePreferences) throw new Error("Настройки камеры изменились. Повторите смену маршрута.");
    if (!accept()) throw new Error("Сессия обновилась. Повторите смену маршрута.");
    states.set(room, { source: settings.sourceToken, snapshot });
    if (!listeners.has(room)) {
      const changed = (_metadata: string | undefined, changedParticipant: unknown) => {
        if (changedParticipant === room.localParticipant && states.get(room)?.snapshot?.intent !== intent(room.localParticipant.metadata)) clearGuestRouteCapture(room);
      };
      room.on(RoomEvent.ParticipantMetadataChanged, changed);
      listeners.set(room, () => room.off(RoomEvent.ParticipantMetadataChanged, changed));
    }
  };
  return { token: data.token as string, commit };
}
