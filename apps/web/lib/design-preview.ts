export const DESIGN_PREVIEW_STORAGE_KEY = "castlink-design-preview";

type PreviewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Clean media outputs never receive preview chrome or injected styling. */
export function designPreviewExcluded(pathname: string) {
  return /^\/(?:output|multiview|watch|monitor|transfer)(?:\/|$)/.test(pathname);
}

export function saveDesignPreview(enabled: boolean | null, storage?: PreviewStorage) {
  try {
    if (enabled === null) storage?.removeItem(DESIGN_PREVIEW_STORAGE_KEY);
    else storage?.setItem(DESIGN_PREVIEW_STORAGE_KEY, String(enabled));
  } catch { /* The current document still supports preview with restricted storage. */ }
}

/** Read once at document entry; never retain invitation URLs or credentials. */
export function initialDesignPreview(href: string, storage?: PreviewStorage) {
  const url = new URL(href);
  const flag = url.searchParams.get("design");
  let enabled: boolean | null = null;
  if (flag === "preview" || flag === "current") {
    enabled = flag === "preview";
    saveDesignPreview(enabled, storage);
  } else {
    try {
      const stored = storage?.getItem(DESIGN_PREVIEW_STORAGE_KEY);
      if (stored === "true" || stored === "false") enabled = stored === "true";
    } catch { /* No preference is assumed when browser storage is unavailable. */ }
  }
  const hasFlag = url.searchParams.has("design");
  url.searchParams.delete("design");
  return { enabled, cleanUrl: hasFlag ? `${url.pathname}${url.search}${url.hash}` : null };
}
