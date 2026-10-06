import {isDeepStrictEqual} from 'node:util';
export type MediaEvidenceScope={runId:string;studioId:string;room:string};
function fields(v:unknown,keys:string[]):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v)&&isDeepStrictEqual(Object.keys(v).sort(),keys.sort());}
function counters(v:unknown):v is Record<string,number>{return fields(v,['at','bytes','packets','frames'])&&Object.values(v).every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0);}
// This validates measurement structure and scope only. Imported assertions and
// injectable transports cannot establish trusted browser provenance or PASS.
export function validateBrowserMeasurements(value:unknown,scope:MediaEvidenceScope):boolean {
 if(!fields(value,['runId','studioId','room','page','mode','clients'])||value.runId!==scope.runId||value.studioId!==scope.studioId||value.room!==scope.room||value.page!=='/room'||!['udp','relay-only'].includes(value.mode as string)||!Array.isArray(value.clients)||value.clients.length!==2)return false;
 const identities=new Set<string>();
 for(const c of value.clients){
  if(!fields(c,['identity','peerIdentity','tracks','candidate'])||typeof c.identity!=='string'||!/^guest-[a-zA-Z0-9-]{1,90}$/.test(c.identity)||typeof c.peerIdentity!=='string'||c.peerIdentity===c.identity||identities.has(c.identity)||!Array.isArray(c.tracks)||c.tracks.length!==2)return false;identities.add(c.identity);
  const kinds=new Set<string>();for(const t of c.tracks){if(!fields(t,['kind','before','after'])||!['audio','video'].includes(t.kind as string)||kinds.has(t.kind as string)||!counters(t.before)||!counters(t.after)||t.after.at!<=t.before.at!||t.after.at!-t.before.at!>60000||t.after.bytes!<=t.before.bytes!||t.after.packets!<=t.before.packets!||t.kind==='video'&&t.after.frames!<=t.before.frames!)return false;kinds.add(t.kind as string);}
  const p=c.candidate;if(!fields(p,['selected','state','localType','remoteType','protocol'])||p.selected!==true||p.state!=='succeeded'||!['host','srflx','prflx','relay'].includes(p.localType as string)||!['host','srflx','prflx','relay'].includes(p.remoteType as string)||!['udp','tcp'].includes(p.protocol as string)||value.mode==='udp'&&p.protocol!=='udp'||value.mode==='relay-only'&&p.localType!=='relay'&&p.remoteType!=='relay')return false;
 }
 return value.clients.every(c=>identities.has(c.peerIdentity));
}
