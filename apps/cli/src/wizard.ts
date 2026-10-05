import os from 'node:os';
import path from 'node:path';
import { CliError, type CliDependencies, type InstallRequest, type NetworkMode, type Target } from './types.js';
import type { ParsedArgs } from './args.js';

export async function requestFromArgs(args: ParsedArgs, io: Pick<CliDependencies,'readLine'>): Promise<InstallRequest> {
  const options = args.options;
  const prompt = async (label: string, fallback: string) => (await io.readLine(`${label} [${fallback}]: `, false)).trim() || fallback;
  let kind = options.target ?? await prompt('Сервер: local — этот компьютер; remote — свой VPS', 'local');
  if (kind==='1') kind='local'; if (kind==='2') kind='remote';
  if (kind!=='local' && kind!=='remote') throw new CliError('Invalid target; choose local or remote.');
  const interactive = !options.target;
  const profile = options.profile ?? (interactive ? await prompt('Имя установки', 'main') : 'main');
  let target: Target = {kind:'local'};
  if (kind==='remote') {
    const host = options.host ?? await prompt('SSH адрес собственного VPS', '');
    const user = options.user ?? await prompt('SSH пользователь', '');
    target={kind,host,user,port:options.port===undefined?22:Number(options.port)};
  }
  const network = (options.network ?? (interactive ? await prompt('Доступ: loopback, lan, internet',kind==='remote'?'internet':'loopback') : kind==='remote'?'internet':'loopback')) as NetworkMode;
  const domain = options.domain ?? (network==='internet'?await prompt('Собственный домен сервера для HTTPS',''):undefined);
  const localRoot = process.platform==='win32' ? path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'AppData','Local'),'CastLink',profile) : path.join(os.homedir(),'Library','Application Support','CastLink',profile);
  const defaultRoot = kind==='remote'?`/opt/castlink/${profile}`:localRoot;
  const root = options.root ?? (interactive?await prompt('Каталог установки',defaultRoot):defaultRoot);
  return {profile,target,network,...(domain?{domain}:{}),root,release:options.release??'1.0.0-rc.2'};
}
