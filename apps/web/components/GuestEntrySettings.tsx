"use client";
import { useEffect, useState, type ReactNode } from 'react';
import { useI18n } from './I18nProvider';
import { defaultGuestEntrySettings, guestEntrySettings, type GuestEntrySettings as Settings } from '@/lib/guest-entry-settings';
const labels = {
 ru: ['Настройки подключения кастеров', 'Кастеры не могут слышать друг друга', 'Входить с выключенным микрофоном', 'Только звук — камера отключена', 'Применяются к новым инвайтам. Выданные ссылки и подключённые кастеры не меняются.', 'Сохранить настройки инвайтов', 'Сохранено', 'Не удалось сохранить настройки'],
 en: ['Caster entry settings', 'Casters cannot hear each other', 'Join with microphone off', 'Audio only — camera off', 'Applied to new invitations. Existing links and connected casters remain unchanged.', 'Save invitation settings', 'Saved', 'Could not save settings'],
 'zh-CN': ['嘉宾连接设置', '嘉宾之间无法互相听到', '加入时关闭麦克风', '仅音频 — 关闭摄像头', '应用于新邀请。已发出的链接和已连接的嘉宾保持不变。', '保存邀请设置', '已保存', '无法保存设置'],
};
export function GuestEntrySettings({ value, onChange, disabled = false, children }: { children?: ReactNode; value: Settings; onChange: (v: Settings) => void; disabled?: boolean }) {
 const { locale } = useI18n(); const text = labels[locale];
 return <details className="guest-entry-settings"><summary>{text[0]}</summary><div className="stack" style={{padding:'12px 0',gap:10}}>
 {(['noGuestAudio','startMuted','audioOnly'] as const).map((key,i)=><label key={key} style={{display:'flex',gap:10,alignItems:'center'}}><input type="checkbox" style={{width:'auto'}} disabled={disabled} checked={value[key]} onChange={e=>onChange({...value,[key]:e.target.checked})}/>{text[i+1]}</label>)}<small className="muted">{text[4]}</small>{children}</div></details>;
}
export function SavedGuestEntrySettings({roomName,studioId='studio-default'}:{roomName:string;studioId?:string}) {
 const { locale }=useI18n();const text=labels[locale]; const [value,setValue]=useState({...defaultGuestEntrySettings}),[busy,setBusy]=useState(true),[status,setStatus]=useState('');
 useEffect(()=>{let active=true;setBusy(true);setStatus('');void fetch('/api/invites',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'read-settings',room:roomName,studioId})}).then(async r=>{if(!r.ok)throw Error();const d=await r.json();if(active)setValue(guestEntrySettings(d.entrySettings));}).catch(()=>{if(active)setStatus(text[7]);}).finally(()=>{if(active)setBusy(false);});return()=>{active=false;};},[roomName,studioId]);
 return <div><GuestEntrySettings value={value} onChange={v=>{setValue(v);setStatus('');}} disabled={busy}><button type="button" className="button-secondary" disabled={busy} onClick={async()=>{setBusy(true);setStatus('');try{const r=await fetch('/api/invites',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'settings',room:roomName,studioId,entrySettings:value})});if(!r.ok)throw Error();setStatus(text[6]);}catch{setStatus(text[7]);}finally{setBusy(false);}}}>{text[5]}</button>{status&&<small role="status">{status}</small>}</GuestEntrySettings></div>;
}
