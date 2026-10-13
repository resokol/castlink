import {parseStrictJson} from './strict-json.js';
import {CliError,type Executor} from './types.js';
// Bytes remain inside the selected-target helper. No archive extraction, image
// program, arbitrary path or raw Docker output crosses this API.
const node=String.raw`const {spawn}=require('node:child_process'),{createHash}=require('node:crypto');
let input='';process.stdin.setEncoding('utf8');process.stdin.on('data',s=>{input+=s;if(input.length>1024)process.exit(4)});
function fail(){throw Error()}
function field(b,a,n){return b.subarray(a,a+n).toString('ascii').replace(/\0.*$/s,'')}
function octal(b,a,n){const s=field(b,a,n).trim();if(!/^[0-7]+$/.test(s))fail();return parseInt(s,8)}
function digest(b){let offset=0,file,pax=false,ended=false;while(offset+512<=b.length){const h=b.subarray(offset,offset+512);offset+=512;if(h.every(x=>x===0)){if(b.length-offset<512||!b.subarray(offset).every(x=>x===0))fail();ended=true;break}
let sum=0;for(let i=0;i<512;i++)sum+=(i>=148&&i<156)?32:h[i];if(h.some(x=>x>127)||octal(h,148,8)!==sum)fail();if(field(h,257,6)!=='ustar'||field(h,345,155)!=='')fail();const size=octal(h,124,12),type=field(h,156,1),name=field(h,0,100);if(size>65536||offset+Math.ceil(size/512)*512>b.length)fail();const body=b.subarray(offset,offset+size);if(!b.subarray(offset+size,offset+Math.ceil(size/512)*512).every(x=>x===0))fail();offset+=Math.ceil(size/512)*512;
if(type==='x'){if(pax||file)fail();pax=true;let pos=0;while(pos<body.length){const space=body.indexOf(32,pos);if(space<0)fail();const n=Number(body.subarray(pos,space).toString());if(!Number.isInteger(n)||n<5||pos+n>body.length||body[pos+n-1]!==10)fail();const record=body.subarray(space+1,pos+n-1).toString('utf8'),eq=record.indexOf('='),key=record.slice(0,eq),value=record.slice(eq+1);if(eq<1||!['path','mtime','atime','ctime'].includes(key))fail();if(key==='path'?value!=='Caddyfile':!/^\d+(\.\d+)?$/.test(value))fail();pos+=n}continue}
if(type!=='0'&&type!=='')fail();if(name!=='Caddyfile'||file||size===0||octal(h,100,8)!==292)fail();file=body;
}if(!ended||!file||offset>b.length)fail();return createHash('sha256').update(file).digest('hex')}
process.stdin.on('end',()=>{try{const r=JSON.parse(input);if(Object.keys(r).sort().join(',')!=='containerId,schemaVersion'||r.schemaVersion!==1||typeof r.containerId!=='string'||!/^[a-f0-9]{64}$/.test(r.containerId))fail();const child=spawn('docker',['cp',r.containerId+':/etc/caddy/Caddyfile','-'],{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe']});let chunks=[],size=0,bad=false;const timer=setTimeout(()=>{bad=true;child.kill()},15000);child.stdout.on('data',b=>{size+=b.length;if(size>262144){bad=true;child.kill()}else chunks.push(b)});child.stderr.on('data',()=>{bad=true;child.kill()});child.on('error',()=>{clearTimeout(timer);process.exit(4)});child.on('close',code=>{clearTimeout(timer);try{if(code!==0||bad)fail();console.log(JSON.stringify({schemaVersion:1,sha256:digest(Buffer.concat(chunks))}))}catch{process.exit(4)}})}catch{process.exit(4)}});`;
const python=String.raw`import sys,json,subprocess,tarfile,io,hashlib,signal,re
signal.signal(signal.SIGALRM,lambda *_:sys.exit(4));signal.alarm(20)
try:
 raw=sys.stdin.buffer.read(1025)
 if len(raw)>1024: raise ValueError()
 r=json.loads(raw)
 if not isinstance(r,dict) or set(r)!={'schemaVersion','containerId'} or type(r['schemaVersion']) is not int or r['schemaVersion']!=1 or not isinstance(r['containerId'],str) or re.fullmatch('[a-f0-9]{64}',r['containerId']) is None: raise ValueError()
 child=subprocess.Popen(['docker','cp',r['containerId']+':/etc/caddy/Caddyfile','-'],stdin=subprocess.DEVNULL,stdout=subprocess.PIPE,stderr=subprocess.DEVNULL)
 try:
  data=child.stdout.read(262145)
  if len(data)>262144: raise ValueError()
  if child.wait(timeout=15)!=0 or len(data)<1536 or len(data)%512 or any(data[-1024:]): raise ValueError()
 finally:
  if child.poll() is None: child.kill()
  child.wait()
 with tarfile.open(fileobj=io.BytesIO(data),mode='r:') as archive:
  entries=archive.getmembers()
  if len(entries)!=1: raise ValueError()
  entry=entries[0]
  if not entry.isfile() or entry.name!='Caddyfile' or not 0<entry.size<=65536 or entry.mode!=0o444 or entry.linkname: raise ValueError()
  for k,v in entry.pax_headers.items():
   if k not in ('path','mtime','atime','ctime') or (v!='Caddyfile' if k=='path' else re.fullmatch('[0-9]+([.][0-9]+)?',v) is None): raise ValueError()
  value=archive.extractfile(entry).read(65537)
  if len(value)!=entry.size: raise ValueError()
  end=entry.offset_data+((entry.size+511)//512)*512
  if len(data)-end<1024 or any(data[end:]) or any(data[entry.offset_data+entry.size:end]): raise ValueError()
 signal.alarm(0)
 print(json.dumps({'schemaVersion':1,'sha256':hashlib.sha256(value).hexdigest()}))
except BaseException:
 sys.exit(4)
`;
export async function observeCaddyConfig(containerId:string,executor:Executor,remote:boolean):Promise<string>{
 try{
  if(!/^[a-f0-9]{64}$/.test(containerId))throw Error();
  const result=await executor.run({executable:remote?'python3':process.execPath,args:remote?['-c',python]:['-e',node],input:Buffer.from(JSON.stringify({schemaVersion:1,containerId})),sensitive:true});
  const data=parseStrictJson(result.stdout,1024) as {schemaVersion:number;sha256:string};
  if(result.code!==0||result.stderr!==''||!data||Object.keys(data).sort().join(',')!=='schemaVersion,sha256'||data.schemaVersion!==1||typeof data.sha256!=='string'||!/^[a-f0-9]{64}$/.test(data.sha256))throw Error();
  return data.sha256;
 }catch{throw new CliError('Actual Caddy configuration is missing, changed or cannot be safely observed; diagnosis required.',4);}
}
