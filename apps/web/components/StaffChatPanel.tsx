"use client";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ChatEntry } from "@livekit/components-react";
import { useI18n } from "@/components/I18nProvider";
import type { StaffRoomChat } from "@/lib/use-staff-room-chat";

export function StaffChatTab({ chat, active, onOpen }: { chat: StaffRoomChat; active: boolean; onOpen: () => void }) {
  const { t } = useI18n();
  return <button type="button" className="staff-chat-navigation" aria-pressed={active} aria-controls="staff-room-chat" aria-label={chat.badge ? t("Чат: {count} новых сообщений", { count: chat.unread }) : t("Чат")} onClick={onOpen}>
    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.5 8.5 0 01-8.5 8.5H3l2.3-4A8.5 8.5 0 1121 11.5Z" /></svg><span>{t("Чат")}</span>{chat.badge && <span className="staff-chat-badge" aria-hidden="true">{chat.badge}</span>}
  </button>;
}

export function StaffChatPanel(props: { chat: StaffRoomChat; visible: boolean; onClose: () => void }) {
  // Only the chat draft is scoped/remounted; workspace media stays mounted.
  return <StaffChatContent key={props.chat.scope} {...props} />;
}

function StaffChatContent({ chat, visible, onClose }: { chat: StaffRoomChat; visible: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const titleId = useId();
  const inputId = useId();
  const list = useRef<HTMLUListElement>(null);
  const alive = useRef(true);
  const pending = useRef(false);
  const [text, setText] = useState("");
  const [error, setError] = useState(false);
  const [sending, setSending] = useState(false);
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);
  useEffect(() => { if (visible && list.current) list.current.scrollTop = list.current.scrollHeight; }, [visible, chat.messages]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    const message = text.trim();
    if (!message || !chat.connected || chat.isSending || pending.current) return;
    pending.current = true;
    setSending(true);
    setError(false);
    try {
      await chat.send(message);
      if (alive.current) setText("");
    } catch { if (alive.current) setError(true); }
    finally { pending.current = false; if (alive.current) setSending(false); }
  }
  const disabled = !chat.connected || chat.isSending || sending;
  return <section id="staff-room-chat" className="panel staff-chat-panel" hidden={!visible} aria-labelledby={titleId}>
    <header className="staff-chat-header"><h2 id={titleId}>{t("Чат комнаты")}</h2><button type="button" className="button-secondary" aria-label={t("Закрыть чат")} onClick={onClose}>{t("Студия")} <span aria-hidden="true">×</span></button></header>
    <label className="staff-chat-preference"><input type="checkbox" checked={chat.showUnread} onChange={event => chat.setShowUnread(event.target.checked)} />{t("Показывать счётчики новых сообщений")}</label>
    <ul ref={list} className="lk-list lk-chat-messages staff-chat-messages" aria-live={visible ? "polite" : "off"} aria-relevant="additions" aria-label={t("Чат комнаты")}>
      {!chat.messages.length && <li className="muted staff-chat-empty">{t("Пока нет сообщений")}</li>}
      {chat.messages.map(message => <ChatEntry key={message.id} entry={message} />)}
    </ul>
    {!chat.connected && <p className="muted" role="status">{t("Отправка сообщений доступна после подключения к комнате.")}</p>}
    {error && <p className="studio-control-error" role="alert">{t("Не удалось отправить сообщение. Попробуйте ещё раз.")}</p>}
    <form className="staff-chat-form" onSubmit={event => void submit(event)}>
      <label htmlFor={inputId}>{t("Сообщение")}</label><div><input id={inputId} value={text} onChange={event => setText(event.target.value)} placeholder={t("Сообщение…")} maxLength={4000} disabled={disabled} autoComplete="off" /><button type="submit" disabled={disabled || !text.trim()}>{t("Отправить")}</button></div>
    </form>
  </section>;
}
