// Original media tokens stay stable; HTTP requests resolve the latest renewal.
type Claims = { scope: string; expiresAt: number };
type Entry = { token: string; claims: Claims; owners: number };
const sessions = new Map<string, Entry>();
const MAX_SESSIONS = 64;

function claims(token: string): Claims | undefined {
  try {
    if (!token || token.length > 32_768) return;
    const part = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const payload = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(part.padEnd(Math.ceil(part.length / 4) * 4, "=")), char => char.charCodeAt(0))));
    const metadata = JSON.parse(payload.metadata || "{}");
    if (typeof payload.sub !== "string" || typeof payload.video?.room !== "string" || typeof payload.exp !== "number" || !Number.isFinite(payload.exp)) return;
    return { scope: JSON.stringify([payload.iss, payload.sub, payload.video.room, metadata.studioId, metadata.role, metadata.clientId, metadata.epoch]), expiresAt: payload.exp };
  } catch { return; }
}

/** Pure lookup: no timers, HTTP requests, or changes to media/effect identity. */
export function sessionHttpBearer(source?: string): string {
  return source ? sessions.get(source)?.token ?? source : "";
}

/** Only a live telemetry owner may publish a successful server renewal. */
export function retainSessionHttpBearer(source: string) {
  let entry = sessions.get(source);
  const initial = claims(source);
  if (!entry && initial && sessions.size < MAX_SESSIONS) {
    entry = { token: source, claims: initial, owners: 0 };
    sessions.set(source, entry);
  }
  if (entry) entry.owners++;
  const retained = entry;
  let closed = false;
  return {
    update(token: string) {
      if (closed || !retained || sessions.get(source) !== retained) return false;
      const next = claims(token);
      if (!next || next.scope !== retained.claims.scope || next.expiresAt <= retained.claims.expiresAt) return false;
      retained.token = token; retained.claims = next;
      return true;
    },
    release() {
      if (closed) return;
      closed = true;
      if (retained && sessions.get(source) === retained && --retained.owners === 0) sessions.delete(source);
    },
  };
}
