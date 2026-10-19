"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { useChat, useConnectionState } from "@livekit/components-react";
import { ConnectionState, RoomEvent, type Room } from "livekit-client";
import { mergeRoomChat } from "./room-chat-client";
import type { StoredRoomChatMessage } from "./room-chat-types";

export type RoomChatSession = { token: string; studioId: string; roomName: string };
const EMPTY_IDS: ReadonlySet<string> = new Set();
const CLEAR_TOPIC = "castlink.chat.cleared";
type Snapshot = { generation: number; owner: object; messages: StoredRoomChatMessage[]; ready: boolean; error: boolean; initialIds: ReadonlySet<string> };

export function usePersistentRoomChat(room: Room, scope: string, session?: RoomChatSession) {
  const options = useMemo(() => ({ room }), [room]);
  const sdk = useChat(options);
  const connected = useConnectionState(room) === ConnectionState.Connected;
  const current = useRef({ room, scope, owner: {}, generation: 0, ignored: new Set<string>() });
  if (current.current.room !== room || current.current.scope !== scope) current.current = { room, scope, owner: {}, generation: 0, ignored: new Set(sdk.chatMessages.map(message => message.id)) };
  const owner = current.current.owner;
  const [snapshot, setSnapshot] = useState<Snapshot>({ generation: 0, owner, messages: [], ready: false, error: false, initialIds: EMPTY_IDS });
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const clearFlight = useRef<object | null>(null);
  const [refresh, setRefresh] = useState(0);
  const attempt = useRef<{ owner: object; text: string; id: string; generation: number } | null>(null);
  const flight = useRef<object | null>(null);
  const token = session?.token, studioId = session?.studioId, roomName = session?.roomName;
  const url = studioId && roomName ? `/api/room-chat?${new URLSearchParams({ studioId, room: roomName })}` : "";
  useEffect(() => {
    if (!url) return;
    let lastRefresh = 0;
    const changed = (_payload: Uint8Array, _participant: unknown, _kind: unknown, topic?: string) => {
      // A peer notification is only a hint. Fetch the authenticated server snapshot.
      if (topic !== CLEAR_TOPIC || Date.now() - lastRefresh < 1000) return;
      lastRefresh = Date.now(); setRefresh(value => value + 1);
    };
    room.on(RoomEvent.DataReceived, changed);
    return () => { room.off(RoomEvent.DataReceived, changed); };
  }, [room, url]);
  useEffect(() => {
    if (!url || !token || !connected) return;
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function update() {
      try {
        const response = await fetch(url, { headers: { authorization: `Bearer ${token}` }, cache: "no-store", signal: controller.signal });
        if (!response.ok) throw Error("history");
        const data = await response.json();
        const generation = data.generation ?? 0;
        if (!Array.isArray(data.messages) || !Number.isSafeInteger(generation) || generation < 0) throw Error("history");
        if (!controller.signal.aborted && current.current.owner === owner && generation >= current.current.generation) {
          current.current.generation = generation;
          setSnapshot(previous => ({ owner, generation, messages: data.messages, ready: true, error: false,
            initialIds: previous.owner === owner && previous.ready ? previous.initialIds : new Set<string>(data.messages.map((message: StoredRoomChatMessage) => message.id)) }));
        }
      } catch {
        if (!controller.signal.aborted && current.current.owner === owner) setSnapshot(previous => ({ generation: current.current.generation, owner, messages: previous.owner === owner ? previous.messages : [], ready: previous.owner === owner && previous.ready, error: true, initialIds: previous.owner === owner ? previous.initialIds : EMPTY_IDS }));
      } finally { if (!controller.signal.aborted) timer = setTimeout(update, 5000); }
    }
    void update();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [url, token, connected, owner, refresh]);
  const state = useMemo(() => snapshot.owner === owner ? snapshot : { generation: 0, owner, messages: [], ready: false, error: false, initialIds: EMPTY_IDS }, [snapshot, owner]);
  const messages = useMemo(() => session ? mergeRoomChat(state.messages, sdk.chatMessages, room.localParticipant.identity, current.current.ignored, Date.now(), state.generation) : sdk.chatMessages,
    [!!session, state.generation, state.messages, sdk.chatMessages, room.localParticipant.identity, owner]);
  async function send(text: string) {
    if (!session) return sdk.send(text);
    if (!token || !url || !connected || flight.current === owner || clearFlight.current === owner) throw Error("Chat is not connected");
    flight.current = owner; setSaving(true);
    const pending = attempt.current?.owner === owner && attempt.current.text === text && attempt.current.generation === current.current.generation ? attempt.current : { owner, text, id: crypto.randomUUID(), generation: current.current.generation };
    attempt.current = pending;
    try {
      const response = await fetch(url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${token}` }, body: JSON.stringify({ id: pending.id, message: text, generation: pending.generation }), signal: AbortSignal.timeout(15000) });
      if (!response.ok) { if (response.status === 409 && current.current.owner === owner) { attempt.current = null; setRefresh(value => value + 1); } throw Error("Chat was not saved"); }
      const data = await response.json() as { message: StoredRoomChatMessage; generation?: number };
      if (current.current.owner !== owner || (data.generation ?? 0) < current.current.generation) return;
      current.current.generation = data.generation ?? 0;
      attempt.current = null;
      setSnapshot(previous => ({ generation: data.generation ?? 0, owner, ready: previous.owner === owner && previous.ready, initialIds: previous.owner === owner ? previous.initialIds : EMPTY_IDS,
        error: false, messages: [...(previous.owner === owner ? previous.messages.filter(value => value.id !== data.message.id) : []), data.message] }));
      // The durable message also reaches peers through polling if the transient
      // data stream fails after the save. Never ask the user to resend it.
      try { await sdk.send(data.message.message, { attributes: { "castlink.chatId": data.message.id, "castlink.chatGeneration": String(data.generation ?? 0) } }); } catch { /* Server history is authoritative. */ }
    } finally { if (flight.current === owner) flight.current = null; if (current.current.owner === owner) setSaving(false); }
  }
  async function clear() {
    if (!session || !token || !url || !connected || clearFlight.current === owner) throw Error("Chat is not connected");
    clearFlight.current = owner; setClearing(true);
    try {
      const response = await fetch(url, { method: "DELETE", headers: { authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw Error("Chat was not cleared");
      const data = await response.json();
      if (!Number.isSafeInteger(data.generation) || data.generation < 1) throw Error("Invalid chat generation");
      if (current.current.owner !== owner || data.generation < current.current.generation) return;
      current.current.generation = data.generation;
      attempt.current = null;
      setSnapshot(previous => previous.owner === owner && previous.generation === data.generation
        ? { ...previous, ready: true, error: false }
        : { owner, generation: data.generation, messages: [], ready: true, error: false, initialIds: EMPTY_IDS });
      setRefresh(value => value + 1);
      try { await room.localParticipant.publishData(new Uint8Array(), { reliable: true, topic: CLEAR_TOPIC }); } catch { /* Polling reconciles peers if the notification fails. */ }
    } finally { if (clearFlight.current === owner) clearFlight.current = null; if (current.current.owner === owner) setClearing(false); }
  }
  return { clear, isClearing: clearing && clearFlight.current === owner, generation: state.generation, chatMessages: messages, send, initialIds: state.initialIds, isSending: sdk.isSending || saving && flight.current === owner, historyReady: !session || state.ready, historyError: !!session && state.error };
}
