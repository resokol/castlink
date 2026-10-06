// Self-contained: the same fixed normalizer runs in the client and Node helper.
// Only explicit IPv4 host mappings are owned. Ranges expand to actual Docker
// PortBindings, never a synthetic range key; overlaps cannot overwrite entries.
export function servicePortBindings(ports:unknown):Record<string,{HostIp:string;HostPort:string}[]> {
 const fail=():never=>{throw Error('Invalid owned Compose port mapping');};
 const out:Record<string,{HostIp:string;HostPort:string}[]>={};
 const range=(v:unknown):[number,number]=>{if(typeof v!=='string'||!/^([1-9]\d{0,4})(?:-([1-9]\d{0,4}))?$/.test(v))fail();const parts=(v as string).split('-').map(Number),first=parts[0]!,last=parts[1]??first;if(first>65535||last>65535||last<first||last-first>=1000)fail();return[first,last];};
 if(!Array.isArray(ports)||ports.length>1104)fail();
 for(const value of ports as unknown[]){
  let host:unknown,published:unknown,target:unknown,protocol:unknown;
  if(typeof value==='string'){const m=/^([^:]+):([^:]+):([^/]+)\/(tcp|udp)$/.exec(value);if(!m)fail();[,host,published,target,protocol]=m!;}
  else {if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='host_ip,protocol,published,target')fail();const p=value as Record<string,unknown>;host=p.host_ip;published=p.published;target=p.target;protocol=p.protocol;if(!Number.isInteger(target)||Number(target)<1||Number(target)>65535)fail();target=String(target);}
  if(typeof host!=='string'||!/^(?:0|[1-9]\d{0,2})(?:\.(?:0|[1-9]\d{0,2})){3}$/.test(host)||host.split('.').some(n=>Number(n)>255)||protocol!=='tcp'&&protocol!=='udp')fail();
  const [from,to]=range(published),[first,last]=range(target);if(to-from!==last-first)fail();
  for(let i=0;i<=last-first;i++){const key=(first+i)+'/'+protocol;if(Object.hasOwn(out,key)||Object.keys(out).length>=1104)fail();out[key]=[{HostIp:host as string,HostPort:String(from+i)}];}
 }
 return out;
}
export const pythonServicePortBindings=String.raw`
def service_port_bindings(ports):
 def invalid(): raise ValueError('Invalid owned Compose port mapping')
 def span(v):
  if not isinstance(v,str) or lease_re.fullmatch(r'[1-9][0-9]{0,4}(-[1-9][0-9]{0,4})?',v) is None: invalid()
  p=[int(n) for n in v.split('-')];first=p[0];last=p[-1]
  if first>65535 or last>65535 or last<first or last-first>=1000: invalid()
  return first,last
 if not isinstance(ports,list) or len(ports)>1104: invalid()
 out={}
 for p in ports:
  if isinstance(p,str):
   m=lease_re.fullmatch(r'([^:]+):([^:]+):([^/]+)/(tcp|udp)',p)
   if m is None: invalid()
   host,published,target,protocol=m.groups()
  else:
   if not isinstance(p,dict) or set(p)!={'host_ip','published','target','protocol'} or type(p['target']) is not int or not 1<=p['target']<=65535: invalid()
   host,published,target,protocol=p['host_ip'],p['published'],str(p['target']),p['protocol']
  if not isinstance(host,str) or lease_re.fullmatch(r'(0|[1-9][0-9]{0,2})(\.(0|[1-9][0-9]{0,2})){3}',host) is None or any(int(n)>255 for n in host.split('.')) or protocol not in ('tcp','udp'): invalid()
  start,end=span(published);first,last=span(target)
  if end-start!=last-first: invalid()
  for i in range(last-first+1):
   key=str(first+i)+'/'+protocol
   if key in out or len(out)>=1104: invalid()
   out[key]=[{'HostIp':host,'HostPort':str(start+i)}]
 return out
`;
