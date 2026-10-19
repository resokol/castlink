'use strict';
const words={ru:{previous:'← Назад',next:'Вперёд →',controller:'Управляет: ',reclaim:'Забрать управление',busy:'Ожидаем подтверждения…',ready:'Слайды синхронизированы'},en:{previous:'← Previous',next:'Next →',controller:'Controls: ',reclaim:'Take back control',busy:'Waiting for confirmation…',ready:'Slides synchronized'},'zh-CN':{previous:'← 上一页',next:'下一页 →',controller:'控制者：',reclaim:'收回控制权',busy:'等待确认…',ready:'幻灯片已同步'}};
const element=id=>document.getElementById(id);let current;
function paint(state){
 current=state;const t=words[state.locale]||words.ru;document.documentElement.lang=state.locale;
 element('title').textContent=state.title;element('title').title=state.title;element('controller').textContent=state.controller;element('controller').title=state.controller;
 element('page').textContent=`${state.page} / ${state.pages}`;element('previous').textContent=t.previous;element('next').textContent=t.next;
 element('previous').disabled=state.busy||!state.canNavigate||state.page<=1;element('next').disabled=state.busy||!state.canNavigate||state.page>=state.pages;
 element('reclaim').hidden=!state.canReclaim;element('reclaim').disabled=state.busy;element('reclaim').textContent=t.reclaim;element('status').textContent=state.busy?t.busy:t.ready;
}
function action(name){if(!current)return;const button=element(name);if(button.disabled||button.hidden)return;window.castlinkSlides.action({id:current.id,action:name});paint({...current,busy:true});}
for(const name of ['previous','next','reclaim'])element(name).addEventListener('click',()=>action(name));
document.addEventListener('keydown',event=>{if(event.altKey||event.ctrlKey||event.metaKey||event.repeat||event.target?.tagName==='BUTTON')return;if(['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();action(event.key==='ArrowLeft'?'previous':'next');}});
window.castlinkSlides.onState(paint);window.castlinkSlides.ready();
