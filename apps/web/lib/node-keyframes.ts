// The LiveKit 1.13.11 counter has only direction, node_id and node_type labels.
// Keep process/node identity in memory to detect restarts. Persist only safe interval counts.
export type NodeKeyframes = { from: number; at: number; incoming: number | null; outgoing: number | null };
type Scrape = {
  at: number; node: string; processStart: number; incoming: number | null; outgoing: number | null;
};

export function parseKeyframeCounters(body: string, at: number): Scrape | null {
  let node = "", processStart = NaN, incoming: number | null = null, outgoing: number | null = null;
  for (const line of body.split("\n")) {
    if (line.startsWith("process_start_time_seconds ")) processStart = Number(line.trim().split(/\s+/)[1]);
    if (!line.startsWith("livekit_keyframe_total{")) continue;
    const match = /^livekit_keyframe_total\{([^}]+)\}\s+([0-9.eE+-]+)\s*$/.exec(line);
    if (!match) return null;
    const labels = Object.create(null) as Record<string, string>;
    for (const pair of match[1].split(",")) {
      const entry = /^(direction|node_id|node_type)="([a-zA-Z0-9_-]{1,128})"$/.exec(pair.trim());
      if (!entry || entry[1] in labels) return null;
      labels[entry[1]] = entry[2];
    }
    const id = JSON.stringify([labels.node_id, labels.node_type]);
    const value = Number(match[2]);
    if (!labels.node_id || !labels.node_type || (node && node !== id) || !Number.isSafeInteger(value) || value < 0) return null;
    node = id;
    if (labels.direction === "incoming" && incoming === null) incoming = value;
    else if (labels.direction === "outgoing" && outgoing === null) outgoing = value;
    else return null;
  }
  return node && Number.isFinite(processStart) && processStart > 0 ? { at, node, processStart, incoming, outgoing } : null;
}

export function keyframeInterval(before: Scrape | null, after: Scrape | null): NodeKeyframes | undefined {
  if (!before || !after || before.node !== after.node || before.processStart !== after.processStart ||
      after.at <= before.at || after.at - before.at > 30_000) return;
  const delta = (direction: "incoming" | "outgoing") => {
    const a = before[direction], b = after[direction];
    return a !== null && b !== null && b >= a ? b - a : null;
  };
  const incoming = delta("incoming"), outgoing = delta("outgoing");
  if (incoming !== null || outgoing !== null) return { from: before.at, at: after.at, incoming, outgoing };
}

export function safeKeyframeInterval(raw: unknown): NodeKeyframes | undefined {
  if (!raw || typeof raw !== "object") return;
  const row = raw as NodeKeyframes;
  if (!Number.isSafeInteger(row.at) || !Number.isSafeInteger(row.from) || row.from < 0 || row.at <= row.from ||
      row.at - row.from > 30_000 || row.incoming === null && row.outgoing === null ||
      ![row.incoming, row.outgoing].every(v => v === null || Number.isSafeInteger(v) && v >= 0)) return;
  return { from: row.from, at: row.at, incoming: row.incoming, outgoing: row.outgoing };
}

const maxBytes = 512 * 1024;
let previous: Scrape | null = null;
export async function collectNodeKeyframes(at: number): Promise<NodeKeyframes | undefined> {
  // Only the process environment supplies this private target. Never forward cookies, labels or response text.
  const target = process.env.CASTLINK_LIVEKIT_METRICS_URL;
  if (!target) { previous = null; return; }
  const stop = new AbortController();
  const timeout = setTimeout(() => stop.abort(), 1200);
  try {
    const url = new URL(target);
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash) throw Error();
    const response = await fetch(url, { cache: "no-store", redirect: "error", signal: stop.signal,
      headers: { accept: "text/plain; version=0.0.4" } });
    if (!response.ok || !response.body || Number(response.headers.get("content-length")) > maxBytes) throw Error();
    const decoder = new TextDecoder();
    const reader = response.body.getReader();
    let bytes = 0, body = "";
    for (;;) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) throw Error();
      body += decoder.decode(chunk.value, { stream: true });
    }
    const next = parseKeyframeCounters(body + decoder.decode(), at);
    const interval = keyframeInterval(previous, next);
    previous = next;
    return interval;
  } catch { previous = null; }
  finally { clearTimeout(timeout); stop.abort(); }
}
