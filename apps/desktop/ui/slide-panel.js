'use strict';
const words={
 ru:{compact:'Управление',remote:'Совместная презентация',previous:'Предыдущий слайд',next:'Следующий слайд',navigation:'Переключение слайдов',control:'Управление слайдами',delegate:'Передать управление',reclaim:'Забрать управление',busy:'Ожидаем подтверждения…',neutral:'Статус показа не подтверждён',sharing:'Демонстрация включена',idle:'Показ не запущен',stop:'Остановить показ',stopping:'Останавливаем…',stopFailed:'Не удалось остановить. Повторите попытку.',hide:'Скрыть панель — показ продолжится',drag:'Переместить панель',participant:'Участник комнаты',empty:'В комнате нет других кастеров',note:'Только переключение слайдов. Мышь, клавиатура и другие приложения не передаются.'},
 en:{compact:'Controls',remote:'Co-presentation',previous:'Previous slide',next:'Next slide',navigation:'Slide navigation',control:'Slide controls',delegate:'Give control to',reclaim:'Take back control',busy:'Waiting for confirmation…',neutral:'Sharing status unconfirmed',sharing:'Sharing is on',idle:'Sharing has not started',stop:'Stop sharing',stopping:'Stopping…',stopFailed:'Could not stop. Please retry.',hide:'Hide panel — sharing continues',drag:'Move panel',participant:'Room participant',empty:'No other casters in this room',note:'Slide changes only. Mouse, keyboard and other applications are not shared.'},
 'zh-CN':{compact:'控制',remote:'协同演示',previous:'上一张幻灯片',next:'下一张幻灯片',navigation:'幻灯片导航',control:'幻灯片控制',delegate:'将控制权授予',reclaim:'收回控制权',busy:'等待确认…',neutral:'共享状态尚未确认',sharing:'正在共享',idle:'尚未开始共享',stop:'停止共享',stopping:'正在停止…',stopFailed:'无法停止，请重试。',hide:'隐藏面板，共享将继续',drag:'移动面板',participant:'房间参与者',empty:'房间中没有其他参与者',note:'仅切换幻灯片，不共享鼠标、键盘或其他应用。'},
};
const element=id=>document.getElementById(id),bridge=window.castlinkSlides,participants=new Map();
let current,menuOpen=false;
const menuButtons=()=>[...element('participants').querySelectorAll('button'),element('reclaim')].filter(button=>!button.hidden&&!button.disabled);
function setMenu(open,notify=true,focus=false){
 if(open&&!menuOpen)element('control-menu').scrollTop=0;
 menuOpen=!!open; element('menu-host').hidden=!menuOpen;element('control-toggle').setAttribute('aria-expanded',String(menuOpen));
 if(notify)bridge.menu(menuOpen);
 if(focus&&menuOpen)menuButtons()[0]?.focus({preventScroll:true});
}
function participantButton(identity){
 const sessionId=current.id;
 const button=document.createElement('button');button.type='button';button.className='participant';button.dataset.identity=identity;button.setAttribute('role','menuitemradio');
 const avatar=document.createElement('span');avatar.className='avatar';
 const copy=document.createElement('span');copy.className='participant-copy';const name=document.createElement('span');name.className='participant-name';const description=document.createElement('small');copy.append(name,description);
 const check=document.createElementNS('http://www.w3.org/2000/svg','svg');check.setAttribute('class','selected-check');const use=document.createElementNS('http://www.w3.org/2000/svg','use');use.setAttribute('href','#icon-check');check.append(use);button.append(avatar,copy,check);
 button.addEventListener('click',()=>{if(current?.id===sessionId)action('delegate',identity);});return{button,avatar,name,description};
}
function paint(state){
 const previousId=current?.id,focused=document.activeElement,focusedIdentity=focused?.dataset?.identity;
 current=state;const t=words[state.locale]||words.ru,toolbar=state.toolbar,owner=!!(toolbar?.canDelegate||toolbar?.canStop||state.canReclaim);document.documentElement.lang=state.locale;
 element('panel').classList.toggle('owner',owner);element('heading').hidden=!owner;element('heading').textContent=t.remote;element('controller').hidden=!owner;element('control-wrap').hidden=!owner;
 if(previousId!==state.id){setMenu(false,false);for(const row of participants.values())row.button.remove();participants.clear();}
 if(typeof state.menuOpen==='boolean')setMenu(state.menuOpen,false);
 element('title').textContent=state.title;element('title').title=state.title;
 element('controller').textContent=state.busy?`${state.controller} · ${t.busy}`:state.controller;element('controller').title=element('controller').textContent;
 element('controller-badge').textContent=state.controller;element('page').textContent=`${state.page} / ${state.pages}`;element('navigation').setAttribute('aria-label',t.navigation);
 for(const name of['previous','next']){element(name).setAttribute('aria-label',t[name]);element(name).title=t[name];element(name).disabled=state.busy||!state.canNavigate||(state.navigationMode!=='powerpoint-steps-v1'&&(name==='previous'?state.page<=1:state.page>=state.pages));}
 const canMenu=!!toolbar?.canDelegate||state.canReclaim;
 element('control-toggle').hidden=!canMenu;element('controller-badge').hidden=canMenu;element('control-label').textContent=t.compact;element('control-toggle').setAttribute('aria-label',t.control);element('control-menu').setAttribute('aria-label',t.control);
 if(!canMenu)setMenu(false,false);
 element('menu-heading').textContent=t.delegate;element('menu-current').textContent=state.controller;element('menu-note').textContent=t.note;element('empty').textContent=t.empty;
 const list=toolbar?.canDelegate?toolbar.participants:[],seen=new Set();
 for(let index=0;index<list.length;index++){
  const participant=list[index];seen.add(participant.identity);let row=participants.get(participant.identity);if(!row){row=participantButton(participant.identity);participants.set(participant.identity,row);}
  row.avatar.textContent=participant.name.trim().slice(0,2).toUpperCase();row.name.textContent=participant.name;row.description.textContent=t.participant;row.button.setAttribute('aria-checked',String(toolbar.controllerIdentity===participant.identity));row.button.disabled=state.busy||!toolbar.canDelegate;
  if(element('participants').children[index]!==row.button)element('participants').insertBefore(row.button,element('participants').children[index]||null);
 }
 for(const[identity,row]of participants)if(!seen.has(identity)){row.button.remove();participants.delete(identity);}
 element('empty').hidden=!toolbar?.canDelegate||list.length>0;
 element('reclaim').hidden=!state.canReclaim;element('reclaim').disabled=state.busy||!!toolbar&&!toolbar.canDelegate;element('reclaim-label').textContent=t.reclaim;
 element('sharing-strip').classList.toggle('active',!!toolbar?.sharing);element('stop-error').hidden=!state.stopFailed;element('stop-error').textContent=t.stopFailed;
 element('status').textContent=state.busy?t.busy:!toolbar?t.neutral:toolbar.sharing?t.sharing:t.idle;element('status').title=element('status').textContent;
 element('stop').hidden=!toolbar?.canStop;element('stop').disabled=!!state.stopPending;element('stop-label').textContent=state.stopPending?t.stopping:t.stop;
 element('hide').setAttribute('aria-label',t.hide);element('hide').title=t.hide;element('drag').title=t.drag;element('drag').setAttribute('aria-label',t.drag);
 if(focusedIdentity&&menuOpen&&participants.has(focusedIdentity)&&document.activeElement!==focused)participants.get(focusedIdentity).button.focus();
 else if(focusedIdentity&&!participants.has(focusedIdentity))element('control-toggle').focus();
}
function action(name,controllerIdentity){
 if(!current)return;const toolbar=current.toolbar;
 if(name==='stop'){
  if(!toolbar?.canStop||!toolbar.sharing||current.stopPending)return;
  bridge.action({id:current.id,action:'stop'});paint({...current,stopPending:true,stopFailed:false});return;
 }
 if(current.busy)return;
 if(name==='delegate'){if(!toolbar?.canDelegate||!toolbar.participants.some(item=>item.identity===controllerIdentity))return;}
 else if(name==='reclaim'){if(!current.canReclaim||toolbar&&!toolbar.canDelegate)return;}
 else if(!['previous','next'].includes(name)||element(name).disabled)return;
 bridge.action(name==='delegate'?{id:current.id,action:name,controllerIdentity}:{id:current.id,action:name});setMenu(false);paint({...current,busy:true,menuOpen:false});
}
for(const name of['previous','next','reclaim','stop'])element(name).addEventListener('click',()=>action(name));
element('control-toggle').addEventListener('click',()=>setMenu(!menuOpen,true,!menuOpen));
element('hide').addEventListener('click',()=>{setMenu(false);bridge.hide();});
document.addEventListener('keydown',event=>{
 if(event.key==='Escape'&&menuOpen){event.preventDefault();setMenu(false);element('control-toggle').focus();return;}
 if(event.altKey||event.ctrlKey||event.metaKey||event.repeat)return;
 if(menuOpen&&['ArrowDown','ArrowUp','Home','End'].includes(event.key)){
  const buttons=menuButtons();if(!buttons.length)return;event.preventDefault();let index=buttons.indexOf(document.activeElement);index=event.key==='Home'?0:event.key==='End'?buttons.length-1:event.key==='ArrowDown'?(index+1)%buttons.length:(index-1+buttons.length)%buttons.length;buttons[index].focus();return;
 }
 if(document.activeElement===element('control-toggle')&&event.key==='ArrowDown'){event.preventDefault();setMenu(true,true,true);return;}
 if(!menuOpen&&event.target?.tagName!=='BUTTON'&&['ArrowLeft','ArrowRight'].includes(event.key)){event.preventDefault();action(event.key==='ArrowLeft'?'previous':'next');}
});
document.addEventListener('click',event=>{if(menuOpen&&!element('control-menu').contains(event.target)&&!element('control-toggle').contains(event.target))setMenu(false);});
bridge.onState(paint);bridge.ready();
