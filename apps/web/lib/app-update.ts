export function updateUrl(currentUrl: string, version: string) {
  const url = new URL(currentUrl);
  url.searchParams.set("_update", version);
  return url.toString();
}

export function availableVersion(current: string, response: unknown): string | null {
  if (!response || typeof response !== "object" || !("version" in response)) throw Error("Некорректный ответ сервера");
  const version = response.version;
  if (typeof version !== "string" || !version.trim() || version.length > 128) throw Error("Некорректная версия сервера");
  return version === current ? null : version;
}

/** Short display label only; comparisons and update requests retain the full build ID. */
export function displayBuildId(buildId: string): string {
  const hash = buildId.match(/(?:^|-)([a-f0-9]{7,40})$/i)?.[1];
  return hash ? hash.slice(0, 6) : buildId;
}
