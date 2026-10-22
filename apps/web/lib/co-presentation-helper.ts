import { createHash, randomBytes, randomUUID } from 'node:crypto';
import type { PresentationGuest } from './co-presentation-access';
type Scope = { studioId: string; room: string };
type Method = 'prepare' | 'start' | 'status' | 'step' | 'connect' | 'disconnect';
type Operation = { operationId: string; clientRequestId: string; method: Method; args: Record<string, unknown>; expiresAt: number; delivered: boolean; result?: unknown; done: boolean };
type Entry = Scope & { pairingId: string; owner: PresentationGuest; codeHash?: string; codeExpiresAt: number; tokenHash?: string; connectionId?: string; heartbeat: number; expiresAt: number; operations: Map<string, Operation>; requests: Map<string, string> };
const hash = (value: string) => createHash('sha256').update(value).digest('hex');
const key = (s: Scope, p: PresentationGuest) => JSON.stringify([s.studioId, s.room, p.identity]);
const same = (a: PresentationGuest | null, b: PresentationGuest) => !!a && a.identity === b.identity && a.sid === b.sid && a.association === b.association;
function fail(status = 409): never { throw Object.assign(new Error('Presentation helper unavailable'), { status }); }
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const keys = (v: Record<string, unknown>, fields: string[]) => Object.keys(v).every(k => fields.includes(k));
const opaque = (v: unknown) => typeof v === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(v);
const uuid = (v: unknown) => typeof v === 'string' && /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
const name = (v: unknown) => typeof v === 'string' && !!v && v.length <= 200 && !/[:/\\\u0000-\u001f\u007f]/.test(v);
const integer = (v: unknown, min: number, max: number) => Number.isSafeInteger(v) && (v as number) >= min && (v as number) <= max;
function nativeStatus(v: unknown) {
  if (!object(v) || !keys(v, ['id','name','page','pages','clickIndex','clickCount','showPosition','ended']) || !opaque(v.id) || !name(v.name) || !integer(v.pages,1,10000) || !integer(v.page,1,v.pages as number)) return false;
  return ['clickIndex','clickCount','showPosition'].every(k => v[k] === undefined || integer(v[k],k === 'clickIndex' ? -2 : 0,2147483647)) && (v.ended === undefined || typeof v.ended === 'boolean');
}
function argumentsFor(method: Method, args: unknown) {
  if (!object(args)) return false;
  switch(method) {
    case 'prepare': case 'connect': return keys(args, []);
    case 'start': return keys(args,['preparedId']) && opaque(args.preparedId);
    case 'status': case 'disconnect': return keys(args,['id']) && opaque(args.id);
    case 'step': return keys(args,['id','commandId','direction','expiresAt']) && opaque(args.id) && opaque(args.commandId) && ['next','previous'].includes(args.direction as string) && integer(args.expiresAt,Date.now()+1,Date.now()+3000);
    default: return false;
  }
}
function validResult(op: Operation, value: unknown) {
  if (object(value) && keys(value,['error']) && value.error === 'HELPER_OPERATION_FAILED') return true;
  switch(op.method) {
    case 'prepare': return value === null || object(value) && keys(value,['preparedId','name']) && opaque(value.preparedId) && name(value.name);
    case 'disconnect': return value === null;
    case 'step': return object(value) && keys(value,['commandId','status']) && value.commandId === op.args.commandId && nativeStatus(value.status) && (value.status as {id:string}).id === op.args.id;
    case 'status': return nativeStatus(value) && (value as {id:string}).id === op.args.id;
    default: return nativeStatus(value);
  }
}
/** In-memory, single-process test broker. No paths, document bytes or guest JWTs are retained. */
export function createHelperBroker({ live }: { live: (studioId: string, room: string, identity: string) => Promise<PresentationGuest | null> }) {
  const entries = new Map<string, Entry>();
  const current = (entry: Entry) => entries.get(key(entry,entry.owner)) === entry;
  const revoke = (entry: Entry) => { if (current(entry)) entries.delete(key(entry,entry.owner)); entry.tokenHash = undefined; entry.codeHash = undefined; entry.operations.clear(); entry.requests.clear(); };
  const expired = (entry: Entry) => entry.expiresAt <= Date.now() || (entry.tokenHash ? entry.heartbeat + 30000 <= Date.now() : entry.codeExpiresAt <= Date.now());
  async function check(entry: Entry) {
    const owner = await live(entry.studioId,entry.room,entry.owner.identity);
    if (!current(entry) || expired(entry) || !same(owner,entry.owner)) { revoke(entry); fail(401); }
  }
  function findNative(token: string, connectionId: string) {
    if (!/^ch2_[A-Za-z0-9_-]{43}$/.test(token) || !uuid(connectionId)) fail(401);
    const digest = hash(token);
    const entry = [...entries.values()].find(e => e.tokenHash === digest && e.connectionId === connectionId);
    return entry || fail(401);
  }
  function operationView(op: Operation) {
    if (!op.done && op.expiresAt <= Date.now()) return {operationId:op.operationId,done:true,error:'HELPER_OPERATION_EXPIRED'};
    return {operationId:op.operationId,done:op.done,...(op.done ? {result:op.result} : {})};
  }
  return {
    createPair(scope: Scope, owner: PresentationGuest) {
      for (const entry of entries.values()) if (expired(entry)) revoke(entry);
      const old = entries.get(key(scope,owner)); if (old) revoke(old);
      if (entries.size >= 512) fail(503);
      const code = 'cp2_' + randomBytes(32).toString('base64url'), expiresAt = Date.now()+120000;
      const pairingId=randomUUID();
      entries.set(key(scope,owner),{...scope,pairingId,owner:{...owner},codeHash:hash(code),codeExpiresAt:expiresAt,heartbeat:0,expiresAt:Date.now()+3600000,operations:new Map(),requests:new Map()});
      return {code,expiresAt,pairingId};
    },
    async pair(code: string) {
      if (!/^cp2_[A-Za-z0-9_-]{43}$/.test(code)) fail(401);
      const digest = hash(code), entry = [...entries.values()].find(e => e.codeHash === digest);
      if (!entry) fail(401);
      await check(entry);
      if (entry.codeHash !== digest) fail(401);
      const token = 'ch2_' + randomBytes(32).toString('base64url'), connectionId = randomUUID();
      entry.codeHash=undefined; entry.tokenHash=hash(token); entry.connectionId=connectionId; entry.heartbeat=Date.now();
      return {token,connectionId,expiresAt:entry.expiresAt};
    },
    async owner(scope: Scope, owner: PresentationGuest, action: string, data: Record<string, unknown>) {
      const entry = entries.get(key(scope,owner));
      if (!entry && action === 'state') return {connected:false};
      if (!entry || !same(owner,entry.owner)) fail(401);
      await check(entry);
      if ((data.pairingId !== undefined && data.pairingId !== entry.pairingId) || action === 'disconnect' && data.pairingId !== entry.pairingId) fail();
      if (action === 'state') return {connected:!!entry.tokenHash && entry.heartbeat+30000>Date.now(),pairingId:entry.pairingId};
      if (action === 'disconnect') { revoke(entry); return {connected:false}; }
      if (!entry.tokenHash) fail();
      if (action === 'result') {
        if (typeof data.operationId !== 'string') fail(400);
        const op=entry.operations.get(data.operationId); return op ? operationView(op) : fail();
      }
      if (action !== 'request' || !uuid(data.clientRequestId)) fail(400);
      // Expired read-only snapshots may be read again safely. Retain all
      // mutating request IDs for the entire pair lifetime: never replay effects.
      for (const [id, old] of entry.operations) if (old.method === 'status' && old.expiresAt <= Date.now()) { entry.operations.delete(id); entry.requests.delete(old.clientRequestId); }
      const existing = entry.requests.get(data.clientRequestId as string);
      if (existing) {
        const op=entry.operations.get(existing)!;
        if (op.method !== data.method || JSON.stringify(op.args) !== JSON.stringify(data.args)) fail();
        return operationView(op);
      }
      if (!argumentsFor(data.method as Method,data.args)) fail(400);
      if ([...entry.operations.values()].some(op=>!op.done && op.expiresAt>Date.now())) fail();
      if (entry.operations.size >= 512) { revoke(entry); fail(); }
      const method=data.method as Method, args=data.args as Record<string,unknown>;
      const expiresAt=Date.now() + (method==='prepare'||method==='start'?180000:15000);
      const op:Operation={operationId:randomUUID(),clientRequestId:data.clientRequestId as string,method,args:{...args},expiresAt:method==='step'?Math.min(args.expiresAt as number,Date.now()+3000):expiresAt,delivered:false,done:false};
      entry.operations.set(op.operationId,op);entry.requests.set(op.clientRequestId,op.operationId);
      return operationView(op);
    },
    async native(token: string, connectionId: string, action: string, data: Record<string,unknown>) {
      const entry=findNative(token,connectionId);await check(entry);
      if (action==='disconnect') { revoke(entry);return {connected:false}; }
      entry.heartbeat=Date.now();
      if (action==='poll') {
        const op=[...entry.operations.values()].find(o=>!o.delivered && !o.done && o.expiresAt>Date.now());
        if (!op) return {operation:null};
        op.delivered=true; // Commit delivery before returning. Lost responses never replay effects.
        return {operation:{operationId:op.operationId,method:op.method,args:op.args,expiresAt:op.expiresAt}};
      }
      if (action!=='result' || typeof data.operationId!=='string') fail(400);
      const op=entry.operations.get(data.operationId);
      if (!op || !op.delivered || op.expiresAt<=Date.now() || !validResult(op,data.result)) fail();
      if (op.done) { if (JSON.stringify(op.result)!==JSON.stringify(data.result)) fail(); return {ok:true}; }
      op.result=data.result;op.done=true;return {ok:true};
    },
  };
}
