"use client";

import { sanitizeRuntimeDiagnostic } from "./runtime-diagnostics";
import type { RuntimeDiagnostic, RuntimeEventKind, StudioMediaDiagnostic } from "./telemetry-types";
import { safeBuild } from "./client-error-report";

const storageKey = "castlink-studio-runtime-v1";
type SavedRuntime = { session: string; startedAt: number; savedAt: number; build: string; runtime: RuntimeDiagnostic };
type LocalReport = { schemaVersion: 1; active?: SavedRuntime; previous?: SavedRuntime };
let current: LocalReport = { schemaVersion: 1 };

function readSaved(): LocalReport {
  try {
    const raw = window.sessionStorage.getItem(storageKey);
    if (!raw || raw.length > 20000) return { schemaVersion: 1 };
    const parsed = JSON.parse(raw);
    const clean = (value: unknown): SavedRuntime | undefined => {
      if (!value || typeof value !== "object") return;
      const record = value as SavedRuntime, runtime = sanitizeRuntimeDiagnostic(record.runtime);
      if (!runtime || !/^[a-zA-Z0-9-]{1,80}$/.test(record.session) || !Number.isSafeInteger(record.startedAt) || !Number.isSafeInteger(record.savedAt)) return;
      return { session: record.session, startedAt: record.startedAt, savedAt: record.savedAt, build: safeBuild(record.build), runtime };
    };
    return { schemaVersion: 1, active: clean(parsed.active), previous: clean(parsed.previous) };
  } catch { return { schemaVersion: 1 }; }
}

/** One small snapshot for this tab and its preceding studio session. No room names or credentials. */
export function localRuntimeDiagnosticReport(): LocalReport {
  return JSON.parse(JSON.stringify(current.active ? current : readSaved()));
}

export function startBrowserRuntimeDiagnostics(session: string, mediaDiagnostic?: () => StudioMediaDiagnostic | undefined): {
  snapshot: () => RuntimeDiagnostic | undefined; event: (kind: RuntimeEventKind) => void; stop: () => void;
} {
  const noop = { snapshot: () => undefined, event: (_kind: RuntimeEventKind) => undefined, stop: () => undefined };
  if (typeof window === "undefined" || typeof document === "undefined") return noop;
  try {
    const startedAt = Date.now();
    const ua = navigator.userAgent;
    const browser: RuntimeDiagnostic["browser"] = /Edg\//.test(ua) ? "edge" : /Firefox\//.test(ua) ? "firefox" : /Chrome\//.test(ua) ? "chrome" : /Safari\//.test(ua) ? "safari" : "other";
    const visibility = (): RuntimeDiagnostic["visibility"] => document.visibilityState === "visible" ? "visible" : document.visibilityState === "hidden" ? "hidden" : "unknown";
    const now = () => performance.now();
    let stopped = false, expected = now() + 1000, lastSaved = 0;
    const previous = current.active || readSaved().active;
    const state: RuntimeDiagnostic = { visibility: visibility(), browser, environment: /Electron\//.test(ua) ? "desktop" : "browser",
      loopLagMs: null, maxLoopLagMs: null, longTasks: null, longTaskMaxMs: null, heapUsedBytes: null, heapLimitBytes: null,
      errors: 0, rejections: 0, events: [] };
    const snapshot = (): RuntimeDiagnostic | undefined => {
      try {
        // A stopped capture/provider must not suppress runtime evidence or retain stale media state.
        try { state.media = mediaDiagnostic?.(); } catch { state.media = undefined; }
        state.visibility = visibility();
        const memory = (performance as Performance & { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
        state.heapUsedBytes = memory?.usedJSHeapSize ?? null;
        state.heapLimitBytes = memory?.jsHeapSizeLimit ?? null;
        return sanitizeRuntimeDiagnostic(state);
      } catch { return undefined; }
    };
    const persist = (force = false) => {
      const at = Date.now();
      if (!force && at - lastSaved < 10000) return;
      lastSaved = at;
      const runtime = snapshot();
      if (!runtime) return;
      current = { schemaVersion: 1, active: { session, startedAt, savedAt: at,
        build: safeBuild(process.env.NEXT_PUBLIC_BUILD_ID || process.env.NEXT_PUBLIC_APP_VERSION), runtime }, previous };
      try { window.sessionStorage.setItem(storageKey, JSON.stringify(current)); } catch { /* Storage is optional. */ }
    };
    const event = (kind: RuntimeEventKind) => {
      if (stopped) return;
      state.events.push({ at: Date.now(), kind });
      if (state.events.length > 20) state.events.shift();
    };
    const listeners: (() => void)[] = [];
    const listen = (target: EventTarget, name: string, callback: () => void) => {
      target.addEventListener(name, callback); listeners.push(() => target.removeEventListener(name, callback));
    };
    listen(document, "visibilitychange", () => { expected = now() + 1000; state.loopLagMs = null; event(visibility() === "hidden" ? "hidden" : "visible"); persist(true); });
    listen(window, "error", () => { state.errors = Math.min(1e9, state.errors + 1); event("error"); persist(); });
    listen(window, "unhandledrejection", () => { state.rejections = Math.min(1e9, state.rejections + 1); event("rejection"); persist(); });
    for (const kind of ["offline", "online", "pagehide", "pageshow"] as const) listen(window, kind, () => { event(kind); persist(true); });
    let observer: PerformanceObserver | undefined;
    try {
      if (typeof PerformanceObserver !== "undefined" && PerformanceObserver.supportedEntryTypes?.includes("longtask")) {
        observer = new PerformanceObserver(list => {
          if (stopped || visibility() !== "visible") return;
          for (const entry of list.getEntries()) {
            state.longTasks = Math.min(1e9, (state.longTasks || 0) + 1);
            state.longTaskMaxMs = Math.max(state.longTaskMaxMs || 0, entry.duration);
          }
        });
        observer.observe({ type: "longtask" });
        state.longTasks = 0; state.longTaskMaxMs = 0;
      }
    } catch { observer?.disconnect(); observer = undefined; }
    const timer = setInterval(() => {
      if (stopped) return;
      const at = now();
      if (visibility() === "visible") {
        state.loopLagMs = Math.max(0, Math.round(at - expected));
        state.maxLoopLagMs = Math.max(state.maxLoopLagMs || 0, state.loopLagMs);
        if (state.loopLagMs >= 500) event("loop-stall");
      } else state.loopLagMs = null;
      expected = at + 1000; persist();
    }, 1000);
    event("started"); persist(true);
    return { snapshot, event, stop: () => {
      if (stopped) return;
      persist(true); stopped = true; clearInterval(timer); observer?.disconnect();
      for (const dispose of listeners) dispose();
    } };
  } catch { return noop; }
}
