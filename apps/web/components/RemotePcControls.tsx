'use client';
import { useState } from 'react';
import { type Room } from 'livekit-client';
import { useI18n } from './I18nProvider';
import { remotePcRequest } from '@/lib/remote-pc-client';
import { isRemotePcHelper } from '@/lib/remote-pc-sources';
import type { RemotePcSession } from '@/lib/remote-pc-protocol';
export function RemotePcControls({room,session,onClose}:{room:Room;session:RemotePcSession;onClose():void}){
  const {locale}=useI18n(),[selected,setSelected]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(false);
  const text=locale==='en'?{title:'Screen sharing',transfer:'Give PC control',revoke:'Reclaim PC control',stop:'Stop sharing',close:'Close controls',choose:'Choose caster',local:'You control',pending:'Waiting for the PC to confirm…',scope:'Full PC mouse and keyboard control. You keep local control. Window sharing shows only the selected window; it does not isolate PC access.',failed:'Action was not confirmed. Video continues.'}:locale==='zh-CN'?{title:'屏幕共享',transfer:'授予电脑控制权',revoke:'收回电脑控制权',stop:'停止共享',close:'关闭控制',choose:'选择参与者',local:'由您控制',pending:'等待电脑确认…',scope:'授予完整电脑的鼠标和键盘控制权。您仍可本地操作。窗口共享仅显示所选窗口，不会隔离电脑访问。',failed:'操作未确认。视频仍在继续。'}:{title:'Демонстрация экрана',transfer:'Передать управление ПК',revoke:'Забрать управление ПК',stop:'Остановить показ экрана',close:'Закрыть управление',choose:'Выберите кастера',local:'Вы управляете',pending:'Ждём подтверждения ПК…',scope:'Полный доступ к мыши и клавиатуре ПК. Ваш локальный ввод сохраняется. При показе окна видно только выбранное окно; доступ к ПК не ограничен этим окном.',failed:'Действие не подтверждено. Передача видео продолжается.'};
  const casters=[...room.remoteParticipants.values()].filter(p=>p.identity.startsWith('guest-')&&!isRemotePcHelper(p.identity));
  const action=async(kind:'delegate'|'revoke'|'stop')=>{if(busy&&kind!=='stop')return;setBusy(true);setError(false);try{const controller=casters.find(p=>p.identity===selected);if(kind==='delegate'&&!controller)return;await remotePcRequest(room,{action:kind,sessionId:session.id,generation:session.generation,revision:session.revision,...(controller&&kind==='delegate'?{controllerIdentity:controller.identity,controllerSid:controller.sid}:{})});}catch{setError(true);}finally{setBusy(false);}};
  return <><header><div><h2>{session.source?.name||text.title}</h2><p role="status">{session.pending||session.grant?.phase==='activating'?text.pending:session.grant?.phase==='active'?(room.remoteParticipants.get(session.grant.controller.identity)?.name||session.grant.controller.identity):text.local}</p></div><button type="button" className="button-secondary" aria-label={text.close} onClick={onClose}>×</button></header>
    <p className="screen-share-controls-scope">{text.scope}</p>
    <label>{text.choose}<select value={selected} disabled={busy||!!session.pending} onChange={event=>setSelected(event.target.value)}><option value="">{text.choose}</option>{casters.map(p=><option key={p.sid} value={p.identity}>{p.name||p.identity}</option>)}</select></label>
    <button type="button" className="button-secondary" disabled={!selected||busy||!!session.pending||!session.source} onClick={()=>void action('delegate')}>{text.transfer}</button>
    {session.grant&&<button type="button" className="button-secondary" disabled={busy||!!session.pending} onClick={()=>void action('revoke')}>{text.revoke}</button>}
    <button type="button" className="screen-share-stop" disabled={session.phase==='stopped'||session.pending?.action==='stop'} onClick={()=>void action('stop')}>{session.pending?.action==='stop'?text.pending:text.stop}</button>
    {error&&<small role="alert">{text.failed}</small>}
  </>;
}
