/** Let the browser write the streamed attachment to disk, including on browsers without the File System Access API. */
export function downloadRoomDiagnostics(statsUrl: string) {
  const url = new URL(statsUrl, window.location.origin);
  if (url.origin !== window.location.origin) throw new Error("invalid_history_url");
  url.searchParams.set("diagnostics", "full");
  const link = document.createElement("a");
  link.href = url.href;
  link.download = "";
  document.body.appendChild(link);
  link.click();
  link.remove();
}
