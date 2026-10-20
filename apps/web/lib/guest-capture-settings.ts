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
/** No explicit staff selection means native aspect, height 1080 and 30 FPS. */
export function guestCameraConstraints(choices: { cameraCapture?: GuestCameraCapture; height?: number }, track?: MediaStreamTrack): MediaTrackConstraints {
  const selected = choices.cameraCapture;
  if (!selected) return { height: { ideal: choices.height || 1080 }, frameRate: { ideal: 30 }, resizeMode: { ideal: "none" } } as MediaTrackConstraints;
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
export async function applyGuestCaptureConstraints(track: MediaStreamTrack, choices: { cameraCapture?: GuestCameraCapture; height?: number }, isCurrent: () => boolean = () => true) {
  const constraints = guestCameraConstraints(choices, track);
  try { await track.applyConstraints(constraints); }
  catch {
    // Some browsers reject resizeMode; retry the same dimensions and FPS once.
    if (!isCurrent() || !("resizeMode" in constraints)) throw new Error("Не удалось применить параметры захвата камеры");
    const fallback = { ...constraints }; delete (fallback as Record<string, unknown>).resizeMode;
    try { await track.applyConstraints(fallback); } catch { throw new Error("Не удалось применить параметры захвата камеры"); }
  }
}
