import fs from 'node:fs';
import {CliError} from './types.js';
import {parseStrictJson} from './strict-json.js';
import {inspectHeldDockerContext} from './windows-docker-context.js';
export class NativeBrokerError extends CliError {readonly reason:'native-provider-unavailable'|'native-provider-unknown';constructor(reason:'native-provider-unavailable'|'native-provider-unknown'){const fixed=reason==='native-provider-unknown'?reason:'native-provider-unavailable';super(fixed,4);this.reason=fixed;}}
export type NativeBrokerOperation='protect-path-v1'|'target-lease-v1'|'docker-engine-v1'|'setup-root-v1';
export type NativeBrokerSession={readonly openAck:Buffer;writeFrame(bytes:Buffer):Buffer;finish(terminal:Buffer):Buffer;abort():never};
export type NativeBrokerChannel={available():boolean;write(bytes:Buffer):void;read(bytes:number):Buffer};
const MAX=65536;
function unavailable():never{throw new NativeBrokerError('native-provider-unavailable');}
function unknown():never{throw new NativeBrokerError('native-provider-unknown');}
function inputBytes(operation:NativeBrokerOperation,input:unknown):Buffer{
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.getPrototypeOf(input)!==Object.prototype)unavailable();
 const v=input as Record<string,unknown>,keys=Object.keys(v).sort().join(',');
 if(operation==='protect-path-v1'){if(keys!=='directory,path'||typeof v.path!=='string'||v.path.length<3||v.path.length>1024||/[\x00-\x1f]/.test(v.path)||typeof v.directory!=='boolean')unavailable();}
 else if(operation==='target-lease-v1'){
  const fields:Record<string,string>={identity:'action','registry-status':'action',initialize:keys==='action'?'action':'action,profileRoot',inspect:'action,directory,path,principal,scope',mkdir:'action,path,principal,scope',write:'action,bytes,path,principal,scope'};
  if(typeof v.action!=='string'||fields[v.action]!==keys)unavailable();
  for(const [k,x]of Object.entries(v))if(k==='directory'?typeof x!=='boolean':typeof x!=='string'||x.length>(k==='bytes'?87384:4096)||/[\x00-\x1f]/.test(x))unavailable();
  if(v.action==='write'&&(typeof v.bytes!=='string'||! /^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(v.bytes)||Buffer.from(v.bytes,'base64').length>65536||Buffer.from(v.bytes,'base64').toString('base64')!==v.bytes))unavailable();
 }else if(operation==='setup-root-v1'){if(keys!=='action,path,privateDirectory,privateParent'||!['inspect','create'].includes(v.action as string)||typeof v.path!=='string'||v.path.length<3||v.path.length>1024||/[\x00-\x1f]/.test(v.path)||typeof v.privateDirectory!=='boolean'||typeof v.privateParent!=='boolean')unavailable();
 }else if(operation==='docker-engine-v1'){if(keys!=='action'||v.action!=='observe')unavailable();}else unavailable();
 const bytes=Buffer.from(JSON.stringify(v));if(bytes.length>(operation==='target-lease-v1'&&v.action==='write'?131072:16384))unavailable();return bytes;
}
export function createNativeBrokerClient(channel:NativeBrokerChannel):{executeSync(operation:NativeBrokerOperation,input:unknown):{status:'ok';stdout:string};openSession(operation:'backup-output-v1',header:Buffer):NativeBrokerSession}{
 let nextId=0,active=false,uncertain=false;
 function request(opcode:number,payload:Buffer):Buffer{
  if(uncertain)unknown();if(!channel.available())unavailable();if(!Buffer.isBuffer(payload)||payload.length>MAX-8||nextId===0xffffffff)unavailable();
  const id=++nextId,frame=Buffer.alloc(12+payload.length);frame.writeUInt32LE(8+payload.length);frame[4]=1;frame[5]=opcode;frame.writeUInt32LE(id,8);payload.copy(frame,12);
  let sent=false;
  try{sent=true;channel.write(frame);const size=channel.read(4);if(size.length!==4)unknown();const n=size.readUInt32LE();if(n<8||n>MAX)unknown();const answer=channel.read(n);if(answer.length!==n||answer[0]!==1||answer[2]!==0||answer[3]!==0||answer.readUInt32LE(4)!==id)unknown();if(answer[1]===4)unavailable();if(answer[1]!==0)unknown();return Buffer.from(answer.subarray(8));}
  catch(error){if(sent){uncertain=true;if(error instanceof NativeBrokerError&&error.reason==='native-provider-unavailable'){uncertain=false;throw error;}}unknown();}
 }
 return {
  executeSync(operation,input){const bytes=inputBytes(operation,input);if(active&&operation!=='docker-engine-v1'&&(operation!=='target-lease-v1'||!['identity','inspect','registry-status'].includes((input as {action:string}).action)))unavailable();let reply:Buffer;if(bytes.length>16384){const size=Buffer.alloc(4);size.writeUInt32LE(bytes.length);if(request(9,size).length){uncertain=true;unknown();}for(let at=0;at<bytes.length;at+=MAX-8)if(request(10,bytes.subarray(at,Math.min(bytes.length,at+MAX-8))).length){uncertain=true;unknown();}reply=request(11,Buffer.alloc(0));}else reply=request(operation==='protect-path-v1'?1:operation==='target-lease-v1'?2:operation==='setup-root-v1'?12:7,bytes);if(operation==='docker-engine-v1'){if(!Buffer.from(reply.toString('utf8')).equals(reply)){uncertain=true;unknown();}let value:unknown;try{value=parseStrictJson(reply.toString('utf8'),16384);}catch{uncertain=true;unknown();}if(value&&typeof value==='object'&&(value as {status?:unknown}).status==='context-held'){let selection;try{selection=inspectHeldDockerContext(value);}catch{unavailable();}reply=request(8,Buffer.from(JSON.stringify(selection)));}}const stdout=reply.toString('utf8');if(!Buffer.from(stdout).equals(reply)||reply.length>16384){uncertain=true;unknown();}return{status:'ok',stdout};},
  openSession(operation,header){if(operation!=='backup-output-v1'||active||!Buffer.isBuffer(header)||header.length>16384)unavailable();if(header.length<8||header.subarray(0,8).toString('ascii')!=='CLBKOUT1')unavailable();let at=8;for(let i=0;i<14;i++){if(at+4>header.length)unavailable();const n=header.readUInt32BE(at);at+=4;if(n<1||n>4096||at+n>header.length)unavailable();const raw=header.subarray(at,at+n),text=raw.toString('utf8');if(!Buffer.from(text).equals(raw)||text.includes('\0'))unavailable();at+=n;}if(at!==header.length)unavailable();const openAck=request(3,header);active=true;let closed=false,nextFrame=0,aggregate=0;
   function usable(){if(closed||!active)unavailable();}
   return{openAck,writeFrame(bytes){usable();if(!Buffer.isBuffer(bytes)||bytes.length<6||bytes[0]!==1||bytes[1]!==nextFrame||nextFrame>=10)unavailable();const size=bytes.readUInt32BE(2),cap=nextFrame<4?67108864:nextFrame===9?65536:1048576;if(size>cap||bytes.length!==size+6||aggregate+size>273743872)unavailable();let ack:Buffer=Buffer.alloc(0);for(let offset=0;offset<bytes.length;offset+=MAX-8){const end=Math.min(bytes.length,offset+MAX-8);ack=request(4,bytes.subarray(offset,end));if(end<bytes.length&&ack.length!==0||end===bytes.length&&(ack.length===0||ack.length>16384)){uncertain=true;unknown();}}nextFrame++;aggregate+=size;return ack;},finish(terminal){usable();if(nextFrame!==10||!Buffer.isBuffer(terminal)||terminal.length!==1||terminal[0]!==2)unavailable();const ack=request(5,terminal);closed=true;active=false;return ack;},abort(){usable();try{request(6,Buffer.alloc(0));}finally{uncertain=true;}return unknown();}};
  }
 };
}
/* This is capability addressing inside the authenticated distribution flow,
   not cryptographic origin detection of specially forged direct-Node starts.
   Primary sets a fresh environment and CRT fd table; ordinary Node has none. */
const inherited:NativeBrokerChannel={
 available(){if(process.platform!=='win32'||process.env.CASTLINK_NATIVE_REQUEST_FD!=='3'||process.env.CASTLINK_NATIVE_REPLY_FD!=='4')return false;try{return fs.fstatSync(3).isFIFO()&&fs.fstatSync(4).isFIFO();}catch{return false;}},
 write(bytes){let n=0;while(n<bytes.length){const wrote=fs.writeSync(3,bytes,n,bytes.length-n);if(wrote<=0)unknown();n+=wrote;}},
 read(bytes){const result=Buffer.alloc(bytes);let n=0;while(n<bytes){const got=fs.readSync(4,result,n,bytes-n,null);if(got<=0)unknown();n+=got;}return result;}
};
export const windowsNativeBroker=createNativeBrokerClient(inherited);
