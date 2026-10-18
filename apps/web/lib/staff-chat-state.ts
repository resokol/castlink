import type { ReceivedChatMessage } from "@livekit/components-react";

export const STAFF_CHAT_BADGE_STORAGE_KEY = "castlink.staffChat.showUnread";

export type StaffChatState = {
  messages: ReceivedChatMessage[];
  ignoredIds: ReadonlySet<string>;
  unread: number;
  unreadIds: ReadonlySet<string>;
};

// A scope change may precede the SDK's observable reset. Remember its old IDs
// without displaying them, including when the same Room instance is reused.
export function createStaffChatState(baseline: readonly ReceivedChatMessage[] = []): StaffChatState {
  return { messages: [], ignoredIds: new Set(baseline.map(message => message.id)), unread: 0, unreadIds: new Set() };
}

export function markStaffChatRead(state: StaffChatState): StaffChatState {
  return state.unread ? { ...state, unread: 0, unreadIds: new Set() } : state;
}

export function receiveStaffChat(state: StaffChatState, incoming: readonly ReceivedChatMessage[], visible: boolean, selfIdentity: string, readIds: ReadonlySet<string> = new Set(), cutoff?: number): StaffChatState {
  const messages = new Map(state.messages.filter(message => cutoff === undefined || message.timestamp > cutoff).map(message => [message.id, message]));
  const unreadIds = visible ? new Set<string>() : new Set([...state.unreadIds].filter(id => messages.has(id) && !readIds.has(id)));
  for (const message of incoming) {
    if (cutoff !== undefined && message.timestamp <= cutoff) continue;
    if (messages.has(message.id)) {
      const previous = messages.get(message.id);
      if (previous && (message.attributes?.["castlink.persisted"] === "1" || (message.editTimestamp ?? message.timestamp) >= (previous.editTimestamp ?? previous.timestamp))) messages.set(message.id, message);
      continue;
    }
    if (state.ignoredIds.has(message.id)) continue;
    messages.set(message.id, message);
    const self = message.from?.isLocal === true || (!!selfIdentity && message.from?.identity === selfIdentity);
    if (!visible && !self && !readIds.has(message.id)) unreadIds.add(message.id);
  }
  return { messages: [...messages.values()], ignoredIds: state.ignoredIds, unread: unreadIds.size, unreadIds };
}

export function parseStaffChatBadgePreference(raw: string | null): boolean { return raw !== "false"; }
export function staffChatBadge(unread: number, enabled: boolean): string { return enabled && unread > 0 ? unread > 99 ? "99+" : String(unread) : ""; }
