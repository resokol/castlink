"use client";

import { useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy, RenderTask } from 'pdfjs-dist';
import { useI18n } from '@/components/I18nProvider';
import { translateWorkspaceMessage } from '@/lib/i18n/workspaces';
import { toggleElementFullscreen } from '@/lib/fullscreen';

export function PdfPresentationViewer({ file, page, onLoaded, onRendered, onError, onCanvasReady }: {
  file: File; page: number;
  onCanvasReady?: (canvas: HTMLCanvasElement, file: File) => void;
  onLoaded: (pages: number, file: File) => void;
  onRendered: (page: number, file: File) => void;
  onError: (message: string, file: File, page?: number) => void;
}) {
  const { t } = useI18n();
  const canvas = useRef<HTMLCanvasElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const callbacks = useRef({ onLoaded, onRendered, onError, onCanvasReady }); callbacks.current = { onLoaded, onRendered, onError, onCanvasReady };
  const [document, setDocument] = useState<{ doc: PDFDocumentProxy; file: File }>();
  const [error, setError] = useState('');
  const [rendering, setRendering] = useState(true);
  useEffect(() => {
    let active = true;
    let task: ReturnType<typeof import('pdfjs-dist')['getDocument']> | undefined;
    setDocument(undefined); setError(''); setRendering(true);
    void (async () => {
      try {
        if (file.size > 100 * 1024 * 1024) throw new Error('Выберите PDF размером не более 100 МБ.');
        const pdfjs = await import('pdfjs-dist');
        if (!active) return;
        pdfjs.GlobalWorkerOptions.workerSrc = '/pdfjs/pdf.worker.min.mjs';
        const data = new Uint8Array(await file.arrayBuffer());
        if (!active) return;
        task = pdfjs.getDocument({ data, cMapUrl: '/pdfjs/cmaps/', standardFontDataUrl: '/pdfjs/standard_fonts/', wasmUrl: '/pdfjs/wasm/', useSystemFonts: true, stopAtErrors: true, enableXfa: false });
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
