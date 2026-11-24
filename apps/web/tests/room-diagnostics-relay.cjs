const assert = require("node:assert/strict");
const { load } = require("./load-typescript.cjs");
const { NextRequest, NextResponse } = require("next/server");

const requests = [];
const nodeId = "node-remote-diagnostics";
const mediaRoom = "s-tenant-room";
process.env.CASTLINK_NODE_ID = nodeId;
process.env.CASTLINK_NODE_SECRET = "test-diagnostics-node-secret-32-bytes";
const auth = load("../lib/node-request.ts");
const params = new URLSearchParams({ diagnostics: "full", room: mediaRoom, participant: "guest-é", role: "guest",
  minutes: "360", to: String(Date.now()), session: "selected-session" });
const sanitized = { sampleCount: 7, complete: true };
let author = "", platform = true, ownNode = "local", remoteBehavior = "normal", pulls = 0;
const rangeStart = String(Number(params.get("to")) - 8301);
const ndjson = new TextEncoder().encode(JSON.stringify({ type: "summary", ...sanitized }) + "\n");
const localRoomDiagnostics = async (p, signal, id) => {
  requests.push({ params: p, signal, id });
  const full = p.get("diagnostics") === "full";
  const headers = { "Content-Type": full ? "application/x-ndjson" : "application/json", "X-Castlink-Diagnostics": "castlink-room-diagnostics-v1",
    "X-Castlink-Node-Id": id, "Content-Disposition": 'attachment; filename="castlink-diagnostics-test.ndjson"', "Cache-Control": "no-store" };
  if (p.has("from")) headers["X-Castlink-Diagnostics-Range"] = p.get("from") + "-" + p.get("to");
  if (!full) return Response.json(sanitized, { headers });
  return new Response(new ReadableStream({ pull(controller) { pulls++; controller.enqueue(ndjson); controller.close(); } }, { highWaterMark: 0 }), { headers });
};
const localApi = load("../app/api/stats/route.ts", {
  "@/lib/room-diagnostics-export": { roomDiagnosticsResponse: (room, params, signal) => {
    assert.equal(room, mediaRoom); return localRoomDiagnostics(params, signal, "local");
  } },
  "@/lib/room-admin": { isRoomAdmin: async (_, room, studio) => author === "admin" && room === "room" && studio === "tenant" },
  "@/lib/room-studio-access": { canHostNamedRoom: async (_, room, studio) => author === "owner" && room === "room" && studio === "tenant" },
  "../../../lib/studio-scope": { validateStudioId: s => s, defaultStudioId: () => "tenant", mediaRoomName: () => mediaRoom },
});
const nodeApi = load("../app/v1/node/history/route.ts", {
  "../../../../lib/node-request": auth, "../../../../lib/node-history": { localRoomDiagnostics },
});
const platformApi = load("../app/api/super-admin/history/route.ts", {
  "../../../../lib/node-request": { ...auth, ownNodeId: () => ownNode },
  "../../../../lib/node-history": { localRoomDiagnostics },
  "../../../../lib/super-admin-access": { isSuperAdmin: async () => platform },
  "../../../../lib/control-plane-store": { listControlNodes: async () => [{ nodeId, endpoint: "https://saved-node.test" }] },
  "../../../../lib/rate-limit": { consumeRateLimit: () => ({ ok: true }) },
});
const originalFetch = global.fetch;
global.fetch = async (target, init) => {
  assert.equal(target.origin, "https://saved-node.test");
  assert.equal(target.pathname, "/v1/node/history");
  assert.equal(init.cache, "no-store"); assert.equal(init.redirect, "error");
  if (remoteBehavior === "old") return NextResponse.json({ nodeId, history: { connections: [], series: [] } });
  if (remoteBehavior === "busy") return new Response(null, { status: 429 });
  const response = await nodeApi.GET(new NextRequest(target, init));
  if (remoteBehavior === "mismatch") response.headers.set("X-Castlink-Node-Id", "other");
  if (remoteBehavior === "ignores-from") response.headers.delete("X-Castlink-Diagnostics-Range");
  if (remoteBehavior === "shifts-start") response.headers.set("X-Castlink-Diagnostics-Range", (Number(rangeStart) - 1) + "-" + params.get("to"));
  if (remoteBehavior === "shifts-end") response.headers.set("X-Castlink-Diagnostics-Range", rangeStart + "-" + (Number(params.get("to")) - 1));
  return response;
};
async function main() {
  const local = (mode, room = "room", studio = "tenant", extras = {}) => localApi.GET(new NextRequest(
    "https://app.test/api/stats?" + new URLSearchParams({ diagnostics: mode, room, studioId: studio, ...extras })));
  for (const mode of ["analysis", "full"]) {
    const range = { from: rangeStart, to: params.get("to"), session: params.get("session"), participant: params.get("participant"), role: params.get("role") };
    for (const denied of ["guest", "moderator", ""]) {
      author = denied; const deniedResponse = await local(mode);
      assert.equal(deniedResponse.status, 403); assert.equal(deniedResponse.headers.get("cache-control"), "no-store");
      assert.equal((await local(mode, "room", "tenant", range)).status, 403);
    }
    for (author of ["owner", "admin"]) {
      assert.equal((await local(mode, "other")).status, 403); assert.equal((await local(mode, "room", "other")).status, 403);
      const result = await local(mode); assert.equal(result.status, 200); await result.body.cancel();
      assert.equal((await local(mode, "other", "tenant", range)).status, 403);
      assert.equal((await local(mode, "room", "other", range)).status, 403);
      const scoped = await local(mode, "room", "tenant", range);
      assert.equal(scoped.status, 200); await scoped.body.cancel();
      for (const [key, value] of Object.entries(range)) assert.equal(requests.at(-1).params.get(key), value);
    }
  }
  assert.equal((await nodeApi.GET(new NextRequest("https://node.test/v1/node/history?" + params))).status, 401);
  const url = new URL("https://platform.test/api/super-admin/history?" + params);
  url.searchParams.set("nodeId", nodeId);
  const get = () => platformApi.GET(new NextRequest(url));
  const before = requests.length;
  platform = false; assert.equal((await get()).status, 403); assert.equal(requests.length, before);
  platform = true;
  let remote = await get();
  assert.equal(remote.status, 200); assert.equal(pulls, 0, "relay does not buffer upstream data");
  assert.equal(remote.headers.get("content-disposition"), 'attachment; filename="castlink-diagnostics-test.ndjson"');
  assert.equal(remote.headers.get("cache-control"), "no-store");
  assert.deepEqual(JSON.parse(await remote.text()), { type: "summary", ...sanitized });
  for (const [key, value] of params) assert.equal(requests.at(-1).params.get(key), value);
  assert.equal(requests.at(-1).id, nodeId);
  url.searchParams.set("diagnostics", "analysis"); remote = await get();
  assert.deepEqual(await remote.json(), sanitized);
  for (const mode of ["old", "mismatch", "busy"]) {
    remoteBehavior = mode; assert.equal((await get()).status, mode === "busy" ? 429 : 503);
  }
  url.searchParams.set("from", rangeStart);
  for (const mode of ["analysis", "full"]) {
    url.searchParams.set("diagnostics", mode);
    remoteBehavior = "normal";
    const scoped = await get();
    assert.equal(scoped.status, 200);
    assert.equal(scoped.headers.get("x-castlink-diagnostics-range"), rangeStart + "-" + params.get("to"));
    assert.equal(requests.at(-1).params.get("from"), rangeStart);
    for (const [key, value] of params) if (key !== "diagnostics") assert.equal(requests.at(-1).params.get(key), value);
    await scoped.body.cancel();
    const priorPulls = pulls;
    for (remoteBehavior of ["ignores-from", "shifts-start", "shifts-end"]) {
      const failed = await get();
      assert.equal(failed.status, 503, mode + "/" + remoteBehavior);
      assert.deepEqual(await failed.json(), { error: "node_history_unavailable" });
    }
    assert.equal(pulls, priorPulls, "wrong-range streams are cancelled before the first pull");
  }
  url.searchParams.set("diagnostics", "analysis");
  for (const localId of ["local", nodeId]) {
    ownNode = localId;
    const before = requests.length;
    for (const key of ["from", "to", "room", "nodeId", "participant"]) {
      const duplicate = new URL(url); duplicate.searchParams.append(key, duplicate.searchParams.get(key));
      assert.equal((await platformApi.GET(new NextRequest(duplicate))).status, 400, "duplicate " + key);
    }
    const mixed = new URL(url); mixed.searchParams.set("minute", "0");
    assert.equal((await platformApi.GET(new NextRequest(mixed))).status, 400);
    assert.equal(requests.length, before);
  }
  ownNode = nodeId; remoteBehavior = "old";
  const own = await get();
  assert.equal(own.status, 200, "own-node history uses the local reader");
  assert.equal(own.headers.get("x-castlink-diagnostics-range"), rangeStart + "-" + params.get("to"));
  console.log("PASS scoped owner/admin, guests/moderators denied, signed node authentication, streamed analysis/download relay, legacy/mismatched node handling");
}
main().finally(() => { global.fetch = originalFetch; }).catch(error => { console.error(error); process.exitCode = 1; });
