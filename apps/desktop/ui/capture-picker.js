'use strict';
const colorScheme=window.matchMedia('(prefers-color-scheme: light)');
const applyTheme=()=>{document.documentElement.dataset.theme=colorScheme.matches?'light':'dark';};
applyTheme();colorScheme.addEventListener('change',applyTheme);
const texts={ru:['Что показать?','Выберите экран или окно для демонстрации. Системный звук не передаётся.','Отмена','Нет доступных экранов или окон.'],en:['What would you like to share?','Choose a screen or window to share. System audio is not shared.','Cancel','No screens or windows available.'],'zh-CN':['选择共享内容','请选择要共享的屏幕或窗口。不传输系统音频。','取消','没有可用的屏幕或窗口。']};
const audioText={ru:['Передавать звук','Выберите окно показа PowerPoint. Передаётся звук приложения PowerPoint, включая другие его показы; микрофон и звук CastLink не захватываются. Для обычных окон и экрана звук отключён.','Для звука выберите окно PowerPoint или снимите флажок.'],en:['Share audio','Select a PowerPoint slideshow window. Captures PowerPoint application audio, including other shows; microphone and CastLink audio are excluded. Other windows and desktop have no audio.','Select a PowerPoint window for audio or clear the checkbox.'],'zh-CN':['共享音频','请选择 PowerPoint 幻灯片窗口。将捕获 PowerPoint 应用的声音（包括其他演示），不捕获麦克风或 CastLink。其他窗口和桌面没有音频。','请选择 PowerPoint 窗口或取消音频选项。']};
window.castlinkPicker.sources().then(({sources,locale,audioAvailable})=>{
  const t=texts[locale]||texts.ru;document.documentElement.lang=locale;document.querySelector('#title').textContent=t[0];document.querySelector('#note').textContent=t[1];document.querySelector('#cancel').textContent=t[2];
  const a=audioText[locale]||audioText.ru;document.querySelector('#audio-settings').hidden=!audioAvailable;document.querySelector('#audio-label').textContent=a[0];document.querySelector('#audio-help').textContent=a[1];
  if(!sources.length)document.querySelector('#status').textContent=t[3];
  for(const source of sources){const button=document.createElement('button');button.type='button';const image=document.createElement('img');image.alt='';image.src=source.thumbnail;const name=document.createElement('span');name.className='source-name';name.textContent=source.name;button.append(image,name);button.addEventListener('click',()=>{const audio=audioAvailable&&document.querySelector('#include-audio').checked;window.castlinkPicker.choose({id:source.id,audio}).catch(()=>{document.querySelector('#status').textContent=a[2];});});document.querySelector('#sources').append(button);}
}).catch(()=>{document.querySelector('#status').textContent='CastLink: screen selection unavailable';});
document.querySelector('#cancel').addEventListener('click',()=>window.castlinkPicker.choose(null));
document.addEventListener('keydown',event=>{if(event.key==='Escape')window.castlinkPicker.choose(null);});
