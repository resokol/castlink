'use strict';

const { isIP } = require('node:net');
const { domainToASCII } = require('node:url');

const modes = new Map([['listener', 'caller'], ['caller', 'listener'], ['rendezvous', 'rendezvous']]);
const unsafeText = /[\u0000-\u001f\u007f]/u;

function invalid(code) {
  throw Object.assign(new Error(code), { code });
}

function normalizeAddress(input, mode) {
  if (typeof input !== 'string' || input.length > 255 || unsafeText.test(input)) invalid('SRT_ADDRESS');
  let address = input.trim();
  if (address.startsWith('[') && address.endsWith(']')) address = address.slice(1, -1);
  if (isIP(address)) {
    if (mode !== 'listener' && (address === '0.0.0.0' || address === '::')) invalid('SRT_ADDRESS');
    return address;
  }
  const hostname = domainToASCII(address).toLowerCase();
  if (!hostname || /[\s/?#@%:\\]/u.test(address) || hostname.length > 253 ||
      !hostname.replace(/\.$/, '').split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/u.test(label))) invalid('SRT_ADDRESS');
  return hostname;
}

function normalizeSrt(input) {
  const { mode, latencyMs = 200, address = '127.0.0.1', passphrase = '', keyLength = 32, slots } = input || {};
  if (!modes.has(mode)) invalid('SRT_MODE');
  const host = normalizeAddress(address, mode);
  const localAddress = mode === 'rendezvous' ? normalizeAddress(input.localAddress || (isIP(host) === 6 ? '::' : '0.0.0.0'), 'listener') : undefined;
  if (localAddress && (!isIP(localAddress) || isIP(host) && isIP(host) !== isIP(localAddress))) invalid('SRT_ADDRESS');
  if (!Number.isInteger(latencyMs) || latencyMs < 0 || latencyMs > 60_000) invalid('SRT_LATENCY');
  if (typeof passphrase !== 'string' || unsafeText.test(passphrase) ||
      (passphrase && (Buffer.byteLength(passphrase) < 10 || Buffer.byteLength(passphrase) > 79))) invalid('SRT_PASSPHRASE');
  if (![16, 24, 32].includes(keyLength)) invalid('SRT_KEY_LENGTH');
  if (!Array.isArray(slots) || !slots.length || slots.length > 4) invalid('SRT_SLOTS');
  const ids = new Set();
  const ports = new Set();
  const outputs = slots.map(slot => {
    const { id, port, streamId = '' } = slot || {};
    if (typeof id !== 'string' || !/^[A-Za-z0-9_-]{1,100}$/u.test(id) || ids.has(id)) invalid('SRT_SLOT');
    if (!Number.isInteger(port) || port < 1 || port > 65535) invalid('SRT_PORT');
    if (ports.has(port)) invalid('SRT_DUPLICATE_PORT');
    if (typeof streamId !== 'string' || unsafeText.test(streamId) || Buffer.byteLength(streamId) > 512) invalid('SRT_STREAM_ID');
    ids.add(id);
    ports.add(port);
    return { id, port, streamId };
  });
  return { mode, address: host, ...(localAddress && { localAddress }), latencyMs, passphrase, keyLength, slots: outputs };
}

function findSlot(config, id) {
  const slot = config.slots.find(candidate => candidate.id === id);
  if (!slot) invalid('SRT_SLOT');
  return slot;
}

function srtEndpoint(config, id, includeCredentials = true) {
  const slot = findSlot(config, id);
  const parameters = new URLSearchParams({ mode: config.mode, latency: String(config.latencyMs * 1000) });
  if (includeCredentials && config.passphrase) {
    parameters.set('passphrase', config.passphrase);
    parameters.set('pbkeylen', String(config.keyLength));
  }
  if (includeCredentials && slot.streamId && config.mode !== 'listener') parameters.set('streamid', slot.streamId);
  const host = isIP(config.address) === 6 ? `[${config.address}]` : config.address;
  return `srt://${host}:${slot.port}?${parameters}`;
}

function vMixInput(config, id) {
  const { port, streamId } = findSlot(config, id);
  const useAddress = config.mode === 'listener' && !['0.0.0.0', '::'].includes(config.address);
  return {
    mode: modes.get(config.mode),
    address: useAddress ? config.address : config.mode === 'rendezvous' && !['0.0.0.0', '::'].includes(config.localAddress) ? config.localAddress : null,
    port,
    latencyMs: config.latencyMs,
    encrypted: Boolean(config.passphrase),
    keyLength: config.passphrase ? config.keyLength : null,
    streamId: config.mode === 'caller' ? '' : streamId,
  };
}

function rendezvousEndpoint(config, id) {
  const { port, streamId } = findSlot(config, id);
  const ipv6 = isIP(config.localAddress) === 6;
  const host = isIP(config.address) === 6 ? '[' + config.address + ']' : config.address;
  const parameters = new URLSearchParams({ mode: 'rendezvous', adapter: config.localAddress, port: String(port), latency: String(config.latencyMs) });
  if (ipv6) parameters.set('ipv6only', '1');
  if (config.passphrase) {
    parameters.set('passphrase', config.passphrase);
    parameters.set('pbkeylen', String(config.keyLength));
  }
  if (streamId) parameters.set('streamid', streamId);
  return 'srt://' + host + ':' + port + '?' + parameters.toString().replace(/\+/g, '%20');
}

module.exports = { normalizeSrt, srtEndpoint, rendezvousEndpoint, vMixInput };
