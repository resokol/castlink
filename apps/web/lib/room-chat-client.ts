import type { ReceivedChatMessage } from "@livekit/components-react";
import type { StoredRoomChatMessage } from "./room-chat-types";

export function mergeRoomChat(history: readonly StoredRoomChatMessage[], live: readonly ReceivedChatMessage[], selfIdentity: string, ignored: ReadonlySet<string> = new Set(), now = Date.now(), generation = 0): ReceivedChatMessage[] {
  const messages = new Map<string, ReceivedChatMessage>();
  for (const message of live) {
    if ((message.attributes?.["castlink.chatGeneration"] ?? "0") !== String(generation)) continue;
    if (ignored.has(message.id) || message.timestamp <= now - 86_400_000) continue;
    const id = message.attributes?.["castlink.chatId"] || message.id;
    const attributes = { ...message.attributes };
    delete attributes["castlink.persisted"];
    messages.set(id, { ...message, id, attributes });
  }
  // Persisted server identity/name/time take precedence over transient SDK fields.
  for (const message of history) {
    if (message.timestamp <= now - 86_400_000) continue;
    messages.set(message.id, { id: message.id, message: message.message, timestamp: message.timestamp,
      type: "chatMessage", attributes: { "castlink.persisted": "1" }, from: { identity: message.identity, name: message.name, isLocal: message.identity === selfIdentity } as ReceivedChatMessage["from"] });
  }
  return [...messages.values()].sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id));
}
