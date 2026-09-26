"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Room, RoomEvent, Track, type RemoteAudioTrack } from "livekit-client";
import { bindMonitorAudio } from "./monitor-audio";

export type MonitorPreference = { audio: boolean; video: boolean; volume: number };
export const defaultMonitor: MonitorPreference = { audio: true, video: true, volume: 100 };

export function usePersonalMonitoring(room: Room, roomName: string, studioOnly = false) {
  const [preferences, setPreferences] = useState<Record<string, MonitorPreference>>({});
  const current = useRef(preferences);
  const restricted = useRef(studioOnly);
  restricted.current = studioOnly;
  const audioBindings = useRef(new Map<RemoteAudioTrack, () => void>());
  const [, refresh] = useState(0);
  const storageKey = `studiolink-monitor:${roomName}`;
  const videoEnabled = useCallback((identity: string) =>
    (!restricted.current || identity.startsWith("studio-panel-")) && (current.current[identity] ?? defaultMonitor).video, []);

  const apply = useCallback(() => {
    const activeTracks = new Set<RemoteAudioTrack>();
    for (const participant of room.remoteParticipants.values()) {
      const blocked = restricted.current && !participant.identity.startsWith("studio-panel-");
      const pref = blocked ? { audio: false, video: false, volume: 0 } : current.current[participant.identity] ?? defaultMonitor;
      for (const publication of participant.trackPublications.values()) {
        if (publication.kind === Track.Kind.Audio && publication.track) {
          const track = publication.track as RemoteAudioTrack;
          activeTracks.add(track);
          if (!audioBindings.current.has(track)) {
            audioBindings.current.set(track, bindMonitorAudio(track, () => {
              const value = current.current[participant.identity] ?? defaultMonitor;
              if (restricted.current && !participant.identity.startsWith("studio-panel-")) return 0;
              return value.audio ? value.volume / 100 : 0;
            }));
          }
          track.setVolume(pref.audio ? pref.volume / 100 : 0);
        }
        if (publication.kind === Track.Kind.Audio) {
          if (blocked && publication.isDesired) publication.setSubscribed(false);
          else if (!blocked && publication.isDesired === false) publication.setSubscribed(true);
        }
        if (publication.kind === Track.Kind.Video) {
          // This changes only this subscriber. Never mute the participant's publication.
          if (publication.isDesired !== pref.video) publication.setSubscribed(pref.video);
        }
      }
    }
    for (const [track, dispose] of audioBindings.current) {
      if (!activeTracks.has(track)) { dispose(); audioBindings.current.delete(track); }
    }
  }, [room]);

  useEffect(() => { apply(); }, [studioOnly, apply]);

  useEffect(() => {
    let saved: Record<string, MonitorPreference> = {};
    try {
      const raw = JSON.parse(localStorage.getItem(storageKey) || "{}");
      for (const [id, value] of Object.entries(raw)) {
        const v = value as MonitorPreference;
        if (typeof v.audio === "boolean" && typeof v.video === "boolean" && Number.isFinite(v.volume)) {
          saved[id] = { audio: v.audio, video: v.video, volume: Math.max(0, Math.min(100, v.volume)) };
        }
      }
    } catch { /* Preferences are optional. */ }
    current.current = saved;
    setPreferences(saved);
    const update = () => { apply(); refresh((v) => v + 1); };
    const events = [RoomEvent.Connected, RoomEvent.Reconnected, RoomEvent.ParticipantConnected,
      RoomEvent.ParticipantDisconnected, RoomEvent.TrackPublished, RoomEvent.TrackUnpublished,
      RoomEvent.TrackSubscribed, RoomEvent.TrackUnsubscribed];
    events.forEach((event) => room.on(event, update));
    update();
    return () => {
      events.forEach((event) => room.off(event, update));
      audioBindings.current.forEach((dispose) => dispose());
      audioBindings.current.clear();
    };
  }, [room, storageKey, apply]);

  const change = (identity: string, patch: Partial<MonitorPreference>) => {
    const next = { ...current.current, [identity]: { ...(current.current[identity] ?? defaultMonitor), ...patch } };
    current.current = next;
    setPreferences(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); } catch { /* Private browsing. */ }
    apply();
    if (patch.audio || (patch.volume !== undefined && patch.volume > 0)) void room.startAudio().catch(() => undefined);
  };

  return { preferences, change, apply, videoEnabled, participants: Array.from(room.remoteParticipants.values()) };
}
