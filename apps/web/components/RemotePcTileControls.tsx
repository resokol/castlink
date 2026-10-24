'use client';
import { useEffect, useRef, useState } from 'react';
import { useI18n } from './I18nProvider';
import type { useRemotePcTile } from '@/lib/use-remote-pc-tile';
export function RemotePcTileControls({ control }: {
    control: ReturnType<typeof useRemotePcTile>;
}) {
    const { locale } = useI18n(), [value, setValue] = useState(''), [error, setError] = useState(false), [sending, setSending] = useState(false), composing = useRef(false), flight = useRef(false), details = useRef<HTMLDetailsElement>(null), editor = useRef<HTMLTextAreaElement>(null);
    const position = () => { const panel = details.current?.querySelector<HTMLElement>(':scope > div'), summary = details.current?.querySelector('summary'); if (!details.current?.open || !panel || !summary)
        return; const anchor = summary.getBoundingClientRect(), box = panel.getBoundingClientRect(); const left = Math.max(8, Math.min(innerWidth - box.width - 8, anchor.right - box.width)), below = anchor.bottom + 8, top = below + box.height <= innerHeight - 8 ? below : Math.max(8, Math.min(anchor.top - box.height - 8, innerHeight - box.height - 8)); Object.assign(panel.style, { left: left + 'px', top: top + 'px', right: 'auto', bottom: 'auto' }); };
    useEffect(() => { position(); const panel = details.current?.querySelector<HTMLElement>(':scope > div'), observer = typeof ResizeObserver === 'undefined' ? undefined : new ResizeObserver(position); if (panel)
        observer?.observe(panel); window.addEventListener('resize', position); window.addEventListener('scroll', position, true); return () => { observer?.disconnect(); window.removeEventListener('resize', position); window.removeEventListener('scroll', position, true); }; }, [locale, control.available, control.pending]);
    const text = locale === 'en' ? { menu: 'PC control', ended: 'The request ended without control. You can ask the owner again.', finished: 'Input stopped. Waiting for control to finish.', finishFailed: 'Input stopped locally. Retry Finish; video continues.', request: 'Request PC control', pending: 'Request sent — waiting for owner', finish: 'Finish controlling', click: 'Click the video to enable input', active: 'You control this PC', paused: 'Input paused — click video after recovery', scope: 'Control covers the full PC, including when only one window is shown. Reserved system shortcuts and secure screens may be unavailable.', editor: 'Committed text (including IME)', send: 'Send text', failed: 'Action unavailable. Click the video again and release held keys.', unsupported: 'The owner must share through an updated CastLink Windows client to enable PC control.', controller: 'Controller' } : locale === 'zh-CN' ? { menu: '电脑控制', ended: '请求已结束，尚未获得控制权。您可以再次向共享者请求。', finished: '输入已停止，正在等待结束控制。', finishFailed: '本地输入已停止。请重试结束控制，视频仍在继续。', request: '请求控制电脑', pending: '请求已发送，等待共享者确认', finish: '结束控制', click: '点击视频以启用输入', active: '您正在控制电脑', paused: '输入已暂停，恢复后请再次点击视频', scope: '控制权限覆盖整台电脑，即使仅共享一个窗口。部分系统快捷键和安全桌面可能不可用。', editor: '确认的文本（支持输入法）', send: '发送文本', failed: '操作不可用。请再次点击视频并松开按键。', unsupported: '共享者需要使用最新的 CastLink Windows 客户端才能启用电脑控制。', controller: '控制者' } : { menu: 'Управление ПК', ended: 'Запрос завершён без передачи управления. Можно запросить снова.', finished: 'Ввод остановлен. Ждём завершения управления.', finishFailed: 'Ввод остановлен локально. Повторите завершение управления; видео продолжается.', request: 'Запросить управление ПК', pending: 'Запрос отправлен — ждём владельца', finish: 'Завершить управление', click: 'Нажмите на видео для ввода', active: 'Вы управляете ПК', paused: 'Ввод приостановлен — после восстановления нажмите на видео', scope: 'Управление распространяется на весь ПК, даже при показе одного окна. Системные сочетания и защищённый рабочий стол могут быть недоступны.', editor: 'Подтверждённый текст (включая IME)', send: 'Отправить текст', failed: 'Действие недоступно. Нажмите на видео снова и отпустите клавиши.', unsupported: 'Для управления владелец должен показывать экран через обновлённый Windows-клиент CastLink.', controller: 'Управляет' };
    if (!control.available && !control.requestable)
        return null;
    const commit = async () => { if (composing.current || flight.current || !value)
        return; flight.current = true;
        // Keep the existing input latch inside this surface when Send is disabled.
        if (control.active && control.focused) editor.current?.focus({ preventScroll: true });
        setSending(true); setError(false); const draft = value; try {
        await control.text(draft);
        setValue(previous => previous === draft ? '' : previous);
    }
    catch {
        setError(true);
    }
    finally {
        flight.current = false;
        setSending(false);
    } };
    return <><span className="remote-pc-input-status" role="status">{control.available ? (control.userPaused ? text.finished : control.active && !control.paused ? (control.focused ? text.active : text.click) : text.paused) : control.pending ? text.pending : control.controllerName ? `${text.controller}: ${control.controllerName}` : text.menu}</span>
 <details ref={details} className="remote-pc-commands" onToggle={position} onKeyDown={event => { if (event.key === 'Escape' && details.current) {
        details.current.open = false;
        details.current.querySelector('summary')?.focus();
        event.stopPropagation();
    } }}><summary>{text.menu}</summary><div>
  <p>{text.scope}</p>
  {control.requestEnded && !control.pending && !control.available && <small role="status">{text.ended}</small>}
  {!control.available && <button type="button" className="button-secondary" disabled={control.busy || control.pending} onClick={() => void control.request()}>{control.pending ? text.pending : text.request}</button>}
  {control.available && <><button type="button" className="button-secondary" disabled={control.busy} onClick={() => void control.stop()}>{text.finish}</button>
   <form onSubmit={event => { event.preventDefault(); if (!composing.current)
            void commit(); }}><label>{text.editor}<textarea ref={editor} value={value} maxLength={4096} onCompositionStart={() => { composing.current = true; }} onCompositionEnd={() => { composing.current = false; }} onKeyDown={event => { if ((composing.current || event.nativeEvent.isComposing) && event.key === 'Enter')
            event.stopPropagation(); }} onChange={event => setValue(event.target.value)}/></label><button type="submit" className="button-secondary" disabled={!control.active || !control.focused || !value || sending}>{text.send}</button></form>
   {['Alt+Tab', 'Win+D'].map((label, index) => <button key={label} type="button" className="button-secondary" disabled={!control.active || !control.focused} onClick={() => void control.chord(index ? ['MetaLeft', 'KeyD'] : ['AltLeft', 'Tab']).catch(() => setError(true))}>{label}</button>)}
  </>}
  {(error || control.error) && <small role="alert">{!control.sourceAvailable ? text.unsupported : control.userPaused ? text.finishFailed : text.failed}</small>}
 </div></details></>;
}
