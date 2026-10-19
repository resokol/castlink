const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const fs = require('node:fs/promises');
const path = require('node:path');
const { deflateRawSync } = require('node:zlib');
const { load } = require('./load-typescript.cjs');
const { NextRequest } = require('next/server');

// A real ZIP writer, independent of the production parser, creates adversarial OPC packages.
function crc32(data) { let n = -1; for (const x of data) { n ^= x; for (let k = 0; k < 8; k++) n = (n >>> 1) ^ (0xedb88320 & -(n & 1)); } return (n ^ -1) >>> 0; }
function zip(entries) {
  const locals = [], centrals = []; let offset = 0;
  for (const [filename, value] of entries) {
    const name = Buffer.from(filename), data = Buffer.from(value), compressed = deflateRawSync(data), crc = crc32(data);
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8); local.writeUInt32LE(crc, 14); local.writeUInt32LE(compressed.length, 18); local.writeUInt32LE(data.length, 22); local.writeUInt16LE(name.length, 26);
    const central = Buffer.alloc(46); central.writeUInt32LE(0x02014b50); central.writeUInt16LE(20, 4); central.writeUInt16LE(20, 6); central.writeUInt16LE(8, 10); central.writeUInt32LE(crc, 16); central.writeUInt32LE(compressed.length, 20); central.writeUInt32LE(data.length, 24); central.writeUInt16LE(name.length, 28); central.writeUInt32LE(offset, 42);
    locals.push(local, name, compressed); centrals.push(central, name); offset += local.length + name.length + compressed.length;
  }
  const directory = Buffer.concat(centrals), end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50); end.writeUInt16LE(entries.length, 8); end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12); end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, directory, end]);
}
const base = [
  ['[Content_Types].xml', '<Types><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/></Types>'],
  ['_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships>'],
  ['ppt/presentation.xml', '<p:presentation xmlns:p="urn:presentation"/>'],
];
const pptx = zip(base);
const plain = load('../lib/presentation-file.ts');
const bad = entries => assert.throws(() => plain.validatePptx(zip(entries)), error => error.status === 400);
const upload = (body = pptx, name = 'slides.pptx') => { const form = new FormData(); form.append('file', new Blob([body]), name); return new Request('http://localhost', { method: 'POST', body: form }); };
async function expectStatus(promise, status) { await assert.rejects(promise, error => error.status === status); }

(async () => {
  plain.validatePptx(pptx);
  const relationshipNamespace = 'http://schemas.openxmlformats.org/package/2006/relationships';
  const packageWithRelationships = xml => [base[0], ['_rels/.rels', xml], base[2]];
  for (const prefix of ['é', '关系', 'r', '𝒓']) {
    for (const target of ['file:///etc/passwd', 'https://example.invalid/remote', 'http://example.invalid/remote']) {
      bad(packageWithRelationships(`<Relationships xmlns="${relationshipNamespace}"><${prefix}:Relationship xmlns:${prefix}="${relationshipNamespace}" Id="r1" Type="officeDocument" Target="${target}" TargetMode="External"/></Relationships>`));
    }
  }
  for (const markup of [
    `<Relationships><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    `<Relationships xmlns="urn:wrong"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    `<é:Relationships xmlns:é="${relationshipNamespace}"><é:Relationship Id="r1" Type="officeDocument" Target="file:///etc/passwd" TargetMode="External"/></é:Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship xmlns="urn:wrong" Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Unknown><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/></Unknown></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"><Relationship Id="r2" Type="officeDocument" Target="file:///etc/passwd"/></Relationship></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships><Relationship Target="file:///etc/passwd"/>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/>unparsed</Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"TargetMode="Internal"/></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml" Target="file:///etc/passwd"/></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml"/></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml" TargetMode="Extern&#x61;l"/></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="&#102;ile&#58;///etc/passwd"/></Relationships>`,
    `<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml&broken"/></Relationships>`,
  ]) bad(packageWithRelationships(markup));
  plain.validatePptx(zip(packageWithRelationships(`<?xml version='1.0' encoding='UTF-8' standalone='yes'?>\r\n<Relationships\n xmlns = '${relationshipNamespace}' >\n<Relationship\tId = 'r1'\r\n Type='officeDocument' Target = 'ppt/presentation.xml' TargetMode = 'Internal' > \n</Relationship>\n</Relationships>\t`)));
  assert.throws(() => plain.validatePptx(Buffer.from('not a zip')), error => error.status === 400);
  assert.throws(() => plain.validatePptx(Buffer.alloc(plain.MAX_PRESENTATION_UPLOAD + 1)), error => error.status === 413);
  bad([...base, ['../secret.xml', '<a/>']]); bad([...base, ['/secret.xml', '<a/>']]);
  bad([...base, ['ppt\\secret.xml', '<a/>']]); bad([...base, ['PPT/presentation.xml', '<a/>']]);
  bad([...base, ['ppt/vbaProject.bin', 'macro']]); bad([...base, ['ppt/embeddings/oleObject1.bin', 'ole']]);
  bad([...base, ['ppt/media/image1.png', ' '.repeat(300) + '<svg xmlns="http://www.w3.org/2000/svg"/>']]);
  bad([...base.slice(0, 2), ['ppt/presentation.xml', '<!DOCTYPE x SYSTEM "file:///etc/passwd"><p:presentation/>']]);
  bad([...base.slice(0, 2), ['ppt/presentation.xml', '<?xml version="1.0" encoding="UTF-16"?><a/>']]);
  bad([...base, ['ppt/slides/slide1.xml', 'x'.repeat(4 * 1024 * 1024 + 1)]]);
  for (const target of ['https://example.invalid/image', 'file:///etc/passwd', '//example.invalid/a', '../../../secret', 'ppt%2fpresentation.xml']) {
    bad(packageWithRelationships(`<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="${target}"/></Relationships>`));
  }
  for (const mode of ['External', 'Extern&#97;l']) bad(packageWithRelationships(`<Relationships xmlns="${relationshipNamespace}"><Relationship Id="r1" Type="officeDocument" Target="ppt/presentation.xml" TargetMode="${mode}"/></Relationships>`));
  const corrupt = Buffer.from(pptx); corrupt[35] ^= 1; assert.throws(() => plain.validatePptx(corrupt));
  const bomb = Buffer.from(pptx); const central = bomb.indexOf(Buffer.from('504b0102', 'hex')); bomb.writeUInt32LE(0x10000000, central + 24); assert.throws(() => plain.validatePptx(bomb));

  let directory, captured, mode = 'success', killCount = 0, spawnCount = 0;
  const converter = load('../lib/presentation-file.ts', {
    'node:child_process': { spawn(executable, args, options) {
      spawnCount++; directory = options.cwd; captured = { executable, args, options };
      const child = new EventEmitter(); child.pid = 99999999; child.kill = () => { killCount++; setImmediate(() => child.emit('close', null)); return true; };
      if (mode === 'success') fs.writeFile(path.join(directory, 'slides.pdf'), '%PDF-1.7\nunit conversion output').then(() => child.emit('close', 0));
      else if (mode === 'missing') setImmediate(() => child.emit('close', 0));
      else if (mode === 'error') setImmediate(() => child.emit('error', new Error('/private/path secret-token')));
      return child;
    } },
  });
  await expectStatus(converter.convertPresentationFile(upload(pptx, 'slides.pptm')), 400);
  assert.equal(spawnCount, 0, 'a filename cannot opt a macro-enabled format into conversion');
  const converted = await converter.convertPresentationFile(upload()); assert.equal(converted.subarray(0, 5).toString(), '%PDF-');
  assert.equal(captured.executable, '/usr/bin/soffice'); assert.equal(captured.options.shell, undefined); assert.equal(captured.options.detached, true);
  assert.equal(captured.options.env.LIVEKIT_API_SECRET, undefined); assert.equal(captured.options.env.HTTP_PROXY, undefined);
  assert.ok(captured.args.some(value => value.startsWith('-env:UserInstallation=file:///'))); assert.equal(captured.options.stdio, 'ignore');
  await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
  mode = 'error'; await expectStatus(converter.convertPresentationFile(upload()), 503); await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
  mode = 'missing'; await expectStatus(converter.convertPresentationFile(upload()), 422); await assert.rejects(fs.stat(directory), { code: 'ENOENT' });
  mode = 'timeout'; const realTimer = global.setTimeout; global.setTimeout = (fn, ms, ...args) => realTimer(fn, ms === 30000 ? 5 : ms, ...args);
  try { await expectStatus(converter.convertPresentationFile(upload()), 504); } finally { global.setTimeout = realTimer; }
  assert.equal(killCount, 1); await assert.rejects(fs.stat(directory), { code: 'ENOENT' });

  let unblock; const pendingBody = new ReadableStream({ start(controller) { unblock = () => controller.close(); } });
  const pending = converter.convertPresentationFile(new Request('http://localhost', { method: 'POST', body: pendingBody, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=a' } }));
  await expectStatus(converter.convertPresentationFile(upload()), 429); unblock(); await expectStatus(pending, 400);
  await expectStatus(converter.convertPresentationFile(new Request('http://localhost', { method: 'POST', body: 'x', headers: { 'content-length': String(plain.MAX_PRESENTATION_UPLOAD + 65537) } })), 413);
  let cancelled = false;
  const oversized = new ReadableStream({ pull(controller) { controller.enqueue(new Uint8Array(1024 * 1024)); }, cancel() { cancelled = true; } });
  await expectStatus(converter.convertPresentationFile(new Request('http://localhost', { method: 'POST', body: oversized, duplex: 'half', headers: { 'content-type': 'multipart/form-data; boundary=a' } })), 413);
  assert.equal(cancelled, true, 'streamed total limit cancels the unread upload even without Content-Length');

  let authorized = false, conversions = 0, scope;
  const api = load('../app/api/presentation-file/route.ts', {
    '@/lib/co-presentation-access': { presentationGuest: async (_request, studioId, room) => { scope = { studioId, room }; return authorized ? { identity: 'guest-one', sid: 'PA_one', association: 'assoc' } : null; } },
    '@/lib/presentation-file': { PresentationFileError: plain.PresentationFileError, convertPresentationFile: async request => { conversions++; assert.equal(request.bodyUsed, false); return Buffer.from('%PDF-1.7'); } },
  });
  const req = () => new NextRequest('http://localhost/api/presentation-file?studioId=studio-two&room=Room2', { method: 'POST', body: 'never parse before auth' });
  let request = req(); assert.equal((await api.POST(request)).status, 403); assert.equal(request.bodyUsed, false); assert.equal(conversions, 0);
  assert.deepEqual(scope, { studioId: 'studio-two', room: 'Room2' });
  authorized = true; const response = await api.POST(req()); assert.equal(response.status, 200); assert.equal(response.headers.get('content-type'), 'application/pdf'); assert.equal(response.headers.get('cache-control'), 'no-store'); assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.equal(conversions, 1);
  console.log('PASS: bounded uploads, hostile ZIP/OOXML rejection, conversion isolation/cleanup/timeout/concurrency and authorization before body');
})().catch(error => { console.error(error); process.exitCode = 1; });
