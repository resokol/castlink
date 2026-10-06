import {isPrivateVolumeCapability} from './private-volume-capability.js';
import {observeNativeWindowsPreflight} from './windows-native-preflight.js';
import {validatePrivateControlCapability,type PrivateControlCapability} from './private-control-capability.js';
import type {CheckResult, Executor, ExecutionRequest} from './types.js';

type ProbeFacts = {platform:string; arch:string; osVersion:string; distribution?:string; uid?:number; gid?:number; dockerHost?:string; dockerContext?:string};
const hostScript = `const os=require('node:os');let version=os.release();if(process.platform==='darwin')version=String(Number(version.split('.')[0])-9);console.log(JSON.stringify({platform:process.platform,arch:process.arch,osVersion:version,dockerHost:process.env.DOCKER_HOST||'',dockerContext:process.env.DOCKER_CONTEXT||''}));`;
const privateHostScript = `const os=require('node:os'),fs=require('node:fs');let distribution='',osVersion=os.release();if(process.platform==='linux'){const raw=fs.readFileSync('/etc/os-release','utf8');if(Buffer.byteLength(raw)>8192)throw Error();const fields={};for(const line of raw.split('\\n')){const m=/^(ID|VERSION_ID)=(?:"([a-zA-Z0-9._-]+)"|([a-zA-Z0-9._-]+))$/.exec(line);if(m){if(Object.hasOwn(fields,m[1]))throw Error();fields[m[1]]=m[2]||m[3]}}distribution=fields.ID||'';osVersion=fields.VERSION_ID||''}console.log(JSON.stringify({platform:process.platform,arch:process.arch,osVersion,distribution,uid:process.getuid?.(),gid:process.getgid?.(),dockerHost:process.env.DOCKER_HOST||'',dockerContext:process.env.DOCKER_CONTEXT||''}));`;
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
      [value.distribution,value.dockerHost,value.dockerContext].some(x=>x!==undefined && typeof x!=='string') || [value.uid,value.gid].some(x=>x!==undefined&&(!Number.isSafeInteger(x)||x<0))) throw new Error('Invalid host facts');
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

export async function prerequisiteChecks(executor:Executor,remote:boolean,bundle?:{architecture:'amd64'|'arm64';privateControl?:PrivateControlCapability}):Promise<CheckResult[]> {
  const captured=bundle&&structuredClone(bundle);
  const research=captured?.privateControl!==undefined;
  if(research)validatePrivateControlCapability(captured!.privateControl);
  const windowsVolume=research&&isPrivateVolumeCapability(captured!.privateControl);
  const requestedArch=captured?.architecture;
  const bundleMode=bundle!==undefined;
  const checks:CheckResult[]=[];
  let facts:ProbeFacts|undefined;
  let reached=false;
  try {
    const response=await executor.run(remote?request('python3',['-c',remoteHostScript]):request(process.execPath,['-e',research?privateHostScript:hostScript]));
    reached=true;
    if (response.code===0) facts=parseFacts(response.stdout);
  } catch { /* Probe output and errors may contain credentials; report only fixed messages. */ }
  if (remote) {
    checks.push({id:'ssh',state:reached?'pass':'fail',message:reached?'SSH-доступ к выбранному VPS и Python3 helper доступны.':'SSH недоступен: проверь OpenSSH, ранее доверенный ключ сервера, SSH-ключ и Python3 на VPS. Пароли и изменение known_hosts не используются.'});
    if (!reached) return [...checks,{id:'platform',state:'unverified',message:'ОС VPS не проверена без SSH-доступа.'},{id:'docker-context',state:'unverified',message:'Docker context VPS не проверен.'},{id:'docker',state:'unverified',message:'Docker Engine VPS не проверен.'},{id:'compose',state:'unverified',message:'Docker Compose VPS не проверен.'},...unverified()];
  }
  const platformReady=!!facts && (windowsVolume?!remote&&facts.platform==='win32'&&supported(facts,false)&&requestedArch==='amd64':research?!remote&&facts.platform==='linux'&&facts.arch==='x64'&&facts.uid===1000&&facts.gid===1000&&requestedArch==='amd64':supported(facts,remote)) && (!bundleMode || arch(facts.arch)===requestedArch);
  checks.push({id:'platform',state:platformReady?'pass':'fail',message:windowsVolume?(platformReady?'Private .3 Windows source capability; guest storage and artifact acceptance remain unverified.':'Private .3 volume source requires Windows 11 amd64 and a verified SID/engine target.'):research?(platformReady?'Private .2 research: Linux amd64 UID/GID1000; '+facts!.distribution+' '+facts!.osVersion+'. Native desktop and Ubuntu VPS acceptance remain unverified.':'Private .2 research requires local Linux amd64 UID/GID1000; native adapters are unverified.'):platformReady?(remote?'Ubuntu и архитектура VPS подходят.':'ОС и архитектура подходят для desktop-сценария.'):(remote?'Необходим Ubuntu Server 22.04/24.04 LTS amd64/arm64; ОС и архитектура должны быть проверены.':'Поддерживаются Windows 11 x64 и macOS 14+ arm64/x64; ОС и архитектура должны быть проверены.')});
  if (bundleMode && !platformReady) checks[checks.length-1]!.message+=' Проверь соответствие машины запрошенной архитектуре bundle.';

  if(!remote&&process.platform==='win32'){
    try{const observed=observeNativeWindowsPreflight(),version=/^v?2\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(observed.composeVersion),engine=platformReady&&observed.serverOS==='linux'&&!!facts&&arch(observed.serverArch)===arch(facts.arch)&&/^\d+\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(observed.serverVersion),compose=!!version&&(!bundleMode||Number(version[1])>23||Number(version[1])===23&&Number(version[2])>=1);
      checks.push({id:'docker-context',state:'pass',message:'Protected native desktop-linux context and actual engine association observed.'},{id:'docker',state:engine?'pass':'fail',message:engine?'Protected native Linux Engine version/architecture observed.':'Native Engine OS, architecture or version does not match this target.'},{id:'compose',state:compose?'pass':'fail',message:compose?'Version of the held installed Compose plugin observed.':(bundleMode?'A held installed stable Compose v2 >=2.23.1 is required.':'A held installed stable Compose v2 is required.')});
    }catch{for(const id of ['docker-context','docker','compose'])checks.push({id,state:'fail',message:'Native Windows runtime prerequisites unavailable or unknown; retain protected provider evidence. No PATH discovery or install readiness is inferred.'});}
    checks.push({id:'ssh',state:'unverified',message:'OpenSSH availability is not part of the native local runtime observation.'});return [...checks,...unverified()];
  }
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
      const version=response.stdout.trim();
      const stable=/^v?2\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.exec(version);
      const ready=response.code===0 && (bundleMode ? !!stable && (Number(stable[1])>23 || Number(stable[1])===23 && Number(stable[2])>=1) : /^v?2\.\d+\.\d+(?:[-+][a-zA-Z0-9.-]+)?$/.test(version));
      checks.push({id:'compose',state:ready?'pass':'fail',message:ready?'Docker Compose v2 доступен.':bundleMode?'Для bundle необходим стабильный Docker Compose v2 >=2.23.1.':'Необходим Docker Compose v2.'});
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
