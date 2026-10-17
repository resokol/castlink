import type { MultiviewTile } from "./multiview";
import { clampTile, resizeTile, type ResizeEdge } from "./multiview-layout";

export type SnapGuide = { axis: "x" | "y"; position: number };
export type SnapOptions = {
  mode: "move" | "resize";
  edge?: ResizeEdge;
  tiles: readonly MultiviewTile[];
  /** Displayed canvas dimensions in CSS pixels, so zoom does not change the snap distance. */
  sceneWidth: number;
  sceneHeight: number;
  tolerancePx?: number;
};

/** Pass the proposed normalized geometry after applying the pointer delta. Guide positions are normalized scene coordinates. */
export function snapTile(proposed: MultiviewTile, options: SnapOptions): { tile: MultiviewTile; guides: SnapGuide[] } {
  let tile = clampTile(proposed);
  const guides: SnapGuide[] = [];
  const tolerancePx = Number.isFinite(options.tolerancePx) && (options.tolerancePx ?? 0) >= 0 ? options.tolerancePx! : 6;
  for (const axis of ["x", "y"] as const) {
    const pixels = axis === "x" ? options.sceneWidth : options.sceneHeight;
    if (!Number.isFinite(pixels) || pixels <= 0) continue;
    const size = axis === "x" ? "width" : "height";
    const startEdge = axis === "x" ? "w" : "n";
    const endEdge = axis === "x" ? "e" : "s";
    if (options.mode === "resize" && (!options.edge || !options.edge.includes(startEdge) && !options.edge.includes(endEdge))) continue;
    const targets = [0, .5, 1];
    for (const other of options.tiles) {
      if (other.id === tile.id) continue;
      targets.push(other[axis], other[axis] + other[size] / 2, other[axis] + other[size]);
    }
    const anchors = options.mode === "move" ? [tile[axis], tile[axis] + tile[size] / 2, tile[axis] + tile[size]] : [options.edge!.includes(startEdge) ? tile[axis] : tile[axis] + tile[size]];
    let best: { tile: MultiviewTile; position: number; distance: number } | undefined;
    for (const target of targets) {
      if (!Number.isFinite(target)) continue;
      for (const anchor of anchors) {
        const delta = target - anchor, distance = Math.abs(delta) * pixels;
        if (distance > tolerancePx + 1e-9 || best && distance >= best.distance - 1e-9) continue;
        const next = options.mode === "move" ? clampTile({ ...tile, [axis]: tile[axis] + delta }) : resizeTile(tile, options.edge!, axis === "x" ? delta : 0, axis === "y" ? delta : 0);
        // A clamped resize or move is not a successful snap; never draw a misleading guide.
        const actualDelta = options.mode === "move" || options.edge!.includes(startEdge) ? next[axis] - tile[axis] : next[axis] + next[size] - tile[axis] - tile[size];
        if (Math.abs(actualDelta - delta) > 1e-9) continue;
        best = { tile: next, position: target, distance };
      }
    }
    if (best) { tile = best.tile; guides.push({ axis, position: best.position }); }
  }
  return { tile, guides };
}
