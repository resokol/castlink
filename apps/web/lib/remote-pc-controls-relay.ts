import { RoomEvent, type Room, type RemoteParticipant } from 'livekit-client';
import type { RemotePcParticipant, RemotePcSession } from './remote-pc-protocol';

/** UI intent only. This topic never carries input authority or credentials. */
export const REMOTE_PC_CONTROLS_TOPIC = 'castlink.remote-pc.controls.v1';
const MAX_BYTES = 4096, FRESH_MS = 1000;
// Token refresh may recreate the authenticated relay without replacing its SDK
// Room or the native publisher. Preserve stream order across that lifecycle.
const sequences = new WeakMap<Room,{state: number; action: number}>();
function sequence(room: Room) { let value = sequences.get(room); if (!value) { value = {state:0,action:0}; sequences.set(room,value); } return value; }
export type RemotePcControlsBinding = {sessionId: string; generation: string; owner: RemotePcParticipant};
export type RemotePcControlsCaster = RemotePcParticipant & {name: string};
type Scope = {sessionId: string; generation: string; captureId: string; revision: number};
export type RemotePcControlsState = Scope & {
  v: 1; type: 'state'; seq: number; expiresAt: number;
  owner: RemotePcParticipant; helper: RemotePcParticipant;
  source: {name: string; kind: 'window' | 'screen'; inputState: 'ready' | 'paused'; pointerReady: boolean};
  status: 'local' | 'activating' | 'active' | 'revoking' | 'stopping';
  controller: RemotePcControlsCaster | null; casters: RemotePcControlsCaster[];
  moreCasters: boolean; busy: boolean; error: boolean; locale: 'ru' | 'en' | 'zh-CN';
};
type Intent = Scope & {
  v: 1; type: 'action'; seq: number; stateSeq: number; expiresAt: number;
} & ({action: 'delegate'; controller: RemotePcParticipant} | {action: 'revoke'});
type Frame = RemotePcControlsState | Intent;
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const exact = (value: Record<string, unknown>, fields: string[]) => Object.keys(value).length === fields.length && fields.every(field => Object.hasOwn(value, field));
const opaque = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,200}$/.test(value);
const integer = (value: unknown, min = 1): value is number => Number.isSafeInteger(value) && (value as number) >= min;
const text = (value: unknown): value is string => typeof value === 'string' && value.length > 0 && value.length <= 120 && !/[\u0000-\u001f\u007f]/.test(value);
const person = (value: unknown): value is RemotePcParticipant => object(value) && exact(value, ['identity','sid']) && opaque(value.identity) && opaque(value.sid);
const caster = (value: unknown): value is RemotePcControlsCaster => object(value) && exact(value, ['identity','sid','name']) && opaque(value.identity) && opaque(value.sid) && text(value.name) && value.identity.startsWith('guest-');
const same = (a: RemotePcParticipant | undefined, b: RemotePcParticipant | undefined) => !!a && !!b && a.identity === b.identity && a.sid === b.sid;
const scopeFields = ['v','type','sessionId','generation','captureId','revision','seq','expiresAt'];
function valid(value: unknown): value is Frame {
  if (!object(value) || value.v !== 1 || !['sessionId','generation','captureId'].every(field => opaque(value[field])) || !integer(value.revision,0) || !integer(value.seq) || !integer(value.expiresAt)) return false;
  if (value.type === 'action') return exact(value,[...scopeFields,'stateSeq','action',...(value.action === 'delegate' ? ['controller'] : [])]) && integer(value.stateSeq) && (value.action === 'delegate' ? person(value.controller) && value.controller.identity.startsWith('guest-') : value.action === 'revoke');
  return value.type === 'state' && exact(value,[...scopeFields,'owner','helper','source','status','controller','casters','moreCasters','busy','error','locale']) && person(value.owner) && value.owner.identity.startsWith('guest-') && person(value.helper) && value.helper.identity.startsWith('remote-pc-') && object(value.source) && exact(value.source,['name','kind','inputState','pointerReady']) && text(value.source.name) && ['window','screen'].includes(value.source.kind as string) && ['ready','paused'].includes(value.source.inputState as string) && typeof value.source.pointerReady === 'boolean' && ['local','activating','active','revoking','stopping'].includes(value.status as string) && (value.controller === null || caster(value.controller)) && Array.isArray(value.casters) && value.casters.length <= 100 && value.casters.every(caster) && new Set(value.casters.map(p => p.identity)).size === value.casters.length && ['moreCasters','busy','error'].every(field => typeof value[field] === 'boolean') && ['ru','en','zh-CN'].includes(value.locale as string);
}
function decode(bytes: Uint8Array): Frame | undefined {
  if (!(bytes instanceof Uint8Array) || !bytes.byteLength || bytes.byteLength > MAX_BYTES) return;
  try { const value: unknown = JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes)); return valid(value) ? value : undefined; } catch { return; }
}
function encode(frame: Frame) {
  if (!valid(frame)) return;
  const bytes = new TextEncoder().encode(JSON.stringify(frame));
  return bytes.byteLength <= MAX_BYTES ? bytes : undefined;
}
const sameScope = (a: Scope, b: Scope) => a.sessionId === b.sessionId && a.generation === b.generation && a.captureId === b.captureId && a.revision === b.revision;
const label = (value: string | undefined, fallback: string) => (value || fallback).replace(/[\u0000-\u001f\u007f]/g,' ').trim().slice(0,120) || fallback;
const liveSender = (room: Room, sender: RemoteParticipant | undefined, expected: RemotePcParticipant) => same(sender,expected) && same(room.remoteParticipants.get(expected.identity),expected);
function publish(room: Room, frame: Frame, identity: string) {
  const bytes = encode(frame);
  if (!bytes) return false;
  try { void room.localParticipant.publishData(bytes,{reliable:true,topic:REMOTE_PC_CONTROLS_TOPIC,destinationIdentities:[identity]}).catch(() => {}); return true; } catch { return false; }
}

/** The owner browser remains the sole delegate/revoke principal. Native UI is
 * accepted only from its currently server-validated, live paired helper SID. */
export function createRemotePcOwnerControlsRelay({room,read,request,now = Date.now}: {
  room: Room;
  read(): {sessions: readonly RemotePcSession[]; ready: boolean; updatedAt: number};
  request(body: Record<string,unknown>): Promise<unknown>;
  now?: () => number;
}) {
  let disposed = false, busy = false, error = false, actionSeq = 0, binding = '';
  const stream = sequence(room);
  const issued = new Map<number,RemotePcControlsState>();
  function current() {
    const view = read(), time = now();
    if (disposed || room.state !== 'connected' || !view.ready || time < view.updatedAt || time - view.updatedAt >= FRESH_MS) return;
    const session = view.sessions.find(item => item.phase === 'sharing' && same(item.owner,room.localParticipant));
    const source = session?.source;
    if (!session || !source || source.sessionId !== session.id || source.generation !== session.generation || !same(source.owner,session.owner) || !source.helper.identity.startsWith('remote-pc-') || !same(room.remoteParticipants.get(source.helper.identity),source.helper)) return;
    return {session,source,updatedAt:view.updatedAt};
  }
  function sync() {
    const value = current(); if (!value) { issued.clear(); return; }
    const {session,source,updatedAt} = value;
    const key = [session.id,session.generation,source.captureId,source.helper.sid,session.owner.sid].join('/');
    if (binding !== key) { binding = key; issued.clear(); actionSeq = 0; error = false; }
    const casters = [...room.remoteParticipants.values()].filter(p => p.identity.startsWith('guest-') && p.identity !== session.owner.identity).sort((a,b) => a.identity.localeCompare(b.identity)).map(p => ({identity:p.identity,sid:p.sid,name:label(p.name,p.identity)}));
    const controller = session.grant?.controller;
    const frame: RemotePcControlsState = {
      v:1,type:'state',sessionId:session.id,generation:session.generation,captureId:source.captureId,revision:session.revision,
      seq:++stream.state,expiresAt:updatedAt + FRESH_MS,owner:{...session.owner},helper:{...source.helper},
      source:{name:label(source.name,'Screen'),kind:source.sourceKind,inputState:source.inputStatus?.state || 'paused',pointerReady:source.inputStatus?.pointerReady === true},
      status:session.pending?.action === 'stop' ? 'stopping' : session.pending ? 'revoking' : session.grant?.phase || 'local',
      controller:controller ? {...controller,name:label(same(room.remoteParticipants.get(controller.identity),controller) ? room.remoteParticipants.get(controller.identity)?.name : undefined,controller.identity)} : null,
      casters:casters.slice(0,100),moreCasters:casters.length > 100,busy,error,
      locale:typeof document !== 'undefined' && document.documentElement.lang === 'en' ? 'en' : typeof document !== 'undefined' && document.documentElement.lang === 'zh-CN' ? 'zh-CN' : 'ru',
    };
    // A roster is public display data, never authority. Bound it by UTF-8 bytes,
    // disclose the remainder, and retain native Stop even in crowded rooms.
    while (!encode(frame) && frame.casters.length) { frame.casters.pop(); frame.moreCasters = true; }
    if (publish(room,frame,source.helper.identity)) issued.set(frame.seq,frame);
    for (const [seq,state] of issued) if (state.expiresAt <= now() || issued.size > 8) issued.delete(seq);
  }
  const receive = (bytes: Uint8Array, sender?: RemoteParticipant, _kind?: unknown, topic?: string) => {
    if (topic !== REMOTE_PC_CONTROLS_TOPIC) return;
    const frame = decode(bytes), value = current();
    if (!frame || frame.type !== 'action' || !value || !liveSender(room,sender,value.source.helper)) return;
    const state = issued.get(frame.stateSeq), {session,source} = value;
    if (!state || !sameScope(frame,state) || !sameScope(frame,{sessionId:session.id,generation:session.generation,captureId:source.captureId,revision:session.revision}) || frame.expiresAt !== state.expiresAt || frame.expiresAt <= now() || frame.seq <= actionSeq || session.pending) return;
    const controller = frame.action === 'delegate' ? room.remoteParticipants.get(frame.controller.identity) : undefined;
    if (frame.action === 'delegate' && (!same(controller,frame.controller) || !state.casters.some(p => same(p,frame.controller)) || frame.controller.identity === session.owner.identity) || frame.action === 'revoke' && !session.grant) return;
    // Consume valid busy requests as well: reliable buffering must never replay
    // a second click when the first mutation eventually completes.
    actionSeq = frame.seq;
    if (busy) return;
    busy = true; error = false; sync();
    const acceptedBinding = binding;
    void request({action:frame.action,sessionId:session.id,generation:session.generation,revision:session.revision,...(frame.action === 'delegate' ? {controllerIdentity:frame.controller.identity,controllerSid:frame.controller.sid} : {})})
      .catch(() => { if (!disposed && binding === acceptedBinding) error = true; })
      .finally(() => { busy = false; if (!disposed) sync(); });
  };
  const clear = () => { issued.clear(); };
  const events = [RoomEvent.ParticipantConnected,RoomEvent.ParticipantDisconnected,RoomEvent.ParticipantNameChanged];
  room.on(RoomEvent.DataReceived,receive);room.on(RoomEvent.Disconnected,clear);room.on(RoomEvent.Reconnecting,clear);
  events.forEach(event => room.on(event,sync));
  return {sync,dispose() { disposed = true; issued.clear(); room.off(RoomEvent.DataReceived,receive);room.off(RoomEvent.Disconnected,clear);room.off(RoomEvent.Reconnecting,clear);events.forEach(event => room.off(event,sync)); }};
}

/** Publisher-only renderer receives public UI state; its button emits an
 * intent, never a grant. Stop remains the independent local native operation. */
export function createRemotePcPublisherControlsRelay({room,binding,captureId,onState,now = Date.now}: {
  room: Room; binding: RemotePcControlsBinding; captureId: string;
  onState(state: RemotePcControlsState | undefined): void; now?: () => number;
}) {
  let disposed = false, state: RemotePcControlsState | undefined, newest = 0, pending = false;
  const stream = sequence(room);
  const clear = () => { state = undefined; pending = false; onState(undefined); };
  const fresh = () => !!state && room.state === 'connected' && state.expiresAt > now();
  const receive = (bytes: Uint8Array, sender?: RemoteParticipant, _kind?: unknown, topic?: string) => {
    if (disposed || room.state !== 'connected' || topic !== REMOTE_PC_CONTROLS_TOPIC || !liveSender(room,sender,binding.owner)) return;
    const frame = decode(bytes);
    if (!frame || frame.type !== 'state' || frame.seq <= newest || frame.expiresAt <= now() || frame.expiresAt > now() + FRESH_MS || frame.sessionId !== binding.sessionId || frame.generation !== binding.generation || frame.captureId !== captureId || !same(frame.owner,binding.owner) || !same(frame.helper,room.localParticipant)) return;
    newest = frame.seq; state = frame; pending = false; onState(frame);
  };
  room.on(RoomEvent.DataReceived,receive);room.on(RoomEvent.Disconnected,clear);room.on(RoomEvent.Reconnecting,clear);
  const timer = setInterval(() => { if (state && !fresh()) clear(); },100);
  return {
    action(action: 'delegate' | 'revoke', controller?: RemotePcParticipant) {
      if (disposed || !fresh() || !state || state.busy || pending || ['activating','revoking','stopping'].includes(state.status)) return false;
      if (action === 'delegate' ? !controller || !state.casters.some(p => same(p,controller)) : action !== 'revoke' || !state.controller) return false;
      const frame: Intent = {v:1,type:'action',sessionId:state.sessionId,generation:state.generation,captureId:state.captureId,revision:state.revision,seq:++stream.action,stateSeq:state.seq,expiresAt:state.expiresAt,...(action === 'delegate' ? {action,controller:{identity:controller!.identity,sid:controller!.sid}} : {action})};
      if (!publish(room,frame,binding.owner.identity)) return false;
      pending = true; onState({...state,busy:true}); return true;
    },
    dispose() { disposed = true; clearInterval(timer); room.off(RoomEvent.DataReceived,receive);room.off(RoomEvent.Disconnected,clear);room.off(RoomEvent.Reconnecting,clear);clear(); },
  };
}
