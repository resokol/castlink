import {isDeepStrictEqual} from 'node:util';
import type {RoomRecord,RoomMutation} from './room-store';
// Snapshot before the callback: both replacement objects and in-place operator
// changes dirty the receipt, including a no-op operator write. Ordinary room
// grant versions remain unchanged. A dirty creation never regains its receipt.
export function applyDiagnosticRoomMutation(current:RoomRecord[],change:RoomMutation):RoomRecord[] {
 const entries=current.filter(room=>room.diagnosticCreationId).map(room=>({reference:room,snapshot:{...room}}));
 const references=new Map(entries.map(e=>[e.reference,e]));
 const creations=new Map(entries.map(e=>[e.snapshot.diagnosticCreationId,e]));
 const next=change(current);
 return next.map(room=>{
  const previous=references.get(room)??(room.diagnosticCreationId?creations.get(room.diagnosticCreationId):undefined);
  if(!previous)return room;
  if(!previous.snapshot.diagnosticRevision||room!==previous.reference||!isDeepStrictEqual(room,previous.snapshot))return {...room,diagnosticCreationId:previous.snapshot.diagnosticCreationId,diagnosticRevision:undefined};
  return room;
 });
}
