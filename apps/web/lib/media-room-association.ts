import {isDeepStrictEqual} from 'node:util';
import type {RoomRecord} from './room-store';
export type DiagnosticAssociation={creationId:string;revision:string};
const keys=['creationId','revision'];
export class DiagnosticRoomConflict extends Error {}
export function validateDiagnosticAssociation(value:unknown):asserts value is DiagnosticAssociation {
 if(!value||typeof value!=='object'||Array.isArray(value)||!isDeepStrictEqual(Object.keys(value).sort(),keys)||!Object.values(value).every(x=>typeof x==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(x)))throw new DiagnosticRoomConflict('Diagnostic room association is invalid or changed');
}
export function diagnosticAssociation(room:RoomRecord):DiagnosticAssociation {
 const association={creationId:room.diagnosticCreationId,revision:room.diagnosticRevision};validateDiagnosticAssociation(association);return association;
}
// Invoke only inside updateRooms: comparison and removal share the backend's mutation lock.
export function deleteDiagnosticRoom(rooms:RoomRecord[],name:string,expected:unknown):RoomRecord[] {
 validateDiagnosticAssociation(expected);
 const room=rooms.find(x=>x.name===name);
 if(!room||!isDeepStrictEqual(diagnosticAssociation(room),expected))throw new DiagnosticRoomConflict('Diagnostic room association is invalid or changed');
 if(rooms.length<2)throw new Error('Cannot delete the last room');
 return rooms.filter(x=>x.name!==name);
}
