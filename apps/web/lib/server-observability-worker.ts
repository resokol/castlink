import { collectServerMonitorSample } from "./server-monitor";
import { serverObservabilityStore, MONITOR_INTERVAL_MS } from "./server-observability-store";
import { startServerEventJournal, stopServerEventJournal } from "./server-event-journal";
import { serverLog } from "./server-log";
import { safeServerEvent } from "./server-event-sanitize";
import type { MonitorServiceState } from "./server-monitor-types";

const key = Symbol.for("castlink.server-observability-worker");
type Worker = { started: boolean; stopped: boolean; collecting: boolean; failed?: boolean; timer?: ReturnType<typeof setTimeout>; services?: Record<string, MonitorServiceState>; storage?: string; cleanup?: () => void };
const shared = globalThis as typeof globalThis & { [key: symbol]: Worker | undefined };

export function stopServerObservability() {
  const worker = shared[key];
  if (!worker || worker.stopped) return;
  worker.stopped = true; clearTimeout(worker.timer);
  worker.cleanup?.();
  serverLog("info", "server.observability.stopped");
  stopServerEventJournal();
  try { serverObservabilityStore().close(); } catch { /* A diagnostic failure cannot prevent shutdown. */ }
}
export function startServerObservability() {
  if (process.env.NEXT_PHASE === "phase-production-build" || process.env.NEXT_PRIVATE_BUILD_WORKER === "1" || shared[key]) return;
  const worker: Worker = { started: true, stopped: false, collecting: false };
  shared[key] = worker;
  startServerEventJournal();
  serverLog("info", "server.observability.started");
  const tick = async () => {
    if (worker.stopped || worker.collecting) return;
    worker.collecting = true;
    try {
      const sample = await collectServerMonitorSample();
      if (!worker.stopped) {
        const store = serverObservabilityStore();
        store.appendSample(sample);
        if (worker.failed) serverLog("info", "server.observability.collection_recovered");
        worker.failed = false;
        for (const name of ["livekit", "roomStore"] as const) {
          const status = sample.services[name], previous = worker.services?.[name];
          if (status !== previous && (previous !== undefined || status !== "ok")) serverLog(status === "ok" ? "info" : "warn", `server.${name === "roomStore" ? "room_store" : name}.${status === "ok" ? "recovered" : status}`);
        }
        worker.services = { ...sample.services };
        const storage = store.storage().state;
        if (storage !== worker.storage && (worker.storage !== undefined || storage !== "ok")) serverLog(storage === "ok" ? "info" : "warn", `server.observability_storage.${storage === "ok" ? "recovered" : "unavailable"}`);
        worker.storage = storage;
      }
    } catch {
      if (!worker.failed && !worker.stopped) serverLog("warn", "server.observability.collection_failed");
      worker.failed = true;
    }
    finally {
      worker.collecting = false;
      if (!worker.stopped) { worker.timer = setTimeout(() => void tick(), MONITOR_INTERVAL_MS); worker.timer.unref(); }
    }
  };
  process.once("exit", stopServerObservability);
  for (const signal of ["SIGTERM", "SIGINT"] as const) {
    const hadHandlers = process.listenerCount(signal) > 0;
    process.once(signal, () => {
      stopServerObservability();
      // A standalone caller keeps Node's default signal termination; Next retains its own graceful handlers.
      if (!hadHandlers && process.listenerCount(signal) === 0) process.kill(process.pid, signal);
    });
  }
  // Observation only: never install an uncaughtException handler or suppress Node's default rejection behavior.
  const observeError = (event: string, error: unknown, origin: string) => {
    if (worker.stopped) return;
    try {
      const value = error && typeof error === "object" ? error as NodeJS.ErrnoException : null;
      const fields = { reason: typeof value?.name === "string" ? value.name : "NonErrorRejection", code: typeof value?.code === "string" ? value.code : "UNKNOWN", action: origin };
      const record = safeServerEvent("error", event, fields);
      if (record) { console.error(JSON.stringify(record)); serverObservabilityStore().appendEvents([record]); }
    } catch { /* Never throw from a fatal-exception observer. */ }
  };
  const fatalObserver = (error: Error, origin: string) => observeError("server.uncaught_exception", error, origin);
  const rejectionObserver = (error: unknown) => observeError("server.unhandled_rejection", error, "unhandledRejection");
  let observingRejections = false;
  const reconcileRejections = () => {
    const otherListeners = process.listeners("unhandledRejection").filter(listener => listener !== rejectionObserver);
    if (!worker.stopped && otherListeners.length && !observingRejections) { observingRejections = true; process.on("unhandledRejection", rejectionObserver); }
    else if ((!otherListeners.length || worker.stopped) && observingRejections) { observingRejections = false; process.removeListener("unhandledRejection", rejectionObserver); }
  };
  const listenerAdded = (name: string | symbol, listener: (...args: unknown[]) => void) => { if (name === "unhandledRejection" && listener !== rejectionObserver) queueMicrotask(reconcileRejections); };
  const listenerRemoved = (name: string | symbol, listener: (...args: unknown[]) => void) => { if (name === "unhandledRejection" && listener !== rejectionObserver) reconcileRejections(); };
  process.on("uncaughtExceptionMonitor", fatalObserver);
  process.on("newListener", listenerAdded);
  process.on("removeListener", listenerRemoved);
  reconcileRejections();
  worker.cleanup = () => {
    process.removeListener("uncaughtExceptionMonitor", fatalObserver);
    process.removeListener("newListener", listenerAdded);
    process.removeListener("removeListener", listenerRemoved);
    if (observingRejections) process.removeListener("unhandledRejection", rejectionObserver);
  };
  void tick();
}
