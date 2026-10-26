export const GUEST_CAMERA_RESOLUTIONS = ["auto", "720p", "1080p"] as const;
export const GUEST_CAMERA_FRAME_RATES = ["auto", "15", "30", "50", "60"] as const;
export type GuestCameraPreferences = { cameraResolution?: typeof GUEST_CAMERA_RESOLUTIONS[number]; cameraFrameRate?: typeof GUEST_CAMERA_FRAME_RATES[number] };
export function guestCameraPreferences(value?: GuestCameraPreferences): Required<GuestCameraPreferences> {
  return {
    cameraResolution: value?.cameraResolution && GUEST_CAMERA_RESOLUTIONS.includes(value.cameraResolution) ? value.cameraResolution : "auto",
    cameraFrameRate: value?.cameraFrameRate && GUEST_CAMERA_FRAME_RATES.includes(value.cameraFrameRate) ? value.cameraFrameRate : "auto",
  };
}
/** Explicit staff choices override local preferences; absent metadata retains guest choices. */
export function effectiveGuestCameraCapture(metadata?: string, preferences?: GuestCameraPreferences) {
  const staff = staffGuestCameraCapture(metadata), local = guestCameraPreferences(preferences);
  let height = local.cameraResolution === "720p" ? 720 : 1080;
  try { const data = JSON.parse(metadata || "{}"); if (data.videoHeight === 720 || data.videoHeight === 1080) height = data.videoHeight; } catch { /* Use local/default settings. */ }
  return { ...staff, height, cameraFrameRate: local.cameraFrameRate };
}

export const CAMERA_RESOLUTIONS = ["3840x2160", "2560x1440", "2592x1944", "2048x1536", "1920x1080", "1792x1008", "1712x960", "1600x1200", "1600x896", "1504x832", "1392x768", "1280x960", "1280x720", "1184x656", "1024x576", "960x720", "960x544", "864x480", "800x600", "800x448", "752x416", "640x480", "640x360"] as const;
export const CAMERA_FRAME_RATES = ["highest", "60", "50", "30", "29.97", "25", "24", "20", "15", "10", "5", "2"] as const;
export type GuestCameraCapture = { mode: "device" | "custom"; resolution: typeof CAMERA_RESOLUTIONS[number]; frameRate: typeof CAMERA_FRAME_RATES[number] };
export type ActualCameraCapture = { width: number; height: number; frameRate: number };
export function parseGuestCameraCapture(value: unknown): GuestCameraCapture | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const data = value as Record<string, unknown>;
  if (Object.keys(data).some(key => !["mode", "resolution", "frameRate"].includes(key)) || data.mode !== "device" && data.mode !== "custom" || !CAMERA_RESOLUTIONS.includes(data.resolution as GuestCameraCapture["resolution"]) || !CAMERA_FRAME_RATES.includes(data.frameRate as GuestCameraCapture["frameRate"])) return;
  return { mode: data.mode, resolution: data.resolution as GuestCameraCapture["resolution"], frameRate: data.frameRate as GuestCameraCapture["frameRate"] };
}
export function parseActualCameraCapture(value: unknown): ActualCameraCapture | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const data = value as Record<string, unknown>;
  if (![data.width, data.height].every(n => typeof n === "number" && Number.isSafeInteger(n) && n > 0 && n <= 16384) || typeof data.frameRate !== "number" || !Number.isFinite(data.frameRate) || data.frameRate <= 0 || data.frameRate > 1000) return;
  return { width: data.width as number, height: data.height as number, frameRate: data.frameRate };
}
/** Staff metadata is authoritative; old local guest choices never set capture. */
export function staffGuestCameraCapture(metadata?: string): { cameraCapture?: GuestCameraCapture; height: 720 | 1080 } {
  try {
    const data = JSON.parse(metadata || "{}");
    return { cameraCapture: parseGuestCameraCapture(data?.cameraCapture), height: data?.videoHeight === 720 ? 720 : 1080 };
  } catch { return { height: 1080 }; }
}
/** Native aspect and ideal quality; Auto keeps the existing 1080/30 defaults. */
export function guestCameraConstraints(choices: GuestCameraPreferences & { cameraCapture?: GuestCameraCapture; height?: number }, track?: MediaStreamTrack): MediaTrackConstraints {
  const selected = choices.cameraCapture;
  if (!selected) return { height: { ideal: choices.cameraResolution === "720p" ? 720 : choices.cameraResolution === "1080p" ? 1080 : choices.height || 1080 }, frameRate: { ideal: choices.cameraFrameRate && choices.cameraFrameRate !== "auto" ? Number(choices.cameraFrameRate) : 30 }, resizeMode: { ideal: "none" } } as MediaTrackConstraints;
  if (selected.mode === "device") return { resizeMode: { ideal: "none" } } as MediaTrackConstraints;
  const [width, height] = selected.resolution.split("x").map(Number);
  let frameRate: number | undefined;
  if (selected.frameRate === "highest") {
    frameRate = track?.getCapabilities?.().frameRate?.max;
    // Initial capture discovers capabilities before highest FPS is applied.
    if (track && (!frameRate || !Number.isFinite(frameRate) || frameRate < 0 || frameRate > 1000)) throw new Error("Браузер не сообщает максимальную частоту кадров камеры");
  } else frameRate = Number(selected.frameRate);
  return { width: { ideal: width }, height: { ideal: height }, ...(frameRate ? { frameRate: { ideal: frameRate } } : {}), resizeMode: { ideal: "none" } } as MediaTrackConstraints;
}
export async function applyGuestCaptureConstraints(track: MediaStreamTrack, choices: GuestCameraPreferences & { cameraCapture?: GuestCameraCapture; height?: number }, isCurrent: () => boolean = () => true) {
  const constraints = guestCameraConstraints(choices, track);
  try { await track.applyConstraints(constraints); }
  catch {
    // Some browsers reject resizeMode; retry the same dimensions and FPS once.
    if (!isCurrent() || !("resizeMode" in constraints)) throw new Error("Не удалось применить параметры захвата камеры");
    const fallback = { ...constraints }; delete (fallback as Record<string, unknown>).resizeMode;
    try { await track.applyConstraints(fallback); } catch { throw new Error("Не удалось применить параметры захвата камеры"); }
  }
}

/** Local quality is optional; retry staff/default capture if a browser rejects preferences. */
export async function applyPreferredGuestCameraCapture(track: MediaStreamTrack, metadata?: string, preferences?: GuestCameraPreferences, isCurrent: () => boolean = () => true) {
  try { await applyGuestCaptureConstraints(track, effectiveGuestCameraCapture(metadata, preferences), isCurrent); }
  catch (cause) {
    const local = guestCameraPreferences(preferences);
    if (!isCurrent() || staffGuestCameraCapture(metadata).cameraCapture || local.cameraResolution === "auto" && local.cameraFrameRate === "auto") throw cause;
    await applyGuestCaptureConstraints(track, staffGuestCameraCapture(metadata), isCurrent);
  }
}
