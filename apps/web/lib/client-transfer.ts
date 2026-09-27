export type TransferRole = "studio" | "guest";

export type TransferSnapshot = {
  role: TransferRole;
  room: string;
  sourceOrigin?: string;
  name?: string;
  identity?: string;
  settings?: Record<string, unknown>;
};

let transferSnapshotCache: TransferSnapshot | undefined;

export function transferDestination(targetUrl: string, ticket: string, snapshot: TransferSnapshot, clientTargetUrl?: string) {
  const target = new URL(targetUrl);
  const approvedHost = target.hostname === "castlink.ru" || target.hostname === "79-120-36-254.sslip.io" || target.hostname === "caster.em.studio";
  const localDevelopment = target.hostname === "localhost" || target.hostname === "127.0.0.1";
  if ((!approvedHost && !localDevelopment) || (target.protocol !== "https:" && !(localDevelopment && target.protocol === "http:")) || target.username || target.password) {
    throw new Error("Адрес целевого сервера не защищён (требуется HTTPS).");
  }
  if (!ticket || ticket.length > 2048) throw new Error("Сервер вернул недействительный билет переноса.");
  let destination = target.origin;
  if (clientTargetUrl) {
    let clientTarget: URL;
    try { clientTarget = new URL(clientTargetUrl); }
    catch { throw new Error("Адрес переноса для этой сети недействителен."); }
    const cleanOrigin = clientTarget.pathname === "/" && !clientTarget.search && !clientTarget.hash;
    const noCredentials = !clientTarget.username && !clientTarget.password;
    const sameOrigin = clientTarget.origin === target.origin;
    const approvedLanRoute = ["https://79-120-36-254.sslip.io", "https://caster.em.studio"].includes(target.origin)
      && clientTarget.origin === "https://192.168.53.68"
      && clientTarget.hostname === "192.168.53.68"
      && clientTarget.port === "";
    if (!cleanOrigin || !noCredentials || (!sameOrigin && !approvedLanRoute)) {
      throw new Error("Адрес переноса для этой сети не разрешён.");
    }
    destination = clientTarget.origin;
  }
  const state = encodeURIComponent(JSON.stringify(snapshot));
  const handoff = encodeURIComponent(ticket);
  return `${destination}/transfer#handoff=${handoff}&state=${state}`;
}

export function readTransferSnapshot(): TransferSnapshot | undefined {
  if (transferSnapshotCache) return transferSnapshotCache;
  try {
    const raw = sessionStorage.getItem("studiolink-transfer-state");
    if (!raw) return undefined;
    const value = JSON.parse(raw) as TransferSnapshot;
    if ((value.role !== "studio" && value.role !== "guest") || typeof value.room !== "string") return undefined;
    transferSnapshotCache = value;
    return transferSnapshotCache;
  } catch { return undefined; }
}

export function saveTransferSnapshot(value: TransferSnapshot) {
  transferSnapshotCache = value;
  try { sessionStorage.setItem("studiolink-transfer-state", JSON.stringify(value)); } catch {}
}

export function clearTransferSnapshot() {
  transferSnapshotCache = undefined;
  try { sessionStorage.removeItem("studiolink-transfer-state"); } catch {}
}
