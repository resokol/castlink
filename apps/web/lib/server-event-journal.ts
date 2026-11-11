import { safeServerEvent } from "./server-event-sanitize";
import { serverObservabilityStore } from "./server-observability-store";
import type { PendingServerEvent, ServerEventLevel } from "./server-event-types";

const key = Symbol.for("castlink.server-event-journal");
type Journal = { enabled: boolean; stopped: boolean; queue: { record: PendingServerEvent; bytes: number }[]; bytes: number; timer?: ReturnType<typeof setTimeout> };
function state(): Journal {
  const shared = globalThis as typeof globalThis & { [key: symbol]: Journal | undefined };
  return shared[key] ||= { enabled: false, stopped: false, queue: [], bytes: 0 };
}
function drop(count: number) { try { serverObservabilityStore().addDroppedEvents(count); } catch { /* Console logs remain the fallback; never recurse into serverLog. */ } }
export function flushServerEventJournal() {
  const current = state();
  const batch = current.queue.splice(0, 100);
  current.bytes -= batch.reduce((sum, item) => sum + item.bytes, 0);
  if (!batch.length) return;
  try { serverObservabilityStore().appendEvents(batch.map(item => item.record)); }
  catch { drop(batch.length); }
}
function schedule() {
  const current = state();
  if (!current.enabled || current.stopped || current.timer || !current.queue.length) return;
  current.timer = setTimeout(() => { current.timer = undefined; flushServerEventJournal(); schedule(); }, 1000);
  current.timer.unref();
}
export function startServerEventJournal() { const current = state(); if (!current.stopped) { current.enabled = true; schedule(); } }
export function enqueueServerEvent(level: ServerEventLevel, event: string, fields: Record<string, unknown>) {
  const current = state();
  if (!current.enabled || current.stopped) return;
  try {
    const record = safeServerEvent(level, event, fields);
    if (!record) { drop(1); return; }
    const bytes = Buffer.byteLength(JSON.stringify(record));
    if (current.bytes + bytes > 256 * 1024) { drop(1); return; }
    current.queue.push({ record, bytes }); current.bytes += bytes; schedule();
  } catch { drop(1); }
}
export function stopServerEventJournal() {
  const current = state();
  if (current.stopped) return;
  current.stopped = true; current.enabled = false;
  clearTimeout(current.timer); current.timer = undefined;
  if (current.queue.length > 300) {
    const discarded = current.queue.splice(300);
    current.bytes -= discarded.reduce((sum, item) => sum + item.bytes, 0);
    drop(discarded.length);
  }
  // At most three 100-record/25ms transactions during exit; never keep a process alive to drain logs.
  for (let n = 0; n < 3 && current.queue.length; n++) flushServerEventJournal();
  current.queue = []; current.bytes = 0;
}
