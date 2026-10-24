'use client';
import {useState} from 'react';
import type {RemotePublisherControls} from '@/lib/remote-pc-publisher';
import styles from './RemotePcFloatingControls.module.css';

const labels = {
  ru:{title:'Демонстрация экрана',choose:'Выберите кастера',transfer:'Передать управление ПК',revoke:'Забрать управление ПК',stop:'Остановить показ экрана',local:'Вы управляете',controller:'Управляет: ',pending:'Ждём подтверждения ПК…',stopping:'Останавливаем показ…',waiting:'Ожидаем исходную комнату CastLink…',keepOpen:'Оставьте исходную комнату CastLink открытой. Остановить показ можно здесь в любое время.',paused:'Управление приостановлено',pointerPaused:'Указатель приостановлен; клавиатура доступна',scopeTitle:'Доступ к ПК',scope:'Полное управление мышью и клавиатурой ПК. Ваш локальный ввод сохраняется. Показ окна не ограничивает доступ к ПК этим окном.',more:'Остальные кастеры доступны в управлении демонстрацией во вкладке комнаты.',error:'Действие не подтверждено. Показ продолжается.',shortcut:'Забрать управление ПК — прекратить ввод, продолжая показ. Остановить показ экрана — завершить показ и ввод. Дополнительно: Ctrl + Alt + Shift + F8 в обновлённом клиенте Windows; работа сочетания здесь не подтверждена. В старых компонентах используйте кнопку остановки.'},
  en:{title:'Screen sharing',choose:'Choose caster',transfer:'Give PC control',revoke:'Reclaim PC control',stop:'Stop sharing',local:'You control',controller:'Controlled by: ',pending:'Waiting for the PC to confirm…',stopping:'Stopping sharing…',waiting:'Waiting for the original CastLink room…',keepOpen:'Keep the original CastLink room open. You can stop sharing here at any time.',paused:'PC control is paused',pointerPaused:'Pointer paused; keyboard available',scopeTitle:'PC access',scope:'Full PC mouse and keyboard control. You keep local control. Sharing a window does not limit PC access to that window.',more:'Choose other casters in screen sharing controls in the room tab.',error:'Action was not confirmed. Video continues.',shortcut:'Reclaim PC control ends input and keeps sharing. Stop sharing ends sharing and input. Additional shortcut in updated Windows clients: Ctrl + Alt + Shift + F8; its operation was not verified here. In older components, use the Stop sharing button.'},
  'zh-CN':{title:'屏幕共享',choose:'选择参与者',transfer:'授予电脑控制权',revoke:'收回电脑控制权',stop:'停止共享',local:'由您控制',controller:'控制者：',pending:'等待电脑确认…',stopping:'正在停止共享…',waiting:'正在等待原始 CastLink 房间…',keepOpen:'请保持原始 CastLink 房间打开。您随时可以在此停止共享。',paused:'电脑控制已暂停',pointerPaused:'指针已暂停；键盘可用',scopeTitle:'电脑访问权限',scope:'授予完整电脑的鼠标和键盘控制权。您仍可本地操作。共享窗口不会将电脑访问权限限制在该窗口内。',more:'请在房间标签页的屏幕共享控制中选择其他参与者。',error:'操作未确认。视频仍在继续。',shortcut:'收回电脑控制权会停止输入并继续共享；停止共享会结束共享和输入。新版 Windows 客户端的附加快捷键为 Ctrl + Alt + Shift + F8；此处尚未验证其是否有效。旧版组件请使用停止共享按钮。'},
};
const nativeMessages: Record<string,[string,string]> = {
  'Выберите экран или окно в компоненте CastLink.':['Choose a screen or window in the CastLink component.','请在 CastLink 组件中选择屏幕或窗口。'],
  'Откройте демонстрацию кнопкой в комнате CastLink.':['Start screen sharing from the CastLink room.','请通过 CastLink 房间按钮开始屏幕共享。'],
  'Не удалось начать показ. Повторите действие в комнате CastLink.':['Could not start sharing. Try again in the CastLink room.','无法开始共享。请在 CastLink 房间中重试。'],
  'Открываем выбранный источник…':['Opening the selected source…','正在打开所选来源…'],
  'Показ продолжается. Управление приостановлено.':['Video continues. PC control is paused.','视频仍在继续。电脑控制已暂停。'],
  'Показ продолжается. Указатель приостановлен; клавиатура доступна.':['Video continues. Pointer paused; keyboard available.','视频仍在继续。指针已暂停；键盘可用。'],
  'Демонстрация остановлена':['Screen sharing stopped','屏幕共享已停止'],
  'Экран демонстрируется. Локальное управление сохранено.':['Screen sharing is on. You keep local control.','正在共享屏幕。您仍可本地操作。'],
  'Показ продолжается. Геометрия управления недоступна.':['Video continues. Input mapping is unavailable.','视频仍在继续。输入坐标映射不可用。'],
};
function nativeStatus(value: string, locale: keyof typeof labels) {
  if (locale === 'ru') return value;
  const audio = ' Звук PowerPoint недоступен.', base = value.endsWith(audio) ? value.slice(0,-audio.length) : value;
  return (nativeMessages[base]?.[locale === 'en' ? 0 : 1] || base) + (base === value ? '' : locale === 'en' ? ' PowerPoint audio unavailable.' : ' PowerPoint 音频不可用。');
}

/** Same owner authorization as the room controls, displayed by the existing
 * publisher window. This component can emit UI intent only; Stop is local. */
export function RemotePcFloatingControls({controls,locale='ru',status,onStop}: {
  controls: RemotePublisherControls | undefined; locale?: keyof typeof labels;
  status: string; onStop(): void | Promise<void>;
}) {
  const [selected,setSelected] = useState('');
  const state = controls?.state, language = state?.locale || locale, text = labels[language];
  const fresh = !!state && state.expiresAt > Date.now();
  const controller = fresh ? state.casters.find(p => p.sid === selected) : undefined;
  const pending = !!state && ['activating','revoking','stopping'].includes(state.status);
  const blocked = !fresh || !!state?.busy || pending;
  const current = !fresh ? text.waiting : state.status === 'stopping' ? text.stopping : pending ? text.pending : state.status === 'active' ? state.source.inputState === 'paused' ? `${text.paused} · ${state.controller?.name || ''}` : `${text.controller}${state.controller?.name || ''}` : text.local;
  return <section className={styles.panel} aria-label={text.title}>
    <header><h1 title={state?.source.name}>{state?.source.name || text.title}</h1><p className={styles.current} role="status">{current}</p></header>
    <p className={styles.status}>{nativeStatus(status,language)}</p>
    <label className={styles.selector}>{text.choose}<select value={controller?.sid || ''} disabled={blocked} onChange={event => setSelected(event.target.value)}><option value="">{text.choose}</option>{state?.casters.map(p => <option key={p.sid} value={p.sid}>{p.name}</option>)}</select></label>
    <div className={styles.actions}>
      <button type="button" className={styles.transfer} disabled={blocked || !controller} onClick={() => { if (controller) controls?.action('delegate',{identity:controller.identity,sid:controller.sid}); }}>{text.transfer}</button>
      {state?.controller && <button type="button" disabled={blocked} onClick={() => { controls?.action('revoke'); }}>{text.revoke}</button>}
    </div>
    <button type="button" className={styles.stop} onClick={onStop}>{text.stop}</button>
    {fresh && state.status === 'active' && state.source.inputState === 'ready' && !state.source.pointerReady && <p className={styles.note}>{text.pointerPaused}</p>}
    {state?.error && <p className={styles.error} role="alert">{text.error}</p>}
    {!fresh && <p className={styles.note}>{text.keepOpen}</p>}
    {state?.moreCasters && <p className={styles.note}>{text.more}</p>}
    <div className={styles.footer}><details><summary>{text.scopeTitle}</summary><p>{text.scope}</p></details><small>{text.shortcut}</small></div>
  </section>;
}
