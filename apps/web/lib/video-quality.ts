import { Track, type TrackPublishOptions } from "livekit-client";

export const STUDIO_FRAME_RATES = [25, 30, 50, 60] as const;
export type StudioFrameRate = typeof STUDIO_FRAME_RATES[number];
export const MIN_STUDIO_VIDEO_BITRATE_KBPS = 500;
export const MAX_STUDIO_VIDEO_BITRATE_KBPS = 25_000;
export const DEFAULT_STUDIO_VIDEO_BITRATE_KBPS = 12_000;
export const VIDEO_BITRATES_KBPS = [500, ...Array.from({ length: 12 }, (_, i) => (i + 1) * 1000)];
export const STUDIO_VIDEO_BITRATES_KBPS = [...VIDEO_BITRATES_KBPS, 16_000, 20_000, 25_000];
export const STUDIO_VIDEO_CODECS = ["vp8", "h264", "av1"] as const;
export type StudioVideoCodec = typeof STUDIO_VIDEO_CODECS[number];
export const DEFAULT_STUDIO_VIDEO_CODEC: StudioVideoCodec = "av1";
export const MAX_GUEST_VIDEO_BITRATE = 10_000_000;

export function isValidStudioVideoBitrateKbps(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= MIN_STUDIO_VIDEO_BITRATE_KBPS && value <= MAX_STUDIO_VIDEO_BITRATE_KBPS;
}

export function isValidGuestVideoBitrateKbps(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 500 && value <= 12_000;
}

export function isStudioVideoCodec(value: unknown): value is StudioVideoCodec {
  return value === "vp8" || value === "h264" || value === "av1";
}

/** Only an absent guest choice may fall back; explicit selections stay strict. */
export function defaultGuestVideoCodec(): StudioVideoCodec {
  const codecs = typeof RTCRtpSender !== "undefined" ? RTCRtpSender.getCapabilities?.("video")?.codecs : undefined;
  return ([DEFAULT_STUDIO_VIDEO_CODEC, "vp8", "h264"] as const).find(codec => codecs?.some(value => value.mimeType.toLowerCase() === `video/${codec}`)) || "vp8";
}

/** Keep a stored legacy value visible until the operator explicitly picks a new limit. */
export function videoBitrateOptions(current?: unknown) {
  if (!isValidGuestVideoBitrateKbps(current) || VIDEO_BITRATES_KBPS.includes(current)) return VIDEO_BITRATES_KBPS;
  return [...VIDEO_BITRATES_KBPS, current].sort((a, b) => a - b);
}

export function studioVideoBitrateOptions(current?: unknown) {
  if (!isValidStudioVideoBitrateKbps(current) || STUDIO_VIDEO_BITRATES_KBPS.includes(current)) return STUDIO_VIDEO_BITRATES_KBPS;
  return [...STUDIO_VIDEO_BITRATES_KBPS, current].sort((a, b) => a - b);
}

export function assertStudioVideoCodecSupported(codec: StudioVideoCodec) {
  const capabilities = typeof RTCRtpSender !== "undefined" ? RTCRtpSender.getCapabilities?.("video") : undefined;
  if (!capabilities?.codecs.some(value => value.mimeType.toLowerCase() === `video/${codec}`)) throw new Error(`Кодек ${codec.toUpperCase()} не поддерживается браузером основной студии. Выберите другой кодек в OFF AIR.`);
}

/** LiveKit may fall back to a server-selected codec; make that visible instead. */
export function assertPublishedStudioVideoCodec(track: { codec?: string } | undefined, requested: StudioVideoCodec) {
  if (track?.codec !== requested) throw new Error(`Не удалось согласовать кодек ${requested.toUpperCase()} с сервером. Публикация остановлена; выберите другой кодек в OFF AIR.`);
}

export function studioVideoConstraints(deviceId: string, fps: StudioFrameRate): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: fps, max: fps },
  };
}

export function studioVideoPublishOptions(bitrateKbps: number, fps: StudioFrameRate, videoCodec: StudioVideoCodec = DEFAULT_STUDIO_VIDEO_CODEC, simulcast = true): TrackPublishOptions {
  if (!isValidStudioVideoBitrateKbps(bitrateKbps) || !STUDIO_FRAME_RATES.includes(fps)) {
    throw new Error("Некорректный битрейт или частота кадров Studio Return");
  }
  if (!isStudioVideoCodec(videoCodec) || typeof simulcast !== "boolean") throw new Error("Некорректный кодек или режим видеопотока Studio Return");
  return {
    source: Track.Source.Camera, name: "Studio Return Video", videoCodec, simulcast,
    // AV1 uses spatial layers within one SVC encoding. Without an explicit mode
    // LiveKit defaults even the isolated /watch stream to three spatial layers.
    ...(videoCodec === "av1" ? { simulcast: false, scalabilityMode: simulcast ? "L3T3_KEY" : "L1T3", backupCodec: false as const } : {}),
    videoEncoding: { maxBitrate: bitrateKbps * 1000, maxFramerate: fps },
    degradationPreference: "maintain-resolution",
  };
}

// LiveKit's legacy SVC API orders inclusive spatial layers f..q, with the
// scalability mode only on the first encoding. RID simulcast uses L1T on each.
function hasLegacySvcEncodings(encodings: readonly RTCRtpEncodingParameters[]) {
  const mode = (encoding: RTCRtpEncodingParameters) => (encoding as RTCRtpEncodingParameters & { scalabilityMode?: string }).scalabilityMode;
  return encodings.length > 1 && /^L[2-9]T\d/.test(mode(encodings[0]) || "") && encodings.slice(1).every(encoding => !mode(encoding));
}

/** Apply an aggregate simulcast ceiling or an inclusive SVC ceiling. */
export function capStudioVideoEncodings<T extends RTCRtpEncodingParameters>(
  encodings: T[], bitrateKbps: number, fps: number, allowCaptureFrameRate = false,
): T[] {
  if (!isValidStudioVideoBitrateKbps(bitrateKbps) || !(allowCaptureFrameRate ? Number.isFinite(fps) && fps > 0 && fps <= 1000 : STUDIO_FRAME_RATES.includes(fps as StudioFrameRate))) {
    throw new Error("Некорректный битрейт или частота кадров Studio Return");
  }
  if (!encodings.length) return encodings;
  const weights = encodings.map(encoding => Math.max(1, Number(encoding.maxBitrate) || 0));
  const ceiling = bitrateKbps * 1000;
  if (hasLegacySvcEncodings(encodings)) {
    return encodings.map((encoding, index) => ({
      ...encoding,
      maxBitrate: index === 0 ? ceiling : Math.max(1, Math.floor(ceiling * Math.min(weights[index], weights[0]) / weights[0])),
      maxFramerate: fps,
    }));
  }
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;
  return encodings.map((encoding, index) => {
    const maxBitrate = index === encodings.length - 1
      ? Math.max(1, ceiling - assigned)
      : Math.max(1, Math.floor(ceiling * weights[index] / totalWeight));
    assigned += maxBitrate;
    return { ...encoding, maxBitrate, maxFramerate: fps };
  });
}

export function studioVideoEncodingsMatch(encodings: readonly RTCRtpEncodingParameters[], bitrateKbps: number, fps: number) {
  if (!encodings.length) return false;
  const total = hasLegacySvcEncodings(encodings) ? Number(encodings[0].maxBitrate || 0) : encodings.reduce((sum, encoding) => sum + Number(encoding.maxBitrate || 0), 0);
  return Math.abs(total - bitrateKbps * 1000) <= 1 && encodings.every(encoding => encoding.maxFramerate === fps);
}

export async function applyStudioSenderQuality(sender: RTCRtpSender, bitrateKbps: number, fps: number, allowCaptureFrameRate = false) {
  for (let attempt = 0; ; attempt++) {
    const parameters = sender.getParameters();
    if (!parameters.encodings?.length) throw new Error("LiveKit не предоставил параметры кодирования видеопотока");
    parameters.encodings = capStudioVideoEncodings(parameters.encodings || [], bitrateKbps, fps, allowCaptureFrameRate);
    try { await sender.setParameters(parameters); return; }
    catch (error) {
      const invalidated = error instanceof DOMException && error.name === "InvalidModificationError";
      if (!invalidated || attempt >= 2) throw error;
    }
  }
}

export const DEFAULT_GUEST_VIDEO_BITRATE_KBPS = 4000;
export function guestVideoBitrate(metadata?: string) {
  try { const value = JSON.parse(metadata || "{}").videoMaxBitrateKbps; return isValidGuestVideoBitrateKbps(value) ? value : DEFAULT_GUEST_VIDEO_BITRATE_KBPS; }
  catch { return DEFAULT_GUEST_VIDEO_BITRATE_KBPS; }
}

/** Staff metadata controls camera height; legacy sessions start at 1080. */
export function guestCameraHeight(metadata?: string): 720 | 1080 {
  try { return JSON.parse(metadata || "{}")?.videoHeight === 720 ? 720 : 1080; }
  catch { return 1080; }
}
