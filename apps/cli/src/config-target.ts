import path from 'node:path';
import {createHash} from 'node:crypto';
import {bundleContents,renderBundle,type BundleInput,type BundleCredentials,type MaterializedBundle} from './bundle.js';
import {CliError,type Executor} from './types.js';
import {parseStrictJson} from './strict-json.js';
import {nodeTargetLease} from './target-operation.js';

export type ConfigTargetAssociation={engine:string;endpoint:string;epoch:number;principal:number;scope:string};
export type TargetMaterializedBundle=MaterializedBundle&{fingerprints:Record<string,string>;operationEpoch:number};
const keys=['postgresPassword','livekitKey','livekitSecret','sessionSecret','dataEncryptionKey','setupToken','nodeSecret'] as const;
const marker='__CASTLINK_CREDENTIAL_';
export function validateConfigTargetAssociation(a:ConfigTargetAssociation):void{
 if(!a||Object.keys(a).sort().join(',')!=='endpoint,engine,epoch,principal,scope'||typeof a.engine!=='string'||!/^[A-Za-z0-9:._-]{1,128}$/.test(a.engine)||typeof a.endpoint!=='string'||!/^unix:\/\/\/[^/]/.test(a.endpoint)||/[\x00-\x1f\x7f]/.test(a.endpoint)||!Number.isSafeInteger(a.principal)||a.principal<0||typeof a.scope!=='string'||!path.posix.isAbsolute(a.scope)||path.posix.normalize(a.scope)!==a.scope||!a.scope.endsWith('/.castlink-target-operations')||!Number.isSafeInteger(a.epoch)||a.epoch<0)throw new CliError('Invalid target configuration association.',2);
}
// Fixed bundled-Node handler; caller input is data only, never executable code.
export const configTargetNode=nodeTargetLease+String.raw`
const fs=leaseFs,path=leasePath,crypto=leaseCrypto;
const NAMES=['compose.yaml','livekit.yaml','postgres.env','web.env'],KEYS=['postgresPassword','livekitKey','livekitSecret','sessionSecret','dataEncryptionKey','setupToken','nodeSecret'];
function fail(){throw Error('config-unverified')}
function parse(raw){if(raw.includes('\uFFFD'))fail();const value=JSON.parse(raw),stack=[];for(const match of raw.matchAll(/"(?:[^"\\]|\\.)*"|[{}\[\],]/g)){const token=match[0];if(token==='{')stack.push({keys:new Set(),key:true});else if(token==='[')stack.push(null);else if(token==='}'||token===']')stack.pop();else{const current=stack.at(-1);if(!current)continue;if(token===',')current.key=true;else if(current.key){const key=JSON.parse(token);if(current.keys.has(key))fail();current.keys.add(key);current.key=false}}}return value}
function equal(a,b){const normalize=v=>Array.isArray(v)?v.map(normalize):v&&typeof v==='object'?Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])])):v;return JSON.stringify(normalize(a))===JSON.stringify(normalize(b))}
function chain(root,optional){let current=root,first=true;for(;;){let s;try{s=fs.lstatSync(current)}catch(e){if(first&&optional&&e.code==='ENOENT'){current=path.dirname(current);first=false;continue}throw e}if(s.isSymbolicLink()||!s.isDirectory()||fs.realpathSync(current)!==current||s.uid!==process.getuid()&&s.uid!==fs.statSync('/').uid||(s.mode&18)&&!(s.uid===fs.statSync('/').uid&&(s.mode&512)))fail();if(first&&(s.uid!==process.getuid()||(s.mode&511)!==448))fail();const p=path.dirname(current);if(p===current)break;current=p;first=false} }
function read(file){const before=leasePrivate(file,false),fd=fs.openSync(file,fs.constants.O_RDONLY|fs.constants.O_NOFOLLOW|fs.constants.O_NONBLOCK);try{const held=fs.fstatSync(fd);if(held.dev!==before.dev||held.ino!==before.ino||held.size>131072)fail();const b=Buffer.alloc(131073);let size=0;while(size<b.length){const n=fs.readSync(fd,b,size,b.length-size,size);if(!n)break;size+=n}const after=fs.fstatSync(fd),named=fs.lstatSync(file);if(size!==held.size||size>131072||held.size!==after.size||held.mtimeMs!==after.mtimeMs||held.ctimeMs!==after.ctimeMs||named.dev!==held.dev||named.ino!==held.ino)fail();return b.subarray(0,size)}finally{fs.closeSync(fd)}}
function write(file,raw){const fd=fs.openSync(file,fs.constants.O_WRONLY|fs.constants.O_CREAT|fs.constants.O_EXCL|fs.constants.O_NOFOLLOW,384);try{fs.writeFileSync(fd,raw);fs.fsyncSync(fd)}finally{fs.closeSync(fd)}}
function expand(templates,values){return Object.fromEntries(NAMES.map(n=>{let text=templates[n];if(n!=='compose.yaml')for(const k of KEYS)text=text.replaceAll('__CASTLINK_CREDENTIAL_'+k+'__',values[k]);return[n,Buffer.from(text)]}))}
function credentials(raw){const env=b=>{const s=b.toString();if(!s.endsWith('\n'))fail();const out={};for(const line of s.slice(0,-1).split('\n')){const at=line.indexOf('=');if(at<1||Object.hasOwn(out,line.slice(0,at)))fail();out[line.slice(0,at)]=line.slice(at+1)}return out},pg=env(raw['postgres.env']),web=env(raw['web.env']);const values=Object.fromEntries(KEYS.map((k,i)=>[k,[pg.POSTGRES_PASSWORD,web.LIVEKIT_API_KEY,web.LIVEKIT_API_SECRET,web.CASTLINK_SESSION_SECRET,web.CASTLINK_DATA_ENCRYPTION_KEY,web.CASTLINK_SETUP_TOKEN,web.CASTLINK_NODE_SECRET][i]]));for(const k of KEYS)if(typeof values[k]!=='string'||!(k==='livekitKey'?/^lk_[a-f0-9]{32}$/:/^[a-f0-9]{64}$/).test(values[k]))fail();return values}
try{
 const inputBytes=Buffer.alloc(131073);let inputSize=0;while(inputSize<inputBytes.length){const n=fs.readSync(0,inputBytes,inputSize,inputBytes.length-inputSize,null);if(!n)break;inputSize+=n}if(inputSize>131072)fail();const r=parse(inputBytes.subarray(0,inputSize).toString());if(Object.keys(r).sort().join(',')!=='association,bundle,directory,schemaVersion,templates,verifyOnly'||r.schemaVersion!==1||typeof r.verifyOnly!=='boolean'||typeof r.directory!=='string'||!path.isAbsolute(r.directory)||path.resolve(r.directory)!==r.directory||r.directory==='/'||/[\x00-\x1f\x7f]/.test(r.directory)||r.directory.includes('__CASTLINK_CREDENTIAL_'))fail();
 if(!r.bundle||Object.keys(r.bundle).sort().join(',')!=='architecture,bindIPv4,installationId,network,release'||!r.templates||Object.keys(r.templates).sort().join(',')!==NAMES.join(',')||Object.values(r.templates).some(v=>typeof v!=='string'||v.length>65536)||r.templates['compose.yaml'].includes('__CASTLINK_CREDENTIAL_'))fail();
 const a=r.association;if(!a||Object.keys(a).sort().join(',')!=='endpoint,engine,epoch,principal,scope'||typeof a.endpoint!=='string')fail();
 const l=acquireTargetOperation({schemaVersion:1,root:r.directory,installationId:r.bundle.installationId,engine:a.engine,epoch:a.epoch,principal:a.principal,scope:a.scope,kind:'config'});
 if(l.owner.endpoint!==a.endpoint)fail();chain(r.directory,true);
 const fresh=!fs.existsSync(r.directory);if(fresh&&r.verifyOnly)fail();
 if(!fresh&&!equal(fs.readdirSync(r.directory).sort(),[...NAMES,'receipt.json'].sort()))fail();
 dispatchTargetOperation(l);
 if(fresh){fs.mkdirSync(r.directory,{mode:448});leaseSync(path.dirname(r.directory));const values=Object.fromEntries(KEYS.map(k=>[k,k==='livekitKey'?'lk_'+crypto.randomBytes(16).toString('hex'):crypto.randomBytes(32).toString('hex')])),contents=expand(r.templates,values);for(const n of NAMES)write(path.join(r.directory,n),contents[n]);const hashes=Object.fromEntries(NAMES.map(n=>[n,crypto.createHash('sha256').update(contents[n]).digest('hex')]));write(path.join(r.directory,'receipt.json'),JSON.stringify({schemaVersion:1,...r.bundle,hashes},null,2)+'\n');leaseSync(r.directory)}
 chain(r.directory,false);const identity=fs.lstatSync(r.directory),contents=Object.fromEntries(NAMES.map(n=>[n,read(path.join(r.directory,n))])),expected=expand(r.templates,credentials(contents));if(!equal(fs.readdirSync(r.directory).sort(),[...NAMES,'receipt.json'].sort())||NAMES.some(n=>!contents[n].equals(expected[n])))fail();const hashes=Object.fromEntries(NAMES.map(n=>[n,crypto.createHash('sha256').update(contents[n]).digest('hex')]));if(!equal(parse(read(path.join(r.directory,'receipt.json')).toString()),{schemaVersion:1,...r.bundle,hashes}))fail();
 // Retry completes durability without rewriting any owned file.
 for(const n of [...NAMES,'receipt.json'])leaseSync(path.join(r.directory,n));leaseSync(r.directory);leaseSync(path.dirname(r.directory));chain(r.directory,false);const final=fs.lstatSync(r.directory);if(identity.dev!==final.dev||identity.ino!==final.ino||!equal(leaseEngine(),{engine:a.engine,endpoint:a.endpoint}))fail();
 releaseTargetOperation(l,true);process.stdout.write(JSON.stringify({schemaVersion:1,hashes,operationEpoch:a.epoch+1}));
}catch{process.stdout.write('{"schemaVersion":1,"error":"diagnosis-required"}');process.exitCode=4}
`;

export async function materializeTargetBundle(input:Omit<BundleInput,'secretFiles'>,directory:string,executor:Executor,association:ConfigTargetAssociation,verifyOnly=false):Promise<TargetMaterializedBundle>{
 if(process.platform==='win32')throw new CliError('Native private target lease is unavailable on Windows; use a supported POSIX target and diagnose existing private artifacts before retry.',4);
 let candidate:Omit<BundleInput,'secretFiles'>,a:ConfigTargetAssociation;
 try{
  candidate=structuredClone(input);a=structuredClone(association);validateConfigTargetAssociation(a);
  if(typeof directory!=='string'||!path.isAbsolute(directory)||path.resolve(directory)!==directory||directory==='/'||/[\x00-\x1f\x7f]/.test(directory)||directory.includes(marker)||JSON.stringify(candidate).includes(marker)||Object.keys(candidate).sort().join(',')!=='architecture,bindIPv4,installationId,network,release'||typeof verifyOnly!=='boolean')throw Error();
  candidate.installationId=candidate.installationId.toLowerCase();renderBundle({...candidate,secretFiles:{webEnv:path.join(directory,'web.env'),postgresEnv:path.join(directory,'postgres.env'),livekitConfig:path.join(directory,'livekit.yaml')}});
 }catch{throw new CliError('Invalid target configuration input or association.',2)}
 const secretFiles={webEnv:path.join(directory,'web.env'),postgresEnv:path.join(directory,'postgres.env'),livekitConfig:path.join(directory,'livekit.yaml')},bundleInput={...candidate,secretFiles},rendered=renderBundle(bundleInput);
 const templates=bundleContents(bundleInput,Object.fromEntries(keys.map(k=>[k,marker+k+'__'])) as BundleCredentials),payload=Buffer.from(JSON.stringify({schemaVersion:1,directory,bundle:candidate,templates,association:a,verifyOnly}));
 if(payload.length>131072)throw new CliError('Target configuration payload exceeds limit.',2);
 try{
  const result=await executor.run({executable:process.execPath,args:['-e',configTargetNode],input:payload,sensitive:true});
  const data=parseStrictJson(result.stdout,2048) as Record<string,unknown>;
  if(result.code!==0||result.stderr!==''||!data||Object.keys(data).sort().join(',')!=='hashes,operationEpoch,schemaVersion'||data.schemaVersion!==1||data.operationEpoch!==a.epoch+1||!data.hashes||typeof data.hashes!=='object'||Array.isArray(data.hashes)||Object.keys(data.hashes).sort().join(',')!==Object.keys(templates).sort().join(',')||Object.values(data.hashes).some(v=>typeof v!=='string'||!/^[a-f0-9]{64}$/.test(v))||(data.hashes as Record<string,string>)['compose.yaml']!==createHash('sha256').update(rendered.composeText).digest('hex'))throw Error();
  return{composePath:path.join(directory,'compose.yaml'),secretFiles,projectName:rendered.projectName,nodeId:rendered.nodeId,requirements:rendered.requirements,checks:rendered.checks,fingerprints:data.hashes as Record<string,string>,operationEpoch:a.epoch+1};
 }catch{throw new CliError('Target configuration operation is unverified; diagnose the retained target lease and private artifacts before retry.',4)}
}
