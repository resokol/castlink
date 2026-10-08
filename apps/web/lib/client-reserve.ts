import { parseTransferOrigin } from "./transfer-origin";
import { isTransferRole, type TransferRole } from "./client-transfer";

export type PreparedReserve = {
  peerId: string; targetId: string; label: string; targetUrl: string; clientTargetUrl?: string;
  cohortId: string; armGeneration: number; revision: number; snapshotAt: number; readyUntil: number;
  grant: string; role: TransferRole;
};
export type ReserveView = {
  phase: "unprepared" | "ready" | "stale" | "unreachable" | "committed";
  prepared?: PreparedReserve; busy: boolean; error?: string; sourceUnavailable?: boolean;
};
type Options = {
  studioId: string; room: string; token: string; clientId?: string; canActivate: boolean;
  fetch?: typeof fetch; now?: () => number; newOperationId?: () => string;
  onChange: (view: ReserveView) => void; onHandoff: (result: Record<string, unknown>, prepared: PreparedReserve) => Promise<void>;
};

export async function readReserveResponse(response: Response): Promise<Record<string, any>> {
  let value: unknown;
  if (!response.body) value = await response.json();
  else {
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let bytes = 0, text = "";
    try {
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        bytes += chunk.value.byteLength;
        if (bytes > 65536) { await reader.cancel(); throw new Error("Ответ резерва превышает допустимый размер."); }
        text += decoder.decode(chunk.value, { stream: true });
      }
      value = JSON.parse(text + decoder.decode());
    } finally { reader.releaseLock(); }
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Резерв вернул недействительный ответ.");
  return value as Record<string, any>;
}

/** Each open participant retains its own capability in memory, never a public profile or URL. */
export class ReserveClient {
  view: ReserveView = { phase: "unprepared", busy: false };
  private operationId?: string;
  private activating?: Promise<void>;
  private polling = false;
  private refreshing = false;
  private handedOff = false;
  private disposed = false;
  private sourceSequence = 0;
  private contextVersion = 0;
  private request: typeof fetch;
  private now: () => number;
  constructor(private options: Options) { this.request = options.fetch || ((input, init) => fetch(input, init)); this.now = options.now || Date.now; }
  dispose() { this.disposed = true; this.sourceSequence++; this.contextVersion++; }
  private update(patch: Partial<ReserveView>) { if (this.disposed) return; this.view = { ...this.view, ...patch }; this.options.onChange(this.view); }
  private valid() { return !!this.view.prepared && this.view.prepared.readyUntil > this.now(); }
  private async source(action: "arm" | "refresh" | "disarm" | "session", targetId?: string) {
    const query = new URLSearchParams({ action: "session", studioId: this.options.studioId, room: this.options.room });
    const response = await this.request(action === "session" ? `/api/server-reserve?${query}` : "/api/server-reserve", {
      method: action === "session" ? "GET" : "POST", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { authorization: `Bearer ${this.options.token}`, "content-type": "application/json" },
      ...(action === "session" ? {} : { body: JSON.stringify({ action, studioId: this.options.studioId, room: this.options.room, clientId: this.options.clientId, targetId }) }),
    });
    const result = await readReserveResponse(response);
    if (!response.ok) throw Object.assign(new Error(result.error || "Не удалось подготовить аварийный резерв."), { status: response.status });
    return result;
  }
  private acceptPreparation(result: { armed?: boolean; prepared?: PreparedReserve }) {
    if (this.disposed || this.view.phase === "committed") return;
    if (!result.armed) { this.contextVersion++; this.update({ prepared: undefined, phase: "unprepared", sourceUnavailable: false, error: undefined }); return; }
    const prepared = result.prepared;
    if (!prepared) { this.update({ phase: this.valid() ? this.view.phase : "unprepared", sourceUnavailable: false }); return; }
    if (!prepared.grant || !prepared.peerId || !prepared.cohortId || !isTransferRole(prepared.role) || !Number.isFinite(prepared.readyUntil) || !Number.isFinite(prepared.snapshotAt) || !Number.isSafeInteger(prepared.armGeneration) || !Number.isSafeInteger(prepared.revision) || prepared.readyUntil > this.now() + 300000 || prepared.readyUntil - prepared.snapshotAt > 300000) throw new Error("Сервер вернул недействительную подготовку резерва.");
    parseTransferOrigin(prepared.targetUrl);
    if (prepared.clientTargetUrl) parseTransferOrigin(prepared.clientTargetUrl);
    const current = this.view.prepared;
    if (current?.cohortId === prepared.cohortId && (prepared.armGeneration < current.armGeneration || (prepared.armGeneration === current.armGeneration && prepared.revision < current.revision))) return;
    if (this.view.prepared?.cohortId !== prepared.cohortId || this.view.prepared?.armGeneration !== prepared.armGeneration) this.operationId = undefined;
    this.contextVersion++;
    this.update({ prepared, phase: prepared.readyUntil > this.now() ? "unreachable" : "stale", sourceUnavailable: false, error: undefined });
  }
  async refresh() {
    if (this.refreshing || this.disposed || this.activating || this.view.phase === "committed") return;
    this.refreshing = true;
    const sequence = ++this.sourceSequence;
    try { const result = await this.source(this.options.canActivate ? "refresh" : "session"); if (!this.disposed && sequence === this.sourceSequence) this.acceptPreparation(result); }
    catch (error) {
      if (sequence === this.sourceSequence && !this.disposed) {
        if ((error as { status?: number }).status === 401 || (error as { status?: number }).status === 403) { this.contextVersion++; this.update({ prepared: undefined }); }
        this.update({ sourceUnavailable: true, phase: this.valid() ? this.view.phase : this.view.prepared ? "stale" : "unprepared", error: error instanceof Error ? error.message : "Основной сервер недоступен." });
      }
    }
    finally { this.refreshing = false; }
  }
  async select(targetId: string) {
    if (!this.options.canActivate || this.view.busy || this.disposed || this.view.phase === "committed") return;
    const sequence = ++this.sourceSequence;
    this.contextVersion++;
    this.update({ busy: true, error: undefined });
    try { const result = await this.source(targetId ? "arm" : "disarm", targetId || undefined); if (this.disposed || sequence !== this.sourceSequence) return; this.acceptPreparation(result); await this.refresh(); await this.poll(); }
    catch (error) { this.update({ error: error instanceof Error ? error.message : "Не удалось изменить резерв." }); }
    finally { this.update({ busy: false }); }
  }
  private async direct(action: "status" | "activate" | "redeem") {
    if (!this.valid()) { this.update({ phase: this.view.prepared ? "stale" : "unprepared" }); throw new Error("Аварийный резерв не подготовлен или срок готовности истёк."); }
    const prepared = this.view.prepared!;
    const origin = parseTransferOrigin(prepared.clientTargetUrl || prepared.targetUrl);
    const response = await this.request(`${origin}/api/server-reserve?peerId=${encodeURIComponent(prepared.peerId)}`, {
      method: "POST", credentials: "omit", cache: "no-store", signal: AbortSignal.timeout(8000),
      headers: { "content-type": "application/json", authorization: `Bearer ${prepared.grant}` },
      body: JSON.stringify({ action, cohortId: prepared.cohortId, armGeneration: prepared.armGeneration, revision: prepared.revision, ...(this.operationId ? { operationId: this.operationId } : {}) }),
    });
    const result = await readReserveResponse(response);
    if (!response.ok) throw new Error(result.error || "Аварийный резерв недоступен.");
    if ((result.cohortId !== undefined && result.cohortId !== prepared.cohortId) || (result.armGeneration !== undefined && result.armGeneration !== prepared.armGeneration)) throw new Error("Резерв вернул другую группу подготовленных участников.");
    return result;
  }
  private async handoff(result: Record<string, unknown>) {
    if (this.disposed || this.handedOff || typeof result.ticket !== "string" || !this.view.prepared) return;
    // Direct responses cannot widen the origins acknowledged by the source.
    const approved = [this.view.prepared.targetUrl, this.view.prepared.clientTargetUrl].filter((value): value is string => !!value).map(parseTransferOrigin);
    if (typeof result.targetUrl !== "string" || !approved.includes(parseTransferOrigin(result.targetUrl)) || (typeof result.clientTargetUrl === "string" && !approved.includes(parseTransferOrigin(result.clientTargetUrl)))) throw new Error("Резерв вернул неподтверждённый адрес переноса.");
    await this.options.onHandoff(result, this.view.prepared);
    this.handedOff = true;
  }
  async poll() {
    if (this.polling || this.activating || this.disposed || !this.view.prepared) return;
    if (!this.valid()) { this.update({ phase: "stale" }); return; }
    this.polling = true;
    const version = this.contextVersion;
    try {
      const result = await this.direct("status");
      if (this.disposed || version !== this.contextVersion) return;
      if (result.status === "committed") {
        this.operationId = result.operationId;
        this.update({ phase: "committed", error: undefined });
        if (!this.handedOff) { const ticket = await this.direct("redeem"); if (!this.disposed && version === this.contextVersion) await this.handoff(ticket); }
      } else if (result.status === "armed") this.update({ phase: "ready", error: undefined });
      else if (result.status === "disarmed") this.update({ phase: "unprepared", prepared: undefined });
    } catch (error) { if (!this.disposed && version === this.contextVersion) this.update({ phase: this.valid() ? "unreachable" : "stale", error: error instanceof Error ? error.message : "Резерв недоступен из этого браузера." }); }
    finally { this.polling = false; }
  }
  async activate(): Promise<void> {
    if (!this.options.canActivate) throw new Error("Перенос запускает только основная студия.");
    if (this.disposed) return;
    if (this.activating) return this.activating;
    if (this.view.phase === "committed") { await this.poll(); return; }
    if (this.view.busy) throw new Error("Дождитесь завершения выбора резерва.");
    if (!this.valid()) throw new Error("Аварийный резерв не подготовлен или срок готовности истёк.");
    this.operationId ||= (this.options.newOperationId || (() => crypto.randomUUID()))();
    this.sourceSequence++;
    this.contextVersion++;
    this.update({ busy: true, error: undefined });
    this.activating = (async () => {
      try { const result = await this.direct("activate"); this.update({ phase: "committed" }); await this.handoff(result); }
      catch (error) { this.update({ error: error instanceof Error ? error.message : "Не удалось активировать резерв. Повторите ту же операцию." }); }
      finally { this.activating = undefined; this.update({ busy: false }); }
    })();
    return this.activating;
  }
}
