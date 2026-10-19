"use client";

import { useI18n } from "@/components/I18nProvider";
import { translateWorkspaceMessage } from "@/lib/i18n/workspaces";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChatEntry, ChatToggle, useRoomContext, useLayoutContext } from "@livekit/components-react";
import { usePersistentRoomChat, type RoomChatSession } from "@/lib/use-persistent-room-chat";

/** Keep LiveKit's transport and message state; localize only its presentation. */
export function RoomChat({ visible, session, persistent = false }: { visible: boolean; session?: RoomChatSession; persistent?: boolean }) {
  const { t, locale } = useI18n();
  const room = useRoomContext();
  const { chatMessages, send, isSending, initialIds, historyError } = usePersistentRoomChat(room, JSON.stringify([session?.studioId, session?.roomName]), session);
  const layout = useLayoutContext();
  const list = useRef<HTMLUListElement>(null);
  const input = useRef<HTMLInputElement>(null);
  const lastRead = useRef(0);
  const [error, setError] = useState("");
  useEffect(() => {
    if (visible) {
      lastRead.current = chatMessages.at(-1)?.timestamp || lastRead.current;
      list.current?.scrollTo({ top: list.current.scrollHeight });
    }
    const unread = visible ? 0 : chatMessages.filter(message => message.timestamp > lastRead.current && !initialIds.has(message.id)).length;
    if (layout.widget.state?.unreadMessages !== unread) layout.widget.dispatch?.({ msg: "unread_msg", count: unread });
  }, [chatMessages, visible, layout.widget, initialIds]);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const text = input.current?.value.trim();
    if (!text || isSending) return;
    setError("");
    try {
      await send(text);
      if (input.current) { input.current.value = ""; input.current.focus(); }
    } catch { setError("Не удалось отправить сообщение. Попробуйте ещё раз."); }
  };
  return <section className="lk-chat castlink-chat" aria-label={t("Чат комнаты")} hidden={!visible} style={{ display: visible ? "grid" : "none" }}>
    <div className="lk-chat-header"><strong>{t("Чат")}</strong>{!persistent && <ChatToggle aria-label={t("Закрыть чат")} title={t("Закрыть чат")}>{t("Закрыть")}</ChatToggle>}</div>
    <ul className="lk-list lk-chat-messages" ref={list} aria-live="polite" aria-relevant="additions">
      {chatMessages.map(message => <ChatEntry key={message.id} entry={message} />)}
    </ul>
    <div>{historyError && <p className="castlink-chat-error" role="status">{t("История чата временно недоступна. Повторяем загрузку…")}</p>}{error && <p className="castlink-chat-error" role="alert">{translateWorkspaceMessage(t, error)}</p>}<form className="lk-chat-form" onSubmit={event => void submit(event)}>
      <input className="lk-form-control lk-chat-form-input" ref={input} aria-label={t("Сообщение")} placeholder={t("Сообщение…")} disabled={isSending} maxLength={4000} />
      <button className="lk-button lk-chat-form-button" type="submit" disabled={isSending}>{t("Отправить")}</button>
    </form></div>
  </section>;
}
