'use strict';
const button=document.querySelector('#stop'),error=document.querySelector('#error'),shortcut=document.querySelector('#shortcut');
const remote=document.querySelector('#remote-control'),status=document.querySelector('#control-status'),participants=document.querySelector('#participants'),requests=document.querySelector('#requests'),revoke=document.querySelector('#revoke'),disclosure=document.querySelector('#disclosure'),give=document.querySelector('#give');
const words={ru:{give:'Передать управление',revoke:'Забрать управление',approve:'Разрешить',deny:'Отклонить',ready:'Управление доступно',paused:'Управление приостановлено',owner:'Управляете вы',scope:'Клавиатура и мышь всего ПК',limits:'Системные сочетания и защищённый рабочий стол недоступны',unavailable:'Горячая клавиша занята. Используйте кнопку.'},en:{give:'Give control',revoke:'Reclaim control',approve:'Allow',deny:'Deny',ready:'Control available',paused:'Control paused',owner:'You have control',scope:'Keyboard and pointer for the full PC',limits:'Reserved shortcuts and secure desktop are unavailable',unavailable:'Shortcut unavailable. Use the button.'},'zh-CN':{give:'交出控制权',revoke:'收回控制权',approve:'允许',deny:'拒绝',ready:'可以控制',paused:'控制已暂停',owner:'您正在控制',scope:'整台电脑的键盘和鼠标',limits:'不支持系统保留快捷键和安全桌面',unavailable:'快捷键不可用，请使用按钮。'}};
let current,menuKey,actionButtons=[];
const binding=v=>v&&[v.captureId,v.sessionId,v.generation,v.revision].join(':');
function emit(snapshot,value){if(current!==snapshot||snapshot.busy||snapshot.expiresAt<=Date.now())return;window.castlinkStop.intent({captureId:snapshot.captureId,sessionId:snapshot.sessionId,generation:snapshot.generation,revision:snapshot.revision,sequence:snapshot.sequence,...value});}
function action(label,snapshot,value,deadline=Infinity){const el=document.createElement('button');el.type='button';el.textContent=label;actionButtons.push({el,deadline});el.addEventListener('click',()=>{const latest=current;if(!latest||binding(latest)!==binding(snapshot)||deadline<=Date.now())return;emit(latest,value);});return el;}
function paintControl(value){
 current=value;remote.hidden=!value;if(!value){menuKey=undefined;actionButtons=[];participants.replaceChildren();requests.replaceChildren();return;}
 const t=words[value.locale];give.textContent=t.give;disclosure.textContent=t.scope;disclosure.title=t.limits;
 status.textContent=(value.controller?.name||t.owner)+' · '+(value.status==='ready'?t.ready:t.paused);revoke.textContent=t.revoke;revoke.hidden=!value.controller;revoke.disabled=value.busy||value.expiresAt<=Date.now();
 const key=JSON.stringify([binding(value),value.locale,value.participants,value.requests]);if(key!==menuKey){menuKey=key;actionButtons=[];participants.replaceChildren();requests.replaceChildren();
 for(const p of value.participants)participants.append(action(p.name||p.identity,value,{action:'delegate',participant:{identity:p.identity,sid:p.sid}}));
 for(const r of value.requests){const row=document.createElement('div'),name=document.createElement('span');name.textContent=r.requester.name||r.requester.identity;row.append(name,action(t.approve,value,{action:'decide-request',requestId:r.id,decision:'approve'},r.expiresAt),action(t.deny,value,{action:'decide-request',requestId:r.id,decision:'deny'},r.expiresAt));requests.append(row);}}
 for(const {el,deadline} of actionButtons)el.disabled=value.busy||Math.min(value.expiresAt,deadline)<=Date.now();
}
window.castlinkStop.onState(state=>{document.documentElement.lang=state.locale;button.textContent=state.stopping?state.labels.stopping:state.labels.stop;button.disabled=state.stopping;error.hidden=!state.failed&&!state.remoteControl?.error;error.textContent=state.failed?state.labels.stopError:(state.remoteControl?.error||'');shortcut.textContent=state.shortcutAvailable?'Ctrl + Alt + Shift + S':words[state.locale].unavailable;paintControl(state.remoteControl);});
revoke.addEventListener('click',()=>{if(current)emit(current,{action:'revoke'});});
// Expiry disables stale display actions even if the owner transport has gone away.
setInterval(()=>{if(current)for(const {el,deadline} of actionButtons)el.disabled=current.busy||Math.min(current.expiresAt,deadline)<=Date.now();if(current?.expiresAt<=Date.now())revoke.disabled=true;},500);
button.addEventListener('click',()=>window.castlinkStop.stop());window.castlinkStop.ready();
