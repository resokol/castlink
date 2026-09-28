"use client";

import { useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteVideoTrack } from "livekit-client";
import { useVideoRotation } from "@/lib/video-rotation";

function VideoSourcePreview({ room, identity, source, title, rotate, enabled, showUnavailable = true }: {
  room: Room; identity: string; source: Track.Source.Camera | Track.Source.ScreenShare; title: string; rotate: boolean; enabled: boolean; showUnavailable?: boolean;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  useVideoRotation(rotate ? room : undefined, identity, ref);
  const [available, setAvailable] = useState(false);
  const [published, setPublished] = useState(false);
  useEffect(() => {
    const element = ref.current;
    let attached: RemoteVideoTrack | undefined;
    const detach = () => {
      if (element && attached) attached.detach(element);
      attached = undefined;
      if (element) element.srcObject = null;
    };
    const update = () => {
      const publication = room.remoteParticipants.get(identity)?.getTrackPublication(source);
      const track = publication?.track as RemoteVideoTrack | undefined;
      setPublished(!!publication);
      const ready = enabled && !!track && !publication?.isMuted;
      setAvailable(ready);
      if (element && ready && track) {
        if (attached !== track) { detach(); track.attach(element); attached = track; }
      } else detach();
    };
    const events = [RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
      RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.ParticipantDisconnected];
    events.forEach(event => room.on(event, update));
    update();
    return () => { events.forEach(event => room.off(event, update)); detach(); };
  }, [room, identity, source, enabled, published]);
  return <div className="remote-video-source" data-video-source={source} hidden={!showUnavailable && !published}>
    <video ref={ref} autoPlay playsInline muted hidden={!available} aria-label={`${title}: ${identity}`} />
    {!available && <span>{enabled ? `${title} не включено` : "Видео скрыто у вас"}</span>}
  </div>;
}

export function RemoteVideoPreview({ room, identity, camera = true, screen = true, enabled = true }: {
  room: Room; identity: string; camera?: boolean; screen?: boolean; enabled?: boolean;
}) {
  return <div className="remote-video-preview">
    {camera && <VideoSourcePreview room={room} identity={identity} source={Track.Source.Camera} title="Камера" rotate enabled={enabled} />}
    {screen && <VideoSourcePreview room={room} identity={identity} source={Track.Source.ScreenShare} title="Экран / приложение" rotate={false} enabled={enabled} showUnavailable={false} />}
  </div>;
}
