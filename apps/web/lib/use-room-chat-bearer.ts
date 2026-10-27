"use client";
import { sessionHttpBearer } from "./session-http-bearer";

import { useEffect, useState } from "react";

type Options = { token?: string; refreshUrl: string; scope: string; enabled?: boolean };
type Snapshot = { source: string; scope: string; refreshUrl: string; bearer: string };
const CHECK_INTERVAL_MS = 60_000;
const RETRY_MS = 30_000;
const REQUEST_TIMEOUT_MS = 10_000;

// The claim is only a scheduling hint. Authorization remains the server's job.
function expiresAt(token: string): number | null {
  try {
    const payload = JSON.parse(atob(token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/")));
    return typeof payload.exp === "number" && Number.isFinite(payload.exp) && payload.exp >= 0 && Number.isSafeInteger(payload.exp * 1000)
      ? payload.exp * 1000 : null;
  } catch { return null; }
}

/** Renew the HTTP chat credential independently; never replace a media token. */
export function useRoomChatBearer({ token, refreshUrl, scope, enabled = true }: Options): string {
  const source = token || "";
  const [snapshot, setSnapshot] = useState<Snapshot>({ source, scope, refreshUrl, bearer: source });

  useEffect(() => {
    let closed = false;
    let bearer = source;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let timeout: ReturnType<typeof setTimeout> | undefined;
    let pending: AbortController | undefined;
    setSnapshot({ source, scope, refreshUrl, bearer });

    function schedule(ms: number) {
      if (!closed) timer = setTimeout(() => { void check(); }, ms);
    }
    function scheduleCheck() {
      const expiry = expiresAt(bearer);
      if (expiry === null) return; // Do not invent a lifetime for opaque tokens.
      const remaining = expiry - Date.now() - CHECK_INTERVAL_MS;
      schedule(remaining > 0 ? Math.min(CHECK_INTERVAL_MS, remaining) : RETRY_MS);
    }
    async function check() {
      if (closed || pending) return;
      const expiry = expiresAt(bearer);
      if (expiry === null) return;
      if (expiry - Date.now() > CHECK_INTERVAL_MS) { scheduleCheck(); return; }
      const controller = new AbortController();
      pending = controller;
      timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
      try {
        const aborted = new Promise<never>((_, reject) => {
          controller.signal.addEventListener("abort", () => reject(new Error("Chat credential renewal aborted")), { once: true });
        });
        const next = await Promise.race([
          fetch(refreshUrl, {
            method: "GET", cache: "no-store", headers: { Authorization: `Bearer ${sessionHttpBearer(bearer)}` }, signal: controller.signal,
          }).then(async response => {
            if (!response.ok) throw new Error("Chat credential renewal failed");
            const data = await response.json();
            if (typeof data?.token !== "string" || !data.token.trim() || data.token.length > 20_000) throw new Error("Invalid chat credential");
            return data.token as string;
          }),
          aborted,
        ]);
        if (closed || controller.signal.aborted) return;
        bearer = next;
        setSnapshot({ source, scope, refreshUrl, bearer });
        scheduleCheck();
      } catch {
        // Preserve the previous identity/bearer and retry authenticated renewal.
        // Never fall back to an anonymous request that could create a new guest.
        schedule(RETRY_MS);
      } finally {
        clearTimeout(timeout);
        pending = undefined;
      }
    }

    if (enabled && source && refreshUrl) {
      const expiry = expiresAt(source);
      if (expiry !== null && expiry - Date.now() <= CHECK_INTERVAL_MS) void check();
      else scheduleCheck();
    }
    return () => {
      closed = true;
      clearTimeout(timer);
      clearTimeout(timeout);
      pending?.abort();
    };
  }, [source, refreshUrl, scope, enabled]);

  return snapshot.source === source && snapshot.scope === scope && snapshot.refreshUrl === refreshUrl ? snapshot.bearer : source;
}
