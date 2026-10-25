const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'studiolink-transfer-test-'));
process.env.STUDIOLINK_TRANSFER_STATE_FILE = path.join(dir, 'transfer.json');
process.env.STUDIOLINK_TRANSFER_SECRET = 'local-test-transfer-secret-with-more-than-32-characters';
process.env.STUDIOLINK_TRANSFER_PEER_ORIGIN = 'https://peer.example';
process.env.STUDIOLINK_TRANSFER_SERVER_ID = 'local';
process.env.STUDIOLINK_TRANSFER_SERVER_LABEL = 'Local';
process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = JSON.stringify([{ id: 'vps', label: 'VPS', origin: 'https://vps.example' }]);
const transfer = require('../lib/server-transfer.ts');

(async () => {
  const ownerExpires = Date.now() + 3600_000;
  const ownerTicket = transfer.newTicket('studio', 'studio-default', 'room-a', undefined, undefined, ownerExpires);
  assert.equal(ownerTicket.ticket.ownerExpiresAt, ownerExpires);
  assert.ok(ownerTicket.ticket.exp <= Date.now() + 300_000);
  const soon = Date.now() + 30_000;
  assert.equal(transfer.newTicket('studio', 'studio-default', 'room-a', undefined, undefined, soon).ticket.exp, soon);
  assert.throws(() => transfer.newTicket('guest', 'studio-default', 'room-a', undefined, undefined, ownerExpires));
  assert.throws(() => transfer.newTicket('studio', 'studio-default', 'room-a', undefined, undefined, Date.now() - 1));
  const timestamp = String(Date.now()), nonce = '0123456789abcdef0123456789abcdef', body = '{"action":"prepare"}';
  const signature = transfer.signBridge(timestamp, nonce, body);
  assert.equal(transfer.verifyBridge(timestamp, nonce, body, signature), true);
  assert.equal(transfer.verifyBridge(timestamp, nonce, body + ' ', signature), false, 'body changes invalidate bridge signature');
  assert.equal(transfer.verifyBridge(String(Date.now() - 120_000), nonce, body, signature), false, 'stale bridge requests expire');
  assert.equal(transfer.peerOriginAllowed('https://peer.example'), true);
  assert.equal(transfer.peerOriginAllowed('https://attacker.example'), false);
  assert.equal(transfer.transferTargets()[0].origin, 'https://vps.example');

  const publicClientIp = '8.8.8.8';
  process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = JSON.stringify([{ id: 'vps', label: 'VPS', origin: 'https://vps.example', lanOrigin: 'https://192.168.1.68', lanPublicIps: [publicClientIp] }]);
  const lanTarget = transfer.transferTargets()[0];
  assert.equal(lanTarget.lanOrigin, 'https://192.168.1.68');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, publicClientIp), 'https://192.168.1.68', 'exact public client address selects configured LAN endpoint');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, `::ffff:${publicClientIp}`), 'https://192.168.1.68', 'IPv4-mapped client address normalizes to IPv4');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, '0:0:0:0:0:ffff:808:808'), 'https://192.168.1.68', 'expanded IPv4-mapped client address normalizes');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, '198.51.100.20, 203.0.113.10'), 'https://vps.example', 'rightmost external client keeps the canonical public endpoint');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, 'malformed spoof, 203.0.113.10'), 'https://vps.example', 'a spoofed left prefix cannot select the LAN endpoint');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, '192.168.1.68'), 'https://vps.example', 'an unrelated private client address never auto-selects LAN');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, undefined), 'https://vps.example', 'missing client address uses the public endpoint');
  assert.equal(transfer.resolveClientTargetUrl(lanTarget, '203.0.113.10, '), 'https://vps.example', 'ambiguous forwarding headers use the public endpoint');
  process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = JSON.stringify([{ id: 'vps', label: 'VPS', origin: 'https://vps.example', lanOrigin: 'https://203.0.113.10', lanPublicIps: [publicClientIp] }]);
  const invalidLanTarget = transfer.transferTargets()[0];
  assert.equal(invalidLanTarget.lanOrigin, undefined, 'public addresses are rejected as LAN origins');
  assert.equal(transfer.resolveClientTargetUrl(invalidLanTarget, publicClientIp), 'https://vps.example', 'invalid LAN config falls back to public');
  process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = JSON.stringify([{ id: 'vps', label: 'VPS', origin: 'https://vps.example', lanOrigin: 'https://192.168.1.68', lanPublicIps: ['192.168.1.68'] }]);
  const invalidClientListTarget = transfer.transferTargets()[0];
  assert.equal(invalidClientListTarget.lanPublicIps, undefined, 'private client IPs are rejected from the public IP allowlist');
  assert.equal(transfer.resolveClientTargetUrl(invalidClientListTarget, '192.168.1.68'), 'https://vps.example');
  process.env.STUDIOLINK_TRANSFER_TARGETS_JSON = JSON.stringify([{ id: 'vps', label: 'VPS', origin: 'https://vps.example' }]);

  const studio = transfer.newTicket('studio', 'studio-default', 'room-a');
  const guest = transfer.newTicket('guest', 'studio-default', 'room-a', 'guest-123', 'Guest');
  assert.notEqual(studio.token, guest.token);
  assert.equal(transfer.ticketHash(studio.token), studio.hash);
  assert.equal(guest.ticket.role, 'guest');
  assert.equal(guest.ticket.studioId, 'studio-default');
  assert.equal(guest.ticket.identity, 'guest-123');
  assert.equal(transfer.transferRoomKey('studio-default', 'room-a'), 'room-a', 'legacy default keeps its historic state key');
  assert.notEqual(transfer.transferRoomKey('studio-alpha', 'room-a'), transfer.transferRoomKey('studio-bravo', 'room-a'), 'same room name is isolated across Studios');
  assert.equal(guest.ticket.name, 'Guest');
  assert.ok(guest.ticket.exp > Date.now() && guest.ticket.exp <= Date.now() + 5 * 60_000);

  await transfer.updateTransferState(state => {
    state.tickets[studio.hash] = { ...studio.ticket, exp: Date.now() - 1 };
    state.tickets[guest.hash] = guest.ticket;
    state.active['room-a'] = { id: 'abc123abc123abc123abc123abc123ab', roomId: 'room-identity-12345678', targetUrl: 'https://vps.example', targetId: 'vps', exp: Date.now() - 1 };
  });
  const saved = JSON.parse(fs.readFileSync(process.env.STUDIOLINK_TRANSFER_STATE_FILE, 'utf8'));
  assert.equal(saved.tickets[studio.hash], undefined, 'expired tickets are removed');
  assert.ok(saved.tickets[guest.hash], 'live tickets remain available for one-use exchange');
  assert.equal(saved.active['room-a'], undefined, 'expired guest transfer commands are removed');
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('PASS: signed peer requests, origin allowlist, role-bound one-use ticket material, and transfer state expiry');
})().catch(error => { console.error(error); process.exitCode = 1; });
