"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";
import styles from "./ServerRecovery.module.css";

type Grant = { code: string; expiresAt: number };
type State = { context: string; open: boolean; grant?: Grant; busy?: "issue" | "revoke"; error?: string; notice?: string };

export function RecoveryCode({ peerId, room, studioId, disabled = false }: { peerId: string; room?: string; studioId?: string; disabled?: boolean }) {
  const { t, locale } = useI18n();
  const context = JSON.stringify([peerId, room, studioId]);
  const [state, setState] = useState<State>({ context, open: false });
  const version = useRef(0), active = useRef<AbortController | null>(null), currentContext = useRef(context);
  const toggle = useRef<HTMLButtonElement | null>(null);
  currentContext.current = context;
  const current: State = state.context === context ? state : { context, open: false };

  useEffect(() => {
    setState(previous => previous.context === context ? previous : { context, open: false });
    return () => { version.current++; active.current?.abort(); active.current = null; };
  }, [context]);

  const expiresAt = current.grant?.expiresAt;
  useEffect(() => {
    if (!expiresAt) return;
    const timer = setTimeout(() => setState(previous => previous.context === context && previous.grant?.expiresAt === expiresAt
      ? { context, open: previous.open, notice: "Срок действия кода истёк. Создай новый код." } : previous), Math.max(0, expiresAt - Date.now()));
    return () => clearTimeout(timer);
  }, [context, expiresAt]);

  function close() {
    version.current++; active.current?.abort(); active.current = null;
    setState({ context, open: false });
    toggle.current?.focus();
  }

  async function act(action: "issue" | "revoke") {
    if (disabled || active.current) return;
    const sequence = ++version.current, controller = new AbortController(); active.current = controller;
    const stillCurrent = () => version.current === sequence && currentContext.current === context;
    const deadline = setTimeout(() => controller.abort(), 20000);
    setState(previous => ({ context, open: true, ...(action === "revoke" && previous.context === context ? { grant: previous.grant } : {}), busy: action }));
    try {
      const response = await fetch("/api/server-recovery", {
        method: "POST", cache: "no-store", credentials: "same-origin", signal: controller.signal,
        headers: { "content-type": "application/json" }, body: JSON.stringify({ action, peerId, ...(room ? { room } : {}), ...(studioId ? { studioId } : {}) }),
      });
      const data = await response.json();
      if (!stillCurrent()) return;
      if (!response.ok) throw new Error(data.error || "Не удалось выполнить восстановление связи. Повтори попытку.");
      if (action === "issue") {
        if (typeof data.code !== "string" || !data.code || data.code.length > 65536 || !Number.isFinite(data.expiresAt) || data.expiresAt <= Date.now()) throw new Error("Не удалось создать код восстановления. Повтори попытку.");
        setState({ context, open: true, grant: { code: data.code, expiresAt: data.expiresAt } });
      } else {
        if (data.revoked !== true) throw new Error("Не удалось отозвать код. Повтори попытку.");
        setState({ context, open: true, notice: "Код отозван." });
      }
    } catch (cause) {
      if (stillCurrent()) setState(previous => ({ ...previous, busy: undefined, error: controller.signal.aborted ? "Ответ сервера не получен вовремя. Повтори попытку; прежний код мог измениться." : cause instanceof Error ? cause.message : "Не удалось выполнить восстановление связи. Повтори попытку." }));
    } finally {
      clearTimeout(deadline);
      if (stillCurrent()) active.current = null;
    }
  }

  async function copy() {
    const grant = current.grant, sequence = version.current;
    if (!grant || grant.expiresAt <= Date.now()) return;
    let notice = "Код скопирован.";
    try { await navigator.clipboard.writeText(grant.code); }
    catch { notice = "Не удалось скопировать автоматически. Скопируй код из поля."; }
    if (version.current === sequence && currentContext.current === context) setState(previous => previous.grant === grant ? { ...previous, notice } : previous);
  }

  return <div className={styles.recovery}>
    <button ref={toggle} type="button" className="button-secondary" disabled={disabled} aria-expanded={current.open} onClick={() => current.open ? close() : setState({ context, open: true })}>{t("Восстановить связь")}</button>
    {current.open && <div className={styles.content} role="group" aria-label={t("Восстановление связи сервера")} aria-busy={Boolean(current.busy)}>
      <p className="muted">{t("На новом компьютере установи CastLink. В Windows вставь код в раздел восстановления связи серверной панели; в Linux запусти установщик с командой recover. Файлы со старого компьютера не нужны. Код действует 10 минут.")}</p>
      <p className="muted">{t("Код разрешает заменить только это подключение. Передай его только владельцу нового сервера. После восстановления подготовь резерв заново.")}</p>
      {current.grant && <>
        <label>{t("Код восстановления")}<textarea className={styles.code} aria-label={t("Код восстановления")} value={current.grant.code} readOnly autoComplete="off" spellCheck={false} rows={4} onFocus={event => event.target.select()} /></label>
        <p role="status">{t("Действует до {time}", { time: new Date(current.grant.expiresAt).toLocaleString(locale) })}</p>
      </>}
      <div className={styles.actions}>
        <button type="button" disabled={disabled || Boolean(current.busy)} onClick={() => act("issue")}>{current.busy === "issue" ? t("Создаём код…") : t("Создать код на 10 минут")}</button>
        {current.grant && <button type="button" className="button-secondary" disabled={Boolean(current.busy)} onClick={copy}>{t("Скопировать код")}</button>}
        <button type="button" className="button-secondary" disabled={disabled || Boolean(current.busy)} onClick={() => act("revoke")}>{current.busy === "revoke" ? t("Отзываем код…") : t("Отозвать код")}</button>
        <button type="button" className="button-secondary" onClick={close}>{t("Закрыть")}</button>
      </div>
      {current.error && <p className="av-error" role="alert">{translateManagementMessage(current.error, t)}</p>}
      {current.notice && <p role="status">{translateManagementMessage(current.notice, t)}</p>}
    </div>}
  </div>;
}
