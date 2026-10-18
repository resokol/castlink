"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import type { CasterSlot } from "@/lib/caster-slot-types";
type Slot=CasterSlot&{cameraPath:string;screenPath:string};
type Queue={id:string;name:string;identity:string;state:string;proposedSlotId?:string};
type Data={slots:Slot[];invites:{id:string;path:string}[];queue:Queue[]};
export function CasterSlotsPanel({studioId,roomName,active=true}:{studioId:string;roomName:string;active?:boolean}){
 const {t}=useI18n(),[data,setData]=useState<Data>({slots:[],invites:[],queue:[]}),[name,setName]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState("");
 const scope=JSON.stringify([studioId,roomName]),generation=useRef(0),flight=useRef(false);
 useEffect(()=>{const mine=++generation.current,abort=new AbortController();let timer:ReturnType<typeof setTimeout>;setData({slots:[],invites:[],queue:[]});setError("");setMessage("");setName("");
  if(!active)return;
  const poll=async()=>{try{if(!flight.current){const response=await fetch(`/api/caster-slots?${new URLSearchParams({studioId,room:roomName})}`,{cache:"no-store",signal:abort.signal});const next=await response.json();if(!response.ok)throw Error(next.error);if(generation.current===mine){setData(next);setError("");}}}catch(e){if(!abort.signal.aborted&&generation.current===mine)setError(e instanceof Error?e.message:"Не удалось загрузить слоты");}finally{if(!abort.signal.aborted)timer=setTimeout(poll,3000);}};
  void poll();return()=>{abort.abort();clearTimeout(timer);};
 },[scope,active]);
 const run=async(body:Record<string,unknown>)=>{
  if(flight.current)return;flight.current=true;setBusy(true);setError("");setMessage("");const mine=generation.current;
  try{const response=await fetch("/api/caster-slots",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({studioId,room:roomName,...body})});const next=await response.json();if(!response.ok)throw Error(next.error);if(mine===generation.current){setData(next);if(body.action==="create")setName("");setMessage("Слот обновлён");}return next as Data;}
  catch(e){if(mine===generation.current)setError(e instanceof Error?e.message:"Не удалось изменить слот");}
  finally{flight.current=false;setBusy(false);}
 };
 const copy=async(path:string)=>{try{await navigator.clipboard.writeText(new URL(path,window.location.origin).href);setMessage("Ссылка скопирована");}catch{setError("Скопируйте ссылку из поля");}};
 return <section className="panel caster-slots-panel" hidden={!active} aria-label={t("Слоты кастеров")}>
  <div className="section-heading"><div><h2>{t("Слоты кастеров")}</h2><p className="muted">{t("Постоянные выходы для OBS/vMix. Смена кастера сохраняет ссылки.")}</p></div></div>
  <form className="slot-create" onSubmit={e=>{e.preventDefault();void run({action:"create",name});}}><label>{t("Имя слота")}<input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label><button disabled={busy||!name.trim()}>{t("Создать слот")}</button></form>
  <div className="slot-queue"><strong>{t("Кастеры в комнате")}</strong><span>{data.queue.map(q=>q.name).join(", ")||t("Нет подключённых кастеров")}</span></div>
  {data.slots.map(slot=><SlotRow key={`${scope}:${slot.id}`} slot={slot} data={data} busy={busy} run={run} copy={copy}/>)}
  {!!data.slots.length&&<button type="button" className="button-secondary" disabled={busy} onClick={()=>void run({action:"create-invite"})}>{t("Создать отдельный инвайт")}</button>}
  {error&&<p role="alert" className="studio-control-error">{t(error)}</p>}{message&&<p role="status">{t(message)}</p>}
 </section>;
}
function SlotRow({slot,data,busy,run,copy}:{slot:Slot;data:Data;busy:boolean;run:(body:Record<string,unknown>)=>Promise<Data|undefined>;copy:(path:string)=>Promise<void>}){
 const {t}=useI18n(),[name,setName]=useState(slot.name),[inviteId,setInviteId]=useState(slot.inviteId),[admissionId,setAdmissionId]=useState("");
 useEffect(()=>{setName(slot.name);setInviteId(slot.inviteId);},[slot.name,slot.inviteId]);
 const command=(action:string,extra:Record<string,unknown>={})=>run({action,id:slot.id,revision:slot.revision,...extra});
 const current=data.queue.find(q=>q.identity===slot.assignment?.identity),invite=data.invites.find(i=>i.id===slot.inviteId),phase=slot.transition?t("Переход не завершён — повторите назначение"):slot.phase==="assigned"?t("Подключён"):slot.phase==="preparing"?t("Ожидание подключения"):slot.phase==="disconnected"?t("Переподключение…"):t("Пустой слот");
 const assign=()=>{const id=admissionId;if(!id)return;const replace=!!slot.assignment&&current?.id!==id;if(replace&&!window.confirm(t("Заменить источник слота? Оба кастера останутся в комнате.")))return;void command("assign",{admissionId:id,replace});};
 const remove=async()=>{if(!window.confirm(t("Удалить слот? Его ссылки перестанут работать.")))return;let revision=slot.revision;if(slot.assignment){const next=await command("release");if(!next)return;revision=next.slots.find(s=>s.id===slot.id)?.revision||revision;}await run({action:"delete",id:slot.id,revision});};
 return <article className="caster-slot"><div className="slot-heading"><strong>{slot.name}</strong><span role="status">{current?.name||""} · {phase}</span><small>#{slot.id.slice(0,8)}</small></div>
  <div className="slot-actions"><select aria-label={t("Кастер для слота")} value={admissionId} disabled={busy} onChange={e=>setAdmissionId(e.target.value)}><option value="">{t("Выберите кастера")}</option>{data.queue.map(q=><option key={q.id} value={q.id}>{q.name} · {q.id.slice(0,6)}{q.proposedSlotId===slot.id?` · ${t("По инвайту слота")}`:""}</option>)}</select><button type="button" disabled={busy||!admissionId} onClick={assign}>{t("Назначить")}</button><button type="button" className="button-secondary" disabled={busy||!slot.assignment} onClick={()=>void command("release")}>{t("Освободить")}</button></div>
  <details><summary>{t("Ссылки и настройки слота")}</summary><div className="slot-details">
   {[{label:t("Инвайт кастера"),path:invite?.path},{label:t("Камера + микрофон"),path:slot.cameraPath},{label:t("Экран + звук экрана"),path:slot.screenPath}].map(link=><label key={link.label} className="slot-link"><span>{link.label}</span><input aria-label={link.label} readOnly value={typeof window==="undefined"?link.path||"":new URL(link.path||"",window.location.origin).href}/><button type="button" className="button-secondary" disabled={!link.path} onClick={()=>void copy(link.path!)}>{t("Копировать")}</button></label>)}
   <form className="slot-edit" onSubmit={e=>{e.preventDefault();void command("update",{name,inviteId});}}><label>{t("Имя слота")}<input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label><label>{t("Персональный инвайт")}<select value={inviteId} onChange={e=>setInviteId(e.target.value)}>{data.invites.filter(i=>i.id===slot.inviteId||!data.slots.some(s=>s.inviteId===i.id)).map(i=><option key={i.id} value={i.id}>{i.id.slice(0,8)}</option>)}</select></label><button disabled={busy||!name.trim()}>{t("Сохранить")}</button></form>
   <div className="slot-actions"><button type="button" className="button-secondary" disabled={busy||!!slot.assignment||!!slot.transition} onClick={()=>{if(window.confirm(t("Перевыпустить инвайт? Прежняя ссылка входа перестанет работать. URL выходов сохранятся.")))void command("rotate-invite");}}>{t("Перевыпустить инвайт кастера")}</button></div>
   <div className="slot-actions">{(["camera","screen"] as const).map(source=><button key={source} type="button" className="button-secondary" disabled={busy} onClick={()=>{if(window.confirm(t("Перевыпустить ссылку? Прежний URL выхода перестанет работать.")))void command("rotate",{source});}}>{source==="camera"?t("Перевыпустить ссылку камеры"):t("Перевыпустить ссылку экрана")}</button>)}<button type="button" className="button-danger" disabled={busy} onClick={()=>void remove()}>{t("Удалить слот")}</button></div>
  </div></details>
 </article>;
}
