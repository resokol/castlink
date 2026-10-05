import type {CheckResult, Executor, ExecutionRequest} from './types.js';

type ProbeFacts = {platform:string; arch:string; osVersion:string; distribution?:string; dockerHost?:string; dockerContext?:string};
const hostScript = `const os=require('node:os');let version=os.release();if(process.platform==='darwin')version=String(Number(version.split('.')[0])-9);console.log(JSON.stringify({platform:process.platform,arch:process.arch,osVersion:version,dockerHost:process.env.DOCKER_HOST||'',dockerContext:process.env.DOCKER_CONTEXT||''}));`;
// No Node dependency on the VPS. os-release values are parsed as data, never sourced as shell code.
const remoteHostScript = `import json,os,platform,shlex
release={}
with open('/etc/os-release',encoding='utf-8') as f:
 for line in f:
  key,sep,value=line.strip().partition('=')
  if sep and key in ('ID','VERSION_ID'):
   parts=shlex.split(value)
   if len(parts)!=1: raise ValueError('Invalid os-release')
   release[key]=parts[0]
print(json.dumps({'platform':platform.system().lower(),'arch':platform.machine(),'distribution':release.get('ID',''),'osVersion':release.get('VERSION_ID',''),'dockerHost':os.environ.get('DOCKER_HOST',''),'dockerContext':os.environ.get('DOCKER_CONTEXT','')}))
`;
function arch(value:string): 'amd64'|'arm64'|undefined {
  if (['x64','amd64','x86_64'].includes(value)) return 'amd64';
  if (['arm64','aarch64'].includes(value)) return 'arm64';
}
function parseFacts(raw:string):ProbeFacts {
  const value=JSON.parse(raw) as ProbeFacts;
  if (!value || Array.isArray(value) || typeof value.platform!=='string' || typeof value.arch!=='string' || typeof value.osVersion!=='string' ||
      [value.distribution,value.dockerHost,value.dockerContext].some(x=>x!==undefined && typeof x!=='string')) throw new Error('Invalid host facts');
  return value;
}
function supported(facts:ProbeFacts,remote:boolean):boolean {
  if (remote) return facts.platform==='linux' && facts.distribution==='ubuntu' && ['22.04','24.04'].includes(facts.osVersion) && arch(facts.arch)!==undefined;
  const windows=/^10\.0\.(\d+)(?:\.\d+)?$/.exec(facts.osVersion);
  const mac=/^\d+(?:\.\d+)*$/.test(facts.osVersion);
  return (facts.platform==='win32' && facts.arch==='x64' && !!windows && Number(windows[1])>=22000) ||
    (facts.platform==='darwin' && ['arm64','x64'].includes(facts.arch) && mac && Number(facts.osVersion.split('.')[0])>=14);
}
function localEndpoint(value:unknown,platform:string):boolean {
  if (typeof value!=='string' || /[\x00\r\n]/.test(value)) return false;
  return platform==='win32'
    ? /^npipe:\/\/\/\/\.\/pipe\/[^/\\]+$/.test(value) || /^unix:\/\/\/[^/]/.test(value)
    : /^unix:\/\/\/[^/]/.test(value);
}
const request=(executable:string,args:string[]):ExecutionRequest=>({executable,args,sensitive:false});
const unverified = ():CheckResult[]=>[
  {id:'services',state:'unverified',message:'Службы CastLink и завершение установки не проверены; doctor проверяет только предпосылки.'},
  {id:'tls',state:'unverified',message:'DNS, сетевой доступ и TLS не проверены.'},
  {id:'media',state:'unverified',message:'Медиасеть, звук, видео и TURN relay не проверены; наличие runtime не подтверждает передачу медиа.'},
];

export async function prerequisiteChecks(executor:Executor,remote:boolean):Promise<CheckResult[]> {
  const checks:CheckResult[]=[];
  let facts:ProbeFacts|undefined;
  let reached=false;
  try {
    const response=await executor.run(remote?request('python3',['-c',remoteHostScript]):request(process.execPath,['-e',hostScript]));
    reached=true;
    if (response.code===0) facts=parseFacts(response.stdout);
  } catch { /* Probe output and errors may contain credentials; report only fixed messages. */ }
  if (remote) {
    checks.push({id:'ssh',state:reached?'pass':'fail',message:reached?'SSH-доступ к выбранному VPS и Python3 helper доступны.':'SSH недоступен: проверь OpenSSH, ранее доверенный ключ сервера, SSH-ключ и Python3 на VPS. Пароли и изменение known_hosts не используются.'});
    if (!reached) return [...checks,{id:'platform',state:'unverified',message:'ОС VPS не проверена без SSH-доступа.'},{id:'docker-context',state:'unverified',message:'Docker context VPS не проверен.'},{id:'docker',state:'unverified',message:'Docker Engine VPS не проверен.'},{id:'compose',state:'unverified',message:'Docker Compose VPS не проверен.'},...unverified()];
  }
  const platformReady=!!facts && supported(facts,remote);
  checks.push({id:'platform',state:platformReady?'pass':'fail',message:platformReady?(remote?'Ubuntu и архитектура VPS подходят.':'ОС и архитектура подходят для desktop-сценария.'):(remote?'Необходим Ubuntu Server 22.04/24.04 LTS amd64/arm64; ОС и архитектура должны быть проверены.':'Поддерживаются Windows 11 x64 и macOS 14+ arm64/x64; ОС и архитектура должны быть проверены.')});

  let contextReady=false,contextUnavailable=false;
  try {
    // DOCKER_CONTEXT overrides DOCKER_HOST; inspect the effective context in that case.
    if (facts?.dockerHost && !facts.dockerContext) contextReady=localEndpoint(facts.dockerHost,facts.platform);
    else {
      const response=await executor.run(request('docker',['context','inspect','--format','{{json .Endpoints.docker.Host}}']));
      if (response.code!==0) contextUnavailable=true;
      else contextReady=localEndpoint(JSON.parse(response.stdout),facts?.platform??'');
    }
  } catch {contextUnavailable=true;}
  checks.push({id:'docker-context',state:contextReady?'pass':'fail',message:contextReady?'Docker endpoint относится к выбранной машине.':'Не удалось подтвердить Docker endpoint выбранной машины. Проверь Docker context и DOCKER_HOST; удалённый endpoint не считается локальным runtime.'});
  if (contextReady) {
    try {
      const response=await executor.run(request('docker',['version','--format','{{.Server.Os}}|{{.Server.Arch}}|{{.Server.Version}}']));
      const fields=response.stdout.trim().split('|');
      const ready=response.code===0 && fields.length===3 && fields[0]==='linux' && /^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(fields[2]??'') && !!facts && arch(facts.arch)!==undefined && arch(fields[1]??'')===arch(facts.arch);
      checks.push({id:'docker',state:ready?'pass':'fail',message:ready?'Docker Engine работает с Linux containers и подходящей архитектурой.':remote?'Необходим работающий Linux Docker Engine с архитектурой VPS. Проверь доступ пользователя к Docker.':'Установи и запусти поддерживаемый Docker Desktop с Linux containers и архитектурой этого компьютера (Windows: WSL2).'});
    } catch {checks.push({id:'docker',state:'fail',message:remote?'Docker Engine VPS недоступен; проверь runtime и права пользователя.':'Docker Desktop не найден или не запущен; установи runtime перед развёртыванием.'});}
    try {
      const response=await executor.run(request('docker',['compose','version','--short']));
      const ready=response.code===0 && /^v?2\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(response.stdout.trim());
      checks.push({id:'compose',state:ready?'pass':'fail',message:ready?'Docker Compose v2 доступен.':'Необходим Docker Compose v2.'});
    } catch {checks.push({id:'compose',state:'fail',message:'Docker Compose v2 недоступен.'});}
  } else {
    checks.push({id:'docker',state:contextUnavailable?'fail':'unverified',message:contextUnavailable?'Docker runtime недоступен или его context не удалось прочитать.':'Docker Engine выбранной машины не проверен: endpoint относится к другой машине или не распознан.'});
    checks.push({id:'compose',state:'unverified',message:'Docker Compose выбранной машины не проверен без подтверждённого локального endpoint.'});
  }
  if (!remote) {
    try {
      const response=await executor.run(request('ssh',['-V']));
      checks.push({id:'ssh',state:response.code===0?'pass':'warning',message:response.code===0?'Системный OpenSSH доступен для VPS-сценария.':'OpenSSH недоступен; он потребуется для проверки и установки на VPS.'});
    } catch {checks.push({id:'ssh',state:'warning',message:'OpenSSH не найден; для VPS-сценария включи OpenSSH Client (Windows) или проверь системный ssh (macOS).'});}
  }
  return [...checks,...unverified()];
}
export async function localChecks(executor:Executor):Promise<CheckResult[]> {
  return prerequisiteChecks(executor,false);
}
