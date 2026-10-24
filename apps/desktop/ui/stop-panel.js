'use strict';
const button=document.querySelector('#stop'),error=document.querySelector('#error'),shortcut=document.querySelector('#shortcut');
const remote=document.querySelector('#remote-control'),status=document.querySelector('#control-status'),participants=document.querySelector('#participants'),requests=document.querySelector('#requests'),revoke=document.querySelector('#revoke'),disclosure=document.querySelector('#disclosure'),give=document.querySelector('#give');
const words={ru:{give:'Передать управление',revoke:'Забрать управление',approve:'Разрешить',deny:'Отклонить',ready:'Управление доступно',paused:'Управление приостановлено',owner:'Управляете вы',scope:'Клавиатура и мышь всего ПК',limits:'Системные сочетания и защищённый рабочий стол недоступны',unavailable:'Горячая клавиша занята. Используйте кнопку.'},en:{give:'Give control',revoke:'Reclaim control',approve:'Allow',deny:'Deny',ready:'Control available',paused:'Control paused',owner:'You have control',scope:'Keyboard and pointer for the full PC',limits:'Reserved shortcuts and secure desktop are unavailable',unavailable:'Shortcut unavailable. Use the button.'},'zh-CN':{give:'交出控制权',revoke:'收回控制权',approve:'允许',deny:'拒绝',ready:'可以控制',paused:'控制已暂停',owner:'您正在控制',scope:'整台电脑的键盘和鼠标',limits:'不支持系统保留快捷键和安全桌面',unavailable:'快捷键不可用，请使用按钮。'}};
let current,menuScope,actionButtons=[];
const participantNodes=new Map(),requestNodes=new Map();
const binding=v=>v&&JSON.stringify([v.captureId,v.sessionId,v.generation]);
function emit(snapshot,value){if(current!==snapshot||snapshot.busy||snapshot.expiresAt<=Date.now())return;window.castlinkStop.intent({captureId:snapshot.captureId,sessionId:snapshot.sessionId,generation:snapshot.generation,revision:snapshot.revision,sequence:snapshot.sequence,...value});}
function deadline(snapshot,action){
 const value=action.value;
 if(value.action==='delegate')return snapshot.participants.some(p=>p.identity===value.participant.identity&&p.sid===value.participant.sid)?Infinity:undefined;
 const request=snapshot.requests.find(r=>r.id===value.requestId&&r.requester.identity===action.requester.identity&&r.requester.sid===action.requester.sid);
 return request?.expiresAt;
}
function enabled(action){const latest=current;if(!latest||binding(latest)!==action.scope||latest.busy||latest.expiresAt<=Date.now())return false;const until=deadline(latest,action);return until!==undefined&&until>Date.now();}
function action(label,snapshot,value,requester){
 const el=document.createElement('button');el.type='button';el.textContent=label;
 const result={el,scope:binding(snapshot),value,requester:requester&&{identity:requester.identity,sid:requester.sid}};
 el.addEventListener('click',()=>{if(enabled(result))emit(current,value);});return result;
}
function reconcile(container,entries,nodes){
 const keep=new Set(entries.map(entry=>entry.key));
 for(const [key,entry]of nodes)if(!keep.has(key)){entry.el.remove();nodes.delete(key);}
 entries.forEach((entry,index)=>{if(container.children[index]!==entry.el)container.insertBefore(entry.el,container.children[index]||null);});
}
function paintControl(value){
 current=value;remote.hidden=!value;if(!value){menuScope=undefined;actionButtons=[];participantNodes.clear();requestNodes.clear();participants.replaceChildren();requests.replaceChildren();return;}
 const t=words[value.locale];give.textContent=t.give;disclosure.textContent=t.scope;disclosure.title=t.limits;
 status.textContent=(value.controller?.name||t.owner)+' · '+(value.status==='ready'?t.ready:t.paused);revoke.textContent=t.revoke;revoke.hidden=!value.controller;revoke.disabled=value.busy||value.expiresAt<=Date.now();
 const scope=binding(value);if(scope!==menuScope){menuScope=scope;participantNodes.clear();requestNodes.clear();participants.replaceChildren();requests.replaceChildren();}
 // Stable semantic keys exclude polling clocks, revision and sequence. Every
 // click/disabled check uses the latest scope, membership, revision and deadline.
 const roster=value.participants.map(p=>{
  const key=JSON.stringify([p.identity,p.sid]);let entry=participantNodes.get(key);
  if(!entry){entry={key,...action(p.name||p.identity,value,{action:'delegate',participant:{identity:p.identity,sid:p.sid}})};participantNodes.set(key,entry);}
  entry.el.textContent=p.name||p.identity;return entry;
 });
 const pending=value.requests.map(r=>{
  const key=JSON.stringify([r.id,r.requester.identity,r.requester.sid]);let entry=requestNodes.get(key);
  if(!entry){const el=document.createElement('div'),name=document.createElement('span'),approve=action(t.approve,value,{action:'decide-request',requestId:r.id,decision:'approve'},r.requester),deny=action(t.deny,value,{action:'decide-request',requestId:r.id,decision:'deny'},r.requester);el.append(name,approve.el,deny.el);entry={key,el,name,approve,deny};requestNodes.set(key,entry);}
  entry.name.textContent=r.requester.name||r.requester.identity;entry.approve.el.textContent=t.approve;entry.deny.el.textContent=t.deny;return entry;
 });
 reconcile(participants,roster,participantNodes);reconcile(requests,pending,requestNodes);
 actionButtons=[...roster,...pending.flatMap(entry=>[entry.approve,entry.deny])];
 for(const item of actionButtons)item.el.disabled=!enabled(item);
}
window.castlinkStop.onState(state=>{document.documentElement.lang=state.locale;button.textContent=state.stopping?state.labels.stopping:state.labels.stop;button.disabled=state.stopping;error.hidden=!state.failed&&!state.remoteControl?.error;error.textContent=state.failed?state.labels.stopError:(state.remoteControl?.error||'');shortcut.textContent=state.shortcutAvailable?'Ctrl + Alt + Shift + S':words[state.locale].unavailable;paintControl(state.remoteControl);});
revoke.addEventListener('click',()=>{if(current?.controller)emit(current,{action:'revoke'});});
// Expiry disables stale display actions even if the owner transport has gone away.
setInterval(()=>{if(current){for(const item of actionButtons)item.el.disabled=!enabled(item);revoke.disabled=current.busy||current.expiresAt<=Date.now()||!current.controller;}},500);
button.addEventListener('click',()=>window.castlinkStop.stop());window.castlinkStop.ready();
