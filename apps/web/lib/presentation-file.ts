import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, posix } from 'node:path';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';

export const MAX_PRESENTATION_UPLOAD = 25 * 1024 * 1024;
const MAX_REQUEST = MAX_PRESENTATION_UPLOAD + 64 * 1024;
const MAX_PDF = 100 * 1024 * 1024;
const MAX_XML = 4 * 1024 * 1024;
const MAX_EXPANDED = 128 * 1024 * 1024;
const MAX_WORKBOOK = 4 * 1024 * 1024;
const MAX_WORKBOOK_EXPANDED = 16 * 1024 * 1024;
const MAX_EMBEDDED_FONT = 4 * 1024 * 1024;
const CONVERSION_TIMEOUT = 30_000;
let busy = false;

/** Messages are deliberately safe to return to the browser. Never include converter output. */
export class PresentationFileError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
function invalid(): never { throw new PresentationFileError(400, 'Небезопасный или неподдерживаемый PPTX. Сохраните презентацию в PDF.'); }
function invalidUpload(): never { throw new PresentationFileError(400, 'Не удалось прочитать загруженный файл PPTX. Повторите загрузку.', 'presentation-upload-invalid'); }
function tooLarge(): never { throw new PresentationFileError(413, 'PPTX должен быть не больше 25 МБ.'); }

function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (const byte of data) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function safeZipExtra(extra: Buffer, local = false) {
  for (let offset = 0; offset < extra.length;) {
    if (offset + 4 > extra.length) invalid();
    const type = extra.readUInt16LE(offset), size = extra.readUInt16LE(offset + 2);
    if (offset + 4 + size > extra.length) invalid();
    if (type === 0xa220) {
      // MS OPC local-header padding: signature, exact byte count, then zeroes.
      if (!local || size < 4 || extra.readUInt16LE(offset + 4) !== 0xa028 || extra.readUInt16LE(offset + 6) !== size - 4 || extra.subarray(offset + 8, offset + 4 + size).some(byte => byte !== 0)) invalid();
    } else if (![0x5455, 0x7875, 0x000a].includes(type)) invalid();
    // ZIP64, alternate names, encryption and unknown overrides remain rejected.
    offset += 4 + size;
  }
}
function safeImage(name: string, body: Buffer) {
  const extension = name.split('.').pop()!.toLowerCase();
  const hex = body.subarray(0, 12).toString('hex');
  if (extension === 'png') return hex.startsWith('89504e470d0a1a0a');
  if (['jpg', 'jpeg'].includes(extension)) return hex.startsWith('ffd8ff');
  if (extension === 'gif') return /^GIF8[79]a/.test(body.subarray(0, 6).toString());
  if (extension === 'bmp') return hex.startsWith('424d');
  if (['tif', 'tiff'].includes(extension)) return /^(49492a00|4d4d002a)/.test(hex);
  if (extension === 'emf') return hex.startsWith('01000000') && body.subarray(40, 44).toString() === ' EMF';
  if (extension === 'wmf') return /^(d7cdc69a|010009000003|020009000003)/.test(hex);
  return false;
}
function safeEmbeddedFont(body: Buffer) {
  // PowerPoint .fntdata is Embedded OpenType (EOT). As with image signatures,
  // validate the container before passing font decoding to the isolated converter.
  return body.length >= 82 && body.length <= MAX_EMBEDDED_FONT
    && body.readUInt32LE(0) === body.length
    && body.readUInt32LE(4) > 0 && body.readUInt32LE(4) <= body.length - 82
    && [0x00010000, 0x00020001, 0x00020002].includes(body.readUInt32LE(8))
    && body.readUInt16LE(34) === 0x504c;
}
function xmlText(data: Buffer) {
  const xml = new TextDecoder('utf-8', { fatal: true }).decode(data);
  // LibreOffice must never resolve a DTD/entity or consume another XML encoding.
  if (/<!|\u0000|\uFFFD/.test(xml) || /<\?xml[^?]*encoding\s*=\s*['"](?!utf-8['"])[^'"]+/i.test(xml)) invalid();
  return xml;
}
function decodeAttribute(value: string) {
  if (!/^(?:[^&<]|&(?:amp|lt|gt|quot|apos|#[0-9]+|#x[0-9a-fA-F]+);)*$/.test(value) || /[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(value)) invalid();
  return value.replace(/&([^;]+);/g, (_, entity: string) => {
    const named: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
    if (Object.hasOwn(named, entity)) return named[entity];
    if (!/^#(?:[0-9]+|x[0-9a-f]+)$/i.test(entity)) invalid();
    const n = entity[1].toLowerCase() === 'x' ? parseInt(entity.slice(2), 16) : Number(entity.slice(1));
    if (!Number.isInteger(n) || n < 32 || n > 0x10ffff || (n >= 0xd800 && n <= 0xdfff)) invalid();
    return String.fromCodePoint(n);
  });
}
function relationshipTargets(xml: string, name: string, names: Set<string>) {
  // This deliberately supports a strict OPC XML subset, not arbitrary XML. Consume the
  // entire document; reject prefixes (including Unicode), namespace rebinding, unknown
  // markup/attributes, DTDs, PIs and nested elements instead of silently skipping them.
  let cursor = 0;
  const whitespace = () => { const start = cursor; while (/[ \t\r\n]/.test(xml[cursor] || 'x')) cursor++; return cursor > start; };
  const consume = (text: string) => { if (!xml.startsWith(text, cursor)) invalid(); cursor += text.length; };
  const readName = () => {
    const match = /^[A-Za-z_][A-Za-z0-9_.-]*/.exec(xml.slice(cursor));
    if (!match) invalid();
    cursor += match[0].length;
    return match[0];
  };
  const attributes = (declaration = false) => {
    const attrs = new Map<string, string>();
    while (true) {
      const separated = whitespace();
      if (declaration && xml.startsWith('?>', cursor)) { cursor += 2; return { attrs, empty: true }; }
      if (!declaration && xml.startsWith('/>', cursor)) { cursor += 2; return { attrs, empty: true }; }
      if (!declaration && xml[cursor] === '>') { cursor++; return { attrs, empty: false }; }
      if (!separated || attrs.size >= 8) invalid();
      const key = readName();
      if (attrs.has(key)) invalid();
      whitespace(); consume('='); whitespace();
      const quote = xml[cursor];
      if (quote !== '"' && quote !== "'") invalid();
      cursor++;
      const end = xml.indexOf(quote, cursor);
      if (end < 0) invalid();
      attrs.set(key, decodeAttribute(xml.slice(cursor, end)));
      cursor = end + 1;
    }
  };
  const close = (expected: string) => { consume('</'); if (readName() !== expected) invalid(); whitespace(); consume('>'); };
  whitespace();
  if (xml.startsWith('<?xml', cursor)) {
    cursor += 5;
    const { attrs } = attributes(true);
    if (attrs.get('version') !== '1.0' || [...attrs.keys()].some(key => !['version', 'encoding', 'standalone'].includes(key)) || (attrs.has('encoding') && attrs.get('encoding')!.toUpperCase() !== 'UTF-8') || (attrs.has('standalone') && !['yes', 'no'].includes(attrs.get('standalone')!))) invalid();
    whitespace();
  }
  consume('<'); if (readName() !== 'Relationships') invalid();
  const root = attributes();
  if (root.attrs.size !== 1 || root.attrs.get('xmlns') !== 'http://schemas.openxmlformats.org/package/2006/relationships') invalid();
  const ids = new Set<string>();
  const targets: Array<{ type: string; target: string }> = [];
  while (!root.empty) {
    whitespace();
    if (xml.startsWith('</', cursor)) { close('Relationships'); break; }
    consume('<'); if (readName() !== 'Relationship') invalid();
    const { attrs, empty } = attributes();
    if ([...attrs.keys()].some(key => !['Id', 'Type', 'Target', 'TargetMode'].includes(key))) invalid();
    const id = attrs.get('Id'), type = attrs.get('Type');
    if (!id || !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(id) || ids.has(id) || !type || /\s/.test(type) || ids.size >= 8192) invalid();
    ids.add(id);
    const target = attrs.get('Target');
    if (!target || (attrs.has('TargetMode') && attrs.get('TargetMode') !== 'Internal') || /[\\\x00-\x20%:]/.test(target) || target.startsWith('/')) invalid();
    const base = name === '_rels/.rels' ? '' : posix.dirname(posix.dirname(name));
    const resolved = posix.normalize(posix.join(base, target.split('#')[0]));
    if (resolved.startsWith('../') || !names.has(resolved)) invalid();
    targets.push({ type, target: resolved });
    if (!empty) { whitespace(); close('Relationship'); }
  }
  whitespace(); if (cursor !== xml.length) invalid();
  return targets;
}

// Only static chart-data parts are admitted inside an embedded XLSX. No binary,
// drawings, connections, query tables, macro sheets or further nested packages.
const spreadsheetPart = /^(?:\[Content_Types\]\.xml|_rels\/\.rels|docProps\/(?:app|core|custom)\.xml|xl\/(?:workbook|styles|sharedStrings)\.xml|xl\/_rels\/workbook\.xml\.rels|xl\/(?:worksheets\/sheet|theme\/theme|tables\/table)[1-9][0-9]*\.xml|xl\/worksheets\/_rels\/sheet[1-9][0-9]*\.xml\.rels)$/;
function validateOpcZip(data: Buffer, kind: 'presentation' | 'spreadsheet', budget: { expanded: number; entries: number }) {
  try {
    if (kind === 'presentation' && data.length > MAX_PRESENTATION_UPLOAD) tooLarge();
    if (kind === 'spreadsheet' && data.length > MAX_WORKBOOK) invalid();
    if (!data.length) invalid();
    let end = -1;
    for (let i = data.length - 22; i >= Math.max(0, data.length - 65557); i--) {
      if (data.readUInt32LE(i) === 0x06054b50 && i + 22 + data.readUInt16LE(i + 20) === data.length) { end = i; break; }
    }
    if (end < 0 || data.readUInt16LE(end + 4) || data.readUInt16LE(end + 6)) invalid();
    const count = data.readUInt16LE(end + 10), centralSize = data.readUInt32LE(end + 12), central = data.readUInt32LE(end + 16);
    budget.entries += count;
    if (!count || count > (kind === 'spreadsheet' ? 256 : 4096) || budget.entries > 4096 || count !== data.readUInt16LE(end + 8) || central + centralSize !== end) invalid();
    let offset = central, expanded = 0;
    const entries: Array<{ name: string; body: Buffer }> = [], names = new Set<string>();
    const workbooks = new Set<string>();
    const fonts = new Set<string>();
    const spans: Array<[number, number]> = [];
    for (let index = 0; index < count; index++) {
      if (offset + 46 > end || data.readUInt32LE(offset) !== 0x02014b50) invalid();
      const flags = data.readUInt16LE(offset + 8), method = data.readUInt16LE(offset + 10), crc = data.readUInt32LE(offset + 16);
      const packed = data.readUInt32LE(offset + 20), size = data.readUInt32LE(offset + 24), nameLength = data.readUInt16LE(offset + 28);
      const extraLength = data.readUInt16LE(offset + 30), commentLength = data.readUInt16LE(offset + 32), local = data.readUInt32LE(offset + 42);
      // Deflate's bits 1/2 are compression-level hints, not encryption or access grants.
      if (offset + 46 + nameLength + extraLength + commentLength > end || flags & ~(0x808 | (method === 8 ? 0x6 : 0)) || ![0, 8].includes(method) || data.readUInt16LE(offset + 34)) invalid();
      const rawName = data.subarray(offset + 46, offset + 46 + nameLength);
      safeZipExtra(data.subarray(offset + 46 + nameLength, offset + 46 + nameLength + extraLength));
      if ((data.readUInt32LE(offset + 38) >>> 16 & 0xf000) === 0xa000) invalid();
      const name = new TextDecoder('utf-8', { fatal: true }).decode(rawName);
      if (!/^[A-Za-z0-9_\-./\[\] ]{1,240}$/.test(name) || name.startsWith('/') || name.split('/').some(part => !part || part === '..' || part === '.') || names.has(name.toLowerCase())) invalid();
      names.add(name.toLowerCase());
      const isPrinterSettings = /^ppt\/printerSettings\/printerSettings[0-9]+\.bin$/.test(name);
      const isWorkbook = kind === 'presentation' && /^ppt\/embeddings\/[A-Za-z0-9_][A-Za-z0-9_. -]*\.xlsx$/.test(name);
      const isFont = kind === 'presentation' && /^ppt\/fonts\/[A-Za-z0-9_][A-Za-z0-9_. -]*\.fntdata$/.test(name);
      if (kind === 'spreadsheet' && !spreadsheetPart.test(name)) invalid();
      if (/vba|macro|activex|oleobject|customui|externallink/i.test(name) || (/embeddings/i.test(name) && !isWorkbook) || (!isPrinterSettings && !isWorkbook && !isFont && !/\.(?:xml|rels|png|jpe?g|gif|bmp|tiff?|emf|wmf)$/i.test(name))) invalid();
      expanded += size;
      budget.expanded += size;
      const isXml = /\.(?:xml|rels)$/i.test(name);
      if (isFont && size > MAX_EMBEDDED_FONT) invalid();
      if (budget.expanded > MAX_EXPANDED || (kind === 'spreadsheet' && expanded > MAX_WORKBOOK_EXPANDED) || (isWorkbook && size > MAX_WORKBOOK) || (isXml && size > MAX_XML) || (isPrinterSettings && size > 64 * 1024) || size > 32 * 1024 * 1024 || (packed === 0 && size !== 0)) invalid();
      if (local + 30 > central || data.readUInt32LE(local) !== 0x04034b50 || data.readUInt16LE(local + 6) !== flags || data.readUInt16LE(local + 8) !== method) invalid();
      const localNameLength = data.readUInt16LE(local + 26), localExtra = data.readUInt16LE(local + 28), start = local + 30 + localNameLength + localExtra;
      safeZipExtra(data.subarray(local + 30 + localNameLength, start), true);
      if (!rawName.equals(data.subarray(local + 30, local + 30 + localNameLength)) || start + packed > central) invalid();
      if (!(flags & 8) && (data.readUInt32LE(local + 14) !== crc || data.readUInt32LE(local + 18) !== packed || data.readUInt32LE(local + 22) !== size)) invalid();
      let finish = start + packed;
      if (flags & 8) {
        if (data.readUInt32LE(finish) === 0x08074b50) finish += 4;
        if (finish + 12 > central || data.readUInt32LE(finish) !== crc || data.readUInt32LE(finish + 4) !== packed || data.readUInt32LE(finish + 8) !== size) invalid();
        finish += 12;
      }
      spans.push([local, finish]);
      const content = data.subarray(start, start + packed);
      const body = method === 8 ? inflateRawSync(content, { maxOutputLength: Math.max(1, size) }) : content;
      if (body.length !== size || crc32(body) !== crc) invalid();
      if (body.subarray(0, 8).toString('hex') === 'd0cf11e0a1b11ae1') invalid();
      if (isWorkbook) { validateOpcZip(body, 'spreadsheet', budget); workbooks.add(name); }
      else if (isFont) { if (!safeEmbeddedFont(body)) invalid(); fonts.add(name); }
      else if (isXml) entries.push({ name, body });
      // Avoid SVG/HTML or another importer disguised with an image filename.
      else if (!isPrinterSettings && !safeImage(name, body)) invalid();
      offset += 46 + nameLength + extraLength + commentLength;
    }
    if (offset !== end) invalid();
    spans.sort((a, b) => a[0] - b[0]);
    if (spans[0][0] !== 0 || spans[spans.length - 1][1] !== central || spans.some((span, i) => i && spans[i - 1][1] !== span[0])) invalid();
    const mainPart = kind === 'presentation' ? 'ppt/presentation.xml' : 'xl/workbook.xml';
    if (!names.has('[content_types].xml') || !names.has('_rels/.rels') || !names.has(mainPart)) invalid();
    const originalNames = new Set(entries.map(entry => entry.name));
    // Include image names as relationship destinations (case-sensitive ZIP paths).
    for (let cursor = central; cursor < end;) {
      const n = data.readUInt16LE(cursor + 28), e = data.readUInt16LE(cursor + 30), c = data.readUInt16LE(cursor + 32);
      originalNames.add(data.subarray(cursor + 46, cursor + 46 + n).toString('utf8')); cursor += 46 + n + e + c;
    }
    if (!originalNames.has('[Content_Types].xml') || !originalNames.has('_rels/.rels') || !originalNames.has(mainPart)) invalid();
    const chartWorkbooks = new Set<string>();
    const referencedFonts = new Set<string>();
    for (const entry of entries) {
      const xml = xmlText(entry.body);
      if (/macroEnabled|vbaProject|oleObject|activeX|attachedTemplate|externalLink|aFChunk|embeddedPackage|image\/svg\+xml|text\/html/i.test(xml)) invalid();
      // Chart workbooks are data only. Reject every formula-bearing element,
      // including Unicode-prefixed tags, rather than trying to allowlist functions.
      if (kind === 'spreadsheet' && /<(?:[^\s<>/:]+:)?(?:f|definedNames?|(?:[A-Za-z_][A-Za-z0-9_.-]*)?[Ff]ormula[0-9]*|ddeLink|ddeItems?|externalReferences?)(?=[\s/>])/u.test(xml)) invalid();
      if (/\.rels$/i.test(entry.name)) {
        const targets = relationshipTargets(xml, entry.name, originalNames);
        if (kind === 'presentation' && entry.name === 'ppt/_rels/presentation.xml.rels') {
          for (const target of targets) if (target.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/font') referencedFonts.add(target.target);
        }
        if (kind === 'presentation' && /^ppt\/charts\/_rels\/chart[1-9][0-9]*\.xml\.rels$/.test(entry.name) && originalNames.has(entry.name.replace('/_rels/', '/').slice(0, -5))) {
          for (const target of targets) if (target.type === 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/package') chartWorkbooks.add(target.target);
        }
      }
      const mainType = kind === 'presentation' ? 'presentationml.presentation' : 'spreadsheetml.sheet';
      if (entry.name === '[Content_Types].xml' && !xml.includes(`application/vnd.openxmlformats-officedocument.${mainType}.main+xml`)) invalid();
    }
    for (const workbook of workbooks) if (!chartWorkbooks.has(workbook)) invalid();
    for (const font of fonts) if (!referencedFonts.has(font)) invalid();
  } catch (error) {
    if (error instanceof PresentationFileError) throw error;
    invalid();
  }
}

/** Validate complete archives and their shared expansion budget before invoking LibreOffice. */
export function validatePptx(data: Buffer) {
  validateOpcZip(data, 'presentation', { expanded: 0, entries: 0 });
}

async function boundedUpload(request: Request) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST)) tooLarge();
  if (!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get('content-type') || '') || !request.body) invalidUpload();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PresentationFileError(408, 'Загрузка PPTX заняла слишком много времени.')), 15_000); });
    while (true) {
      const chunk = await Promise.race([reader.read(), deadline]);
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_REQUEST) tooLarge();
      chunks.push(chunk.value);
    }
  } catch (error) {
    if (error instanceof PresentationFileError) throw error;
    invalidUpload();
  } finally { if (timer) clearTimeout(timer); void reader.cancel().catch(() => {}); }
  if (length && size !== Number(length)) invalidUpload();
  const form = await new Response(Buffer.concat(chunks), { headers: { 'content-type': request.headers.get('content-type')! } }).formData().catch(() => invalidUpload());
  const items = [...form.entries()];
  const file = form.get('file');
  if (items.length !== 1 || !file || typeof file === 'string' || !/\.pptx$/i.test(file.name) || /[\/\\\x00]/.test(file.name)) invalidUpload();
  if (file.size > MAX_PRESENTATION_UPLOAD) tooLarge();
  return Buffer.from(await file.arrayBuffer());
}

async function renderPdf(input: Buffer) {
  validatePptx(input);
  const directory = await mkdtemp(join(tmpdir(), 'castlink-presentation-'));
  try {
    const profile = join(directory, 'profile');
    await mkdir(join(profile, 'user'), { recursive: true, mode: 0o700 });
    await writeFile(join(profile, 'user/registrymodifications.xcu'), '<?xml version="1.0" encoding="UTF-8"?><oor:items xmlns:oor="http://openoffice.org/2001/registry"><item oor:path="/org.openoffice.Office.Common/Security/Scripting"><prop oor:name="MacroSecurityLevel" oor:op="fuse"><value>3</value></prop></item></oor:items>', { mode: 0o600 });
    await writeFile(join(directory, 'slides.pptx'), input, { mode: 0o600 });
    await new Promise<void>((resolve, reject) => {
      const child = spawn('/usr/bin/soffice', [`-env:UserInstallation=${pathToFileURL(profile).href}`, '--headless', '--nologo', '--nodefault', '--norestore', '--convert-to', 'pdf:impress_pdf_Export', '--outdir', directory, join(directory, 'slides.pptx')], {
        cwd: directory, detached: true, stdio: 'ignore',
        env: { NODE_ENV: 'production', HOME: directory, TMPDIR: directory, PATH: '/usr/bin:/bin', LANG: 'C.UTF-8', NO_AT_BRIDGE: '1' },
      });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        try { if (child.pid) process.kill(-child.pid, 'SIGKILL'); } catch { child.kill('SIGKILL'); }
      }, CONVERSION_TIMEOUT);
      child.once('error', () => { clearTimeout(timer); reject(new PresentationFileError(503, 'Конвертер PPTX временно недоступен. Сохраните презентацию в PDF.')); });
      child.once('close', code => {
        clearTimeout(timer);
        if (timedOut) reject(new PresentationFileError(504, 'Конвертация PPTX заняла слишком много времени. Сохраните презентацию в PDF.'));
        else if (code !== 0) reject(new PresentationFileError(422, 'Не удалось преобразовать PPTX. Сохраните презентацию в PDF.'));
        else resolve();
      });
    });
    const output = join(directory, 'slides.pdf');
    const info = await stat(output).catch(() => null);
    if (!info?.isFile() || info.size < 5 || info.size > MAX_PDF) throw new PresentationFileError(422, 'Не удалось создать PDF допустимого размера.');
    const pdf = await readFile(output);
    if (pdf.subarray(0, 5).toString() !== '%PDF-') throw new PresentationFileError(422, 'Не удалось создать PDF.');
    return pdf;
  } finally { await rm(directory, { recursive: true, force: true }); }
}

/** Reserve before reading the upload: one active conversion, no unbounded queue or buffered waiting files. */
export async function convertPresentationFile(request: Request): Promise<Buffer> {
  if (busy) throw new PresentationFileError(429, 'Конвертер занят. Повторите попытку через несколько секунд.');
  busy = true;
  try { return await renderPdf(await boundedUpload(request)); }
  finally { busy = false; }
}
