'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { normalizeSrt, srtEndpoint, vMixInput } = require('../src/vmix-output-config.cjs');

const slots = [{ id: 'camera-1', port: 9001 }, { id: 'camera-2', port: 9002 }];

test('a local CastLink listener gives vMix a matching caller endpoint per slot', () => {
  const config = normalizeSrt({ mode: 'listener', address: '127.0.0.1', latencyMs: 200, slots });
  assert.equal(srtEndpoint(config, slots[0].id), 'srt://127.0.0.1:9001?mode=listener&latency=200000');
  assert.deepEqual(vMixInput(config, slots[1].id), {
    mode: 'caller', address: '127.0.0.1', port: 9002, latencyMs: 200, encrypted: false, keyLength: null, streamId: '',
  });
});

test('caller settings use IPv6, convert milliseconds and protect SRT option delimiters', () => {
  const password = 'test@value&not-an-option';
  const config = normalizeSrt({ mode: 'caller', address: '::1', latencyMs: 320, passphrase: password, keyLength: 32,
    slots: [{ ...slots[0], streamId: '#!::r=slot/1,m=publish' }] });
  const url = new URL(srtEndpoint(config, slots[0].id));
  assert.equal(url.hostname, '[::1]');
  assert.equal(url.searchParams.get('passphrase'), password);
  assert.equal(url.searchParams.get('streamid'), '#!::r=slot/1,m=publish');
  assert.equal(url.searchParams.get('pbkeylen'), '32');
  assert.equal(url.searchParams.get('latency'), '320000');
  const input = vMixInput(config, slots[0].id);
  assert.equal(input.mode, 'listener');
  assert.equal(input.address, null);
  assert.equal(input.encrypted, true);
  assert.equal(JSON.stringify(input).includes(password), false);
});

test('rendezvous makes vMix use the same port and mode', () => {
  const config = normalizeSrt({ mode: 'rendezvous', address: 'studio.example.test', latencyMs: 200, slots });
  assert.match(srtEndpoint(config, slots[0].id), /mode=rendezvous/);
  assert.deepEqual(vMixInput(config, slots[0].id), {
    mode: 'rendezvous', address: null, port: 9001, latencyMs: 200, encrypted: false, keyLength: null, streamId: '',
  });
});

test('validation rejects duplicate ports, malformed hosts and unsafe secret data', () => {
  const good = { mode: 'listener', address: '127.0.0.1', latencyMs: 200, slots };
  assert.throws(() => normalizeSrt({ ...good, slots: [slots[0], { ...slots[1], port: 9001 }] }), { code: 'SRT_DUPLICATE_PORT' });
  assert.throws(() => normalizeSrt({ ...good, address: '127.0.0.1?mode=caller' }), { code: 'SRT_ADDRESS' });
  assert.throws(() => normalizeSrt({ ...good, passphrase: 'test\npassword' }), { code: 'SRT_PASSPHRASE' });
  assert.throws(() => normalizeSrt({ ...good, latencyMs: -1 }), { code: 'SRT_LATENCY' });
  assert.throws(() => normalizeSrt({ ...good, slots: [{ ...slots[0], port: 65536 }] }), { code: 'SRT_PORT' });
});
