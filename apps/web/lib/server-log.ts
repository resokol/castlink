import { randomUUID } from "node:crypto";
import type { NextRequest } from "next/server";

const SAFE_ID = /^[A-Za-z0-9._:-]{1,128}$/;

export function requestId(request?: NextRequest) {
  const incoming = request?.headers.get("x-request-id")?.trim();
  return incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
}

function sanitize(value: unknown): unknown {
  if (value === undefined || value === null || typeof value === "boolean" || typeof value === "number") return value;
  if (typeof value === "string") return value.slice(0, 200);
  if (Array.isArray(value)) return value.slice(0, 20).map(sanitize);
  if (typeof value === "object") {
    const source = value as Record<string, unknown>;
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(source)) {
      if (/secret|token|password|authorization|cookie|cipher|invite|access/i.test(key)) {
        result[key] = "[redacted]";
      } else {
        result[key] = sanitize(item);
      }
    }
    return result;
  }
  return String(value).slice(0, 200);
}

export function serverLog(
  level: "info" | "warn" | "error",
  event: string,
  fields: Record<string, unknown> = {},
) {
  const record = {
    ts: new Date().toISOString(),
    level,
    event,
    service: "castlink-web",
    ...sanitize(fields) as Record<string, unknown>,
  };
  const line = JSON.stringify(record);
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.log(line);
}

export function requestHeaders(id: string, extra: Record<string, string> = {}) {
  return { "x-request-id": id, ...extra };
}
