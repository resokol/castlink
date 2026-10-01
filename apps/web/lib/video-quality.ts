import { Track, type TrackPublishOptions } from "livekit-client";

export const STUDIO_FRAME_RATES = [25, 30, 50, 60] as const;
export type StudioFrameRate = typeof STUDIO_FRAME_RATES[number];
export const MIN_STUDIO_VIDEO_BITRATE_KBPS = 500;
export const MAX_STUDIO_VIDEO_BITRATE_KBPS = 12_000;
export const DEFAULT_STUDIO_VIDEO_BITRATE_KBPS = 12_000;
export const VIDEO_BITRATES_KBPS = [500, ...Array.from({ length: 12 }, (_, i) => (i + 1) * 1000)];
export const MAX_GUEST_VIDEO_BITRATE = 10_000_000;

export function isValidStudioVideoBitrateKbps(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_STUDIO_VIDEO_BITRATE_KBPS && value <= MAX_STUDIO_VIDEO_BITRATE_KBPS;
}

/** Keep a stored legacy value visible until the operator explicitly picks a new limit. */
export function videoBitrateOptions(current?: unknown) {
  if (!isValidStudioVideoBitrateKbps(current) || VIDEO_BITRATES_KBPS.includes(current)) return VIDEO_BITRATES_KBPS;
  return [...VIDEO_BITRATES_KBPS, current].sort((a, b) => a - b);
}

export function studioVideoConstraints(deviceId: string, fps: StudioFrameRate): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: fps, max: fps },
  };
}

export function studioVideoPublishOptions(bitrateKbps: number, fps: StudioFrameRate): TrackPublishOptions {
  if (!isValidStudioVideoBitrateKbps(bitrateKbps) || !STUDIO_FRAME_RATES.includes(fps)) {
    throw new Error("Некорректный битрейт или частота кадров Studio Return");
  }
  return {
    source: Track.Source.Camera, name: "Studio Return Video", simulcast: true,
    videoEncoding: { maxBitrate: bitrateKbps * 1000, maxFramerate: fps },
    degradationPreference: "maintain-resolution",
  };
}

/** Apply one aggregate bitrate ceiling across all simulcast encodings. */
export function capStudioVideoEncodings<T extends RTCRtpEncodingParameters>(
  encodings: T[], bitrateKbps: number, fps: StudioFrameRate,
): T[] {
  if (!isValidStudioVideoBitrateKbps(bitrateKbps) || !STUDIO_FRAME_RATES.includes(fps)) {
    throw new Error("Некорректный битрейт или частота кадров Studio Return");
  }
  if (!encodings.length) return encodings;
  const weights = encodings.map(encoding => Math.max(1, Number(encoding.maxBitrate) || 0));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  const ceiling = bitrateKbps * 1000;
  let assigned = 0;
  return encodings.map((encoding, index) => {
    const maxBitrate = index === encodings.length - 1
      ? Math.max(1, ceiling - assigned)
      : Math.max(1, Math.floor(ceiling * weights[index] / totalWeight));
    assigned += maxBitrate;
    return { ...encoding, maxBitrate, maxFramerate: fps };
  });
}

export function studioVideoEncodingsMatch(encodings: readonly RTCRtpEncodingParameters[], bitrateKbps: number, fps: StudioFrameRate) {
  if (!encodings.length) return false;
  const total = encodings.reduce((sum, encoding) => sum + Number(encoding.maxBitrate || 0), 0);
  return Math.abs(total - bitrateKbps * 1000) <= 1 && encodings.every(encoding => encoding.maxFramerate === fps);
}

export async function applyStudioSenderQuality(sender: RTCRtpSender, bitrateKbps: number, fps: StudioFrameRate) {
  for (let attempt = 0; ; attempt++) {
    const parameters = sender.getParameters();
    if (!parameters.encodings?.length) throw new Error("LiveKit не предоставил параметры кодирования видеопотока");
    parameters.encodings = capStudioVideoEncodings(parameters.encodings || [], bitrateKbps, fps);
    try { await sender.setParameters(parameters); return; }
    catch (error) {
      const invalidated = error instanceof DOMException && error.name === "InvalidModificationError";
      if (!invalidated || attempt >= 2) throw error;
    }
  }
}

export const DEFAULT_GUEST_VIDEO_BITRATE_KBPS = 2500;
export function guestVideoBitrate(metadata?: string) {
  try { const value = JSON.parse(metadata || "{}").videoMaxBitrateKbps; return isValidStudioVideoBitrateKbps(value) ? value : DEFAULT_GUEST_VIDEO_BITRATE_KBPS; }
  catch { return DEFAULT_GUEST_VIDEO_BITRATE_KBPS; }
}
