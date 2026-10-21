import { open, unlink } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MAX_PRESENTATION_UPLOAD, PRESENTATION_UPLOAD_TIMEOUT } from './presentation-upload-limits';

export class PresentationFileError extends Error {
  constructor(public status: number, message: string, public code?: string) { super(message); }
}
export function uploadError(status: number, code: string): PresentationFileError {
  const messages: Record<string, string> = {
    'presentation-upload-invalid': 'Не удалось прочитать файл PPTX. Выберите файл повторно.',
    'presentation-upload-limit': 'PDF/PPTX должен быть не больше 1,5 ГБ.',
    'presentation-upload-timeout': 'Загрузка файла заняла слишком много времени.',
    'presentation-upload-cancelled': 'Загрузка файла отменена.',
    'presentation-storage-limit': 'Недостаточно временного места для презентации. Освободите место на сервере и повторите.',
  };
  return new PresentationFileError(status, messages[code] || 'Не удалось обработать презентацию.', code);
}
const invalid = () => uploadError(400, 'presentation-upload-invalid');
const framingLimit = 16 * 1024;

/** Single-file multipart parser. Only bounded headers and the possible boundary suffix stay in memory. */
export async function savePresentationUpload(request: Request, directory: string): Promise<{ path: string; size: number }> {
  const type = request.headers.get('content-type') || '';
  const match = /^multipart\/form-data;\s*boundary=(?:"([A-Za-z0-9'()+_,./:=? -]{1,70})"|([A-Za-z0-9'()+_,./:=?-]{1,70}))\s*$/i.exec(type);
  const length = request.headers.get('content-length');
  if (length !== null && (!/^\d+$/.test(length) || !Number.isSafeInteger(Number(length)))) throw invalid();
  if (length !== null && Number(length) > MAX_PRESENTATION_UPLOAD + framingLimit) throw uploadError(413, 'presentation-upload-limit');
  if (!match || !request.body) throw invalid();
  const boundary = match[1] || match[2];
  const initial = Buffer.from('--' + boundary + '\r\n');
  const marker = Buffer.from('\r\n--' + boundary);
  const reader = request.body.getReader();
  const path = join(directory, 'input-' + randomUUID() + '.pptx');
  const file = await open(path, 'wx', 0o600).catch(error => {
    void reader.cancel().catch(() => {});
    if (['ENOSPC', 'EDQUOT'].includes(error.code || '')) throw uploadError(507, 'presentation-storage-limit');
    throw error;
  });
  let pending = Buffer.alloc(0), received = 0, size = 0, header = false, ended = false, complete = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let idle: ReturnType<typeof setTimeout> | undefined;
  let failure: PresentationFileError | undefined;
  const stop = (error: PresentationFileError) => {
    failure ||= error;
    // Cancel closes pending reads immediately without retaining a promise reaction per chunk.
    void reader.cancel().catch(() => {});
  };
  const abort = () => stop(uploadError(408, 'presentation-upload-cancelled'));
  timer = setTimeout(() => stop(uploadError(408, 'presentation-upload-timeout')), PRESENTATION_UPLOAD_TIMEOUT);
  request.signal.addEventListener('abort', abort, { once: true });
  const write = async (bytes: Buffer) => {
    size += bytes.length;
    if (size > MAX_PRESENTATION_UPLOAD) throw uploadError(413, 'presentation-upload-limit');
    let offset = 0;
    while (offset < bytes.length) {
      const result = await file.write(bytes, offset, bytes.length - offset);
      if (!result.bytesWritten) throw uploadError(507, 'presentation-storage-limit');
      offset += result.bytesWritten;
    }
  };
  try {
    if (request.signal.aborted) throw uploadError(408, 'presentation-upload-cancelled');
    while (true) {
      if (failure) throw failure;
      idle = setTimeout(() => stop(uploadError(408, 'presentation-upload-timeout')), 30_000);
      const chunk = await reader.read();
      if (failure) throw failure;
      clearTimeout(idle);
      if (chunk.done) break;
      received += chunk.value.byteLength;
      if (received > MAX_PRESENTATION_UPLOAD + framingLimit) throw uploadError(413, 'presentation-upload-limit');
      // Web/Node request chunks are bounded by their transport; split also protects synthetic sources.
      for (let offset = 0; offset < chunk.value.byteLength; offset += 64 * 1024) {
        pending = Buffer.concat([pending, Buffer.from(chunk.value.buffer, chunk.value.byteOffset + offset, Math.min(64 * 1024, chunk.value.byteLength - offset))]);
        if (!header) {
          const end = pending.indexOf('\r\n\r\n');
          if (end < 0) { if (pending.length > framingLimit) throw invalid(); continue; }
          if (end > framingLimit || !pending.subarray(0, initial.length).equals(initial)) throw invalid();
          const lines = pending.subarray(initial.length, end).toString('utf8').split('\r\n');
          const fields = new Map<string, string>();
          for (const line of lines) {
            const field = /^([a-z-]+):\s*([^\r\n]*)$/i.exec(line);
            if (!field || fields.has(field[1].toLowerCase())) throw invalid();
            fields.set(field[1].toLowerCase(), field[2]);
          }
          const disposition = /^form-data;\s*name="file";\s*filename="([^"\\/\x00-\x1f]+\.pptx)"\s*$/i.exec(fields.get('content-disposition') || '');
          if (!disposition || [...fields.keys()].some(key => !['content-disposition', 'content-type'].includes(key))) throw invalid();
          pending = pending.subarray(end + 4); header = true;
        }
        if (ended) { if (pending.length > 2) throw invalid(); continue; }
        let cursor = 0, candidate = -1;
        while ((candidate = pending.indexOf(marker, cursor)) >= 0) {
          const suffix = candidate + marker.length;
          if (pending.length < suffix + 2) break;
          if (pending.subarray(suffix, suffix + 2).equals(Buffer.from('--'))) {
            await write(pending.subarray(0, candidate));
            pending = pending.subarray(suffix + 2); ended = true; break;
          }
          // A second part is forbidden. Other prefixes may occur in the document itself.
          if (pending.subarray(suffix, suffix + 2).equals(Buffer.from('\r\n'))) throw invalid();
          cursor = candidate + 1;
        }
        if (!ended) {
          const keep = marker.length + 1;
          if (pending.length > keep) {
            const flush = pending.length - keep;
            await write(pending.subarray(0, flush)); pending = pending.subarray(flush);
          }
        }
        if (ended && pending.length > 2) throw invalid();
      }
    }
    if (!header || !ended || (pending.length !== 0 && !pending.equals(Buffer.from('\r\n'))) || (length !== null && received !== Number(length))) throw invalid();
    complete = true;
    return { path, size };
  } catch (error) {
    if (error instanceof PresentationFileError) throw error;
    if (['ENOSPC', 'EDQUOT'].includes((error as NodeJS.ErrnoException).code || '')) throw uploadError(507, 'presentation-storage-limit');
    throw invalid();
  } finally {
    clearTimeout(timer); clearTimeout(idle); request.signal.removeEventListener('abort', abort);
    void reader.cancel().catch(() => {});
    await file.close();
    if (!complete) await unlink(path).catch(() => {});
  }
}
