"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat, useConnectionState } from "@livekit/components-react";
import { ConnectionState, type Room } from "livekit-client";
import { mergeRoomChat } from "./room-chat-client";
import type { StoredRoomChatMessage } from "./room-chat-types";

export type RoomChatSession = { token: string; studioId: string; roomName: string };
const EMPTY_IDS: ReadonlySet<string> = new Set();
type Snapshot = { owner: object; messages: StoredRoomChatMessage[]; ready: boolean; error: boolean; initialIds: ReadonlySet<string> };

export function usePersistentRoomChat(room: Room, scope: string, session?: RoomChatSession) {
  const options = useMemo(() => ({ room }), [room]);
  const sdk = useChat(options);
  const connected = useConnectionState(room) === ConnectionState.Connected;
  const current = useRef({ room, scope, owner: {}, ignored: new Set<string>() });
  if (current.current.room !== room || current.current.scope !== scope) current.current = { room, scope, owner: {}, ignored: new Set(sdk.chatMessages.map(message => message.id)) };
  const owner = current.current.owner;
  const [snapshot, setSnapshot] = useState<Snapshot>({ owner, messages: [], ready: false, error: false, initialIds: EMPTY_IDS });
  const [saving, setSaving] = useState(false);
  const attempt = useRef<{ owner: object; text: string; id: string } | null>(null);
  const flight = useRef<object | null>(null);
  const token = session?.token, studioId = session?.studioId, roomName = session?.roomName;
  const url = studioId && roomName ? `/api/room-chat?${new URLSearchParams({ studioId, room: roomName })}` : "";
  useEffect(() => {
    if (!url || !token || !connected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function update() {
      try {
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        if (!response.ok) throw Error("history");
        const data = await response.json();
        if (!Array.isArray(data.messages)) throw Error("history");
        if (!controller.signal.aborted && current.current.owner === owner) setSnapshot(previous => ({ owner, messages: data.messages, ready: true, error: false,
          initialIds: previous.owner === owner && previous.ready ? previous.initialIds : new Set<string>(data.messages.map((message: StoredRoomChatMessage) => message.id)) }));
      } catch {
        if (!controller.signal.aborted && current.current.owner === owner) setSnapshot(previous => ({ owner, messages: previous.owner === owner ? previous.messages : [], ready: previous.owner === owner && previous.ready, error: true, initialIds: previous.owner === owner ? previous.initialIds : EMPTY_IDS }));
      } finally { if (!controller.signal.aborted) timer = setTimeout(update, 5000); }
    }
    void update();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [url, token, connected, owner]);
  const state = useMemo(() => snapshot.owner === owner ? snapshot : { owner, messages: [], ready: false, error: false, initialIds: EMPTY_IDS }, [snapshot, owner]);
  const messages = useMemo(() => session ? mergeRoomChat(state.messages, sdk.chatMessages, room.localParticipant.identity, current.current.ignored) : sdk.chatMessages,
    [!!session, state.messages, sdk.chatMessages, room.localParticipant.identity, owner]);
  async function send(text: string) {
    if (!session) return sdk.send(text);
    if (!token || !url || !connected || flight.current === owner) throw Error("Chat is not connected");
    flight.current = owner; setSaving(true);
    const pending = attempt.current?.owner === owner && attempt.current.text === text ? attempt.current : { owner, text, id: crypto.randomUUID() };
    attempt.current = pending;
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ id: pending.id, message: text }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error("Chat was not saved");
      const data = await response.json() as { message: StoredRoomChatMessage };
      if (current.current.owner !== owner) return;
      attempt.current = null;
      setSnapshot(previous => ({ owner, ready: previous.owner === owner && previous.ready, initialIds: previous.owner === owner ? previous.initialIds : EMPTY_IDS,
        error: false, messages: [...(previous.owner === owner ? previous.messages.filter(value => value.id !== data.message.id) : []), data.message] }));
      // The durable message also reaches peers through polling if the transient
      // data stream fails after the save. Never ask the user to resend it.
      try { await sdk.send(data.message.message, { attributes: { "castlink.chatId": data.message.id } }); } catch { /* Server history is authoritative. */ }
    } finally { if (flight.current === owner) flight.current = null; if (current.current.owner === owner) setSaving(false); }
  }
  return { chatMessages: messages, send, initialIds: state.initialIds, isSending: sdk.isSending || saving && flight.current === owner, historyReady: !session || state.ready, historyError: !!session && state.error };
}
