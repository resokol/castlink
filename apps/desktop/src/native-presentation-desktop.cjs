'use strict';
const path=require('node:path');
function createDesktopPresentationController({resourcesPath,BrowserWindow,ipcMain,dialog,getWindow,locale=()=> 'ru'}){
 const picker=require('./window-slides-picker.cjs').createWindowSlidesPicker({BrowserWindow,ipcMain,getParent:getWindow});
 const powerPoint=require('./powerpoint.cjs').createPowerPointController({helperPath:path.join(resourcesPath,'powerpoint/Control.ps1'),chooseFile:async()=>{
  const owner=getWindow();if(!owner||owner.isDestroyed())return null;
  const result=await dialog.showOpenDialog(owner,{title:'PowerPoint',properties:['openFile'],filters:[{name:'PowerPoint',extensions:['pptx']}]});
  return owner!==getWindow()||owner.isDestroyed()||result.canceled?null:result.filePaths.length===1?result.filePaths[0]:null;
 },confirm:async({name,pages})=>{
  const owner=getWindow();if(!owner||owner.isDestroyed())return false;
  return(await dialog.showMessageBox(owner,{type:'question',message:name,detail:locale()==='ru'?`Разрешить совместное листание (${pages} слайдов)?`:`Allow shared slide navigation (${pages} slides)?`,buttons:['Cancel','Allow'],defaultId:0,cancelId:0,noLink:true})).response===1;
 }});
 const windowSlides=require('./window-slides.cjs').createWindowSlidesController({helperPath:path.join(resourcesPath,'window-slides/CastLink.WindowSlides.exe'),chooseWindow:choices=>picker.choose(choices),confirm:async({name})=>{
  const owner=getWindow();if(!owner||owner.isDestroyed())return false;
  return(await dialog.showMessageBox(owner,{type:'question',message:name,detail:locale()==='ru'?'Разрешить только перелистывание выбранного PDF? Сейчас окно будет выведено на передний план. Щёлкните по странице PDF; команды работают, пока это окно активно.':'Allow only page changes in this PDF? The window will be activated now. Click the PDF page; commands work while that window is active.',buttons:['Cancel','Allow'],defaultId:0,cancelId:0,noLink:true})).response===1;
 }});
 const controller=require('./native-presentation.cjs').createNativePresentationController({powerPoint,windowSlides}),dispose=controller.dispose;
 controller.dispose=()=>{picker.dispose();dispose();};return controller;
}
module.exports={createDesktopPresentationController};
