import os from 'node:os';
import path from 'node:path';
import { CliError, type CliDependencies, type InstallRequest, type NetworkMode, type Target } from './types.js';
import type { ParsedArgs } from './args.js';
import {profileRoot} from './profile.js';

export async function requestFromArgs(args: ParsedArgs, io: Pick<CliDependencies,'readLine'>, loadSaved?: (name:string)=>Promise<InstallRequest|undefined>): Promise<InstallRequest> {
  const options = args.options;
  const prompt = async (label: string, fallback: string) => (await io.readLine(`${label} [${fallback}]: `, false)).trim() || fallback;
  let kind = options.target ?? await prompt('Сервер: local — этот компьютер; remote — свой VPS', 'local');
  if (kind==='1') kind='local'; if (kind==='2') kind='remote';
  if (kind!=='local' && kind!=='remote') throw new CliError('Invalid target; choose local or remote.');
  const interactive = !options.target || options['easy-setup']==='true';
  const profile = options.profile ?? (interactive ? await prompt('Имя установки', 'main') : 'main');
  if(interactive && loadSaved){
    const saved=await loadSaved(profile);
    if(saved){
      const changedSsh=['host','user','port'].some(key=>options[key]!==undefined&&(saved.target.kind!=='remote'||options[key]!==String(saved.target[key as 'host'|'user'|'port'])));
      const changedInternet=['public-ipv4','turn-domain'].some(key=>options[key]!==undefined&&options[key]!==saved.internet?.[key==='public-ipv4'?'publicIPv4':'turnDomain']);
      if(saved.target.kind!==kind || changedSsh || changedInternet || ['network','domain','root','release'].some(key=>options[key]!==undefined&&options[key]!==saved[key as keyof InstallRequest]))throw new CliError('Это имя уже занято установкой с другими настройками. Для новой установки выбери другое имя.',4);
      return structuredClone(saved);
    }
  }
  let target: Target = {kind:'local'};
  if (kind==='remote') {
    const host = options.host ?? await prompt('SSH адрес собственного VPS', '');
    const user = options.user ?? await prompt('SSH пользователь', '');
    const port=options.port??(interactive?await prompt('SSH порт','22'):'22');
    target={kind,host,user,port:Number(port)};
  }
  const network = (options.network ?? (interactive ? await prompt('Доступ: loopback, lan, internet',kind==='remote'?'internet':'loopback') : kind==='remote'?'internet':'loopback')) as NetworkMode;
  const domain = options.domain ?? (network==='internet'?await prompt('Собственный домен сервера для HTTPS',''):undefined);
  const internet=network==='internet'?{domain:domain??'',publicIPv4:options['public-ipv4']??(interactive?await prompt('Публичный IPv4 самого VPS (не этого компьютера)',''):''),...(options['turn-domain']?{turnDomain:options['turn-domain']}:{})}:undefined;
  if(network!=='internet'&&(options['public-ipv4']||options['turn-domain']))throw new CliError('Публичный IPv4 и TURN-домен применяются только к режиму internet.',2);
  const localRoot = process.platform==='win32' ? path.win32.join(profileRoot(),profile+'-server') : path.join(os.homedir(),'Library','Application Support','CastLink',profile);
  const defaultRoot = kind==='remote'?`/opt/castlink/${profile}`:localRoot;
  const root = options.root ?? (interactive?await prompt('Каталог установки',defaultRoot):defaultRoot);
  return {profile,target,network,...(domain?{domain}:{}),...(internet?{internet}:{}),root,release:options.release??'1.0.0-rc.2'};
}
