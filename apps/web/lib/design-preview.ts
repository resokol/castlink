export const DESIGN_PREVIEW_STORAGE_KEY = "castlink-design-preview";

type PreviewStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/** Special routes receive the shared theme, but never the testing banner. */
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
  let enabled = true;
  let showControls = false;
  if (flag === "preview" || flag === "current") {
    enabled = flag === "preview";
    showControls = true;
    saveDesignPreview(enabled, storage);
  } else {
    try {
      const stored = storage?.getItem(DESIGN_PREVIEW_STORAGE_KEY);
      if (stored === "true" || stored === "false") {
        enabled = stored === "true";
        showControls = true;
      }
    } catch { /* The default theme also works with restricted storage. */ }
  }
  const hasFlag = url.searchParams.has("design");
  url.searchParams.delete("design");
  return { enabled, showControls, cleanUrl: hasFlag ? `${url.pathname}${url.search}${url.hash}` : null };
}
