"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { BrandIcon } from './BrandIcon';
import { InlineLanguageSwitcher } from './LanguageSwitcher';
import { AppFooterSlot } from './AppChrome';
import { useI18n } from './I18nProvider';
import styles from './EntryFlow.module.css';

export function EntryIcon({kind}: {kind: 'studio' | 'person' | 'link' | 'error' | 'sun'}) {
  const paths = {
    studio: <><rect x="3" y="4" width="18" height="13" rx="2"/><path d="M8 21h8M12 17v4M7 9h2m2 0h2m2 0h2M7 12h6"/></>,
    person: <><circle cx="12" cy="7" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></>,
    link: <path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-2 2M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l2-2"/>,
    error: <><circle cx="12" cy="12" r="9"/><path d="M12 7v6m0 4h.01"/></>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 1v2m0 18v2M1 12h2m18 0h2M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/></>,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[kind]}</svg>;
}
export function EntryShell({children, wide=false, footer}: {children:ReactNode;wide?:boolean;footer?:ReactNode}) {
  const {t}=useI18n();
  const [light,setLight]=useState(false);
  useEffect(()=>{ setLight(document.documentElement.dataset.theme==='light'); },[]);
  return <main className={styles.shell}>
    <header className={styles.header}>
      <a className={styles.brand} href="/" aria-label={t('На главную')}><BrandIcon/><span>CastLink</span></a>
      <div className={styles.tools}><InlineLanguageSwitcher/><button type="button" className={styles.theme} aria-label={t('Переключить тему')} aria-pressed={light} onClick={()=>{
        const next=!light;setLight(next);document.documentElement.dataset.theme=next?'light':'dark';try{localStorage.setItem('studiolink-theme',next?'light':'dark');}catch{}
      }}><EntryIcon kind="sun"/></button><a className={styles.help} href="https://github.com/resokol/castlink-releases/blob/main/GUIDE.md" target="_blank" rel="noopener noreferrer">{t('Помощь')}</a></div>
    </header>
    <div className={wide?styles.wide:styles.body}>{children}</div>
    {footer&&<footer className={styles.footer}>{footer}</footer>}
    <details className={styles.version}><summary>{t("Версия и поддержка")}</summary><AppFooterSlot entry/></details>
  </main>;
}
