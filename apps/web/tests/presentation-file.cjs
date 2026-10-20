const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { load } = require('./load-typescript.cjs');
const { NextRequest } = require('next/server');

const input = Buffer.from('PK\x03\x04ordinary PPTX with SVG, fonts, charts and links');
const pdf = Buffer.from('%PDF-1.7\nconverted');
const upload = (body = input, name = 'slides.pptx') => {
  const form = new FormData(); form.append('file', new Blob([body]), name);
  return new Request('http://localhost', { method: 'POST', body: form });
};
let mode = 'ok', calls = 0, captured;
const client = load('../lib/presentation-file.ts', {
  'node:http': { request(options, callback) {
    calls++; captured = { options };
    const request = new EventEmitter();
    request.destroy = error => { if (error) queueMicrotask(() => request.emit('error', error)); return request; };
    request.end = body => {
      captured.body = body;
      queueMicrotask(() => {
        if (mode === 'absent') return request.emit('error', Object.assign(new Error('ENOENT'), { code: 'ENOENT' }));
        if (mode === 'hang') return;
        const response = new EventEmitter();
        response.destroy = () => {};
        response.statusCode = mode === 'busy' ? 429 : mode === 'invalid' ? 422 : 200;
        response.headers = { 'content-type': mode === 'html' ? 'text/html' : response.statusCode === 200 ? 'application/pdf' : 'application/json' };
        const body = mode === 'busy' ? Buffer.from('{"code":"presentation-converter-busy"}') : mode === 'invalid' ? Buffer.from('{"code":"presentation-encrypted"}') : mode === 'fake' ? Buffer.from('not a PDF') : pdf;
        response.headers['content-length'] = mode === 'large' ? String(100 * 1024 * 1024 + 1) : String(body.length);
        callback(response);
        response.emit('data', body);
        response.emit('end');
      });
    };
    return request;
  } },
  'node:child_process': { spawn() { throw new Error('web must never spawn LibreOffice'); } },
});
async function expectStatus(operation, status, code) {
  await assert.rejects(operation, error => error.status === status && (!code || error.code === code));
}

(async () => {
  assert.deepEqual(await client.convertPresentationFile(upload()), pdf);
  assert.deepEqual(captured.body, input, 'whole ordinary PPTX reaches isolated converter unchanged');
  assert.equal(captured.options.socketPath, '/run/castlink-converter/converter.sock');
  assert.equal(captured.options.path, '/convert');
  assert.equal(captured.options.method, 'POST');
  assert.equal(captured.options.headers['Content-Length'], input.length);

  for (const [failure, status, code] of [
    ['absent', 503, 'presentation-converter-unavailable'],
    ['busy', 429, 'presentation-converter-busy'],
    ['invalid', 422, 'presentation-encrypted'],
    ['html', 502], ['fake', 502], ['large', 502],
  ]) {
    mode = failure;
    await expectStatus(client.convertPresentationFile(upload()), status, code);
  }
  const realTimer = global.setTimeout;
  global.setTimeout = (fn, ms, ...args) => realTimer(fn, ms === 45000 ? 5 : ms, ...args);
  mode = 'hang';
  try { await expectStatus(client.convertPresentationFile(upload()), 504, 'presentation-conversion-timeout'); }
  finally { global.setTimeout = realTimer; }
  mode = 'ok';
  assert.deepEqual(await client.convertPresentationFile(upload()), pdf, 'timeout releases concurrency lock');

  const before = calls;
  await expectStatus(client.convertPresentationFile(upload(input, 'slides.pdf')), 400);
  await expectStatus(client.convertPresentationFile(new Request('http://localhost', { method: 'POST', body: 'x', headers: { 'content-length': String(client.MAX_PRESENTATION_UPLOAD + 65537) } })), 413);
  assert.equal(calls, before, 'bad multipart/size is refused before worker');

  let unblock;
  const pendingBody = new ReadableStream({ start(controller) { unblock = () => controller.close(); } });
  const pending = client.convertPresentationFile(new Request('http://localhost', { method: 'POST', body: pendingBody, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=a' } }));
  await expectStatus(client.convertPresentationFile(upload()), 429);
  unblock(); await expectStatus(pending, 400);
  let cancelled = false;
  const oversized = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
  await expectStatus(client.convertPresentationFile(new Request('http://localhost', { method: 'POST', body: oversized, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=a' } })), 413);
  assert.equal(cancelled, true);

  let authorized = false, conversions = 0, scope;
  const api = load('../app/api/presentation-file/route.ts', {
    '@/lib/co-presentation-access': { presentationGuest: async (_request, studioId, room) => { scope = { studioId, room }; return authorized ? { identity: 'guest-one', sid: 'PA_one', association: 'assoc' } : null; } },
    '@/lib/presentation-file': { PresentationFileError: client.PresentationFileError, convertPresentationFile: async request => { conversions++; assert.equal(request.bodyUsed, false); return pdf; } },
  });
  const req = () => new NextRequest('http://localhost/api/presentation-file?studioId=studio-two&room=Room2', { method: 'POST', body: 'never parse before auth' });
  const denied = req(); assert.equal((await api.POST(denied)).status, 403); assert.equal(denied.bodyUsed, false); assert.equal(conversions, 0);
  assert.deepEqual(scope, { studioId: 'studio-two', room: 'Room2' });
  authorized = true;
  const response = await api.POST(req());
  assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf');
  assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(conversions, 1);
  console.log('PASS: bounded guest upload, byte-only isolated converter, service errors, output validation, timeout and admission before body');
})().catch(error => { console.error(error); process.exitCode = 1; });
