'use client';
import { useI18n } from "@/components/I18nProvider";
import { translateManagementMessage } from "@/lib/i18n/management";
import {useEffect,useRef,useState} from 'react';

type Profile={id:string;label:string;origin:string;scope:string;update?:{host:string;port:number;installationId:string}};
type Job={id:string;state:'running'|'complete'|'failed';stage:string;error?:string;bytes?:number;total?:number;bytesPerSecond?:number;previousBuildId?:string;targetBuildId?:string;buildId?:string;backup?:string;outcome?:string};
const amount=(bytes:number,t:(key:string)=>string)=>bytes>=1024*1024*1024?(bytes/1024/1024/1024).toFixed(1)+t(' ГБ'):(bytes/1024/1024).toFixed(1)+t(' МБ');
export function ServerConnections({room,studioId,onChange}:{room:string;studioId:string;onChange?:()=>void}){
  const { t } = useI18n();
 const [profiles,setProfiles]=useState<Profile[]>([]),[allowed,setAllowed]=useState(false),[expanded,setExpanded]=useState(false);
 const [host,setHost]=useState(''),[port,setPort]=useState('22'),[label,setLabel]=useState('Резервный сервер'),[password,setPassword]=useState(''),[mode,setMode]=useState<'deploy'|'connect'|'update'>('connect');
 const [updateTarget,setUpdateTarget]=useState<Profile|null>(null),[jobAction,setJobAction]=useState<'deploy'|'connect'|'update'>('connect');
 const contextVersion=useRef(0),jobContext=useRef(-1);
 const [labelEdited,setLabelEdited]=useState(false);
 const [authType,setAuthType]=useState<'password'|'private-key'>('password'),[privateKey,setPrivateKey]=useState(''),[passphrase,setPassphrase]=useState(''),[keyReading,setKeyReading]=useState(false);
 const [generatedKey,setGeneratedKey]=useState<{privateKey:string;publicKey:string}|null>(null),[keyDownloaded,setKeyDownloaded]=useState(false),[keyStatus,setKeyStatus]=useState('');
 const keyFile=useRef<HTMLInputElement|null>(null),keyReadVersion=useRef(0);
 function clearCredentials(){setGeneratedKey(null);setKeyDownloaded(false);setPassword('');setPrivateKey('');setPassphrase('');if(keyFile.current)keyFile.current.value='';keyReadVersion.current++;setKeyReading(false);}
 const [fingerprint,setFingerprint]=useState(''),[trusted,setTrusted]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[job,setJob]=useState<Job|null>(null),[installationId,setInstallationId]=useState('');
 function clearTargetContext(){contextVersion.current++;jobContext.current=-1;clearCredentials();setKeyStatus('');setFingerprint('');setTrusted(false);setError('');setJob(null);setBusy(false);}
 function selectUpdate(profile:Profile){if(profile.scope!=='room'||!profile.update)return;clearTargetContext();setUpdateTarget(profile);setMode('update');setHost(profile.update.host);setPort(String(profile.update.port));setInstallationId(profile.update.installationId);setExpanded(true);}
 function leaveUpdate(){clearTargetContext();setUpdateTarget(null);setMode('connect');setHost('');setPort('22');setInstallationId('');}
 const query=new URLSearchParams({room,studioId}).toString();
 const changed=useRef(onChange);changed.current=onChange;
 useEffect(()=>{let cancelled=false;setAllowed(false);setProfiles([]);clearTargetContext();setAuthType('password');setUpdateTarget(null);setMode('connect');setHost('');setPort('22');setInstallationId('');
  fetch('/api/server-provisioning?'+new URLSearchParams({room,studioId}),{cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async response=>{if(response.status===401)return;const data=await response.json();if(!cancelled){setAllowed(response.ok);if(response.ok)setProfiles(data.profiles||[]);}}).catch(()=>{});
  return()=>{cancelled=true;contextVersion.current++;keyReadVersion.current++;if(keyFile.current)keyFile.current.value='';};
 },[room,studioId]);
 useEffect(()=>{
  if(!job||job.state!=='running'||jobContext.current!==contextVersion.current)return;let cancelled=false,polling=false;
  const poll=async()=>{if(cancelled||polling)return;polling=true;try{const response=await fetch('/api/server-provisioning?'+query+'&jobId='+encodeURIComponent(job.id),{cache:'no-store',signal:AbortSignal.timeout(20000)});if(cancelled)return;if(!response.ok){
   if(response.status===404||response.status===401)setJob({...job,state:'failed',stage:jobAction==='update'?'Обновление прервано':'Подключение прервано',error:response.status===401?'Доступ создателя комнаты больше не подтверждён.':jobAction==='update'?'Статус обновления утрачен. Проверь VPS и версию CastLink перед повторным обновлением.':'Сервер перезапущен и статус подключения утрачен. Проверь VPS и введи SSH данные снова; готовый сервер подключи как установленный.'});
   else setError(jobAction==='update'?'Связь со студией временно недоступна. Продолжаем проверять обновление.':'Связь со студией временно недоступна. Продолжаем проверять подключение.');return;
  }const state=await response.json();if(cancelled)return;setError('');setJob(state);
   if(state.state==='complete'){if(jobAction!=='update')setExpanded(false);setFingerprint('');setTrusted(false);}
  }catch{if(!cancelled)setError(jobAction==='update'?'Связь со студией временно недоступна. Продолжаем проверять обновление.':'Связь со студией временно недоступна. Продолжаем проверять подключение.');}finally{polling=false;}};
  const timer=setInterval(()=>void poll(),1500);void poll();return()=>{cancelled=true;clearInterval(timer);};
 },[job?.id,job?.state,jobAction,query]);
 useEffect(()=>{
  if(job?.state!=='complete'||jobContext.current!==contextVersion.current)return;let cancelled=false;
  changed.current?.();
  fetch('/api/server-provisioning?'+query,{cache:'no-store',signal:AbortSignal.timeout(20000)}).then(async response=>{if(response.ok){const catalog=await response.json();if(!cancelled)setProfiles(catalog.profiles||[]);}}).catch(()=>{if(!cancelled)setError(jobAction==='update'?'Сервер обновлён, но список серверов пока не обновлён.':'Сервер подключён, но список серверов пока не обновлён.');});
  return()=>{cancelled=true;};
 },[job?.id,job?.state,jobAction,query]);
 if(!allowed)return null;
 const pending=busy||keyReading||job?.state==='running';
 const hasCredentials=Boolean(authType==='private-key'?privateKey:password);
 async function readPrivateKey(file?:File){
  setPrivateKey('');setPassphrase('');setError('');const version=++keyReadVersion.current;
  if(!file)return;
  const invalid='Некорректный SSH приватный ключ или его пароль. Используй файл OpenSSH или PEM до 64 КиБ.';
  if(!file.size||file.size>65536){if(keyFile.current)keyFile.current.value='';setError(invalid);return;}
  setKeyReading(true);
  try{const value=await file.text();if(version!==keyReadVersion.current)return;if(!/^-----BEGIN (?:OPENSSH |RSA |EC |DSA |ENCRYPTED )?PRIVATE KEY-----\r?\n/.test(value))throw Error(invalid);setPrivateKey(value);}
  catch{if(version===keyReadVersion.current){if(keyFile.current)keyFile.current.value='';setError(invalid);}}
  finally{if(version===keyReadVersion.current)setKeyReading(false);}
 }
 async function generateKey(){setBusy(true);setError('');setGeneratedKey(null);setKeyDownloaded(false);setKeyStatus('');const version=keyReadVersion.current;
  try{const response=await fetch('/api/server-provisioning',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json'},body:JSON.stringify({action:'generate-key',room,studioId})});const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось создать SSH ключ');if(version===keyReadVersion.current)setGeneratedKey(data);else data.privateKey='';}
  catch{if(version===keyReadVersion.current)setError('Не удалось создать SSH ключ');}finally{if(version===keyReadVersion.current)setBusy(false);}
 }
 function downloadKey(){if(!generatedKey)return;const url=URL.createObjectURL(new Blob([generatedKey.privateKey],{type:'application/octet-stream'}));const link=document.createElement('a');link.href=url;link.download='castlink-root-ssh.pem';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setKeyDownloaded(true);}
 async function authorizeKey(){if(!generatedKey||!keyDownloaded||!trusted)return;setBusy(true);setError('');setKeyStatus('');
  const credentials=authType==='private-key'?{authType,privateKey,passphrase}:{authType,password};const created=generatedKey;clearCredentials();const version=keyReadVersion.current;
  try{const response=await fetch('/api/server-provisioning',{method:'POST',signal:AbortSignal.timeout(240000),headers:{'content-type':'application/json'},body:JSON.stringify({action:'authorize-key',room,studioId,host:host.trim(),port:Number(port),fingerprint,...credentials,publicKey:created.publicKey,generatedPrivateKey:created.privateKey})});const data=await response.json();if(!response.ok)throw Error(data.error||'Не удалось установить SSH ключ. Проверь доступ и выбери сохранённый файл ключа для повторной проверки.');if(version!==keyReadVersion.current)return;setAuthType('private-key');setKeyStatus('SSH ключ установлен и вход проверен. Выбери сохранённый файл ключа для подключения CastLink.');}
  catch(error){if(version===keyReadVersion.current)setError(error instanceof Error&&error.name!=='TimeoutError'?error.message:'Не удалось установить SSH ключ. Проверь доступ и выбери сохранённый файл ключа для повторной проверки.');}
  finally{credentials.password='';credentials.privateKey='';credentials.passphrase='';created.privateKey='';if(version===keyReadVersion.current)setBusy(false);}
 }
 async function probe(){setBusy(true);setError('');setFingerprint('');setTrusted(false);const version=contextVersion.current;
  try{const response=await fetch('/api/server-provisioning',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json'},body:JSON.stringify({action:'fingerprint',room,studioId,host:host.trim(),port:Number(port),...(mode==='update'&&updateTarget?{peerId:updateTarget.id}:{})})});const data=await response.json();if(!response.ok)throw Error(data.error||'SSH недоступен');if(version===contextVersion.current)setFingerprint(data.fingerprint);}catch(error){if(version===contextVersion.current)setError(error instanceof Error?error.message:'SSH недоступен');}finally{if(version===contextVersion.current)setBusy(false);}
 }
 async function start(){if(!trusted||!hasCredentials||(mode==='update'&&!updateTarget?.update))return;setBusy(true);setError('');const version=contextVersion.current;const action=mode;const credentials=authType==='private-key'?{authType,privateKey,passphrase}:{authType,password};clearCredentials();
  try{const response=await fetch('/api/server-provisioning',{method:'POST',signal:AbortSignal.timeout(20000),headers:{'content-type':'application/json'},body:JSON.stringify({action:action==='update'?'update':'start',room,studioId,host:action==='update'?updateTarget!.update!.host:host.trim(),port:Number(port),...credentials,fingerprint,...(action==='update'?{peerId:updateTarget!.id,installationId:updateTarget!.update!.installationId}:{label:label.trim(),mode:action,...(installationId.trim()?{installationId:installationId.trim()}:{})})})});const data=await response.json();if(!response.ok)throw Error(data.error||(action==='update'?'Не удалось обновить сервер':'Не удалось подключить сервер'));if(version===contextVersion.current){jobContext.current=version;setJobAction(action);setJob(data);}}catch(error){if(version===contextVersion.current)setError(error instanceof Error&&error.name==='TimeoutError'?action==='update'?'Ответ студии не получен вовремя. Статус обновления VPS пока неизвестен; проверь версию перед повторной попыткой.':'Ответ студии не получен вовремя. Статус установки на VPS пока неизвестен; проверь сохранённую операцию, прежде чем повторять установку.':error instanceof Error?error.message:action==='update'?'Не удалось обновить сервер':'Не удалось подключить сервер');}finally{credentials.password='';credentials.privateKey='';credentials.passphrase='';if(version===contextVersion.current)setBusy(false);}
 }
 return <details className="panel" open={expanded} onToggle={event=>setExpanded(event.currentTarget.open)}>
  <summary>{t("Серверы комнаты ·")} {profiles.length}</summary>
  {profiles.map(profile=><p key={profile.id}><strong>{profile.label}</strong> · {profile.origin}{profile.scope==='installation'&&<small> {t("· настроен при установке")}</small>}{profile.scope==='room'&&profile.update&&<button type="button" className="button-secondary" disabled={pending} onClick={()=>selectUpdate(profile)}>{t("Обновить")}</button>}</p>)}
  <p className="muted">{t("Добавь резерв сейчас или позже. Перенос участников запускается отдельной кнопкой в студии.")}</p>
  <div style={{display:'grid',gap:12}}>
   {mode==='update'&&updateTarget?<><p><strong>{t("Обновление сервера")}: {updateTarget.label}</strong></p><p className="muted">{t("Обновление прервёт работу VPS. Сначала проверим версии и создадим резервную копию; при ошибке попробуем вернуть предыдущую версию.")}</p><button type="button" className="button-secondary" disabled={pending} onClick={leaveUpdate}>{t("Вернуться к подключению")}</button></>:<label>{t("Сервер")} <select value={mode} disabled={pending} onChange={event=>{clearTargetContext();setMode(event.target.value as 'deploy'|'connect');}}><option value="connect">{t("Подключить установленный CastLink")}</option><option value="deploy">{t("Установить CastLink на пустой VPS")}</option></select></label>}
   {mode==='deploy'&&<p className="muted">{t("Ubuntu 22.04 или 24.04, x86_64. Подготовим Docker и текущий выпуск CastLink. Открой TCP 80, 443, 7881 и UDP 7882, 3478, 30000–30031 в панели провайдера.")}</p>}
   {mode!=='update'&&<label>{t("Название")} <input value={labelEdited ? label : t("Резервный сервер")} maxLength={100} disabled={pending} onChange={event=>{setLabelEdited(true);setLabel(event.target.value);}} /></label>}
   <label>{t("Публичный IPv4 VPS")} <input value={host} readOnly={mode==='update'} disabled={pending} placeholder="203.0.113.10" onChange={event=>{clearTargetContext();if(mode!=='update')setHost(event.target.value);}} /></label>
   <label>{t("SSH порт")} <input type="number" min={1} max={65535} value={port} disabled={pending} onChange={event=>{clearTargetContext();setPort(event.target.value);}} /></label>
   <button type="button" className="button-secondary" disabled={pending||!host} onClick={()=>void probe()}>{busy?t("Проверяем SSH…"):t("Проверить SSH ключ сервера")}</button>
   {fingerprint&&<><p style={{overflowWrap:'anywhere'}}>{t("SSH ключ:")} <code>{fingerprint}</code></p><label><input type="checkbox" checked={trusted} disabled={pending} onChange={event=>setTrusted(event.target.checked)} /> {t("Сверил ключ с данными VPS и доверяю этому серверу")}</label></>}
   <label>{t("SSH логин")} <input value="root" readOnly disabled /></label>
   <label>{t("Способ SSH входа")} <select value={authType} disabled={pending} onChange={event=>{clearCredentials();setAuthType(event.target.value as 'password'|'private-key');setError('');}}><option value="password">{t("SSH пароль")}</option><option value="private-key">{t("SSH приватный ключ")}</option></select></label>
   {authType==='password'?<label>{t("SSH пароль")} <input type="password" autoComplete="new-password" maxLength={1024} value={password} disabled={pending} onChange={event=>setPassword(event.target.value)} /></label>:<>
    <label>{t("Файл SSH приватного ключа")} <input ref={keyFile} type="file" disabled={pending} onChange={event=>void readPrivateKey(event.target.files?.[0])} /></label>
    <small className="muted">{t("Приватный ключ OpenSSH или PEM, до 64 КиБ. Публичный ключ должен быть установлен для root на VPS.")}</small>
    <label>{t("Пароль ключа (необязательно)")} <input type="password" autoComplete="new-password" maxLength={1024} value={passphrase} disabled={pending} onChange={event=>setPassphrase(event.target.value)} /></label>
   </>}
   <small className="muted">{t("SSH данные используются только для этого подключения и не сохраняются.")}</small>
   <details><summary>{t("Создать SSH ключ без консоли")}</summary>
    <p className="muted">{t("Для установки публичного ключа нужны текущий пароль root или существующий ключ и проверенный ключ сервера. Сначала скачай приватный ключ и сохрани файл в надёжном месте.")}</p>
    <button type="button" disabled={pending} onClick={()=>void generateKey()}>{t("Создать SSH ключ")}</button>
    {generatedKey&&<><button type="button" disabled={pending} onClick={downloadKey}>{t("Скачать приватный ключ")}</button><button type="button" disabled={pending||!trusted||!hasCredentials||!keyDownloaded} onClick={()=>void authorizeKey()}>{t("Установить созданный ключ на VPS")}</button></>}
    {keyStatus&&<p role="status">{t(keyStatus)}</p>}
   </details>
   {mode==='update'&&<label>{t("UUID нужной установки")} <input value={updateTarget?.update?.installationId||''} readOnly disabled /></label>}
   {mode==='connect'&&<details><summary>{t("На VPS несколько установок CastLink")}</summary><label>{t("UUID нужной установки")} <input value={installationId} disabled={pending} placeholder={t("Из сохранённых данных её мастера")} onChange={event=>{clearTargetContext();setInstallationId(event.target.value);}} /></label></details>}
   <button type="button" disabled={pending||!trusted||!hasCredentials||(mode!=='update'&&!label.trim())} onClick={()=>void start()}>{pending?mode==='update'?t("Обновляем…"):t("Подключаем…"):mode==='update'?t("Обновить CastLink"):mode==='deploy'?t("Установить и подключить"):t("Подключить сервер")}</button>
  </div>
  {job&&<p role="status">{translateManagementMessage(job.stage, t)}{job.bytes!==undefined&&` · ${amount(job.bytes, t)}${job.total?` / ${amount(job.total, t)}`:''}${job.bytesPerSecond?` · ${amount(job.bytesPerSecond, t)}${t("/с")}`:''}`}{job.error&&` · ${translateManagementMessage(job.error, t)}`}</p>}
  {jobAction==='update'&&job&&<><p role="status" style={{overflowWrap:'anywhere'}}>{job.previousBuildId&&<>{t("Предыдущая версия")}: <code>{job.previousBuildId}</code> · </>}{job.targetBuildId&&<>{t("Версия обновления")}: <code>{job.targetBuildId}</code> · </>}{job.buildId&&<>{t("Проверенная версия")}: <code>{job.buildId}</code></>}</p>{job.backup&&<p className="muted" style={{overflowWrap:'anywhere'}}>{t("Резервная копия")}: <code>{job.backup}</code></p>}{job.state==='complete'&&<p className="muted">{t("Заново подготовь резерв и включи автоматический перенос в студии, если он нужен.")}</p>}</>}
  {error&&<p role="alert">{translateManagementMessage(error, t)}</p>}
 </details>;
}
