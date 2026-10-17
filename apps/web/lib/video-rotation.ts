"use client";
import { useEffect, useState, type RefObject } from "react";
import { Room, RoomEvent } from "livekit-client";
import { applyStudioImageTransform, studioImagePreview, subscribeStudioImagePreview } from "./studio-image-transform";
import { applyContainedVideoFit } from "./video-fit";
export function participantRotation(metadata?: string): number {
  try { const angle = JSON.parse(metadata || "{}").videoRotation; return [0,90,180,270].includes(angle) ? angle : 0; } catch { return 0; }
}
export function useVideoRotation(room: Room | undefined, identity: string, container: RefObject<HTMLElement | null>, studioImage = false) {
  const [rotation, setRotation] = useState(0);
  useEffect(() => {
    const root = container.current;
    if (!room || !root) return;
    const originals = new Map<HTMLVideoElement, string | null>();
    const frames = new Set<HTMLElement>();
    const resize = new ResizeObserver(() => update());
    const update = () => {
      const participant = room.localParticipant.identity === identity ? room.localParticipant : room.remoteParticipants.get(identity);
      const angle = participantRotation(participant?.metadata); setRotation(angle);
      const videos = root instanceof HTMLVideoElement ? [root] : Array.from(root.querySelectorAll("video"));
      const active = new Set(videos);
      for (const [old, style] of originals) {
        if (active.has(old)) continue;
        old.removeEventListener("loadedmetadata",update); old.removeEventListener("resize",update);
        if (style === null) old.removeAttribute("style"); else old.setAttribute("style",style);
        originals.delete(old);
      }
      const activeFrames = new Set(videos.map(video => video.parentElement).filter(Boolean));
      for (const frame of frames) if (!activeFrames.has(frame)) { resize.unobserve(frame); frames.delete(frame); }
      for (const video of videos) {
        const frame = video.parentElement;
        if (!frame) continue;
        if (!originals.has(video)) {
          originals.set(video,video.getAttribute("style"));
          video.addEventListener("loadedmetadata",update); video.addEventListener("resize",update);
        }
        if (!frames.has(frame)) { resize.observe(frame); frames.add(frame); }
        applyContainedVideoFit(video,frame,angle);
        if (studioImage) {
          const preview = studioImagePreview(room, identity, participant?.sid || "");
          applyStudioImageTransform(video, preview ? JSON.stringify({ studioImageTransform: preview }) : participant?.metadata);
        }
      }
    };
    const observer = new MutationObserver(update);
    observer.observe(root,{ childList:true,subtree:true,attributes:true,attributeFilter:["hidden"] });
    const events = [RoomEvent.ParticipantMetadataChanged,RoomEvent.ParticipantConnected,RoomEvent.TrackSubscribed];
    const unsubscribePreview = studioImage ? subscribeStudioImagePreview(room, update) : () => {};
    events.forEach(event => room.on(event,update)); update();
    return () => {
      unsubscribePreview(); resize.disconnect(); observer.disconnect(); events.forEach(event => room.off(event,update));
      for (const [video,style] of originals) {
        video.removeEventListener("loadedmetadata",update); video.removeEventListener("resize",update);
        if (style === null) video.removeAttribute("style"); else video.setAttribute("style",style);
      }
    };
  },[room,identity,container,studioImage]);
  return rotation;
}
