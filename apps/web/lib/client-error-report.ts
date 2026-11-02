/** Deliberately excludes arbitrary messages, URLs, arguments and user/session data. */
export type ClientErrorKind = "error" | "rejection" | "boundary" | "global-boundary";
export type ClientErrorReport = { kind: ClientErrorKind; at: number; route: string; build: string; name: string; message: string; frames: string[] };
export function errorField(value: unknown, key: string): unknown {
  try { return value && (typeof value === "object" || typeof value === "function") ? (value as Record<string, unknown>)[key] : undefined; }
  catch { return undefined; }
}
const names = new Set(["Error", "TypeError", "ReferenceError", "RangeError", "SyntaxError", "URIError", "EvalError", "ChunkLoadError", "DOMException", "AbortError", "NotAllowedError", "NotFoundError", "NotReadableError", "InvalidStateError", "SecurityError", "NetworkError"]);
const routes = new Set(["home", "studio", "guest", "watch", "viewer", "output", "other"]);
export function safeBuild(value: unknown): string {
  return typeof value === "string" && /^(?:[0-9]+\.[0-9]+\.[0-9]+|rc[0-9]+)[A-Za-z0-9._-]{0,80}$/.test(value) ? value : "unknown";
}
function messageKind(value: unknown): string {
  if (typeof value !== "string") return "Message omitted";
  const message = value.slice(0, 1024);
  if (["Value is not a function", "Value is not defined", "Loading chunk failed"].includes(message)) return message;
  const react = message.match(/^Minified React error #(\d{1,4})\b/);
  if (react) return "Minified React error #" + react[1];
  for (const known of ["Cannot read properties of undefined", "Cannot read properties of null", "Maximum update depth exceeded", "Rendered more hooks than during the previous render", "Rendered fewer hooks than expected", "Invalid hook call", "Maximum call stack size exceeded", "Too much recursion", "ResizeObserver loop", "Failed to fetch dynamically imported module"]) {
    if (message.startsWith(known)) return known;
  }
  if (/^Loading chunk [A-Za-z0-9_-]{1,100} failed/.test(message)) return "Loading chunk failed";
  if (/^[A-Za-z_$][A-Za-z0-9_.$]{0,100} is not a function\b/.test(message)) return "Value is not a function";
  if (/^[A-Za-z_$][A-Za-z0-9_.$]{0,100} is not defined\b/.test(message)) return "Value is not defined";
  return "Message omitted";
}
function bundleFrames(value: unknown): string[] {
  if (typeof value !== "string") return [];
  const frames: string[] = [];
  // Do not strip queries and keep the remainder: reject query-bearing frames entirely.
  for (const line of value.slice(0, 12000).split("\n").slice(0, 40)) {
    const match = line.match(/(\/_next\/static\/[A-Za-z0-9_./-]{1,140}\.js:\d{1,7}:\d{1,7})(?=[)\s]|$)/);
    if (match && !frames.includes(match[1])) frames.push(match[1]);
    if (frames.length === 12) break;
  }
  return frames;
}
export function sanitizeClientError(value: unknown): ClientErrorReport {
  const get = (key: string) => errorField(value, key);
  const kind = get("kind"), at = get("at"), route = get("route"), name = get("name"), frames = get("frames");
  const suppliedFrames = Array.isArray(frames) ? frames.slice(0, 12).filter((frame): frame is string => typeof frame === "string").join("\n") : "";
  return {
    kind: kind === "rejection" || kind === "boundary" || kind === "global-boundary" ? kind : "error",
    at: typeof at === "number" && Number.isSafeInteger(at) && at > 0 ? at : Date.now(),
    route: typeof route === "string" && routes.has(route) ? route : "other",
    build: safeBuild(get("build")),
    name: typeof name === "string" && names.has(name) ? name : "Error",
    message: messageKind(get("message")),
    frames: bundleFrames(suppliedFrames || get("stack")),
  };
}
