'use client';
import { useRef } from 'react';
import { Track, type Participant, type Room, type TrackPublication, type LocalVideoTrack, type RemoteVideoTrack } from 'livekit-client';
import { useRemotePcTile } from '@/lib/use-remote-pc-tile';
import { RemotePcOwnerStatus } from './RemotePcOwnerStatus';
import { RemotePcTileControls } from './RemotePcTileControls';
import { PublishedSourcePreview } from './ParticipantSourceCard';
export function RemotePcSourcePreview({ room, resolved, track, enabled, title }: {
    room: Room;
    resolved?: {
        participant: Participant;
        publication: TrackPublication;
    };
    track?: LocalVideoTrack | RemoteVideoTrack;
    enabled: boolean;
    title: string;
}) {
    const shell = useRef<HTMLDivElement>(null), control = useRemotePcTile(room, shell, { participant: resolved?.participant || room.localParticipant, publication: resolved?.publication, source: Track.Source.ScreenShare }, !enabled);
    return <div ref={shell} className="castlink-tile-shell remote-pc-source-preview" tabIndex={control.available ? 0 : undefined} aria-label={title}>
  <PublishedSourcePreview track={track} enabled={enabled} title={title}/>
  <RemotePcTileControls control={control}/>
  {resolved?.participant.isLocal && <RemotePcOwnerStatus room={room}/>}
 </div>;
}
