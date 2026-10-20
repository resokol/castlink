"use client";
import { useEffect, useRef, useState } from "react";
import { useI18n } from "./I18nProvider";
import type { CasterSlot } from "@/lib/caster-slot-types";
type Slot=CasterSlot&{cameraPath:string;screenPath:string};
type Queue={id:string;name:string;identity:string;state:string;proposedSlotId?:string};
type Data={slots:Slot[];invites:{id:string;path:string}[];queue:Queue[]};
export function CasterSlotsPanel({studioId,roomName,active=true}:{studioId:string;roomName:string;active?:boolean}){
 const {t}=useI18n(),[data,setData]=useState<Data>({slots:[],invites:[],queue:[]}),[name,setName]=useState(""),[busy,setBusy]=useState(false),[error,setError]=useState(""),[message,setMessage]=useState(""),[creating,setCreating]=useState(false),[loading,setLoading]=useState(true);
 const scope=JSON.stringify([studioId,roomName]),generation=useRef(0),flight=useRef(false);
 useEffect(()=>{const mine=++generation.current,abort=new AbortController();let timer:ReturnType<typeof setTimeout>;setData({slots:[],invites:[],queue:[]});setError("");setMessage("");setName("");setCreating(false);setLoading(true);
  if(!active)return;
  const poll=async()=>{try{if(!flight.current){const response=await fetch(`/api/caster-slots?${new URLSearchParams({studioId,room:roomName})}`,{cache:"no-store",signal:abort.signal});const next=await response.json();if(!response.ok)throw Error(next.error);if(generation.current===mine){setData(next);setLoading(false);setError("");}}}catch(e){if(!abort.signal.aborted&&generation.current===mine){setLoading(false);setError(e instanceof Error?e.message:"Не удалось загрузить слоты");}}finally{if(!abort.signal.aborted)timer=setTimeout(poll,3000);}};
  void poll();return()=>{abort.abort();clearTimeout(timer);};
 },[scope,active]);
 const run=async(body:Record<string,unknown>)=>{
  if(flight.current)return;flight.current=true;setBusy(true);setError("");setMessage("");const mine=generation.current;
  try{const response=await fetch("/api/caster-slots",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({studioId,room:roomName,...body})});const next=await response.json();if(!response.ok)throw Error(next.error);if(mine===generation.current){setData(next);if(body.action==="create"){setName("");setCreating(false);}setMessage(body.action==="delete-invite"?"Инвайт удалён":"Слот обновлён");}return next as Data;}
  catch(e){if(mine===generation.current)setError(e instanceof Error?e.message:"Не удалось изменить слот");}
  finally{flight.current=false;setBusy(false);}
 };
 const copy=async(path:string)=>{try{await navigator.clipboard.writeText(new URL(path,window.location.origin).href);setError("");setMessage("Ссылка скопирована");}catch{setError("Скопируйте ссылку из поля");}};
 const occupied=data.slots.filter(slot=>!!slot.assignment).length;
 const unboundInvites=data.invites.filter(invite=>!data.slots.some(slot=>slot.inviteId===invite.id));
 return <section className="panel caster-slots-panel" hidden={!active} aria-label={t("Слоты кастеров")} aria-busy={busy||loading}>
  <header className="slots-toolbar">
   <div className="slots-title"><h2>{t("Слоты кастеров")}</h2>{!loading&&<span className="slots-count">{t("{used} из {total} занято",{used:occupied,total:data.slots.length})}</span>}<p className="muted">{t("Постоянные выходы для OBS/vMix. Смена кастера сохраняет ссылки.")}</p></div>
   <button type="button" className="button-primary" disabled={busy} aria-expanded={creating} onClick={()=>setCreating(!creating)}>{t("Создать слот")}</button>
  </header>
  {creating&&<form className="slot-create" onSubmit={e=>{e.preventDefault();void run({action:"create",name});}}><label>{t("Имя слота")}<input autoFocus value={name} maxLength={120} placeholder={t("Например, ведущий")} onChange={e=>setName(e.target.value)}/></label><button className="button-primary" disabled={busy||!name.trim()}>{t("Создать")}</button><button type="button" className="button-secondary" disabled={busy} onClick={()=>setCreating(false)}>{t("Отмена")}</button></form>}
  <div className="slot-queue"><strong>{t("Кастеры в комнате")}{!loading&&<span className="slots-room-count">{data.queue.length}</span>}</strong><div className="slot-roster">{loading?<span className="muted">{t("Загрузка слотов…")}</span>:data.queue.length?data.queue.map(q=><span className="slot-caster-chip" key={q.id}>{q.name}</span>):<span className="muted">{t("Нет подключённых кастеров")}</span>}</div></div>
  <div className="slots-list">
   {data.slots.map(slot=><SlotRow key={`${scope}:${slot.id}`} slot={slot} data={data} busy={busy} run={run} copy={copy}/>)}
   {!loading&&!error&&!data.slots.length&&<div className="slots-empty"><strong>{t("Слотов пока нет")}</strong><p className="muted">{t("Создайте слот, назначьте кастера и добавьте постоянный выход в OBS/vMix.")}</p></div>}
  </div>
  {!!data.slots.length&&<footer className="slots-footer"><span className="muted">{t("Освобождение слота не отключает кастера от комнаты.")}</span><button type="button" className="button-secondary" disabled={busy} onClick={()=>void run({action:"create-invite"})}>{t("Создать отдельный инвайт")}</button></footer>}
  {!!unboundInvites.length&&<details className="slot-unbound"><summary>{t("Инвайты без слота")} · {unboundInvites.length}</summary><div className="slot-details">{unboundInvites.map(invite=><div className="slot-link" key={invite.id}><span>#{invite.id.slice(0,8)}</span><input aria-label={t("Инвайт кастера")} readOnly value={typeof window==="undefined"?invite.path:new URL(invite.path,window.location.origin).href}/><div className="slot-actions"><CopyLink label={t("Инвайт кастера")} path={invite.path} copy={copy}/><button type="button" className="button-danger" disabled={busy} aria-label={t("Удалить инвайт {id}",{id:invite.id.slice(0,8)})} onClick={()=>{if(window.confirm(t("Удалить инвайт? Прежняя ссылка входа перестанет работать.")))void run({action:"delete-invite",id:invite.id});}}>{t("Удалить")}</button></div></div>)}</div></details>}
  <div className="slots-feedback">{error&&<p role="alert" className="studio-control-error">{t(error)}</p>}<p role="status" aria-live="polite">{t(message)}</p></div>
 </section>;
}
function CopyLink({label,path,copy}:{label:string;path?:string;copy:(path:string)=>Promise<void>}){
 const {t}=useI18n();
 return <button type="button" className="button-secondary slot-copy" disabled={!path} aria-label={t("Копировать: {label}",{label})} title={t("Копировать: {label}",{label})} onClick={()=>path&&void copy(path)}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></svg>{label}</button>;
}

function SlotRow({slot,data,busy,run,copy}:{slot:Slot;data:Data;busy:boolean;run:(body:Record<string,unknown>)=>Promise<Data|undefined>;copy:(path:string)=>Promise<void>}){
 const {t}=useI18n(),[name,setName]=useState(slot.name),[inviteId,setInviteId]=useState(slot.inviteId),[admissionId,setAdmissionId]=useState("");
 useEffect(()=>{setName(slot.name);setInviteId(slot.inviteId);},[slot.name,slot.inviteId]);
 const command=(action:string,extra:Record<string,unknown>={})=>run({action,id:slot.id,revision:slot.revision,...extra});
 const current=data.queue.find(q=>q.identity===slot.assignment?.identity),invite=data.invites.find(i=>i.id===slot.inviteId),phase=slot.transition?t("Переход не завершён — повторите назначение"):slot.phase==="assigned"?t("Подключён"):slot.phase==="preparing"?t("Ожидание подключения"):slot.phase==="disconnected"?t("Переподключение…"):t("Пустой слот");
 const assign=()=>{const id=admissionId;if(!id)return;const replace=!!slot.assignment&&current?.id!==id;if(replace&&!window.confirm(t("Заменить источник слота? Оба кастера останутся в комнате.")))return;void command("assign",{admissionId:id,replace});};
 const remove=async()=>{if(!window.confirm(t("Удалить слот? Его ссылки перестанут работать.")))return;let revision=slot.revision;if(slot.assignment){const next=await command("release");if(!next)return;revision=next.slots.find(s=>s.id===slot.id)?.revision||revision;}await run({action:"delete",id:slot.id,revision});};
 return <article className="caster-slot" aria-label={slot.name}>
  <div className="slot-main">
   <div className="slot-heading"><strong title={slot.name}>{slot.name}</strong><span className={`slot-phase slot-phase-${slot.transition?"transition":slot.phase}`} role="status"><i aria-hidden="true"/>{phase}</span><span className="slot-assignee" title={current?.name||slot.assignment?.identity||""}>{current?.name||(slot.assignment?t("Источник назначен"):"")}</span></div>
   <div className="slot-actions slot-assignment"><select aria-label={t("Кастер для слота")} value={admissionId} disabled={busy||!data.queue.length} onChange={e=>setAdmissionId(e.target.value)}><option value="">{t("Выберите кастера")}</option>{data.queue.map(q=><option key={q.id} value={q.id}>{q.name} · {q.id.slice(0,6)}{q.proposedSlotId===slot.id?` · ${t("По инвайту слота")}`:""}</option>)}</select><button type="button" className={slot.transition?"button-secondary slot-retry":"button-secondary"} disabled={busy||!data.queue.some(q=>q.id===admissionId)} onClick={assign}>{slot.transition?t("Повторить назначение"):slot.assignment&&current?.id!==admissionId?t("Заменить"):t("Назначить")}</button><button type="button" className="button-secondary" disabled={busy||!slot.assignment} onClick={()=>void command("release")}>{t("Освободить")}</button></div>
   <div className="slot-outputs"><CopyLink label={t("Камера")} path={slot.cameraPath} copy={copy}/><CopyLink label={t("Экран")} path={slot.screenPath} copy={copy}/><CopyLink label={t("Инвайт")} path={invite?.path} copy={copy}/></div>
  </div>
  <details className="slot-settings"><summary aria-label={t("Настройки слота: {name}",{name:slot.name})} title={t("Ссылки и настройки слота")}><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m9 3-.7 2.4-2 .9L4 5.7 2 9l1.8 1.7v2.6L2 15l2 3.3 2.3-.6 2 .9L9 21h4l.7-2.4 2-.9 2.3.6 2-3.3-1.8-1.7v-2.6L20 9l-2-3.3-2.3.6-2-.9L13 3Z"/><circle cx="11" cy="12" r="3"/></svg></summary><div className="slot-details"><small className="muted">{t("ID слота")}: {slot.id}</small>
   {[{label:t("Инвайт кастера"),path:invite?.path},{label:t("Камера + микрофон"),path:slot.cameraPath},{label:t("Экран + звук экрана"),path:slot.screenPath}].map(link=><label key={link.label} className="slot-link"><span>{link.label}</span><input aria-label={link.label} readOnly value={!link.path?"":typeof window==="undefined"?link.path:new URL(link.path,window.location.origin).href}/><button type="button" className="button-secondary" disabled={!link.path} onClick={()=>void copy(link.path!)}>{t("Копировать")}</button></label>)}
   <form className="slot-edit" onSubmit={e=>{e.preventDefault();void command("update",{name,inviteId});}}><label>{t("Имя слота")}<input value={name} maxLength={120} onChange={e=>setName(e.target.value)}/></label><label>{t("Персональный инвайт")}<select value={inviteId} onChange={e=>setInviteId(e.target.value)}>{data.invites.filter(i=>i.id===slot.inviteId||!data.slots.some(s=>s.inviteId===i.id)).map(i=><option key={i.id} value={i.id}>{i.id.slice(0,8)}</option>)}</select></label><button disabled={busy||!name.trim()}>{t("Сохранить")}</button></form>
   <div className="slot-actions"><button type="button" className="button-secondary" disabled={busy||!!slot.assignment||!!slot.transition} onClick={()=>{if(window.confirm(t("Перевыпустить инвайт? Прежняя ссылка входа перестанет работать. URL выходов сохранятся.")))void command("rotate-invite");}}>{t("Перевыпустить инвайт кастера")}</button></div>
   <div className="slot-actions">{(["camera","screen"] as const).map(source=><button key={source} type="button" className="button-secondary" disabled={busy} onClick={()=>{if(window.confirm(t("Перевыпустить ссылку? Прежний URL выхода перестанет работать.")))void command("rotate",{source});}}>{source==="camera"?t("Перевыпустить ссылку камеры"):t("Перевыпустить ссылку экрана")}</button>)}<button type="button" className="button-danger" disabled={busy} onClick={()=>void remove()}>{t("Удалить слот")}</button></div>
  </div></details>
 </article>;
}
