"use client";

import { useEffect, useRef, useState } from 'react';
import { useI18n } from '@/components/I18nProvider';
import { SLIDE_WIDTH } from "@/lib/self-recording-frame";
import { PdfPresentationViewer } from '@/components/PdfPresentationViewer';
import { MAX_PRESENTATION_UPLOAD } from '@/lib/presentation-upload-limits';

type Props = {
  locked: boolean;
  onSource: (source: HTMLCanvasElement | HTMLVideoElement | null) => void;
  onPending: (pending: boolean) => void;
  onError: (message: string) => void;
};

export function SelfRecordingPresentation({ locked, onSource, onPending, onError }: Props) {
  const { t } = useI18n();
  const [file, setFile] = useState<File | null>(null);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(0);
  const [renderedPage, setRenderedPage] = useState(0);
  const [screenName, setScreenName] = useState('');
  const [pending, setPending] = useState(false);
  const [previewHost, setPreviewHost] = useState<HTMLDivElement | null>(null);
  const picker = useRef<HTMLInputElement>(null);
  const selectedFile = useRef<File | null>(null);
  const request = useRef(0);
  const busy = useRef(false);
  const stopScreen = useRef<(() => void) | null>(null);
  const callbacks = useRef({ locked, onSource, onPending, onError });
  callbacks.current = { locked, onSource, onPending, onError };

  useEffect(() => () => {
    ++request.current;
    selectedFile.current = null;
    stopScreen.current?.();
    callbacks.current.onSource(null);
    callbacks.current.onPending(false);
  }, []);

  function markPending(value: boolean) {
    busy.current = value;
    setPending(value);
    callbacks.current.onPending(value);
  }

  function clearSource() {
    ++request.current;
    stopScreen.current?.();
    selectedFile.current = null;
    setRenderedPage(0);
    setFile(null);
    setPages(0);
    setPage(1);
    setScreenName('');
    callbacks.current.onSource(null);
    markPending(false);
  }

  function openPdf(next: File) {
    if (callbacks.current.locked || busy.current) return;
    if (!next.size || next.size > MAX_PRESENTATION_UPLOAD) {
      callbacks.current.onError(t('Выберите PDF размером до 1,5 ГБ.'));
      return;
    }
    clearSource();
    callbacks.current.onError('');
    selectedFile.current = next;
    setFile(next);
    markPending(true);
  }

  async function chooseScreen() {
    if (callbacks.current.locked || busy.current) return;
    if (!navigator.mediaDevices?.getDisplayMedia) {
      callbacks.current.onError(t('Захват окна или вкладки недоступен в этом браузере.'));
      return;
    }
    const attempt = ++request.current;
    let stopAttempt: (() => void) | undefined;
    markPending(true);
    callbacks.current.onError('');
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      if (attempt !== request.current || callbacks.current.locked) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      // Keep the existing slide/source until the user accepts the browser picker.
      stopScreen.current?.();
      selectedFile.current = null;
      setFile(null);
      setScreenName('');
      callbacks.current.onSource(null);
      const track = stream.getVideoTracks()[0];
      const video = document.createElement('video');
      video.muted = true;
      video.playsInline = true;
      const ended = () => {
        if (stopScreen.current === stop) clearSource();
      };
      const stop = () => {
        stopScreen.current = null;
        track?.removeEventListener('ended', ended);
        stream.getTracks().forEach(item => item.stop());
        video.pause();
        video.srcObject = null;
      };
      stopAttempt = stop;
      stopScreen.current = stop;
      if (!track || track.readyState === 'ended') {
        clearSource();
        callbacks.current.onError(t('Не удалось открыть выбранное окно или вкладку.'));
        return;
      }
      track.addEventListener('ended', ended);
      video.srcObject = stream;
      await video.play();
      if (attempt !== request.current) return;
      if (callbacks.current.locked || track.readyState !== 'live') {
        clearSource();
        return;
      }
      setScreenName(track.label || t('Демонстрация экрана'));
      callbacks.current.onSource(video);
    } catch (cause) {
      if (attempt !== request.current) return;
      if (stopAttempt && stopScreen.current === stopAttempt) clearSource();
      if (cause instanceof DOMException && ['NotAllowedError', 'AbortError'].includes(cause.name)) {
        callbacks.current.onError(t('Выбор экрана отменён или браузер не разрешил захват.'));
      } else {
        callbacks.current.onError(t('Не удалось открыть выбранное окно или вкладку.'));
      }
    } finally {
      if (attempt === request.current) markPending(false);
    }
  }

  function turnPage(delta: number) {
    const next = page + delta;
    if (!selectedFile.current || busy.current || next < 1 || next > pages) return;
    markPending(true);
    setPage(next);
  }

  const controlsLocked = locked || pending;
  return <section className="stack self-recording-presentation" aria-label={t('Источник презентации')} onKeyDown={event => {
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || !file) return;
    if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
      event.preventDefault();
      turnPage(event.key === 'ArrowRight' ? 1 : -1);
    }
  }}>
    <input ref={picker} type="file" hidden accept=".pdf,application/pdf" disabled={controlsLocked} onChange={event => {
      const next = event.currentTarget.files?.[0];
      event.currentTarget.value = '';
      if (next) openPdf(next);
    }} />
    <div className="actions" style={{ flexWrap: 'wrap' }}>
      <button type="button" className="button-secondary" disabled={controlsLocked} onClick={() => picker.current?.click()}>{t('Открыть PDF')}</button>
      <button type="button" className="button-secondary" disabled={controlsLocked} onClick={() => void chooseScreen()}>{t('Показать окно или вкладку')}</button>
      {(file || screenName || pending) && <button type="button" className="button-secondary" disabled={locked} onClick={clearSource}>{t('Убрать презентацию')}</button>}
    </div>
    {file && <>
      <div aria-live="polite" style={{ overflowWrap: 'anywhere' }}>{file.name} · {pages && renderedPage
        ? t('Слайд {page} из {pages}', { page: renderedPage, pages })
        : t('Загрузка PDF…')}</div>
      <div className="actions" style={{ flexWrap: 'wrap' }}>
        <button type="button" className="button-secondary" disabled={pending || page <= 1} onClick={() => turnPage(-1)}>{t('Предыдущий слайд')}</button>
        <button type="button" className="button-secondary" disabled={pending || page >= pages} onClick={() => turnPage(1)}>{t('Следующий слайд')}</button>
      </div>
      <div ref={setPreviewHost} />
      <div hidden><PdfPresentationViewer file={file} page={page} targetWidth={SLIDE_WIDTH} previewHost={!pending && renderedPage === page ? previewHost : null}
        onLoaded={(count, loaded) => { if (selectedFile.current === loaded) setPages(count); }}
        onRendered={(number, loaded) => { if (selectedFile.current === loaded) setRenderedPage(number); }}
        onCanvasReady={(canvas, loaded) => {
          if (selectedFile.current !== loaded) return;
          callbacks.current.onSource(canvas);
          markPending(false);
        }}
        onError={(_message, loaded, failedPage) => {
          if (selectedFile.current !== loaded) return;
          const previous = renderedPage;
          if (failedPage && previous && previous !== failedPage) setPage(previous);
          else clearSource();
          callbacks.current.onError(failedPage ? t('Не удалось показать страницу PDF.') : t('Не удалось открыть PDF.'));
        }}
      /></div>
    </>}
    {screenName && <div style={{ overflowWrap: 'anywhere' }}>{screenName}</div>}
  </section>;
}
