"use client";
import { useState } from "react";
import { useI18n } from "./I18nProvider";
import { GuestAvCheck } from "./GuestAvCheck";
import type { GuestChoices } from "@/lib/guest-media";
export function GuestWaitingPanel({name,roomName,onChoices,onLeave}:{name:string;roomName:string;onChoices:(choices:GuestChoices)=>void;onLeave:()=>void}){
 const {t}=useI18n();const [ready,setReady]=useState(false);
 return <div className="guest-waiting"><section className="panel guest-waiting-status" role="status"><h1>{t("Ожидание допуска")}</h1><p>{t("Пожалуйста, подождите, пока модератор добавит вас в комнату")}</p><p className="muted">{name} · {roomName}</p>{ready&&<button type="button" className="button-secondary" onClick={()=>setReady(false)}>{t("Проверить устройства")}</button>}<button type="button" className="button-secondary" onClick={onLeave}>{t("Выйти из комнаты")}</button></section>{!ready&&<GuestAvCheck name={name} roomName={roomName} joinLabel={t("Устройства готовы")} onJoin={choices=>{onChoices(choices);setReady(true);}}/>}</div>;
}
