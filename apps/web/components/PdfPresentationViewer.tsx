"use client";

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { useI18n } from '@/components/I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import { toggleElementFullscreen } from '@/lib/fullscreen';
import { MAX_PRESENTATION_UPLOAD } from '@/lib/presentation-upload-limits';

export function PdfPresentationViewer({ file, page, onLoaded, onRendered, onError, onCanvasReady, onProgress }: {
  file: File; page: number;
  onProgress?: (percent: number | undefined, file: File) => void;
  onCanvasReady?: (canvas: HTMLCanvasElement, file: File) => void;
  onLoaded: (pages: number, file: File) => void;
  onRendered: (page: number, file: File) => void;
  onError: (message: string, file: File, page?: number) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onLoaded, onRendered, onError, onCanvasReady, onProgress }); callbacks.current = { onLoaded, onRendered, onError, onCanvasReady, onProgress };
  const [document, setDocument] = useState<{ doc: PDFDocumentProxy; file: File }>();
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(true);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    setDocument(undefined); setError(''); setRendering(true);
    void (async () => {
      try {
        if (!file.size || file.size > MAX_PRESENTATION_UPLOAD) throw new Error('Выберите PDF или PPTX размером не более 1,5 ГБ.');
        const pdfjs = await import('pdfjs-dist');
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        // Read only requested File slices. A 1.5 GB document must not create
        // a full ArrayBuffer in both the page and worker before the first slide.
        const range = new class extends pdfjs.PDFDataRangeTransport {
          requestDataRange(begin: number, end: number) {
            void file.slice(begin, end).arrayBuffer().then(data => {
              if (active) this.onDataRange(begin, new Uint8Array(data));
            }, cause => {
              if (!active) return;
              const message = cause instanceof Error ? cause.message : 'Не удалось открыть PDF.';
              setError(message); callbacks.current.onError(message, file); setRendering(false);
              void task?.destroy();
            });
          }
        }(file.size, new Uint8Array(0));
        task = pdfjs.getDocument({ range, rangeChunkSize: 1024 * 1024, disableAutoFetch: true, disableStream: true, cMapUrl: '/pdfjs/cmaps/', standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', useSystemFonts: true, stopAtErrors: true, enableXfa: false });
        task.onProgress = ({ loaded, total }: { loaded: number; total: number }) => { if (active) callbacks.current.onProgress?.(total > 0 ? Math.min(100, Math.round(loaded * 100 / total)) : undefined, file); };
        const doc = await task.promise;
        if (!active) return;
        setDocument({ doc, file }); callbacks.current.onLoaded(doc.numPages, file);
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : 'Не удалось открыть PDF.';
        setError(message); callbacks.current.onError(message, file); setRendering(false);
      }
    })();
    return () => { active = false; void task?.destroy(); };
  }, [file]);
  useEffect(() => {
    if (!document || document.file !== file || !canvas.current) return;
    let active = true;
    let render: RenderTask | undefined;
    setRendering(true); setError('');
    void (async () => {
      try {
        const pdfPage = await document.doc.getPage(Math.max(1, Math.min(document.doc.numPages, page)));
        if (!active || !canvas.current) return;
        const viewport = pdfPage.getViewport({ scale: 1 });
        const scale = Math.min(2, 1920 / viewport.width, 1080 / viewport.height);
        const output = pdfPage.getViewport({ scale });
        // PDF.js may yield while painting. Keep the previous complete slide on
        // the published canvas until this render can be committed atomically.
        const staged = canvas.current.ownerDocument.createElement('canvas');
        staged.width = Math.ceil(output.width); staged.height = Math.ceil(output.height);
        render = pdfPage.render({ canvas: staged, viewport: output });
        await render.promise;
        if (active && canvas.current) {
          const visible = canvas.current;
          visible.width = staged.width; visible.height = staged.height;
          const context = visible.getContext('2d');
          if (!context) throw new Error('Не удалось показать страницу PDF.');
          context.drawImage(staged, 0, 0);
          setRendering(false); callbacks.current.onRendered(page, file); callbacks.current.onCanvasReady?.(visible, file);
        }
      } catch (cause) {
        if (!active) return;
        const message = cause instanceof Error ? cause.message : 'Не удалось показать страницу PDF.';
        setError(message); callbacks.current.onError(message, file, page); setRendering(false);
      }
    })();
    return () => { active = false; render?.cancel(); };
  }, [document, page, file]);
  return <div className="pdf-presentation-viewer">
    <div ref={frame} className="pdf-presentation-frame" style={{ background: '#111', display: 'grid', placeItems: 'center', padding: 8 }}>
      <canvas ref={canvas} aria-label={`${t('Страница PDF')} ${page}`} style={{ display: 'block', maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }} />
    </div>
    {rendering && <small role="status">{t('Загрузка PDF…')}</small>}
    {error && <p role="alert">{translateWorkspaceMessage(t, error)}</p>}
    <button type="button" className="button-secondary" onClick={() => { if (frame.current) void toggleElementFullscreen(frame.current); }}>{t('Во весь экран')}</button>
  </div>;
}
