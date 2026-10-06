import fs from 'node:fs';
// Addresses inherited capabilities inside the authenticated primary entry flow.
// Stock JS cannot authenticate specially forged direct-Node pipe starts; neither
// magic/PID/nonce nor a caller SystemDirectory payload is accepted as authority.
let admitted=false;
try{admitted=process.platform==='win32'&&process.env.CASTLINK_NATIVE_REQUEST_FD==='3'&&process.env.CASTLINK_NATIVE_REPLY_FD==='4'&&fs.fstatSync(3).isFIFO()&&fs.fstatSync(4).isFIFO();}catch{}
if(!admitted){process.stderr.write('CastLink native Windows operation provider is unverified.\n');process.exitCode=4;}
else {
 const {windowsNativeBroker}=await import('./cli/windows-native-broker.js');
 // Fixed-operation hooks only. No executable, script, environment or path
 // authority is returned; checked backup workers use their dedicated parent IPC.
 Object.defineProperties(globalThis,{
  __castlinkWindowsNativeBridge:{value:request=>windowsNativeBroker.executeSync('target-lease-v1',request)},
  __castlinkWindowsNativeEngine:{value:request=>windowsNativeBroker.executeSync('docker-engine-v1',request)},
  __castlinkWindowsNativeBackup:{value:Object.freeze({openSession:(operation,header)=>windowsNativeBroker.openSession(operation,header)})}
 });
 const {entry}=await import('./cli/main.js');process.exitCode=await entry(process.argv.slice(2));
}
