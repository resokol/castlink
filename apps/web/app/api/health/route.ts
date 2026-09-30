import net from "node:net";
import tls from "node:tls";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type CheckResult = {
  ok: boolean;
  latencyMs: number;
  error?: string;
};

function timeoutMs() {
  return Number(process.env.CASTLINK_HEALTH_TIMEOUT_MS || 1500);
}

async function checkTcp(host: string, port: number): Promise<CheckResult> {
  const started = Date.now();
  return new Promise(resolve => {
    const socket = net.createConnection({ host, port });
    let settled = false;
    const finish = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs());
    socket.once("connect", () => finish({ ok: true, latencyMs: Date.now() - started }));
    socket.once("timeout", () => finish({ ok: false, latencyMs: Date.now() - started, error: "timeout" }));
    socket.once("error", error => finish({ ok: false, latencyMs: Date.now() - started, error: error.code || "connect_error" }));
  });
}

async function checkTls(host: string, port: number, servername: string): Promise<CheckResult> {
  const started = Date.now();
  return new Promise(resolve => {
    const socket = tls.connect({
      host,
      port,
      servername,
      rejectUnauthorized: true,
    });
    let settled = false;
    const finish = (result: CheckResult) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(result);
    };
    socket.setTimeout(timeoutMs());
    socket.once("secureConnect", () => finish({ ok: socket.authorized, latencyMs: Date.now() - started, ...(socket.authorized ? {} : { error: socket.authorizationError || "tls_error" }) }));
    socket.once("timeout", () => finish({ ok: false, latencyMs: Date.now() - started, error: "timeout" }));
    socket.once("error", error => finish({ ok: false, latencyMs: Date.now() - started, error: error.code || "tls_error" }));
  });
}

function parseHttpEndpoint(raw: string | undefined, fallback: string) {
  const value = raw?.trim() || fallback;
  const url = new URL(value);
  const port = Number(url.port || (url.protocol === "https:" ? 443 : 80));
  return { host: url.hostname, port, protocol: url.protocol };
}

export async function GET() {
  const headers = { "Cache-Control": "no-store, max-age=0" };
  const livekit = parseHttpEndpoint(process.env.LIVEKIT_SERVER_URL, "http://127.0.0.1:7880");
  const turnHost = process.env.CASTLINK_TURN_HEALTH_HOST?.trim() || "turn.castlink.ru";
  const turnTlsPort = Number(process.env.CASTLINK_TURN_TLS_PORT || 443);

  const [livekitTcp, turnTls] = await Promise.all([
    checkTcp(livekit.host, livekit.port),
    checkTls(turnHost, turnTlsPort, turnHost),
  ]);

  const productVersion = process.env.NEXT_PUBLIC_PRODUCT_VERSION?.trim() || null;
  const buildId = process.env.STUDIOLINK_RELEASE?.trim() || process.env.NEXT_PUBLIC_BUILD_ID?.trim() || process.env.NEXT_PUBLIC_APP_VERSION?.trim() || null;
  const storageBackend = (process.env.CASTLINK_STORAGE_BACKEND || "json").trim().toLowerCase();

  const checks = {
    web: { ok: true },
    livekit: livekitTcp,
    turnTls,
  };
  const ok = Object.values(checks).every(check => check.ok);

  return NextResponse.json({
    status: ok ? "ok" : "degraded",
    productVersion,
    buildId,
    storageBackend,
    uptimeSec: Math.floor(process.uptime()),
    checks,
  }, { status: ok ? 200 : 503, headers });
}
