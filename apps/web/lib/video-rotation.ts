"use client";
import { useEffect, useState, type RefObject } from "react";
import { Room, RoomEvent } from "livekit-client";
export function participantRotation(metadata?: string): number {
  try { const angle = JSON.parse(metadata || "{}").videoRotation; return [0, 90, 180, 270].includes(angle) ? angle : 0; } catch { return 0; }
}
export function useVideoRotation(room: Room | undefined, identity: string, container: RefObject<HTMLElement | null>) {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const root = container.current;
    if (!room || !root) return;
    const update = () => {
      const p = room.localParticipant.identity === identity ? room.localParticipant : room.remoteParticipants.get(identity);
      const angle = participantRotation(p?.metadata); setRotation(angle);
      const videos = root instanceof HTMLVideoElement ? [root] : Array.from(root.querySelectorAll("video"));
      for (const video of videos) {
        const frame = video.parentElement || root;
        const w = frame.clientWidth || video.clientWidth;
        const h = frame.clientHeight || video.clientHeight;
        const scale = angle % 180 && w && h ? Math.min(w / h, h / w) : 1;
        video.style.transformOrigin = "center center";
        video.style.objectFit = "contain";
        video.style.objectPosition = "center center";
        video.style.rotate = `${angle}deg`;
        video.style.scale = String(scale);
      }
    };
    const resize = new ResizeObserver(update);
    resize.observe(root);
    if (root.parentElement) resize.observe(root.parentElement);
    const observer = new MutationObserver(update);
    observer.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["hidden"] });
    const events = [RoomEvent.ParticipantMetadataChanged, RoomEvent.ParticipantConnected, RoomEvent.TrackSubscribed];
    events.forEach(event => room.on(event, update)); update();
    return () => { resize.disconnect(); observer.disconnect(); events.forEach(event => room.off(event, update)); };
  }, [room, identity, container]);
  return rotation;
}
