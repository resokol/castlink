import type { RuntimeDiagnostic, RuntimeEventKind } from "./telemetry-types";

const eventKinds = new Set<RuntimeEventKind>(["started", "hidden", "visible", "offline", "online", "reconnecting",
  "signal-reconnecting", "reconnected", "disconnected", "error", "rejection", "pagehide", "pageshow", "loop-stall"]);
const metric = (value: unknown, max: number): number | null =>
  typeof value === "number" && Number.isFinite(value) && value >= 0 ? Math.min(value, max) : null;
const counter = (value: unknown) => Math.floor(metric(value, 1_000_000) ?? 0);

/** Keep only aggregate measurements and operational labels; never exception text or URLs. */
export function sanitizeRuntimeDiagnostic(raw: unknown): RuntimeDiagnostic | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const value = raw as Record<string, unknown>;
  if (!["visible", "hidden", "prerender", "unknown"].includes(value.visibility as string) ||
    !["chrome", "edge", "firefox", "safari", "other"].includes(value.browser as string) ||
    !["browser", "desktop"].includes(value.environment as string)) return undefined;
  const events: RuntimeDiagnostic["events"] = [];
  const rawEvents = Array.isArray(value.events) ? value.events : [];
  for (let index = rawEvents.length - 1; index >= 0 && events.length < 20; index--) {
    const item = rawEvents[index];
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const event = item as Record<string, unknown>;
    const at = metric(event.at, 1e15);
    if (at === null || !eventKinds.has(event.kind as RuntimeEventKind)) continue;
    events.unshift({ at, kind: event.kind as RuntimeEventKind });
  }
  return {
    visibility: value.visibility as RuntimeDiagnostic["visibility"],
    browser: value.browser as RuntimeDiagnostic["browser"], environment: value.environment as RuntimeDiagnostic["environment"],
    loopLagMs: metric(value.loopLagMs, 3_600_000), maxLoopLagMs: metric(value.maxLoopLagMs, 3_600_000),
    longTasks: metric(value.longTasks, 1_000_000), longTaskMaxMs: metric(value.longTaskMaxMs, 3_600_000),
    heapUsedBytes: metric(value.heapUsedBytes, 1e15), heapLimitBytes: metric(value.heapLimitBytes, 1e15),
    errors: counter(value.errors), rejections: counter(value.rejections), events,
  };
}
