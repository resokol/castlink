import { request as httpRequest } from 'node:http';

export const MAX_PRESENTATION_UPLOAD = 25 * 1024 * 1024;
const MAX_REQUEST = MAX_PRESENTATION_UPLOAD + 64 * 1024;
const MAX_PDF = 100 * 1024 * 1024;
const SOCKET_PATH = '/run/castlink-converter/converter.sock';
const CONVERSION_TIMEOUT = 45_000;
let busy = false;

/** Only fixed messages and codes cross the guest API boundary. */
export class PresentationFileError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
function invalidUpload(): never { throw new PresentationFileError(400, 'Не удалось прочитать загруженный файл PPTX. Повторите загрузку.', 'presentation-upload-invalid'); }
function tooLarge(): never { throw new PresentationFileError(413, 'PPTX должен быть не больше 25 МБ.', 'presentation-upload-limit'); }

async function boundedUpload(request: Request) {
  const length = request.headers.get('content-length');
  if (length && (!/^\d+$/.test(length) || Number(length) > MAX_REQUEST)) tooLarge();
  if (!/^multipart\/form-data;\s*boundary=/i.test(request.headers.get('content-type') || '') || !request.body) invalidUpload();
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = []; let size = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new PresentationFileError(408, 'Загрузка PPTX заняла слишком много времени.', 'presentation-upload-timeout')), 15_000); });
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

function workerError(status: number, code?: unknown) {
  if (status === 413) return new PresentationFileError(413, 'Презентация превышает допустимый размер.', 'presentation-expanded-limit');
  if (status === 429) return new PresentationFileError(429, 'Конвертер занят. Повторите попытку через несколько секунд.', 'presentation-converter-busy');
  if (status === 408) return new PresentationFileError(408, 'Загрузка PPTX заняла слишком много времени.', 'presentation-upload-timeout');
  if (status === 504) return new PresentationFileError(504, 'Конвертация PPTX заняла слишком много времени. Сохраните презентацию в PDF.', 'presentation-conversion-timeout');
  if (status === 503) return new PresentationFileError(503, 'Конвертер PPTX временно недоступен. Сохраните презентацию в PDF.', 'presentation-converter-unavailable');
  if (status === 400 || status === 422) {
    const encrypted = code === 'presentation-encrypted';
    return new PresentationFileError(status, encrypted ? 'PPTX защищён паролем. Снимите защиту или сохраните презентацию в PDF.' : 'Не удалось прочитать PPTX. Проверьте файл или сохраните презентацию в PDF.', encrypted ? 'presentation-encrypted' : 'presentation-invalid-package');
  }
  return new PresentationFileError(502, 'Не удалось получить PDF от конвертера. Повторите попытку.', 'presentation-invalid-output');
}

/** Send bytes only. The worker has no application data, credentials or network. */
async function renderPdf(input: Buffer, signal: AbortSignal): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    let settled = false;
    let request: ReturnType<typeof httpRequest> | undefined;
    const abort = () => finish(undefined, new PresentationFileError(408, 'Загрузка PPTX отменена.', 'presentation-upload-cancelled'));
    const timer = setTimeout(() => finish(undefined, workerError(504)), CONVERSION_TIMEOUT);
    function finish(result?: Buffer, error?: PresentationFileError) {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener('abort', abort);
      if (error) { request?.destroy(); reject(error); }
      else resolve(result!);
    }
    if (signal.aborted) { abort(); return; }
    signal.addEventListener('abort', abort, { once: true });
    try {
      request = httpRequest({ socketPath: SOCKET_PATH, path: '/convert', method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': input.length }, agent: false }, response => {
        if (settled) { response.destroy(); return; }
        const status = response.statusCode || 502;
        const limit = status === 200 ? MAX_PDF : 8192;
        const rawLength = response.headers['content-length'];
        const expected = typeof rawLength === 'string' && /^\d+$/.test(rawLength) ? Number(rawLength) : undefined;
        if ((rawLength !== undefined && expected === undefined) || (expected !== undefined && expected > limit)
          || (status === 200 && !/^application\/pdf(?:\s*;|$)/i.test(String(response.headers['content-type'] || '')))) {
          finish(undefined, workerError(502)); return;
        }
        const chunks: Buffer[] = []; let size = 0;
        response.on('data', (chunk: Buffer) => {
          if (settled) return;
          size += chunk.length;
          if (size > limit) { finish(undefined, workerError(502)); return; }
          chunks.push(chunk);
        });
        response.once('aborted', () => finish(undefined, workerError(503)));
        response.once('error', () => finish(undefined, workerError(503)));
        response.once('end', () => {
          if (settled) return;
          if (expected !== undefined && size !== expected) { finish(undefined, workerError(502)); return; }
          const body = Buffer.concat(chunks);
          if (status !== 200) {
            let code: unknown;
            try { code = JSON.parse(body.toString('utf8')).code; } catch { /* Fixed fallback only. */ }
            finish(undefined, workerError(status, code)); return;
          }
          if (body.subarray(0, 5).toString() !== '%PDF-') { finish(undefined, workerError(502)); return; }
          finish(body);
        });
      });
      request.once('error', () => finish(undefined, workerError(503)));
      request.end(input);
    } catch { finish(undefined, workerError(503)); }
  });
}

/** Reserve before reading: one active request and no buffered waiting uploads. */
export async function convertPresentationFile(request: Request): Promise<Buffer> {
  if (busy) throw workerError(429);
  busy = true;
  try { return await renderPdf(await boundedUpload(request), request.signal); }
  finally { busy = false; }
}
