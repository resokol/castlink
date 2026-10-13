const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
require.extensions['.ts'] = (module, file) => module._compile(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, file);

const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'castlink-transfer-health-'));
const installationId = '11111111-2222-4333-8444-555555555555';
process.env.STUDIOLINK_DATA_DIR = directory;
process.env.STUDIOLINK_INSTALLATION_ID = installationId;
process.env.STUDIOLINK_TRANSFER_ORIGIN = 'https://castlink.example';
process.env.CASTLINK_SERVER_ID = 'vps';
process.env.STUDIOLINK_TRANSFER_SERVER_ID = 'node-primary';
const peer = require('../lib/transfer-peer.ts');
const transfer = require('../lib/server-transfer.ts');
const file = require.resolve('../app/api/server-transfer/route.ts');
const source = ts.createSourceFile(file, fs.readFileSync(file, 'utf8'), ts.ScriptTarget.Latest, true);
const handler = source.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === 'GET');
assert.ok(handler, 'exercise the actual transfer health handler');
const moduleContext = { exports: {} };
vm.runInNewContext(ts.transpileModule(handler.getText(source), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, {
  exports: moduleContext.exports, module: moduleContext,
  transferIdentity: peer.transferIdentity,
  transferHealthIdentity: peer.transferHealthIdentity,
  transferServer: transfer.transferServer,
  transferLiveKitReady: async () => true,
  transferNodeAdmissionReady: async () => true,
  json: (value, status = 200) => new Response(JSON.stringify(value), { status }),
});
const health = async () => (await moduleContext.exports.GET({ nextUrl: new URL('https://castlink.example/api/server-transfer?action=health') })).json();

(async () => {
  try {
    const legacy = await health();
    assert.equal(legacy.id, 'node-primary', 'existing legacy peers still recognize the advertised transfer server');
    assert.equal(legacy.installationId, installationId, 'profile peers retain the immutable installation UUID');
    assert.equal(legacy.liveKitReady, true);
    assert.equal(legacy.enabled, true);
    assert.equal((await peer.transferIdentity()).id, 'vps', 'profile identity remains independent of the legacy advertisement');
    assert.equal(process.env.CASTLINK_SERVER_ID, 'vps', 'control-plane configuration is untouched');

    delete process.env.STUDIOLINK_TRANSFER_SERVER_ID;
    assert.equal((await health()).id, 'vps', 'profile-only installations retain their identity');
    process.env.STUDIOLINK_TRANSFER_SERVER_ID = 'invalid@legacy';
    assert.equal((await health()).id, 'vps', 'invalid legacy IDs are not advertised');
    delete process.env.STUDIOLINK_INSTALLATION_ID;
    process.env.STUDIOLINK_TRANSFER_SERVER_ID = 'node-primary';
    assert.equal((await health()).id, 'node-primary', 'legacy-only installations remain supported');
    console.log('PASS: actual health handler preserves legacy server ID and immutable profile installation identity');
  } finally {
    fs.rmSync(directory, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
