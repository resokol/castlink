import type { PendingServerEvent, ServerEventFields, ServerEventLevel } from "./server-event-types";

const fieldsAllowed = new Set(["requestId", "status", "durationMs", "latencyMs", "reason", "code", "action", "count", "nodes", "studios", "rooms", "participants", "tracks", "success", "ok", "applied"]);
const identifier = /^[A-Za-z0-9_.:-]{1,128}$/;
const credential = /^(?:csa[12]\.|slot_|v1\.|eyJ[A-Za-z0-9_-]*\.|sk[-_]|gh[pousr]_|github_pat_|AKIA|ASIA|AIza|xox[baprs]-)|(?:bearer|basic)\s|^[A-Za-z0-9_-]{12,}\.[A-Za-z0-9_.-]{24,}$|^[a-f0-9]{16,}:[a-f0-9]{32,}$|^[a-f0-9]{64}$|^API[A-Za-z0-9]{12,}$/i;

/** The retained journal deliberately contains fewer fields than the console log. No free-text errors, URLs or identities. */
export function safeServerEvent(level: ServerEventLevel, event: string, fields: Record<string, unknown>, at = Date.now()): PendingServerEvent | null {
  if (!["info", "warn", "error"].includes(level) || !identifier.test(event) || credential.test(event) || !Number.isSafeInteger(at) || at < 0) return null;
  const safe: ServerEventFields = {};
  for (const [key, value] of Object.entries(fields)) {
    if (!fieldsAllowed.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value) || typeof value === "boolean") safe[key] = value;
    else if (typeof value === "string") safe[key] = identifier.test(value) && !credential.test(value) ? value : "[redacted]";
  }
  const record: PendingServerEvent = { at, level, event, service: "castlink-web", fields: safe };
  return Buffer.byteLength(JSON.stringify(record)) <= 2048 ? record : { ...record, fields: {} };
}
