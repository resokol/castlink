import { sessionHttpBearer } from "./session-http-bearer";
import { RoomEvent, type Room } from "livekit-client";
import { parseGuestDeviceRequest, type GuestDeviceRequest, type GuestDeviceOutcome, type GuestDeviceState } from "./guest-device-control";

export function watchGuestDeviceRequests(room: Room, options: {
  studioId: string; roomName: string; identity: string; token: string;
  state: () => Promise<GuestDeviceState>;
  apply: (request: GuestDeviceRequest, isCurrent: () => boolean) => Promise<"applied" | "saved">;
  onRequest: (request: GuestDeviceRequest | undefined, applying: boolean) => void;
  onError: (message: string) => void;
}) {
  let stopped = false, applying = false, pending: GuestDeviceRequest | undefined;
  let lastIssuedAt = 0;
  const seen = new Map<string, number>();
  const expireSeen = () => { for (const [id, expiry] of seen) if (expiry <= Date.now()) seen.delete(id); };
  const current = (request: GuestDeviceRequest) => !stopped && pending?.id === request.id && request.participantSid === room.localParticipant.sid && room.state === "connected" && request.expiresAt > Date.now();
  let reportTail: Promise<void> = Promise.resolve();
  const reportNow = async (request?: GuestDeviceRequest, outcome?: GuestDeviceOutcome, error?: string) => {
    const sid = room.localParticipant.sid;
    const valid = () => !stopped && room.state === "connected" && sid === room.localParticipant.sid && (!request || sid === request.participantSid && request.expiresAt > Date.now());
    if (!valid()) { if (request) throw new Error("Запрос устройства уже устарел"); return; }
    const state = await options.state();
    if (!valid()) { if (request) throw new Error("Запрос устройства уже устарел"); return; }
    const response = await fetch("/api/guest-device-control", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${sessionHttpBearer(options.token)}` }, signal: AbortSignal.timeout(5000), body: JSON.stringify({ action: "report", studioId: options.studioId, room: options.roomName, identity: options.identity, participantSid: sid, state, ...(request ? { requestId: request.id, outcome, ...(error ? { error } : {}) } : {}) }) });
    if (!response.ok) throw new Error("Не удалось подтвердить студии устройства кастера");
  };
  // Publication/device events can report during replacement. Sample fresh state
  // in order, so a delayed old snapshot can never overwrite the final ACK.
  const report = (request?: GuestDeviceRequest, outcome?: GuestDeviceOutcome, error?: string) => {
    const pendingReport = reportTail.catch(() => undefined).then(() => reportNow(request, outcome, error));
    reportTail = pendingReport;
    return pendingReport;
  };
  const clear = () => { pending = undefined; options.onRequest(undefined, applying); };
  const fail = (cause: unknown) => { if (!stopped) options.onError(cause instanceof Error ? cause.message : "Не удалось ответить студии"); };
  const onData = (payload: Uint8Array, sender?: unknown, _kind?: unknown, topic?: string) => {
    const request = parseGuestDeviceRequest(payload, sender, topic, room.localParticipant.sid);
    expireSeen();
    if (stopped || !request || seen.has(request.id) || request.issuedAt < lastIssuedAt || seen.size >= 256 || room.state !== "connected") return;
    seen.set(request.id, request.expiresAt); lastIssuedAt = request.issuedAt;
    if (pending || applying) return;
    pending = request; options.onRequest(request, false);
  };
  const respond = async (accepted: boolean) => {
    const request = pending;
    if (!request || applying) return;
    if (!current(request)) { clear(); options.onError("Запрос устройства уже устарел"); return; }
    if (!accepted) {
      applying = true; options.onRequest(request, true);
      try { await report(request, "declined"); } catch (cause) { fail(cause); }
      finally { applying = false; if (!pending || pending.id === request.id) clear(); }
      return;
    }
    applying = true; options.onRequest(request, true);
    try {
      const outcome = await options.apply(request, () => current(request));
      if (!current(request)) throw new Error("Смена устройства отменена из-за переподключения или истечения запроса");
      await report(request, outcome);
    } catch (cause) {
      fail(cause);
      if (current(request)) {
        try { await report(request, "failed", cause instanceof Error ? cause.message : "Не удалось сменить устройство"); } catch (reportCause) { fail(reportCause); }
      }
    } finally { applying = false; if (!pending || pending.id === request.id) clear(); }
  };
  const publishState = () => { expireSeen(); void report().catch(fail); };
  const invalidate = () => { if (pending) clear(); };
  room.on(RoomEvent.DataReceived, onData).on(RoomEvent.Disconnected, invalidate).on(RoomEvent.Reconnecting, invalidate).on(RoomEvent.Connected, publishState).on(RoomEvent.Reconnected, publishState);
  const timer = setInterval(() => {
    if (pending && !current(pending) && !applying) { clear(); options.onError("Кастер не ответил на запрос устройства вовремя"); }
    publishState();
  }, 10_000);
  const expiryTimer = setInterval(() => { if (pending && !current(pending) && !applying) { clear(); options.onError("Кастер не ответил на запрос устройства вовремя"); } }, 1000);
  publishState();
  return { respond, report: publishState, stop: () => { stopped = true; pending = undefined; clearInterval(timer); clearInterval(expiryTimer); room.off(RoomEvent.DataReceived, onData).off(RoomEvent.Disconnected, invalidate).off(RoomEvent.Reconnecting, invalidate).off(RoomEvent.Connected, publishState).off(RoomEvent.Reconnected, publishState); } };
}
