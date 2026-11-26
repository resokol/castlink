import type { RoomMediaDiagnosis, RoomMediaFindingCode } from "./room-media-diagnosis";

const locations = {
  "sender-cpu": "before", "sender-bandwidth": "before", "sender-loss": "before",
  "receiver-decode": "after", "receiver-path": "after",
  "receiver-layer": "unknown", "shared-path": "unknown", "unlocalized": "unknown",
} as const satisfies Record<RoomMediaFindingCode, string>;

export function findingLocation(code: RoomMediaFindingCode) {
  return locations[code] ?? "unknown";
}

export type ConnectionVerdict =
  | { location: "before" | "after" | "unknown"; findingIndex: number }
  | { location: "inside"; reason: "livekit-api-check-failed"; at: number }
  | { location: "clear" | "unknown"; reason: "no-symptoms" | "insufficient-data" };

/** Findings are ordered newest first. Keep one example per location and retain
 * all findings in the report so different paths can be inspected separately. */
export function connectionVerdicts(diagnosis: RoomMediaDiagnosis, complete: boolean, lastFailedCheckAt?: number): ConnectionVerdict[] {
  const conclusions: ConnectionVerdict[] = [];
  if (lastFailedCheckAt !== undefined) {
    conclusions.push({ location: "inside", reason: "livekit-api-check-failed", at: lastFailedCheckAt });
  }
  const seen = new Set<string>();
  for (const [findingIndex, finding] of diagnosis.findings.entries()) {
    const location = findingLocation(finding.code);
    if (!seen.has(location)) {
      conclusions.push({ location, findingIndex });
      seen.add(location);
    }
  }
  if (!conclusions.length) {
    conclusions.push(complete && !diagnosis.coverage.limited && !diagnosis.coverage.reconnecting && diagnosis.coverage.evaluable > 0
      ? { location: "clear", reason: "no-symptoms" }
      : { location: "unknown", reason: "insufficient-data" });
  }
  return conclusions.sort((a, b) => Number(a.location === "unknown") - Number(b.location === "unknown"));
}
