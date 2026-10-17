/** Commands are intentionally limited to presentation navigation. */
export type PresentationKind = "powerpoint" | "pdf";
export type PresentationDirection = "next" | "previous";
export type PresentationStatus = { title: string; page?: number; pages?: number; ready: boolean; error?: string };
export type PresentationCommand = { id: string; seq: number; direction: PresentationDirection; issuedAt: number; expiresAt: number; connectionId: string };
export type PresentationResult = { seq: number; ok: boolean; error?: string };
export type PresentationSession = { id: string; kind: PresentationKind; ownerIdentity: string; controllerIdentity: string; connected: boolean; expiresAt: number; status?: PresentationStatus; result?: PresentationResult };
export const PRESENTATION_COMMAND_TTL = 3000;
export const PRESENTATION_HEARTBEAT_TTL = 4000;
export function parsePresentationStatus(value: unknown): PresentationStatus | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) return;
  const v = value as Record<string, unknown>;
  if (typeof v.title !== "string" || v.title.length > 160 || typeof v.ready !== "boolean" || Object.keys(v).some(k => !["title", "page", "pages", "ready", "error"].includes(k))) return;
  if (v.error !== undefined && (typeof v.error !== "string" || v.error.length > 240)) return;
  for (const k of ["page", "pages"]) if (v[k] !== undefined && (!Number.isSafeInteger(v[k]) || (v[k] as number) < 1 || (v[k] as number) > 100000)) return;
  if (typeof v.page === "number" && typeof v.pages === "number" && v.page > v.pages) return;
  return { title: v.title, ready: v.ready, ...(v.page === undefined ? {} : { page: v.page as number }), ...(v.pages === undefined ? {} : { pages: v.pages as number }), ...(v.error === undefined ? {} : { error: v.error as string }) };
}
/** A lost response or reconnect must never apply an old navigation command. */
export function acceptPresentationCommand(value: unknown, connectionId: string, lastSeq: number, now = Date.now()): PresentationCommand | undefined {
  if (!value || typeof value !== "object") return;
  const v = value as PresentationCommand;
  if (typeof v.id !== "string" || !/^[a-f0-9-]{36}$/.test(v.id) || !Number.isSafeInteger(v.seq) || v.seq <= lastSeq || v.connectionId !== connectionId || !["next", "previous"].includes(v.direction)) return;
  if (!Number.isSafeInteger(v.issuedAt) || !Number.isSafeInteger(v.expiresAt) || v.issuedAt > now + 1000 || v.expiresAt <= now || v.expiresAt > v.issuedAt + PRESENTATION_COMMAND_TTL) return;
  return v;
}
