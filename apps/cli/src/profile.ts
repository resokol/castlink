import os from 'node:os';
import path from 'node:path';
import {CliError} from './types.js';
export function profileRoot(env:NodeJS.ProcessEnv=process.env,platform:string=process.platform,userHome:string=os.homedir()):string {
 const paths=platform==='win32'?path.win32:path.posix;
 const override=env.CASTLINK_PROFILE_ROOT;
 if(override!==undefined){
  const windowsAbsolute=platform!=='win32'||/^(?:[a-zA-Z]:[\\/]|\\\\[^\\/]+[\\/][^\\/]+[\\/])/.test(override);
  if(!paths.isAbsolute(override)||!windowsAbsolute||/[\x00-\x1f\x7f]/.test(override)||override.split(/[\\/]/).includes('..')||paths.dirname(override)===override)throw new CliError('CASTLINK_PROFILE_ROOT must be an absolute private directory path.');
  return paths.normalize(override);
 }
 return platform==='win32'?paths.join(env.LOCALAPPDATA||paths.join(userHome,'AppData','Local'),'CastLink','profiles'):paths.join(userHome,'Library','Application Support','CastLink','profiles');
}
