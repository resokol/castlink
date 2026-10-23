// Exercise the actual token handler and guest name effect without a running LiveKit server.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const compile = source => {
  try {
    const ts = require("typescript");
    return ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  } catch (error) {
    if (error.code !== "MODULE_NOT_FOUND") throw error;
    // Also runnable in a dependency-free Node 22.13+ diagnostic workspace.
    return require("node:module").stripTypeScriptTypes(source, { mode: "transform" });
  }
};
const tokenPath = path.join(__dirname, "../app/api/token/route.ts");
const source = fs.readFileSync(tokenPath, "utf8").replace(/\r\n/g, "\n");
const record = { name: "Room", slotAssociationId: "room-association" };
let liveName = "Studio renamed", disconnected = false;
const claims = { sub: "guest-one", name: "Old JWT name", video: { room: "Room" }, metadata: JSON.stringify({ role: "guest", studioId: "studio-default" }) };
const sandbox = {
  process: { env: { LIVEKIT_API_KEY: "test-key", LIVEKIT_API_SECRET: "test-secret" } },
  Date, JSON, Object, Number, String, Array, Error,
  createHmac: () => ({ update: () => ({ digest: () => "principal" }) }), randomUUID: () => "new-identity",
  NextResponse: { json: (body, options = {}) => ({ status: options.status || 200, json: async () => body }) },
  requestId: () => "request", requestHeaders: () => ({}), serverLog: () => {},
  consumeRateLimit: () => ({ ok: true }), rateLimitHeaders: () => ({}),
  validateStudioId: value => value, defaultStudioId: () => "studio-default", mediaRoomName: (_studio, room) => room,
  readRooms: async () => [record], roomVersion: value => value,
  verifiedRoomStudioSession: () => null, isStudioOwner: async () => false,
  verifiedRoomAdminVersion: async () => null, verifiedRoomModeratorSession: async () => null, verifiedModeratorVersion: async () => null,
  canJoin: () => true, readAccess: () => null, guestEntryFromAccess: () => ({}), guestEntrySettings: value => value || {},
  sourceSessionMoved: async () => false, verifiedTransferAuthority: async () => null,
  rememberGuestSessionSettings: () => {}, readGuestSessionSettings: () => undefined, markGuestSessionDisconnected: () => {},
  loadPrivateTalkbackSessions: async () => {}, privateTalkbackForGuest: () => undefined,
  guestConnectionRoutes: () => ({ relay: { configured: false } }),
  TokenVerifier: class { async verify() { return claims; } },
  RoomServiceClient: class {
    async getParticipant() {
      if (disconnected) throw new Error("not found");
      return { sid: "SID-current", name: liveName, metadata: claims.metadata };
    }
  },
  AccessToken: class {
    constructor(_key, _secret, options) { this.options = options; }
    addGrant() {}
    async toJwt() { return JSON.stringify(this.options); }
  },
  importModule: async name => {
    if (name.endsWith("guest-admission-store")) return { managedGuestIdentity: async () => null };
    if (name.endsWith("slot-room-scope")) return { slotRoomAssociation: () => "room-association" };
    throw new Error("Unexpected dynamic import: " + name);
  },
};
const handler = compile(source.replace(/^import .*;\n/gm, "").replace("export async function GET", "async function GET").replace(/import\(/g, "importModule(")) + "\nthis.GET = GET;";
vm.runInNewContext(handler, sandbox, { filename: tokenPath });
const request = query => ({
  nextUrl: new URL("https://local.example/api/token?studioId=studio-default&room=Room&role=guest&identity=guest-one&" + query),
  headers: new Headers({ authorization: "Bearer signed-session" }),
});
async function issuedName(query) {
  const response = await sandbox.GET(request(query));
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.identity, "guest-one", "rename keeps authenticated identity");
  assert.equal(JSON.parse(data.token).name, data.name, "response and signed token agree");
  return data.name;
}
async function tokenNames() {
  assert.equal(await issuedName("name=New+entry+name&nameIntent=join"), "New entry name", "intentional same-identity rejoin accepts the new nickname");
  assert.equal(await issuedName("name=Stale+client+name"), "Studio renamed", "background renewal must not revert a studio rename even if it carries a stale name");
  assert.equal(await issuedName(""), "Studio renamed", "renewal reads the current LiveKit name");
  disconnected = true;
  assert.equal(await issuedName("name=New+offline+name&nameIntent=join"), "New offline name", "offline rejoin still uses the entered name");
  assert.equal(await issuedName(""), "Old JWT name", "offline credential renewal retains the signed fallback");
}
function localNames() {
  const workspace = fs.readFileSync(path.join(__dirname, "../components/GuestWorkspace.tsx"), "utf8");
  const start = workspace.indexOf("    const syncGuestName = ");
  assert.ok(start >= 0, "guest workspace subscribes to authoritative local participant names");
  const end = workspace.indexOf("\n  }, [room, identity]);", start);
  assert.ok(end > start);
  const effect = workspace.slice(start, end);
  const callbacks = new Map();
  let ownName = "", inputName = "";
  const room = {
    state: "connected", localParticipant: { identity: "guest-one", name: "Initial server name" },
    on(event, callback) { callbacks.set(event, callback); return this; },
    off(event, callback) { if (callbacks.get(event) === callback) callbacks.delete(event); return this; },
  };
  const cleanup = vm.runInNewContext(compile("(function() {\n" + effect + "\n})()"), {
    room, identity: "guest-one",
    RoomEvent: { ParticipantNameChanged: "name", Connected: "connected", Reconnected: "reconnected" },
    setConfirmedName: value => { ownName = value; }, setGuestName: value => { inputName = value; },
  });
  assert.equal(ownName, "Initial server name");
  room.localParticipant.name = "Studio renamed";
  callbacks.get("name")("Studio renamed", room.localParticipant);
  assert.equal(ownName, "Studio renamed", "studio rename immediately changes the caster heading");
  assert.equal(inputName, "Studio renamed", "saved entry name follows the accepted rename");
  callbacks.get("name")("Other guest", { identity: "guest-other", name: "Other guest" });
  assert.equal(ownName, "Studio renamed", "remote name events cannot rename this caster");
  room.localParticipant.name = "After reconnect";
  callbacks.get("reconnected")();
  assert.equal(ownName, "After reconnect");
  room.state = "disconnected";
  room.localParticipant.name = "Stale offline name";
  callbacks.get("name")("Stale offline name", room.localParticipant);
  assert.equal(ownName, "After reconnect", "offline events cannot replace the accepted display name");
  room.state = "connected";
  room.localParticipant.identity = "guest-replaced";
  callbacks.get("connected")();
  assert.equal(ownName, "After reconnect", "another local identity cannot rename this session");
  cleanup();
  assert.equal(callbacks.size, 0, "effect removes every listener");
}
(async () => {
  await tokenNames();
  localNames();
  const resume = fs.readFileSync(path.join(__dirname, "../lib/guest-resume.ts"), "utf8");
  const context = { URLSearchParams, DOMException };
  vm.runInNewContext(compile(resume.replace(/export /g, "")) + "\nthis.requestGuestSession = requestGuestSession;", context);
  const stored = new Map(), requests = [];
  const storage = { getItem: key => stored.get(key) || null, setItem: (key, value) => stored.set(key, value) };
  const fetcher = async (url, init) => { requests.push({ query: new URL(url, "https://local.example").searchParams, init }); return { ok: true, json: async () => ({ token: "signed-session", identity: "guest-one" }) }; };
  await context.requestGuestSession({ studioId: "studio-default", room: "Room", name: "Entered", storage, fetcher });
  await context.requestGuestSession({ studioId: "studio-default", room: "Room", name: "Changed on rejoin", storage, fetcher });
  assert.equal(requests[0].query.get("nameIntent"), "join", "fresh entry explicitly chooses the nickname");
  assert.equal(requests[1].query.get("nameIntent"), "join", "resumed entry also explicitly chooses the nickname");
  assert.equal(requests[1].query.get("name"), "Changed on rejoin");
  assert.equal(requests[1].query.get("identity"), "guest-one");
  assert.equal(requests[1].init.headers.authorization, "Bearer signed-session", "name changes preserve signed identity resume");
  console.log("PASS guest names: intentional rejoin, current-name renewal, signed fallback, local rename/reconnect and listener cleanup");
})().catch(error => { console.error(error); process.exitCode = 1; });
