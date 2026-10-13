import type {PrivateControlCapability} from './private-control-capability.js';
import {validateBundleNetwork} from './network.js';
import {internetTurnTlsDiagnosis,type InternetConfiguration} from './internet-network.js';
import {prerequisiteChecks} from './probe.js';
import {CliError, type CheckResult, type Executor, type NetworkMode} from './types.js';

// Fixed programs: only JSON data travels on stdin. Each socket is exclusive and
// closed before moving to the next port. Neither helper reserves ports.
const nodeHelper=String.raw`const net=require('node:net'),dgram=require('node:dgram');
const timer=setTimeout(()=>process.exit(1),5000);let raw='';
process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{raw+=s;if(raw.length>8192)process.exit(1)});
function ports(v){return Array.isArray(v)&&v.length<=103&&v.every(p=>Number.isInteger(p)&&p>=0&&p<=65535)&&new Set(v).size===v.length}
function tcp(address,port){return new Promise(resolve=>{const s=net.createServer(socket=>socket.destroy());let done=false;const finish=ok=>{if(done)return;done=true;if(s.listening)s.close(()=>resolve(ok));else resolve(ok)};s.once('error',()=>finish(false));s.listen({host:address,port,exclusive:true},()=>finish(true))})}
function udp(address,port){return new Promise(resolve=>{const s=dgram.createSocket({type:'udp4',reuseAddr:false});let done=false;const finish=ok=>{if(done)return;done=true;try{s.close(()=>resolve(ok))}catch{resolve(false)}};s.once('error',()=>finish(false));try{s.bind({address,port,exclusive:true},()=>finish(true))}catch{finish(false)}})}
process.stdin.on('end',async()=>{try{const r=JSON.parse(raw);if(!r||r.schemaVersion!==1||Object.keys(r).sort().join(',')!=='bindIPv4,schemaVersion,tcp,udp'||typeof r.bindIPv4!=='string'||net.isIP(r.bindIPv4)!==4||!ports(r.tcp)||!ports(r.udp))throw Error();
const address=await tcp(r.bindIPv4,0),result={schemaVersion:1,address,tcp:[],udp:[]};
for(const port of r.tcp)result.tcp.push({port,available:address&&await tcp(r.bindIPv4,port)});
for(const port of r.udp)result.udp.push({port,available:address&&await udp(r.bindIPv4,port)});
clearTimeout(timer);console.log(JSON.stringify(result));}catch{process.exit(1)}});`;
const pythonHelper=String.raw`import json,sys,socket,signal,ipaddress
signal.signal(signal.SIGALRM,lambda *_:sys.exit(1))
signal.alarm(5)
def ports(v):
 return isinstance(v,list) and len(v)<=103 and all(type(p) is int and 0<=p<=65535 for p in v) and len(set(v))==len(v)
def bind(address,port,kind):
 s=socket.socket(socket.AF_INET,kind)
 try:
  s.settimeout(1)
  s.bind((address,port))
  if kind==socket.SOCK_STREAM: s.listen(1)
  return True
 except OSError:
  return False
 finally:
  s.close()
try:
 raw=sys.stdin.read(8193)
 if len(raw)>8192: raise ValueError()
 r=json.loads(raw)
 if not isinstance(r,dict) or set(r)!={'schemaVersion','bindIPv4','tcp','udp'} or type(r['schemaVersion']) is not int or r['schemaVersion']!=1 or not isinstance(r['bindIPv4'],str) or not ports(r['tcp']) or not ports(r['udp']): raise ValueError()
 ipaddress.IPv4Address(r['bindIPv4'])
 address=bind(r['bindIPv4'],0,socket.SOCK_STREAM)
 result={'schemaVersion':1,'address':address,'tcp':[],'udp':[]}
 for protocol,kind in [('tcp',socket.SOCK_STREAM),('udp',socket.SOCK_DGRAM)]:
  for port in r[protocol]: result[protocol].append({'port':port,'available':address and bind(r['bindIPv4'],port,kind)})
 signal.alarm(0)
 print(json.dumps(result))
except Exception:
 sys.exit(1)
`;
const tcpPorts=[443,7881];
const udpPorts=Array.from({length:101},(_,i)=>61000+i);
type Availability={port:number;available:boolean};
type ProbeResult={schemaVersion:1;address:boolean;tcp:Availability[];udp:Availability[]};
// JSON.parse validates syntax first, but discards duplicate members. Walk its
// string/structural tokens before trusting the result, decoding keys so escaped
// equivalents cannot overwrite a failed availability result either.
function rejectDuplicateMembers(raw:string):void {
 const stack:({keys:Set<string>;expectKey:boolean}|null)[]=[];
 for(const match of raw.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],]/g)){
  const token=match[0];
  if(token==='{')stack.push({keys:new Set(),expectKey:true});
  else if(token==='[')stack.push(null);
  else if(token==='}' || token===']')stack.pop();
  else {
   const object=stack[stack.length-1];
   if(!object)continue;
   if(token===',')object.expectKey=true;
   else if(object.expectKey){
    const key=JSON.parse(token) as string;
    if(object.keys.has(key))throw new Error('Duplicate probe member');
    object.keys.add(key);object.expectKey=false;
   }
  }
 }
}
function parseResult(raw:string,tcp=tcpPorts,udp=udpPorts):ProbeResult {
 const value=JSON.parse(raw) as ProbeResult;
 rejectDuplicateMembers(raw);
 if(!value || Array.isArray(value) || Object.keys(value).sort().join(',')!=='address,schemaVersion,tcp,udp' || value.schemaVersion!==1 || typeof value.address!=='boolean')throw new Error('Invalid probe');
 for(const [entries,expected] of [[value.tcp,tcp],[value.udp,udp]] as const){
  if(!Array.isArray(entries) || entries.length!==expected.length || entries.some((entry,i)=>!entry || Array.isArray(entry) || Object.keys(entry).sort().join(',')!=='available,port' || entry.port!==expected[i] || typeof entry.available!=='boolean'))throw new Error('Incomplete probe');
 }
 return value;
}
export async function bundlePrerequisiteChecks(input:{network:NetworkMode;bindIPv4:string;architecture:'amd64'|'arm64';internet?:InternetConfiguration;privateControl?:PrivateControlCapability},executor:Executor,remote:boolean,occupiedOwnedPorts:readonly ('https'|'ice')[]=[]):Promise<CheckResult[]> {
 // Capture and validate every caller-owned field before the first await.
 const {network,bindIPv4,architecture,internet,privateControl}=structuredClone(input);
 validateBundleNetwork(network,bindIPv4,internet);
 if(architecture!=='amd64' && architecture!=='arm64')throw new CliError('Bundle requires amd64 or arm64 architecture.');
 const occupied=[...occupiedOwnedPorts];if(new Set(occupied).size!==occupied.length||occupied.some(p=>p!=='https'&&p!=='ice'))throw new CliError('Invalid owned port scope.');
 if(network==='internet'&&!remote&&process.platform==='win32')return[{id:'internet-windows',state:'fail',message:'Windows LOCAL Internet requires a protected public-network provider; use the remote Linux target.'}];
 if(network==='internet'&&internet?.turnDomain)return[{id:'turn-tls-bootstrap',state:'fail',message:internetTurnTlsDiagnosis},{id:'internet-dns',state:'unverified',message:'Internet DNS and public-chain TLS were not probed; no readiness is inferred.'}];
 // Only guarded services may supply groups already verified against the actual
 // owned running container bindings. Remaining groups still undergo real bind.
 const tcp=(network==='internet'?[80,...tcpPorts]:tcpPorts).filter(p=>p===443||p===80?!occupied.includes('https'):!occupied.includes('ice')),udp=occupied.includes('ice')?[]:udpPorts;
 const checks=await prerequisiteChecks(executor,remote,{architecture,...(privateControl===undefined?{}:{privateControl})});
 const prerequisitesReady=['platform','docker-context','docker','compose'].every(id=>checks.some(check=>check.id===id && check.state==='pass'));
 let result:ProbeResult|undefined;
 if(prerequisitesReady){
  try{
   const response=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',pythonHelper]:['-e',nodeHelper],input:Buffer.from(JSON.stringify({schemaVersion:1,bindIPv4,tcp,udp})),sensitive:false});
   if(response.code===0)result=parseResult(response.stdout,tcp,udp);
  }catch{ /* Never echo helper output, process errors or remote credentials. */ }
 }
 checks.push({id:'bind-address',state:!prerequisitesReady?'unverified':result?.address?'pass':'fail',message:!prerequisitesReady?'Адрес bind не проверен: сначала исправь ОС, архитектуру, Docker endpoint и Compose.':result?.address?'Выбранный IPv4 доступен для bind на этой машине.':'Не удалось подтвердить выбранный IPv4: проверь наличие адреса на выбранной машине и права пользователя.'});
 const portsReady=!!result?.address && [...result.tcp,...result.udp].every(entry=>entry.available);
 checks.push({id:'ports',state:!prerequisitesReady?'unverified':portsReady?'pass':'fail',message:!prerequisitesReady?'Порты не проверены без подтверждённых предпосылок runtime.':portsReady?(occupied.length?'Bindings работающих owned служб проверены отдельно; остальные TCP/UDP порты доступны в момент bind-проверки. Порты не зарезервированы, медиаготовность не подтверждена.':'TCP 443/7881 и UDP 61000–61100 доступны в момент проверки; порты не зарезервированы, медиаготовность не подтверждена.'):'Не удалось подтвердить все TCP 443/7881 и UDP 61000–61100: проверь bind-адрес, занятые порты и права пользователя.'});
 checks.push({id:'desktop-networking',state:'unverified',message:remote?'Маршрутизация, firewall и доступ клиентов к выбранному VPS не проверены.':'Перенаправление портов Docker Desktop, firewall и доступ клиентов не проверены.'},{id:'images',state:'unverified',message:'Наличие и совместимость образов bundle не проверены.'},{id:'config',state:'unverified',message:'Конфигурация bundle и запуск служб не проверены.'});
 if(network==='internet'){const ports=checks.find(c=>c.id==='ports')!;ports.message=ports.message.replaceAll('TCP 443/7881','TCP 80/443/7881');checks.push({id:'internet-dns',state:'unverified',message:'Declared domain/public IPv4 DNS, public ACME issuance and external firewall reachability are not established by the bind probe.'});}
 return checks;
}
