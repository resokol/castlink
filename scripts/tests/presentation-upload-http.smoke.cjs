// Run: node THIS_FILE --docker IMAGE ABSOLUTE_PPTX_PATH [EXPECTED_PAGES]
// Personal input is mounted read-only at a fixed generic name, never copied into an image.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { createHmac, createHash, randomUUID } = require('node:crypto');
const { spawn, spawnSync } = require('node:child_process');
const { Readable } = require('node:stream');
const identity = 'guest-runtime-fixture';
const metadata = { role: 'guest', studioId: 'studio-default', roomDisplayName: 'demo-room', roomChatAssociation: JSON.stringify(['demo-room', 'legacy']), transferSessionId: 'isolated-session' };
const sha256 = input => createHash('sha256').update(input).digest('hex');
if (process.argv[2] === '--docker') {
  (async () => {
    const image = process.argv[3], input = path.resolve(process.argv[4]);
    const expectedPages = process.argv[5];
    assert.ok(image && fs.statSync(input).isFile());
    assert.ok(expectedPages === undefined || (/^[1-9][0-9]*$/.test(expectedPages) && Number.isSafeInteger(Number(expectedPages))), 'Expected pages must be a positive integer');
    const docker = args => {
      const result = spawnSync('docker', args, { encoding: 'utf8', timeout: 30_000 });
      assert.equal(result.status, 0, result.error?.message || result.stderr || 'Disposable Docker operation failed');
      return result.stdout.trim();
    };
    // Bind all containers to one immutable local image even if the supplied tag changes.
    const pinnedImage = docker(['image', 'inspect', image, '--format', '{{.Id}}']);
    assert.match(pinnedImage, /^sha256:[a-f0-9]{64}$/);
    const scope = 'castlink-upload-http-' + randomUUID();
    const worker = scope + '-converter', app = scope + '-app', volume = scope + '-socket';
    try {
      docker(['volume', 'create', volume]);
      docker(['run', '-d', '--pull', 'never', '--name', worker, '--init', '--network', 'none',
        '--user', '10001:10001', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true',
        '--tmpfs', '/tmp:size=512m,mode=1777', '--memory', '512m', '--pids-limit', '128', '--cpus', '1',
        '--mount', `type=volume,source=${volume},target=/run/castlink-converter`,
        pinnedImage, 'python3', '/app/scripts/presentation-converter/server.py']);
      let ready = false;
      for (let attempt = 0; attempt < 20; attempt++) {
        const probe = spawnSync('docker', ['exec', worker, 'python3', '-c', "import os,stat;assert stat.S_ISSOCK(os.stat('/run/castlink-converter/converter.sock').st_mode)"], { stdio: 'ignore', timeout: 10_000 });
        if (probe.status === 0) { ready = true; break; }
        await new Promise(resolve => setTimeout(resolve, 250));
      }
      assert.ok(ready, 'Isolated converter must create its Unix socket');
      console.log(JSON.stringify({ dockerImage: pinnedImage, isolatedConverter: true, expectedPages: expectedPages === undefined ? null : Number(expectedPages) }));
      const result = spawnSync('docker', ['run', '--rm', '--pull', 'never', '--name', app, '--network', 'none',
        '-e', 'CASTLINK_ISOLATED_UPLOAD_PROOF=1', ...(expectedPages === undefined ? [] : ['-e', 'CASTLINK_PROOF_EXPECTED_PAGES=' + expectedPages]),
        '--entrypoint', 'node', '--mount', `type=bind,source=${__filename},target=/qa/runtime-proof.cjs,readonly`,
        '--mount', `type=bind,source=${input},target=/input/presentation.pptx,readonly`,
        '--mount', `type=volume,source=${volume},target=/run/castlink-converter,readonly`, pinnedImage, '/qa/runtime-proof.cjs'],
        { stdio: 'inherit', timeout: 180_000 });
      if (result.error) throw result.error;
      process.exitCode = result.status ?? 1;
    } finally {
      // Delete only resources carrying this invocation's unpredictable names.
      for (const name of [app, worker]) spawnSync('docker', ['rm', '-f', name], { stdio: 'ignore', timeout: 10_000 });
      spawnSync('docker', ['volume', 'rm', volume], { stdio: 'ignore', timeout: 10_000 });
    }
  })().catch(error => { console.error(error); process.exitCode = 1; });
} else if (process.env.BACKEND_PPTX_PROOF_PRELOAD === '1') {
  const originalFetch = global.fetch;
  global.fetch = async (url, options) => {
    if (String(url).includes('/twirp/livekit.RoomService/GetParticipant')) {
      return new Response(JSON.stringify({ identity, sid: 'PA_fixture', metadata: JSON.stringify(metadata), permission: { canPublish: true } }), { headers: { 'content-type': 'application/json' } });
    }
    return originalFetch(url, options);
  };
} else (async () => {
  assert.equal(process.env.CASTLINK_ISOLATED_UPLOAD_PROOF, '1', 'Run only with --docker in a disposable container');
  let markerOwned = false;
  const base = 'http://127.0.0.1:43931', endpoint = base + '/api/presentation-file?room=demo-room&studioId=studio-default';
  const env = { ...process.env, BACKEND_PPTX_PROOF_PRELOAD: '1', NODE_ENV: 'production', HOSTNAME: '127.0.0.1', PORT: '43931', LIVEKIT_API_KEY: 'runtime-fixture-key', LIVEKIT_API_SECRET: 'runtime-fixture-secret-only', STUDIOLINK_DATA_DIR: '/tmp/runtime-proof-data', CASTLINK_STORAGE_BACKEND: 'json' };
  fs.mkdirSync(env.STUDIOLINK_DATA_DIR, { recursive: true });
  const child = spawn(process.execPath, ['--require', __filename, '/app/apps/web/server.js'], { env, stdio: ['ignore', 'inherit', 'inherit'] });
  const marker = '/data/.castlink-update-maintenance';
  try {
    let ready = false;
    for (let i = 0; i < 80; i++) { try { if ((await fetch(base + '/api/version')).ok) { ready = true; break; } } catch {} await new Promise(resolve => setTimeout(resolve, 250)); }
    assert.ok(ready, 'runtime must start');
    const claims = { iss: env.LIVEKIT_API_KEY, sub: identity, nbf: Math.floor(Date.now() / 1000) - 5, exp: Math.floor(Date.now() / 1000) + 300, metadata: JSON.stringify(metadata), video: { roomJoin: true, room: 'demo-room', canPublish: true } };
    const unsigned = [Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'), Buffer.from(JSON.stringify(claims)).toString('base64url')].join('.');
    const token = unsigned + '.' + createHmac('sha256', env.LIVEKIT_API_SECRET).update(unsigned).digest('base64url');
    const input = fs.readFileSync(process.argv[2] || '/input/presentation.pptx');
    console.log(JSON.stringify({ imageVersion: await (await fetch(base + '/api/version')).json(), inputBytes: input.length, inputSha256: sha256(input), productionAccess: false, syntheticLiveKit: true }));
    const form = data => { const result = new FormData(); result.set('file', new Blob([data], { type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' }), 'slides.pptx'); return result; };
    async function send(name, options = {}) {
      const headers = new Headers({ origin: base, ...(options.auth === false ? {} : { authorization: 'Bearer ' + token }), ...options.headers });
      let body = form(options.input || input);
      if (options.mode === 'buffered' || options.mode === 'delayed') {
        const encoded = new Request(endpoint, { method: 'POST', body });
        const raw = Buffer.from(await encoded.arrayBuffer());
        headers.set('content-type', encoded.headers.get('content-type')); headers.set('content-length', String(raw.length));
        if (options.mode === 'buffered') body = raw;
        else {
          const start = raw.indexOf((options.input || input).subarray(0, 16));
          body = Readable.from((async function* () { yield raw.subarray(0, start); await new Promise(resolve => setTimeout(resolve, 100)); for (let offset = start; offset < raw.length; offset += 65536) yield raw.subarray(offset, offset + 65536); })());
        }
      }
      const response = await fetch(options.url || endpoint, { method: 'POST', headers, body, duplex: 'half', redirect: 'manual' });
      const output = Buffer.from(await response.arrayBuffer());
      const record = { name, status: response.status, type: response.headers.get('content-type'), bytes: output.length };
      if (response.status === 200) {
        assert.equal(output.subarray(0, 5).toString(), '%PDF-');
        record.pdfPageObjects = (output.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length;
        assert.ok(record.pdfPageObjects > 0, 'converter produces PDF page objects');
        if (process.env.CASTLINK_PROOF_EXPECTED_PAGES) assert.equal(record.pdfPageObjects, Number(process.env.CASTLINK_PROOF_EXPECTED_PAGES), name + ' must preserve every slide');
      } else if (response.headers.get('content-type')?.includes('json')) record.error = JSON.parse(output);
      console.log(JSON.stringify(record));
      return response;
    }
    assert.equal((await send('unauthenticated', { auth: false })).status, 403);
    for (const mode of ['formdata', 'delayed', 'buffered']) assert.equal((await send(mode, { mode })).status, 200, mode + ' must preserve streaming multipart bytes');
    assert.equal((await send('invalid-opc', { input: Buffer.from('invalid presentation') })).status, 422);
    assert.equal((await send('trailing-slash', { url: base + '/api/presentation-file/?room=demo-room' })).status, 308);
    assert.equal((await send('encoded-alias', { url: base + '/api/%70resentation-file?room=demo-room' })).status, 404);
    fs.mkdirSync('/data', { recursive: true }); fs.writeFileSync(marker, 'fixture', { flag: 'wx' }); markerOwned = true;
    for (const auth of [false, true]) {
      const response = await send('maintenance-' + auth, { auth, headers: { 'x-middleware-subrequest': 'middleware:middleware:middleware:middleware:middleware', 'x-middleware-skip': '1' } });
      assert.equal(response.status, 503); assert.equal(response.headers.get('retry-after'), '10'); assert.equal(response.headers.get('cache-control'), 'no-store');
    }
    assert.equal((await fetch(base + '/api/version')).status, 200);
    fs.unlinkSync(marker); markerOwned = false;
    assert.equal((await send('reopened-unauthenticated', { auth: false })).status, 403);
    console.log('PASS: compiled HTTP FormData, delayed header, buffered upload, access, OPC rejection, aliases and route-level maintenance');
  } finally {
    if (markerOwned && fs.readFileSync(marker, 'utf8') === 'fixture') fs.unlinkSync(marker);
    child.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
