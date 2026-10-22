'use client';
import { useI18n } from './I18nProvider';
import { useCoPresentationNavigation } from './CoPresentationNavigation';
export function ScreenShareSettings() {
  const { locale } = useI18n(), controls = useCoPresentationNavigation();
  if (!controls) return null;
  const text = {
    ru: { title: 'Демонстрация экрана', accept: 'Автоматически принимать управление презентацией', hint: 'Когда другой кастер передаст вам управление, стрелки и щелчки по презентации будут доступны сразу. Если выключить, сначала появится запрос «Принять управление».' },
    en: { title: 'Screen sharing', accept: 'Automatically accept presentation controls', hint: 'When another caster gives you controls, presentation arrows and clicks work immediately. When off, you must accept first.' },
    'zh-CN': { title: '屏幕共享', accept: '自动接受演示控制权', hint: '其他参与者授予控制权后，可立即使用方向键和点击翻页。关闭后须先接受。' },
  }[locale];
  return <section className="panel"><h2>{text.title}</h2><label><input type="checkbox" checked={controls.autoAccept} disabled={!controls.preferencesReady} onChange={event => controls.setAutoAccept(event.target.checked)} /> {text.accept}</label><p className="muted">{text.hint}</p></section>;
}
