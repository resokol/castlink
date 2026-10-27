import { NextRequest, NextResponse } from "next/server";
import { sanitizeClientError, safeBuild } from "../../../lib/client-error-report";
import { requestSource } from "../../../lib/rate-limit";
import { serverLog } from "../../../lib/server-log";
import { maintenanceResponse } from "../../../lib/update-maintenance";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const sources = new Map<string, number>();
let windowStart = 0, total = 0, active = 0;
const response = (status: number) => new NextResponse(null, { status, headers: { "Cache-Control": "no-store", ...(status === 429 ? { "Retry-After": "60" } : {}) } });
function takeBudget(request: NextRequest) {
  const now = Date.now();
  if (now - windowStart >= 60000) { windowStart = now; total = 0; sources.clear(); }
  // Count attempts before reading/parsing bodies; never log refusals.
  if (total >= 60 || active >= 4) return false;
  total++;
  const source = requestSource(request), count = sources.get(source) || 0;
  if (count >= 6 || !sources.has(source) && sources.size >= 256) return false;
  sources.set(source, count + 1);
  return true;
}
async function readBounded(request: NextRequest) {
  const reader = request.body?.getReader();
  if (!reader) throw 400;
  const chunks: Uint8Array[] = [];
  let bytes = 0, timeout: ReturnType<typeof setTimeout> | undefined;
  const read = async () => {
    while (true) {
      const next = await reader.read();
      if (next.done) return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
      bytes += next.value.byteLength;
      if (bytes > 8192) throw 413;
      chunks.push(next.value);
    }
  };
  try {
    return await Promise.race([read(), new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(408), 2000); })]);
  } finally {
    if (timeout) clearTimeout(timeout);
    void reader.cancel().catch(() => undefined);
  }
}
export async function POST(request: NextRequest) {
  try {
    const origin = request.headers.get("origin");
    if (!origin || !/^https?:\/\//.test(origin) || new URL(origin).origin !== origin || new URL(origin).host !== (request.headers.get("host") || request.nextUrl.host) || request.headers.get("sec-fetch-site") === "cross-site") return response(403);
    if (!request.headers.get("content-type")?.startsWith("application/json")) return response(415);
    if (!takeBudget(request)) return response(429);
    const maintenance = maintenanceResponse(request.method, request.nextUrl.pathname);
    if (maintenance) return maintenance;
    active++;
    try {
      const raw = await readBounded(request);
      if (!raw || typeof raw !== "object" || Array.isArray(raw)) return response(400);
      const report = sanitizeClientError(raw);
      serverLog("error", "browser.crash", { ...report, serverBuild: safeBuild(process.env.NEXT_PUBLIC_BUILD_ID || process.env.NEXT_PUBLIC_APP_VERSION) });
      return response(202);
    } catch (error) { return response(typeof error === "number" ? error : 400); }
    finally { active--; }
  } catch { return response(403); }
}
