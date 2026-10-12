"use client";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { ChatEntry, ChatToggle, useChat, useLayoutContext } from "@livekit/components-react";

/** Keep LiveKit's transport and message state; localize only its presentation. */
export function RoomChat({ visible }: { visible: boolean }) {
  const { chatMessages, send, isSending } = useChat();
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
    const unread = visible ? 0 : chatMessages.filter(message => message.timestamp > lastRead.current).length;
    if (layout.widget.state?.unreadMessages !== unread) layout.widget.dispatch?.({ msg: "unread_msg", count: unread });
  }, [chatMessages, visible, layout.widget]);
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
  return <section className="lk-chat castlink-chat" aria-label="Чат комнаты" hidden={!visible} style={{ display: visible ? "grid" : "none" }}>
    <div className="lk-chat-header"><strong>Чат</strong><ChatToggle aria-label="Закрыть чат" title="Закрыть чат">Закрыть</ChatToggle></div>
    <ul className="lk-list lk-chat-messages" ref={list} aria-live="polite" aria-relevant="additions">
      {chatMessages.map(message => <ChatEntry key={message.id} entry={message} />)}
    </ul>
    <div>{error && <p className="castlink-chat-error" role="alert">{error}</p>}<form className="lk-chat-form" onSubmit={event => void submit(event)}>
      <input className="lk-form-control lk-chat-form-input" ref={input} aria-label="Сообщение" placeholder="Сообщение…" disabled={isSending} maxLength={4000} />
      <button className="lk-button lk-chat-form-button" type="submit" disabled={isSending}>Отправить</button>
    </form></div>
  </section>;
}
