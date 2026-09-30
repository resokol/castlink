const assert = require("node:assert/strict");
const fs = require("node:fs");
const http = require("node:http");
const ts = require("typescript");

require.extensions[".ts"] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const { verifyNodeControlRequest } = require("../lib/node-control-auth.ts");

const nodeId = "node-remote-test";
const secret = "remote-control-secret-abcdefghijklmnopqrstuvwxyz";
let requests = 0;

const server = http.createServer((req, res) => {
  requests++;
  const url = new URL(req.url, "http://127.0.0.1");
  const timestamp = req.headers["x-castlink-node-time"] || "";
  const signature = req.headers["x-castlink-node-signature"] || "";
  const headerNodeId = req.headers["x-castlink-node-id"] || "";
  const pathAndQuery = url.pathname + url.search;

  if (headerNodeId !== nodeId || !verifyNodeControlRequest(secret, String(timestamp), "GET", pathAndQuery, String(signature))) {
    res.writeHead(401, { "content-type": "application/json" });
    res.end(JSON.stringify({ error: "bad signature" }));
    return;
  }

  const studioId = url.searchParams.get("studioId");
  res.writeHead(200, { "content-type": "application/json" });
  res.end(JSON.stringify({
    studioId,
    ownerAccessVersion: "owner-version-remote",
    route: {
      ok: true,
      studioId,
      nodeId,
      nodeName: "Remote Test",
      region: "test",
      endpoint: "https://remote.example",
      broadcastState: "idle",
    },
  }));
});

(async () => {
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");

  const previous = {
    nodeEnv: process.env.NODE_ENV,
    url: process.env.CASTLINK_CONTROL_PLANE_URL,
    nodeId: process.env.CASTLINK_NODE_ID,
    secret: process.env.CASTLINK_NODE_SECRET,
  };
  process.env.NODE_ENV = "development";
  process.env.CASTLINK_CONTROL_PLANE_URL = `http://127.0.0.1:${address.port}`;
  process.env.CASTLINK_NODE_ID = nodeId;
  process.env.CASTLINK_NODE_SECRET = secret;

  try {
    delete require.cache[require.resolve("../lib/control-plane-client.ts")];
    const client = require("../lib/control-plane-client.ts");

    assert.equal(await client.currentStudioOwnerAccessVersion("studio-remote"), "owner-version-remote");
    const route = await client.currentStudioRoute("studio-remote");
    assert.equal(route.ok, true);
    assert.equal(route.nodeId, nodeId);
    assert.equal(route.endpoint, "https://remote.example");
    assert.equal(requests, 2);

    process.env.CASTLINK_NODE_SECRET = "";
    await assert.rejects(
      client.currentStudioRoute("studio-remote"),
      /configuration is incomplete/,
      "partially configured remote mode must not fall back to local DB",
    );

    console.log("PASS: remote node reads Studio owner/version route over signed HTTP without control-plane DB access");
  } finally {
    if (previous.nodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous.nodeEnv;
    if (previous.url === undefined) delete process.env.CASTLINK_CONTROL_PLANE_URL; else process.env.CASTLINK_CONTROL_PLANE_URL = previous.url;
    if (previous.nodeId === undefined) delete process.env.CASTLINK_NODE_ID; else process.env.CASTLINK_NODE_ID = previous.nodeId;
    if (previous.secret === undefined) delete process.env.CASTLINK_NODE_SECRET; else process.env.CASTLINK_NODE_SECRET = previous.secret;
    await new Promise(resolve => server.close(resolve));
  }
})().catch(error => {
  console.error(error);
  server.close();
  process.exitCode = 1;
});
