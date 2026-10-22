'use client';
import { useI18n } from './I18nProvider';
import { useCoPresentationNavigation } from './CoPresentationNavigation';
export function ScreenShareSettings() {
  const { locale } = useI18n(), controls = useCoPresentationNavigation();
  if (!controls) return null;
  const text = {
    ru: { title: 'Демонстрация экрана', accept: 'Принимать управление автоматически', hint: 'Выключите, чтобы подтверждать передачу управления.' },
    en: { title: 'Screen sharing', accept: 'Accept controls automatically', hint: 'Turn off to confirm control transfers.' },
    'zh-CN': { title: '屏幕共享', accept: '自动接受演示控制权', hint: '关闭后需确认控制权转交。' },
  }[locale];
  return <section className="panel screen-share-settings"><h2>{text.title}</h2><label><input type="checkbox" aria-description={text.hint} checked={controls.autoAccept} disabled={!controls.preferencesReady} onChange={event => controls.setAutoAccept(event.target.checked)} /><span>{text.accept}</span></label><p className="muted">{text.hint}</p></section>;
}
