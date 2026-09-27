export type SavedServer = { label: string; origin: string };

const STORAGE_KEY = "castlink-saved-servers-v1";
const MAX_SAVED_SERVERS = 20;

export function normalizeServerOrigin(value: string): string {
  const input = value.trim();
  if (!input) throw new Error("Укажите адрес сервера.");
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(input) ? input : `https://${input}`;
  let url: URL;
  try { url = new URL(withScheme); } catch { throw new Error("Введите корректный адрес сервера."); }
  if (url.username || url.password) throw new Error("Адрес не должен содержать логин или пароль.");
  if (url.search || url.hash || (url.pathname !== "/" && url.pathname !== "")) throw new Error("Укажите только адрес сервера без пути, параметров и фрагмента.");
  const local = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "[::1]";
  if (url.protocol !== "https:" && !(url.protocol === "http:" && local)) throw new Error("Для удалённых серверов требуется HTTPS.");
  if (!url.hostname) throw new Error("Укажите имя сервера.");
  return url.origin;
}

export function normalizeSavedServer(label: string, address: string): SavedServer {
  const cleanLabel = label.trim();
  if (!cleanLabel || cleanLabel.length > 60) throw new Error("Название сервера должно содержать от 1 до 60 символов.");
  return { label: cleanLabel, origin: normalizeServerOrigin(address) };
}

export function readSavedServers(): SavedServer[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const valid: SavedServer[] = [];
    const seen = new Set<string>();
    let changed = false;
    for (const item of parsed) {
      if (!item || typeof item.label !== "string" || typeof item.origin !== "string") continue;
      try {
        const server = normalizeSavedServer(item.label, item.origin);
        const oldCastLink = server.origin === "https://lunkaonline.ru" || server.origin === "https://www.lunkaonline.ru";
        const migrated = oldCastLink ? { label: "VPS CastLink", origin: "https://castlink.ru" } : server;
        if (oldCastLink) changed = true;
        if (seen.has(migrated.origin)) { changed = true; continue; }
        seen.add(migrated.origin);
        valid.push(migrated);
      } catch {}
    }
    const result = valid.slice(0, MAX_SAVED_SERVERS);
    if (result.length !== valid.length) changed = true;
    if (changed) {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(result)); } catch {}
    }
    return result;
  } catch { return []; }
}

export function writeSavedServers(servers: SavedServer[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(servers.slice(0, MAX_SAVED_SERVERS)));
    return true;
  } catch { return false; }
}
