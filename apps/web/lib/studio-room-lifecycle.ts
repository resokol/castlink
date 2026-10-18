import { Room, RoomEvent } from "livekit-client";

export type StudioRoomLifecycleHandlers = {
  onUpdate: () => void;
  onParticipantDeparted: (identity: string) => void;
  onActiveSpeakersChanged: () => void;
  onDataReceived: (...args: any[]) => void;
};

export function bindStudioRoomLifecycle(room: Room, handlers: StudioRoomLifecycleHandlers) {
  const departed = (participant: { identity: string }) => handlers.onParticipantDeparted(participant.identity);
  const speakers = () => handlers.onActiveSpeakersChanged();

  room.on(RoomEvent.ParticipantConnected, handlers.onUpdate);
  room.on(RoomEvent.ParticipantDisconnected, departed);
  room.on(RoomEvent.TrackPublished, handlers.onUpdate);
  room.on(RoomEvent.TrackUnpublished, handlers.onUpdate);
  room.on(RoomEvent.TrackMuted, handlers.onUpdate);
  room.on(RoomEvent.TrackUnmuted, handlers.onUpdate);
  room.on(RoomEvent.ActiveSpeakersChanged, speakers);
  room.on(RoomEvent.DataReceived, handlers.onDataReceived as any);

  return () => {
    room.off(RoomEvent.ParticipantConnected, handlers.onUpdate);
    room.off(RoomEvent.ParticipantDisconnected, departed);
    room.off(RoomEvent.TrackPublished, handlers.onUpdate);
    room.off(RoomEvent.TrackUnpublished, handlers.onUpdate);
    room.off(RoomEvent.TrackMuted, handlers.onUpdate);
    room.off(RoomEvent.TrackUnmuted, handlers.onUpdate);
    room.off(RoomEvent.ActiveSpeakersChanged, speakers);
    room.off(RoomEvent.DataReceived, handlers.onDataReceived as any);
    room.disconnect();
  };
}
