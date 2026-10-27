import { sessionHttpBearer } from "./session-http-bearer";
import { MAX_PRESENTATION_UPLOAD } from './presentation-upload-limits';
export type PresentationFileProgress = { phase: 'uploading' | 'converting' | 'receiving'; percent?: number };
export function validPresentationFile(file: { name: string; size: number }) {
  return /\.(pdf|pptx)$/i.test(file.name) && Number.isSafeInteger(file.size) && file.size > 0 && file.size <= MAX_PRESENTATION_UPLOAD;
}
/** XHR exposes upload progress without copying a large File into JavaScript memory. */
export function convertPresentationFile(options: {
  file: File; endpoint: string; token: string; signal: AbortSignal;
  onProgress?: (progress: PresentationFileProgress) => void;
  createRequest?: () => XMLHttpRequest;
}): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const xhr = options.createRequest?.() || new XMLHttpRequest();
    let settled = false;
    const finish = (error?: unknown, blob?: Blob) => {
      if (settled) return;
      settled = true; options.signal.removeEventListener('abort', abort);
      xhr.onload = xhr.onerror = xhr.onabort = xhr.ontimeout = xhr.onprogress = null;
      xhr.upload.onprogress = xhr.upload.onload = null;
      if (error) reject(error); else resolve(blob!);
    };
    const abort = () => { xhr.abort(); finish(new DOMException('Upload cancelled', 'AbortError')); };
    if (options.signal.aborted) { finish(new DOMException('Upload cancelled', 'AbortError')); return; }
    xhr.open('POST', options.endpoint);
    xhr.setRequestHeader('authorization', `Bearer ${sessionHttpBearer(options.token)}`);
    xhr.responseType = 'blob';
    // Covers slow upload, isolated conversion and download; cancellation remains immediate.
    xhr.timeout = 45 * 60_000;
    const progress = (phase: PresentationFileProgress['phase'], event?: ProgressEvent) => {
      if (!settled && !options.signal.aborted) options.onProgress?.({ phase, percent: event?.lengthComputable && event.total > 0 ? Math.min(100, Math.round(event.loaded * 100 / event.total)) : undefined });
    };
    xhr.upload.onprogress = event => progress('uploading', event);
    xhr.upload.onload = () => progress('converting');
    xhr.onprogress = event => progress('receiving', event);
    xhr.onerror = () => finish(new Error('Не удалось загрузить презентацию. Проверьте соединение и повторите.'));
    xhr.onabort = () => finish(new DOMException('Upload cancelled', 'AbortError'));
    xhr.ontimeout = () => finish(Object.assign(new Error('Загрузка файла заняла слишком много времени.'), { code: 'upload-timeout' }));
    xhr.onload = () => {
      const blob: Blob = xhr.response, status = xhr.status;
      if (status >= 200 && status < 300) {
        if (!blob || !blob.size || blob.size > MAX_PRESENTATION_UPLOAD || !blob.type.includes('application/pdf')) finish(Object.assign(new Error('Не удалось получить корректный PDF от конвертера. Повторите попытку.'), { code: 'invalid-output', status }));
        else finish(undefined, blob);
        return;
      }
      // Error bodies are small JSON. Never decode an unbounded rejected response.
      if (!blob || blob.size > 16_384) { finish(Object.assign(new Error(`Не удалось загрузить презентацию. Повторите попытку.`), { status })); return; }
      void blob.text().then(raw => {
        let detail: { error?: unknown; code?: unknown } = {};
        try { detail = JSON.parse(raw); } catch { /* Preserve HTTP status for proxy errors. */ }
        finish(Object.assign(new Error(typeof detail.error === 'string' && detail.error.length <= 400 ? detail.error : `Не удалось загрузить презентацию. Повторите попытку.`), { status, code: typeof detail.code === 'string' ? detail.code : undefined }));
      }, () => finish(Object.assign(new Error(`Не удалось загрузить презентацию. Повторите попытку.`), { status })));
    };
    options.signal.addEventListener('abort', abort, { once: true });
    const form = new FormData(); form.set('file', options.file);
    progress('uploading');
    try { xhr.send(form); } catch (error) { finish(error); }
  });
}
