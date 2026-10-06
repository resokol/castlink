import path from 'node:path';
import {CliError} from './types.js';
import type {TargetSqlGuard} from './target-sql-guard.js';
export type WindowsTargetLeaseBinding={nonce:string;activeIdentity:string;ownerIdentity:string;rootIdentity:string;scopeIdentity:string};
export type WindowsTargetRequest={operation:'caddy-ca-capture-v1';guard:TargetSqlGuard;lease:WindowsTargetLeaseBinding}|{operation:'owner-invite-capture-v1';guard:TargetSqlGuard;lease:WindowsTargetLeaseBinding}|{operation:'container-inspect-v1';guard:TargetSqlGuard;lease:WindowsTargetLeaseBinding}|{operation:'database-helper-v1';guard:TargetSqlGuard;lease:WindowsTargetLeaseBinding;phase:'migrations'|'seed'}|{operation:'owner-helper-v1';guard:TargetSqlGuard;lease:WindowsTargetLeaseBinding;phase:'initial'|'retained';origin:string}|{operation:'setup-observe-helper-v1';guard:TargetSqlGuard;lease:WindowsTargetLeaseBinding;origin:string;serverName:string};
export class WindowsNativeTargetError extends CliError{constructor(){super('Protected Windows target transport is unavailable or uncertain; retain the current target lease and private evidence.',4);}}
const refused=():never=>{throw new WindowsNativeTargetError();};
const exact=(v:unknown,k:string):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).sort().join(',')===k;
const hash=(x:unknown):x is string=>typeof x==='string'&&/^[a-f0-9]{64}$/.test(x);
function dos(x:unknown):x is string{return typeof x==='string'&&x.length<=1023&&/^[A-Z]:\\/.test(x)&&path.win32.normalize(x)===x&&!/[\x00-\x1f\x7f/"*?<>|]/.test(x)&&!x.slice(3).includes(':')&&!x.split('\\').some(p=>!p||p.endsWith('.')||p.endsWith(' '));}
const utf=(s:string,cap:number)=>{const b=Buffer.from(s);if(b.toString('utf8')!==s||b.length>cap||/[\x00-\x1f\x7f]/.test(s))return refused();return b;};
function origin(x:unknown):x is string{if(typeof x!=='string'||x.length>1024)return false;try{const u=new URL(x);return u.protocol==='https:'&&u.origin===x&&!u.username&&!u.password;}catch{return false;}}
function validateTargetGuard(g:TargetSqlGuard){const o=g?.operation; if(!exact(g,'configHash,containerId,containerImage,endpoint,fileHashes,operation,project')||!exact(o,'engine,epoch,installationId,kind,principal,root,schemaVersion,scope')||o.schemaVersion!==1||!['database','owner','completion'].includes(o.kind)||!dos(o.root)||!dos(o.scope)||path.win32.basename(o.scope)!=='.castlink-target-operations'||!Number.isSafeInteger(o.epoch)||o.epoch<0||!exact(o.principal,'kind,sid')||o.principal.kind!=='windows-sid'||typeof o.principal.sid!=='string'||!/^S-1-\d+(?:-\d+){1,15}$/.test(o.principal.sid)||! /^[A-Za-z0-9:._-]{1,128}$/.test(o.engine)||! /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(o.installationId)||g.endpoint!=='npipe:////./pipe/dockerDesktopLinuxEngine'||!hash(g.containerId)||!/^sha256:[a-f0-9]{64}$/.test(g.containerImage)||! /^[a-z0-9][a-z0-9_-]{0,127}$/.test(g.project)||!hash(g.configHash)||!exact(g.fileHashes,'compose.yaml,livekit.yaml,postgres.env,web.env')||!Object.values(g.fileHashes).every(hash))refused();
}
export function encodeWindowsTargetRequest(input:unknown):Buffer{
 if(!exact(input,'guard,lease,operation')&&!exact(input,'guard,lease,operation,phase')&&!exact(input,'guard,lease,operation,origin,phase')&&!exact(input,'guard,lease,operation,origin,serverName'))refused();
 const r=input as unknown as WindowsTargetRequest,g=r.guard,o=g?.operation,lease=r.lease;
 if(!exact(lease,'activeIdentity,nonce,ownerIdentity,rootIdentity,scopeIdentity')||!hash(lease.nonce)||![lease.activeIdentity,lease.ownerIdentity,lease.rootIdentity,lease.scopeIdentity].every(x=>typeof x==='string'&&/^[A-F0-9]{8}:[A-F0-9]{16}$/.test(x)))refused();
 validateTargetGuard(g);
 let op:number,phase=0,url='',name='';
 if(r.operation==='caddy-ca-capture-v1'){if(!exact(r,'guard,lease,operation')||o.kind!=='completion')refused();op=22;}
 else if(r.operation==='owner-invite-capture-v1'){if(!exact(r,'guard,lease,operation')||!['owner','completion'].includes(o.kind))refused();op=21;}
 else if(r.operation==='container-inspect-v1'){if(!exact(r,'guard,lease,operation'))refused();op=15;}
 else if(r.operation==='database-helper-v1'){if(!exact(r,'guard,lease,operation,phase')||o.kind!=='database'||!['migrations','seed'].includes(r.phase))refused();op=16;phase=r.phase==='seed'?1:0;}
 else if(r.operation==='owner-helper-v1'){if(!exact(r,'guard,lease,operation,origin,phase')||o.kind!=='owner'||!['initial','retained'].includes(r.phase)||!origin(r.origin))refused();op=17;phase=r.phase==='retained'?1:0;url=r.origin;}
 else if(r.operation==='setup-observe-helper-v1'){if(!exact(r,'guard,lease,operation,origin,serverName')||o.kind!=='completion'||!origin(r.origin)||typeof r.serverName!=='string'||!r.serverName.length||r.serverName.length>120||r.serverName.trim()!==r.serverName||/[\x00-\x1f\x7f]/.test(r.serverName))refused();op=18;url=r.origin;name=r.serverName;}
 else return refused();
 const h=Buffer.alloc(19);h.write('CLTARG02');h[8]=op;h[9]=['database','owner','completion'].indexOf(o.kind);h[10]=phase;h.writeBigUInt64LE(BigInt(o.epoch),11);
 return encodeTargetBody(g,h,Buffer.from(lease.nonce+lease.activeIdentity+lease.ownerIdentity+lease.rootIdentity+lease.scopeIdentity),url,name);
}
export type WindowsReadonlySnapshot={rootIdentity:string;scopeIdentity:string};
export type WindowsReadonlyTargetRequest={operation:'readonly-container-inspect-v1'|'readonly-caddy-ca-v1'|'readonly-owner-invite-v1';guard:TargetSqlGuard;snapshot:WindowsReadonlySnapshot}|{operation:'readonly-setup-observe-v1';guard:TargetSqlGuard;snapshot:WindowsReadonlySnapshot;origin:string;serverName:string};
function encodeTargetBody(g:TargetSqlGuard,h:Buffer,binding:Buffer,url:string,name:string):Buffer{const o=g.operation;
 const values=[o.root,o.scope,(o.principal as {sid:string}).sid,o.engine,url,name],caps=[3072,3072,200,128,1024,360],parts=values.map((s,i)=>{const b=utf(s,caps[i]!);const n=Buffer.alloc(2);n.writeUInt16BE(b.length);return Buffer.concat([n,b]);});
 const project=utf(g.project,128);const result=Buffer.concat([h,binding,Buffer.from(g.containerId+g.containerImage.slice(7)+o.installationId+g.fileHashes['compose.yaml']+g.fileHashes['livekit.yaml']+g.fileHashes['postgres.env']+g.fileHashes['web.env']+g.configHash),Buffer.from([project.length]),project,...parts]);if(result.length>12288)refused();return result;
}
export function encodeWindowsReadonlyTargetRequest(input:unknown):Buffer{
 if(!exact(input,'guard,operation,snapshot')&&!exact(input,'guard,operation,origin,serverName,snapshot'))refused();
 const r=input as unknown as WindowsReadonlyTargetRequest,g=r.guard,b=r.snapshot;validateTargetGuard(g);
 if(g.operation.kind!=='completion'||!exact(b,'rootIdentity,scopeIdentity')||![b.rootIdentity,b.scopeIdentity].every(x=>typeof x==='string'&&/^[A-F0-9]{8}:[A-F0-9]{16}$/.test(x)))refused();
 let op:number,url='',name='';
 if(r.operation==='readonly-setup-observe-v1'){if(!exact(r,'guard,operation,origin,serverName,snapshot')||!origin(r.origin)||typeof r.serverName!=='string'||!r.serverName.length||r.serverName.length>120||r.serverName.trim()!==r.serverName||/[\x00-\x1f\x7f]/.test(r.serverName))refused();op=24;url=r.origin;name=r.serverName;}
 else{if(!exact(r,'guard,operation,snapshot'))refused();if(r.operation==='readonly-container-inspect-v1')op=23;else if(r.operation==='readonly-caddy-ca-v1')op=25;else if(r.operation==='readonly-owner-invite-v1')op=26;else return refused();}
 const h=Buffer.alloc(19);h.write('CLREAD01');h[8]=op;h[9]=2;h.writeBigUInt64LE(BigInt(g.operation.epoch),11);
 return encodeTargetBody(g,h,Buffer.from(b.rootIdentity+b.scopeIdentity),url,name);
}
// Logical private result capture; shared wire integration maps begin/read/abort
// to reserved fixed opcodes15..20. No output goes to CLI streams or a journal.
export type WindowsTargetPrivateTransport={begin(body:Buffer):{source:number;bytes:number};read(source:number,offset:number):Buffer;abort(source:number):void};
export function createWindowsNativeTargetAdapter(transport:WindowsTargetPrivateTransport):(request:unknown)=>{status:'ok';bytes:Buffer}{return request=>{const readonly=!!request&&typeof request==='object'&&'operation'in request&&typeof request.operation==='string'&&request.operation.startsWith('readonly-'),body=readonly?encodeWindowsReadonlyTargetRequest(request):encodeWindowsTargetRequest(request),cap=[15,21,22,23,25,26].includes(body[8]!)?262144:2048;let source=0;const chunks:Buffer[]=[];try{const r=transport.begin(body);if(!exact(r,'bytes,source')||!Number.isSafeInteger(r.source)||r.source<1||r.source>0xffffffff)refused();source=r.source;if(!Number.isSafeInteger(r.bytes)||r.bytes<1||r.bytes>cap)refused();let at=0;while(at<r.bytes){const b=transport.read(source,at);if(!Buffer.isBuffer(b)||b.length<1||b.length>60000||b.length>r.bytes-at)refused();chunks.push(Buffer.from(b));at+=b.length;}return{status:'ok',bytes:Buffer.concat(chunks)}}catch{if(source)try{transport.abort(source)}catch{}return refused();}finally{body.fill(0);for(const b of chunks)b.fill(0)}};}
// Integration seam for the existing authenticated broker's SINGLE correlated
// request function. Never create a second fd reader or request-ID allocator.
export function createWindowsTargetWireTransport(request:(opcode:number,payload:Buffer)=>Buffer):WindowsTargetPrivateTransport{
 let active=0,remaining=0,nextOffset=0;
 return{
  begin(body){if(active||!Buffer.isBuffer(body)||body.length<19||body.length>12288||![15,16,17,18,21,22,23,24,25,26,27,28,29,30,31,32,33,34,35,36,37,38,39,40,41,42,43,44].includes(body[8]!))refused();const r=request(body[8]!,body);if(!Buffer.isBuffer(r)||r.length!==8)refused();const source=r.readUInt32LE(0),bytes=r.readUInt32LE(4);if(!source)refused();active=source;remaining=bytes;nextOffset=0;return{source,bytes};},
  read(source,offset){if(source!==active||offset!==nextOffset||!remaining)refused();const b=Buffer.alloc(8);b.writeUInt32LE(source,0);b.writeUInt32LE(offset,4);const r=request(19,b);if(!Buffer.isBuffer(r)||!r.length||r.length>60000||r.length>remaining)refused();nextOffset+=r.length;remaining-=r.length;if(!remaining)active=0;return r;},
  abort(source){if(source!==active)refused();const b=Buffer.alloc(4);b.writeUInt32LE(source);try{request(20,b)}finally{active=0;remaining=0;nextOffset=0;}}
 };
}
