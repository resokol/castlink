import { randomUUID } from "node:crypto";
import { readServerFeatureState, updateServerFeatureState } from "./server-feature-store";
import { validateStudioId } from "./studio-scope";
import { CasterSlotConflict, sameSlotScope, type CasterSlot, type PersonalCasterInvite, type SlotScope } from "./caster-slot-types";
export type SlotData = { schemaVersion: 1; slots: Record<string, CasterSlot>; invites: Record<string, PersonalCasterInvite> };
const initial = (): SlotData => ({schemaVersion:1,slots:{},invites:{}});
function checked(data: SlotData) {
  if (data?.schemaVersion !== 1 || !data.slots || !data.invites || Array.isArray(data.slots) || Array.isArray(data.invites) || Object.values(data.slots).some(s=>!s || !s.scope || !Number.isSafeInteger(s.revision) || !s.outputVersions)) throw new Error("Invalid caster slot storage");
  return data;
}
export async function readCasterSlotData(studioId: string) { return checked(await readServerFeatureState("caster_slots", validateStudioId(studioId), initial)); }
export async function readCasterSlot(studioId: string, id: string): Promise<CasterSlot | null> { const data=await readCasterSlotData(studioId); return Object.hasOwn(data.slots,id) ? data.slots[id] : null; }
export async function readCasterSlots(scope: SlotScope) { return Object.values((await readCasterSlotData(scope.studioId)).slots).filter(s=>sameSlotScope(s.scope,scope)); }
export async function readPersonalCasterInvite(studioId: string, id: string) { const data=await readCasterSlotData(studioId);return Object.hasOwn(data.invites,id) ? data.invites[id] : null; }
export async function listPersonalCasterInvites(scope: SlotScope) { return Object.values((await readCasterSlotData(scope.studioId)).invites).filter(i=>sameSlotScope(i.scope,scope)&&i.enabled); }
function mutate<T>(studioId: string, change: (data: SlotData) => T | Promise<T>): Promise<T> {
  let result: T;
  return updateServerFeatureState("caster_slots",validateStudioId(studioId),initial,async current=>{ const data=checked(current); result=await change(data); return data; }).then(()=>result!);
}
// The callback holds the installation/scope transaction, including CAS checks.
export const transactCasterSlots=mutate;
function makeInvite(scope: SlotScope): PersonalCasterInvite { return {id:randomUUID(),scope:{...scope},version:randomUUID(),enabled:true}; }
export async function createPersonalCasterInvite(scope: SlotScope,guard?:()=>Promise<void>) {
  return mutate(scope.studioId,async data=>{await guard?.();if(Object.keys(data.invites).length>=2048)throw new Error("Слишком много приглашений");const invite=makeInvite(scope);data.invites[invite.id]=invite;return invite;});
}
/** Revoke only a standalone invitation; binding and removal share one transaction. */
export async function deletePersonalCasterInvite(scope: SlotScope,id: string,guard?:()=>Promise<void>) {
  return mutate(scope.studioId,async data=>{
    await guard?.();
    const invite=typeof id==="string"&&Object.hasOwn(data.invites,id) ? data.invites[id] : undefined;
    if(!invite?.enabled||!sameSlotScope(invite.scope,scope))throw new Error("Приглашение недействительно");
    if(Object.values(data.slots).some(slot=>slot.inviteId===id))throw new CasterSlotConflict("Приглашение связано со слотом. Обновите список.");
    delete data.invites[id];
  });
}
function nameOf(value: string) { if(typeof value!=="string"||!value.trim()||value.trim().length>120)throw new Error("Некорректное имя слота");return value.trim(); }
function requireInvite(data: SlotData, scope: SlotScope, id: string, ownSlot?: string) {
  const invite=Object.hasOwn(data.invites,id) ? data.invites[id] : undefined;
  if(!invite?.enabled||!sameSlotScope(invite.scope,scope))throw new Error("Приглашение недействительно");
  if(Object.values(data.slots).some(s=>s.id!==ownSlot&&s.inviteId===id))throw new CasterSlotConflict("Приглашение уже связано с другим слотом");
  return invite;
}
export async function createCasterSlot(scope: SlotScope,input: {name:string;inviteId?:string},guard?:()=>Promise<void>): Promise<CasterSlot> {
  const name=nameOf(input.name);
  return mutate(scope.studioId,async data=>{
    await guard?.();
    if(Object.values(data.slots).filter(s=>sameSlotScope(s.scope,scope)).length>=256)throw new Error("Слишком много слотов");
    const invite=input.inviteId ? requireInvite(data,scope,input.inviteId) : makeInvite(scope); data.invites[invite.id]=invite;
    const slot: CasterSlot={id:randomUUID(),scope:{...scope},name,inviteId:invite.id,revision:1,assignment:null,phase:"empty",outputVersions:{camera:randomUUID(),screen:randomUUID()}};
    data.slots[slot.id]=slot;return slot;
  });
}
export async function mutateCasterSlot(scope: SlotScope,id: string,revision: number,change: (slot:CasterSlot)=>CasterSlot|Promise<CasterSlot>,guard?:()=>Promise<void>): Promise<CasterSlot> {
  return mutate(scope.studioId,async data=>{
    await guard?.();
    const slot=Object.hasOwn(data.slots,id) ? data.slots[id] : undefined;
    if(!slot||!sameSlotScope(slot.scope,scope))throw new CasterSlotConflict("Слот не найден");
    if(!Number.isSafeInteger(revision)||slot.revision!==revision)throw new CasterSlotConflict("Слот уже изменён. Обновите список.");
    const next=await change(structuredClone(slot)); next.id=slot.id;next.scope=slot.scope;next.revision=slot.revision+1;
    if(next.assignment&&Object.values(data.slots).some(s=>s.id!==id&&s.assignment?.sessionId===next.assignment!.sessionId))throw new CasterSlotConflict("Кастер уже назначен в другой слот");
    data.slots[id]=next;return next;
  });
}
export async function updateCasterSlot(scope: SlotScope,id: string,revision: number,patch: {name?:string;inviteId?:string},guard?:()=>Promise<void>) {
  return mutate(scope.studioId,async data=>{
    await guard?.();
    const slot=Object.hasOwn(data.slots,id) ? data.slots[id] : undefined;
    if(!slot||!sameSlotScope(slot.scope,scope)||slot.revision!==revision)throw new CasterSlotConflict("Слот уже изменён. Обновите список.");
    if(patch.inviteId!==undefined)requireInvite(data,scope,patch.inviteId,id);
    const next={...slot,name:patch.name===undefined?slot.name:nameOf(patch.name),inviteId:patch.inviteId??slot.inviteId,revision:slot.revision+1};
    data.slots[id]=next;return next;
  });
}
export const rotateCasterSlotOutput=(scope:SlotScope,id:string,revision:number,source:"camera"|"screen",guard?:()=>Promise<void>)=>mutateCasterSlot(scope,id,revision,slot=>({...slot,outputVersions:{...slot.outputVersions,[source]:randomUUID()}}),guard);
export async function rotateCasterSlotInvite(scope:SlotScope,id:string,revision:number,guard?:()=>Promise<void>){
 return mutate(scope.studioId,async data=>{
  await guard?.();const slot=data.slots[id];
  if(!slot||!sameSlotScope(slot.scope,scope)||slot.revision!==revision)throw new CasterSlotConflict("Слот уже изменён. Обновите список.");
  if(slot.assignment||slot.transition)throw new CasterSlotConflict("Сначала освободите слот");
  const invite=requireInvite(data,scope,slot.inviteId,id);invite.version=randomUUID();slot.revision++;return structuredClone(slot);
 });
}
export async function deleteCasterSlot(scope: SlotScope,id:string,revision:number,guard?:()=>Promise<void>) {
  return mutate(scope.studioId,async data=>{
    await guard?.();
    const slot=Object.hasOwn(data.slots,id) ? data.slots[id] : undefined;
    if(!slot||!sameSlotScope(slot.scope,scope)||slot.revision!==revision)throw new CasterSlotConflict("Слот уже изменён. Обновите список.");
    if(slot.assignment||slot.phase==="preparing")throw new CasterSlotConflict("Сначала освободите слот");
    if(data.invites[slot.inviteId])data.invites[slot.inviteId].enabled=false;delete data.slots[id];
  });
}
