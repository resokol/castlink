'use strict';
const texts={ru:['Что показать?','Выберите экран или окно. В этой тестовой версии системный звук не передаётся, чтобы исключить попадание приватного разговора в эфир.','Отмена','Нет доступных экранов или окон.'],en:['What would you like to share?','Choose a screen or window. System audio is unavailable in this preview to keep private conversations out of the broadcast.','Cancel','No screens or windows available.'],'zh-CN':['选择共享内容','请选择屏幕或窗口。此测试版暂不传输系统音频，以防私人通话进入直播。','取消','没有可用的屏幕或窗口。']};
window.castlinkPicker.sources().then(({sources,locale})=>{
  const t=texts[locale]||texts.ru;document.documentElement.lang=locale;document.querySelector('#title').textContent=t[0];document.querySelector('#note').textContent=t[1];document.querySelector('#cancel').textContent=t[2];
  if(!sources.length)document.querySelector('#status').textContent=t[3];
  for(const source of sources){const button=document.createElement('button');button.type='button';const image=document.createElement('img');image.alt='';image.src=source.thumbnail;const name=document.createElement('span');name.textContent=source.name;button.append(image,name);button.addEventListener('click',()=>window.castlinkPicker.choose(source.id));document.querySelector('#sources').append(button);}
}).catch(()=>{document.querySelector('#status').textContent='CastLink: screen selection unavailable';});
document.querySelector('#cancel').addEventListener('click',()=>window.castlinkPicker.choose(null));
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.castlinkPicker.choose(null);});
