import {parseStrictJson} from './strict-json.js';
import {CliError} from './types.js';
export type NativeWindowsPreflight={schemaVersion:1;engine:string;endpoint:string;serverOS:string;serverArch:string;serverVersion:string;composeVersion:string;dockerSHA256:string;composeSHA256:string};
export function observeNativeWindowsPreflight():NativeWindowsPreflight{
 try{
  const hook=(globalThis as {__castlinkWindowsNativeRuntime?:(input:{action:'observe'})=>unknown}).__castlinkWindowsNativeRuntime;
  if(process.platform!=='win32'||typeof hook!=='function')throw Error();
  const response=hook({action:'observe'}) as {status?:unknown;stdout?:unknown};
  if(!response||Object.keys(response).sort().join(',')!=='status,stdout'||response.status!=='ok'||typeof response.stdout!=='string')throw Error();
  const v=parseStrictJson(response.stdout,4096) as NativeWindowsPreflight;
  if(!v||Object.keys(v).sort().join(',')!=='composeSHA256,composeVersion,dockerSHA256,endpoint,engine,schemaVersion,serverArch,serverOS,serverVersion'||v.schemaVersion!==1||typeof v.engine!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(v.engine)||v.endpoint!=='npipe:////./pipe/dockerDesktopLinuxEngine'||![v.serverOS,v.serverArch,v.serverVersion,v.composeVersion].every(x=>typeof x==='string'&&/^[A-Za-z0-9.+_-]{1,64}$/.test(x))||![v.dockerSHA256,v.composeSHA256].every(x=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x)))throw Error();return v;
 }catch{throw new CliError('Native Windows runtime prerequisites are unavailable or unknown; protected Desktop/CLI/Compose observations are required. No raw discovery or installation was authorized.',4);}
}
