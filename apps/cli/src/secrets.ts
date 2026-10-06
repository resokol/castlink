import { mkdir, chmod, open, rm } from 'node:fs/promises';
import path from 'node:path';
import {windowsNativeBroker} from './windows-native-broker.js';

export async function protectPath(file: string, directory: boolean, platform: string = process.platform): Promise<void> {
  if (platform==='win32') {
    windowsNativeBroker.executeSync('protect-path-v1',{path:file,directory});
  } else await chmod(file,directory?0o700:0o600);
}
export async function ensurePrivateDirectory(directory: string): Promise<void> {
  await mkdir(directory,{recursive:true,mode:0o700});
  await protectPath(directory,true);
}
export async function writeSecretFile(file: string, contents: string, platform: string = process.platform): Promise<void> {
  await mkdir(path.dirname(file),{recursive:true,mode:0o700});
  await protectPath(path.dirname(file),true,platform);
  const handle=await open(file,'wx',0o600);
  try {await protectPath(file,false,platform);await handle.writeFile(contents,'utf8');await handle.sync();}
  catch(error){await handle.close();await rm(file,{force:true});throw error;}
  await handle.close();
}
