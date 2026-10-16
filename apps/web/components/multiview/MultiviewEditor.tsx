"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties, type DragEvent, type PointerEvent } from "react";
import { Room, RoomEvent, Track } from "livekit-client";
import { useI18n } from "@/components/I18nProvider";
import { resolveParticipantRole } from "@/lib/participant-role";
import type { MultiviewScene, MultiviewTile } from "@/lib/multiview";
import { assignTileSource, clampTile, createDraft, gridScene, redoDraft, resizeTile, swapTilePositions, undoDraft, updateDraft, type MultiviewDraft, type ResizeEdge } from "@/lib/multiview-layout";
import MultiviewMedia from "./MultiviewMedia";
import styles from "./MultiviewEditor.module.css";

type Props = { room: Room; studioId: string; roomName: string; viewAccess: string; onClose: () => void };
type Source = { identity: string; name: string; source: MultiviewTile["source"] };
type Session = { draft: MultiviewDraft; saved: MultiviewScene | null };
type Gesture = { id: string; scene: MultiviewScene; tile: MultiviewTile; startX: number; startY: number; width: number; height: number; edge?: ResizeEdge; latest: MultiviewScene };
const sourceKey = (source: Pick<Source, "identity" | "source">) => JSON.stringify([source.identity, source.source]);
const newId = () => crypto.randomUUID();
const formats = [{ label: "16:9", width: 1920, height: 1080 }, { label: "9:16", width: 1080, height: 1920 }, { label: "1:1", width: 1080, height: 1080 }];
const templates = [[2, 1], [3, 1], [2, 2], [3, 2], [3, 3], [4, 4]];
const edges: ResizeEdge[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const words = {
  ru: {title:"Мультивью",close:"Закрыть",scene:"Сцена",newScene:"Новая сцена",name:"Название",format:"Формат",grid:"Сетка",free:"Свободно",columns:"Столбцы",rows:"Строки",build:"Создать сетку",sources:"Источники",sourceHelp:"Перетащите источник в ячейку или выберите его в свойствах.",emptySources:"Гости появятся здесь после подключения.",camera:"Камера",screen:"Экран",offline:"Не в сети",noVideo:"Нет видео",online:"В эфире",properties:"Свойства",slot:"Ячейка",source:"Источник",unassigned:"Не назначен",fit:"Масштаб",contain:"Вписать",cover:"Заполнить",audio:"Звук в выходе",audioOn:"Включён",audioOff:"Выключен",add:"Добавить ячейку",remove:"Удалить ячейку",front:"На передний план",back:"На задний план",select:"Выберите ячейку на холсте",apply:"Применить",applying:"Сохранение…",applied:"Сцена применена",draft:"Есть изменения",saved:"Сохранено",undo:"Отменить",redo:"Повторить",reset:"Вернуть сохранённое",open:"Открыть выход",copy:"Копировать ссылку",copied:"Ссылка скопирована",linkHelp:"Ссылка даёт доступ к медиа этой комнаты, как отдельные видеовыходы. Передавайте её только получателям эфира.",outputHelp:"Выход показывает последнюю применённую сцену. Изменения черновика видны только здесь.",gridHelp:"Перетащите ячейку на другую, чтобы поменять их местами.",freeHelp:"Перемещайте ячейки и тяните маркеры. Стрелки — сдвиг, Shift — крупный шаг.",loading:"Загрузка сцен…",loadError:"Не удалось загрузить сцены.",saveError:"Не удалось применить сцену.",conflict:"Сцена изменена в другой вкладке. Верните сохранённую версию и повторите изменения.",retry:"Повторить",limit:"Не более 32 ячеек и 16 сцен.",gridLimit:"В сетке должно быть от 1 до 32 ячеек.",selected:"Выбрана",empty:"Назначьте источник",position:"Положение и размер, %",preview:"Предпросмотр",unsaved:"Сначала примените сцену",error:"Ошибка",copyError:"Не удалось скопировать ссылку.",changeHelp:"Черновики сохраняются при выборе другой сцены до закрытия редактора."},
  en: {title:"Multiview",close:"Close",scene:"Scene",newScene:"New scene",name:"Name",format:"Format",grid:"Grid",free:"Free layout",columns:"Columns",rows:"Rows",build:"Create grid",sources:"Sources",sourceHelp:"Drag a source into a slot or choose it in properties.",emptySources:"Guests appear here when they connect.",camera:"Camera",screen:"Screen",offline:"Offline",noVideo:"No video",online:"Live",properties:"Properties",slot:"Slot",source:"Source",unassigned:"Unassigned",fit:"Fit",contain:"Contain",cover:"Cover",audio:"Output audio",audioOn:"On",audioOff:"Off",add:"Add slot",remove:"Remove slot",front:"Bring to front",back:"Send to back",select:"Select a slot on the canvas",apply:"Apply",applying:"Saving…",applied:"Scene applied",draft:"Unapplied changes",saved:"Saved",undo:"Undo",redo:"Redo",reset:"Revert to saved",open:"Open output",copy:"Copy link",copied:"Link copied",linkHelp:"This link grants access to this room’s media, just like individual video outputs. Share it only with broadcast recipients.",outputHelp:"Output shows the last applied scene. Draft changes appear only here.",gridHelp:"Drag a slot onto another to swap their positions.",freeHelp:"Move slots and drag their handles. Arrow keys move; Shift uses a larger step.",loading:"Loading scenes…",loadError:"Could not load scenes.",saveError:"Could not apply scene.",conflict:"This scene changed in another tab. Revert to the saved version and edit again.",retry:"Retry",limit:"Maximum 32 slots and 16 scenes.",gridLimit:"A grid must contain 1 to 32 slots.",selected:"Selected",empty:"Assign a source",position:"Position and size, %",preview:"Preview",unsaved:"Apply the scene first",error:"Error",copyError:"Could not copy link.",changeHelp:"Drafts are kept when switching scenes until you close the editor."},
  "zh-CN": {title:"多画面",close:"关闭",scene:"场景",newScene:"新建场景",name:"名称",format:"比例",grid:"网格",free:"自由布局",columns:"列",rows:"行",build:"创建网格",sources:"来源",sourceHelp:"将来源拖入画面，或在属性中选择。",emptySources:"嘉宾连接后会显示在此处。",camera:"摄像头",screen:"屏幕",offline:"离线",noVideo:"无视频",online:"直播中",properties:"属性",slot:"画面",source:"来源",unassigned:"未分配",fit:"缩放",contain:"完整显示",cover:"填充",audio:"输出音频",audioOn:"开启",audioOff:"关闭",add:"添加画面",remove:"删除画面",front:"移到最前",back:"移到最后",select:"在画布上选择画面",apply:"应用",applying:"保存中…",applied:"场景已应用",draft:"有未应用的更改",saved:"已保存",undo:"撤销",redo:"重做",reset:"恢复已保存版本",open:"打开输出",copy:"复制链接",copied:"链接已复制",linkHelp:"此链接与独立视频输出一样，允许访问本房间媒体。请仅分享给直播接收方。",outputHelp:"输出显示上次应用的场景。草稿更改仅在此处可见。",gridHelp:"将一个画面拖到另一个画面以交换位置。",freeHelp:"移动画面并拖动控制点。方向键移动，Shift 加大步长。",loading:"正在加载场景…",loadError:"无法加载场景。",saveError:"无法应用场景。",conflict:"此场景已在另一标签页中更改。请恢复已保存版本后重新编辑。",retry:"重试",limit:"最多 32 个画面和 16 个场景。",gridLimit:"网格必须包含 1 到 32 个画面。",selected:"已选择",empty:"分配来源",position:"位置及尺寸，%",preview:"预览",unsaved:"请先应用场景",error:"错误",copyError:"无法复制链接。",changeHelp:"切换场景时会保留草稿，直到关闭编辑器。"},
};

function blankScene(name: string): MultiviewScene {
  return gridScene({ id: newId(), name, width: 1920, height: 1080, revision: 0, tiles: [] }, 2, 2);
}

export default function MultiviewEditor({ room, studioId, roomName, viewAccess, onClose }: Props) {
  const { locale } = useI18n();
  const c = words[locale];
  const [sessions, setSessions] = useState<Record<string, Session>>({});
  const [sceneId, setSceneId] = useState("");
  const [selectedId, setSelectedId] = useState("");
  const [mode, setMode] = useState<"grid" | "free">("grid");
  const [columns, setColumns] = useState(2);
  const [rows, setRows] = useState(2);
  const [loading, setLoading] = useState(true);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [catalog, setCatalog] = useState<Source[]>([]);
  const [, setMediaRevision] = useState(0);
  const [preview, setPreview] = useState<MultiviewScene | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<HTMLDivElement>(null);
  const gesture = useRef<Gesture | null>(null);
  const apiQuery = useMemo(() => new URLSearchParams({ studioId, room: roomName }).toString(), [studioId, roomName]);
  const cacheKey = `castlink-multiview-sources:${JSON.stringify([studioId, roomName])}`;
  const session = sessions[sceneId];
  const scene = preview || session?.draft.present;
  const selected = scene?.tiles.find(tile => tile.id === selectedId);
  const dirty = !!session && JSON.stringify(session.draft.present) !== JSON.stringify(session.saved);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError("");
    fetch(`/api/multiview?${apiQuery}`, { signal: controller.signal, cache: "no-store" }).then(async response => {
      if (!response.ok) throw new Error("load");
      const data = await response.json() as { scenes: MultiviewScene[] };
      if (controller.signal.aborted) return;
      const list = data.scenes.length ? data.scenes : [blankScene(c.newScene)];
      setSessions(Object.fromEntries(list.map(value => [value.id, { draft: createDraft(value), saved: value.revision ? value : null }])));
      setSceneId(list[0].id); setSelectedId(list[0].tiles[0]?.id || "");
    }).catch(() => { if (!controller.signal.aborted) setError(c.loadError); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
    // A language change must not replace local drafts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apiQuery, loadAttempt]);

  useEffect(() => {
    let remembered: Source[] = [];
    try {
      const value: unknown = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      if (Array.isArray(value)) remembered = value.filter((item): item is Source => item && typeof item.identity === "string" && typeof item.name === "string" && (item.source === "camera" || item.source === "screen")).slice(-256);
    } catch { /* Source labels are optional; live identities remain authoritative. */ }
    setCatalog(remembered);
    const refresh = () => {
      setMediaRevision(value => value + 1);
      setCatalog(previous => {
        const next = new Map(previous.map(item => [sourceKey(item), item]));
        room.remoteParticipants.forEach(participant => {
          if (resolveParticipantRole(participant) !== "guest") return;
          const camera: Source = { identity: participant.identity, name: participant.name || participant.identity, source: "camera" };
          next.set(sourceKey(camera), camera);
          if (participant.getTrackPublication(Track.Source.ScreenShare)) {
            const screen: Source = { ...camera, source: "screen" };
            next.set(sourceKey(screen), screen);
          }
        });
        const result = Array.from(next.values()).slice(-256);
        try { localStorage.setItem(cacheKey, JSON.stringify(result)); } catch { /* Storage may be unavailable. */ }
        return result;
      });
    };
    refresh();
    const events = [RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantNameChanged, RoomEvent.ParticipantMetadataChanged, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished, RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackMuted, RoomEvent.TrackUnmuted];
    events.forEach(event => room.on(event, refresh));
    return () => { events.forEach(event => room.off(event, refresh)); };
  }, [room, cacheKey]);

  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    editorRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; previousFocus?.focus(); };
  }, []);

  const sources = useMemo(() => {
    const all = new Map(catalog.map(source => [sourceKey(source), source]));
    Object.values(sessions).forEach(value => value.draft.present.tiles.forEach(tile => {
      if (!tile.sourceIdentity) return;
      const item: Source = { identity: tile.sourceIdentity, source: tile.source, name: room.remoteParticipants.get(tile.sourceIdentity)?.name || tile.sourceIdentity };
      if (!all.has(sourceKey(item))) all.set(sourceKey(item), item);
    }));
    return Array.from(all.values());
  }, [catalog, sessions, room]);

  function sourceStatus(source: Source) {
    const participant = room.remoteParticipants.get(source.identity);
    if (!participant || resolveParticipantRole(participant) !== "guest") return c.offline;
    const publication = participant.getTrackPublication(source.source === "screen" ? Track.Source.ScreenShare : Track.Source.Camera);
    return publication && !publication.isMuted ? c.online : c.noVideo;
  }
  function sourceLabel(source: Source) { return `${source.name} · ${source.source === "screen" ? c.screen : c.camera}`; }
  function edit(next: MultiviewScene) {
    if (busy) return;
    setSessions(previous => {
      const value = previous[next.id];
      return value ? { ...previous, [next.id]: { ...value, draft: updateDraft(value.draft, next) } } : previous;
    });
    setNotice(""); setError("");
  }
  function patchTile(patch: Partial<MultiviewTile>) {
    if (!scene || !selected) return;
    edit({ ...scene, tiles: scene.tiles.map(tile => tile.id === selected.id ? clampTile({ ...tile, ...patch }) : tile) });
  }
  function history(action: "undo" | "redo") {
    if (busy || gesture.current) return;
    setSessions(previous => {
      const value = previous[sceneId];
      return value ? { ...previous, [sceneId]: { ...value, draft: (action === "undo" ? undoDraft : redoDraft)(value.draft) } } : previous;
    });
    setNotice("");
  }
  function applyGrid(nextColumns: number, nextRows: number) {
    if (!scene) return;
    try { edit(gridScene(scene, nextColumns, nextRows)); setColumns(nextColumns); setRows(nextRows); setMode("grid"); }
    catch { setError(c.gridLimit); }
  }
  function addSlot() {
    if (!scene || scene.tiles.length >= 32) { setError(c.limit); return; }
    const tile: MultiviewTile = { id: newId(), sourceIdentity: "", source: "camera", x: .1, y: .1, width: .4, height: .4, fit: "contain", muted: true };
    edit({ ...scene, tiles: [...scene.tiles, tile] }); setSelectedId(tile.id); setMode("free");
  }
  function createScene() {
    if (Object.keys(sessions).length >= 16) { setError(c.limit); return; }
    const next = blankScene(`${c.scene} ${Object.keys(sessions).length + 1}`);
    setSessions(previous => ({ ...previous, [next.id]: { draft: createDraft(next), saved: null } }));
    setSceneId(next.id); setSelectedId(next.tiles[0].id); setMode("grid"); setColumns(2); setRows(2); setError(""); setNotice("");
  }
  async function applyScene() {
    if (!scene || busy) return;
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch("/api/multiview", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ studioId, room: roomName, scene, expectedRevision: session.saved?.revision || 0 }) });
      if (!response.ok) throw new Error(response.status === 409 ? c.conflict : c.saveError);
      const data = await response.json() as { scene: MultiviewScene };
      setSessions(previous => ({ ...previous, [data.scene.id]: { draft: createDraft(data.scene), saved: data.scene } })); setNotice(c.applied);
    } catch (failure) { setError(failure instanceof Error ? failure.message : c.saveError); }
    finally { setBusy(false); }
  }
  async function revertScene() {
    if (!session || busy) return;
    if (!session.saved) { const next = blankScene(scene?.name || c.newScene); edit({ ...next, id: sceneId }); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/multiview?${apiQuery}&sceneId=${encodeURIComponent(sceneId)}`, { cache: "no-store" });
      if (!response.ok) throw new Error(c.loadError);
      const data = await response.json() as { scene: MultiviewScene };
      setSessions(previous => ({ ...previous, [sceneId]: { draft: createDraft(data.scene), saved: data.scene } })); setNotice("");
    } catch { setError(c.loadError); }
    finally { setBusy(false); }
  }
  function outputUrl() { return `${window.location.origin}/multiview/${encodeURIComponent(sceneId)}?${apiQuery}#access=${encodeURIComponent(viewAccess)}`; }
  async function copyLink() {
    try { await navigator.clipboard.writeText(outputUrl()); setNotice(c.copied); }
    catch { setError(c.copyError); }
  }
  function dropOnTile(event: DragEvent, tileId: string) {
    event.preventDefault(); event.stopPropagation();
    if (!scene || busy) return;
    try {
      const data = JSON.parse(event.dataTransfer.getData("application/x-castlink-multiview")) as { tileId?: string; identity?: string; source?: "camera" | "screen" };
      if (data.tileId) edit(swapTilePositions(scene, data.tileId, tileId));
      else if (typeof data.identity === "string" && (data.source === "camera" || data.source === "screen")) edit(assignTileSource(scene, tileId, data.identity, data.source));
      setSelectedId(tileId);
    } catch { /* Unrelated drops are ignored. */ }
  }
  function startGesture(event: PointerEvent, tile: MultiviewTile, edge?: ResizeEdge) {
    if (event.button !== 0 || busy) return;
    setSelectedId(tile.id);
    if (mode !== "free" || !scene || !canvasRef.current) return;
    event.preventDefault(); event.stopPropagation();
    const bounds = canvasRef.current.getBoundingClientRect();
    gesture.current = { id: tile.id, scene, tile: { ...tile }, startX: event.clientX, startY: event.clientY, width: bounds.width, height: bounds.height, edge, latest: scene };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function moveGesture(event: PointerEvent) {
    const current = gesture.current;
    if (!current) return;
    const dx = (event.clientX - current.startX) / current.width;
    const dy = (event.clientY - current.startY) / current.height;
    const nextTile = current.edge ? resizeTile(current.tile, current.edge, dx, dy) : clampTile({ ...current.tile, x: current.tile.x + dx, y: current.tile.y + dy });
    current.latest = { ...current.scene, tiles: current.scene.tiles.map(tile => tile.id === current.id ? nextTile : tile) };
    setPreview(current.latest);
  }
  function endGesture(cancel = false) {
    const current = gesture.current;
    gesture.current = null; setPreview(null);
    if (current && !cancel) edit(current.latest);
  }
  function reorder(front: boolean) {
    if (!scene || !selected) return;
    const others = scene.tiles.filter(tile => tile.id !== selected.id);
    edit({ ...scene, tiles: front ? [...others, selected] : [selected, ...others] });
  }

  return <div className={styles.backdrop} role="dialog" aria-modal="true" aria-labelledby="multiview-title">
    <div className={styles.editor} ref={editorRef} tabIndex={-1} onKeyDown={event => {
      if (event.key === "Escape") { event.preventDefault(); onClose(); return; }
      if (event.key === "Tab" && editorRef.current) {
        const focusable = Array.from(editorRef.current.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(element => element.getClientRects().length > 0);
        const first = focusable[0]; const last = focusable[focusable.length - 1];
        if (event.shiftKey && (document.activeElement === first || document.activeElement === editorRef.current)) { event.preventDefault(); last?.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
      }
      const target = event.target as HTMLElement;
      if (target.closest("input,select,textarea,button")) return;
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") { event.preventDefault(); history(event.shiftKey ? "redo" : "undo"); }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") { event.preventDefault(); history("redo"); }
      if (selected && mode === "free" && ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)) {
        event.preventDefault(); const step = event.shiftKey ? .05 : .005;
        patchTile({ x: selected.x + (event.key === "ArrowRight" ? step : event.key === "ArrowLeft" ? -step : 0), y: selected.y + (event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0) });
      }
    }}>
      <header className={styles.header}>
        <div className={styles.heading}><span className={styles.logo} aria-hidden="true">▦</span><h2 id="multiview-title">{c.title}</h2><span className={styles.room}>{roomName}</span></div>
        <div className={styles.actions}><button type="button" disabled={!session?.draft.past.length || busy} onClick={() => history("undo")} title={c.undo}>↶ <span>{c.undo}</span></button><button type="button" disabled={!session?.draft.future.length || busy} onClick={() => history("redo")} title={c.redo}>↷ <span>{c.redo}</span></button><button type="button" className={styles.close} onClick={onClose} aria-label={c.close}>×</button></div>
      </header>
      <div className={styles.toolbar}>
        <label className={styles.sceneSelect}>{c.scene}<select value={sceneId} disabled={loading || busy} onChange={event => { setSceneId(event.target.value); setSelectedId(""); setPreview(null); setError(""); setNotice(""); }} title={c.changeHelp}>{Object.values(sessions).map(value => <option key={value.draft.present.id} value={value.draft.present.id}>{value.draft.present.name}{JSON.stringify(value.draft.present) !== JSON.stringify(value.saved) ? " •" : ""}</option>)}</select></label>
        <button type="button" onClick={createScene} disabled={loading || busy || Object.keys(sessions).length >= 16}>+ {c.newScene}</button>
        <div className={styles.divider} />
        <span className={styles.toolbarLabel}>{c.format}</span><div className={styles.segment}>{formats.map(format => <button type="button" key={format.label} aria-pressed={scene?.width === format.width && scene?.height === format.height} disabled={!scene || busy} onClick={() => scene && edit({ ...scene, width: format.width, height: format.height })}>{format.label}</button>)}</div>
        <div className={styles.divider} /><div className={styles.segment}><button type="button" aria-pressed={mode === "grid"} onClick={() => setMode("grid")} disabled={busy}>{c.grid}</button><button type="button" aria-pressed={mode === "free"} onClick={() => setMode("free")} disabled={busy}>{c.free}</button></div>
      </div>
      <div className={styles.templatebar}>
        <span className={styles.toolbarLabel}>{c.grid}</span>{templates.map(([cols, rowCount]) => <button type="button" key={`${cols}x${rowCount}`} disabled={!scene || busy} onClick={() => applyGrid(cols, rowCount)}>{cols} × {rowCount}</button>)}
        <div className={styles.customGrid}><label>{c.columns}<input aria-label={c.columns} type="number" min={1} max={32} value={columns} disabled={busy} onChange={event => setColumns(Number(event.target.value))} /></label><span>×</span><label>{c.rows}<input aria-label={c.rows} type="number" min={1} max={32} value={rows} disabled={busy} onChange={event => setRows(Number(event.target.value))} /></label><button type="button" disabled={!scene || busy} onClick={() => applyGrid(columns, rows)}>{c.build}</button></div>
      </div>
      <div className={styles.workspace}>
        <aside className={styles.sources}><div className={styles.panelTitle}><h3>{c.sources}</h3><span>{sources.length}</span></div><p className={styles.hint}>{c.sourceHelp}</p><div className={styles.sourceList}>{sources.length ? sources.map(source => {
          const status = sourceStatus(source); const active = status === c.online;
          return <button type="button" className={styles.sourceCard} key={sourceKey(source)} disabled={busy} draggable={!busy} onDragStart={event => { event.dataTransfer.setData("application/x-castlink-multiview", JSON.stringify({ identity: source.identity, source: source.source })); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => selected && scene && edit(assignTileSource(scene, selected.id, source.identity, source.source))} title={sourceLabel(source)}>
            <span className={styles.sourceIcon} aria-hidden="true">{source.source === "screen" ? "▱" : "◉"}</span><span className={styles.sourceInfo}><strong>{source.name}</strong><small>{source.source === "screen" ? c.screen : c.camera}</small><span className={active ? styles.online : styles.offline}>{status}</span></span><span className={styles.dragIcon} aria-hidden="true">⠿</span>
          </button>;
        }) : <p className={styles.hint}>{c.emptySources}</p>}</div></aside>
        <main className={styles.stage}>
          <div className={styles.stageTitle}><span>{c.preview}</span><span>{scene ? `${scene.width} × ${scene.height} · ${scene.tiles.length}/32` : ""}</span></div>
          <div className={styles.canvasArea}>{loading ? <p className={styles.hint}>{c.loading}</p> : scene ? <div className={styles.canvas} ref={canvasRef} style={{ aspectRatio: `${scene.width}/${scene.height}`, "--mv-ratio": scene.width / scene.height } as CSSProperties} tabIndex={0} aria-label={c.preview} onPointerMove={moveGesture} onPointerUp={() => endGesture()} onPointerCancel={() => endGesture(true)}>
            {scene.tiles.map((tile, index) => {
              const isSelected = tile.id === selectedId;
              const source = sources.find(item => item.identity === tile.sourceIdentity && item.source === tile.source);
              return <div key={tile.id} className={`${styles.tile} ${isSelected ? styles.selected : ""} ${mode === "free" ? styles.freeTile : ""}`} style={{ left: `${tile.x * 100}%`, top: `${tile.y * 100}%`, width: `${tile.width * 100}%`, height: `${tile.height * 100}%`, zIndex: index + 1 }} tabIndex={0} role="button" aria-label={`${c.slot} ${index + 1}: ${source ? sourceLabel(source) : c.unassigned}`} aria-pressed={isSelected} draggable={mode === "grid" && !busy} onPointerDown={event => startGesture(event, tile)} onClick={() => setSelectedId(tile.id)} onFocus={() => setSelectedId(tile.id)} onDragStart={event => { event.dataTransfer.setData("application/x-castlink-multiview", JSON.stringify({ tileId: tile.id })); event.dataTransfer.effectAllowed = "move"; }} onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = event.dataTransfer.types.includes("application/x-castlink-multiview") ? (event.dataTransfer.effectAllowed === "copy" ? "copy" : "move") : "none"; }} onDrop={event => dropOnTile(event, tile.id)}>
                {tile.sourceIdentity ? <MultiviewMedia room={room} tile={tile} editor /> : <div className={styles.emptyTile}><span>+</span><small>{c.empty}</small></div>}
                <div className={styles.tileCaption}><span>{String(index + 1).padStart(2, "0")}</span><span>{source ? sourceLabel(source) : c.unassigned}</span>{!tile.muted && <span aria-label={c.audio}>♪</span>}</div>
              </div>;
            })}
            {selected && mode === "free" && <div className={styles.selectionFrame} style={{ left: `${selected.x * 100}%`, top: `${selected.y * 100}%`, width: `${selected.width * 100}%`, height: `${selected.height * 100}%` }} aria-hidden="true">{edges.map(edge => <span key={edge} className={`${styles.handle} ${styles[`handle_${edge}`]}`} onPointerDown={event => startGesture(event, selected, edge)} />)}</div>}
          </div> : <button type="button" onClick={() => setLoadAttempt(value => value + 1)}>{c.retry}</button>}</div>
          <div className={styles.stageHelp}><span className={styles.mintDot} />{mode === "grid" ? c.gridHelp : c.freeHelp}</div>
          <div className={styles.stageButtons}><button type="button" disabled={!scene || busy || (scene?.tiles.length || 0) >= 32} onClick={addSlot}>+ {c.add}</button><span className={styles.hint}>{c.outputHelp}</span></div>
        </main>
        <aside className={styles.properties}>
          <div className={styles.panelTitle}><h3>{c.properties}</h3><span>{selected ? String((scene?.tiles.findIndex(tile => tile.id === selected.id) || 0) + 1).padStart(2, "0") : "—"}</span></div>
          <label className={styles.field}>{c.name}<input maxLength={80} value={scene?.name || ""} disabled={!scene || busy} onChange={event => scene && edit({ ...scene, name: event.target.value })} /></label>
          {selected ? <><div className={styles.propertyDivider} /><label className={styles.field}>{c.source}<select disabled={busy} value={selected.sourceIdentity ? sourceKey({ identity: selected.sourceIdentity, source: selected.source }) : ""} onChange={event => { if (!scene) return; if (!event.target.value) { edit(assignTileSource(scene, selected.id, "", "camera")); return; } const [identity, source] = JSON.parse(event.target.value) as [string, "camera" | "screen"]; edit(assignTileSource(scene, selected.id, identity, source)); }}><option value="">{c.unassigned}</option>{sources.map(source => <option key={sourceKey(source)} value={sourceKey(source)}>{sourceLabel(source)}{sourceStatus(source) !== c.online ? ` (${sourceStatus(source)})` : ""}</option>)}</select></label>
            <label className={styles.field}>{c.fit}<select value={selected.fit} disabled={busy} onChange={event => patchTile({ fit: event.target.value as "contain" | "cover" })}><option value="contain">{c.contain}</option><option value="cover">{c.cover}</option></select></label>
            <div className={styles.field}><span>{c.audio}</span><div className={styles.segment}><button type="button" aria-pressed={selected.muted} disabled={busy} onClick={() => patchTile({ muted: true })}>{c.audioOff}</button><button type="button" aria-pressed={!selected.muted} disabled={busy} onClick={() => patchTile({ muted: false })}>{c.audioOn}</button></div></div>
            <div className={styles.propertyDivider} /><span className={styles.smallLabel}>{c.position}</span><div className={styles.geometry}>{(["x", "y", "width", "height"] as const).map((key, index) => <label key={key}>{["X", "Y", "W", "H"][index]}<input type="number" aria-label={`${key} %`} min={key === "width" || key === "height" ? 2 : 0} max={100} step={.5} value={Number((selected[key] * 100).toFixed(2))} disabled={busy || mode === "grid"} onChange={event => patchTile({ [key]: Number(event.target.value) / 100 })} /></label>)}</div>
            <div className={styles.layerButtons}><button type="button" disabled={busy} onClick={() => reorder(true)}>{c.front}</button><button type="button" disabled={busy} onClick={() => reorder(false)}>{c.back}</button></div><button type="button" className={styles.removeButton} disabled={busy} onClick={() => { scene && edit({ ...scene, tiles: scene.tiles.filter(tile => tile.id !== selected.id) }); setSelectedId(""); setMode("free"); }}>{c.remove}</button>
          </> : <p className={styles.hint}>{c.select}</p>}
        </aside>
      </div>
      <footer className={styles.footer}>
        <div className={styles.outputActions}><div><button type="button" disabled={!session?.saved || !viewAccess || busy} title={session?.saved ? c.open : c.unsaved} onClick={() => window.open(outputUrl(), "_blank", "noopener,noreferrer")}>{c.open} ↗</button><button type="button" disabled={!session?.saved || !viewAccess || busy} onClick={copyLink}>{c.copy}</button></div><p>{c.linkHelp}</p></div>
        <div className={styles.applyActions}><div className={error ? styles.error : styles.status} role={error ? "alert" : "status"}>{error || notice || (dirty ? c.draft : c.saved)}</div><div><button type="button" disabled={!scene || busy || !dirty} onClick={revertScene}>{c.reset}</button><button type="button" className={styles.applyButton} disabled={!scene || busy || !dirty || !scene.name.trim()} onClick={applyScene}>{busy ? c.applying : c.apply}</button></div></div>
      </footer>
    </div>
  </div>;
}
