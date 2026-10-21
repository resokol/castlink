import { request as httpRequest, IncomingMessage } from 'node:http';
import { createReadStream } from 'node:fs';
import { mkdtemp, open, rm, statfs } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MAX_PRESENTATION_UPLOAD } from './presentation-upload-limits';
import { savePresentationUpload, PresentationFileError, uploadError } from './presentation-upload';

export { MAX_PRESENTATION_UPLOAD, PresentationFileError };
const SOCKET_PATH = '/run/castlink-converter/converter.sock';
const WORKER_TIMEOUT = 20 * 60_000;
const DOWNLOAD_TIMEOUT = 5 * 60_000;
const DISK_RESERVE = MAX_PRESENTATION_UPLOAD * 2 + 256 * 1024 * 1024;
let busy = false;

function workerError(status: number, code?: unknown): PresentationFileError {
  if (code === 'presentation-upload-limit') return uploadError(413, 'presentation-upload-limit');
  if (status === 413 && code === 'presentation-output-limit') return new PresentationFileError(413, 'PDF после конвертации превышает 1,5 ГБ. Уменьшите презентацию.', 'presentation-output-limit');
  if (status === 413) return new PresentationFileError(413, 'Презентация превышает допустимый распакованный размер (3 ГБ) или число файлов.', typeof code === 'string' && code === 'presentation-entries-limit' ? code : 'presentation-expanded-limit');
  if (status === 507) return uploadError(507, 'presentation-storage-limit');
  if (status === 429) return new PresentationFileError(429, 'Конвертер занят. Повторите попытку через несколько секунд.', 'presentation-converter-busy');
  if (status === 408) return uploadError(408, 'presentation-upload-timeout');
  if (status === 504) return new PresentationFileError(504, 'Конвертация PPTX заняла слишком много времени. Сохраните презентацию в PDF.', 'presentation-conversion-timeout');
  if (status === 503) return new PresentationFileError(503, 'Конвертер PPTX временно недоступен. Сохраните презентацию в PDF.', 'presentation-converter-unavailable');
  if (status === 400 || status === 422) {
    if (code === 'presentation-invalid-output') return workerError(502);
    if (code === 'presentation-conversion-resource-limit') return new PresentationFileError(422, 'Презентация слишком сложна для конвертации на сервере. Сохраните её в PDF.', 'presentation-conversion-resource-limit');
    if (code === 'presentation-conversion-failed') return new PresentationFileError(422, 'Не удалось преобразовать PPTX. Сохраните презентацию в PDF.', 'presentation-conversion-failed');
    const encrypted = code === 'presentation-encrypted';
    return new PresentationFileError(status, encrypted ? 'PPTX защищён паролем. Снимите защиту или сохраните презентацию в PDF.' : 'Не удалось прочитать PPTX. Проверьте файл или сохраните презентацию в PDF.', encrypted ? 'presentation-encrypted' : 'presentation-invalid-package');
  }
  return new PresentationFileError(502, 'Не удалось получить корректный PDF от конвертера. Повторите попытку.', 'presentation-invalid-output');
}

/** Stream owned input to the isolated Unix socket, then validate output on disk before HTTP success. */
async function renderPdf(input: { path: string; size: number }, output: string, signal: AbortSignal): Promise<number> {
  const file = await open(output, 'wx+', 0o600);
  const source = createReadStream(input.path, { highWaterMark: 64 * 1024 });
  let request: ReturnType<typeof httpRequest> | undefined;
  let response: IncomingMessage | undefined;
  let timeoutError: PresentationFileError | undefined;
  let rejectResponse: (error: Error) => void = () => {};
  const fail = (error: PresentationFileError) => {
    timeoutError = error; source.destroy(error); response?.destroy(error); request?.destroy(error); rejectResponse(error);
  };
  const abort = () => fail(uploadError(408, 'presentation-upload-cancelled'));
  const timer = setTimeout(() => fail(workerError(504)), WORKER_TIMEOUT);
  signal.addEventListener('abort', abort, { once: true });
  try {
    if (signal.aborted) throw uploadError(408, 'presentation-upload-cancelled');
    const received = new Promise<IncomingMessage>((resolve, reject) => {
      rejectResponse = reject;
      request = httpRequest({ socketPath: SOCKET_PATH, path: '/convert', method: 'POST', headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': input.size }, agent: false }, resolve);
      request.once('error', error => reject(timeoutError || workerError(503)));
    });
    // The worker may reject before consuming input. Its HTTP error body remains authoritative.
    const sending = new Promise<void>(resolve => {
      request!.once('finish', resolve);
      request!.once('close', resolve);
      source.once('error', error => { request!.destroy(error); resolve(); });
      source.pipe(request!); // Built-in pipe pauses file reads when the socket applies backpressure.
    });
    response = await received;
    const status = response.statusCode || 502;
    if (status !== 200) { source.unpipe(request!); source.destroy(); request!.end(); }
    const limit = status === 200 ? MAX_PRESENTATION_UPLOAD : 8192;
    const raw = response.headers['content-length'];
    const expected = typeof raw === 'string' && /^\d+$/.test(raw) && Number.isSafeInteger(Number(raw)) ? Number(raw) : undefined;
    if (raw !== undefined && expected === undefined || expected !== undefined && expected > limit
      || status === 200 && (expected === undefined || !/^application\/pdf(?:\s*;|$)/i.test(String(response.headers['content-type'] || '')))) throw workerError(502);
    const errors: Buffer[] = [];
    let size = 0;
    for await (const chunk of response) {
      size += chunk.length;
      if (size > limit) throw workerError(502);
      if (status !== 200) errors.push(chunk);
      else {
        let offset = 0;
        while (offset < chunk.length) {
          const write = await file.write(chunk, offset, chunk.length - offset);
          if (!write.bytesWritten) throw uploadError(507, 'presentation-storage-limit');
          offset += write.bytesWritten;
        }
      }
    }
    await sending;
    if (expected !== undefined && size !== expected) throw workerError(502);
    if (status !== 200) {
      let code: unknown;
      try { code = JSON.parse(Buffer.concat(errors).toString('utf8')).code; } catch { /* Fixed fallback only. */ }
      throw workerError(status, code);
    }
    const prefix = Buffer.alloc(5);
    await file.read(prefix, 0, 5, 0);
    if (size < 5 || prefix.toString() !== '%PDF-') throw workerError(502);
    return size;
  } catch (error) {
    if (timeoutError) throw timeoutError;
    if (error instanceof PresentationFileError) throw error;
    if (['ENOSPC', 'EDQUOT'].includes((error as NodeJS.ErrnoException).code || '')) throw uploadError(507, 'presentation-storage-limit');
    throw workerError(503);
  } finally {
    clearTimeout(timer); signal.removeEventListener('abort', abort);
    source.destroy(); response?.destroy(); request?.destroy(); await file.close();
  }
}

/** One active upload/download, no buffered waiting jobs; cleanup is bound to stream completion/cancel. */
export async function convertPresentationFile(request: Request): Promise<{ body: ReadableStream<Uint8Array>; size: number }> {
  if (busy) throw workerError(429);
  busy = true;
  let directory: string | undefined;
  let handedOff = false;
  const cleanup = async () => { if (directory) { const owned = directory; directory = undefined; await rm(owned, { recursive: true, force: true }); } busy = false; };
  try {
    const space = await statfs(tmpdir());
    if (space.bavail * space.bsize < DISK_RESERVE) throw uploadError(507, 'presentation-storage-limit');
    directory = await mkdtemp(join(tmpdir(), 'castlink-upload-'));
    const input = await savePresentationUpload(request, directory);
    const output = join(directory, 'presentation.pdf');
    const size = await renderPdf(input, output, request.signal);
    const file = await open(output, 'r');
    let position = 0, done = false, downloadTimer: ReturnType<typeof setTimeout>;
    let streamController: ReadableStreamDefaultController<Uint8Array> | undefined;
    const finish = async () => {
      if (done) return;
      done = true; clearTimeout(downloadTimer); request.signal.removeEventListener('abort', abort);
      await file.close(); await cleanup();
    };
    const abort = () => { streamController?.error(uploadError(408, 'presentation-upload-cancelled')); void finish(); };
    const body = new ReadableStream<Uint8Array>({
      start(controller) { streamController = controller; },
      async pull(controller) {
        if (done) return;
        try {
          const bytes = Buffer.allocUnsafe(Math.min(64 * 1024, size - position));
          const result = await file.read(bytes, 0, bytes.length, position);
          if (done) return;
          if (!result.bytesRead && position !== size) throw workerError(502);
          position += result.bytesRead;
          if (result.bytesRead) controller.enqueue(bytes.subarray(0, result.bytesRead));
          if (position === size) { await finish(); controller.close(); }
        } catch (error) { if (!done) { controller.error(error); await finish(); } }
      },
      cancel: finish,
    }, { highWaterMark: 0 });
    downloadTimer = setTimeout(abort, DOWNLOAD_TIMEOUT);
    request.signal.addEventListener('abort', abort, { once: true });
    if (request.signal.aborted) abort();
    handedOff = true;
    return { body, size };
  } catch (error) {
    if (['ENOSPC', 'EDQUOT'].includes((error as NodeJS.ErrnoException).code || '')) throw uploadError(507, 'presentation-storage-limit');
    throw error;
  } finally { if (!handedOff) await cleanup(); }
}
