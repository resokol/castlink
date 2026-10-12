import type { AudioHistorySummary, AudioPlaybackDiagnostic, AudioReceiveDiagnostic, TelemetrySample } from "./telemetry-types";

const finite = (value: unknown): number | null => typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
export type AudioCounters = { at: number; received: number | null; concealed: number | null; events: number | null; delay: number | null; emitted: number | null };
const difference = (before: number | null, after: number | null) => before !== null && after !== null && after >= before ? after - before : null;

export function audioReceiveDiagnostic(stat: Record<string, any>, previous?: AudioCounters): { diagnostic: AudioReceiveDiagnostic; counters: AudioCounters } {
  const counters: AudioCounters = { at: stat.timestamp, received: finite(stat.totalSamplesReceived), concealed: finite(stat.concealedSamples),
    events: finite(stat.concealmentEvents), delay: finite(stat.jitterBufferDelay), emitted: finite(stat.jitterBufferEmittedCount) };
  const valid = previous && Number.isFinite(counters.at) && counters.at > previous.at;
  const delta = (key: "received" | "concealed" | "events" | "delay" | "emitted") => valid ? difference(previous[key], counters[key]) : null;
  const received = delta("received"), concealed = delta("concealed"), emitted = delta("emitted"), delay = delta("delay");
  return { counters, diagnostic: { statsAt: finite(stat.timestamp), intervalMs: valid ? counters.at - previous.at : null,
    receivedSamples: counters.received, concealedSamples: counters.concealed, concealmentEvents: counters.events,
    receivedSamplesDelta: received, concealedSamplesDelta: concealed, concealmentEventsDelta: delta("events"),
    // totalSamplesReceived already includes concealed samples, per WebRTC stats.
    concealedPct: received !== null && received > 0 && concealed !== null ? Math.min(100, concealed / received * 100) : null,
    jitterBufferDelayMs: delay !== null && emitted !== null && emitted > 0 ? delay / emitted * 1000 : null,
    audioLevel: finite(stat.audioLevel),
  } };
}

export function emptyAudioSummary(): AudioHistorySummary {
  return { samples: 0, lossIntervals: 0, concealmentIntervals: 0, noSampleProgressIntervals: 0, playbackWarnings: 0, recoveryAttempts: 0 };
}

export function addAudioSummary(summary: AudioHistorySummary, sample: TelemetrySample, recoveryBySession: Map<string, number>) {
  const audio = sample.streams.filter(s => s.kind === "audio" && s.direction === "in");
  const playback = sample.audioPlayback;
  if (!audio.length && !playback) return;
  summary.samples++;
  if (audio.some(s => s.lossPct !== null && s.lossPct > 0)) summary.lossIntervals++;
  if (audio.some(s => (s.audio?.concealedSamplesDelta ?? 0) > 0)) summary.concealmentIntervals++;
  if (audio.some(s => s.audio?.receivedSamplesDelta === 0 && (s.audio.intervalMs ?? 0) > 0)) summary.noSampleProgressIntervals++;
  if (playback?.enabled && (playback.paused || playback.trackState === "ended" || !!playback.errorCode || playback.subscribed === false)) summary.playbackWarnings++;
  if (playback && typeof playback.recoveryAttempts === "number") {
    const before = recoveryBySession.get(sample.session) ?? 0;
    summary.recoveryAttempts += Math.max(0, playback.recoveryAttempts - before);
    recoveryBySession.set(sample.session, Math.max(before, playback.recoveryAttempts));
  }
}

export function sanitizeAudioPlayback(value: unknown): AudioPlaybackDiagnostic | undefined {
  if (!value || typeof value !== "object" || typeof (value as any).enabled !== "boolean") return undefined;
  const v = value as Record<string, unknown>;
  return { enabled: v.enabled as boolean, subscribed: typeof v.subscribed === "boolean" ? v.subscribed : undefined,
    trackState: v.trackState === "live" || v.trackState === "ended" ? v.trackState : null,
    paused: typeof v.paused === "boolean" ? v.paused : null, muted: typeof v.muted === "boolean" ? v.muted : null,
    readyState: finite(v.readyState) === null ? null : Math.min(4, finite(v.readyState)!), currentTime: finite(v.currentTime),
    errorCode: finite(v.errorCode) === null ? null : Math.min(4, finite(v.errorCode)!),
    contextState: ["running", "suspended", "closed", "interrupted"].includes(String(v.contextState)) ? String(v.contextState) : null,
    recoveryAttempts: Math.min(100000, finite(v.recoveryAttempts) ?? 0), lastRecoveryAt: finite(v.lastRecoveryAt),
    // Only allow operational labels; exception messages/URLs can contain credentials.
    lastRecoveryReason: ["paused", "ended", "play-error", "play-timeout", "room-reconnected", "manual", "autoplay-blocked"].includes(String(v.lastRecoveryReason)) ? String(v.lastRecoveryReason) : null,
  };
}

export function sanitizeAudioReceive(value: unknown): AudioReceiveDiagnostic | undefined {
  if (!value || typeof value !== "object") return undefined;
  const v = value as Record<string, unknown>;
  const fields = ["statsAt", "intervalMs", "receivedSamples", "concealedSamples", "concealmentEvents", "receivedSamplesDelta", "concealedSamplesDelta", "concealmentEventsDelta", "concealedPct", "jitterBufferDelayMs", "audioLevel"] as const;
  const result = Object.fromEntries(fields.map(key => [key, finite(v[key]) === null ? null : Math.min(finite(v[key])!, key === "concealedPct" ? 100 : key === "audioLevel" ? 1 : 1e15)]));
  return result as AudioReceiveDiagnostic;
}
