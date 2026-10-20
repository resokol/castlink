/** Choose the largest equal 16:9 frames that fit both measured stage dimensions. */
export function conferenceGalleryLayout(count: number, width: number, height: number, gap = 12) {
  if (count < 1 || width <= 0 || height <= 0) return { columns: 1, rows: 1 };
  let best = { columns: 1, rows: count }, bestWidth = 0;
  for (let columns = 1; columns <= count; columns++) {
    const rows = Math.ceil(count / columns);
    const tileWidth = Math.min((width - gap * (columns - 1)) / columns, (height - gap * (rows - 1)) / rows * 16 / 9);
    if (tileWidth > bestWidth) { bestWidth = tileWidth; best = { columns, rows }; }
  }
  return best;
}
