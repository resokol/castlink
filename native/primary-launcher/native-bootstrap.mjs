import fs from 'node:fs';
// Addresses inherited capabilities inside the authenticated primary entry flow.
// Stock JS cannot authenticate specially forged direct-Node pipe starts; neither
// magic/PID/nonce nor a caller SystemDirectory payload is accepted as authority.
let admitted=false;
try{admitted=process.platform==='win32'&&process.env.CASTLINK_NATIVE_REQUEST_FD==='3'&&process.env.CASTLINK_NATIVE_REPLY_FD==='4'&&fs.fstatSync(3).isFIFO()&&fs.fstatSync(4).isFIFO();}catch{}
if(!admitted){process.stderr.write('CastLink native Windows operation provider is unverified.\n');process.exitCode=4;}
else {const {entry}=await import('./cli/main.js');process.exitCode=await entry(process.argv.slice(2));}
