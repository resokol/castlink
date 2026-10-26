"use client";
import { useEffect, useRef, useState } from 'react';
import { EntryShell, EntryIcon } from './EntryShell';
import { useI18n } from './I18nProvider';
import { parseGuestInviteUrl, openNativeInvite, isCastLinkDesktop } from '@/lib/entry-links';
import { guestEntrySettings, type GuestEntrySettings } from '@/lib/guest-entry-settings';
import styles from './EntryFlow.module.css';

type ResolvedInvite={room:string;entrySettings:GuestEntrySettings};
export function GuestInviteLanding({href,onContinue,onBack}: {href:string;onContinue:(room:string,settings:GuestEntrySettings)=>void;onBack:()=>void}) {
  const {t}=useI18n();
  const [resolved,setResolved]=useState<ResolvedInvite>();
  const [failure,setFailure]=useState<'invalid'|'network'|''>('');
  const [attempt,setAttempt]=useState(0);
  const [opening,setOpening]=useState(false);
  const [waiting,setWaiting]=useState(false);
  const [native,setNative]=useState(false);
  const [origin,setOrigin]=useState('');
  const openAttempted=useRef(false);
  const nativeFrame=useRef<HTMLIFrameElement | undefined>(undefined);
  // Launch in an isolated browsing context: an absent protocol handler must never
  // replace the invitation page (Chromium can navigate it to chrome-error otherwise).
  const dispatchNative=(target:string)=>{
    nativeFrame.current?.remove();
    const frame=document.createElement('iframe');frame.hidden=true;frame.title='CastLink';frame.setAttribute('aria-hidden','true');frame.src=target;
    document.body.appendChild(frame);nativeFrame.current=frame;
  };
  useEffect(()=>()=>{nativeFrame.current?.remove();},[]);
  const continueRef=useRef(onContinue);continueRef.current=onContinue;
  useEffect(()=>{
    const link=parseGuestInviteUrl(href);
    if(!link || new URL(link.href).origin!==window.location.origin){setFailure('invalid');return;}
    setOrigin(new URL(link.href).host);
    const controller=new AbortController();setFailure('');setResolved(undefined);
    const embedded=isCastLinkDesktop(navigator.userAgent,!!(window as unknown as {castlinkDesktop?:unknown}).castlinkDesktop);
    setNative(embedded);
    const endpoint=link.personal?'/api/guest-admission':'/api/auth';
    const body=link.personal?{action:'resolve',studioId:link.studioId,invite:link.invite}:{kind:'guest',studioId:link.studioId,room:link.room,invite:link.invite};
    void fetch(endpoint,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body),signal:controller.signal,cache:'no-store'})
      .then(async response=>{
        if(!response.ok){if(response.status>=500||response.status===429)throw Error('network');throw Error('invalid');}
        const data=await response.json();
        if(controller.signal.aborted)return;
        const room=link.personal?data.room:link.room;
        if(typeof room!=='string'||!room||(!link.personal&&data.allowed!==true))throw Error('invalid');
        const settings=guestEntrySettings(data.entrySettings);
        setResolved({room,entrySettings:settings});
        if(embedded)continueRef.current(room,settings);
      }).catch(error=>{if(!controller.signal.aborted)setFailure(error.message==='invalid'?'invalid':'network');});
    return()=>controller.abort();
  },[href,attempt]);
  useEffect(()=>{
    if(!resolved||native||openAttempted.current||!/Windows/i.test(navigator.userAgent))return;
    openAttempted.current=true;setOpening(true);
    if(!openNativeInvite(href,dispatchNative)){setOpening(false);setWaiting(true);}
  },[resolved,native,href]);
  useEffect(()=>{
    if(!opening)return;
    const timeout=window.setTimeout(()=>{setOpening(false);setWaiting(true);},2200);
    const returned=()=>{if(document.visibilityState==='visible'){setOpening(false);setWaiting(true);}};
    document.addEventListener('visibilitychange',returned);
    return()=>{clearTimeout(timeout);document.removeEventListener('visibilitychange',returned);};
  },[opening]);
  const openApp=()=>{setOpening(true);setWaiting(false);if(!openNativeInvite(href,dispatchNative)){setOpening(false);setWaiting(true);}};
  if(failure)return <EntryShell><section className={`${styles.card} ${styles.center}`}>
    <div className={styles.inviteIcon}><EntryIcon kind="error"/></div>
    <h1>{t(failure==='invalid'?'Приглашение недействительно':'Не удалось проверить приглашение. Проверьте соединение и повторите.')}</h1>
    {failure==='invalid'?<><p>{t('Ссылка могла истечь или быть отозвана. Попросите студию отправить новое приглашение.')}</p><button className={`${styles.primary} ${styles.full}`} onClick={onBack}>{t('Вставить другое приглашение')}</button></>:<button className={`${styles.primary} ${styles.full}`} onClick={()=>setAttempt(value=>value+1)}>{t('Повторить проверку')}</button>}
    <div className={styles.divided}><button className={styles.textButton} onClick={onBack}>{t('На главную')}</button></div>
  </section></EntryShell>;
  if(!resolved)return <EntryShell><div className={styles.card} role="status">{t('Проверка приглашения…')}</div></EntryShell>;
  return <EntryShell><section className={`${styles.card} ${styles.center}`}>
    <div className={styles.inviteIcon}><EntryIcon kind="link"/></div>
    <h1>{t(opening?'Открываем CastLink…':'Вас пригласили в студию')}</h1><p>{t('Вы подключаетесь как кастер / гость.')}</p>
    <div className={styles.room}><strong>{resolved.room}</strong><small>{t('Сервер')} · {origin}</small></div>
    <button className={`${styles.primary} ${styles.full}`} onClick={openApp}>{t(waiting?'Открыть приложение ещё раз':'Открыть в приложении CastLink')}</button>
    <div className={styles.or}>{t('или')}</div>
    <button className={styles.full} onClick={()=>onContinue(resolved.room,resolved.entrySettings)}>{t('Продолжить в браузере')}</button>
    <div className={styles.note} role="status">{t(waiting?'Приложение не открылось? Продолжите в браузере или повторите открытие.':'Если появится запрос браузера, разрешите открыть CastLink.')}</div>
    <div className={styles.divided}><small>{t('Приложение ещё не установлено?')}</small><br/><a href="https://github.com/resokol/castlink/blob/main/distribution/PRODUCTS.md" target="_blank" rel="noopener noreferrer">{t('Скачать для Windows')}</a></div>
  </section></EntryShell>;
}
