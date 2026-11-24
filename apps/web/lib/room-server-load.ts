import type { RoomMediaFinding } from "./room-media-diagnosis";
import type { NodeCpuSample, RoomServerLoad } from "./room-diagnostics-types";

const maxPoints = 120, maxIntervals = 48;
type FindingTimes = Pick<RoomMediaFinding, "firstAt" | "lastAt">;

/** OS CPU as visible to the node monitor, on the same node clock as the telemetry receipt time.
 * Its persisted rows do not contain cgroup scope or per-process/SFU CPU. */
export async function readRoomServerLoad(from: number, to: number, findings: FindingTimes[], platform: boolean): Promise<{ summary: RoomServerLoad; originals: NodeCpuSample[] }> {
  const result: RoomServerLoad = {
    source: "node-monitor", scope: "node-os", clock: "node-unix-ms",
    thresholdPercent: 85, qualifyingSpanMs: 30_000, maxSampleGapMs: 22_500, storedSamples: 0, observedSamples: 0,
    bucketMs: Math.max(1, Math.ceil((to - from + 1) / maxPoints)), limited: false, samples: [], elevated: [], overlaps: [],
  };
  const unavailable = (reason: NonNullable<RoomServerLoad["reason"]>) => ({ summary: { ...result, reason }, originals: [] });
  if (!platform) return unavailable("platform-access-required");

  let history: { samples: NodeCpuSample[]; available: boolean };
  try {
    const { serverObservabilityStore } = await import("./server-observability-store");
    history = serverObservabilityStore().readCpuSamples(from, to);
  } catch { return unavailable("storage-unavailable"); }
  if (!history.available) return unavailable("storage-unavailable");

  let bucket = -1, run: RoomServerLoad["elevated"][number] | undefined;
  const finishRun = () => {
    if (run && run.to - run.from >= result.qualifyingSpanMs) {
      if (result.elevated.length < maxIntervals) result.elevated.push(run);
      else result.limited = true;
      // Only a finding's endpoints are known observation times. Its interior may contain gaps.
      for (const [findingIndex, finding] of findings.entries()) {
        for (const at of new Set([finding.firstAt, finding.lastAt])) {
          if (at >= run.from && at <= run.to) result.overlaps.push({ findingIndex, at, from: run.from, to: run.to, peakPercent: run.peakPercent });
        }
      }
    }
    run = undefined;
  };
  result.storedSamples = history.samples.length;
  for (const { at, cpuPercent } of history.samples) {
    if (cpuPercent === null) { finishRun(); continue; }
    result.observedSamples++;
    const index = Math.floor((at - from) / result.bucketMs);
    if (index !== bucket) { result.samples.push({ at, cpuPercent }); bucket = index; }
    else if (cpuPercent > result.samples.at(-1)!.cpuPercent) result.samples[result.samples.length - 1] = { at, cpuPercent };
    if (cpuPercent < result.thresholdPercent) { finishRun(); continue; }
    if (run && at - run.to > result.maxSampleGapMs) finishRun();
    if (!run) run = { from: at, to: at, peakPercent: cpuPercent, samples: 1 };
    else { run.to = at; run.peakPercent = Math.max(run.peakPercent, cpuPercent); run.samples++; }
  }
  finishRun();
  result.limited ||= result.samples.length < result.observedSamples;
  if (!result.observedSamples) result.reason = "no-observations";
  return { summary: result, originals: history.samples };
}
