"use client";
import { useI18n } from "@/components/I18nProvider";
import { useEffect,useState,type ReactNode } from "react";
import styles from "./StudioEntry.module.css";
export function PlatformAccessGate({children}:{children:ReactNode}) {
  const { t } = useI18n();
  const [state,setState]=useState<"checking"|"allowed"|"denied">("checking");
  useEffect(()=>{
    const controller=new AbortController();
    void fetch("/api/super-admin-access",{cache:"no-store",signal:controller.signal})
      .then(async response=>{const data=await response.json();if(!controller.signal.aborted)setState(response.ok&&data.allowed===true?"allowed":"denied");})
      .catch(()=>{if(!controller.signal.aborted)setState("denied");});
    return ()=>controller.abort();
  },[]);
  if(state==="allowed") return <>{children}</>;
  return <main className={`${styles.entryPage} ops-entry`}><section className={`${styles.entryCard} ops-card ops-access-state`}><h1>{t("Управление платформой")}</h1>
    <p>{state==="checking"?t("Проверяем доступ…"):t("Нужна отдельная сессия Super Admin. Доступ студии и персонала комнаты здесь не подходит.")}</p>
    {state==="denied"&&<a href="/super-admin">{t("Перейти ко входу Super Admin")}</a>}
  </section></main>;
}
