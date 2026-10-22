'use strict';
const list=document.querySelector('#windows'),choose=document.querySelector('#choose');let selected;
window.castlinkWindowPicker.list().then(windows=>{
 document.querySelector('#empty').hidden=windows.length!==0;
 for(const item of windows){const button=document.createElement('button');button.type='button';button.role='option';button.textContent=item.name;button.setAttribute('aria-selected','false');
  button.addEventListener('click',()=>{selected=item.id;for(const option of list.children)option.setAttribute('aria-selected',String(option===button));choose.disabled=false;});list.append(button);}
 list.firstElementChild?.focus();
});
const finish=id=>window.castlinkWindowPicker.choose(id);
document.querySelector('#cancel').addEventListener('click',()=>finish(null));choose.addEventListener('click',()=>{if(selected)finish(selected);});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){event.preventDefault();finish(null);}if(event.key==='Enter'&&selected){event.preventDefault();finish(selected);}});
