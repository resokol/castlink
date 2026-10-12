import { RoomEvent, type Room } from "livekit-client";
import { parseGuestMediaSettingsCommand, type GuestMediaSettingsPatch, type GuestMediaSettingsState } from "./guest-media-control";

export function watchGuestMediaSettings(room: Room, options: { studioId: string; roomName: string; identity: string; token: string; state: () => GuestMediaSettingsState; apply: (patch: GuestMediaSettingsPatch) => Promise<void>; onError: (message: string) => void }) {
  let stopped = false, applying = false;
  const seen = new Map<string, number>();
  const expireSeen = () => { for (const [id, expiresAt] of seen) if (expiresAt <= Date.now()) seen.delete(id); };
  const report = async (commandId?: string, error?: string, targetSid?: string) => {
    if (stopped || room.state !== "connected" && !error) return;
    const response = await fetch("/api/guest-media-control", { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${options.token}` }, signal: AbortSignal.timeout(5000), body: JSON.stringify({ action: "report", studioId: options.studioId, room: options.roomName, identity: options.identity, participantSid: error && room.state !== "connected" ? targetSid : room.localParticipant.sid || targetSid, state: options.state(), ...(commandId ? { commandId } : {}), ...(error ? { error } : {}) }) });
    if (!response.ok) throw new Error("Не удалось подтвердить студии настройки гостя");
  };
  const onData = (payload: Uint8Array, sender?: unknown, _kind?: unknown, topic?: string) => {
    const command = parseGuestMediaSettingsCommand(payload, sender, topic, room.localParticipant.sid);
    expireSeen();
    if (stopped || !command || seen.has(command.id)) return;
    if (seen.size >= 256) return;
    seen.set(command.id, command.expiresAt);
    void (async () => {
      let error: string | undefined;
      let ownsApply = false;
      try {
        if (applying) throw new Error("Предыдущая команда ещё выполняется");
        applying = ownsApply = true;
        await options.apply(command.patch);
      } catch (cause) { error = cause instanceof Error ? cause.message : "Не удалось изменить настройки"; if (!stopped) options.onError(error); }
      finally { if (ownsApply) applying = false; }
      try { await report(command.id, error, command.participantSid); }
      catch (cause) { if (!stopped) options.onError(cause instanceof Error ? cause.message : "Не удалось ответить студии"); }
    })();
  };
  room.on(RoomEvent.DataReceived, onData);
  const publishState = () => { expireSeen(); void report().catch(cause => { if (!stopped) options.onError(cause instanceof Error ? cause.message : "Не удалось ответить студии"); }); };
  const timer = setInterval(publishState, 15_000);
  return { report: publishState, stop: () => { stopped = true; clearInterval(timer); room.off(RoomEvent.DataReceived, onData); } };
}
