'use strict';
function startFailure(reply,permissions){
 if(reply?.ok===true&&reply.state?.ready===true&&reply.state?.pointerReady===true)return null;
 const missing=['screen','accessibility','inputMonitoring'].some(key=>permissions?.[key]===false);
 const permissionFailure=['REMOTE_INPUT_UNAVAILABLE','REMOTE_INPUT_MONITORING_PERMISSION','REMOTE_INPUT_DESKTOP'].includes(reply?.error||reply?.state?.error);
 return {status:missing&&permissionFailure?'NOT VERIFIED':'FAILED',reason:reply?.error||reply?.state?.error||'native fixture source did not become ready',...(reply?.diagnostic?{bindingDiagnostic:reply.diagnostic}:{})};
}
module.exports={startFailure};
