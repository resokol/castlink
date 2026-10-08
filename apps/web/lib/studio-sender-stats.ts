import { readTrackStats } from "./media-stats";
import type { StudioOutboundMetrics } from "./studio-outbound-stats";

type Counter = { id: string; bytes: number; at: number; width: number; height: number; fps?: number; frames?: number };
type StatsTrack = { getSenderStats?: () => Promise<unknown>; getRTCStatsReport?: () => Promise<unknown> };
export type StudioSenderStatsState = {
  videoTrack?: StatsTrack; audioTrack?: StatsTrack;
  video: Map<string, Counter>; audio: Map<string, Counter>;
};

export function createStudioSenderStatsState(): StudioSenderStatsState {
  return { video: new Map(), audio: new Map() };
}

function normalize(value: any): Counter | undefined {
  const id = value?.streamId ?? value?.id ?? value?.ssrc ?? value?.rid;
  if (id === undefined || !Number.isFinite(value?.bytesSent) || value.bytesSent < 0 || !Number.isFinite(value?.timestamp) || value.timestamp <= 0) return;
  const positive = (n: unknown) => typeof n === "number" && Number.isFinite(n) && n >= 0 ? n : undefined;
  return { id: String(id), bytes: value.bytesSent, at: value.timestamp,
    width: positive(value.frameWidth) ?? 0, height: positive(value.frameHeight) ?? 0,
    fps: positive(value.framesPerSecond), frames: positive(value.framesSent ?? value.framesEncoded) };
}

async function readCounters(track: StatsTrack | undefined, kind: "video" | "audio"): Promise<Counter[] | undefined> {
  if (!track) return;
  if (track.getSenderStats) {
    try {
      const result = await readTrackStats(track, "getSenderStats");
      const counters = (Array.isArray(result) ? result : result ? [result] : []).map(normalize).filter((value): value is Counter => Boolean(value));
      if (counters.length) return counters;
    } catch { /* Try the raw report when the SDK wrapper is unavailable. */ }
  }
  if (track.getRTCStatsReport) {
    try {
      const report = await readTrackStats(track, "getRTCStatsReport");
      const counters: Counter[] = [];
      report?.forEach((value: any) => {
        if (value.type !== "outbound-rtp" || value.isRemote || (value.kind ?? value.mediaType) !== kind) return;
        const counter = normalize(value);
        if (counter) counters.push(counter);
      });
      if (counters.length) return counters;
    } catch { /* Leave the last real sample to age out; missing stats are not zero traffic. */ }
  }
}

function measure(previous: Map<string, Counter>, counters: Counter[]) {
  const next = new Map<string, Counter>();
  const rates: Array<{ counter: Counter; kbps: number; fps: number }> = [];
  for (const counter of counters) {
    if (next.has(counter.id)) continue;
    const before = previous.get(counter.id);
    // Cached or out-of-order reports cannot move the baseline backwards or create a fresh zero.
    if (before && counter.at <= before.at) { next.set(counter.id, before); continue; }
    next.set(counter.id, counter);
    if (!before || counter.bytes < before.bytes) continue;
    const elapsed = counter.at - before.at;
    const fps = counter.fps ?? (counter.frames !== undefined && before.frames !== undefined && counter.frames >= before.frames ? (counter.frames - before.frames) * 1000 / elapsed : 0);
    rates.push({ counter, kbps: (counter.bytes - before.bytes) * 8 / elapsed, fps });
  }
  return { next, rates };
}

/** Measure the main-room publication only. The independent /watch relay is not part of this graph. */
export async function sampleStudioSenderStats(state: StudioSenderStatsState, videoTrack: StatsTrack | undefined, audioTrack: StatsTrack | undefined): Promise<{ metrics: StudioOutboundMetrics; videoStats: number } | undefined> {
  if (state.videoTrack !== videoTrack) { state.videoTrack = videoTrack; state.video.clear(); }
  if (state.audioTrack !== audioTrack) { state.audioTrack = audioTrack; state.audio.clear(); }
  const [video, audio] = await Promise.all([readCounters(videoTrack, "video"), readCounters(audioTrack, "audio")]);
  const videoMeasurement = video ? measure(state.video, video) : undefined;
  const audioMeasurement = audio ? measure(state.audio, audio) : undefined;
  if (videoMeasurement) state.video = videoMeasurement.next;
  if (audioMeasurement) state.audio = audioMeasurement.next;
  if (!videoMeasurement?.rates.length) return;
  const flowing = videoMeasurement.rates.filter(value => value.kbps > 0);
  const resolutionCandidates = flowing.length ? flowing : videoMeasurement.rates;
  const largest = resolutionCandidates.reduce((best, value) => value.counter.width * value.counter.height > best.counter.width * best.counter.height ? value : best);
  const { width, height } = largest.counter;
  return { metrics: {
    resolution: width && height ? `${width}×${height}` : "—",
    videoKbps: Math.round(videoMeasurement.rates.reduce((sum, value) => sum + value.kbps, 0)),
    audioKbps: Math.round(audioMeasurement?.rates.reduce((sum, value) => sum + value.kbps, 0) ?? 0),
    fps: largest.fps,
  }, videoStats: video?.length ?? 0 };
}
