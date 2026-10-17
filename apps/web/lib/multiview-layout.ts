import type { MultiviewScene, MultiviewTile } from "./multiview";

export type MultiviewDraft = { past: MultiviewScene[]; present: MultiviewScene; future: MultiviewScene[] };
export const MIN_TILE_SIZE = 0.02;
export const MAX_TILE_SIZE = 2;
export const MIN_TILE_POSITION = -1;
export const MAX_TILE_POSITION = 1;
const copyScene = (scene: MultiviewScene): MultiviewScene => JSON.parse(JSON.stringify(scene));
const finite = (value: number, fallback: number) => Number.isFinite(value) ? value : fallback;
const bounded = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function clampTile(tile: MultiviewTile): MultiviewTile {
  const width = bounded(finite(tile.width, MIN_TILE_SIZE), MIN_TILE_SIZE, MAX_TILE_SIZE);
  const height = bounded(finite(tile.height, MIN_TILE_SIZE), MIN_TILE_SIZE, MAX_TILE_SIZE);
  return { ...tile, width, height, x: bounded(finite(tile.x, 0), MIN_TILE_POSITION, MAX_TILE_POSITION), y: bounded(finite(tile.y, 0), MIN_TILE_POSITION, MAX_TILE_POSITION) };
}

export type ResizeEdge = "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "nw";
export function resizeTile(tile: MultiviewTile, edge: ResizeEdge, dx: number, dy: number): MultiviewTile {
  tile = clampTile(tile);
  dx = finite(dx, 0); dy = finite(dy, 0);
  const left = edge.includes("w") ? bounded(tile.x + dx, Math.max(MIN_TILE_POSITION, tile.x + tile.width - MAX_TILE_SIZE), Math.min(MAX_TILE_POSITION, tile.x + tile.width - MIN_TILE_SIZE)) : tile.x;
  const top = edge.includes("n") ? bounded(tile.y + dy, Math.max(MIN_TILE_POSITION, tile.y + tile.height - MAX_TILE_SIZE), Math.min(MAX_TILE_POSITION, tile.y + tile.height - MIN_TILE_SIZE)) : tile.y;
  const right = edge.includes("e") ? bounded(tile.x + tile.width + dx, left + MIN_TILE_SIZE, left + MAX_TILE_SIZE) : tile.x + tile.width;
  const bottom = edge.includes("s") ? bounded(tile.y + tile.height + dy, top + MIN_TILE_SIZE, top + MAX_TILE_SIZE) : tile.y + tile.height;
  return { ...tile, x: left, y: top, width: right - left, height: bottom - top };
}

export function gridScene(scene: MultiviewScene, columns: number, rows: number, makeId = () => crypto.randomUUID()): MultiviewScene {
  if (!Number.isInteger(columns) || !Number.isInteger(rows) || columns < 1 || rows < 1 || columns * rows > 32) throw new Error("A grid requires 1–32 slots");
  const used = new Set(scene.tiles.map(tile => tile.id));
  return { ...scene, tiles: Array.from({ length: columns * rows }, (_, index) => {
    let tile = scene.tiles[index];
    if (!tile) {
      let id = `${makeId()}-${index}`;
      while (used.has(id)) id += "x";
      used.add(id);
      tile = { id, sourceIdentity: "", source: "camera", fit: "contain", muted: true, x: 0, y: 0, width: 1, height: 1 };
    }
    return { ...tile, x: (index % columns) / columns, y: Math.floor(index / columns) / rows, width: 1 / columns, height: 1 / rows };
  }) };
}

export function swapTilePositions(scene: MultiviewScene, firstId: string, secondId: string): MultiviewScene {
  const first = scene.tiles.find(tile => tile.id === firstId);
  const second = scene.tiles.find(tile => tile.id === secondId);
  if (!first || !second || first === second) return scene;
  return { ...scene, tiles: scene.tiles.map(tile => {
    const target = tile.id === firstId ? second : tile.id === secondId ? first : undefined;
    return target ? { ...tile, x: target.x, y: target.y, width: target.width, height: target.height } : tile;
  }) };
}

export function assignTileSource(scene: MultiviewScene, tileId: string, sourceIdentity: string, source: MultiviewTile["source"]): MultiviewScene {
  return { ...scene, tiles: scene.tiles.map(tile => tile.id === tileId ? { ...tile, sourceIdentity, source } : tile) };
}

export function createDraft(scene: MultiviewScene): MultiviewDraft {
  return { past: [], present: copyScene(scene), future: [] };
}

export function updateDraft(draft: MultiviewDraft, scene: MultiviewScene): MultiviewDraft {
  if (JSON.stringify(scene) === JSON.stringify(draft.present)) return draft;
  return { past: [...draft.past, copyScene(draft.present)].slice(-64), present: copyScene(scene), future: [] };
}

export function undoDraft(draft: MultiviewDraft): MultiviewDraft {
  const previous = draft.past[draft.past.length - 1];
  return previous ? { past: draft.past.slice(0, -1), present: copyScene(previous), future: [copyScene(draft.present), ...draft.future] } : draft;
}

export function redoDraft(draft: MultiviewDraft): MultiviewDraft {
  const next = draft.future[0];
  return next ? { past: [...draft.past, copyScene(draft.present)], present: copyScene(next), future: draft.future.slice(1) } : draft;
}

/** Numbered slots are array order, independent from their geometric position. */
export function moveSourceToSlot(scene:MultiviewScene, sourceId:string, slot:number, action:"swap"|"replace"):MultiviewScene {
 const first=scene.tiles.find(t=>t.id===sourceId), target=scene.tiles[slot-1];
 if(!first||!target||first===target)return scene;
 return {...scene,tiles:scene.tiles.map(t=>t===target?{...t,sourceIdentity:first.sourceIdentity,source:first.source,muted:first.muted}:t===first?{...t,sourceIdentity:action==="swap"?target.sourceIdentity:"",source:action==="swap"?target.source:"camera",muted:action==="swap"?target.muted:true}:t)};
}
export function duplicateScene(scene:MultiviewScene,id:string,name:string,makeId=()=>crypto.randomUUID()):MultiviewScene {
 const copy=copyScene(scene);return {...copy,id,name,revision:0,tiles:copy.tiles.map((tile,i)=>({...tile,id:`${makeId()}-${i}`}))};
}
