import { NextRequest, NextResponse } from "next/server";
import { sameOrigin } from "@/lib/access";
import { hasHostedAccess, hostedAccessEnabled, hostedCookieName, signHostedSession, verifyHostedToken } from "@/lib/hosted-access";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
export const runtime = "nodejs";
const reply = (body: unknown, status = 200, headers = {}) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store", ...headers } });
export async function GET(request: NextRequest) {
  return reply({ enabled: hostedAccessEnabled(), allowed: hasHostedAccess(request) });
}
export async function POST(request: NextRequest) {
  if (!request.headers.get("origin") || !sameOrigin(request)) return reply({ error: "Недопустимый источник" }, 403);
  if (!hostedAccessEnabled()) return reply({ enabled: false, allowed: true });
  const limit = consumeRateLimit(request, { scope: "hosted-token", limit: 10, windowMs: 60_000 });
  if (!limit.ok) return reply({ error: "Слишком много попыток" }, 429, rateLimitHeaders(limit));
  let token: unknown;
  try {
    const length = request.headers.get("content-length");
    if (length && (!/^\d+$/.test(length) || Number(length) > 2048)) return reply({ error: "Слишком большой запрос" }, 413);
    const reader = request.body?.getReader();
    if (!reader) return reply({ error: "Некорректный запрос" }, 400);
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > 2048) { await reader.cancel(); return reply({ error: "Слишком большой запрос" }, 413); }
        chunks.push(value);
      }
    } finally { reader.releaseLock(); }
    token = JSON.parse(Buffer.concat(chunks).toString("utf8"))?.token;
  } catch { return reply({ error: "Некорректный запрос" }, 400); }
  const record = verifyHostedToken(token);
  if (!record) return reply({ error: "Токен недействителен, отозван или срок его действия истёк" }, 401);
  try {
    const response = reply({ enabled: true, allowed: true });
    response.cookies.set(hostedCookieName, signHostedSession(record), {
      httpOnly: true, secure: request.nextUrl.protocol === "https:" || request.headers.get("x-forwarded-proto") === "https",
      sameSite: "strict", path: "/", maxAge: Math.max(0, Math.floor((record.expiresAt - Date.now()) / 1000)),
    });
    return response;
  } catch { return reply({ error: "Вход временно недоступен" }, 503); }
}
export async function DELETE(request: NextRequest) {
  if (!request.headers.get("origin") || !sameOrigin(request)) return reply({ error: "Недопустимый источник" }, 403);
  const response = reply({ allowed: false });
  response.cookies.set(hostedCookieName, "", { httpOnly: true, sameSite: "strict", path: "/", maxAge: 0 });
  return response;
}
