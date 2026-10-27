import { errorField, sanitizeClientError, type ClientErrorKind } from "./client-error-report";

type Reporter = (kind: ClientErrorKind, error: unknown, stackHint?: string) => void;
export function createBrowserErrorReporter(send: (body: string) => unknown, now = Date.now, context: () => { route: string; build: string } = () => ({ route: "other", build: "unknown" })): Reporter {
  let start = 0, count = 0, lifetime = 0;
  const seen = new Set<string>();
  return (kind, error, stackHint) => {
    try {
      if (lifetime >= 20) return;
      const at = now();
      if (!start || at - start >= 60000) { start = at; count = 0; seen.clear(); }
      if (count >= 5) return;
      const report = sanitizeClientError({ ...context(), kind, at, name: errorField(error, "name"), message: errorField(error, "message"), stack: [errorField(error, "stack"), stackHint].filter((value): value is string => typeof value === "string").map(value => value.slice(0, 10000)).join("\n") });
      const key = JSON.stringify({ ...report, at: 0 });
      if (seen.has(key)) return;
      seen.add(key); count++; lifetime++;
      // Neither a synchronous transport failure nor a rejected fetch becomes another error.
      void Promise.resolve(send(JSON.stringify(report))).catch(() => undefined);
    } catch { /* Diagnostics must never break recovery or live media. */ }
  };
}
function browserContext() {
  let route = "other";
  const first = window.location.pathname.split("/")[1];
  if (!first) route = "home";
  else if (["studio", "guest", "watch", "viewer", "output"].includes(first)) route = first;
  return { route, build: process.env.NEXT_PUBLIC_BUILD_ID || process.env.NEXT_PUBLIC_APP_VERSION || "unknown" };
}
const report = createBrowserErrorReporter(body => fetch("/api/client-errors", {
  method: "POST", headers: { "content-type": "application/json" }, body,
  credentials: "omit", referrerPolicy: "no-referrer", mode: "same-origin", cache: "no-store", keepalive: true,
}), Date.now, browserContext);
export const reportBrowserError: Reporter = (kind, error) => report(kind, error);
export function installBrowserErrorListeners(target: EventTarget, reporter: Reporter = report): () => void {
  const onError = (event: Event) => {
    try {
      const file = errorField(event, "filename"), line = errorField(event, "lineno"), column = errorField(event, "colno");
      const hint = typeof file === "string" && typeof line === "number" && typeof column === "number" ? file + ":" + line + ":" + column : undefined;
      reporter("error", errorField(event, "error"), hint);
    } catch { /* Hostile error objects do not escape the observer. */ }
  };
  const onRejection = (event: Event) => { try { reporter("rejection", errorField(event, "reason")); } catch { /* Best effort only. */ } };
  target.addEventListener("error", onError);
  target.addEventListener("unhandledrejection", onRejection);
  return () => { target.removeEventListener("error", onError); target.removeEventListener("unhandledrejection", onRejection); };
}
