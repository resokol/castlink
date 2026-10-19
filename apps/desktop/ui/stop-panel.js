'use strict';
const button=document.querySelector('#stop'),error=document.querySelector('#error'),shortcut=document.querySelector('#shortcut');
window.castlinkStop.onState(state=>{document.documentElement.lang=state.locale;button.textContent=state.stopping?state.labels.stopping:state.labels.stop;button.disabled=state.stopping;error.hidden=!state.failed;error.textContent=state.labels.stopError;shortcut.textContent=state.shortcutAvailable?'Ctrl + Alt + Shift + S':({ru:'Горячая клавиша занята. Используйте кнопку.',en:'Shortcut unavailable. Use the button.','zh-CN':'快捷键不可用，请使用按钮。'}[state.locale]);});
button.addEventListener('click',()=>window.castlinkStop.stop());window.castlinkStop.ready();
