import os from'node:os';import path from'node:path';
export function profileRoot():string{
 return process.platform==='win32'?path.join(process.env.LOCALAPPDATA||path.join(os.homedir(),'AppData','Local'),'CastLink','profiles'):path.join(os.homedir(),'Library','Application Support','CastLink','profiles');
}
