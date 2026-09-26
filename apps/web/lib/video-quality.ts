import { Track, type TrackPublishOptions } from "livekit-client";

export const STUDIO_FRAME_RATES = [25, 30, 50, 60] as const;
export type StudioFrameRate = typeof STUDIO_FRAME_RATES[number];
export const VIDEO_BITRATES_KBPS = [500, 750, ...Array.from({ length: 19 }, (_, i) => (i + 2) * 500)];
export const MAX_GUEST_VIDEO_BITRATE = 10_000_000;

export function studioVideoConstraints(deviceId: string, fps: StudioFrameRate): MediaTrackConstraints {
  return {
    ...(deviceId ? { deviceId: { exact: deviceId } } : {}),
    width: { exact: 1920 }, height: { exact: 1080 }, frameRate: { ideal: fps, max: fps },
  };
}

export function studioVideoPublishOptions(bitrateKbps: number, fps: StudioFrameRate): TrackPublishOptions {
  if (!Number.isInteger(bitrateKbps) || bitrateKbps < 500 || bitrateKbps > 10000 || !STUDIO_FRAME_RATES.includes(fps)) {
    throw new Error("Некорректный битрейт или частота кадров Studio Return");
  }
  return {
    source: Track.Source.Camera, name: "Studio Return Video", simulcast: true,
    videoEncoding: { maxBitrate: bitrateKbps * 1000, maxFramerate: fps },
    degradationPreference: "maintain-resolution",
  };
}
