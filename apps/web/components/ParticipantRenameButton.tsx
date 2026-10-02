"use client";
import { useId, useState } from "react";
export function ParticipantRenameButton({studioId,roomName,identity,name}:{studioId:string;roomName:string;identity:string;name:string}) {
  const id=useId(),[editing,setEditing]=useState(false),[draft,setDraft]=useState(name),[busy,setBusy]=useState(false),[error,setError]=useState("");
  const save=async()=>{
    if(busy || !draft.trim()) return;
    setBusy(true);setError("");
    try {
      const response=await fetch("/api/participants",{method:"POST",headers:{"content-type":"application/json"},body:JSON.stringify({action:"rename-guest",studioId,room:roomName,identity,name:draft.trim()}),signal:AbortSignal.timeout(8000)});
      const data=await response.json().catch(()=>({}));
      if(!response.ok) throw new Error(data.error || "Не удалось изменить имя");
      setEditing(false);
    } catch(cause) {setError(cause instanceof Error ? cause.message : "Ошибка переименования");}
    finally {setBusy(false);}
  };
  return <div className="participant-rename-control">
    <button type="button" className="button-secondary" aria-expanded={editing} onClick={()=>{setDraft(name);setEditing(v=>!v);setError("");}}>Переименовать</button>
    {editing && <form className="participant-rename-form" onSubmit={event=>{event.preventDefault();void save();}}>
      <label htmlFor={id}>Имя участника</label><input id={id} value={draft} maxLength={120} onChange={event=>setDraft(event.target.value)} autoFocus />
      <div className="actions"><button type="submit" disabled={busy || !draft.trim()}>{busy ? "Сохранение…" : "Сохранить"}</button><button type="button" className="button-secondary" disabled={busy} onClick={()=>setEditing(false)}>Отмена</button></div>
      {error && <small role="alert">{error}</small>}
    </form>}
  </div>;
}
