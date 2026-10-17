import { MultiviewError, validMultiviewId, validateMultiviewScene, type MultiviewScene } from "./multiview";

export const MAX_PORTABLE_SCENE_BYTES = 131072;
const FORMAT = "castlink-multiview";

function checkSize(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_PORTABLE_SCENE_BYTES) throw new MultiviewError("Размер файла сцены не более 128 КБ");
}

/** Portable v1 files contain layout/media styling, never participant bindings or access credentials. */
export function exportMultiviewScene(value: MultiviewScene): string {
  const scene = validateMultiviewScene(value);
  const text = JSON.stringify({ format: FORMAT, version: 1, scene: { ...scene, revision: 0, tiles: scene.tiles.map(tile => ({ ...tile, sourceIdentity: "" })) } }, null, 2);
  checkSize(text);
  return text;
}

/** Import creates an independent draft; the editor must assign room sources before applying it. */
export function importMultiviewScene(text: string, makeId = () => crypto.randomUUID()): MultiviewScene {
  if (typeof text !== "string") throw new MultiviewError("Некорректный файл сцены");
  checkSize(text);
  let input: unknown;
  try { input = JSON.parse(text); } catch { throw new MultiviewError("Некорректный JSON сцены"); }
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new MultiviewError("Некорректный файл сцены");
  const envelope = input as Record<string, unknown>;
  if (envelope.format !== FORMAT || envelope.version !== 1 || Object.keys(envelope).some(key => !["format", "version", "scene"].includes(key))) {
    throw new MultiviewError("Неподдерживаемый формат или версия сцены");
  }
  const scene = validateMultiviewScene(envelope.scene);
  const used = new Set([scene.id, ...scene.tiles.map(tile => tile.id)]);
  const freshId = () => {
    const base = makeId();
    if (!validMultiviewId(base)) throw new MultiviewError("Некорректный идентификатор новой сцены");
    let id = base, suffix = 0;
    while (used.has(id)) id = `${base.slice(0, 70)}-${++suffix}`;
    used.add(id);
    return id;
  };
  return { ...scene, id: freshId(), revision: 0, tiles: scene.tiles.map(tile => ({ ...tile, id: freshId(), sourceIdentity: "" })) };
}
