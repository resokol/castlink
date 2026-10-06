import fs from 'node:fs';
// Addresses inherited capabilities inside the authenticated primary entry flow.
// Stock JS cannot authenticate specially forged direct-Node pipe starts; neither
// magic/PID/nonce nor a caller SystemDirectory payload is accepted as authority.
let admitted=false,bootstrapReason=0,errorCode=0;
try{admitted=(bootstrapReason=1,process.platform==='win32')&&(bootstrapReason=2,process.env.CASTLINK_NATIVE_REQUEST_FD==='3')&&(bootstrapReason=3,process.env.CASTLINK_NATIVE_REPLY_FD==='4')&&(bootstrapReason=4,fs.fstatSync(3).isFIFO())&&(bootstrapReason=5,fs.fstatSync(4).isFIFO());}catch(error){errorCode=error?.code==='EBADF'?1:error?.code==='EINVAL'?2:error?.code==='EACCES'?3:error?.code==='EPERM'?4:5;}
if(!admitted){process.stderr.write(JSON.stringify({schemaVersion:1,bootstrapReason,errorCode})+'\n');process.exitCode=4;}
else {
 const {windowsNativeBroker}=await import('./cli/windows-native-broker.js');
 // Fixed-operation hooks only. No executable, script, environment or path
 // authority is returned; checked backup workers use their dedicated parent IPC.
 Object.defineProperties(globalThis,{
  __castlinkWindowsNativeBridge:{value:request=>windowsNativeBroker.executeSync('target-lease-v1',request)},
  __castlinkWindowsNativeRuntime:{value:request=>windowsNativeBroker.executeSync('docker-preflight-v1',request)},
  __castlinkWindowsNativeEngine:{value:request=>windowsNativeBroker.executeSync('docker-engine-v1',request)},
  __castlinkWindowsNativeBackup:{value:Object.freeze({openSession:(operation,header)=>windowsNativeBroker.openSession(operation,header)})}
 });
 const {entry}=await import('./cli/main.js');process.exitCode=await entry(process.argv.slice(2));
}
