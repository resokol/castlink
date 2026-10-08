export type TransferRole = "studio" | "guest" | "admin" | "moderator";

export type TransferSnapshot = {
  role: TransferRole;
  room: string;
  studioId?: string;
  sourceOrigin?: string;
  name?: string;
  identity?: string;
  clientId?: string;
  entryPath?: "/";
  settings?: Record<string, unknown>;
};

let transferSnapshotCache: TransferSnapshot | undefined;

export function transferDestination(targetUrl: string, ticket: string, snapshot: TransferSnapshot, clientTargetUrl?: string, approvedOrigins: readonly string[] = []) {
  const target = parseTransferOrigin(targetUrl);
  const approved = approvedOrigins.map(parseTransferOrigin);
  if (!approved.includes(target)) throw new Error("Целевой сервер не подтверждён текущим сервером.");
  if (!ticket || ticket.length > 2048) throw new Error("Сервер вернул недействительный билет переноса.");
  let destination = target;
  if (clientTargetUrl) {
    let clientTarget: string;
    try { clientTarget = parseTransferOrigin(clientTargetUrl); }
    catch { throw new Error("Адрес переноса для этой сети недействителен."); }
    if (!approved.includes(clientTarget)) {
      throw new Error("Адрес переноса для этой сети не разрешён.");
    }
    destination = clientTarget;
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
    if (!isTransferRole(value.role) || typeof value.room !== "string" || (value.studioId !== undefined && typeof value.studioId !== "string")) return undefined;
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
import { parseTransferOrigin } from "./transfer-origin";

export function isTransferRole(role: unknown): role is TransferRole {
  return role === "studio" || role === "guest" || role === "admin" || role === "moderator";
}

export function restoreAcceptedTransfer(result: Record<string, unknown>, snapshot?: TransferSnapshot): TransferSnapshot {
  if (!isTransferRole(result.role) || typeof result.room !== "string" || !result.room || typeof result.studioId !== "string" || !result.studioId) throw new Error("Сервер вернул неполные данные переноса.");
  // A fragment preserves local preferences, never authorization or client identity.
  return {
    role: result.role, room: result.room, studioId: result.studioId,
    ...(snapshot?.role === result.role && snapshot.room === result.room && snapshot.settings ? { settings: snapshot.settings } : {}),
    ...(typeof result.clientId === "string" && result.clientId ? { clientId: result.clientId } : {}),
    ...(typeof result.identity === "string" ? { identity: result.identity } : {}),
    ...(typeof result.name === "string" ? { name: result.name } : {}),
    ...(result.entryPath === "/" ? { entryPath: "/" } : {}),
  };
}

export function acceptedTransferPath(result: Record<string, unknown>) {
  const state = restoreAcceptedTransfer(result);
  const params = new URLSearchParams({ studioId: state.studioId!, [state.role === "guest" || state.entryPath === "/" ? "name" : "room"]: state.room });
  if (state.role === "admin" || state.role === "moderator") { params.delete("name"); params.set("room", state.room); return `/${state.role}?${params}`; }
  params.set(state.role === "guest" ? "moved" : "transferred", "1");
  if (state.entryPath === "/") { params.set("mode", state.role); return `/?${params}`; }
  return `/${state.role === "guest" ? "room" : "studio"}?${params}`;
}

export function saveAcceptedTransfer(result: Record<string, unknown>, snapshot?: TransferSnapshot) {
  const restored = restoreAcceptedTransfer(result, snapshot);
  if (restored.clientId) {
    const key = restored.role === "studio" ? `studiolink-studio-control-client-id:${restored.studioId}` : restored.role === "admin" || restored.role === "moderator" ? `castlink-control:${restored.studioId}:${restored.role}:${restored.room}` : undefined;
    if (key) sessionStorage.setItem(key, restored.clientId);
  }
  saveTransferSnapshot(restored);
  return restored;
}
