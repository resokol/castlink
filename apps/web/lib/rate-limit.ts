import type { NextRequest } from "next/server";
import { serverLog } from "./server-log";

type Bucket = { count: number; resetAt: number; touchedAt: number };
const buckets = new Map<string, Bucket>();
const maxBuckets = 50_000;

export type RateLimitOptions = {
  scope: string;
  limit: number;
  windowMs: number;
  subject?: string;
  cost?: number;
};

export type RateLimitDecision = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSec: number;
  source: string;
};

function cleanSource(value: string) {
  const trimmed = value.trim();
  return trimmed.length > 160 ? trimmed.slice(0, 160) : trimmed;
}

export function requestSource(request: NextRequest) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",").map(part => part.trim()).filter(Boolean) || [];
  if (forwarded.length) return cleanSource(forwarded[forwarded.length - 1]);
  const real = request.headers.get("x-real-ip")?.trim();
  return real ? cleanSource(real) : "local";
}

function prune(now: number) {
  if (buckets.size < maxBuckets) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
  if (buckets.size < maxBuckets) return;
  const remove = Math.max(1, Math.ceil(maxBuckets * 0.2));
  let removed = 0;
  for (const key of buckets.keys()) {
    buckets.delete(key);
    if (++removed >= remove) break;
  }
}

export function consumeRateLimit(request: NextRequest, options: RateLimitOptions): RateLimitDecision {
  const now = Date.now();
  prune(now);
  const source = requestSource(request);
  const subject = (options.subject || "").replace(/[^A-Za-z0-9._:@/-]/g, "_").slice(0, 180);
  const key = `${options.scope}:${source}:${subject}`;
  const cost = Math.max(1, Math.min(options.limit, Math.floor(options.cost || 1)));
  let bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    bucket = { count: 0, resetAt: now + options.windowMs, touchedAt: now };
    buckets.set(key, bucket);
  }
  bucket.touchedAt = now;
  const next = bucket.count + cost;
  const ok = next <= options.limit;
  if (ok) bucket.count = next;
  const remaining = Math.max(0, options.limit - bucket.count);
  if (!ok) {
    serverLog("warn", "control.rate_limited", {
      scope: options.scope,
      source,
      subject: subject || undefined,
      limit: options.limit,
      windowMs: options.windowMs,
      retryAfterSec: Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    });
  }
  return {
    ok,
    limit: options.limit,
    remaining,
    resetAt: bucket.resetAt,
    retryAfterSec: ok ? 0 : Math.max(1, Math.ceil((bucket.resetAt - now) / 1000)),
    source,
  };
}

export function rateLimitHeaders(decision: RateLimitDecision) {
  return {
    "X-RateLimit-Limit": String(decision.limit),
    "X-RateLimit-Remaining": String(decision.remaining),
    "X-RateLimit-Reset": String(Math.ceil(decision.resetAt / 1000)),
    ...(decision.ok ? {} : { "Retry-After": String(decision.retryAfterSec) }),
  };
}

export function resetRateLimitsForTests() {
  buckets.clear();
}
