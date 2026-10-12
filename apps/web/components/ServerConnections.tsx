'use client';
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";
import {useEffect,useRef,useState} from 'react';

type Profile={id:string;label:string;origin:string;scope:string};
type Job={id:string;state:'running'|'complete'|'failed';stage:string;error?:string;bytes?:number;total?:number;bytesPerSecond?:number};
const amount=(bytes:number,t:(key:string)=>string)=>bytes>=1024*1024*1024?(bytes/1024/1024/1024).toFixed(1)+t(' ГБ'):(bytes/1024/1024).toFixed(1)+t(' МБ');
export function ServerConnections({room,studioId,onChange}:{room:string;studioId:string;onChange?:()=>void}){
  const { t } = useI18n();
 const [profiles,setProfiles]=useState<Profile[]>([]),[allowed,setAllowed]=useState(false),[expanded,setExpanded]=useState(false);
 const [host,setHost]=useState(''),[port,setPort]=useState('22'),[label,setLabel]=useState('Резервный сервер'),[password,setPassword]=useState(''),[mode,setMode]=useState<'deploy'|'connect'>('connect');
 const [labelEdited,setLabelEdited]=useState(false);
 const [fingerprint,setFingerprint]=useState(''),[trusted,setTrusted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[job,setJob]=useState<Job|null>(null),[installationId,setInstallationId]=useState('');
 const query=new URLSearchParams({room,studioId}).toString();
 const changed=useRef(onChange);changed.current=onChange;
 useEffect(()=>{let cancelled=false;setAllowed(false);setProfiles([]);setJob(null);setPassword('');setFingerprint('');setTrusted(false);
  fetch('/api/server-provisioning?'+new URLSearchParams({room,studioId}),{cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async response=>{if(response.status===401)return;const data=await response.json();if(!cancelled){setAllowed(response.ok);if(response.ok)setProfiles(data.profiles||[]);}}).catch(()=>{});
  return()=>{cancelled=true;};
 },[room,studioId]);
 useEffect(()=>{
  if(!job||job.state!=='running')return;let cancelled=false,polling=false;
  const poll=async()=>{if(cancelled||polling)return;polling=true;try{const response=await fetch('/api/server-provisioning?'+query+'&jobId='+encodeURIComponent(job.id),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(cancelled)return;if(!response.ok){
   if(response.status===404||response.status===401)setJob({...job,state:'failed',stage:'Подключение прервано',error:response.status===401?'Доступ создателя комнаты больше не подтверждён.':'Сервер перезапущен и статус подключения утрачен. Проверь VPS и введи SSH пароль снова; готовый сервер подключи как установленный.'});
   else setError('Связь со студией временно недоступна. Продолжаем проверять подключение.');return;
  }const state=await response.json();if(cancelled)return;setError('');setJob(state);
   if(state.state==='complete'){setExpanded(false);setFingerprint('');setTrusted(false);}
  }catch{if(!cancelled)setError('Связь со студией временно недоступна. Продолжаем проверять подключение.');}finally{polling=false;}};
  const timer=setInterval(()=>void poll(),1500);void poll();return()=>{cancelled=true;clearInterval(timer);};
 },[job?.id,job?.state,query]);
 useEffect(()=>{
  if(job?.state!=='complete')return;let cancelled=false;
  changed.current?.();
  fetch('/api/server-provisioning?'+query,{cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async response=>{if(response.ok){const catalog=await response.json();if(!cancelled)setProfiles(catalog.profiles||[]);}}).catch(()=>{if(!cancelled)setError('Сервер подключён, но список серверов пока не обновлён.');});
  return()=>{cancelled=true;};
 },[job?.id,job?.state,query]);
 if(!allowed)return null;
 const pending=busy||job?.state==='running';
 async function probe(){setBusy(true);setError('');setFingerprint('');setTrusted(false);
  try{const response=await fetch('/api/server-provisioning',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json'},body:JSON.stringify({action:'fingerprint',room,studioId,host:host.trim(),port:Number(port)})});const data=await response.json();if(!response.ok)throw Error(data.error||'SSH недоступен');setFingerprint(data.fingerprint);}catch(error){setError(error instanceof Error?error.message:'SSH недоступен');}finally{setBusy(false);}
 }
 async function start(){setBusy(true);setError('');const enteredPassword=password;setPassword('');
  try{const response=await fetch('/api/server-provisioning',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json'},body:JSON.stringify({action:'start',room,studioId,host:host.trim(),port:Number(port),label:label.trim(),mode,password:enteredPassword,fingerprint,...(installationId.trim()?{installationId:installationId.trim()}:{})})});const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось подключить сервер');setJob(data);}catch(error){setError(error instanceof Error&&error.name==='TimeoutError'?'Ответ студии не получен вовремя. Статус установки на VPS пока неизвестен; проверь сохранённую операцию, прежде чем повторять установку.':error instanceof Error?error.message:'Не удалось подключить сервер');}finally{setBusy(false);}
 }
 return <details className="panel" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
  <summary>{t("Серверы комнаты ·")} {profiles.length}</summary>
  {profiles.map(profile=><p key={profile.id}><strong>{profile.label}</strong> · {profile.origin}{profile.scope==='installation'&&<small> {t("· настроен при установке")}</small>}</p>)}
  <p className="muted">{t("Добавь резерв сейчас или позже. Перенос участников запускается отдельной кнопкой в студии.")}</p>
  <div style={{display:'grid',gap:12}}>
   <label>{t("Сервер")} <select value={mode} disabled={pending} onChange={event=>setMode(event.target.value as 'deploy'|'connect')}><option value="connect">{t("Подключить установленный CastLink")}</option><option value="deploy">{t("Установить CastLink на пустой VPS")}</option></select></label>
   {mode==='deploy'&&<p className="muted">{t("Ubuntu 22.04 или 24.04, x86_64. Подготовим Docker и текущий выпуск CastLink. Открой TCP 80, 443, 7881 и UDP 7882, 3478, 30000–30031 в панели провайдера.")}</p>}
   <label>{t("Название")} <input value={labelEdited ? label : t("Резервный сервер")} maxLength={100} disabled={pending} onChange={event=>{setLabelEdited(true);setLabel(event.target.value);}} /></label>
   <label>{t("Публичный IPv4 VPS")} <input value={host} disabled={pending} placeholder="203.0.113.10" onChange={event=>{setHost(event.target.value);setFingerprint('');setTrusted(false);}} /></label>
   <label>{t("SSH порт")} <input type="number" min={1} max={65535} value={port} disabled={pending} onChange={event=>{setPort(event.target.value);setFingerprint('');setTrusted(false);}} /></label>
   <button type="button" className="button-secondary" disabled={pending||!host} onClick={()=>void probe()}>{busy?t("Проверяем SSH…"):t("Проверить SSH ключ сервера")}</button>
   {fingerprint&&<><p style={{overflowWrap:'anywhere'}}>{t("SSH ключ:")} <code>{fingerprint}</code></p><label><input type="checkbox" checked={trusted} disabled={pending} onChange={event=>setTrusted(event.target.checked)} /> {t("Сверил ключ с данными VPS и доверяю этому серверу")}</label></>}
   <label>{t("SSH логин")} <input value="root" readOnly disabled /></label>
   <label>{t("SSH пароль")} <input type="password" autoComplete="new-password" value={password} disabled={pending} onChange={event=>setPassword(event.target.value)} /></label>
   <small className="muted">{t("Пароль используется для этого подключения и не сохраняется.")}</small>
   {mode==='connect'&&<details><summary>{t("На VPS несколько установок CastLink")}</summary><label>{t("UUID нужной установки")} <input value={installationId} disabled={pending} placeholder={t("Из сохранённых данных её мастера")} onChange={event=>setInstallationId(event.target.value)} /></label></details>}
   <button type="button" disabled={pending||!trusted||!password||!label.trim()} onClick={()=>void start()}>{pending?t("Подключаем…"):mode==='deploy'?t("Установить и подключить"):t("Подключить сервер")}</button>
  </div>
  {job&&<p role="status">{translateManagementMessage(job.stage, t)}{job.bytes!==undefined&&` · ${amount(job.bytes, t)}${job.total?` / ${amount(job.total, t)}`:''}${job.bytesPerSecond?` · ${amount(job.bytesPerSecond, t)}${t("/с")}`:''}`}{job.error&&` · ${translateManagementMessage(job.error, t)}`}</p>}
  {error&&<p role="alert">{translateManagementMessage(error, t)}</p>}
 </details>;
}
