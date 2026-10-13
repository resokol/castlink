import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {parseStrictJson} from './strict-json.js';
export class WindowsDockerContextError extends Error {constructor(){super('native-provider-unavailable');}}
export type NativeContextSelection={action:'select-context';configSHA256:string|null;metadataSHA256:string;endpoint:'npipe:////./pipe/dockerDesktopLinuxEngine'};
const endpoint='npipe:////./pipe/dockerDesktopLinuxEngine' as const;
function refuse():never{throw new WindowsDockerContextError();}
function object(v:unknown):Record<string,unknown>{if(!v||typeof v!=='object'||Array.isArray(v)||Object.getPrototypeOf(v)!==Object.prototype)refuse();return v as Record<string,unknown>;}
function file(v:unknown):{path:string;bytes:number;sha256:string}{const r=object(v);if(Object.keys(r).sort().join(',')!=='bytes,path,sha256'||typeof r.path!=='string'||r.path.length>1024||!path.isAbsolute(r.path)||/[\x00-\x1f]/.test(r.path)||typeof r.bytes!=='number'||!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>65536||typeof r.sha256!=='string'||! /^[a-f0-9]{64}$/.test(r.sha256))refuse();return r as {path:string;bytes:number;sha256:string};}
/* Native has already held the original file/ancestors with deny WRITE/DELETE.
   These checks bind the JS interpretation to those exact recorded bytes. They
   are not a substitute for that Windows lifetime guard. No source is logged. */
function read(r:{path:string;bytes:number;sha256:string}):unknown{
 const named=fs.lstatSync(r.path);if(!named.isFile()||named.isSymbolicLink()||named.nlink!==1||named.size!==r.bytes)refuse();
 const fd=fs.openSync(r.path,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW??0)|(fs.constants.O_NONBLOCK??0));
 try{const held=fs.fstatSync(fd);if(!held.isFile()||held.nlink!==1||held.size!==r.bytes||held.dev!==named.dev||held.ino!==named.ino)refuse();const bytes=Buffer.alloc(65537);let size=0;while(size<bytes.length){const n=fs.readSync(fd,bytes,size,bytes.length-size,size);if(!n)break;size+=n;}const after=fs.fstatSync(fd),current=fs.lstatSync(r.path);if(size!==r.bytes||held.size!==after.size||held.mtimeMs!==after.mtimeMs||held.ctimeMs!==after.ctimeMs||held.dev!==after.dev||held.ino!==after.ino||current.dev!==held.dev||current.ino!==held.ino||!current.isFile()||current.isSymbolicLink()||current.nlink!==1||current.size!==held.size||createHash('sha256').update(bytes.subarray(0,size)).digest('hex')!==r.sha256)refuse();const text=bytes.subarray(0,size).toString('utf8');if(!Buffer.from(text).equals(bytes.subarray(0,size)))refuse();return parseStrictJson(text,65536);}finally{fs.closeSync(fd);}
}
export function inspectHeldDockerContext(input:unknown):NativeContextSelection{
 try{const r=object(input);if(Object.keys(r).sort().join(',')!=='config,kind,metadata,schemaVersion,status'||r.schemaVersion!==1||r.status!=='context-held'||!['current','explicit'].includes(r.kind as string))refuse();const metadata=file(r.metadata);let configSHA256:string|null=null;if(r.kind==='current'){const config=file(r.config),value=object(read(config));if(value.currentContext!=='desktop-linux')refuse();configSHA256=config.sha256;}else if(r.config!==null)refuse();const value=object(read(metadata));if(!['Endpoints,Metadata,Name','Endpoints,Name'].includes(Object.keys(value).sort().join(','))||value.Name!=='desktop-linux')refuse();const docker=object(object(value.Endpoints).docker);if(Object.keys(docker).sort().join(',')!=='Host,SkipTLSVerify'||docker.Host!==endpoint||docker.SkipTLSVerify!==false)refuse();return{action:'select-context',configSHA256,metadataSHA256:metadata.sha256,endpoint};}catch{refuse();}
}
