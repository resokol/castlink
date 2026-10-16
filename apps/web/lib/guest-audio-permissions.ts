import { Room, RoomEvent, Track } from 'livekit-client';
import { guestAudioSubscriptionPermissions } from './guest-entry-settings';
/** Guest publisher only: TalkbackControls owns permissions of its separate talkback participant. */
export function watchGuestAudioPermissions(room: Room) {
 const apply = () => {
   const videos = Array.from(room.localParticipant.trackPublications.values()).filter(p=>p.kind===Track.Kind.Video).map(p=>p.trackSid);
   room.localParticipant.setTrackSubscriptionPermissions(false, guestAudioSubscriptionPermissions(room.remoteParticipants.values(), videos));
 };
 // Install deny-by-default before connecting/publishing, so new recipients cannot briefly hear audio.
 apply();
 const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.ParticipantConnected, RoomEvent.ParticipantDisconnected, RoomEvent.ParticipantMetadataChanged, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished];
 events.forEach(event=>room.on(event, apply));
 return () => { events.forEach(event=>room.off(event, apply)); };
}
