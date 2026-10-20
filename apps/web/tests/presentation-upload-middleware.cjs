// Size-budget proof only: finalize is awaited here. Actual streaming HTTP is
// covered by scripts/tests/presentation-upload-http.smoke.cjs against the built image.
const assert = require('node:assert/strict');
const path = require('node:path');
const { Readable } = require('node:stream');
const { createHash } = require('node:crypto');
const loadConfig = require('next/dist/server/config').default;
const { PHASE_PRODUCTION_SERVER } = require('next/constants');
const { getCloneableBody } = require('next/dist/server/body-streams');
const { MAX_PRESENTATION_UPLOAD } = require('./load-typescript.cjs').load('../lib/presentation-file.ts');

(async () => {
  const config = await loadConfig(PHASE_PRODUCTION_SERVER, path.resolve(__dirname, '..'));
  const form = new FormData();
  form.set('file', new Blob([Buffer.alloc(MAX_PRESENTATION_UPLOAD, 0x5a)]), 'slides.pptx');
  const body = Buffer.from(await new Request('http://localhost/api/presentation-file', { method: 'POST', body: form }).arrayBuffer());
  const chunks = Array.from({ length: Math.ceil(body.length / 65536) }, (_, i) => body.subarray(i * 65536, (i + 1) * 65536));
  const request = Readable.from(chunks);
  request.url = '/api/presentation-file';
  const cloned = getCloneableBody(request, config.experimental.middlewareClientMaxBodySize);
  const copy = [];
  for await (const chunk of cloned.cloneBodyStream()) copy.push(chunk);
  await cloned.finalize();
  const forwarded = [];
  for await (const chunk of request) forwarded.push(chunk);
  for (const output of [Buffer.concat(copy), Buffer.concat(forwarded)]) {
    assert.equal(output.length, body.length, 'middleware must forward the complete allowed PPTX plus multipart framing');
    assert.equal(createHash('sha256').update(output).digest('hex'), createHash('sha256').update(body).digest('hex'));
  }
  console.log('PASS: configured middleware clone size budget accepts a full 25 MiB PPTX multipart body');
})().catch(error => { console.error(error); process.exitCode = 1; });
