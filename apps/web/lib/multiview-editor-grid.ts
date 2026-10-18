/** Editor preferences only: never included in a scene or the media output. */
export const editorGridSteps = [160, 80, 40, 20] as const;
export type EditorGridStep = typeof editorGridSteps[number];
export type EditorGridPreference = { visible: boolean; step: EditorGridStep };
export const editorGridStorageKey = "castlink-multiview-editor-grid:v1";

export function parseEditorGridPreference(raw: string | null): EditorGridPreference {
  const defaults: EditorGridPreference = { visible: false, step: 80 };
  try {
    const value: unknown = raw && raw.length <= 512 ? JSON.parse(raw) : null;
    if (!value || typeof value !== "object" || Array.isArray(value)) return defaults;
    const record = value as Record<string, unknown>;
    return { visible: record.visible === true, step: editorGridSteps.includes(record.step as EditorGridStep) ? record.step as EditorGridStep : defaults.step };
  } catch { return defaults; }
}

/** SVG coordinates use canvas pixels so each cell stays square at any preview size. */
export function editorGridPath(width: number, height: number, step: EditorGridStep): string {
  if (![width, height].every(value => Number.isFinite(value) && value > 0 && value <= 8192) || !editorGridSteps.includes(step)) return "";
  const lines: string[] = [];
  for (let x = step; x < width; x += step) lines.push(`M${x} 0V${height}`);
  for (let y = step; y < height; y += step) lines.push(`M0 ${y}H${width}`);
  return lines.join(" ");
}
