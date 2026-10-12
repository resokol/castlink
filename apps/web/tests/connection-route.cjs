const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');
Module._extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText, filename);
const { ConnectionError } = require('livekit-client');
const { connectGuestRoom, GuestRelayUnavailableError } = require('../lib/connection-route.ts');
const { guestConnectionRoutes } = require('../lib/connection-route-config.ts');
function room(...failures) {
  return { calls: [], disconnected: 0,
    async connect(url, token, options) { this.calls.push({url, token, options}); const failure = failures.shift(); if (failure) throw failure; },
    async disconnect() { this.disconnected++; },
  };
}
const relay = { configured: true, transport: 'tls443' };
(async () => {
  const normal = room();
  assert.equal(await connectGuestRoom(normal, 'wss://site.example', 'guest-token', { route: 'auto', relay }), 'normal');
  assert.equal(normal.calls.length, 1);
  assert.equal(normal.calls[0].options.autoSubscribe, false);
  const status = [], retry = room(ConnectionError.timeout('could not establish pc connection'));
  const options = {autoSubscribe:false, maxRetries:0, rtcConfig:{bundlePolicy:'max-bundle'}};
  assert.equal(await connectGuestRoom(retry, 'wss://site.example', 'same-guest-token', {route:'auto', relay, options, onAttempt: route => status.push(route)}), 'relay');
  assert.deepEqual(status, ['normal', 'relay']);
  assert.equal(retry.disconnected, 1);
  assert.equal(retry.calls[1].token, retry.calls[0].token, 'retry preserves authenticated identity');
  assert.deepEqual(retry.calls[1].options, {...options, rtcConfig:{bundlePolicy:'max-bundle', iceTransportPolicy:'relay'}});
  assert.equal(retry.calls[1].options.rtcConfig.iceServers, undefined, 'LiveKit supplies per-participant authenticated TURN credentials');
  assert.equal(options.rtcConfig.iceTransportPolicy, undefined, 'caller options remain unchanged');
  const iceFailure = room(ConnectionError.internal('could not establish PC connection, ICE failed'));
  assert.equal(await connectGuestRoom(iceFailure,'wss://site.example','token',{route:'auto',relay}), 'relay');
  for (const failure of [ConnectionError.notAllowed('denied',403), ConnectionError.cancelled('cancelled'), ConnectionError.leaveRequest('removed',4), ConnectionError.websocket('signalling failed'), ConnectionError.timeout('room connection has timed out (signal)'), new Error('device failure')]) {
    const denied = room(failure);
    await assert.rejects(connectGuestRoom(denied,'wss://site.example','token',{route:'auto',relay}), error => error === failure);
    assert.equal(denied.calls.length,1,'auth, cancellation, signalling and arbitrary errors do not trigger relay');
  }
  const unavailable = room();
  await assert.rejects(connectGuestRoom(unavailable,'wss://site.example','token',{route:'relay',relay:{configured:false}}), GuestRelayUnavailableError);
  assert.equal(unavailable.calls.length,0,'explicit unavailable relay fails before connection');
  const unavailableAuto = room(ConnectionError.timeout('pc timeout'));
  await assert.rejects(connectGuestRoom(unavailableAuto,'wss://site.example','token',{route:'auto',relay:{configured:false}}), GuestRelayUnavailableError);
  assert.equal(unavailableAuto.calls.length,1);
  let active = true;
  const cancelled = room(ConnectionError.timeout('pc timeout'));
  cancelled.disconnect = async () => { active = false; };
  await assert.rejects(connectGuestRoom(cancelled,'wss://site.example','token',{route:'auto',relay,isActive:()=>active}), error=>error.reasonName==='Cancelled');
  assert.equal(cancelled.calls.length,1,'cleanup during fallback never starts another join');
  const forced = room();
  assert.equal(await connectGuestRoom(forced,'wss://site.example','token',{route:'relay',relay}), 'relay');
  assert.equal(forced.calls[0].options.rtcConfig.iceTransportPolicy,'relay');
  assert.deepEqual(guestConnectionRoutes({}), {relay:{configured:false}});
  assert.deepEqual(guestConnectionRoutes({CASTLINK_GUEST_RELAY_ENABLED:'1',CASTLINK_TURN_TRANSPORT:'udp'}), {relay:{configured:true,transport:'udp'}});
  assert.deepEqual(guestConnectionRoutes({CASTLINK_GUEST_RELAY_ENABLED:'1',CASTLINK_TURN_TRANSPORT:'tls443'}), {relay:{configured:true,transport:'tls443'}});
  assert.deepEqual(guestConnectionRoutes({CASTLINK_GUEST_RELAY_ENABLED:'1',CASTLINK_TURN_TRANSPORT:'unknown'}), {relay:{configured:false}});
  console.log('PASS: guest-only normal/relay routes, credential/options preservation, unavailable status, authorization and cancellation boundaries');
})().catch(error => { console.error(error); process.exitCode=1; });
