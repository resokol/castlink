"use client";
import { useState } from "react";
export function PlatformParticipantActions({nodeId,room,participant,onChanged,onHistory}:{nodeId:string;room:string;participant:{identity:string;sid?:string;name:string;role:string};onChanged:()=>Promise<void>;onHistory:()=>void}) {
  const [busy,setBusy]=useState(false),[editing,setEditing]=useState(false),[name,setName]=useState(participant.name),[error,setError]=useState("");
  const perform=async(action:"kick"|"rename")=>{
    if(!participant.sid || busy) return;
    if(action==="kick" && !window.confirm(`Отключить ${participant.name} (${participant.role}) из комнаты?\nЭфир этого участника будет прерван. Его текущая identity будет заблокирована на 24 часа.`)) return;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/super-admin",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"participant",nodeId,operation:{action,room,identity:participant.identity,sid:participant.sid,...(action==="rename"?{name:name.trim()}: {})},confirmIdentity:participant.identity}),signal:AbortSignal.timeout(15000)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error || "Команда не выполнена");
      setEditing(false); await onChanged();
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Ошибка операции");}
    finally {setBusy(false);}
  };
  return <div className="platform-participant-actions">
    <div className="actions"><button type="button" className="button-secondary" onClick={onHistory}>Статистика</button><button type="button" className="button-secondary" disabled={busy || !participant.sid} onClick={()=>{setName(participant.name);setEditing(value=>!value);}}>Переименовать</button><button type="button" className="button-secondary super-admin-danger" disabled={busy || !participant.sid} onClick={()=>void perform("kick")}>Отключить</button></div>
    {editing && <form className="participant-rename-form" onSubmit={event=>{event.preventDefault();void perform("rename");}}><label>Имя<input aria-label="Новое имя участника" value={name} maxLength={120} onChange={event=>setName(event.target.value)} /></label><div className="actions"><button disabled={busy || !name.trim()} type="submit">Сохранить</button><button type="button" className="button-secondary" disabled={busy} onClick={()=>setEditing(false)}>Отмена</button></div></form>}
    {error && <small role="alert">{error}</small>}
  </div>;
}
