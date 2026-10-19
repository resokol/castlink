'use strict';
const { isTrustedFrame } = require('./server-policy.cjs');
function validScreenState(value) {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if(Object.keys(value).some(k=>!['captureId','sharing','visible','stopping','failed','locale','labels'].includes(k)))return false;
  if(typeof value.captureId!=='string'||!/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value.captureId))return false;
  if(['sharing','visible','stopping','failed'].some(k=>typeof value[k]!=='boolean'))return false;
  if(!['ru','en','zh-CN'].includes(value.locale))return false;
  const labels=value.labels;
  return !!labels&&typeof labels==='object'&&!Array.isArray(labels)&&Object.keys(labels).length===4&&
    ['title','stop','stopping','stopError'].every(k=>typeof labels[k]==='string'&&labels[k].length>0&&labels[k].length<=240);
}
function isClientEvent(event,client,trustedOrigins) {
  return !!client&&!client.isDestroyed()&&event.sender===client.webContents&&event.senderFrame===client.webContents.mainFrame&&
    isTrustedFrame({frameUrl:event.senderFrame?.url,isMainFrame:true,trustedOrigins});
}
module.exports={validScreenState,isClientEvent};
