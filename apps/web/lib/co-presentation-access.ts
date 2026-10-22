import type { NextRequest } from 'next/server';
import { RoomServiceClient, TokenVerifier } from 'livekit-server-sdk';
import { sameOrigin } from './access';
import { readRooms } from './room-store';
import { managedGuestIdentity } from './guest-admission-store';
import { mediaRoomName, validateStudioId } from './studio-scope';
export type PresentationGuest = {
    identity: string;
    sid: string;
    association: string;
    displayName?: string;
};
export async function presentationAssociation(studioId: string, roomName: string) {
    const room = (await readRooms(studioId)).find(item => item.name === roomName);
    return room ? room.creatorAccessId || room.slotAssociationId || room.guestInviteVersion || JSON.stringify([room.name, room.passwordHash || 'legacy']) : null;
}
/** All control grants are bound to a live admitted guest's exact media connection. */
export async function livePresentationGuest(studioId: string, roomName: string, identity: string): Promise<(PresentationGuest & {
    transferSessionId: string;
}) | null> {
    try {
        validateStudioId(studioId);
        if (!roomName || roomName.length > 100 || !/^guest-[A-Za-z0-9_-]{1,180}$/.test(identity))
            return null;
        const association = await presentationAssociation(studioId, roomName);
        if (!association)
            return null;
        const client = new RoomServiceClient(process.env.LIVEKIT_SERVER_URL || 'http://127.0.0.1:7880', process.env.LIVEKIT_API_KEY, process.env.LIVEKIT_API_SECRET);
        const participant = await client.getParticipant(mediaRoomName(studioId, roomName), identity);
        const live = JSON.parse(participant.metadata || '{}');
        if (participant.identity !== identity || !participant.sid || participant.permission?.canPublish === false || live.role !== 'guest' || live.studioId !== studioId || live.roomChatAssociation !== association || typeof live.transferSessionId !== 'string' || !live.transferSessionId)
            return null;
        const admission = await managedGuestIdentity({ studioId, roomAssociation: association }, identity);
        if (admission && (admission.state !== 'admitted' || admission.expiresAt <= Date.now()))
            return null;
        if (await presentationAssociation(studioId, roomName) !== association)
            return null;
        const displayName = typeof participant.name === 'string' ? participant.name.replace(/[\u0000-\u001f\u007f-\u009f\u202a-\u202e\u2066-\u2069]/g, '').trim().slice(0, 100) : '';
        return { identity, sid: participant.sid, association, transferSessionId: live.transferSessionId, ...(displayName ? { displayName } : {}) };
    }
    catch {
        return null;
    }
}
export async function presentationGuest(request: NextRequest, studioId: string, roomName: string): Promise<PresentationGuest | null> {
    try {
        if (!sameOrigin(request))
            return null;
        validateStudioId(studioId);
        const token = request.headers.get('authorization')?.match(/^Bearer (\S+)$/i)?.[1];
        const key = process.env.LIVEKIT_API_KEY, secret = process.env.LIVEKIT_API_SECRET;
        if (!token || !key || !secret)
            return null;
        const claims = await new TokenVerifier(key, secret).verify(token);
        const metadata = JSON.parse(claims.metadata || '{}');
        if (!claims.sub || claims.video?.room !== mediaRoomName(studioId, roomName) || claims.video?.canPublish === false || metadata.role !== 'guest' || metadata.roomChatOnly || metadata.studioId !== studioId || metadata.roomDisplayName !== roomName || typeof metadata.transferSessionId !== 'string' || !metadata.transferSessionId)
            return null;
        const live = await livePresentationGuest(studioId, roomName, claims.sub);
        if (!live || live.association !== metadata.roomChatAssociation || live.transferSessionId !== metadata.transferSessionId)
            return null;
        return { identity: live.identity, sid: live.sid, association: live.association };
    }
    catch {
        return null;
    }
}