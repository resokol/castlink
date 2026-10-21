'use client';

import { useEffect, useId, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { RoomEvent, type Room } from 'livekit-client';
import { useI18n } from './I18nProvider';
import { advanceSpeaker, primarySceneSource, sceneGallery, sceneRail, sceneSplit, SPEAKER_HOLD_MS, type SceneSource, type SpeakerState } from '@/lib/conference-scene';
import styles from './ConferenceScene.module.css';

export type ConferenceSceneItem = SceneSource & { node: ReactNode; hidden?: boolean; secondaryOnly?: boolean };
const STORAGE = 'castlink.conference-scene.v1';
const copy = {
  ru: { speaker:'Окно', tiles:'Плитка', mode:'Вид сцены', settings:'Настройки вида', auto:'Автоматически выбирать спикера', hint:'Смена после секунды устойчивой активности. Презентация всегда остаётся на сцене.', divider:'Размер сцены и панели участников', empty:'Ожидание участников…' },
  en: { speaker:'Windows', tiles:'Tiles', mode:'Stage layout', settings:'View settings', auto:'Automatically select the speaker', hint:'Switch after one second of sustained activity. Shared content stays on stage.', divider:'Stage and participant panel size', empty:'Waiting for participants…' },
  'zh-CN': { speaker:'窗口', tiles:'平铺', mode:'舞台布局', settings:'视图设置', auto:'自动选择发言人', hint:'持续活跃一秒后切换。共享内容始终保留在舞台上。', divider:'舞台和参与者面板大小', empty:'等待参与者…' },
};

/** A single keyed tile layer keeps every video mounted when focus or mode changes. */
export function ConferenceScene({ items, room, className = '', pinnedId }: { items: readonly ConferenceSceneItem[]; room?: Room; className?: string; pinnedId?: string }) {
  const { locale } = useI18n(), text = copy[locale];
  const id = useId();
  const [mode, setMode] = useState<'speaker'|'tiles'>('speaker');
  const [automatic, setAutomatic] = useState(true), [split, setSplit] = useState(0.76), [ready,setReady] = useState(false);
  const [speaker, setSpeaker] = useState('');
  const [primary, setPrimary] = useState('');
  const [mobile, setMobile] = useState(false), [portraitWindow,setPortraitWindow] = useState(false);
  const [size, setSize] = useState({ width: 960, height: 540 });
  const viewport = useRef<HTMLDivElement>(null);
  const state = useRef<SpeakerState>({ selected:'',candidate:'',since:0 });
  const dragging = useRef<number | undefined>(undefined);
  const visibleItems = items.filter(item => !item.hidden && !item.secondaryOnly);
  const roster = JSON.stringify([...new Set(visibleItems.filter(item => item.kind === 'camera').map(item => item.identity))]);
  const sourceKey = JSON.stringify(visibleItems.map(({id,identity,kind}) => [id,identity,kind]));
  useEffect(() => {
    try { const value = JSON.parse(localStorage.getItem(STORAGE) || '{}');
      if (value.mode === 'speaker' || value.mode === 'tiles') setMode(value.mode);
      if (typeof value.automatic === 'boolean') setAutomatic(value.automatic);
      setSplit(sceneSplit(value.split));
    } catch { /* Private browsing and malformed saved choices use defaults. */ }
    setReady(true);
  }, []);
  useEffect(() => { if (ready) try { localStorage.setItem(STORAGE, JSON.stringify({ mode, automatic, split })); } catch { /* Layout works without storage. */ } }, [mode,automatic,split,ready]);
  useEffect(() => {
    const query = window.matchMedia('(max-width:700px), (max-height:600px) and (orientation:landscape) and (pointer:coarse)');
    const update = () => { setMobile(query.matches); setPortraitWindow(window.innerHeight >= window.innerWidth); };
    update(); query.addEventListener('change', update); window.addEventListener('resize', update);
    return () => { query.removeEventListener('change', update); window.removeEventListener('resize', update); };
  }, []);
  useEffect(() => {
    const element = viewport.current;
    if (!element || typeof ResizeObserver === 'undefined') return;
    const update = () => { const style = getComputedStyle(element); const width = element.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight), height = element.clientHeight - parseFloat(style.paddingTop) - parseFloat(style.paddingBottom); if (width > 0 && height > 0) setSize(old => old.width === width && old.height === height ? old : { width,height }); };
    const observer = new ResizeObserver(update); observer.observe(element); update();
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    const available: string[] = JSON.parse(roster);
    let timer: ReturnType<typeof setTimeout> | undefined;
    let active: string[] = [];
    const advance = () => {
      if (timer) clearTimeout(timer);
      const now = performance.now();
      state.current = advanceSpeaker(state.current, automatic ? active : [], available, now);
      setSpeaker(state.current.selected);
      if (state.current.candidate) timer = setTimeout(advance, Math.max(1, SPEAKER_HOLD_MS - (now - state.current.since)));
    };
    const update = () => { active = room?.activeSpeakers.filter(p => !p.isMicrophoneEnabled ? false : available.includes(p.identity)).map(p => p.identity) || []; advance(); };
    room?.on(RoomEvent.ActiveSpeakersChanged,update);
    room?.on(RoomEvent.ParticipantDisconnected,update);
    update();
    return () => { if (timer) clearTimeout(timer); room?.off(RoomEvent.ActiveSpeakersChanged,update); room?.off(RoomEvent.ParticipantDisconnected,update); };
  }, [room, roster, automatic]);
  useEffect(() => { setPrimary(old => primarySceneSource(visibleItems, automatic ? speaker : '', old, pinnedId)); }, [sourceKey,speaker,automatic,pinnedId]);
  const focused = visibleItems.find(item => item.id === primary) || visibleItems[0];
  const others = visibleItems.filter(item => item.id !== focused?.id);
  const portrait = mobile && portraitWindow;
  const gallery = sceneGallery(visibleItems.length,size.width,size.height);
  const railCount = Math.max(1,others.length);
  const focusedMode = mode === 'speaker' && !!focused;
  const solo = focusedMode && others.length === 0;
  const resizable = focusedMode && !solo && !mobile && focused.kind === 'screen';
  const allocation = resizable ? split : 0.76;
  const rail = sceneRail(size.width,size.height,railCount,allocation,portrait);
  const divider = resizable ? 12 : 0;
  const mainHeight = Math.max(0, (size.height - 16) * allocation);
  // Desktop keeps the owner-selected proportional filmstrip; mobile keeps its compact rail.
  const canvasStyle: CSSProperties = !mobile && focusedMode && !solo ? {
    gridTemplateColumns:`minmax(0,1fr) ${divider}px ${rail.tileWidth}px`,
    gridTemplateRows:`repeat(${railCount},${rail.tileHeight}px)`, height:rail.height,
  } : solo ? { gridTemplateColumns:'minmax(0,1fr)', gridTemplateRows:'minmax(0,1fr)' } : focusedMode ? portrait ? {
    gridTemplateColumns:`repeat(${railCount},minmax(110px,1fr))`, gridTemplateRows:`${mainHeight}px minmax(0,1fr)`,
  } : {
    gridTemplateColumns:`minmax(0,${allocation}fr) ${divider}px minmax(0,${1-allocation}fr)`,
    gridTemplateRows:`repeat(${railCount},minmax(90px,1fr))`,
  } : { gridTemplateColumns:`repeat(${gallery.columns},${gallery.tileWidth}px)`,gridAutoRows:`${gallery.tileHeight}px`,alignContent:'center',justifyContent:'center' };
  const resize = (x: number, y: number) => {
    const rect = viewport.current?.getBoundingClientRect(); if (!rect) return;
    setSplit(sceneSplit(portrait ? (y-rect.top)/rect.height : (x-rect.left)/rect.width));
  };
  return <section className={`${styles.scene} ${className}`} data-scene-mode={mode} data-scene-portrait={portrait} data-scene-mobile={mobile} data-scene-resizable={resizable}>
    <header className={styles.toolbar}>
      <div className={styles.modes} role="group" aria-label={text.mode}>
        <button type="button" aria-pressed={mode === 'speaker'} onClick={() => setMode('speaker')}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="12" height="14" rx="2"/><path d="M17 3v4m0 3v3m0 2v2"/></svg>{text.speaker}</button>
        <button type="button" aria-pressed={mode === 'tiles'} onClick={() => setMode('tiles')}><svg viewBox="0 0 20 20" aria-hidden="true"><rect x="2" y="3" width="6" height="6" rx="1"/><rect x="12" y="3" width="6" height="6" rx="1"/><rect x="2" y="12" width="6" height="6" rx="1"/><rect x="12" y="12" width="6" height="6" rx="1"/></svg>{text.tiles}</button>
      </div>
      <details className={styles.settings}><summary aria-label={text.settings} title={text.settings}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M3 5h14M3 10h14M3 15h14"/><circle cx="7" cy="5" r="2"/><circle cx="13" cy="10" r="2"/><circle cx="8" cy="15" r="2"/></svg></summary><div><label htmlFor={id}><input id={id} type="checkbox" checked={automatic} onChange={event => setAutomatic(event.target.checked)} />{text.auto}</label><p>{text.hint}</p></div></details>
    </header>
    <div ref={viewport} className={styles.viewport} tabIndex={0} aria-label={text.mode}>
      <div className={`${styles.canvas} ${focusedMode ? styles.focus : styles.gallery}`} style={canvasStyle}>
        {items.map(item => {
          const main = focusedMode && item.id === focused?.id, index = others.findIndex(other => other.id === item.id);
          const position: CSSProperties = !focusedMode ? {} : solo ? {gridColumn:1,gridRow:1} : main ? portrait ? { gridColumn:'1 / -1',gridRow:1,width:size.width,height:mainHeight,position:'sticky',left:0 } : { gridColumn:1,gridRow:`1 / span ${railCount}`,height:size.height,position:'sticky',top:0,alignSelf:'start' } : portrait ? {gridColumn:index+1,gridRow:2} : {gridColumn:3,gridRow:index+1};
          return <div key={item.id} className={`${styles.tile} ${main ? styles.primary : ''}`} data-scene-primary={main || undefined} data-scene-source={item.kind} hidden={item.hidden} data-scene-preview={item.secondaryOnly || undefined} style={item.hidden ? { display: 'none' } : item.secondaryOnly ? {position:'absolute',right:8,bottom:8,width:'clamp(110px,22%,220px)',height:'auto',aspectRatio:'16 / 9',zIndex:4} : position}>{item.node}</div>;
        })}
        {resizable && <div className={styles.separator} role="separator" tabIndex={0} aria-label={text.divider} aria-orientation={portrait ? 'horizontal' : 'vertical'} aria-valuemin={50} aria-valuemax={88} aria-valuenow={Math.round(split*100)} style={{gridColumn:2,gridRow:`1 / span ${railCount}`,height:size.height,position:'sticky',top:0}} onPointerDown={event => { if (!resizable || event.button !== 0) return; dragging.current=event.pointerId; event.currentTarget.setPointerCapture(event.pointerId); event.preventDefault(); }} onPointerMove={event => { if (dragging.current === event.pointerId) resize(event.clientX,event.clientY); }} onPointerUp={event => { if (dragging.current === event.pointerId) { dragging.current=undefined; if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId); } }} onPointerCancel={() => { dragging.current=undefined; }} onLostPointerCapture={() => { dragging.current=undefined; }} onKeyDown={event => {
          const delta = portrait ? event.key === 'ArrowDown' ? .02 : event.key === 'ArrowUp' ? -.02 : 0 : event.key === 'ArrowRight' ? .02 : event.key === 'ArrowLeft' ? -.02 : 0;
          if (delta || event.key === 'Home' || event.key === 'End') { event.preventDefault(); setSplit(old => sceneSplit(event.key === 'Home' ? .5 : event.key === 'End' ? .88 : old+delta)); }
        }}><span /></div>}
      </div>
      {!visibleItems.length && <p className={styles.empty}>{text.empty}</p>}
    </div>
  </section>;
}
