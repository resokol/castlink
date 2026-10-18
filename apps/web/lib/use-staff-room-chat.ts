"use client";
import { useEffect, useRef, useState } from "react";
import { useConnectionState } from "@livekit/components-react";
import { ConnectionState, type Room } from "livekit-client";
import { createStaffChatState, markStaffChatRead, parseStaffChatBadgePreference, receiveStaffChat, STAFF_CHAT_BADGE_STORAGE_KEY, staffChatBadge } from "@/lib/staff-chat-state";
import { usePersistentRoomChat, type RoomChatSession } from "./use-persistent-room-chat";

export function useStaffRoomChat({ room, scope, visible, session }: { room: Room; scope: string; visible: boolean; session?: RoomChatSession }) {
  const { chatMessages, send, isSending, historyReady, historyError, initialIds } = usePersistentRoomChat(room, scope, session);
  const connectionState = useConnectionState(room);
  const current = useRef({ room, scope, state: createStaffChatState() });
  const [snapshot, setSnapshot] = useState(current.current);
  if (current.current.room !== room || current.current.scope !== scope) {
    current.current = { room, scope, state: createStaffChatState(chatMessages) };
  }
  useEffect(() => {
    if (!historyReady) return;
    if (current.current.room !== room || current.current.scope !== scope) return;
    current.current = { room, scope, state: receiveStaffChat(current.current.state, chatMessages, visible, room.localParticipant.identity, initialIds, session ? Date.now() - 86_400_000 : undefined) };
    setSnapshot(current.current);
  }, [room, scope, chatMessages, visible, historyReady, initialIds, !!session]);

  const [showUnread, setShowUnread] = useState(true);
  const [preferenceLoaded, setPreferenceLoaded] = useState(false);
  useEffect(() => {
    try { setShowUnread(parseStaffChatBadgePreference(window.localStorage.getItem(STAFF_CHAT_BADGE_STORAGE_KEY))); } catch { /* Browser storage can be unavailable. */ }
    setPreferenceLoaded(true);
  }, []);
  useEffect(() => {
    if (!preferenceLoaded) return;
    try { window.localStorage.setItem(STAFF_CHAT_BADGE_STORAGE_KEY, String(showUnread)); } catch { /* Preference still works for this session. */ }
  }, [preferenceLoaded, showUnread]);

  const state = snapshot.room === room && snapshot.scope === scope ? snapshot.state : current.current.state;
  const unread = visible ? 0 : state.unread;
  return { scope, messages: state.messages, send, isSending, historyError, connected: connectionState === ConnectionState.Connected, unread, showUnread, setShowUnread, badge: staffChatBadge(unread, showUnread), markRead: () => {
    current.current = { ...current.current, state: markStaffChatRead(current.current.state) };
    setSnapshot(current.current);
  } };
}

export type StaffRoomChat = ReturnType<typeof useStaffRoomChat>;
