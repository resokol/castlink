import { validateImageTransform, type ImageTransform } from "./multiview-image";
export type MultiviewAbsence = { mode: "transparent" | "black" | "image"; image?: string; transform?: ImageTransform };
export type MultiviewTile = {
  transform?: ImageTransform;
  /** Missing/source preserves legacy source proportions; fixed formats define the slot frame. */
  aspectRatio?: "source" | "16:9" | "4:3";
  /** Percent of the shorter slot side; equal circular radius at every corner. */
  borderRadius?: number;
  id: string;
  sourceIdentity: string;
  source: "camera" | "screen";
  x: number;
  y: number;
  width: number;
  height: number;
  fit: "contain" | "cover";
  muted: boolean;
};

export type MultiviewScene = {
  absence?: MultiviewAbsence;
  id: string;
  name: string;
  width: number;
  height: number;
  revision: number;
  tiles: MultiviewTile[];
};

export class MultiviewError extends Error {
  constructor(message: string, readonly status = 400) { super(message); }
}

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new MultiviewError("Некорректная сцена");
  return value as Record<string, unknown>;
}

function onlyKeys(value: Record<string, unknown>, allowed: readonly string[]) {
  if (Object.keys(value).some(key => !allowed.includes(key))) throw new MultiviewError("Неизвестные параметры сцены");
}

function strictImageTransform(value: unknown): ImageTransform {
  const transform = object(value);
  onlyKeys(transform, ["zoom", "panX", "panY", "rotation", "flipX", "flipY", "cropTop", "cropRight", "cropBottom", "cropLeft"]);
  return validateImageTransform(transform);
}

export function validMultiviewId(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

/** Array order defines the layers; absent sources remain valid, transparent slots. */
export function validateMultiviewScene(value: unknown): MultiviewScene {
  const scene = object(value);
  onlyKeys(scene, ["id", "name", "width", "height", "revision", "tiles", "absence"]);
  if (!validMultiviewId(scene.id) || typeof scene.name !== "string" || !scene.name.trim() || scene.name.length > 80 ||
      !Number.isInteger(scene.width) || Number(scene.width) < 16 || Number(scene.width) > 8192 ||
      !Number.isInteger(scene.height) || Number(scene.height) < 16 || Number(scene.height) > 8192 ||
      !Number.isSafeInteger(scene.revision) || Number(scene.revision) < 0 || !Array.isArray(scene.tiles) || scene.tiles.length > 32) {
    throw new MultiviewError("Некорректные параметры сцены");
  }
  const ids = new Set<string>();
  const tiles = scene.tiles.map(value => {
    const tile = object(value);
    onlyKeys(tile, ["id", "sourceIdentity", "source", "x", "y", "width", "height", "fit", "muted", "transform", "borderRadius", "aspectRatio"]);
    if (!validMultiviewId(tile.id) || ids.has(tile.id) || typeof tile.sourceIdentity !== "string" ||
        tile.sourceIdentity.length > 200 || /[\u0000-\u001f\u007f]/.test(tile.sourceIdentity) ||
        tile.source !== "camera" && tile.source !== "screen" || tile.fit !== "contain" && tile.fit !== "cover" || typeof tile.muted !== "boolean" ||
        tile.aspectRatio !== undefined && tile.aspectRatio !== "source" && tile.aspectRatio !== "16:9" && tile.aspectRatio !== "4:3" ||
        ![tile.x, tile.y].every(n => typeof n === "number" && Number.isFinite(n) && n >= -1 && n <= 1) ||
        ![tile.width, tile.height].every(n => typeof n === "number" && Number.isFinite(n) && n > 0 && n <= 2) ||
        tile.borderRadius !== undefined && (typeof tile.borderRadius !== "number" || !Number.isFinite(tile.borderRadius) || tile.borderRadius < 0 || tile.borderRadius > 50)) {
      throw new MultiviewError("Некорректный источник или расположение плитки");
    }
    ids.add(tile.id);
    let transform: ImageTransform | undefined;
    try { if(tile.transform !== undefined) transform = strictImageTransform(tile.transform); } catch { throw new MultiviewError("Некорректное преобразование изображения"); }
    return { ...(transform ? {transform} : {}), ...(tile.borderRadius !== undefined ? {borderRadius: tile.borderRadius} : {}), ...(tile.aspectRatio !== undefined ? {aspectRatio: tile.aspectRatio} : {}), id: tile.id, sourceIdentity: tile.sourceIdentity, source: tile.source, x: tile.x, y: tile.y, width: tile.width, height: tile.height, fit: tile.fit, muted: tile.muted } as MultiviewTile;
  });
  let absence: MultiviewAbsence | undefined;
  if(scene.absence !== undefined){
    const a=object(scene.absence);
    onlyKeys(a, ["mode", "image", "transform"]);
    if(typeof a.mode!=="string" || !["transparent","black","image"].includes(a.mode)) throw new MultiviewError("Некорректная заглушка");
    absence={mode:a.mode as MultiviewAbsence["mode"]};
    if(a.image!==undefined){
      // Raster-only bounded payload, stored within the room-authorized scene. No public files or arbitrary paths.
      if(typeof a.image!=="string" || a.image.length>96000 || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(a.image)) throw new MultiviewError("Используйте PNG до 70 КБ");
      let bytes:Uint8Array;
      try { bytes=Uint8Array.from(atob(a.image.slice(22)),c=>c.charCodeAt(0)); } catch { throw new MultiviewError("Некорректный PNG"); }
      if(bytes.length<33 || [137,80,78,71,13,10,26,10].some((n,i)=>bytes[i]!==n) || String.fromCharCode(...bytes.slice(12,16))!=="IHDR") throw new MultiviewError("Некорректный PNG");
      const view=new DataView(bytes.buffer);const width=view.getUint32(16),height=view.getUint32(20);
      if(!width||!height||width>2048||height>2048)throw new MultiviewError("Размер заглушки не более 2048 × 2048");
      absence.image=a.image;
    }
    if(absence.mode==="image"&&!absence.image)throw new MultiviewError("Загрузите заглушку");
    try { if(a.transform!==undefined)absence.transform=strictImageTransform(a.transform); } catch { throw new MultiviewError("Некорректное преобразование заглушки"); }
  }
  return { ...(absence ? {absence} : {}), id: scene.id, name: scene.name.trim(), width: scene.width as number, height: scene.height as number, revision: scene.revision as number, tiles };
}
