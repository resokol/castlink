import type { RoomMediaDiagnosis } from "./room-media-diagnosis";
import type { RoomSfuEvidenceHistory } from "./room-sfu-evidence";
import type { TelemetryRole } from "./telemetry-types";

export type RoomDiagnosticsScope = {
  room: string;
  from: number;
  to: number;
  minute?: number;
  role?: TelemetryRole;
  identity?: string;
  session?: string;
};

export type NodeCpuSample = { at: number; cpuPercent: number | null };

type ElevatedCpuInterval = { from: number; to: number; peakPercent: number; samples: number };
export type RoomServerLoad = {
  source: "node-monitor"; scope: "node-os"; clock: "node-unix-ms";
  reason?: "platform-access-required" | "no-observations" | "storage-unavailable";
  thresholdPercent: number; qualifyingSpanMs: number; maxSampleGapMs: number;
  storedSamples: number; observedSamples: number; bucketMs: number; limited: boolean;
  samples: { at: number; cpuPercent: number }[];
  elevated: ElevatedCpuInterval[];
  overlaps: { findingIndex: number; at: number; from: number; to: number; peakPercent: number }[];
};

export type RoomDiagnosticsReport = RoomDiagnosticsScope & {
  /** Every matching retained record was readable. Clients verify this on the final NDJSON line. */
  complete: boolean;
  sampleCount: number;
  skippedRecords: number;
  unreadableHours: number;
  firstAt: number | null;
  lastAt: number | null;
  diagnosis: RoomMediaDiagnosis;
  verdicts?: import("./connection-verdicts").ConnectionVerdict[];
  sfu: RoomSfuEvidenceHistory;
  serverLoad: RoomServerLoad;
  incident?: import("./incident-minute").MinuteEvidence;
};
